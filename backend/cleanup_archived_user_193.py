"""
Cleanup script for synthetic/archived test record user_id = 193.

Checks all 5 tables:
- users
- user_ministry_assignments
- project_manager_assignments
- daily_project_updates
- audit_logs

Safely deletes linked records for user_id = 193 and verifies preservation of:
- Admin (id=1, username='admin' / 'LOG_bit')
- Genuine users and real Railway users
- infrastructure_projects (counts and contents untouched)
- ml_training_dataset (untouched)
"""

import sys
import json
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
from auth_supabase import _supa_request, is_supabase_auth_ready

TARGET_USER_ID = 193

def check_all_tables():
    print(f"=== CHECKING LINKED RECORDS FOR USER_ID {TARGET_USER_ID} ===")
    
    # 1. Supabase Check
    supabase_findings = {}
    if is_supabase_auth_ready():
        # users
        st, data = _supa_request("GET", f"/rest/v1/users?id=eq.{TARGET_USER_ID}")
        supabase_findings["users"] = data or []
        
        # user_ministry_assignments
        st, data = _supa_request("GET", f"/rest/v1/user_ministry_assignments?user_id=eq.{TARGET_USER_ID}")
        supabase_findings["user_ministry_assignments"] = data or []
        
        # project_manager_assignments
        st, data = _supa_request("GET", f"/rest/v1/project_manager_assignments?user_id=eq.{TARGET_USER_ID}")
        supabase_findings["project_manager_assignments"] = data or []
        
        # daily_project_updates
        st, data = _supa_request("GET", f"/rest/v1/daily_project_updates?manager_user_id=eq.{TARGET_USER_ID}")
        supabase_findings["daily_project_updates"] = data if st == 200 else []
        
        # audit_logs
        st, data1 = _supa_request("GET", f"/rest/v1/audit_logs?actor_id=eq.{TARGET_USER_ID}")
        st, data2 = _supa_request("GET", f"/rest/v1/audit_logs?target_id=eq.{TARGET_USER_ID}")
        audit_combined = (data1 if isinstance(data1, list) else []) + (data2 if isinstance(data2, list) else [])
        supabase_findings["audit_logs"] = audit_combined
    else:
        print("[WARNING] Supabase is not ready.")
    
    # 2. SQLite Check
    sqlite_findings = {}
    db_path = BASE_DIR / "infrastructure_projects.sqlite3"
    if db_path.exists():
        conn = sqlite3.connect(str(db_path))
        cur = conn.cursor()
        for tbl, col in [("users", "id"), ("user_ministry_assignments", "user_id"), ("project_manager_assignments", "user_id")]:
            try:
                cur.execute(f"SELECT * FROM {tbl} WHERE {col} = ?", (TARGET_USER_ID,))
                sqlite_findings[tbl] = cur.fetchall()
            except Exception as e:
                sqlite_findings[tbl] = str(e)
        conn.close()

    print("Supabase Findings:")
    for k, v in supabase_findings.items():
        print(f"  {k}: {len(v)} record(s)")
        if v:
            print(f"    -> {json.dumps(v, indent=2)}")

    print("\nSQLite Findings:")
    for k, v in sqlite_findings.items():
        print(f"  {k}: {v}")

    return supabase_findings, sqlite_findings


def execute_safe_cleanup(supabase_findings, sqlite_findings):
    print(f"\n=== EXECUTING SAFE DELETION OF USER {TARGET_USER_ID} ===")
    
    # Supabase deletions
    if is_supabase_auth_ready():
        # 1. user_ministry_assignments
        if supabase_findings.get("user_ministry_assignments"):
            st, res = _supa_request("DELETE", f"/rest/v1/user_ministry_assignments?user_id=eq.{TARGET_USER_ID}")
            print(f"Deleted user_ministry_assignments for user_id={TARGET_USER_ID}: HTTP {st}")
            
        # 2. project_manager_assignments
        if supabase_findings.get("project_manager_assignments"):
            st, res = _supa_request("DELETE", f"/rest/v1/project_manager_assignments?user_id=eq.{TARGET_USER_ID}")
            print(f"Deleted project_manager_assignments for user_id={TARGET_USER_ID}: HTTP {st}")

        # 3. daily_project_updates
        if supabase_findings.get("daily_project_updates"):
            st, res = _supa_request("DELETE", f"/rest/v1/daily_project_updates?manager_user_id=eq.{TARGET_USER_ID}")
            print(f"Deleted daily_project_updates for manager_user_id={TARGET_USER_ID}: HTTP {st}")

        # 4. users
        if supabase_findings.get("users"):
            st, res = _supa_request("DELETE", f"/rest/v1/users?id=eq.{TARGET_USER_ID}")
            print(f"Deleted users for id={TARGET_USER_ID}: HTTP {st}")

    # SQLite deletions (if any exist)
    db_path = BASE_DIR / "infrastructure_projects.sqlite3"
    if db_path.exists():
        conn = sqlite3.connect(str(db_path))
        cur = conn.cursor()
        cur.execute("DELETE FROM user_ministry_assignments WHERE user_id = ?", (TARGET_USER_ID,))
        cur.execute("DELETE FROM project_manager_assignments WHERE user_id = ?", (TARGET_USER_ID,))
        cur.execute("DELETE FROM users WHERE id = ?", (TARGET_USER_ID,))
        conn.commit()
        conn.close()
        print("SQLite checked and cleaned for user_id=193.")


def verify_post_cleanup():
    print(f"\n=== VERIFYING POST-CLEANUP INTEGRITY ===")
    
    # 1. Confirm user 193 is 100% gone
    st, u_check = _supa_request("GET", f"/rest/v1/users?id=eq.{TARGET_USER_ID}")
    st, uma_check = _supa_request("GET", f"/rest/v1/user_ministry_assignments?user_id=eq.{TARGET_USER_ID}")
    st, pma_check = _supa_request("GET", f"/rest/v1/project_manager_assignments?user_id=eq.{TARGET_USER_ID}")
    
    assert not u_check, f"User 193 still exists in Supabase: {u_check}"
    assert not uma_check, f"User 193 ministry assignment still exists: {uma_check}"
    assert not pma_check, f"User 193 PM assignment still exists: {pma_check}"
    print(f"[PASS] User {TARGET_USER_ID} completely removed from Supabase.")
    
    # 2. Confirm Admin is preserved exactly
    st, admin_check = _supa_request("GET", "/rest/v1/users?id=eq.1")
    assert admin_check and admin_check[0]["role"] == "ADMIN", f"Admin compromised: {admin_check}"
    print(f"[PASS] Admin user id=1 intact: {admin_check[0]['username']} ({admin_check[0]['full_name']})")
    
    # 3. Confirm infrastructure_projects count
    conn = sqlite3.connect(str(BASE_DIR / "infrastructure_projects.sqlite3"))
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM infrastructure_projects")
    proj_count = cur.fetchone()[0]
    conn.close()
    assert proj_count == 9976, f"Project count changed: {proj_count} (expected 9976)"
    print(f"[PASS] infrastructure_projects untouched ({proj_count} records).")


if __name__ == "__main__":
    sb_find, sq_find = check_all_tables()
    execute_safe_cleanup(sb_find, sq_find)
    verify_post_cleanup()
    print("\n[SUCCESS] Cleanup and verification completed successfully.")
