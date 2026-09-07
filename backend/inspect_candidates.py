import os
import sys
import json
import sqlite3
import httpx
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

def inspect_sqlite():
    db_path = BASE_DIR / "infrastructure_projects.sqlite3"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.username, u.email, u.full_name, u.role, u.status, u.created_at,
               uma.ministry, pma.project_id, pma.status as pm_status
        FROM users u
        LEFT JOIN user_ministry_assignments uma ON u.id = uma.user_id
        LEFT JOIN project_manager_assignments pma ON u.id = pma.user_id
        ORDER BY u.id ASC
    """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

def inspect_supabase():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[WARN] Supabase URL or KEY not set.")
        return []
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    
    # fetch users
    r_u = httpx.get(f"{SUPABASE_URL}/rest/v1/users?select=*&order=id.asc", headers=headers, timeout=15.0)
    users = r_u.json() if r_u.status_code == 200 else []
    
    # fetch user_ministry_assignments
    r_uma = httpx.get(f"{SUPABASE_URL}/rest/v1/user_ministry_assignments?select=*&order=id.asc", headers=headers, timeout=15.0)
    uma_list = r_uma.json() if r_uma.status_code == 200 else []
    uma_map = {uma["user_id"]: uma for uma in uma_list}
    
    # fetch project_manager_assignments
    r_pma = httpx.get(f"{SUPABASE_URL}/rest/v1/project_manager_assignments?select=*&order=id.asc", headers=headers, timeout=15.0)
    pma_list = r_pma.json() if r_pma.status_code == 200 else []
    pma_map = {pma["user_id"]: pma for pma in pma_list}
    
    combined = []
    for u in users:
        uid = u.get("id")
        uma = uma_map.get(uid, {})
        pma = pma_map.get(uid, {})
        combined.append({
            "id": uid,
            "username": u.get("username"),
            "email": u.get("email"),
            "full_name": u.get("full_name"),
            "role": u.get("role"),
            "status": u.get("status"),
            "created_at": u.get("created_at"),
            "ministry": uma.get("ministry"),
            "project_id": pma.get("project_id"),
            "assigned_project_code": pma.get("assigned_project_code"),
            "approval_status": pma.get("approval_status"),
            "clerk_user_id": u.get("clerk_user_id"),
        })
    return combined

if __name__ == "__main__":
    print("=== INSPECTING SQLITE USERS ===")
    sqlite_users = inspect_sqlite()
    print(f"Total SQLite users: {len(sqlite_users)}")
    for u in sqlite_users:
        print(f"ID={u['id']} | user={u['username']} | email={u['email']} | name={u['full_name']} | role={u['role']} | status={u['status']} | ministry={u['ministry']} | proj={u['project_id']}")

    print("\n=== INSPECTING SUPABASE USERS ===")
    supabase_users = inspect_supabase()
    print(f"Total Supabase users: {len(supabase_users)}")
    for u in supabase_users:
        print(f"ID={u['id']} | user={u['username']} | email={u['email']} | name={u['full_name']} | role={u['role']} | status={u['status']} | ministry={u['ministry']} | proj={u['project_id']}")
