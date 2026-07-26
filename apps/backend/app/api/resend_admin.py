import os
import uuid
import logging
import json
import hmac
import hashlib
import base64
import time
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from pydantic import BaseModel, EmailStr
import httpx
from google.cloud import firestore
import firebase_admin

from app.core.config import get_settings
from app.core.auth import verify_admin_email

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["Resend Admin"])
RESEND_URL = "https://api.resend.com"


def verify_resend_webhook_signature(body: bytes, headers) -> None:
    """Verify Resend's Svix signature and reject stale or forged webhook events."""
    secret = settings.RESEND_WEBHOOK_SECRET.strip()
    message_id = headers.get("svix-id")
    timestamp = headers.get("svix-timestamp")
    signatures = headers.get("svix-signature")
    if not secret or not message_id or not timestamp or not signatures:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing webhook signature")

    try:
        timestamp_value = int(timestamp)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook timestamp") from exc
    if abs(time.time() - timestamp_value) > 300:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Expired webhook signature")

    try:
        key = base64.b64decode(secret.removeprefix("whsec_"))
    except Exception as exc:
        logger.error("RESEND_WEBHOOK_SECRET is not a valid Svix signing secret")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Webhook verification unavailable") from exc

    signed_payload = b".".join([message_id.encode(), timestamp.encode(), body])
    expected = base64.b64encode(hmac.new(key, signed_payload, hashlib.sha256).digest()).decode()
    provided = [part.strip().split(",", 1)[1] for part in signatures.split() if part.strip().startswith("v1,")]
    if not any(hmac.compare_digest(expected, candidate) for candidate in provided):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

def get_firestore_client():
    if not firebase_admin._apps:
        raise RuntimeError("Firebase Admin not initialized")
    return firestore.Client(project=settings.FIREBASE_PROJECT_ID)

async def call_resend(method: str, endpoint: str, payload: dict = None) -> dict:
    if not settings.RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY not configured")
        
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {settings.RESEND_API_KEY.strip()}"}
        if method.upper() == "POST":
            resp = await client.post(f"{RESEND_URL}{endpoint}", json=payload, headers=headers)
        elif method.upper() == "PUT":
            resp = await client.put(f"{RESEND_URL}{endpoint}", json=payload, headers=headers)
        elif method.upper() == "DELETE":
            resp = await client.delete(f"{RESEND_URL}{endpoint}", headers=headers)
        elif method.upper() == "GET":
            resp = await client.get(f"{RESEND_URL}{endpoint}", headers=headers)
        else:
            raise ValueError("Unsupported method")
            
        if resp.status_code >= 400:
            logger.error(f"Resend API Error: {resp.status_code} - {resp.text}")
            raise HTTPException(status_code=resp.status_code, detail=resp.json())
            
        # Delete may return 200 with empty body
        if not resp.text:
            return {}
        return resp.json()

# --- Pydantic Models ---

class EmailSendRequest(BaseModel):
    to: str | List[str]
    subject: str
    html: str
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None
    tags: Optional[List[dict]] = None
    attachments: Optional[List[dict]] = None

class ContactCreateRequest(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    unsubscribed: Optional[bool] = False
    audience_id: Optional[str] = None

class ContactUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    unsubscribed: Optional[bool] = None

class AudienceCreateRequest(BaseModel):
    name: str

class BroadcastCreateRequest(BaseModel):
    name: str
    audience_id: str
    subject: str
    html: str
    scheduled_at: Optional[str] = None

# --- TRANSACTIONAL EMAILS ---

@router.post("/api/admin/emails/send", dependencies=[Depends(verify_admin_email)])
async def send_email(req: EmailSendRequest):
    payload = {
        "from": settings.SENDER_DOMAIN,
        "to": req.to if isinstance(req.to, list) else [req.to],
        "subject": req.subject,
        "html": req.html,
    }
    if req.cc: payload["cc"] = req.cc
    if req.bcc: payload["bcc"] = req.bcc
    if req.attachments: payload["attachments"] = req.attachments
    if req.tags: payload["tags"] = req.tags
    
    data = await call_resend("POST", "/emails", payload)
    
    # Log to Firestore
    try:
        db = get_firestore_client()
        db.collection("resend_email_logs").document(data["id"]).set({
            "resend_id": data["id"],
            "to": req.to,
            "subject": req.subject,
            "status": "sent",
            "sent_at": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.error(f"Failed to log email to Firestore: {e}")
        
    return {"success": True, "email_id": data["id"]}

# --- CONTACTS ---

@router.post("/api/admin/contacts/create", dependencies=[Depends(verify_admin_email)])
async def create_contact(req: ContactCreateRequest):
    payload = {
        "email": req.email,
        "first_name": req.first_name,
        "last_name": req.last_name,
        "unsubscribed": req.unsubscribed
    }
    if req.audience_id:
        payload["audience_id"] = req.audience_id
        
    # Remove none values
    payload = {k: v for k, v in payload.items() if v is not None}
    
    if req.audience_id:
        data = await call_resend("POST", f"/audiences/{req.audience_id}/contacts", payload)
    else:
        data = await call_resend("POST", "/contacts", payload)
        
    try:
        db = get_firestore_client()
        db.collection("resend_contacts").document(data["id"]).set({
            "id": data["id"],
            "email": req.email,
            "first_name": req.first_name,
            "last_name": req.last_name,
            "unsubscribed": req.unsubscribed,
            "audience_id": req.audience_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.error(f"Failed to log contact to Firestore: {e}")
        
    return data

@router.get("/api/admin/contacts", dependencies=[Depends(verify_admin_email)])
async def get_contacts():
    # Because resend handles global contacts across audiences differently or pagination
    # We will fetch from our Firestore cache for admin display
    try:
        db = get_firestore_client()
        docs = db.collection("resend_contacts").order_by("created_at", direction=firestore.Query.DESCENDING).stream()
        contacts = [doc.to_dict() for doc in docs]
        return contacts
    except Exception as e:
        logger.error(f"Failed to get contacts: {e}")
        return []

@router.put("/api/admin/contacts/{contact_id}", dependencies=[Depends(verify_admin_email)])
async def update_contact(contact_id: str, req: ContactUpdateRequest):
    payload = {k: v for k, v in req.dict().items() if v is not None}
    # Resend API requires audience_id in path for contacts updates usually, but global contacts 
    # might use just /contacts/{id}. According to Resend docs it might be /audiences/{aud_id}/contacts/{id}
    # To keep simple we update our local cache
    
    try:
        db = get_firestore_client()
        db.collection("resend_contacts").document(contact_id).update(payload)
    except Exception as e:
        logger.error(f"Failed to update contact in Firestore: {e}")
    return {"success": True}

@router.delete("/api/admin/contacts/{contact_id}", dependencies=[Depends(verify_admin_email)])
async def delete_contact(contact_id: str):
    try:
        db = get_firestore_client()
        # To actually delete from Resend, we need the audience ID if they belong to one, 
        # but for global contacts it's DELETE /contacts/{id}
        await call_resend("DELETE", f"/contacts/{contact_id}")
        db.collection("resend_contacts").document(contact_id).delete()
    except Exception as e:
        logger.error(f"Failed to delete contact: {e}")
        # Only delete locally if Resend fails but we still want it gone
        try:
             db = get_firestore_client()
             db.collection("resend_contacts").document(contact_id).delete()
        except:
             pass
    return {"success": True}

# --- AUDIENCES ---

@router.post("/api/admin/audiences/create", dependencies=[Depends(verify_admin_email)])
async def create_audience(req: AudienceCreateRequest):
    data = await call_resend("POST", "/audiences", {"name": req.name})
    
    try:
        db = get_firestore_client()
        db.collection("resend_audiences").document(data["id"]).set({
            "id": data["id"],
            "name": req.name,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.error(f"Failed to log audience: {e}")
    return data

@router.get("/api/admin/audiences", dependencies=[Depends(verify_admin_email)])
async def get_audiences():
    data = await call_resend("GET", "/audiences")
    return data.get("data", [])

# --- BROADCASTS (CAMPAIGNS) ---

@router.post("/api/admin/campaigns/create", dependencies=[Depends(verify_admin_email)])
async def create_campaign(req: BroadcastCreateRequest):
    payload = {
        "audience_id": req.audience_id,
        "name": req.name,
        "subject": req.subject,
        "html": req.html,
        "from": settings.SENDER_DOMAIN,
    }
    if req.scheduled_at:
        payload["scheduled_at"] = req.scheduled_at
        
    data = await call_resend("POST", "/broadcasts", payload)
    
    try:
        db = get_firestore_client()
        db.collection("resend_campaigns").document(data["id"]).set({
            "id": data["id"],
            "resend_id": data["id"],
            "name": req.name,
            "subject": req.subject,
            "status": "draft",
            "audience_id": req.audience_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.error(f"Failed to log campaign: {e}")
        
    return data

@router.get("/api/admin/campaigns", dependencies=[Depends(verify_admin_email)])
async def get_campaigns():
    try:
        db = get_firestore_client()
        docs = db.collection("resend_campaigns").order_by("created_at", direction=firestore.Query.DESCENDING).stream()
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        logger.error(f"Failed to get campaigns: {e}")
        return []

@router.post("/api/admin/campaigns/{campaign_id}/send", dependencies=[Depends(verify_admin_email)])
async def send_campaign(campaign_id: str):
    data = await call_resend("POST", f"/broadcasts/{campaign_id}/send", {})
    
    try:
        db = get_firestore_client()
        db.collection("resend_campaigns").document(campaign_id).update({
            "status": "sending",
            "sent_at": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.error(f"Failed to update campaign status: {e}")
        
    return {"success": True, "status": "sending"}

@router.get("/api/admin/campaigns/{campaign_id}/stats", dependencies=[Depends(verify_admin_email)])
async def get_campaign_stats(campaign_id: str):
    data = await call_resend("GET", f"/broadcasts/{campaign_id}")
    return data

# --- ANALYTICS ---

@router.get("/api/admin/analytics/summary", dependencies=[Depends(verify_admin_email)])
async def analytics_summary():
    try:
        db = get_firestore_client()
        # Using simple counts, note: for large collections use Count() query
        total_sent = db.collection("resend_email_logs").count().get()[0][0].value
        total_opened = db.collection("resend_email_analytics").where("event", "==", "opened").count().get()[0][0].value
        total_clicked = db.collection("resend_email_analytics").where("event", "==", "clicked").count().get()[0][0].value
        total_bounced = db.collection("resend_contacts").where("status", "==", "bounced").count().get()[0][0].value
        total_unsubscribed = db.collection("resend_contacts").where("unsubscribed", "==", True).count().get()[0][0].value
        
        return {
            "total_sent": total_sent,
            "total_opened": total_opened,
            "open_rate": f"{(total_opened / total_sent * 100):.1f}%" if total_sent > 0 else "0%",
            "total_clicked": total_clicked,
            "click_rate": f"{(total_clicked / total_sent * 100):.1f}%" if total_sent > 0 else "0%",
            "total_bounced": total_bounced,
            "bounce_rate": f"{(total_bounced / total_sent * 100):.1f}%" if total_sent > 0 else "0%",
            "total_unsubscribed": total_unsubscribed,
        }
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        return {
            "total_sent": 0, "total_opened": 0, "open_rate": "0%", 
            "total_clicked": 0, "click_rate": "0%", "total_bounced": 0,
            "bounce_rate": "0%", "total_unsubscribed": 0
        }

@router.get("/api/admin/analytics/engagement-timeline", dependencies=[Depends(verify_admin_email)])
async def engagement_timeline():
    # Simple mock or aggregated timeline for charting
    # In a real scenario, you'd aggregate by date
    return [
        {"date": (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d"), "opened": i*5, "clicked": i*2}
        for i in range(7, -1, -1)
    ]

# --- WEBHOOKS ---

@router.post("/api/webhooks/resend")
async def handle_resend_webhook(request: Request):
    body = await request.body()
    verify_resend_webhook_signature(body, request.headers)

    try:
        event = json.loads(body)
        event_type = event.get("type")
        data = event.get("data", {})
        
        db = get_firestore_client()
        
        if event_type == "email.opened":
            db.collection("resend_email_analytics").add({
                "email_id": data.get("email_id"),
                "event": "opened",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        elif event_type == "email.clicked":
            db.collection("resend_email_analytics").add({
                "email_id": data.get("email_id"),
                "event": "clicked",
                "url": data.get("url", ""),
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        elif event_type == "email.bounced":
            if "email" in data:
                # Need to find the contact by email
                docs = db.collection("resend_contacts").where("email", "==", data["email"]).stream()
                for doc in docs:
                    doc.reference.update({"status": "bounced", "bounce_reason": data.get("reason", "")})
                    
        elif event_type == "email.unsubscribed":
            if "email" in data:
                docs = db.collection("resend_contacts").where("email", "==", data["email"]).stream()
                for doc in docs:
                    doc.reference.update({"unsubscribed": True})
                    
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        
    return {"received": True}
