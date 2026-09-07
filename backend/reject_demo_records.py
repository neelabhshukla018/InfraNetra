import os
import sys
import json
import sqlite3
import httpx
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

TEST_PREFIXES = [
    "clerk_min_", "clerk_pm_", "sec_test_", "resp_test_", "test_ux_",
    "e2e_", "pd_", "fake_", "pm_test_", "hacker_", "arb_id_", "test_reg_"
]

def clean_all_demo_users():
    """
    Safely reject/revoke all confirmed synthetic, test, and demo fixtures.
    PRESERVES: Real Admin ('LOG_bit', id=1), real users, infrastructure projects, ML datasets.
    """
    # 1. Load classified candidates if available
    test_usernames = set()
    candidate_file = BASE_DIR / "classified_candidates.json"
    if candidate_file.exists():
        with open(candidate_file, "r", encoding="utf-8") as f:
            candidates = json.load(f)
        for c in candidates:
            if c.get("category") == "TEST_DEMO_CANDIDATE":
                uname = c.get("username", "").strip().lower()
                if uname and uname not in ("log_bit", "admin"):
                    test_usernames.add(uname)

    sqlite_path = BASE_DIR / "infrastructure_projects.sqlite3"
    conn = sqlite3.connect(sqlite_path)
    cur = conn.cursor()

    # Find dynamically created test users by prefix
    cur.execute("SELECT id, username, role, status FROM users WHERE id != 1 AND username NOT IN ('LOG_bit', 'admin');")
    all_users = cur.fetchall()
    
    targeted_user_ids = []
    for uid, uname, role, st in all_users:
        uname_lower = uname.lower()
        is_candidate = uname_lower in test_usernames
        is_pattern = any(uname_lower.startswith(p) for p in TEST_PREFIXES)
        if is_candidate or is_pattern:
            targeted_user_ids.append((uid, uname, role))

    sqlite_rejected = 0
    for uid, uname, role in targeted_user_ids:
        cur.execute("UPDATE users SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (uid,))
        if role == 'MINISTRY':
            cur.execute("UPDATE user_ministry_assignments SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?;", (uid,))
        elif role == 'PROJECT_MANAGER':
            cur.execute("UPDATE project_manager_assignments SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?;", (uid,))
        sqlite_rejected += 1

    conn.commit()
    conn.close()
    print(f"[CLEANUP] SQLite updated: {sqlite_rejected} synthetic test/demo user records transitioned to REJECTED/REVOKED.")

    # 2. Update Supabase if configured
    supa_rejected = 0
    if SUPABASE_URL and SUPABASE_KEY:
        now_iso = datetime.now(timezone.utc).isoformat()
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                for uid, uname, role in targeted_user_ids:
                    r = client.get(f"{SUPABASE_URL}/rest/v1/users?username=ilike.{uname}&select=id,role,status", headers=headers)
                    if r.status_code == 200 and r.json():
                        for u in r.json():
                            sub_id = u["id"]
                            client.patch(
                                f"{SUPABASE_URL}/rest/v1/users?id=eq.{sub_id}",
                                json={"status": "REJECTED", "updated_at": now_iso},
                                headers=headers
                            )
                            if u.get("role") == "MINISTRY":
                                client.patch(
                                    f"{SUPABASE_URL}/rest/v1/user_ministry_assignments?user_id=eq.{sub_id}",
                                    json={"status": "REVOKED", "updated_at": now_iso},
                                    headers=headers
                                )
                            elif u.get("role") == "PROJECT_MANAGER":
                                client.patch(
                                    f"{SUPABASE_URL}/rest/v1/project_manager_assignments?user_id=eq.{sub_id}",
                                    json={"status": "REVOKED", "updated_at": now_iso},
                                    headers=headers
                                )
                            supa_rejected += 1
            print(f"[CLEANUP] Supabase updated: {supa_rejected} records transitioned to REJECTED/REVOKED.")
        except Exception as e:
            print(f"[CLEANUP] Supabase update warning: {e}")
    else:
        print("[CLEANUP] Supabase credentials not configured, skipped.")

    return sqlite_rejected

if __name__ == "__main__":
    clean_all_demo_users()
