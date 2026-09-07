"""
InfraNetra Supabase Operational & Auth Data Access Layer
Provides persistent, authoritative access to:
- users
- user_ministry_assignments
- project_manager_assignments
- daily_project_updates
- audit_logs

Falls back to SQLite if Supabase operational tables are not yet initialized or unreachable.
"""

import os
import json
import urllib.request
import urllib.error
import httpx
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

_tables_verified: Optional[bool] = None
_tables_verified_at: float = 0.0
_TABLES_VERIFIED_TTL_SECS = 60.0  # re-check every 60 s on failure; never on success


def is_supabase_auth_ready() -> bool:
    """Check whether Supabase operational tables are live and accessible.

    Positive results are cached indefinitely (tables don't disappear).
    Negative results are cached for _TABLES_VERIFIED_TTL_SECS seconds so that
    transient network failures during startup are retried automatically.
    """
    import time
    global _tables_verified, _tables_verified_at

    if _tables_verified is True:
        return True  # permanently cached — tables confirmed present

    if not SUPABASE_URL or not SUPABASE_KEY or not SUPABASE_URL.startswith("http"):
        _tables_verified = False
        return False

    # If we recently checked and got False, don't hammer Supabase on every request
    now = time.monotonic()
    if _tables_verified is False and (now - _tables_verified_at) < _TABLES_VERIFIED_TTL_SECS:
        return False

    try:
        status, _ = _supa_request("GET", "/rest/v1/users?limit=1", timeout=5.0)
        if status in (200, 206):
            _tables_verified = True
            _tables_verified_at = now
            return True
        else:
            _tables_verified = False
            _tables_verified_at = now
            return False
    except Exception:
        _tables_verified = False
        _tables_verified_at = now
        return False


def get_headers(prefer: str = "return=representation") -> Dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }


def _supa_request(method: str, path: str, json_data: Any = None, prefer: str = "return=representation", timeout: float = 10.0) -> Tuple[int, Any]:
    """Robust, direct HTTP request executor to Supabase PostgREST endpoints."""
    url = f"{SUPABASE_URL}{path}"
    headers = get_headers(prefer)
    req = urllib.request.Request(url, headers=headers, method=method)
    if json_data is not None:
        req.data = json.dumps(json_data).encode("utf-8")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status = resp.status
            content = resp.read().decode("utf-8")
            return status, json.loads(content) if content else None
    except urllib.error.HTTPError as he:
        err_content = he.read().decode("utf-8")
        try:
            return he.code, json.loads(err_content)
        except Exception:
            return he.code, {"detail": err_content}
    except Exception as e:
        return 500, {"detail": str(e)}


# ==============================================================================
# USER & CLERK IDENTITY QUERIES
# ==============================================================================

def supa_get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    if not is_supabase_auth_ready():
        return None
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.get(
                f"{SUPABASE_URL}/rest/v1/users?id=eq.{user_id}&limit=1",
                headers=get_headers()
            )
            if r.status_code == 200:
                rows = r.json()
                if rows:
                    u = rows[0]
                    # Also fetch ministry and project assignment if applicable
                    if u.get("role") == "MINISTRY":
                        r_m = client.get(f"{SUPABASE_URL}/rest/v1/user_ministry_assignments?user_id=eq.{user_id}&limit=1", headers=get_headers())
                        if r_m.status_code == 200 and r_m.json():
                            u["assigned_ministry"] = r_m.json()[0].get("ministry")
                    elif u.get("role") == "PROJECT_MANAGER":
                        r_p = client.get(f"{SUPABASE_URL}/rest/v1/project_manager_assignments?user_id=eq.{user_id}&limit=1", headers=get_headers())
                        if r_p.status_code == 200 and r_p.json():
                            u["assigned_project_id"] = r_p.json()[0].get("project_id")
                    return u
    except Exception as e:
        print(f"[Supabase Auth Warning] get_user_by_id failed: {e}")
    return None


def supa_get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    if not is_supabase_auth_ready():
        return None
    try:
        clean_user = username.strip().lower()
        with httpx.Client(timeout=5.0) as client:
            r = client.get(
                f"{SUPABASE_URL}/rest/v1/users?username=ilike.{clean_user}&limit=1",
                headers=get_headers()
            )
            if r.status_code == 200:
                rows = r.json()
                if rows:
                    u = rows[0]
                    uid = u["id"]
                    if u.get("role") == "MINISTRY":
                        r_m = client.get(f"{SUPABASE_URL}/rest/v1/user_ministry_assignments?user_id=eq.{uid}&limit=1", headers=get_headers())
                        if r_m.status_code == 200 and r_m.json():
                            u["assigned_ministry"] = r_m.json()[0].get("ministry")
                    elif u.get("role") == "PROJECT_MANAGER":
                        r_p = client.get(f"{SUPABASE_URL}/rest/v1/project_manager_assignments?user_id=eq.{uid}&limit=1", headers=get_headers())
                        if r_p.status_code == 200 and r_p.json():
                            u["assigned_project_id"] = r_p.json()[0].get("project_id")
                    return u
    except Exception as e:
        print(f"[Supabase Auth Warning] get_user_by_username failed: {e}")
    return None


def supa_get_user_by_clerk_id(clerk_user_id: str) -> Optional[Dict[str, Any]]:
    if not is_supabase_auth_ready():
        return None
    try:
        clean_cid = str(clerk_user_id).strip()
        with httpx.Client(timeout=5.0) as client:
            r = client.get(
                f"{SUPABASE_URL}/rest/v1/users?clerk_user_id=eq.{clean_cid}&limit=1",
                headers=get_headers()
            )
            if r.status_code == 200:
                rows = r.json()
                if rows:
                    u = rows[0]
                    uid = u["id"]
                    if u.get("role") == "MINISTRY":
                        r_m = client.get(f"{SUPABASE_URL}/rest/v1/user_ministry_assignments?user_id=eq.{uid}&limit=1", headers=get_headers())
                        if r_m.status_code == 200 and r_m.json():
                            u["assigned_ministry"] = r_m.json()[0].get("ministry")
                    elif u.get("role") == "PROJECT_MANAGER":
                        r_p = client.get(f"{SUPABASE_URL}/rest/v1/project_manager_assignments?user_id=eq.{uid}&limit=1", headers=get_headers())
                        if r_p.status_code == 200 and r_p.json():
                            u["assigned_project_id"] = r_p.json()[0].get("project_id")
                    return u
    except Exception as e:
        print(f"[Supabase Auth Warning] get_user_by_clerk_id failed: {e}")
    return None


def supa_record_audit_log(
    actor_id: Optional[int],
    actor_username: Optional[str],
    actor_role: Optional[str],
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
    result: str = "SUCCESS"
) -> bool:
    if not is_supabase_auth_ready():
        return False
    try:
        payload = {
            "actor_id": actor_id,
            "actor_username": actor_username,
            "actor_role": actor_role,
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "details": details,
            "ip_address": ip_address,
            "result": result
        }
        with httpx.Client(timeout=5.0) as client:
            r = client.post(f"{SUPABASE_URL}/rest/v1/audit_logs", json=payload, headers=get_headers())
            return r.status_code in (200, 201, 204)
    except Exception as e:
        print(f"[Supabase Audit Warning] record_audit_log failed: {e}")
        return False


def supa_get_project_by_id_or_code(project_id_input: str) -> Optional[Dict[str, Any]]:
    """
    Authoritative lookup of a project in Supabase infrastructure_projects.
    Matches ONLY canonical project_id (PAIMANA project code).
    Internal database primary key 'id' is NOT accepted.
    Returns dictionary with canonical_project_id, database_id, project_name, ministry if found.
    Returns None if authoritatively not found.
    Raises ConnectionError if Supabase is unreachable.
    """
    if not SUPABASE_URL or not SUPABASE_KEY or not SUPABASE_URL.startswith("http"):
        raise ConnectionError("Supabase is not configured.")

    clean_id = str(project_id_input or "").strip()
    if not clean_id:
        return None

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }

    try:
        with httpx.Client(timeout=6.0) as client:
            url_code = f"{SUPABASE_URL}/rest/v1/infrastructure_projects?project_id=eq.{clean_id}&select=id,project_id,project_name,ministry&order=report_month.desc&limit=1"
            resp = client.get(url_code, headers=headers)
            if resp.status_code == 200:
                rows = resp.json()
                if rows:
                    r = rows[0]
                    return {
                        "canonical_project_id": str(r["project_id"]),
                        "database_id": r["id"],
                        "project_name": r["project_name"],
                        "ministry": r["ministry"],
                    }
                return None  # Authoritatively not present in Supabase
            else:
                raise ConnectionError(f"Supabase returned HTTP {resp.status_code}")
    except (httpx.RequestError, httpx.TimeoutException) as e:
        raise ConnectionError(f"Supabase network failure: {e}")


# ==============================================================================
# AUTHORITATIVE SUPABASE OPERATIONAL REGISTRATION & APPROVAL QUEUE
# ==============================================================================

def supa_register_ministry_user(user_data: Dict[str, Any], user_id: int) -> bool:
    """
    Persist Ministry registration into authoritative Supabase tables:
    1. users (role='MINISTRY', status='PENDING')
    2. user_ministry_assignments (status='PENDING')

    Strategy: Attempt insert with the authoritative SQLite user_id.
    If a conflict occurs (the row already exists with that id or username),
    fall back to a PATCH/update so the record reflects the latest registration data.
    This makes the function idempotent and prevents silent failures.
    """
    if not is_supabase_auth_ready():
        return False
    try:
        user_payload = {
            "id": user_id,
            "username": user_data["username"],
            "password_hash": user_data["password_hash"],
            "salt": user_data["salt"],
            "full_name": user_data["full_name"],
            "email": user_data["email"],
            "phone": user_data.get("phone") or None,
            "designation": user_data.get("designation") or None,
            "role": "MINISTRY",
            "status": "PENDING",
            "clerk_user_id": user_data.get("clerk_user_id") or None,
        }

        # --- Step 1: Try to insert the user row with the explicit SQLite id ---
        # Use "resolution=merge-duplicates" so that if the row already exists with
        # this id, it gets updated instead of causing a 409/422.
        st1, resp1 = _supa_request(
            "POST",
            "/rest/v1/users",
            json_data=user_payload,
            prefer="resolution=merge-duplicates,return=minimal"
        )

        user_synced_ok = st1 in (200, 201, 204)

        if not user_synced_ok:
            # Some Supabase configurations do not allow explicit `id` inserts when
            # the column is backed by a serial/identity sequence.
            # Fall back: try to upsert by username (PATCH existing or POST without id).
            print(f"[Supabase Ministry Register] Insert with id={user_id} returned HTTP {st1}: {resp1}. "
                  f"Attempting upsert-by-username for '{user_data['username']}'.")

            # Check if user already exists by username
            st_check, existing = _supa_request(
                "GET",
                f"/rest/v1/users?username=eq.{user_data['username']}&limit=1"
            )
            if st_check == 200 and isinstance(existing, list) and existing:
                # User exists — PATCH to update their record
                existing_id = existing[0]["id"]
                patch_payload = {
                    "full_name": user_data["full_name"],
                    "email": user_data["email"],
                    "phone": user_data.get("phone") or None,
                    "designation": user_data.get("designation") or None,
                    "role": "MINISTRY",
                    "status": "PENDING",
                    "clerk_user_id": user_data.get("clerk_user_id") or None,
                }
                st_patch, _ = _supa_request(
                    "PATCH",
                    f"/rest/v1/users?id=eq.{existing_id}",
                    json_data=patch_payload,
                    prefer="return=minimal"
                )
                user_synced_ok = st_patch in (200, 204)
                if user_synced_ok:
                    # Update user_id reference to the Supabase id so the assignment links correctly
                    user_id = existing_id
                    print(f"[Supabase Ministry Register] Updated existing user id={existing_id} via PATCH.")
                else:
                    print(f"[Supabase Ministry Register] PATCH failed HTTP {st_patch}. User may be missing from Supabase.")
            else:
                # User doesn't exist — try insert without explicit id
                no_id_payload = {k: v for k, v in user_payload.items() if k != "id"}
                st_noid, resp_noid = _supa_request(
                    "POST",
                    "/rest/v1/users",
                    json_data=no_id_payload,
                    prefer="return=representation"
                )
                if st_noid in (200, 201) and isinstance(resp_noid, list) and resp_noid:
                    user_id = resp_noid[0].get("id", user_id)
                    user_synced_ok = True
                    print(f"[Supabase Ministry Register] Inserted without explicit id, got id={user_id}.")
                else:
                    print(f"[Supabase Ministry Register] Insert without id also failed HTTP {st_noid}: {resp_noid}.")
                    user_synced_ok = False

        # --- Step 2: Insert/upsert the user_ministry_assignments row ---
        uma_payload = {
            "user_id": user_id,
            "ministry": user_data["ministry"],
            "status": "PENDING",
        }
        st2, resp2 = _supa_request(
            "POST",
            "/rest/v1/user_ministry_assignments",
            json_data=uma_payload,
            prefer="resolution=merge-duplicates,return=minimal"
        )
        uma_synced_ok = st2 in (200, 201, 204)
        if not uma_synced_ok:
            print(f"[Supabase Ministry Register] user_ministry_assignments insert returned HTTP {st2}: {resp2}. "
                  f"Attempting PATCH for user_id={user_id}.")
            # Try PATCH in case the row already exists
            st2p, _ = _supa_request(
                "PATCH",
                f"/rest/v1/user_ministry_assignments?user_id=eq.{user_id}",
                json_data={"ministry": user_data["ministry"], "status": "PENDING"},
                prefer="return=minimal"
            )
            uma_synced_ok = st2p in (200, 204)

        if not user_synced_ok:
            print(f"[Supabase Ministry Register] WARNING: User record for '{user_data['username']}' "
                  f"could not be synced to Supabase. SQLite record is authoritative; "
                  f"additive fallback in get_ministry_requests() will still surface this user to Admin.")

        return user_synced_ok
    except Exception as e:
        print(f"[Supabase Ministry Register Warning] {e}")
        return False


def supa_get_pending_ministry_requests() -> List[Dict[str, Any]]:
    """
    Retrieve all pending Ministry Officer registrations directly from Supabase.
    Includes user_id, full_name, email, username, role, status, assigned_ministry,
    designation, phone, registration_date, clerk_user_id.
    """
    if not is_supabase_auth_ready():
        return []
    try:
        status, users = _supa_request(
            "GET",
            "/rest/v1/users?role=eq.MINISTRY&status=eq.PENDING&order=created_at.desc&select=*"
        )
        if status != 200 or not isinstance(users, list) or not users:
            return []

        user_ids = [str(u["id"]) for u in users if u.get("id")]
        uma_by_user: Dict[int, Dict[str, Any]] = {}
        if user_ids:
            ids_param = ",".join(user_ids)
            st_uma, umas = _supa_request(
                "GET",
                f"/rest/v1/user_ministry_assignments?user_id=in.({ids_param})&select=*"
            )
            if st_uma == 200 and isinstance(umas, list):
                for m in umas:
                    uma_by_user[m["user_id"]] = m

        results = []
        for u in users:
            uid = u["id"]
            uma = uma_by_user.get(uid, {})
            min_name = uma.get("ministry") or ""
            results.append({
                "user_id": uid,
                "id": uid,
                "full_name": u.get("full_name") or "",
                "email": u.get("email") or "",
                "username": u.get("username") or "",
                "role": "MINISTRY",
                "status": "PENDING",
                "assigned_ministry": min_name,
                "ministry": min_name,
                "selected_ministry": min_name,
                "designation": u.get("designation") or "",
                "phone": u.get("phone") or "",
                "registration_date": u.get("created_at") or "",
                "created_at": u.get("created_at") or "",
                "clerk_user_id": u.get("clerk_user_id"),
                "assignment_status": uma.get("status") or "PENDING"
            })
        return results
    except Exception as e:
        print(f"[Supabase Pending Ministry Requests Warning] {e}")
        return []


def supa_get_all_ministry_requests() -> List[Dict[str, Any]]:
    """Retrieve all Ministry Officer registrations (all statuses) from Supabase."""
    if not is_supabase_auth_ready():
        return []
    try:
        status, users = _supa_request(
            "GET",
            "/rest/v1/users?role=eq.MINISTRY&order=created_at.desc&select=*"
        )
        if status != 200 or not isinstance(users, list) or not users:
            return []

        user_ids = [str(u["id"]) for u in users if u.get("id")]
        uma_by_user: Dict[int, Dict[str, Any]] = {}
        if user_ids:
            ids_param = ",".join(user_ids)
            st_uma, umas = _supa_request(
                "GET",
                f"/rest/v1/user_ministry_assignments?user_id=in.({ids_param})&select=*"
            )
            if st_uma == 200 and isinstance(umas, list):
                for m in umas:
                    uma_by_user[m["user_id"]] = m

        results = []
        for u in users:
            uid = u["id"]
            uma = uma_by_user.get(uid, {})
            min_name = uma.get("ministry") or ""
            results.append({
                "user_id": uid,
                "id": uid,
                "full_name": u.get("full_name") or "",
                "email": u.get("email") or "",
                "username": u.get("username") or "",
                "role": "MINISTRY",
                "status": u.get("status") or "PENDING",
                "assigned_ministry": min_name,
                "ministry": min_name,
                "selected_ministry": min_name,
                "designation": u.get("designation") or "",
                "phone": u.get("phone") or "",
                "registration_date": u.get("created_at") or "",
                "created_at": u.get("created_at") or "",
                "clerk_user_id": u.get("clerk_user_id"),
                "assignment_status": uma.get("status") or "PENDING"
            })
        return results
    except Exception as e:
        print(f"[Supabase All Ministry Requests Warning] {e}")
        return []


def supa_approve_ministry_request(user_id: int) -> bool:
    """Transition Ministry user in Supabase from PENDING to APPROVED."""
    if not is_supabase_auth_ready():
        return False
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        st1, _ = _supa_request(
            "PATCH",
            f"/rest/v1/users?id=eq.{user_id}",
            json_data={"status": "APPROVED", "updated_at": now_iso},
            prefer="return=minimal"
        )
        st2, _ = _supa_request(
            "PATCH",
            f"/rest/v1/user_ministry_assignments?user_id=eq.{user_id}",
            json_data={"status": "ACTIVE", "updated_at": now_iso},
            prefer="return=minimal"
        )
        return st1 in (200, 204)
    except Exception as e:
        print(f"[Supabase Approve Ministry Warning] {e}")
        return False


def supa_reject_ministry_request(user_id: int) -> bool:
    """Transition Ministry user in Supabase from PENDING to REJECTED."""
    if not is_supabase_auth_ready():
        return False
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        st1, _ = _supa_request(
            "PATCH",
            f"/rest/v1/users?id=eq.{user_id}",
            json_data={"status": "REJECTED", "updated_at": now_iso},
            prefer="return=minimal"
        )
        st2, _ = _supa_request(
            "PATCH",
            f"/rest/v1/user_ministry_assignments?user_id=eq.{user_id}",
            json_data={"status": "REVOKED", "updated_at": now_iso},
            prefer="return=minimal"
        )
        return st1 in (200, 204)
    except Exception as e:
        print(f"[Supabase Reject Ministry Warning] {e}")
        return False


def supa_suspend_ministry_user(user_id: int) -> bool:
    """Transition Ministry user in Supabase to SUSPENDED."""
    if not is_supabase_auth_ready():
        return False
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        st1, _ = _supa_request(
            "PATCH",
            f"/rest/v1/users?id=eq.{user_id}",
            json_data={"status": "SUSPENDED", "updated_at": now_iso},
            prefer="return=minimal"
        )
        st2, _ = _supa_request(
            "PATCH",
            f"/rest/v1/user_ministry_assignments?user_id=eq.{user_id}",
            json_data={"status": "REVOKED", "updated_at": now_iso},
            prefer="return=minimal"
        )
        return st1 in (200, 204)
    except Exception as e:
        print(f"[Supabase Suspend Ministry Warning] {e}")
        return False


def supa_approve_pm_request(user_id: int) -> bool:
    """Transition PM in Supabase from PENDING to APPROVED."""
    if not is_supabase_auth_ready():
        return False
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        st1, _ = _supa_request(
            "PATCH",
            f"/rest/v1/users?id=eq.{user_id}",
            json_data={"status": "APPROVED", "updated_at": now_iso},
            prefer="return=minimal"
        )
        st2, _ = _supa_request(
            "PATCH",
            f"/rest/v1/project_manager_assignments?user_id=eq.{user_id}",
            json_data={"status": "ACTIVE", "updated_at": now_iso},
            prefer="return=minimal"
        )
        return st1 in (200, 204)
    except Exception as e:
        print(f"[Supabase Approve PM Warning] {e}")
        return False


def supa_reject_pm_request(user_id: int) -> bool:
    """Transition PM in Supabase from PENDING to REJECTED."""
    if not is_supabase_auth_ready():
        return False
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        st1, _ = _supa_request(
            "PATCH",
            f"/rest/v1/users?id=eq.{user_id}",
            json_data={"status": "REJECTED", "updated_at": now_iso},
            prefer="return=minimal"
        )
        st2, _ = _supa_request(
            "PATCH",
            f"/rest/v1/project_manager_assignments?user_id=eq.{user_id}",
            json_data={"status": "REVOKED", "updated_at": now_iso},
            prefer="return=minimal"
        )
        return st1 in (200, 204)
    except Exception as e:
        print(f"[Supabase Reject PM Warning] {e}")
        return False


def supa_suspend_pm_user(user_id: int) -> bool:
    """Transition PM in Supabase to SUSPENDED."""
    if not is_supabase_auth_ready():
        return False
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        st1, _ = _supa_request(
            "PATCH",
            f"/rest/v1/users?id=eq.{user_id}",
            json_data={"status": "SUSPENDED", "updated_at": now_iso},
            prefer="return=minimal"
        )
        # Note: Assignment remains occupied (ACTIVE/PENDING) so project is not released merely due to suspension
        return st1 in (200, 204)
    except Exception as e:
        print(f"[Supabase Suspend PM Warning] {e}")
        return False

