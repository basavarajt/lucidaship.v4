"""
Auth API routes.
Firebase handles login/register; this module exposes /auth/me for the app.
"""

import logging
from fastapi import APIRouter, Depends

from app.database import get_db
from app.core.auth import get_current_user
from app.core.responses import success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    """
    Return the currently authenticated user's profile.
    Firebase handles login/register; this just returns our DB record.
    """
    conn = get_db()

    tenant_name = None
    result = conn.execute(
        "SELECT name, plan FROM tenants WHERE id = ?",
        [user["tenant_id"]],
    )
    if result.rows:
        row = result.rows[0]
        tenant_name = row[0]
        plan = row[1]
    else:
        plan = "free"

    return success_response(
        data={
            "id": user["id"],
            "clerk_user_id": user["clerk_user_id"],
            "firebase_uid": user["clerk_user_id"],
            "email": user["email"],
            "role": user["role"],
            "tenant_id": user["tenant_id"],
            "company_name": tenant_name,
            "plan": plan,
        }
    )

@router.delete("/account")
def delete_account(user: dict = Depends(get_current_user)):
    """
    Mark the user's account and tenant for deletion in 30 days.
    This complies with the Privacy Policy data retention period.
    """
    conn = get_db()
    
    # Mark user as deleted
    conn.execute(
        "UPDATE users SET deleted_at = datetime('now') WHERE id = ?",
        [user["id"]],
    )
    
    # Mark their personal tenant as deleted
    conn.execute(
        "UPDATE tenants SET deleted_at = datetime('now') WHERE id = ?",
        [user["tenant_id"]],
    )
    
    logger.info("User %s (tenant %s) requested account deletion. Scheduled for hard deletion in 30 days.", user["id"], user["tenant_id"])
    return success_response(
        message="Account marked for deletion. It will be permanently removed in 30 days. You will be logged out.",
        data={"status": "pending_deletion"}
    )

