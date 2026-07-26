import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["Billing"])

DODO_TOKEN = os.environ.get("DODO_PAYMENTS_TOKEN", "")

# Initialize SDK only if token is present
dodo_client = None
if DODO_TOKEN:
    try:
        from dodopayments import DodoPayments
        dodo_client = DodoPayments(bearer_token=DODO_TOKEN)
    except ImportError:
        logger.warning("dodopayments SDK not installed")

class CheckoutRequest(BaseModel):
    plan_id: str

# Map plan_id from frontend to Dodo product IDs
PLAN_TO_PRODUCT = {
    "starter": os.environ.get("DODO_STARTER_PRODUCT_ID", "pdt_starter_299"),
    "pro": os.environ.get("DODO_PRO_PRODUCT_ID", "pdt_pro_799"),
    "scale": os.environ.get("DODO_SCALE_PRODUCT_ID", "pdt_scale_1999"),
}

@router.post("/checkout")
async def create_checkout_link(request_data: CheckoutRequest, user: dict = Depends(get_current_user)):
    """Generate a Dodo Payments checkout link for a specific subscription plan."""
    tenant_id = user["tenant_id"]
    email = user.get("email", "user@example.com")
    
    plan_id = request_data.plan_id
    if plan_id not in PLAN_TO_PRODUCT:
        raise HTTPException(status_code=400, detail="Invalid plan selected")
        
    product_id = PLAN_TO_PRODUCT[plan_id]
    
    if not dodo_client:
        logger.info(f"Dev mode checkout for {tenant_id} - Plan: {plan_id}")
        return {"payment_link": f"https://test.dodopayments.com/dummy-link-dev-mode?plan={plan_id}"}
    
    try:
        # Create a payment link using dodopayments SDK
        response = dodo_client.payments.create(
            billing={
                "city": "San Francisco",
                "country": "US",
                "state": "CA",
                "street": "1 Market St",
                "zipcode": "94105"
            },
            customer={
                "email": email,
                "name": email.split("@")[0]
            },
            product_cart=[
                {
                    "product_id": product_id,
                    "quantity": 1
                }
            ],
            payment_link=True,
            return_url="http://localhost:5173/dashboard?payment=success",
            metadata={
                "tenant_id": tenant_id,
                "plan_id": plan_id
            }
        )
        return {"payment_link": response.payment_link}
    except Exception as e:
        logger.error(f"Dodo payments checkout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")


@router.post("/webhook")
async def dodo_webhook(request: Request):
    """Handle Dodo Payments webhooks for subscription provisioning."""
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
        
    event_type = payload.get("type")
    data = payload.get("data", {})
    
    logger.info(f"Received Dodo Webhook: {event_type}")
    
    # Depending on Dodo's specific webhook event naming, we listen for successful payments/subscriptions
    if event_type in ["payment.succeeded", "subscription.active", "subscription.created"]:
        metadata = data.get("metadata", {})
        tenant_id = metadata.get("tenant_id")
        plan_id = metadata.get("plan_id", "pro") # Default to pro if missing
        
        if not tenant_id:
            # Fallback to lookup by email if metadata was lost
            email = data.get("customer", {}).get("email")
            if email:
                conn = get_db()
                result = conn.execute("SELECT tenant_id FROM users WHERE email = ?", [email])
                if result.rows:
                    tenant_id = result.rows[0][0]
                    
        if tenant_id:
            conn = get_db()
            # Upgrade tenant to the paid plan
            conn.execute("UPDATE tenants SET plan = ? WHERE id = ?", [plan_id, tenant_id])
            logger.info(f"Successfully upgraded tenant {tenant_id} to plan: {plan_id}")
        else:
            logger.warning("Could not resolve tenant_id for webhook fulfillment")
            
    return {"status": "ok"}

@router.post("/cancel")
async def cancel_subscription(user: dict = Depends(get_current_user)):
    """
    Handle a user's request to cancel their premium subscription.
    Since subscription IDs are not stored directly, this alerts the support team 
    to manually cancel it in Dodo Payments, ensuring the user retains access until 
    the end of their current billing cycle as per the Refund & Cancellation Policy.
    """
    tenant_id = user["tenant_id"]
    email = user.get("email", "unknown_email")
    
    # In a fully integrated system, you would send an email here using an SMTP or Email API like Resend/Sendgrid
    # For now, we log it prominently so the admin is alerted to cancel it in Dodo.
    logger.critical(f"ACTION REQUIRED: User {email} (Tenant {tenant_id}) requested subscription cancellation via Dashboard. "
                    f"Please cancel their subscription in the Dodo Payments dashboard so it does not auto-renew.")
    
    # We could also mark a flag in the DB like `pending_cancellation = True` if we added that column.
    
    return {"status": "ok", "message": "Cancellation request received."}
