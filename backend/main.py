import os
import sys
import re
import shutil
import uuid
import json
import hmac
import time
import secrets
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

def project_already_assigned_response() -> JSONResponse:
    """Authoritative normalized HTTP 409 conflict response when a project is already occupied."""
    return JSONResponse(
        status_code=409,
        content={
            "detail": "Project Already Assigned",
            "message": "This project already has an assigned Project Manager. Please enter a different Project ID"
        }
    )

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

app = FastAPI(title="InfraNetra Authoritative Backend & Risk Intelligence Platform")

# Directory to store uploaded reports (supports persistent volume via UPLOAD_DIR env)
_upload_env = os.environ.get("UPLOAD_DIR", "").strip()
UPLOAD_DIR = Path(_upload_env) if _upload_env else (Path(__file__).resolve().parent / "uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Configure CORS for local development, the production Vercel frontend,
# and InfraNetra Vercel preview deployments.
# Additional comma-separated origins can be supplied through CORS_ALLOWED_ORIGINS.
_cors_env = os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()

_default_cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "https://infra-netra.vercel.app",
]

_env_cors_origins = [
    origin.strip().rstrip("/")
    for origin in _cors_env.split(",")
    if origin.strip()
]

_cors_origins = list(dict.fromkeys(_default_cors_origins + _env_cors_origins))
_vercel_origin_regex = r"^https://infra-netra(?:-[a-z0-9-]+)?\.vercel\.app$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_vercel_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
    max_age=86400,
)

# Defensive fallback for environments/proxies where the normal CORS middleware
# response headers are unexpectedly stripped. This only echoes origins that are
# explicitly trusted above or match InfraNetra's Vercel preview URL pattern.
@app.middleware("http")
async def ensure_cors_headers(request: Request, call_next):
    response = await call_next(request)
    origin = (request.headers.get("origin") or "").rstrip("/")
    if origin:
        is_allowed = origin in _cors_origins or re.fullmatch(_vercel_origin_regex, origin) is not None
        if is_allowed:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = request.headers.get(
                "access-control-request-headers", "Authorization, Content-Type, X-Auth-Token"
            )
            response.headers["Vary"] = "Origin"
    return response

from extractor import extract_paimana_pdf
from auth import (
    create_session_token,
    verify_password,
    hash_password,
    get_user_by_username,
    get_user_by_id,
    get_db_connection,
    authenticate_user_from_token,
    record_audit_log,
)
from db import (
    get_all_ministries,
    register_ministry_user,
    get_ministry_requests,
    approve_ministry_request,
    reject_ministry_request,
    suspend_ministry_user,
    register_project_manager_user,
    get_pm_requests,
    approve_pm_request,
    reject_pm_request,
    suspend_pm_user,
    submit_daily_project_update,
    get_daily_project_updates,
    get_audit_logs_list,
    get_project_ministry_and_name,
    lookup_project_details,
    get_authoritative_project,
    save_canonical_records,
    get_report_month_summary,
    check_supabase_health,
    is_supabase_configured,
    normalize_report_month_date,
    get_all_months_availability,
    get_available_months_list,
    update_completed_projects_actual_dates,
    rebuild_ml_training_dataset,
    get_ml_training_statistics,
    get_dashboard_summary,
    get_projects_registry,
    get_project_detail_by_id,
    get_map_markers,
    get_early_warnings_feed,
    get_sector_analytics,
    get_monthly_trends,
)
from ml_models import predict_project, get_training_statistics as get_verified_ml_stats


# ==============================================================================
# AUTHORIZATION DEPENDENCIES & HELPERS
# ==============================================================================

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def extract_token_from_request(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    token = request.headers.get("x-auth-token")
    if token:
        return token.strip()
    cookie_token = request.cookies.get("infranetra_auth_token")
    if cookie_token:
        return cookie_token.strip()
    return None


def get_current_user_optional(request: Request) -> Optional[Dict[str, Any]]:
    """Resolve authenticated user if token is present, else None for public citizen views."""
    token = extract_token_from_request(request)
    if not token:
        return None
    user, err = authenticate_user_from_token(token)
    if err:
        if "awaiting" in err.lower() or "pending" in err.lower() or "rejected" in err.lower() or "suspended" in err.lower():
            raise HTTPException(status_code=403, detail=err)
        return None
    return user


def require_authenticated_user(request: Request) -> Dict[str, Any]:
    """Require valid authenticated user with approved account status."""
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication session token required.")
    user, err = authenticate_user_from_token(token)
    if err:
        if "awaiting" in err.lower() or "rejected" in err.lower() or "suspended" in err.lower():
            raise HTTPException(status_code=403, detail=err)
        raise HTTPException(status_code=401, detail=err)
    if not user:
        raise HTTPException(status_code=401, detail="User account not found.")
    return user


def require_admin(user: Dict[str, Any] = Depends(require_authenticated_user)) -> Dict[str, Any]:
    """Enforce Administrator role."""
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Access Denied: Administrator privileges required.")
    return user


def require_ministry(user: Dict[str, Any] = Depends(require_authenticated_user)) -> Dict[str, Any]:
    """Enforce Ministry officer or Administrator role."""
    if user.get("role") not in ("ADMIN", "MINISTRY"):
        raise HTTPException(status_code=403, detail="Access Denied: Ministry officer privileges required.")
    return user


def require_project_manager(user: Dict[str, Any] = Depends(require_authenticated_user)) -> Dict[str, Any]:
    """Enforce Project Manager or Administrator role."""
    if user.get("role") not in ("ADMIN", "PROJECT_MANAGER"):
        raise HTTPException(status_code=403, detail="Access Denied: Project Manager privileges required.")
    return user


def resolve_scopes_for_request(request: Request) -> Tuple[Optional[str], Optional[str]]:
    """Derive ministry_scope and project_id_scope server-side strictly from verified session identity."""
    user = get_current_user_optional(request)
    if not user:
        return None, None
    role = user.get("role")
    if role == "ADMIN":
        return None, None
    elif role == "MINISTRY":
        return user.get("assigned_ministry"), None
    elif role == "PROJECT_MANAGER":
        return None, user.get("assigned_project_id")
    return None, None


# ==============================================================================
# GENERAL & AUTHENTICATION ENDPOINTS
# ==============================================================================

@app.get("/")
def home():
    return {
        "message": "InfraNetra Platform & Risk Intelligence Backend is running!",
        "version": "2.0.0"
    }


@app.get("/api/health")
def api_health():
    """Lightweight health check endpoint. Safe for public access — exposes no secrets or internal state."""
    return {"status": "ok"}


@app.get("/api/ministries/list")
async def api_get_ministries_list():
    """Retrieve list of recognized ministries for registration and filter dropdowns."""
    return {"ministries": get_all_ministries()}


@app.get("/api/ministries/verify")
@app.get("/api/ministries/lookup")
async def api_verify_ministry(name: str):
    """Verify if a ministry exists in the authoritative database registry."""
    clean_name = str(name or "").strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Ministry name is required.")
    valid_ministries = get_all_ministries()
    matched = next((m for m in valid_ministries if m.lower() == clean_name.lower()), None)
    if not matched:
        raise HTTPException(
            status_code=404,
            detail=f"Ministry '{clean_name}' not found in the InfraNetra Ministry registry."
        )
    return {
        "valid": True,
        "ministry": matched,
        "message": "Ministry verified"
    }


@app.post("/api/auth/register/ministry", status_code=201)
async def api_register_ministry(payload: Dict[str, Any], request: Request):
    """Register a new Ministry user with PENDING status awaiting Admin approval."""
    try:
        ip = get_client_ip(request)
        res = register_ministry_user(payload, ip_address=ip)
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@app.post("/api/auth/register/project-manager", status_code=201)
@app.post("/api/auth/register/pm", status_code=201)
async def api_register_project_manager(payload: Dict[str, Any], request: Request):
    """Register a new Project Manager with PENDING status awaiting Ministry approval."""
    try:
        ip = get_client_ip(request)
        res = register_project_manager_user(payload, ip_address=ip)
        return res
    except ValueError as ve:
        err_msg = str(ve)
        if "already" in err_msg.lower() and ("assigned" in err_msg.lower() or "active" in err_msg.lower() or "manager" in err_msg.lower() or "pm" in err_msg.lower() or "constraint" in err_msg.lower()):
            return project_already_assigned_response()
        if "not exist" in err_msg.lower() or "not found" in err_msg.lower():
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


# In-memory sliding-window rate limiter for Administrator login attempts
_admin_failed_attempts: Dict[str, List[float]] = {}

def _check_admin_rate_limit(ip: str):
    now = time.time()
    attempts = _admin_failed_attempts.get(ip, [])
    recent = [t for t in attempts if now - t < 300]
    _admin_failed_attempts[ip] = recent
    if len(recent) >= 10:
        raise HTTPException(
            status_code=429,
            detail="Too many failed administrator login attempts. Please try again in 5 minutes."
        )

def _record_admin_failed_attempt(ip: str):
    now = time.time()
    attempts = _admin_failed_attempts.get(ip, [])
    attempts.append(now)
    _admin_failed_attempts[ip] = [t for t in attempts if now - t < 300]

def _reset_admin_rate_limit(ip: str):
    _admin_failed_attempts.pop(ip, None)


@app.post("/api/auth/login/admin")
async def api_login_admin(payload: Dict[str, Any], request: Request):
    """
    Authenticate Administrator credentials server-side.
    Enforces ONLY the single fixed, pre-decided administrator username and password
    configured via server-side environment variables (ADMIN_USERNAME & ADMIN_PASSWORD).
    No client-supplied role, is_admin, ministry, project_id, or other parameters can grant admin access.
    """
    ip = get_client_ip(request)
    _check_admin_rate_limit(ip)

    # Server-side environment variables for the single pre-decided admin pair
    admin_env_user = (os.environ.get("ADMIN_USERNAME") or "").strip()
    admin_env_pass = (os.environ.get("ADMIN_PASSWORD") or "")

    if not admin_env_user or not admin_env_pass:
        raise HTTPException(
            status_code=500,
            detail="Administrator authentication credentials are not configured on the server."
        )

    req_username = str(payload.get("username") or "").strip()
    req_password = str(payload.get("password") or "")

    if not req_username or not req_password:
        raise HTTPException(status_code=400, detail="Username and password are required.")

    # Timing-safe constant-time comparison to prevent timing attacks
    user_matches = hmac.compare_digest(req_username, admin_env_user)
    pass_matches = hmac.compare_digest(req_password, admin_env_pass)

    if not (user_matches and pass_matches):
        _record_admin_failed_attempt(ip)
        safe_actor = req_username[:50] if req_username else "UNKNOWN"
        record_audit_log(
            None,
            safe_actor,
            "ADMIN",
            "ADMIN_LOGIN_FAILED",
            details="Invalid administrator credentials attempt",
            result="FAILED",
            ip_address=ip
        )
        # Generic error message: never reveals whether username or password was incorrect
        raise HTTPException(status_code=401, detail="Invalid administrator credentials.")

    # Reset rate-limiting failed attempt counter upon successful authentication
    _reset_admin_rate_limit(ip)

    # Authoritative database resolution & synchronization for the Admin identity
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE role = 'ADMIN' LIMIT 1;")
    admin_row = cur.fetchone()
    if admin_row:
        admin_user = dict(admin_row)
        update_fields = {}
        if admin_user.get("username") != admin_env_user:
            update_fields["username"] = admin_env_user

        # Save profile fields entered on Admin Login Page to authoritative single Admin record:
        if "full_name" in payload and str(payload["full_name"]).strip():
            update_fields["full_name"] = str(payload["full_name"]).strip()
        if "email" in payload and str(payload["email"]).strip():
            update_fields["email"] = str(payload["email"]).strip()
        if "designation" in payload and payload["designation"] is not None:
            update_fields["designation"] = str(payload["designation"]).strip()
        if "department" in payload and str(payload["department"]).strip():
            update_fields["department"] = str(payload["department"]).strip()

        if update_fields:
            set_clause = ", ".join([f"{k} = ?" for k in update_fields.keys()])
            values = list(update_fields.values()) + [admin_user["id"]]
            with conn:
                conn.execute(f"UPDATE users SET {set_clause} WHERE id = ? AND role = 'ADMIN';", values)
            cur.execute("SELECT * FROM users WHERE id = ?;", (admin_user["id"],))
            admin_user = dict(cur.fetchone())
    else:
        # Fallback creation if ever missing
        pwd_hash, salt = hash_password(secrets.token_hex(16))
        fn = str(payload.get("full_name") or "InfraNetra Platform Administrator").strip()
        em = str(payload.get("email") or "admin@mospi.gov.in").strip()
        desig = str(payload.get("designation") or "Administrator").strip()
        dept = str(payload.get("department") or "Infrastructure & Project Monitoring Division (IPMD), MoSPI").strip()
        with conn:
            cur.execute("""
                INSERT INTO users (username, password_hash, salt, full_name, email, designation, department, role, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'ADMIN', 'APPROVED');
            """, (admin_env_user, pwd_hash, salt, fn, em, desig, dept))
            admin_id = cur.lastrowid
        cur.execute("SELECT * FROM users WHERE id = ?;", (admin_id,))
        admin_user = dict(cur.fetchone())
    conn.close()

    if admin_user.get("status") != "APPROVED":
        raise HTTPException(status_code=403, detail="Administrator account is not active.")

    token = create_session_token(admin_user["id"], admin_env_user, "ADMIN")
    record_audit_log(
        admin_user["id"],
        admin_env_user,
        "ADMIN",
        "ADMIN_LOGIN_SUCCESS",
        details="Administrator authenticated with pre-decided fixed credentials",
        result="SUCCESS",
        ip_address=ip
    )

    safe_user = {k: v for k, v in admin_user.items() if k not in ("password_hash", "salt")}
    safe_user["username"] = admin_env_user
    safe_user["role"] = "ADMIN"
    return {"success": True, "token": token, "user": safe_user}


@app.put("/api/auth/profile")
@app.post("/api/auth/profile")
async def api_update_profile(payload: Dict[str, Any], user: Dict[str, Any] = Depends(require_authenticated_user)):
    """
    Update profile fields (Full Name, Email, Designation, Department) for the authenticated user.
    Authoritatively updates the database and returns the refreshed profile.
    """
    user_id = user["id"]
    update_fields = {}
    if "full_name" in payload and str(payload["full_name"]).strip():
        update_fields["full_name"] = str(payload["full_name"]).strip()
    if "email" in payload and str(payload["email"]).strip():
        update_fields["email"] = str(payload["email"]).strip()
    if "designation" in payload and payload["designation"] is not None:
        update_fields["designation"] = str(payload["designation"]).strip()
    if "department" in payload and str(payload["department"]).strip():
        update_fields["department"] = str(payload["department"]).strip()

    if not update_fields:
        raise HTTPException(status_code=400, detail="No profile fields provided for update.")

    conn = get_db_connection()
    set_clause = ", ".join([f"{k} = ?" for k in update_fields.keys()])
    values = list(update_fields.values()) + [user_id]
    with conn:
        conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?;", values)
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = ?;", (user_id,))
    updated_row = cur.fetchone()
    conn.close()

    if not updated_row:
        raise HTTPException(status_code=404, detail="User not found.")

    updated_user = dict(updated_row)
    safe_user = {k: v for k, v in updated_user.items() if k not in ("password_hash", "salt")}
    return {"success": True, "user": safe_user}



@app.post("/api/auth/login/ministry")
async def api_login_ministry(payload: Dict[str, Any], request: Request):
    """
    Authenticate Ministry user.
    Server strictly verifies authenticated user + assigned ministry + approved status.
    If the selected ministry does not match the account's assigned ministry: 403 Forbidden.
    """
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    selected_ministry = str(payload.get("ministry") or "").strip()

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required.")

    user = get_user_by_username(username)
    if not user or user.get("role") != "MINISTRY":
        raise HTTPException(status_code=401, detail="Invalid ministry officer credentials.")

    if not verify_password(password, user["password_hash"], user["salt"]):
        record_audit_log(user["id"], username, "MINISTRY", "MINISTRY_LOGIN_FAILED", details="Incorrect password", result="FAILED", ip_address=get_client_ip(request))
        raise HTTPException(status_code=401, detail="Invalid ministry officer credentials.")

    status = user.get("status", "PENDING")
    if status == "PENDING":
        raise HTTPException(status_code=403, detail="Your registration is pending administrator approval.")
    elif status == "REJECTED":
        raise HTTPException(status_code=403, detail="Your registration request has been rejected.")
    elif status == "SUSPENDED":
        raise HTTPException(status_code=403, detail="Your account has been suspended by the administrator.")
    elif status != "APPROVED":
        raise HTTPException(status_code=403, detail="Account is not active.")

    assigned_min = str(user.get("assigned_ministry") or "").strip()
    if selected_ministry and selected_ministry.lower() != assigned_min.lower():
        record_audit_log(user["id"], username, "MINISTRY", "MINISTRY_LOGIN_MISMATCH", details=f"Selected '{selected_ministry}' != assigned '{assigned_min}'.", result="FAILED", ip_address=get_client_ip(request))
        raise HTTPException(
            status_code=403,
            detail=f"Access Denied: Ministry mismatch. You selected '{selected_ministry}', but your approved account is assigned to '{assigned_min}'."
        )

    token = create_session_token(user["id"], user["username"], "MINISTRY")
    record_audit_log(user["id"], username, "MINISTRY", "MINISTRY_LOGIN_SUCCESS", details=f"Ministry officer signed in for {assigned_min}.", result="SUCCESS", ip_address=get_client_ip(request))

    safe_user = {k: v for k, v in user.items() if k not in ("password_hash", "salt")}
    return {"success": True, "token": token, "user": safe_user}


@app.post("/api/auth/login/project-manager")
@app.post("/api/auth/login/pm")
async def api_login_project_manager(payload: Dict[str, Any], request: Request):
    """
    Authenticate Project Manager user.
    Server strictly verifies Project ID + Username + Password + Approved status + Manager assignment.
    """
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    submitted_project_id = str(payload.get("project_id") or "").strip()

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required.")

    user = get_user_by_username(username)
    if not user or user.get("role") != "PROJECT_MANAGER":
        raise HTTPException(status_code=401, detail="Invalid Project Manager credentials.")

    if not verify_password(password, user["password_hash"], user["salt"]):
        record_audit_log(user["id"], username, "PROJECT_MANAGER", "PM_LOGIN_FAILED", details="Incorrect password", result="FAILED", ip_address=get_client_ip(request))
        raise HTTPException(status_code=401, detail="Invalid Project Manager credentials.")

    status = user.get("status", "PENDING")
    if status == "PENDING":
        raise HTTPException(status_code=403, detail="Your registration is pending ministry approval.")
    elif status == "REJECTED":
        raise HTTPException(status_code=403, detail="Your registration request has been rejected.")
    elif status == "SUSPENDED":
        raise HTTPException(status_code=403, detail="Your account has been suspended.")
    elif status != "APPROVED":
        raise HTTPException(status_code=403, detail="Account is not active.")

    assigned_pid = str(user.get("assigned_project_id") or "").strip()
    if submitted_project_id and submitted_project_id != assigned_pid:
        auth_proj = get_authoritative_project(submitted_project_id)
        if not auth_proj or str(auth_proj.get("canonical_project_id")).strip() != assigned_pid:
            record_audit_log(user["id"], username, "PROJECT_MANAGER", "PM_LOGIN_PROJECT_MISMATCH", details=f"Attempted {submitted_project_id} != assigned {assigned_pid}.", result="FAILED", ip_address=get_client_ip(request))
            raise HTTPException(
                status_code=403,
                detail=f"Access Denied: Project ID mismatch. You attempted to sign in with Project ID '{submitted_project_id}', but your account is assigned to Project ID '{assigned_pid}'."
            )

    token = create_session_token(user["id"], user["username"], "PROJECT_MANAGER")
    record_audit_log(user["id"], username, "PROJECT_MANAGER", "PM_LOGIN_SUCCESS", details=f"Project Manager signed in for Project {assigned_pid}.", result="SUCCESS", ip_address=get_client_ip(request))

    safe_user = {k: v for k, v in user.items() if k not in ("password_hash", "salt")}
    return {"success": True, "token": token, "user": safe_user}


@app.post("/api/auth/login/clerk")
async def api_login_clerk(request: Request, payload: Optional[Dict[str, Any]] = None):
    """
    Authenticate verified Clerk user identity.
    Accepts Clerk RS256 JWT in Authorization header or payload.
    Maps Clerk user ID to authoritative database user profile.
    Enforces server-side status checks (APPROVED / PENDING / REJECTED / SUSPENDED).
    """
    token = extract_token_from_request(request)
    if not token and payload:
        token = str(payload.get("clerk_token") or payload.get("token") or "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Clerk session token required.")

    user, err = authenticate_user_from_token(token)
    if err:
        if "awaiting" in err.lower() or "rejected" in err.lower() or "suspended" in err.lower():
            raise HTTPException(status_code=403, detail=err)
        raise HTTPException(status_code=401, detail=err)
    if not user:
        raise HTTPException(status_code=404, detail="No registered account associated with this Clerk identity.")

    if user.get("role") == "ADMIN":
        record_audit_log(
            user["id"],
            user["username"],
            "ADMIN",
            "CLERK_ADMIN_LOGIN_BLOCKED",
            details="Attempted Clerk login for Administrator account was blocked.",
            result="BLOCKED",
            ip_address=get_client_ip(request)
        )
        raise HTTPException(status_code=403, detail="Access Denied: Clerk authentication is not permitted for the Administrator account.")

    record_audit_log(
        user["id"],
        user["username"],
        user["role"],
        "CLERK_LOGIN_SUCCESS",
        details=f"User authenticated via verified Clerk identity ({user.get('clerk_user_id')}).",
        result="SUCCESS",
        ip_address=get_client_ip(request)
    )

    safe_user = {k: v for k, v in user.items() if k not in ("password_hash", "salt")}
    if user.get("role") == "PROJECT_MANAGER" and user.get("assigned_project_id"):
        from auth_db import get_project_ministry_and_name
        proj_info = get_project_ministry_and_name(str(user["assigned_project_id"]))
        if proj_info:
            safe_user["assigned_project_ministry"] = proj_info[0]
            safe_user["assigned_project_name"] = proj_info[1]
            safe_user["assigned_project_code"] = str(user["assigned_project_id"])

    return {"success": True, "token": token, "user": safe_user}


@app.get("/api/auth/me")
async def api_auth_me(user: Dict[str, Any] = Depends(require_authenticated_user)):
    """Retrieve server-verified authenticated user profile and scopes."""
    safe_user = {k: v for k, v in user.items() if k not in ("password_hash", "salt")}
    if user.get("role") == "PROJECT_MANAGER" and user.get("assigned_project_id"):
        from auth_db import get_project_ministry_and_name
        proj_info = get_project_ministry_and_name(str(user["assigned_project_id"]))
        if proj_info:
            safe_user["assigned_project_ministry"] = proj_info[0]
            safe_user["assigned_project_name"] = proj_info[1]
            safe_user["assigned_project_code"] = str(user["assigned_project_id"])
    return {"authenticated": True, "user": safe_user}


@app.post("/api/auth/logout")
async def api_auth_logout(request: Request):
    """Invalidate session and record audit trail."""
    user = get_current_user_optional(request)
    if user:
        record_audit_log(user["id"], user["username"], user["role"], "USER_LOGGED_OUT", details="Session ended by user", result="SUCCESS", ip_address=get_client_ip(request))
    return {"success": True, "message": "Logged out successfully."}


# ==============================================================================
# ADMIN APPROVAL & AUDIT ENDPOINTS
# ==============================================================================

@app.get("/api/admin/approvals/pending")
async def api_admin_get_pending_approvals(admin_user: Dict[str, Any] = Depends(require_admin)):
    """Admin retrieves unified pending approval requests across all ministries and projects.

    Returns:
        ministries   – pending Ministry Officer registrations (role=MINISTRY, status=PENDING)
        managers     – pending Project Manager registrations (role=PROJECT_MANAGER, status=PENDING)
        pending_users – unified list of both, ordered by registration date (newest first),
                        with role field set so the Admin UI can distinguish them
        total_pending – total count
    """
    min_requests = [r for r in get_ministry_requests() if r.get("status") == "PENDING"]
    pm_requests = [r for r in get_pm_requests(ministry_scope=None) if r.get("status") == "PENDING"]

    # Build the unified pending_users list the frontend expects.
    # Normalise each record so ApprovalRequest shape is satisfied:
    #   id, username, full_name, email, role, status, created_at,
    #   ministry (for MINISTRY), project_id / project_code / project_name (for PM)
    unified: list = []
    for r in min_requests:
        unified.append({
            "id": r.get("id") or r.get("user_id"),
            "user_id": r.get("id") or r.get("user_id"),
            "username": r.get("username") or "",
            "full_name": r.get("full_name") or "",
            "email": r.get("email") or "",
            "role": "MINISTRY",
            "status": "PENDING",
            "created_at": r.get("created_at") or r.get("registration_date") or "",
            "ministry": r.get("assigned_ministry") or r.get("ministry") or r.get("selected_ministry") or "",
            "assigned_ministry": r.get("assigned_ministry") or r.get("ministry") or "",
            "phone": r.get("phone") or "",
            "designation": r.get("designation") or "",
            "clerk_user_id": r.get("clerk_user_id"),
            "project_id": None,
            "project_code": None,
            "project_name": None,
        })
    for r in pm_requests:
        unified.append({
            "id": r.get("id") or r.get("user_id"),
            "user_id": r.get("id") or r.get("user_id"),
            "username": r.get("username") or "",
            "full_name": r.get("full_name") or "",
            "email": r.get("email") or "",
            "role": "PROJECT_MANAGER",
            "status": "PENDING",
            "created_at": r.get("created_at") or r.get("registration_date") or "",
            "ministry": r.get("ministry") or "",
            "assigned_ministry": r.get("ministry") or "",
            "phone": r.get("phone") or "",
            "designation": r.get("designation") or "",
            "clerk_user_id": r.get("clerk_user_id"),
            "project_id": r.get("project_id"),
            "project_code": r.get("project_code") or str(r.get("project_id") or ""),
            "project_name": r.get("project_name") or "",
        })

    # Sort newest first (stable sort; empty strings sort last)
    unified.sort(key=lambda x: x.get("created_at") or "", reverse=True)

    return {
        "ministries": min_requests,
        "managers": pm_requests,
        "pending_users": unified,
        "total_pending": len(unified),
    }


@app.post("/api/admin/approvals/{user_id}/approve")
async def api_admin_unified_approve(user_id: int, request: Request, payload: Optional[Dict[str, Any]] = None, admin_user: Dict[str, Any] = Depends(require_admin)):
    """Admin approves either a Ministry user or a Project Manager."""
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found.")
    role = user.get("role")
    ip = get_client_ip(request)
    try:
        if role == "MINISTRY":
            return approve_ministry_request(user_id, admin_user, ip_address=ip)
        elif role == "PROJECT_MANAGER":
            return approve_pm_request(user_id, admin_user, ip_address=ip)
        else:
            raise HTTPException(status_code=400, detail=f"Cannot approve user with role '{role}'.")
    except ValueError as ve:
        err_msg = str(ve)
        if "already" in err_msg.lower() and ("assigned" in err_msg.lower() or "active" in err_msg.lower() or "manager" in err_msg.lower() or "pm" in err_msg.lower() or "constraint" in err_msg.lower()):
            return project_already_assigned_response()
        raise HTTPException(status_code=400, detail=err_msg)


@app.post("/api/admin/approvals/{user_id}/reject")
async def api_admin_unified_reject(user_id: int, request: Request, payload: Optional[Dict[str, Any]] = None, admin_user: Dict[str, Any] = Depends(require_admin)):
    """Admin rejects either a Ministry user or a Project Manager."""
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found.")
    role = user.get("role")
    ip = get_client_ip(request)
    try:
        if role == "MINISTRY":
            return reject_ministry_request(user_id, admin_user, ip_address=ip)
        elif role == "PROJECT_MANAGER":
            return reject_pm_request(user_id, admin_user, ip_address=ip)
        else:
            raise HTTPException(status_code=400, detail=f"Cannot reject user with role '{role}'.")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@app.post("/api/admin/approvals/{user_id}/suspend")
async def api_admin_unified_suspend(user_id: int, request: Request, payload: Optional[Dict[str, Any]] = None, admin_user: Dict[str, Any] = Depends(require_admin)):
    """Admin suspends either a Ministry user or a Project Manager."""
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found.")
    role = user.get("role")
    ip = get_client_ip(request)
    try:
        if role == "MINISTRY":
            return suspend_ministry_user(user_id, admin_user, ip_address=ip)
        elif role == "PROJECT_MANAGER":
            return suspend_pm_user(user_id, admin_user, ip_address=ip)
        else:
            raise HTTPException(status_code=400, detail=f"Cannot suspend user with role '{role}'.")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@app.get("/api/admin/ministries/requests")
async def api_admin_get_ministries(admin_user: Dict[str, Any] = Depends(require_admin)):
    """Admin reviews all Ministry user registration requests."""
    return {"requests": get_ministry_requests()}


@app.post("/api/admin/ministries/{user_id}/approve")
@app.post("/api/admin/ministry-requests/{user_id}/approve")
async def api_admin_approve_ministry(user_id: int, request: Request, admin_user: Dict[str, Any] = Depends(require_admin)):
    try:
        return approve_ministry_request(user_id, admin_user, ip_address=get_client_ip(request))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@app.post("/api/admin/ministries/{user_id}/reject")
@app.post("/api/admin/ministry-requests/{user_id}/reject")
async def api_admin_reject_ministry(user_id: int, request: Request, admin_user: Dict[str, Any] = Depends(require_admin)):
    try:
        return reject_ministry_request(user_id, admin_user, ip_address=get_client_ip(request))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@app.post("/api/admin/ministries/{user_id}/suspend")
@app.post("/api/admin/ministry-requests/{user_id}/suspend")
async def api_admin_suspend_ministry(user_id: int, request: Request, admin_user: Dict[str, Any] = Depends(require_admin)):
    try:
        return suspend_ministry_user(user_id, admin_user, ip_address=get_client_ip(request))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@app.get("/api/admin/managers/requests")
@app.get("/api/admin/managers/pending")
async def api_admin_get_managers(admin_user: Dict[str, Any] = Depends(require_admin)):
    """Admin reviews all Project Manager requests across all ministries."""
    reqs = get_pm_requests(ministry_scope=None)
    return {"requests": reqs, "pending_managers": reqs}


@app.post("/api/admin/managers/{user_id}/approve")
async def api_admin_approve_manager(user_id: int, request: Request, admin_user: Dict[str, Any] = Depends(require_admin)):
    try:
        return approve_pm_request(user_id, admin_user, ip_address=get_client_ip(request))
    except ValueError as ve:
        err_msg = str(ve)
        if "already" in err_msg.lower() and ("assigned" in err_msg.lower() or "active" in err_msg.lower() or "manager" in err_msg.lower() or "pm" in err_msg.lower() or "constraint" in err_msg.lower()):
            return project_already_assigned_response()
        raise HTTPException(status_code=400, detail=err_msg)


@app.post("/api/admin/managers/{user_id}/reject")
async def api_admin_reject_manager(user_id: int, request: Request, admin_user: Dict[str, Any] = Depends(require_admin)):
    try:
        return reject_pm_request(user_id, admin_user, ip_address=get_client_ip(request))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@app.post("/api/admin/managers/{user_id}/suspend")
async def api_admin_suspend_manager(user_id: int, request: Request, admin_user: Dict[str, Any] = Depends(require_admin)):
    try:
        return suspend_pm_user(user_id, admin_user, ip_address=get_client_ip(request))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@app.get("/api/admin/audit-logs")
async def api_admin_audit_logs(limit: int = 150, admin_user: Dict[str, Any] = Depends(require_admin)):
    """Admin views authoritative audit trail."""
    return {"logs": get_audit_logs_list(limit=limit)}


# ==============================================================================
# MINISTRY APPROVAL ENDPOINTS
# ==============================================================================

@app.get("/api/ministry/managers/requests")
@app.get("/api/ministry/managers/pending")
async def api_ministry_get_managers(ministry_user: Dict[str, Any] = Depends(require_ministry)):
    """Ministry reviews PM requests strictly for projects of their ministry."""
    if ministry_user["role"] == "ADMIN":
        scope = None
    else:
        scope = ministry_user.get("assigned_ministry")
    reqs = get_pm_requests(ministry_scope=scope)
    return {"requests": reqs, "pending_managers": reqs}


@app.post("/api/ministry/managers/{user_id}/approve")
async def api_ministry_approve_manager(user_id: int, request: Request, ministry_user: Dict[str, Any] = Depends(require_ministry)):
    try:
        return approve_pm_request(user_id, ministry_user, ip_address=get_client_ip(request))
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        err_msg = str(ve)
        if "already" in err_msg.lower() and ("assigned" in err_msg.lower() or "active" in err_msg.lower() or "manager" in err_msg.lower() or "pm" in err_msg.lower() or "constraint" in err_msg.lower()):
            return project_already_assigned_response()
        raise HTTPException(status_code=400, detail=err_msg)


@app.post("/api/ministry/managers/{user_id}/reject")
async def api_ministry_reject_manager(user_id: int, request: Request, ministry_user: Dict[str, Any] = Depends(require_ministry)):
    try:
        return reject_pm_request(user_id, ministry_user, ip_address=get_client_ip(request))
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@app.post("/api/ministry/managers/{user_id}/suspend")
async def api_ministry_suspend_manager(user_id: int, request: Request, ministry_user: Dict[str, Any] = Depends(require_ministry)):
    try:
        return suspend_pm_user(user_id, ministry_user, ip_address=get_client_ip(request))
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


# ==============================================================================
# PROJECT MANAGER DAILY PROJECT UPDATE ENDPOINTS
# ==============================================================================

@app.post("/api/pm/daily-update")
async def api_pm_submit_update(payload: Dict[str, Any], request: Request, user: Dict[str, Any] = Depends(require_project_manager)):
    """Project Manager submits daily project update for their assigned project."""
    try:
        return submit_daily_project_update(user, payload, ip_address=get_client_ip(request))
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@app.get("/api/pm/daily-updates/{project_id}")
async def api_pm_get_updates(project_id: str, request: Request, user: Dict[str, Any] = Depends(require_authenticated_user)):
    """View historical daily updates for authorized project."""
    try:
        rows = get_daily_project_updates(project_id, user)
        return {"project_id": project_id, "updates": rows}
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))


@app.get("/api/pm/my-project")
async def api_pm_my_project(user: Dict[str, Any] = Depends(require_project_manager)):
    """Retrieve assigned project details for authenticated PM."""
    if user["role"] == "PROJECT_MANAGER":
        pid = user.get("assigned_project_id")
        if not pid:
            raise HTTPException(status_code=404, detail="No project assigned to this account.")
        detail = await get_project_detail_by_id(pid)
        if not detail:
            raise HTTPException(status_code=404, detail=f"Assigned project {pid} not found.")
        return detail
    raise HTTPException(status_code=400, detail="Not a Project Manager account.")


# ==============================================================================
# PROTECTED FLASH REPORT INGESTION & DATASET OPERATIONS (ADMIN ONLY)
# ==============================================================================

@app.post("/api/ingest-flash-report")
async def ingest_flash_report(
    file: UploadFile = File(...),
    report_month: str = Form("April 2026"),
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """Ingest monthly PAIMANA Flash Report (Admin Only)."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    print(f"[{admin_user['username']}] Received PDF: {file.filename}", flush=True)

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF")

    safe_basename = os.path.basename(file.filename)
    safe_filename = re.sub(r"[^a-zA-Z0-9_.-]", "_", safe_basename)
    stem = Path(safe_filename).stem
    ext = Path(safe_filename).suffix or ".pdf"
    clean_stem = re.sub(r"[^a-zA-Z0-9_.-]", "_", stem)
    destination_path = UPLOAD_DIR / f"{clean_stem}_{uuid.uuid4().hex[:8]}{ext}"

    try:
        with destination_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    finally:
        await file.close()

    file_size_bytes = destination_path.stat().st_size
    target_month_date = normalize_report_month_date(report_month)

    try:
        extraction_data = extract_paimana_pdf(destination_path, target_month_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction error: {str(e)}")

    total_pages = extraction_data["total_pages"]
    records_count = extraction_data["records_extracted"]
    val_report = extraction_data.get("validation_report", {})

    record_audit_log(
        actor_id=admin_user["id"],
        actor_username=admin_user["username"],
        actor_role="ADMIN",
        action="INGEST_FLASH_REPORT",
        target_type="REPORT",
        target_id=safe_filename,
        details=f"Extracted {records_count} projects from {total_pages} pages for {extraction_data['report_month']}.",
        result="SUCCESS"
    )

    return {
        "success": True,
        "message": f"PDF received and validated successfully ({records_count} valid projects, {extraction_data.get('canonical_metrics', {}).get('unique_project_count', records_count)} unique canonical projects)",
        "filename": safe_filename,
        "report_month": extraction_data["report_month"],
        "total_pages": total_pages,
        "pages_with_text": extraction_data["pages_with_text"],
        "records_extracted": records_count,
        "records": extraction_data["records"],
        "canonical_records": extraction_data.get("canonical_records", []),
        "canonical_metrics": extraction_data.get("canonical_metrics", {}),
        "validation_report": val_report,
        "preview": extraction_data["preview"],
        "file_size_bytes": file_size_bytes,
    }


@app.post("/api/datasets/save")
@app.post("/api/datasets/{report_month_path}/save")
async def save_dataset(
    payload: Optional[Dict[str, Any]] = None,
    report_month_path: Optional[str] = None,
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """Save or upsert canonical projects dynamically for any report month (Admin Only)."""
    canonical_records = []
    report_month = report_month_path or "2026-04"

    if payload:
        if "report_month" in payload and payload["report_month"]:
            report_month = str(payload["report_month"]).strip()
        if "records" in payload and isinstance(payload["records"], list) and payload["records"]:
            canonical_records = payload["records"]

    if not canonical_records:
        canonical_file = Path(__file__).resolve().parent / "canonical_results.json"
        if canonical_file.exists():
            try:
                with canonical_file.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                    canonical_records = data.get("canonical_records", [])
                    if not payload or not payload.get("report_month"):
                        report_month = data.get("report_month", report_month)
            except Exception as e:
                print(f"Error reading canonical_results.json: {e}")

    if not canonical_records:
        raise HTTPException(
            status_code=400,
            detail=f"No canonical records found to save for {report_month}. Please run PDF ingestion first."
        )

    result = await save_canonical_records(canonical_records, report_month=report_month)
    record_audit_log(
        actor_id=admin_user["id"],
        actor_username=admin_user["username"],
        actor_role="ADMIN",
        action="SAVE_CANONICAL_DATASET",
        target_type="DATASET",
        target_id=report_month,
        details=f"Saved/upserted {len(canonical_records)} records for month {report_month}.",
        result="SUCCESS"
    )
    return result


@app.post("/api/completed-projects/sync")
async def sync_completed_projects(admin_user: Dict[str, Any] = Depends(require_admin)):
    """Extract Table 3 completed projects from Flash Reports and safely update actual_completion_date (Admin Only)."""
    res = await update_completed_projects_actual_dates()
    record_audit_log(
        actor_id=admin_user["id"],
        actor_username=admin_user["username"],
        actor_role="ADMIN",
        action="SYNC_COMPLETED_PROJECTS",
        details="Synced actual completion dates from Flash Reports Table 3.",
        result="SUCCESS"
    )
    return res


@app.post("/api/ml/rebuild-dataset")
async def rebuild_ml_dataset(admin_user: Dict[str, Any] = Depends(require_admin)):
    """Rebuild ml_training_dataset with accurate delay_months and metrics (Admin Only)."""
    await update_completed_projects_actual_dates()
    result = await rebuild_ml_training_dataset()
    record_audit_log(
        actor_id=admin_user["id"],
        actor_username=admin_user["username"],
        actor_role="ADMIN",
        action="REBUILD_ML_DATASET",
        details="Rebuilt ML training dataset without feature leakage.",
        result="SUCCESS"
    )
    return result


# ==============================================================================
# SCOPED PUBLIC / ROLE-BASED DASHBOARD & REGISTRY ENDPOINTS
# ==============================================================================

@app.get("/api/supabase/health")
async def get_supabase_health():
    health = await check_supabase_health()
    return health


@app.get("/api/months")
async def get_report_months():
    return await get_available_months_list()


@app.get("/api/datasets/months")
async def get_datasets_months():
    months = await get_all_months_availability()
    return {"months": months}


@app.get("/api/datasets/summary")
@app.get("/api/datasets/{report_month_path}/summary")
async def get_dataset_summary(
    report_month_path: Optional[str] = None,
    report_month: Optional[str] = None
):
    target_month = report_month_path or report_month or "2026-04"
    return await get_report_month_summary(report_month=target_month)


@app.get("/api/dashboard/summary")
async def api_dashboard_summary(request: Request, report_month: Optional[str] = None):
    """Retrieve dynamic dashboard metrics with server-enforced scoping."""
    min_scope, pid_scope = resolve_scopes_for_request(request)
    return await get_dashboard_summary(
        report_month=report_month,
        ministry_scope=min_scope,
        project_id_scope=pid_scope
    )


@app.get("/api/projects")
async def api_get_projects(
    request: Request,
    report_month: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    sector: Optional[str] = None,
    state: Optional[str] = None,
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    sort_by: str = "cost_overrun_pct",
    sort_dir: str = "desc"
):
    """Retrieve paginated, filterable projects registry with server-enforced scoping."""
    min_scope, pid_scope = resolve_scopes_for_request(request)
    return await get_projects_registry(
        report_month=report_month,
        page=page,
        page_size=page_size,
        search=search,
        sector=sector,
        state=state,
        status=status,
        risk_level=risk_level,
        sort_by=sort_by,
        sort_dir=sort_dir,
        ministry_scope=min_scope,
        project_id_scope=pid_scope,
    )


@app.post("/api/projects", status_code=201)
async def api_create_project(
    payload: Dict[str, Any],
    request: Request,
    ministry_user: Dict[str, Any] = Depends(require_ministry)
):
    """
    Ministry officer creates an infrastructure project with authoritative ministry scoping.
    Optionally provisions a Project Manager account with status PENDING.
    """
    try:
        from auth_db import create_new_project
        return create_new_project(ministry_user, payload, ip_address=get_client_ip(request))
    except ValueError as ve:
        err_msg = str(ve)
        if "already" in err_msg.lower() and ("assigned" in err_msg.lower() or "active" in err_msg.lower() or "manager" in err_msg.lower() or "pm" in err_msg.lower() or "constraint" in err_msg.lower()):
            return project_already_assigned_response()
        raise HTTPException(status_code=400, detail=str(ve))
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")


@app.get("/api/projects/lookup/{project_id}")
async def api_lookup_project(project_id: str):
    """
    Authoritative server-side project lookup for PM registration and UI feedback.
    Validates Project ID directly against infrastructure_projects dataset.
    Returns project name, owning ministry, approval authority, and active PM status.
    """
    clean_id = str(project_id or "").strip()
    if not clean_id:
        raise HTTPException(status_code=400, detail="Project ID is required.")

    res = lookup_project_details(clean_id)
    if not res:
        raise HTTPException(
            status_code=404,
            detail="Project ID not found in the InfraNetra project registry."
        )
    return res


@app.get("/api/projects/{project_id}")
async def api_get_project_detail(project_id: str, request: Request):
    """Retrieve complete project detail with IDOR protection."""
    user = get_current_user_optional(request)
    clean_id = re.sub(r"\s+", "", str(project_id or "")).strip()

    detail = await get_project_detail_by_id(clean_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Project with ID '{clean_id}' not found in database")

    # IDOR Check for Project Manager (ONLY canonical project_id accepted):
    if user and user.get("role") == "PROJECT_MANAGER":
        assigned = str(user.get("assigned_project_id") or "").strip()
        p_code = str(detail.get("project_id") or "").strip()
        if assigned not in (clean_id, p_code):
            raise HTTPException(
                status_code=403,
                detail=f"Access Denied: Project Managers are restricted to assigned project '{assigned}'. Cannot access project '{clean_id}'."
            )

    # IDOR Check for Ministry user:
    if user and user.get("role") == "MINISTRY":
        user_min = str(user.get("assigned_ministry") or "").strip().lower()
        proj_min = str(detail.get("ministry") or "").strip().lower()
        if user_min != proj_min:
            raise HTTPException(
                status_code=403,
                detail=f"Access Denied: Ministry user assigned to '{user.get('assigned_ministry')}' cannot access projects of '{detail.get('ministry')}'."
            )

    return detail


@app.get("/api/map/projects")
async def api_get_map_projects(request: Request, report_month: Optional[str] = None):
    """Retrieve map markers with server-enforced scoping."""
    min_scope, pid_scope = resolve_scopes_for_request(request)
    return await get_map_markers(
        report_month=report_month,
        ministry_scope=min_scope,
        project_id_scope=pid_scope
    )


@app.get("/api/early-warnings")
async def api_get_early_warnings(
    request: Request,
    report_month: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 150
):
    """Retrieve early warnings feed with server-enforced scoping."""
    min_scope, pid_scope = resolve_scopes_for_request(request)
    return await get_early_warnings_feed(
        report_month=report_month,
        severity=severity,
        limit=limit,
        ministry_scope=min_scope,
        project_id_scope=pid_scope
    )


@app.get("/api/analytics/sectors")
async def api_get_sector_analytics(request: Request, report_month: Optional[str] = None):
    """Retrieve aggregated sector analytics with server-enforced scoping."""
    min_scope, _ = resolve_scopes_for_request(request)
    return await get_sector_analytics(report_month=report_month, ministry_scope=min_scope)


@app.get("/api/analytics/monthly")
async def api_get_monthly_analytics():
    return await get_monthly_trends()


@app.get("/api/ml/training-stats")
async def get_training_stats():
    db_stats = await get_ml_training_statistics()
    model_stats = get_verified_ml_stats()
    return {**db_stats, **model_stats}


@app.post("/api/ml/predict/{project_id}")
async def api_predict_project(project_id: str, request: Request, payload: Optional[Dict[str, Any]] = None):
    """Predict cost overrun and delay months without feature leakage."""
    user = get_current_user_optional(request)
    clean_id = re.sub(r"\s+", "", str(project_id or "")).strip()

    if user and user.get("role") == "PROJECT_MANAGER":
        assigned = str(user.get("assigned_project_id") or "").strip()
        if clean_id != assigned:
            raise HTTPException(status_code=403, detail="Access Denied: Project Managers can only predict for their assigned project.")

    detail = await get_project_detail_by_id(clean_id)
    if detail:
        if user and user.get("role") == "MINISTRY":
            user_min = str(user.get("assigned_ministry") or "").strip().lower()
            proj_min = str(detail.get("ministry") or "").strip().lower()
            if user_min != proj_min:
                raise HTTPException(status_code=403, detail="Access Denied: Ministry user cannot run predictions for other ministries' projects.")

        p_data = {
            "project_id": detail["project_id"],
            "sector": detail["sector"],
            "state": detail["state"],
            "original_cost": detail["financials"]["original_cost_cr"],
            "start_date": detail["start_date"],
            "original_completion_date": detail["original_completion_date"],
        }
        if payload:
            p_data.update(payload)
        return predict_project(p_data)
    elif payload:
        return predict_project(payload)
    else:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8000")),
        reload=os.environ.get("RELOAD", "false").lower() == "true",
    )
