import logging
from datetime import datetime
from typing import Optional, List
import random
import string
import httpx

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from google.cloud import firestore
import firebase_admin
import resend

from app.core.config import get_settings
from app.core.auth import verify_admin_email

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(tags=["Campaign Links"])

resend.api_key = settings.RESEND_API_KEY

def get_firestore_client():
    if not firebase_admin._apps:
        raise RuntimeError("Firebase Admin not initialized")
    return firestore.Client(project=settings.FIREBASE_PROJECT_ID)

# --- Models ---
class CampaignCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    preview_text: Optional[str] = ""
    html_template: str
    tags: Optional[List[str]] = []

class CampaignSignupRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    company: Optional[str] = None

class CampaignSendRequest(BaseModel):
    subject: str
    send_to_all: bool = True

def is_valid_email(email: str) -> bool:
    return "@" in email and "." in email

# --- Admin Endpoints ---

@router.post("/api/admin/campaigns/create-code")
async def create_campaign_with_code(
    request: CampaignCreateRequest,
    admin_email: dict = Depends(verify_admin_email)
):
    """Create campaign from raw HTML code"""
    if len(request.html_template) < 50:
        raise HTTPException(status_code=400, detail="HTML template too short")
    
    slug_base = "".join(c if c.isalnum() else "-" for c in request.name.lower())[:20]
    slug_base = slug_base.strip("-")
    slug_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    slug = f"{slug_base}-{slug_suffix}"
    
    # Create Resend audience
    try:
        audience = resend.Audiences.create({
            "name": f"{request.name} - Signups"
        })
    except Exception as e:
        logger.error(f"Failed to create audience: {e}")
        raise HTTPException(status_code=500, detail="Failed to create Resend audience")
        
    db = get_firestore_client()
    campaign_doc = {
        "slug": slug,
        "name": request.name,
        "description": request.description,
        "preview_text": request.preview_text,
        "html_template": request.html_template,
        "status": "draft",
        "created_at": datetime.now(),
        "published_at": None,
        "audience_id": audience["id"],
        "views": 0,
        "signups": 0,
        "created_by_admin": admin_email.get("email"),
        "tags": request.tags or []
    }
    
    campaign_ref = db.collection("campaigns").document()
    campaign_ref.set(campaign_doc)
    
    share_url = f"{settings.FRONTEND_URL}/campaigns/{slug}" if hasattr(settings, "FRONTEND_URL") else f"https://lucidaanalytics.tech/campaigns/{slug}"
    
    return {
        "success": True,
        "campaign_id": campaign_ref.id,
        "slug": slug,
        "share_url": share_url,
        "message": "Campaign created. Share on LinkedIn!"
    }

@router.get("/api/admin/campaigns/firestore")
async def list_firestore_campaigns(
    admin_email: dict = Depends(verify_admin_email)
):
    """List all firestore campaigns"""
    db = get_firestore_client()
    campaigns = db.collection("campaigns").order_by("created_at", direction=firestore.Query.DESCENDING).stream()
    
    result = []
    for c in campaigns:
        data = c.to_dict()
        data["id"] = c.id
        result.append(data)
        
    return result

@router.get("/api/admin/campaigns/{campaign_id}/signups")
async def list_campaign_signups(
    campaign_id: str,
    admin_email: dict = Depends(verify_admin_email)
):
    """List all signups for a campaign"""
    db = get_firestore_client()
    campaign = db.collection("campaigns").document(campaign_id).get()
    
    if not campaign.exists:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    campaign_data = campaign.to_dict()
    signups = db.collection("campaign_signups").where("campaign_id", "==", campaign_id).stream()
    
    signup_list = []
    for signup in signups:
        data = signup.to_dict()
        signup_list.append({
            "id": signup.id,
            "email": data.get("email"),
            "first_name": data.get("first_name"),
            "last_name": data.get("last_name"),
            "company": data.get("company"),
            "signed_up_at": data.get("signed_up_at"),
            "email_confirmed": data.get("email_confirmed", False),
            "campaign_email_sent": data.get("campaign_email_sent", False),
            "opened": data.get("opened", False),
            "clicked": data.get("clicked", False)
        })
    
    # Sort descending
    signup_list.sort(key=lambda x: x["signed_up_at"] if x["signed_up_at"] else datetime.min, reverse=True)
    
    return {
        "campaign_id": campaign_id,
        "campaign_name": campaign_data.get("name"),
        "total_signups": len(signup_list),
        "confirmed": sum(1 for s in signup_list if s.get("email_confirmed")),
        "pending_confirmation": sum(1 for s in signup_list if not s.get("email_confirmed")),
        "signups": signup_list
    }

@router.post("/api/admin/campaigns/{campaign_id}/send")
async def send_campaign_to_signups(
    campaign_id: str,
    request: CampaignSendRequest,
    admin_email: dict = Depends(verify_admin_email)
):
    """Send campaign email to all signups"""
    db = get_firestore_client()
    campaign = db.collection("campaigns").document(campaign_id).get()
    
    if not campaign.exists:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    campaign_data = campaign.to_dict()
    audience_id = campaign_data.get("audience_id")
    
    try:
        broadcast = resend.Broadcasts.create({
            "audience_id": audience_id,
            "name": campaign_data.get("name"),
            "subject": request.subject,
            "html": campaign_data.get("html_template"),
            "from": settings.SENDER_DOMAIN if hasattr(settings, "SENDER_DOMAIN") and settings.SENDER_DOMAIN else "hello@lucidaanalytics.tech",
        })
        broadcast_id = broadcast["id"]
        resend.Broadcasts.send(broadcast_id)
    except Exception as e:
        logger.error(f"Failed to send broadcast: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create broadcast: {e}")
    
    signups = db.collection("campaign_signups").where("campaign_id", "==", campaign_id).stream()
    
    sent_count = 0
    for signup in signups:
        if signup.to_dict().get("email_confirmed", False):
            signup.reference.update({
                "campaign_email_sent": True,
                "campaign_email_sent_at": datetime.now(),
                "resend_broadcast_id": broadcast_id
            })
            sent_count += 1
            
    db.collection("campaigns").document(campaign_id).update({
        "status": "sent",
        "email_sent_at": datetime.now()
    })
    
    return {
        "success": True,
        "campaign_id": campaign_id,
        "emails_sent": sent_count,
        "message": f"Campaign sent to {sent_count} confirmed subscribers"
    }

@router.get("/api/admin/campaigns/{campaign_id}/analytics")
async def get_campaign_analytics(
    campaign_id: str,
    admin_email: dict = Depends(verify_admin_email)
):
    """Get campaign analytics"""
    db = get_firestore_client()
    campaign = db.collection("campaigns").document(campaign_id).get()
    
    if not campaign.exists:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    data = campaign.to_dict()
    signups = db.collection("campaign_signups").where("campaign_id", "==", campaign_id).stream()
    
    signup_list = [s.to_dict() for s in signups]
    total_signups = len(signup_list)
    confirmed = sum(1 for s in signup_list if s.get("email_confirmed"))
    sent = sum(1 for s in signup_list if s.get("campaign_email_sent"))
    
    def calc_rate(num, denom):
        if denom == 0: return "0%"
        return f"{round((num/denom)*100, 1)}%"
        
    return {
        "campaign_id": campaign_id,
        "campaign_name": data.get("name"),
        "status": data.get("status"),
        "statistics": {
            "views": data.get("views", 0),
            "unique_views": data.get("views", 0), # Simplified for now
            "signups": total_signups,
            "confirmed": confirmed,
            "confirmation_rate": calc_rate(confirmed, total_signups),
            "email_sent": sent,
            "email_opened": sum(1 for s in signup_list if s.get("opened")),
            "email_open_rate": calc_rate(sum(1 for s in signup_list if s.get("opened")), sent),
            "email_clicked": sum(1 for s in signup_list if s.get("clicked")),
            "email_click_rate": calc_rate(sum(1 for s in signup_list if s.get("clicked")), sent),
        }
    }


# --- Public Endpoints ---

@router.get("/api/campaigns/{slug}")
async def get_campaign_public(slug: str):
    """Get campaign (public, no auth needed)"""
    db = get_firestore_client()
    campaigns = db.collection("campaigns").where("slug", "==", slug).stream()
    campaign_doc = next(campaigns, None)
    
    if not campaign_doc:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    data = campaign_doc.to_dict()
    
    db.collection("campaigns").document(campaign_doc.id).update({
        "views": firestore.Increment(1)
    })
    
    return {
        "id": campaign_doc.id,
        "slug": data.get("slug"),
        "name": data.get("name"),
        "description": data.get("description"),
        "preview_text": data.get("preview_text"),
        "html_template": data.get("html_template"),
        "signups_so_far": data.get("signups", 0),
        "views_so_far": data.get("views", 0) + 1
    }

@router.post("/api/campaigns/{slug}/signup")
async def signup_to_campaign(
    slug: str,
    req: CampaignSignupRequest,
    request: Request
):
    """Collect email for campaign (public endpoint)"""
    if not is_valid_email(req.email):
        raise HTTPException(status_code=400, detail="Invalid email")
    
    db = get_firestore_client()
    campaigns = db.collection("campaigns").where("slug", "==", slug).stream()
    campaign_doc = next(campaigns, None)
    
    if not campaign_doc:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    campaign_data = campaign_doc.to_dict()
    audience_id = campaign_data.get("audience_id")
    
    existing = db.collection("campaign_signups").where("email", "==", req.email).where("campaign_slug", "==", slug).stream()
    if next(existing, None):
        return {"success": False, "message": "Email already signed up for this campaign"}
        
    try:
        contact = resend.Contacts.create({
            "audience_id": audience_id,
            "email": req.email,
            "first_name": req.first_name,
            "last_name": req.last_name,
            "unsubscribed": False
        })
        contact_id = contact.get("id") if isinstance(contact, dict) else getattr(contact, 'id', None)
    except Exception as e:
        logger.warning(f"Resend contact creation warning (might already exist): {e}")
        contact_id = None

    signup_doc = {
        "campaign_id": campaign_doc.id,
        "campaign_slug": slug,
        "email": req.email,
        "first_name": req.first_name,
        "last_name": req.last_name,
        "company": req.company,
        "signed_up_at": datetime.now(),
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent", ""),
        "resend_contact_id": contact_id,
        "email_confirmed": False,
        "campaign_email_sent": False,
        "opened": False,
        "clicked": False,
        "unsubscribed": False
    }
    
    signup_ref = db.collection("campaign_signups").document()
    signup_ref.set(signup_doc)
    
    db.collection("campaigns").document(campaign_doc.id).update({
        "signups": firestore.Increment(1)
    })
    
    domain = settings.FRONTEND_URL if hasattr(settings, "FRONTEND_URL") else "https://lucidaanalytics.tech"
    if "localhost" in domain:
        domain = "http://localhost:5173"
        
    confirmation_link = f"{domain}/api/campaigns/confirm/{signup_ref.id}"
    
    # Send confirmation email
    try:
        resend.Emails.send({
            "from": settings.SENDER_DOMAIN if hasattr(settings, "SENDER_DOMAIN") and settings.SENDER_DOMAIN else "hello@lucidaanalytics.tech",
            "to": req.email,
            "subject": f"Confirm your signup for {campaign_data.get('name')}",
            "html": f"""
            <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI'; padding: 20px;">
            <h1>Welcome, {req.first_name}!</h1>
            <p>Click below to confirm your email and join the list for {campaign_data.get('name')}.</p>
            <a href="{confirmation_link}" style="background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              Confirm Email
            </a>
            <p style="margin-top: 20px; color: #999; font-size: 12px;">
            If you didn't sign up, you can ignore this email.
            </p>
            </body>
            </html>
            """
        })
    except Exception as e:
        logger.error(f"Failed to send confirmation email: {e}")
    
    return {
        "success": True,
        "message": "Email added! Check your inbox for confirmation.",
        "signup_id": signup_ref.id
    }

@router.get("/api/campaigns/confirm/{signup_id}")
async def confirm_email(signup_id: str):
    """Confirm email address"""
    db = get_firestore_client()
    signup_ref = db.collection("campaign_signups").document(signup_id)
    signup = signup_ref.get()
    
    if not signup.exists:
        return {"success": False, "message": "Signup not found"}
        
    signup_data = signup.to_dict()
    signup_ref.update({"email_confirmed": True})
    
    # Return HTML for browser
    from fastapi.responses import HTMLResponse
    html_content = f"""
    <html>
        <head>
            <title>Email Confirmed</title>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
                .card {{ background: #111; padding: 40px; border-radius: 12px; border: 1px solid #333; text-align: center; max-width: 400px; }}
                h1 {{ color: #10b981; margin-top: 0; }}
                p {{ color: #a1a1aa; line-height: 1.5; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h1>✓ Confirmed!</h1>
                <p>Your email has been successfully confirmed.</p>
                <p>You'll receive updates for <b>{signup_data.get('campaign_slug')}</b> soon.</p>
            </div>
        </body>
    </html>
    """
    return HTMLResponse(content=html_content)
