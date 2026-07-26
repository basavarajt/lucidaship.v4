"""
Firebase JWT authentication — verifies tokens issued by Firebase Auth.
"""

import uuid
import secrets
import logging
from typing import Any, Dict, List, Optional

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.database import get_db
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Initialize Firebase Admin
if not firebase_admin._apps:
    try:
        if settings.FIREBASE_PRIVATE_KEY and settings.FIREBASE_PROJECT_ID and settings.FIREBASE_CLIENT_EMAIL:
            # Clean up the private key which might have escaped newlines from env vars
            private_key = settings.FIREBASE_PRIVATE_KEY.replace('\\n', '\n')
            
            cred = credentials.Certificate({
                "type": "service_account",
                "project_id": settings.FIREBASE_PROJECT_ID,
                "private_key_id": "lucida",
                "private_key": private_key,
                "client_email": settings.FIREBASE_CLIENT_EMAIL,
                "client_id": "lucida",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{settings.FIREBASE_CLIENT_EMAIL.replace('@', '%40')}",
                "universe_domain": "googleapis.com"
            })
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin initialized using provided credentials.")
        else:
            firebase_admin.initialize_app()
            logger.info("Firebase Admin initialized using default credentials.")
    except Exception as e:
        logger.warning(f"Failed to initialize Firebase Admin: {e}. If local dev, this is expected without credentials.")

# ── Bearer scheme for FastAPI dependency injection ───────────────
bearer_scheme = HTTPBearer()
_optional_bearer = HTTPBearer(auto_error=False)


def verify_firebase_token(token: str) -> Dict[str, Any]:
    """
    Verify a Firebase-issued JWT.
    Raises HTTPException 401 on any failure.
    """
    try:
        payload = firebase_auth.verify_id_token(token)
        return payload
    except Exception as e:
        logger.warning("Firebase JWT verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _auto_provision_user(firebase_uid: str, email: str, conn) -> Dict[str, Any]:
    """
    Auto-provision a new tenant + user when a Firebase user hits our API
    for the first time. Returns user dict.
    """
    tenant_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    # Create tenant (personal org for the user)
    conn.execute(
        "INSERT INTO tenants (id, clerk_org_id, name, plan) VALUES (?, ?, ?, ?)",
        [tenant_id, None, f"{email.split('@')[0]}'s Organization", "free"],
    )

    # Create user (store Firebase UID in the legacy `clerk_user_id` column for compatibility)
    conn.execute(
        "INSERT INTO users (id, clerk_user_id, tenant_id, email, role) VALUES (?, ?, ?, ?, ?)",
        [user_id, firebase_uid, tenant_id, email, "admin"],
    )

    logger.info("Auto-provisioned user: firebase_uid=%s email=%s tenant=%s", firebase_uid, email, tenant_id)

    return {
        "id": user_id,
        "clerk_user_id": firebase_uid, # Reusing column name for backwards compatibility
        "tenant_id": tenant_id,
        "email": email,
        "role": "admin",
    }


def _local_dev_user() -> Dict[str, Any]:
    """
    Return (or create) a local development user for running without Firebase credentials.
    Uses a fixed tenant/user ID so the experience is consistent across restarts.
    """
    LOCAL_TENANT_ID = "local-dev-tenant"
    LOCAL_USER_ID = "local-dev-user"
    LOCAL_EMAIL = "dev@localhost"

    conn = get_db()

    try:
        # Ensure tenant exists
        result = conn.execute("SELECT id FROM tenants WHERE id = ?", [LOCAL_TENANT_ID])
        if not result.rows:
            conn.execute(
                "INSERT INTO tenants (id, clerk_org_id, name, plan) VALUES (?, ?, ?, ?)",
                [LOCAL_TENANT_ID, None, "Local Development", "free"],
            )

        # Ensure user exists
        result = conn.execute("SELECT id FROM users WHERE id = ?", [LOCAL_USER_ID])
        if not result.rows:
            conn.execute(
                "INSERT INTO users (id, clerk_user_id, tenant_id, email, role) VALUES (?, ?, ?, ?, ?)",
                [LOCAL_USER_ID, "local_firebase_uid", LOCAL_TENANT_ID, LOCAL_EMAIL, "admin"],
            )
    except Exception as exc:
        logger.warning("Local dev auth bootstrap could not persist user records: %s", exc)

    return {
        "id": LOCAL_USER_ID,
        "clerk_user_id": "local_firebase_uid",
        "tenant_id": LOCAL_TENANT_ID,
        "email": LOCAL_EMAIL,
        "role": "admin",
    }


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
) -> Dict[str, Any]:
    """
    FastAPI dependency — verifies Firebase JWT and returns user dict.
    In LOCAL DEV mode, bypasses auth entirely if credentials aren't provided.
    """
    # ── LOCAL DEV BYPASS ─────────────────────────────────────
    if not settings.is_production and not credentials:
        logger.debug("No token provided in dev — using local dev user")
        return _local_dev_user()

    # ── PRODUCTION: Firebase JWT verification ───────────────────
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = verify_firebase_token(token)

    firebase_uid = payload.get("uid")
    if not firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'uid' claim",
        )

    email = payload.get("email") or f"{firebase_uid}@firebase.user"

    # Look up user in our database (using `clerk_user_id` column to store Firebase UID for compatibility)
    conn = get_db()
    result = conn.execute(
        "SELECT id, clerk_user_id, tenant_id, email, role, deleted_at FROM users WHERE clerk_user_id = ?",
        [firebase_uid],
    )

    if result.rows:
        row = result.rows[0]
        
        # Check if account is marked for deletion
        if len(row) > 5 and row[5] is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is pending deletion and cannot be accessed.",
            )
            
        user = {
            "id": row[0],
            "clerk_user_id": row[1],
            "tenant_id": row[2],
            "email": row[3],
            "role": row[4],
        }
        logger.debug("Authenticated: user=%s tenant=%s", user["id"][:8], user["tenant_id"][:8])
        return user

    # User not in our DB — auto-provision
    user = _auto_provision_user(firebase_uid, email, conn)
    return user


def require_role(allowed_roles: List[str]):
    def role_checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {allowed_roles}. You have: {user['role']}",
            )
        return user
    return role_checker

def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
    x_guest_session_id: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Dependency that allows unauthenticated 'guest' sessions.
    If a valid token is provided, returns the authenticated user.
    If no token is provided but X-Guest-Session-ID is present, returns a guest user.
    Otherwise, raises 401.
    """
    if credentials:
        try:
            return get_current_user(credentials)
        except HTTPException:
            # If the token is invalid or expired, we can gracefully fall back to a guest session
            if settings.ALLOW_GUEST_ACCESS and not settings.is_production and x_guest_session_id:
                logger.warning("Invalid token provided, falling back to guest session")
                return {
                    "id": f"guest_user_{x_guest_session_id}",
                    "tenant_id": f"guest_{x_guest_session_id}",
                    "role": "guest"
                }
            # If no guest session provided, raise the 401
            raise
    # Try local dev bypass if no credentials
    if not settings.is_production and not credentials:
        if settings.ALLOW_GUEST_ACCESS and x_guest_session_id:
            return {
                "id": f"guest_user_{x_guest_session_id}",
                "tenant_id": f"guest_{x_guest_session_id}",
                "role": "guest"
            }
        logger.debug("No token provided in dev — using local dev user")
        return _local_dev_user()

    # In production without credentials
    if not credentials:
        if settings.ALLOW_GUEST_ACCESS and not settings.is_production and x_guest_session_id:
            return {
                "id": f"guest_user_{x_guest_session_id}",
                "tenant_id": f"guest_{x_guest_session_id}",
                "role": "guest"
            }
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token and no guest session provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # If we get here, it means credentials existed but we didn't raise or return?
    # Actually, the logic above either returns or raises. But just in case:
    if credentials:
        return get_current_user(credentials)
    raise HTTPException(status_code=401, detail="Unauthorized")

def verify_admin_secret(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> bool:
    """
    Verify the FASTAPI_SECRET_KEY for admin routes.
    """
    expected_secret = settings.FASTAPI_SECRET_KEY.strip()
    if not expected_secret or not secrets.compare_digest(
        credentials.credentials, expected_secret
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid admin token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return True

def verify_admin_email(user: dict = Depends(get_current_user)) -> dict:
    """
    Verify that the authenticated Firebase user has the configured ADMIN_EMAIL.
    """
    if not settings.ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ADMIN_EMAIL is not configured on the server",
        )
    
    if user.get("email") != settings.ADMIN_EMAIL:
        logger.warning(f"Unauthorized admin access attempt by {user.get('email')}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have admin permissions.",
        )
    return user
