"""
InfraNetra Authoritative Authentication, Session Security & Authorization Engine.
Provides cryptographic password hashing (PBKDF2-HMAC-SHA256), signed session tokens (HMAC-SHA256),
role enforcement, and security audit logging.
"""

import os
import json
import base64
import hmac
import hashlib
import secrets
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

_db_env = os.environ.get("SQLITE_DB_PATH", "infrastructure_projects.sqlite3").strip()
SQLITE_DB_PATH = Path(_db_env) if Path(_db_env).is_absolute() else (BASE_DIR / _db_env)

# Server Secret Key for cryptographic session signing
_raw_secret = (os.environ.get("AUTH_SECRET_KEY") or os.environ.get("SESSION_SECRET") or "").strip()
_is_prod = any(
    os.environ.get(k, "").strip().lower() == "production"
    for k in ("ENV", "ENVIRONMENT", "NODE_ENV")
)

_insecure_fallbacks = {
    "",
    "infranetra-national-infrastructure-monitoring-secret-key-2026",
    "secret",
    "changeme",
    "default",
}

if _is_prod:
    if not _raw_secret or _raw_secret.lower() in _insecure_fallbacks or len(_raw_secret) < 32:
        raise RuntimeError(
            "FATAL SECURITY CONFIGURATION ERROR: In production mode (ENV/NODE_ENV=production), "
            "AUTH_SECRET_KEY must be provided as a high-entropy secret via the production environment "
            "(minimum 32 characters). Local or default fallback secrets are strictly prohibited in production."
        )
    AUTH_SECRET_KEY = _raw_secret.encode("utf-8")
else:
    # Non-production (development / local test runner) fallback
    if not _raw_secret:
        _raw_secret = "infranetra-national-infrastructure-monitoring-secret-key-2026"
    AUTH_SECRET_KEY = _raw_secret.encode("utf-8")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ==============================================================================
# 1. PASSWORD SECURITY (PBKDF2-HMAC-SHA256)
# ==============================================================================

def hash_password(password: str) -> Tuple[str, str]:
    """
    Hash password using PBKDF2-HMAC-SHA256 with a 32-byte cryptographic random salt
    and 100,000 iterations.
    Never stores plaintext passwords.
    """
    if not password or len(password) < 6:
        raise ValueError("Password must be at least 6 characters long.")
    salt = secrets.token_hex(32)
    pwd_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    ).hex()
    return pwd_hash, salt


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """
    Verify candidate password against stored hash using constant-time comparison
    to prevent timing attacks.
    """
    if not password or not stored_hash or not salt:
        return False
    calc_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    ).hex()
    return hmac.compare_digest(calc_hash, stored_hash)


# ==============================================================================
# 2. SESSION SECURITY (Signed HMAC-SHA256 Cryptographic Tokens)
# ==============================================================================

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def b64url_decode(s: str) -> bytes:
    padding = 4 - (len(s) % 4)
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s.encode("utf-8"))


def create_session_token(user_id: int, username: str, role: str, expires_hours: int = 24) -> str:
    """Generate a tamper-proof cryptographically signed token."""
    now = datetime.now(timezone.utc)
    exp = now + timedelta(hours=expires_hours)
    payload = {
        "uid": user_id,
        "sub": username,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = b64url_encode(payload_bytes)

    sig = hmac.new(AUTH_SECRET_KEY, payload_b64.encode("utf-8"), hashlib.sha256).digest()
    sig_b64 = b64url_encode(sig)
    return f"{payload_b64}.{sig_b64}"


def verify_session_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify cryptographic signature and expiration of session token."""
    if not token or "." not in token:
        return None
    try:
        payload_b64, sig_b64 = token.split(".", 1)
        expected_sig = hmac.new(AUTH_SECRET_KEY, payload_b64.encode("utf-8"), hashlib.sha256).digest()
        actual_sig = b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload_bytes = b64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))

        now_ts = int(datetime.now(timezone.utc).timestamp())
        if payload.get("exp", 0) < now_ts:
            return None
        return payload
    except Exception:
        return None


# ==============================================================================
# 3. IDENTITY & ROLE RESOLUTION FROM DATABASE
# ==============================================================================

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve user with full server-verified relationship assignments."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.username, u.full_name, u.email, u.phone, u.designation, u.department,
               u.role, u.status, u.created_at, u.clerk_user_id,
               uma.ministry AS assigned_ministry,
               uma.status AS ministry_status,
               pma.project_id AS assigned_project_id,
               pma.status AS pm_status
        FROM users u
        LEFT JOIN user_ministry_assignments uma ON u.id = uma.user_id
        LEFT JOIN project_manager_assignments pma ON u.id = pma.user_id
        WHERE u.id = ?;
    """, (user_id,))
    row = cur.fetchone()
    conn.close()
    if row:
        return dict(row)

    # Fallback to Supabase
    try:
        from auth_supabase import is_supabase_auth_ready, supa_get_user_by_id
        if is_supabase_auth_ready():
            supa_user = supa_get_user_by_id(user_id)
            if supa_user:
                return supa_user
    except Exception as e:
        print(f"[get_user_by_id Supabase Warning] {e}")

    return None


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Look up user by case-insensitive username."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.username, u.password_hash, u.salt, u.full_name, u.email,
               u.phone, u.designation, u.department, u.role, u.status, u.created_at, u.clerk_user_id,
               uma.ministry AS assigned_ministry,
               uma.status AS ministry_status,
               pma.project_id AS assigned_project_id,
               pma.status AS pm_status
        FROM users u
        LEFT JOIN user_ministry_assignments uma ON u.id = uma.user_id
        LEFT JOIN project_manager_assignments pma ON u.id = pma.user_id
        WHERE u.username = ? COLLATE NOCASE;
    """, (username,))
    row = cur.fetchone()
    conn.close()
    if row:
        return dict(row)

    # Supabase Fallback
    try:
        from auth_supabase import is_supabase_auth_ready, supa_get_user_by_username
        if is_supabase_auth_ready():
            supa_u = supa_get_user_by_username(username)
            if supa_u:
                return supa_u
    except Exception as e:
        print(f"[get_user_by_username Supabase Warning] {e}")

    return None


# ==============================================================================
# CLERK AUTHENTICATION PROVIDER INTEGRATION
# ==============================================================================

CLERK_SECRET_KEY = (os.environ.get("CLERK_SECRET_KEY") or "").strip()
CLERK_API_BASE = "https://api.clerk.com/v1"
CLERK_JWKS_URL = (os.environ.get("CLERK_JWKS_URL") or "https://promoted-werewolf-5011.clerk.accounts.dev/.well-known/jwks.json").strip()

_jwks_client = None


def get_jwks_client():
    global _jwks_client
    if _jwks_client is None:
        try:
            import jwt
            from jwt import PyJWKClient
            _jwks_client = PyJWKClient(CLERK_JWKS_URL, cache_keys=True, lifespan=86400)
        except Exception as e:
            print(f"[Clerk JWKS Warning] Could not initialize PyJWKClient: {e}")
    return _jwks_client


def verify_clerk_jwt(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify RS256 signature of Clerk JWT token against authoritative JWKS public keys.
    """
    if not token or token.count(".") != 2:
        return None
    try:
        import jwt
        client = get_jwks_client()
        if not client:
            return None
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False}
        )
        return payload
    except Exception:
        return None


def fetch_clerk_user(clerk_user_id: str) -> Optional[Dict[str, Any]]:
    """
    Authoritatively verify and retrieve a user profile directly from the Clerk Backend REST API.
    Confirms user identity and verified email status. Never exposes secret key.
    """
    if not CLERK_SECRET_KEY or not clerk_user_id:
        return None
    try:
        import urllib.request
        clean_id = str(clerk_user_id).strip()
        req = urllib.request.Request(
            f"{CLERK_API_BASE}/users/{clean_id}",
            headers={
                "Authorization": f"Bearer {CLERK_SECRET_KEY}",
                "User-Agent": "InfraNetra/2.0",
                "Content-Type": "application/json",
            }
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[Clerk Auth] Verification check exception: {type(e).__name__}")
    return None


def get_user_by_clerk_id(clerk_user_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve application user by linked Clerk User ID."""
    if not clerk_user_id:
        return None
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.username, u.full_name, u.email, u.phone, u.designation, u.department,
               u.role, u.status, u.created_at, u.clerk_user_id,
               uma.ministry AS assigned_ministry,
               uma.status AS ministry_status,
               pma.project_id AS assigned_project_id,
               pma.status AS pm_status
        FROM users u
        LEFT JOIN user_ministry_assignments uma ON u.id = uma.user_id
        LEFT JOIN project_manager_assignments pma ON u.id = pma.user_id
        WHERE u.clerk_user_id = ?;
    """, (clerk_user_id.strip(),))
    row = cur.fetchone()
    conn.close()
    if row:
        return dict(row)

    # Supabase Fallback
    try:
        from auth_supabase import is_supabase_auth_ready, supa_get_user_by_clerk_id
        if is_supabase_auth_ready():
            supa_u = supa_get_user_by_clerk_id(clerk_user_id)
            if supa_u:
                return supa_u
    except Exception as e:
        print(f"[get_user_by_clerk_id Supabase Warning] {e}")

    return None


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Retrieve application user by case-insensitive email address."""
    if not email:
        return None
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.username, u.full_name, u.email, u.phone, u.designation, u.department,
               u.role, u.status, u.created_at, u.clerk_user_id,
               uma.ministry AS assigned_ministry,
               uma.status AS ministry_status,
               pma.project_id AS assigned_project_id,
               pma.status AS pm_status
        FROM users u
        LEFT JOIN user_ministry_assignments uma ON u.id = uma.user_id
        LEFT JOIN project_manager_assignments pma ON u.id = pma.user_id
        WHERE u.email = ? COLLATE NOCASE;
    """, (email.strip(),))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def link_clerk_user(user_id: int, clerk_user_id: str) -> None:
    """Safely associate a verified Clerk user ID with an existing database user."""
    conn = get_db_connection()
    with conn:
        conn.execute(
            "UPDATE users SET clerk_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;",
            (clerk_user_id.strip(), user_id)
        )
    conn.close()

    # Sync to Supabase as well
    try:
        from auth_supabase import is_supabase_auth_ready, _supa_request
        if is_supabase_auth_ready():
            _supa_request("PATCH", f"/rest/v1/users?id=eq.{user_id}", {"clerk_user_id": clerk_user_id.strip()})
    except Exception as e:
        print(f"[link_clerk_user Supabase Warning] {e}")


def authenticate_user_from_token(token: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Validate token, verify user exists and account status is APPROVED.
    Supports dual-token architecture:
    1. InfraNetra Signed HMAC-SHA256 tokens (1 dot: payload.sig)
    2. Clerk RS256 JWT tokens (2 dots: header.payload.sig)
    Returns (user_dict, error_message).
    """
    if not token:
        return None, "Missing authentication session token"

    dot_count = token.count(".")
    user = None

    if dot_count == 1:
        # Standard InfraNetra cryptographic HMAC-SHA256 session token
        payload = verify_session_token(token)
        if not payload:
            return None, "Invalid or expired session token"
        user = get_user_by_id(payload["uid"])

    elif dot_count == 2:
        # Clerk RS256 JWT token
        payload = verify_clerk_jwt(token)
        if not payload or "sub" not in payload:
            return None, "Invalid or expired Clerk session token"

        clerk_id = payload["sub"]
        user = get_user_by_clerk_id(clerk_id)
        if not user:
            # Check Clerk user email to see if an existing pre-seeded/registered user matches
            clerk_profile = fetch_clerk_user(clerk_id)
            if clerk_profile:
                emails = clerk_profile.get("email_addresses", [])
                for em in emails:
                    if em.get("verification", {}).get("status") == "verified":
                        candidate_email = em.get("email_address")
                        candidate_user = get_user_by_email(candidate_email)
                        if candidate_user and candidate_user.get("role") == "ADMIN":
                            # Administrator accounts CANNOT be linked or authenticated via Clerk
                            continue
                        if candidate_user:
                            user = candidate_user
                            link_clerk_user(user["id"], clerk_id)
                            user["clerk_user_id"] = clerk_id
                            break
    else:
        return None, "Malformed authentication session token"

    if not user:
        return None, "User account not found"

    # Enforce: Admin accounts can NEVER authenticate via Clerk RS256 token
    if dot_count == 2 and user.get("role") == "ADMIN":
        return None, "Clerk authentication is not permitted for the Administrator account."

    # Strict server-side status check:
    status = user.get("status", "PENDING")
    if status == "PENDING":
        return None, "Your registration is awaiting administrator/ministry approval."
    elif status == "REJECTED":
        return None, "Your registration request has been rejected."
    elif status == "SUSPENDED":
        return None, "Your account has been suspended by the administrator."
    elif status != "APPROVED":
        return None, "Account is not active."

    return user, None


# ==============================================================================
# 4. AUDIT LOGGING
# ==============================================================================

def record_audit_log(
    actor_id: Optional[int],
    actor_username: Optional[str],
    actor_role: Optional[str],
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    details: Optional[str] = None,
    result: str = "SUCCESS",
    ip_address: Optional[str] = None,
):
    """Persist an authoritative security audit record to SQLite."""
    try:
        conn = get_db_connection()
        with conn:
            conn.execute("""
                INSERT INTO audit_logs (
                    actor_id, actor_username, actor_role, action,
                    target_type, target_id, details, ip_address, result
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                actor_id,
                actor_username or "SYSTEM",
                actor_role or "SYSTEM",
                action,
                target_type,
                target_id,
                details,
                ip_address,
                result,
            ))
        conn.close()
    except Exception as e:
        print(f"[Audit Log Warning] Failed to write audit log: {e}")
