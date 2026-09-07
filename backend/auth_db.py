"""
InfraNetra Additive Database Access Module for Authentication, Role Scoping,
Approvals, Project Manager Assignments, and Daily Progress Tracking.
"""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from auth import get_db_connection, hash_password, record_audit_log
from risk_engine import compute_project_risk

BASE_DIR = Path(__file__).resolve().parent


def get_all_ministries() -> List[str]:
    """Retrieve distinct ministries available in the authoritative project dataset."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT ministry
        FROM infrastructure_projects
        WHERE ministry IS NOT NULL AND LENGTH(TRIM(ministry)) > 1
        ORDER BY ministry ASC;
    """)
    rows = [r[0] for r in cur.fetchall()]
    conn.close()
    return rows


def get_authoritative_project(project_id: str) -> Optional[Dict[str, Any]]:
    """
    Authoritative resolution of a project against infrastructure_projects.
    Checks Supabase PostgreSQL as the primary authoritative source.
    Accepts ONLY canonical project_id (e.g. '618934').
    Internal database primary keys (e.g. 33) and non-existent IDs are strictly rejected.
    """
    clean_id = str(project_id or "").strip()
    if not clean_id:
        return None

    # 1. Authoritative Production Source: Supabase PostgreSQL
    try:
        from auth_supabase import is_supabase_auth_ready, supa_get_project_by_id_or_code
        if is_supabase_auth_ready():
            return supa_get_project_by_id_or_code(clean_id)
    except ConnectionError as ce:
        print(f"[Supabase Project Lookup Network Warning] {ce}")
    except Exception as e:
        print(f"[Supabase Project Lookup Warning] {e}")

    # 2. Local fallback ONLY if Supabase was completely unreachable or connection failed
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, project_id, project_name, ministry
        FROM infrastructure_projects
        WHERE project_id = ?
        ORDER BY report_month DESC
        LIMIT 1;
    """, (clean_id,))
    row = cur.fetchone()
    conn.close()
    if row:
        return {
            "canonical_project_id": str(row["project_id"]),
            "database_id": row["id"],
            "project_name": row["project_name"],
            "ministry": row["ministry"],
        }
    return None


def get_project_ministry_and_name(project_id: str) -> Optional[Tuple[str, str]]:
    """Retrieve ministry and project name for a project ID (matches project_id code or integer id)."""
    proj = get_authoritative_project(project_id)
    if proj:
        return proj["ministry"], proj["project_name"]
    return None


def lookup_project_details(project_id: str) -> Optional[Dict[str, Any]]:
    """
    Authoritative server-side project lookup for PM registration and UI feedback.
    Validates against Supabase infrastructure_projects (with SQLite fallback).
    Returns canonical project_id, project_name, owning ministry, approval authority, and active PM status.
    """
    clean_id = str(project_id or "").strip()
    if not clean_id:
        return None

    proj = get_authoritative_project(clean_id)
    if not proj:
        return None

    canonical_pid = proj["canonical_project_id"]
    ministry = proj["ministry"]
    project_name = proj["project_name"]

    # Check whether the project currently has an assigned/registered Project Manager (ACTIVE or PENDING)
    active_pm = None
    try:
        from auth_supabase import is_supabase_auth_ready, get_headers, SUPABASE_URL
        if is_supabase_auth_ready():
            import httpx
            with httpx.Client(timeout=4.0) as client:
                r = client.get(
                    f"{SUPABASE_URL}/rest/v1/project_manager_assignments?project_id=eq.{canonical_pid}&status=in.(ACTIVE,PENDING)&limit=1",
                    headers=get_headers()
                )
                if r.status_code == 200 and r.json():
                    pma = r.json()[0]
                    u_resp = client.get(f"{SUPABASE_URL}/rest/v1/users?id=eq.{pma['user_id']}&select=username&limit=1", headers=get_headers())
                    if u_resp.status_code == 200 and u_resp.json():
                        active_pm = {"username": u_resp.json()[0]["username"]}
    except Exception:
        pass

    if not active_pm:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT u.username
            FROM project_manager_assignments pma
            JOIN users u ON pma.user_id = u.id
            WHERE pma.project_id = ? 
              AND pma.status IN ('ACTIVE', 'PENDING');
        """, (canonical_pid,))
        row = cur.fetchone()
        if row:
            active_pm = {"username": row["username"]}
        conn.close()

    return {
        "found": True,
        "project_found": True,
        "project_id": canonical_pid,
        "canonical_project_id": canonical_pid,
        "database_id": proj["database_id"],
        "project_name": project_name,
        "ministry": ministry,
        "approval_authority": ministry,
        "has_active_pm": bool(active_pm),
        "active_pm_username": active_pm["username"] if active_pm else None
    }



# ==============================================================================
# 1. MINISTRY USER REGISTRATION & APPROVALS
# ==============================================================================

def register_ministry_user(data: Dict[str, Any], ip_address: Optional[str] = None) -> Dict[str, Any]:
    """
    Register a new Ministry user with status PENDING.
    Does NOT grant access immediately; requires Administrator approval.
    """
    username = str(data.get("username") or "").strip()
    full_name = str(data.get("full_name") or "").strip()
    email = str(data.get("email") or "").strip()
    ministry = str(data.get("ministry") or "").strip()
    password = str(data.get("password") or "")
    phone = str(data.get("phone") or "").strip()
    designation = str(data.get("designation") or "").strip()

    if not username or len(username) < 3:
        raise ValueError("Username must be at least 3 characters long.")
    if not full_name:
        raise ValueError("Full Name is required.")
    if not email or "@" not in email:
        raise ValueError("A valid official email is required.")
    if not ministry:
        raise ValueError("Ministry selection is required.")
    if not password or len(password) < 6:
        raise ValueError("Password must be at least 6 characters long.")

    # Validate that the selected ministry exists in the registry
    valid_ministries = get_all_ministries()
    matched_ministry = next((m for m in valid_ministries if m.lower() == ministry.lower()), None)
    if not matched_ministry:
        raise ValueError(f"Ministry '{ministry}' is not recognized in the National Master Registry.")

    conn = get_db_connection()
    cur = conn.cursor()

    # Check for existing username
    cur.execute("SELECT id FROM users WHERE username = ? COLLATE NOCASE;", (username,))
    if cur.fetchone():
        conn.close()
        raise ValueError("Username is already taken. Please choose another username.")

    clerk_user_id = str(data.get("clerk_user_id") or "").strip() or None
    if clerk_user_id:
        cur.execute("SELECT id FROM users WHERE clerk_user_id = ?;", (clerk_user_id,))
        if cur.fetchone():
            conn.close()
            raise ValueError("This Clerk account is already linked to an existing InfraNetra profile.")

    pwd_hash, salt = hash_password(password)

    try:
        with conn:
            cur.execute("""
                INSERT INTO users (
                    username, password_hash, salt, full_name, email,
                    phone, designation, role, status, clerk_user_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'MINISTRY', 'PENDING', ?);
            """, (username, pwd_hash, salt, full_name, email, phone, designation, clerk_user_id))
            user_id = cur.lastrowid

            cur.execute("""
                INSERT INTO user_ministry_assignments (
                    user_id, ministry, status
                ) VALUES (?, ?, 'PENDING');
            """, (user_id, matched_ministry))

        conn.close()

        # Synchronize to Supabase if live
        try:
            from auth_supabase import is_supabase_auth_ready, supa_register_ministry_user, supa_record_audit_log
            if is_supabase_auth_ready():
                supa_register_ministry_user({
                    "username": username,
                    "password_hash": pwd_hash,
                    "salt": salt,
                    "full_name": full_name,
                    "email": email,
                    "phone": phone,
                    "designation": designation,
                    "ministry": matched_ministry,
                    "clerk_user_id": clerk_user_id,
                }, user_id)
                supa_record_audit_log(
                    actor_id=user_id,
                    actor_username=username,
                    actor_role="MINISTRY",
                    action="MINISTRY_REGISTRATION_SUBMITTED",
                    target_type="USER",
                    target_id=str(user_id),
                    details=f"Registration submitted for Ministry: {matched_ministry}. Status: PENDING.",
                    result="SUCCESS",
                    ip_address=ip_address
                )
        except Exception as e:
            print(f"[Supabase Ministry Register Sync Warning] {e}")

        record_audit_log(
            actor_id=user_id,
            actor_username=username,
            actor_role="MINISTRY",
            action="MINISTRY_REGISTRATION_SUBMITTED",
            target_type="USER",
            target_id=str(user_id),
            details=f"Registration submitted for Ministry: {matched_ministry}. Status: PENDING.",
            result="SUCCESS",
            ip_address=ip_address
        )

        return {
            "success": True,
            "message": "Your registration request has been submitted successfully. Your account will remain pending until approved by the authorized administrator.",
            "user_id": user_id,
            "username": username,
            "ministry": matched_ministry,
            "status": "PENDING"
        }
    except Exception as e:
        conn.close()
        raise e


def get_ministry_requests() -> List[Dict[str, Any]]:
    """Retrieve all Ministry user registration requests with status for Admin review.

    Strategy: Supabase is the authoritative source.  However, to guard against the case
    where a newly-registered Ministry user was successfully inserted into SQLite but failed
    to sync to Supabase (e.g. network error, ID conflict), this function uses an additive
    merge: Supabase results are fetched first, then any SQLite-only records are appended
    (de-duplicated by username, case-insensitive).  This ensures the Admin approval queue
    is NEVER silently missing newly-registered users.
    """
    supabase_rows: List[Dict[str, Any]] = []
    supabase_ok = False
    try:
        from auth_supabase import is_supabase_auth_ready, supa_get_all_ministry_requests
        if is_supabase_auth_ready():
            supabase_rows = supa_get_all_ministry_requests() or []
            supabase_ok = True
    except Exception as e:
        print(f"[Supabase Ministry Requests Warning] {e}")

    # Always query SQLite as an additive source
    sqlite_rows: List[Dict[str, Any]] = []
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.id AS user_id, u.username, u.full_name, u.email, u.phone, u.designation,
                   u.status, u.role, u.created_at, u.created_at AS registration_date,
                   u.updated_at, u.clerk_user_id,
                   uma.ministry AS assigned_ministry,
                   uma.ministry AS ministry,
                   uma.ministry AS selected_ministry,
                   uma.status AS assignment_status
            FROM users u
            JOIN user_ministry_assignments uma ON u.id = uma.user_id
            WHERE u.role = 'MINISTRY'
            ORDER BY u.created_at DESC;
        """)
        sqlite_rows = [dict(r) for r in cur.fetchall()]
        conn.close()
    except Exception as e:
        print(f"[SQLite Ministry Requests Warning] {e}")

    if not supabase_ok:
        # Supabase completely unavailable — use SQLite only
        return sqlite_rows

    # Merge: Supabase is authoritative, but add any SQLite records not present in Supabase
    supa_usernames = {(r.get("username") or "").lower() for r in supabase_rows}
    for row in sqlite_rows:
        uname = (row.get("username") or "").lower()
        if uname and uname not in supa_usernames:
            # Normalise to the same shape as supa_get_all_ministry_requests output
            supabase_rows.append({
                "user_id": row["id"],
                "id": row["id"],
                "full_name": row.get("full_name") or "",
                "email": row.get("email") or "",
                "username": row.get("username") or "",
                "role": "MINISTRY",
                "status": row.get("status") or "PENDING",
                "assigned_ministry": row.get("assigned_ministry") or "",
                "ministry": row.get("ministry") or "",
                "selected_ministry": row.get("selected_ministry") or "",
                "designation": row.get("designation") or "",
                "phone": row.get("phone") or "",
                "registration_date": row.get("created_at") or "",
                "created_at": row.get("created_at") or "",
                "clerk_user_id": row.get("clerk_user_id"),
                "assignment_status": row.get("assignment_status") or "PENDING",
                "_source": "sqlite_fallback",  # diagnostic tag, not exposed to UI
            })
            supa_usernames.add(uname)
            print(f"[Ministry Requests] SQLite-only record added for user '{row.get('username')}' (not in Supabase)")

    # Sort newest first
    supabase_rows.sort(key=lambda x: x.get("created_at") or x.get("registration_date") or "", reverse=True)
    return supabase_rows


def approve_ministry_request(user_id: int, admin_user: Dict[str, Any], ip_address: Optional[str] = None) -> Dict[str, Any]:
    """Approve a Ministry user registration request (Admin Only)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, username, status FROM users WHERE id = ? AND role = 'MINISTRY';", (user_id,))
    target = cur.fetchone()
    if not target:
        try:
            from auth_supabase import is_supabase_auth_ready, supa_get_user_by_id
            if is_supabase_auth_ready():
                supa_u = supa_get_user_by_id(user_id)
                if supa_u and supa_u.get("username"):
                    cur.execute("SELECT id, username, status FROM users WHERE username = ? COLLATE NOCASE AND role = 'MINISTRY';", (supa_u["username"],))
                    target = cur.fetchone()
        except Exception as e:
            print(f"[Supabase Approve Fallback Notice] {e}")

    if not target:
        conn.close()
        raise ValueError(f"Ministry user with ID {user_id} not found.")

    sqlite_id = target["id"]
    with conn:
        cur.execute("UPDATE users SET status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (sqlite_id,))
        cur.execute("UPDATE user_ministry_assignments SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?;", (sqlite_id,))

    conn.close()

    # Authoritative Supabase Transition & Audit
    try:
        from auth_supabase import is_supabase_auth_ready, supa_approve_ministry_request, supa_record_audit_log
        if is_supabase_auth_ready():
            supa_approve_ministry_request(user_id)
            supa_record_audit_log(
                actor_id=admin_user["id"],
                actor_username=admin_user["username"],
                actor_role="ADMIN",
                action="APPROVE_MINISTRY_ACCOUNT",
                target_type="USER",
                target_id=str(user_id),
                details=f"Admin {admin_user['username']} approved Ministry user '{target['username']}'.",
                result="SUCCESS",
                ip_address=ip_address
            )
    except Exception as e:
        print(f"[Supabase Approve Ministry Warning] {e}")

    record_audit_log(
        actor_id=admin_user["id"],
        actor_username=admin_user["username"],
        actor_role="ADMIN",
        action="APPROVE_MINISTRY_ACCOUNT",
        target_type="USER",
        target_id=str(user_id),
        details=f"Admin {admin_user['username']} approved Ministry user '{target['username']}'.",
        result="SUCCESS",
        ip_address=ip_address
    )
    return {"success": True, "message": f"Ministry user '{target['username']}' has been approved.", "status": "APPROVED"}


def reject_ministry_request(user_id: int, admin_user: Dict[str, Any], ip_address: Optional[str] = None) -> Dict[str, Any]:
    """Reject a Ministry user registration request (Admin Only)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, username FROM users WHERE id = ? AND role = 'MINISTRY';", (user_id,))
    target = cur.fetchone()
    if not target:
        try:
            from auth_supabase import is_supabase_auth_ready, supa_get_user_by_id
            if is_supabase_auth_ready():
                supa_u = supa_get_user_by_id(user_id)
                if supa_u and supa_u.get("username"):
                    cur.execute("SELECT id, username FROM users WHERE username = ? COLLATE NOCASE AND role = 'MINISTRY';", (supa_u["username"],))
                    target = cur.fetchone()
        except Exception as e:
            print(f"[Supabase Reject Fallback Notice] {e}")

    if not target:
        conn.close()
        raise ValueError(f"Ministry user with ID {user_id} not found.")

    sqlite_id = target["id"]
    with conn:
        cur.execute("UPDATE users SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (sqlite_id,))
        cur.execute("UPDATE user_ministry_assignments SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?;", (sqlite_id,))

    conn.close()

    # Authoritative Supabase Transition & Audit
    try:
        from auth_supabase import is_supabase_auth_ready, supa_reject_ministry_request, supa_record_audit_log
        if is_supabase_auth_ready():
            supa_reject_ministry_request(user_id)
            supa_record_audit_log(
                actor_id=admin_user["id"],
                actor_username=admin_user["username"],
                actor_role="ADMIN",
                action="REJECT_MINISTRY_ACCOUNT",
                target_type="USER",
                target_id=str(user_id),
                details=f"Admin {admin_user['username']} rejected Ministry user '{target['username']}'.",
                result="SUCCESS",
                ip_address=ip_address
            )
    except Exception as e:
        print(f"[Supabase Reject Ministry Warning] {e}")

    record_audit_log(
        actor_id=admin_user["id"],
        actor_username=admin_user["username"],
        actor_role="ADMIN",
        action="REJECT_MINISTRY_ACCOUNT",
        target_type="USER",
        target_id=str(user_id),
        details=f"Admin {admin_user['username']} rejected Ministry user '{target['username']}'.",
        result="SUCCESS",
        ip_address=ip_address
    )
    return {"success": True, "message": f"Ministry user '{target['username']}' has been rejected.", "status": "REJECTED"}


def suspend_ministry_user(user_id: int, admin_user: Dict[str, Any], ip_address: Optional[str] = None) -> Dict[str, Any]:
    """Suspend an active Ministry user account (Admin Only)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, username FROM users WHERE id = ? AND role = 'MINISTRY';", (user_id,))
    target = cur.fetchone()
    if not target:
        try:
            from auth_supabase import is_supabase_auth_ready, supa_get_user_by_id
            if is_supabase_auth_ready():
                supa_u = supa_get_user_by_id(user_id)
                if supa_u and supa_u.get("username"):
                    cur.execute("SELECT id, username FROM users WHERE username = ? COLLATE NOCASE AND role = 'MINISTRY';", (supa_u["username"],))
                    target = cur.fetchone()
        except Exception as e:
            print(f"[Supabase Suspend Fallback Notice] {e}")

    if not target:
        conn.close()
        raise ValueError(f"Ministry user with ID {user_id} not found.")

    sqlite_id = target["id"]
    with conn:
        cur.execute("UPDATE users SET status = 'SUSPENDED', updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (sqlite_id,))
        cur.execute("UPDATE user_ministry_assignments SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?;", (sqlite_id,))

    conn.close()

    # Authoritative Supabase Transition & Audit
    try:
        from auth_supabase import is_supabase_auth_ready, supa_suspend_ministry_user, supa_record_audit_log
        if is_supabase_auth_ready():
            supa_suspend_ministry_user(user_id)
            supa_record_audit_log(
                actor_id=admin_user["id"],
                actor_username=admin_user["username"],
                actor_role="ADMIN",
                action="SUSPEND_MINISTRY_ACCOUNT",
                target_type="USER",
                target_id=str(user_id),
                details=f"Admin {admin_user['username']} suspended Ministry user '{target['username']}'.",
                result="SUCCESS",
                ip_address=ip_address
            )
    except Exception as e:
        print(f"[Supabase Suspend Ministry Warning] {e}")

    record_audit_log(
        actor_id=admin_user["id"],
        actor_username=admin_user["username"],
        actor_role="ADMIN",
        action="SUSPEND_MINISTRY_ACCOUNT",
        target_type="USER",
        target_id=str(user_id),
        details=f"Admin {admin_user['username']} suspended Ministry user '{target['username']}'.",
        result="SUCCESS",
        ip_address=ip_address
    )
    return {"success": True, "message": f"Ministry user '{target['username']}' has been suspended.", "status": "SUSPENDED"}


# ==============================================================================
# 2. PROJECT MANAGER REGISTRATION & APPROVALS
# ==============================================================================

def register_project_manager_user(data: Dict[str, Any], ip_address: Optional[str] = None) -> Dict[str, Any]:
    """
    Register a new Project Manager with status PENDING.
    Enforces that Project ID must exist and cannot have an active manager assigned.
    Derives approving ministry directly from authoritative infrastructure_projects dataset.
    Never trusts client-supplied ministry.
    """
    project_id = str(data.get("project_id") or "").strip()
    username = str(data.get("username") or "").strip()
    full_name = str(data.get("full_name") or "").strip()
    email = str(data.get("email") or "").strip()
    password = str(data.get("password") or "")
    phone = str(data.get("phone") or "").strip()
    designation = str(data.get("designation") or "").strip()

    if not project_id:
        raise ValueError("Project ID is required.")
    if not username or len(username) < 3:
        raise ValueError("Username must be at least 3 characters long.")
    if not full_name:
        raise ValueError("Full Name is required.")
    if not email or "@" not in email:
        raise ValueError("A valid official email is required.")
    if not password or len(password) < 6:
        raise ValueError("Password must be at least 6 characters long.")

    # 1. Verify Project ID exists in authoritative infrastructure_projects table
    # Discard any client-supplied 'ministry' field; server is single source of truth.
    proj = get_authoritative_project(project_id)
    if not proj:
        raise ValueError(f"Project ID '{project_id}' not found in the InfraNetra project registry.")
    ministry = proj["ministry"]
    project_name = proj["project_name"]
    canonical_project_id = proj["canonical_project_id"]

    conn = get_db_connection()
    cur = conn.cursor()

    # 2. Verify username uniqueness
    cur.execute("SELECT id FROM users WHERE username = ? COLLATE NOCASE;", (username,))
    if cur.fetchone():
        conn.close()
        raise ValueError("Username is already taken. Please choose another username.")

    # 3. Check whether the project already has an assigned/registered Project Manager (only one PM per project)
    cur.execute("""
        SELECT u.username
        FROM project_manager_assignments pma
        JOIN users u ON pma.user_id = u.id
        WHERE pma.project_id = ? 
          AND pma.status IN ('ACTIVE', 'PENDING');
    """, (canonical_project_id,))
    existing_pm = cur.fetchone()
    if existing_pm:
        conn.close()
        record_audit_log(
            actor_id=None,
            actor_username=username,
            actor_role="PROJECT_MANAGER",
            action="PM_REGISTRATION_BLOCKED_DUPLICATE",
            target_type="PROJECT",
            target_id=canonical_project_id,
            details=f"Registration blocked: Project '{canonical_project_id}' is already assigned to PM '{existing_pm['username']}'.",
            result="BLOCKED",
            ip_address=ip_address
        )
        raise ValueError("This project already has an assigned Project Manager. Please enter a different Project ID.")

    clerk_user_id = str(data.get("clerk_user_id") or "").strip() or None
    if clerk_user_id:
        cur.execute("SELECT id FROM users WHERE clerk_user_id = ?;", (clerk_user_id,))
        if cur.fetchone():
            conn.close()
            raise ValueError("This Clerk account is already linked to an existing InfraNetra profile.")

    pwd_hash, salt = hash_password(password)

    try:
        with conn:
            cur.execute("""
                INSERT INTO users (
                    username, password_hash, salt, full_name, email,
                    phone, designation, role, status, clerk_user_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PROJECT_MANAGER', 'PENDING', ?);
            """, (username, pwd_hash, salt, full_name, email, phone, designation, clerk_user_id))
            user_id = cur.lastrowid

            cur.execute("""
                INSERT INTO project_manager_assignments (
                    user_id, project_id, status
                ) VALUES (?, ?, 'PENDING');
            """, (user_id, canonical_project_id))
    except sqlite3.IntegrityError:
        try:
            conn.close()
        except Exception:
            pass
        record_audit_log(
            actor_id=None,
            actor_username=username,
            actor_role="PROJECT_MANAGER",
            action="PM_REGISTRATION_BLOCKED_DUPLICATE",
            target_type="PROJECT",
            target_id=canonical_project_id,
            details=f"Registration blocked by unique constraint: Project '{canonical_project_id}' already has a registered or active Project Manager.",
            result="BLOCKED",
            ip_address=ip_address
        )
        raise ValueError("This project already has an assigned Project Manager. Please enter a different Project ID.")
    except Exception as e:
        try:
            conn.close()
        except Exception:
            pass
        raise e

    try:
        conn.close()
    except Exception:
        pass

    # Synchronize to Supabase if live
    try:
        from auth_supabase import is_supabase_auth_ready, get_headers, SUPABASE_URL
        if is_supabase_auth_ready():
            import httpx
            with httpx.Client(timeout=4.0) as client:
                client.post(
                    f"{SUPABASE_URL}/rest/v1/users",
                    json={
                        "id": user_id,
                        "username": username,
                        "password_hash": pwd_hash,
                        "salt": salt,
                        "full_name": full_name,
                        "email": email,
                        "phone": phone or None,
                        "designation": designation or None,
                        "role": "PROJECT_MANAGER",
                        "status": "PENDING",
                        "clerk_user_id": clerk_user_id
                    },
                    headers=get_headers("resolution=merge-duplicates,return=minimal")
                )
                client.post(
                    f"{SUPABASE_URL}/rest/v1/project_manager_assignments",
                    json={
                        "user_id": user_id,
                        "project_id": canonical_project_id,
                        "status": "PENDING"
                    },
                    headers=get_headers("resolution=merge-duplicates,return=minimal")
                )
    except Exception as e:
        print(f"[Supabase PM Sync Warning] {e}")

    record_audit_log(
        actor_id=user_id,
        actor_username=username,
        actor_role="PROJECT_MANAGER",
        action="PM_REGISTRATION_SUBMITTED",
        target_type="PROJECT",
        target_id=canonical_project_id,
        details=f"PM registration submitted by {username} for Project {canonical_project_id} ({project_name}), Derived Ministry: {ministry}. Status: PENDING.",
        result="SUCCESS",
        ip_address=ip_address
    )

    return {
        "success": True,
        "message": "Your registration request has been submitted successfully. Your account will remain pending until approved by the authorized ministry.",
        "user_id": user_id,
        "username": username,
        "project_id": canonical_project_id,
        "ministry": ministry,
        "approving_ministry": ministry,
        "project_name": project_name,
        "status": "PENDING"
    }



def get_pm_requests(ministry_scope: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieve Project Manager registration requests.
    If ministry_scope is provided, filters strictly to projects belonging to that ministry.
    Resolves project_name and ministry from authoritative infrastructure_projects dataset.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.username, u.full_name, u.email, u.phone, u.designation,
               u.status, u.created_at, u.updated_at, u.clerk_user_id,
               pma.project_id, pma.status AS assignment_status
        FROM users u
        JOIN project_manager_assignments pma ON u.id = pma.user_id
        WHERE u.role = 'PROJECT_MANAGER'
        ORDER BY u.created_at DESC;
    """)
    all_rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    results = []
    for r in all_rows:
        pid = str(r.get("project_id") or "").strip()
        proj_info = get_project_ministry_and_name(pid)
        if proj_info:
            r["ministry"] = proj_info[0]
            r["project_name"] = proj_info[1]
        else:
            r["ministry"] = None
            r["project_name"] = None
        r["project_code"] = pid
        results.append(r)

    if ministry_scope:
        norm_scope = ministry_scope.strip().lower()
        return [r for r in results if str(r.get("ministry") or "").strip().lower() == norm_scope]
    return results


def approve_pm_request(user_id: int, actor: Dict[str, Any], ip_address: Optional[str] = None) -> Dict[str, Any]:
    """
    Approve a Project Manager request.
    Verifies that if approver is MINISTRY:
    1. Authenticated user role is MINISTRY and status is APPROVED.
    2. PM registration exists and is PENDING.
    3. PM project exists and project's actual Ministry equals approver's assigned Ministry.
    4. Enforces the single active manager rule at both application and database levels.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT u.id, u.username, u.status, pma.project_id
        FROM users u
        JOIN project_manager_assignments pma ON u.id = pma.user_id
        WHERE u.id = ? AND u.role = 'PROJECT_MANAGER';
    """, (user_id,))
    target = cur.fetchone()
    if not target:
        conn.close()
        raise ValueError(f"Project Manager with ID {user_id} not found.")

    if target["status"] != "PENDING":
        conn.close()
        raise ValueError(f"PM request status is '{target['status']}', expected 'PENDING'.")

    project_id = target["project_id"]
    proj_info = get_project_ministry_and_name(project_id)
    if not proj_info:
        conn.close()
        raise ValueError(f"Project {project_id} not found in the infrastructure project registry.")
    proj_ministry, proj_name = proj_info

    # Enforce Ministry scope if approver is MINISTRY
    if actor.get("role") == "MINISTRY":
        if actor.get("status") != "APPROVED":
            conn.close()
            raise PermissionError("Access Denied: Ministry officer account is not approved.")
        actor_min = str(actor.get("assigned_ministry") or "").strip().lower()
        if actor_min != proj_ministry.strip().lower():
            conn.close()
            raise PermissionError("Access Denied: Not authorized. Ministry users cannot approve managers for projects outside your ministry.")

    # Check for another active manager on this project
    cur.execute("""
        SELECT u.username
        FROM project_manager_assignments pma
        JOIN users u ON pma.user_id = u.id
        WHERE pma.project_id = ? AND pma.status = 'ACTIVE' AND pma.user_id != ?;
    """, (project_id, user_id))
    existing_active = cur.fetchone()
    if existing_active:
        conn.close()
        raise ValueError("This project already has an assigned Project Manager. Please enter a different Project ID.")

    try:
        with conn:
            cur.execute("UPDATE users SET status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (user_id,))
            cur.execute("UPDATE project_manager_assignments SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?;", (user_id,))
    except sqlite3.IntegrityError:
        conn.close()
        raise ValueError("This project already has an assigned Project Manager. Please enter a different Project ID.")

    conn.close()

    action_name = "PM_APPROVED_BY_MINISTRY" if actor.get("role") == "MINISTRY" else "PM_APPROVED_BY_ADMIN"

    # Authoritative Supabase Transition & Audit
    try:
        from auth_supabase import is_supabase_auth_ready, supa_approve_pm_request, supa_record_audit_log
        if is_supabase_auth_ready():
            supa_approve_pm_request(user_id)
            supa_record_audit_log(
                actor_id=actor["id"],
                actor_username=actor["username"],
                actor_role=actor["role"],
                action=action_name,
                target_type="PROJECT",
                target_id=project_id,
                details=f"Approving Ministry: {proj_ministry}, Approver: {actor['username']} ({actor['role']}), Project ID: {project_id}, PM User: {target['username']}, Status: APPROVED.",
                result="SUCCESS",
                ip_address=ip_address
            )
    except Exception as e:
        print(f"[Supabase Approve PM Warning] {e}")

    record_audit_log(
        actor_id=actor["id"],
        actor_username=actor["username"],
        actor_role=actor["role"],
        action=action_name,
        target_type="PROJECT",
        target_id=project_id,
        details=f"Approving Ministry: {proj_ministry}, Approver: {actor['username']} ({actor['role']}), Project ID: {project_id}, PM User: {target['username']}, Status: APPROVED.",
        result="SUCCESS",
        ip_address=ip_address
    )

    return {
        "success": True,
        "message": f"Project Manager '{target['username']}' approved for Project {project_id}.",
        "status": "APPROVED",
        "project_id": project_id,
        "ministry": proj_ministry
    }


def reject_pm_request(user_id: int, actor: Dict[str, Any], ip_address: Optional[str] = None) -> Dict[str, Any]:
    """Reject a Project Manager request (Ministry or Admin)."""
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT u.id, u.username, pma.project_id
        FROM users u
        JOIN project_manager_assignments pma ON u.id = pma.user_id
        WHERE u.id = ? AND u.role = 'PROJECT_MANAGER';
    """, (user_id,))
    target = cur.fetchone()
    if not target:
        conn.close()
        raise ValueError(f"Project Manager with ID {user_id} not found.")

    project_id = target["project_id"]
    proj_info = get_project_ministry_and_name(project_id)
    if proj_info and actor["role"] == "MINISTRY":
        actor_min = str(actor.get("assigned_ministry") or "").strip().lower()
        if actor_min != proj_info[0].strip().lower():
            conn.close()
            raise PermissionError("Ministry users cannot reject managers for projects of another ministry.")

    with conn:
        cur.execute("UPDATE users SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (user_id,))
        cur.execute("UPDATE project_manager_assignments SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?;", (user_id,))

    conn.close()

    # Authoritative Supabase Transition & Audit
    try:
        from auth_supabase import is_supabase_auth_ready, supa_reject_pm_request, supa_record_audit_log
        if is_supabase_auth_ready():
            supa_reject_pm_request(user_id)
            supa_record_audit_log(
                actor_id=actor["id"],
                actor_username=actor["username"],
                actor_role=actor["role"],
                action="REJECT_PM_ACCOUNT",
                target_type="PROJECT",
                target_id=project_id,
                details=f"{actor['role']} {actor['username']} rejected PM '{target['username']}' for Project {project_id}.",
                result="SUCCESS",
                ip_address=ip_address
            )
    except Exception as e:
        print(f"[Supabase Reject PM Warning] {e}")

    record_audit_log(
        actor_id=actor["id"],
        actor_username=actor["username"],
        actor_role=actor["role"],
        action="REJECT_PM_ACCOUNT",
        target_type="PROJECT",
        target_id=project_id,
        details=f"{actor['role']} {actor['username']} rejected PM '{target['username']}' for Project {project_id}.",
        result="SUCCESS",
        ip_address=ip_address
    )
    return {"success": True, "message": f"Project Manager '{target['username']}' rejected.", "status": "REJECTED"}


def suspend_pm_user(user_id: int, actor: Dict[str, Any], ip_address: Optional[str] = None) -> Dict[str, Any]:
    """Suspend a Project Manager account (Admin or responsible Ministry)."""
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT u.id, u.username, pma.project_id
        FROM users u
        JOIN project_manager_assignments pma ON u.id = pma.user_id
        WHERE u.id = ? AND u.role = 'PROJECT_MANAGER';
    """, (user_id,))
    target = cur.fetchone()
    if not target:
        conn.close()
        raise ValueError(f"Project Manager with ID {user_id} not found.")

    project_id = target["project_id"]
    proj_info = get_project_ministry_and_name(project_id)
    if proj_info and actor["role"] == "MINISTRY":
        actor_min = str(actor.get("assigned_ministry") or "").strip().lower()
        if actor_min != proj_info[0].strip().lower():
            conn.close()
            raise PermissionError("Ministry users cannot suspend managers for projects of another ministry.")

    with conn:
        cur.execute("UPDATE users SET status = 'SUSPENDED', updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (user_id,))
        # Note: Assignment remains occupied (ACTIVE/PENDING) so another PM cannot claim this project while PM is suspended

    conn.close()

    # Authoritative Supabase Transition & Audit
    try:
        from auth_supabase import is_supabase_auth_ready, supa_suspend_pm_user, supa_record_audit_log
        if is_supabase_auth_ready():
            supa_suspend_pm_user(user_id)
            supa_record_audit_log(
                actor_id=actor["id"],
                actor_username=actor["username"],
                actor_role=actor["role"],
                action="SUSPEND_PM_ACCOUNT",
                target_type="PROJECT",
                target_id=project_id,
                details=f"{actor['role']} {actor['username']} suspended PM '{target['username']}' for Project {project_id}.",
                result="SUCCESS",
                ip_address=ip_address
            )
    except Exception as e:
        print(f"[Supabase Suspend PM Warning] {e}")

    record_audit_log(
        actor_id=actor["id"],
        actor_username=actor["username"],
        actor_role=actor["role"],
        action="SUSPEND_PM_ACCOUNT",
        target_type="PROJECT",
        target_id=project_id,
        details=f"{actor['role']} {actor['username']} suspended PM '{target['username']}' for Project {project_id}.",
        result="SUCCESS",
        ip_address=ip_address
    )
    return {"success": True, "message": f"Project Manager '{target['username']}' suspended.", "status": "SUSPENDED"}


# ==============================================================================
# 3. CONTROLLED DAILY PROJECT UPDATES
# ==============================================================================

def submit_daily_project_update(user: Dict[str, Any], update_data: Dict[str, Any], ip_address: Optional[str] = None) -> Dict[str, Any]:
    """
    Submit daily physical progress and expenditure update.
    Enforces strict project assignment access control:
    - Project Manager can ONLY update their assigned project.
    - Updates infrastructure_projects physical_progress & expenditure for latest snapshot.
    - Automatically re-evaluates project risk using deterministic multi-criteria Risk Engine.
    - Records immutable security audit record.
    """
    if user["role"] == "PROJECT_MANAGER":
        project_id = str(user.get("assigned_project_id") or "").strip()
        body_pid = str(update_data.get("project_id") or "").strip()
        if body_pid and body_pid != project_id:
            auth_meta = get_authoritative_project(body_pid)
            if not auth_meta or str(auth_meta.get("canonical_project_id")).strip() != project_id:
                raise PermissionError(f"Access Denied: You are assigned to project '{project_id}' and cannot update project '{body_pid}'.")
        if not project_id:
            raise PermissionError("No assigned project found for this Project Manager account.")
    elif user["role"] == "ADMIN":
        project_id = str(update_data.get("project_id") or "").strip()
        if not project_id:
            raise ValueError("Project ID is required for administrative updates.")
    else:
        raise PermissionError("Only authorized Project Managers or Administrators can submit daily updates.")

    # Parse and validate update fields
    update_date = str(update_data.get("update_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")).strip()
    today_progress = float(update_data.get("today_physical_progress") or 0.0)
    cumulative_progress = float(update_data.get("cumulative_physical_progress") or 0.0)
    today_expenditure = float(update_data.get("today_expenditure") if update_data.get("today_expenditure") is not None else (update_data.get("today_expenditure_cr") or 0.0))
    cumulative_expenditure = float(update_data.get("cumulative_expenditure") if update_data.get("cumulative_expenditure") is not None else (update_data.get("cumulative_expenditure_cr") or 0.0))

    milestone_status = str(update_data.get("milestone_status") or "").strip()
    current_milestone = str(update_data.get("current_milestone") or "").strip()
    target_completion = str(update_data.get("target_completion_date") or "").strip()
    issues_risks = str(update_data.get("issues_risks") or "").strip()
    remarks = str(update_data.get("remarks") or "").strip()

    if cumulative_progress < 0.0 or cumulative_progress > 100.0:
        raise ValueError("Cumulative physical progress must be between 0.0% and 100.0%.")
    if cumulative_expenditure < 0.0:
        raise ValueError("Cumulative expenditure cannot be negative.")

    conn = get_db_connection()
    cur = conn.cursor()

    # Insert into daily_project_updates
    with conn:
        cur.execute("""
            INSERT INTO daily_project_updates (
                project_id, manager_user_id, update_date,
                today_physical_progress, cumulative_physical_progress,
                today_expenditure, cumulative_expenditure,
                milestone_status, current_milestone, target_completion_date,
                issues_risks, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            project_id, user["id"], update_date,
            today_progress, cumulative_progress,
            today_expenditure, cumulative_expenditure,
            milestone_status, current_milestone, target_completion,
            issues_risks, remarks
        ))
        update_id = cur.lastrowid

        # Update physical progress & expenditure for the latest report month snapshot in infrastructure_projects
        cur.execute("""
            SELECT report_month, original_cost, revised_cost, original_completion_date, revised_completion_date
            FROM infrastructure_projects
            WHERE project_id = ?
            ORDER BY report_month DESC
            LIMIT 1;
        """, (project_id,))
        latest_snap = cur.fetchone()

        if latest_snap:
            latest_month = latest_snap["report_month"]
            cur.execute("""
                UPDATE infrastructure_projects
                SET physical_progress = ?,
                    expenditure = ?
                WHERE project_id = ? AND report_month = ?;
            """, (cumulative_progress, cumulative_expenditure, project_id, latest_month))

    # Fetch updated project and previous snapshot for deterministic risk recalculation
    cur.execute("""
        SELECT * FROM infrastructure_projects
        WHERE project_id = ?
        ORDER BY report_month DESC
        LIMIT 2;
    """, (project_id,))
    snapshots = [dict(r) for r in cur.fetchall()]
    conn.close()

    current_snap = snapshots[0] if snapshots else {}
    prev_snap = snapshots[1] if len(snapshots) > 1 else None
    prev_param = {"physical_progress": prev_snap.get("physical_progress")} if prev_snap else None

    # Deterministic Risk Engine recalculation (System Generated - NOT editable by PM)
    recalculated_risk = compute_project_risk(current_snap, prev_param)

    record_audit_log(
        actor_id=user["id"],
        actor_username=user["username"],
        actor_role=user["role"],
        action="SUBMIT_DAILY_PROJECT_UPDATE",
        target_type="PROJECT",
        target_id=project_id,
        details=f"Update ID {update_id}: Progress {cumulative_progress}%, Exp Rs. {cumulative_expenditure} Cr. Recalculated Risk: {recalculated_risk['score']}/100 ({recalculated_risk['level']}).",
        result="SUCCESS",
        ip_address=ip_address
    )

    res_dict = {
        "success": True,
        "update_id": update_id,
        "project_id": project_id,
        "update_date": update_date,
        "cumulative_physical_progress": cumulative_progress,
        "cumulative_expenditure": cumulative_expenditure,
        "recalculated_overall_risk": recalculated_risk["score"],
        "recalculated_risk_tier": recalculated_risk["level"],
        "recalculated_risk": recalculated_risk,
        "message": "Daily project update submitted successfully. Risk scores updated via deterministic risk engine."
    }
    return {
        **res_dict,
        "update": res_dict
    }


def get_daily_project_updates(project_id: str, requesting_user: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Retrieve historical daily updates strictly for the authorized project.
    Enforces that Project Manager can only view their own project's history.
    """
    pid = str(project_id).strip()

    if requesting_user["role"] == "PROJECT_MANAGER":
        assigned_pid = str(requesting_user.get("assigned_project_id") or "").strip()
        if assigned_pid != pid:
            raise PermissionError(f"Access Denied: You cannot view daily update history for project '{pid}'.")
    elif requesting_user["role"] == "MINISTRY":
        proj_info = get_project_ministry_and_name(pid)
        if proj_info:
            user_min = str(requesting_user.get("assigned_ministry") or "").strip().lower()
            if user_min != proj_info[0].strip().lower():
                raise PermissionError("Access Denied: Project does not belong to your ministry.")

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT d.id, d.project_id, d.update_date,
               d.today_physical_progress, d.cumulative_physical_progress,
               d.today_expenditure, d.cumulative_expenditure,
               d.milestone_status, d.current_milestone, d.target_completion_date,
               d.issues_risks, d.remarks, d.created_at,
               u.full_name AS manager_name, u.username AS manager_username
        FROM daily_project_updates d
        JOIN users u ON d.manager_user_id = u.id
        WHERE d.project_id = ?
        ORDER BY d.update_date DESC, d.created_at DESC;
    """, (pid,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


# ==============================================================================
# 4. AUDIT LOG RETRIEVAL
# ==============================================================================

def get_audit_logs_list(limit: int = 150) -> List[Dict[str, Any]]:
    """Retrieve authoritative audit trail (Administrator Only)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, actor_id, actor_username, actor_role, action,
               target_type, target_id, details, ip_address, timestamp, result
        FROM audit_logs
        ORDER BY timestamp DESC
        LIMIT ?;
    """, (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


# ==============================================================================
# 5. MINISTRY PROJECT CREATION & OPTIONAL PM ASSIGNMENT
# ==============================================================================

def create_new_project(
    creator: Dict[str, Any],
    data: Dict[str, Any],
    ip_address: Optional[str] = None
) -> Dict[str, Any]:
    """
    Ministry creates a new Infrastructure Project (and optionally assigns a PM).
    Enforces that Ministry is derived server-side from creator account.
    Client cannot fake ministry ownership.
    If assign_pm is requested, creates PM with status PENDING.
    """
    creator_role = creator.get("role")
    if creator_role not in ("ADMIN", "MINISTRY"):
        raise PermissionError("Only Ministry officers or Administrators can create projects.")

    if creator_role == "MINISTRY":
        ministry = str(creator.get("assigned_ministry") or "").strip()
        if not ministry:
            raise PermissionError("Ministry account is not assigned to a valid Ministry.")
    else:
        ministry = str(data.get("ministry") or "").strip()
        if not ministry:
            raise ValueError("Ministry name is required when created by Administrator.")

    project_name = str(data.get("project_name") or "").strip()
    if not project_name:
        raise ValueError("Project name is required.")

    # Canonical Project ID: client provided or generated
    project_id = str(data.get("project_id") or "").strip()
    assign_pm = bool(data.get("assign_pm"))
    conn = get_db_connection()
    cur = conn.cursor()

    if project_id:
        # Check if project already has an assigned PM or is occupied
        if assign_pm:
            cur.execute("""
                SELECT u.username
                FROM project_manager_assignments pma
                JOIN users u ON pma.user_id = u.id
                WHERE pma.project_id = ? AND pma.status IN ('ACTIVE', 'PENDING');
            """, (project_id,))
            existing_pm = cur.fetchone()
            if existing_pm:
                conn.close()
                raise ValueError("This project already has an assigned Project Manager. Please enter a different Project ID.")

        # Check if project already exists
        cur.execute("SELECT id FROM infrastructure_projects WHERE project_id = ? LIMIT 1;", (project_id,))
        if cur.fetchone():
            conn.close()
            raise ValueError(f"Project with ID '{project_id}' already exists.")
    else:
        # Generate a unique 6-digit canonical project code
        import random
        for _ in range(20):
            cand_id = str(random.randint(900000, 999999))
            cur.execute("SELECT id FROM infrastructure_projects WHERE project_id = ? LIMIT 1;", (cand_id,))
            if not cur.fetchone():
                project_id = cand_id
                break
        if not project_id:
            conn.close()
            raise ValueError("Could not generate a unique project ID.")

    sector = str(data.get("sector") or "Infrastructure").strip()
    state = str(data.get("state") or "Central").strip()
    agency = str(data.get("agency") or ministry).strip()
    start_date = str(data.get("start_date") or "").strip() or None
    orig_comp_date = str(data.get("original_completion_date") or data.get("target_completion_date") or "").strip() or None
    rev_comp_date = str(data.get("revised_completion_date") or orig_comp_date or "").strip() or None
    orig_cost = float(data.get("original_cost") or data.get("approved_cost") or 0.0)
    rev_cost = float(data.get("revised_cost") or orig_cost)
    from db import get_latest_report_month
    latest_month = get_latest_report_month() or "2026-07-01"
    report_month = str(data.get("report_month") or latest_month).strip()

    with conn:
        cur.execute("""
            INSERT INTO infrastructure_projects (
                project_id, project_name, agency, ministry, sector, state,
                start_date, original_completion_date, revised_completion_date,
                original_cost, revised_cost, expenditure, physical_progress,
                report_month, source_section
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, 0.0, ?, 'Ministry Created');
        """, (
            project_id, project_name, agency, ministry, sector, state,
            start_date, orig_comp_date, rev_comp_date,
            orig_cost, rev_cost, report_month
        ))
        db_id = cur.lastrowid

    # Sync project to Supabase if configured
    try:
        from auth_supabase import is_supabase_auth_ready, get_headers, SUPABASE_URL
        if is_supabase_auth_ready():
            import httpx
            with httpx.Client(timeout=4.0) as client:
                client.post(
                    f"{SUPABASE_URL}/rest/v1/infrastructure_projects",
                    json={
                        "project_id": project_id,
                        "project_name": project_name,
                        "agency": agency,
                        "ministry": ministry,
                        "sector": sector,
                        "state": state,
                        "start_date": start_date,
                        "original_completion_date": orig_comp_date,
                        "revised_completion_date": rev_comp_date,
                        "original_cost": orig_cost,
                        "revised_cost": rev_cost,
                        "expenditure": 0.0,
                        "physical_progress": 0.0,
                        "report_month": report_month,
                        "source_section": "Ministry Created"
                    },
                    headers=get_headers("resolution=merge-duplicates,return=minimal")
                )
    except Exception as e:
        print(f"[Supabase Project Creation Sync Warning] {e}")

    # Optional PM assignment
    assign_pm = bool(data.get("assign_pm"))
    pm_user_res = None

    if assign_pm:
        pm_username = str(data.get("pm_username") or "").strip()
        pm_full_name = str(data.get("pm_full_name") or "").strip()
        pm_email = str(data.get("pm_email") or "").strip()
        pm_password = str(data.get("pm_password") or "")
        pm_phone = str(data.get("pm_phone") or "").strip() or None
        pm_designation = str(data.get("pm_designation") or "Project Manager").strip() or None

        if not pm_username or len(pm_username) < 3:
            conn.close()
            raise ValueError("PM username must be at least 3 characters long.")
        if not pm_full_name:
            conn.close()
            raise ValueError("PM full name is required.")
        if not pm_email or "@" not in pm_email:
            conn.close()
            raise ValueError("A valid PM email address is required.")
        if not pm_password or len(pm_password) < 6:
            conn.close()
            raise ValueError("PM password must be at least 6 characters long.")

        # Check if project already has an active or pending PM assigned
        cur.execute("""
            SELECT u.username
            FROM project_manager_assignments pma
            JOIN users u ON pma.user_id = u.id
            WHERE pma.project_id = ? AND pma.status IN ('ACTIVE', 'PENDING');
        """, (project_id,))
        existing_pm = cur.fetchone()
        if existing_pm:
            conn.close()
            raise ValueError("This project already has an assigned Project Manager. Please enter a different Project ID.")

        cur.execute("SELECT id FROM users WHERE username = ? COLLATE NOCASE;", (pm_username,))
        if cur.fetchone():
            conn.close()
            raise ValueError(f"Username '{pm_username}' is already taken.")

        pwd_hash, salt = hash_password(pm_password)
        try:
            with conn:
                cur.execute("""
                    INSERT INTO users (
                        username, password_hash, salt, full_name, email,
                        phone, designation, role, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PROJECT_MANAGER', 'PENDING');
                """, (pm_username, pwd_hash, salt, pm_full_name, pm_email, pm_phone, pm_designation))
                pm_uid = cur.lastrowid

                cur.execute("""
                    INSERT INTO project_manager_assignments (
                        user_id, project_id, status
                    ) VALUES (?, ?, 'PENDING');
                """, (pm_uid, project_id))
        except sqlite3.IntegrityError:
            conn.close()
            raise ValueError("This project already has an assigned Project Manager. Please enter a different Project ID.")

        pm_user_res = {
            "user_id": pm_uid,
            "username": pm_username,
            "email": pm_email,
            "full_name": pm_full_name,
            "status": "PENDING"
        }

        # Sync PM to Supabase
        try:
            from auth_supabase import is_supabase_auth_ready, get_headers, SUPABASE_URL
            if is_supabase_auth_ready():
                import httpx
                with httpx.Client(timeout=4.0) as client:
                    client.post(
                        f"{SUPABASE_URL}/rest/v1/users",
                        json={
                            "id": pm_uid,
                            "username": pm_username,
                            "password_hash": pwd_hash,
                            "salt": salt,
                            "full_name": pm_full_name,
                            "email": pm_email,
                            "phone": pm_phone,
                            "designation": pm_designation,
                            "role": "PROJECT_MANAGER",
                            "status": "PENDING",
                        },
                        headers=get_headers("resolution=merge-duplicates,return=minimal")
                    )
                    client.post(
                        f"{SUPABASE_URL}/rest/v1/project_manager_assignments",
                        json={
                            "user_id": pm_uid,
                            "project_id": project_id,
                            "status": "PENDING"
                        },
                        headers=get_headers("resolution=merge-duplicates,return=minimal")
                    )
        except Exception as e:
            print(f"[Supabase PM Sync Warning] {e}")

    conn.close()

    action_name = "PROJECT_CREATED_WITH_PM_ASSIGNMENT" if assign_pm else "PROJECT_CREATED"
    details_str = f"Project '{project_name}' (ID: {project_id}) created under Ministry '{ministry}' by {creator['username']} ({creator['role']})."
    if assign_pm:
        details_str += f" Assigned PM '{data.get('pm_username')}' (PENDING approval)."

    record_audit_log(
        actor_id=creator["id"],
        actor_username=creator["username"],
        actor_role=creator["role"],
        action=action_name,
        target_type="PROJECT",
        target_id=project_id,
        details=details_str,
        result="SUCCESS",
        ip_address=ip_address
    )

    created_proj = {
        "id": db_id,
        "project_id": project_id,
        "project_name": project_name,
        "agency": agency,
        "ministry": ministry,
        "sector": sector,
        "state": state,
        "original_cost": orig_cost,
        "revised_cost": rev_cost,
        "start_date": start_date,
        "original_completion_date": orig_comp_date,
        "report_month": report_month,
        "status": "Ongoing"
    }

    return {
        "success": True,
        "message": f"Project '{project_name}' successfully created under {ministry}.",
        "project": created_proj,
        "pm_user": pm_user_res
    }
