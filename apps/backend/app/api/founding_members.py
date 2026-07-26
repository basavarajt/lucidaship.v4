import logging
from datetime import datetime, timezone
from typing import Optional, List
import csv
import io

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from google.cloud import firestore
import firebase_admin
import resend

from app.core.config import get_settings
from app.core.auth import verify_admin_email

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(tags=["Founding Members"])

# Initialize resend API key
resend.api_key = settings.RESEND_API_KEY

def get_firestore_client():
    if not firebase_admin._apps:
        raise RuntimeError("Firebase Admin not initialized")
    return firestore.Client(project=settings.FIREBASE_PROJECT_ID)

# --- Pydantic Models ---

class SignupRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    company: str
    role: str
    phone: Optional[str] = None
    website: Optional[str] = None
    message: Optional[str] = None

class CampaignCreateRequest(BaseModel):
    name: str
    subject: str
    html_template: str
    plain_text: str
    scheduled_send_at: Optional[str] = None
    notes: Optional[str] = None

class CampaignSendRequest(BaseModel):
    send_now: bool = True
    schedule_at: Optional[str] = None

# --- Endpoints ---

@router.post("/api/signup", status_code=status.HTTP_201_CREATED)
async def signup(request: SignupRequest):
    try:
        db = get_firestore_client()
    except Exception as e:
        logger.error(f"Firestore not available: {e}")
        raise HTTPException(status_code=500, detail="Database unavailable")

    # Check if email already exists
    members_ref = db.collection("founding_members")
    existing_query = members_ref.where("email", "==", request.email).limit(1).stream()
    if list(existing_query):
        raise HTTPException(status_code=409, detail="Email already signed up")

    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Store in Firestore
    doc_ref = members_ref.document()
    member_data = {
        "id": doc_ref.id,
        "email": request.email,
        "first_name": request.first_name,
        "last_name": request.last_name,
        "company": request.company,
        "role": request.role,
        "phone": request.phone,
        "website": request.website,
        "notes": request.message,
        "created_at": now_iso,
        "source": "website",
        "welcome_email_status": "pending",
        "status": "active",
        "campaigns_received": []
    }
    
    # Attempt to send email
    email_sent = False
    resend_id = None
    try:
        founder_name = "Basavaraj" # Default founder name
        html_content = f"""
        <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px;">
              <h1 style="color: #0f0f13; font-size: 28px; margin: 0 0 20px;">Welcome to Lucida Analytics</h1>
              
              <p style="color: #5a5a5a; font-size: 16px; line-height: 1.6;">
                Hi {request.first_name},
              </p>
              
              <p style="color: #5a5a5a; font-size: 16px; line-height: 1.6;">
                You're now a <strong>Founding Member</strong> of Lucida Analytics — the universal lead scoring model that works on <strong>any company's data format</strong>.
              </p>
              
              <p style="color: #5a5a5a; font-size: 16px; line-height: 1.6;">
                As a founding member, you get:
              </p>
              
              <ul style="color: #5a5a5a; font-size: 16px; line-height: 1.8;">
                <li>Early access to the full platform</li>
                <li>Lifetime discount (33% off for 2 years)</li>
                <li>Direct access to the founder — direct input on roadmap</li>
                <li>Custom onboarding on your CRM format</li>
              </ul>
              
              <p style="text-align: center; margin: 30px 0;">
                <a href="https://lucidaanalytics.tech/dashboard" style="background: #7c6ff7; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
                  Access Your Dashboard
                </a>
              </p>
              
              <p style="color: #5a5a5a; font-size: 14px; line-height: 1.6; border-top: 1px solid #eee; padding-top: 20px;">
                Questions? Reply to this email — I read every message.
              </p>
              
              <p style="color: #5a5a5a; font-size: 14px;">
                — {founder_name}<br/>
                Founder, Lucida Analytics
              </p>
            </div>
          </body>
        </html>
        """
        
        response = resend.Emails.send({
            "from": "Lucida Analytics <hello@lucidaanalytics.tech>", 
            "to": [request.email],
            "subject": "Welcome to Lucida Analytics — Early Access Inside",
            "html": html_content
        })
        resend_id = response.get("id")
        email_sent = True
        
        member_data["welcome_email_sent_at"] = now_iso
        member_data["welcome_email_resend_id"] = resend_id
        member_data["welcome_email_status"] = "sent"
    except Exception as e:
        logger.error(f"Failed to send welcome email to {request.email}: {e}")
        member_data["welcome_email_status"] = "failed"
    
    # Save member
    doc_ref.set(member_data)
    
    # Save email log
    log_ref = db.collection("email_logs").document()
    log_ref.set({
        "id": log_ref.id,
        "email": request.email,
        "member_id": doc_ref.id,
        "campaign_id": None,
        "template": "welcome",
        "resend_message_id": resend_id,
        "subject": "Welcome to Lucida Analytics — Early Access Inside",
        "sent_at": now_iso,
        "status": "sent" if email_sent else "failed"
    })
    
    return {
        "success": True,
        "member_id": doc_ref.id,
        "message": "Signup received. Welcome email sent." if email_sent else "Signup received, but welcome email failed.",
        "email_sent": email_sent
    }


@router.get("/api/admin/founding-members", dependencies=[Depends(verify_admin_email)])
async def get_members(
    limit: int = 50, 
    offset: int = 0, 
    sort_by: str = "created_at", 
    sort_order: str = "desc",
    status: Optional[str] = None
):
    db = get_firestore_client()
    query = db.collection("founding_members")
    
    if status:
        query = query.where("status", "==", status)
        
    direction = firestore.Query.DESCENDING if sort_order.lower() == "desc" else firestore.Query.ASCENDING
    query = query.order_by(sort_by, direction=direction)
    
    docs = query.offset(offset).limit(limit).stream()
    members = [doc.to_dict() for doc in docs]
    
    count_query = db.collection("founding_members")
    if status:
        count_query = count_query.where("status", "==", status)
    
    try:
        # aggregation query
        aggregation_result = count_query.count().get()
        total = aggregation_result[0][0].value
    except Exception as e:
        logger.error(f"Error fetching count: {e}")
        total = 0
    
    return {
        "total": total,
        "returned": len(members),
        "offset": offset,
        "members": members
    }

@router.get("/api/admin/export-csv", dependencies=[Depends(verify_admin_email)])
async def export_csv(status: Optional[str] = None):
    db = get_firestore_client()
    query = db.collection("founding_members")
    if status:
        query = query.where("status", "==", status)
        
    docs = query.stream()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Email", "First Name", "Last Name", "Company", "Role", "Phone", "Website", "Signed Up", "Welcome Email Status", "Campaigns Received", "Last Campaign Opened", "Status"])
    
    for doc in docs:
        d = doc.to_dict()
        campaigns = d.get("campaigns_received", [])
        last_opened = "Never"
        for c in campaigns:
            if c.get("opened") and c.get("opened_at"):
                last_opened = c.get("opened_at")
                
        writer.writerow([
            d.get("email"), d.get("first_name"), d.get("last_name"), d.get("company"), d.get("role"),
            d.get("phone", ""), d.get("website", ""), d.get("created_at"), d.get("welcome_email_status"),
            len(campaigns), last_opened, d.get("status")
        ])
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=founding_members.csv"}
    )

@router.post("/api/admin/campaign/create", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_admin_email)])
async def create_campaign(request: CampaignCreateRequest):
    db = get_firestore_client()
    doc_ref = db.collection("campaigns").document()
    
    campaign_data = {
        "id": doc_ref.id,
        "name": request.name,
        "subject": request.subject,
        "html_template": request.html_template,
        "plain_text": request.plain_text,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "scheduled_send_at": request.scheduled_send_at,
        "status": "draft",
        "recipients_count": 0,
        "sent_count": 0,
        "opened_count": 0,
        "clicked_count": 0,
        "bounced_count": 0,
        "notes": request.notes
    }
    
    doc_ref.set(campaign_data)
    
    return {
        "campaign_id": doc_ref.id,
        "status": "draft",
        "message": "Campaign created. Ready to preview or send."
    }

@router.post("/api/admin/campaign/{campaign_id}/send", dependencies=[Depends(verify_admin_email)])
async def send_campaign(campaign_id: str, request: CampaignSendRequest):
    db = get_firestore_client()
    campaign_ref = db.collection("campaigns").document(campaign_id)
    campaign = campaign_ref.get().to_dict()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    members = db.collection("founding_members").where("status", "==", "active").stream()
    
    sent_success = 0
    failed = 0
    now_iso = datetime.now(timezone.utc).isoformat()
    
    for doc in members:
        member = doc.to_dict()
        try:
            # Personalize html (simple replace)
            html = campaign.get("html_template").replace("{{ first_name }}", member.get("first_name", ""))
            
            response = resend.Emails.send({
                "from": "Lucida Analytics <hello@lucidaanalytics.tech>", 
                "to": [member["email"]],
                "subject": campaign["subject"],
                "html": html
            })
            
            resend_id = response.get("id")
            
            # Log it
            log_ref = db.collection("email_logs").document()
            log_ref.set({
                "id": log_ref.id,
                "email": member["email"],
                "member_id": member["id"],
                "campaign_id": campaign_id,
                "template": "campaign",
                "resend_message_id": resend_id,
                "subject": campaign["subject"],
                "sent_at": now_iso,
                "status": "sent"
            })
            
            # Update member
            campaigns_received = member.get("campaigns_received", [])
            campaigns_received.append({
                "campaign_id": campaign_id,
                "campaign_name": campaign.get("name"),
                "sent_at": now_iso,
                "resend_id": resend_id,
                "opened": False,
                "clicked": False
            })
            db.collection("founding_members").document(member["id"]).update({"campaigns_received": campaigns_received})
            
            sent_success += 1
            
        except Exception as e:
            logger.error(f"Failed to send campaign {campaign_id} to {member['email']}: {e}")
            failed += 1
            
    campaign_ref.update({
        "status": "sent",
        "recipients_count": sent_success + failed,
        "sent_count": sent_success,
        "bounced_count": failed 
    })
    
    return {
        "campaign_id": campaign_id,
        "status": "sent",
        "recipients_count": sent_success + failed,
        "sent_successfully": sent_success,
        "failed": failed,
        "message": f"Campaign sent to {sent_success} members ({failed} failed)"
    }


@router.post("/api/admin/member/{member_id}/unsubscribe", dependencies=[Depends(verify_admin_email)])
async def unsubscribe_member(member_id: str):
    db = get_firestore_client()
    member_ref = db.collection("founding_members").document(member_id)
    
    if not member_ref.get().exists:
        raise HTTPException(status_code=404, detail="Member not found")
        
    member_ref.update({"status": "unsubscribed"})
    
    return {
        "member_id": member_id,
        "status": "unsubscribed",
        "message": "Member unsubscribed from all campaigns"
    }

@router.get("/api/admin/campaign/{campaign_id}/stats", dependencies=[Depends(verify_admin_email)])
async def campaign_stats(campaign_id: str):
    db = get_firestore_client()
    campaign = db.collection("campaigns").document(campaign_id).get().to_dict()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    sent = campaign.get("sent_count", 0)
    opened = campaign.get("opened_count", 0)
    clicked = campaign.get("clicked_count", 0)
    
    return {
        "campaign_id": campaign_id,
        "name": campaign.get("name"),
        "sent_count": sent,
        "opened_count": opened,
        "opened_rate": f"{(opened/sent*100):.1f}%" if sent > 0 else "0%",
        "clicked_count": clicked,
        "click_rate": f"{(clicked/sent*100):.1f}%" if sent > 0 else "0%",
        "bounced_count": campaign.get("bounced_count", 0),
        "complained_count": 0
    }
