"""
InfraNetra Final Admin Login & Profile Sync Verification Suite (Tests 1 - 11)

Validates the combined Admin profile information and authentication flow:
TEST 1: Fill all four profile fields + correct fixed username/password -> login succeeds -> profile saved
TEST 2: After login, profile shows exactly the values entered on the Login Page (Full Name, ADMIN, Designation, Department, Email)
TEST 3: Change Full Name from Profile settings -> profile updates
TEST 4: Change Email from Profile settings -> profile updates
TEST 5: Change Designation/Department -> profile updates
TEST 6: Wrong Admin username/password -> HTTP 401 -> profile NOT updated
TEST 7: Correct profile information + wrong password -> HTTP 401 -> NO profile update
TEST 8: Correct password + wrong username -> HTTP 401 -> NO profile update
TEST 9: Client sends role=ADMIN -> cannot bypass authentication
TEST 10: Exactly one Admin remains in database
TEST 11: ADMIN_PASSWORD is absent from frontend/build artifacts
"""

import os
import sys
import sqlite3
from pathlib import Path
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from main import app

client = TestClient(app)

results = []

def record(test_num: int, title: str, passed: bool, detail: str = ""):
    status_str = "PASS" if passed else "FAIL"
    print(f"[{status_str}] TEST {test_num}: {title}")
    if detail:
        print(f"       Details: {detail}")
    results.append({
        "test_num": test_num,
        "title": title,
        "status": status_str,
        "passed": passed,
        "detail": detail
    })

def run_tests():
    print("=" * 70)
    print("FINAL ADMIN LOGIN & PROFILE SYNC VERIFICATION SUITE (TESTS 1 - 11)")
    print("=" * 70)

    admin_user = os.environ.get("ADMIN_USERNAME", "LOG_bit").strip()
    admin_pass = os.environ.get("ADMIN_PASSWORD", "LOG_bit_26103")

    # --------------------------------------------------------------------------
    # TEST 1: Fill all four profile fields + correct fixed credentials -> 200 + Saved
    # --------------------------------------------------------------------------
    t1_payload = {
        "username": admin_user,
        "password": admin_pass,
        "full_name": "ABC",
        "email": "abc@example.gov.in",
        "designation": "Director",
        "department": "IPMD, MoSPI"
    }
    r1 = client.post("/api/auth/login/admin", json=t1_payload)
    u1 = r1.json().get("user", {}) if r1.status_code == 200 else {}
    t1_pass = (
        r1.status_code == 200 and
        u1.get("full_name") == "ABC" and
        u1.get("email") == "abc@example.gov.in" and
        u1.get("designation") == "Director" and
        u1.get("department") == "IPMD, MoSPI"
    )
    admin_token = r1.json().get("token")
    record(1, "Fill all 4 profile fields + correct fixed credentials -> login succeeds -> fields saved", t1_pass,
           f"HTTP {r1.status_code}, Name: '{u1.get('full_name')}', Email: '{u1.get('email')}'")

    # --------------------------------------------------------------------------
    # TEST 2: After login, authoritative Admin profile reflects exact values entered
    # --------------------------------------------------------------------------
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    me_user = me_res.json().get("user", {}) if me_res.status_code == 200 else {}
    t2_pass = (
        me_res.status_code == 200 and
        me_user.get("full_name") == "ABC" and
        me_user.get("role") == "ADMIN" and
        me_user.get("designation") == "Director" and
        me_user.get("department") == "IPMD, MoSPI" and
        me_user.get("email") == "abc@example.gov.in"
    )
    record(2, "Profile dropdown authoritative sync shows exact values: ABC, ADMIN, Director, IPMD, MoSPI, abc@example.gov.in", t2_pass,
           f"HTTP {me_res.status_code}, Role: {me_user.get('role')}, Desig: {me_user.get('designation')}, Dept: {me_user.get('department')}")

    # --------------------------------------------------------------------------
    # TEST 3: Change Full Name from Profile settings -> updates
    # --------------------------------------------------------------------------
    r3 = client.put("/api/auth/profile", headers={"Authorization": f"Bearer {admin_token}"}, json={
        "full_name": "Dr. Rajesh Kumar Sharma"
    })
    u3 = r3.json().get("user", {}) if r3.status_code == 200 else {}
    t3_pass = (r3.status_code == 200) and (u3.get("full_name") == "Dr. Rajesh Kumar Sharma")
    record(3, "Change Full Name from Profile settings -> profile dropdown updates", t3_pass,
           f"HTTP {r3.status_code}, Updated Name: '{u3.get('full_name')}'")

    # --------------------------------------------------------------------------
    # TEST 4: Change Email from Profile settings -> updates
    # --------------------------------------------------------------------------
    r4 = client.put("/api/auth/profile", headers={"Authorization": f"Bearer {admin_token}"}, json={
        "email": "rajesh.sharma@nic.in"
    })
    u4 = r4.json().get("user", {}) if r4.status_code == 200 else {}
    t4_pass = (r4.status_code == 200) and (u4.get("email") == "rajesh.sharma@nic.in")
    record(4, "Change Email from Profile settings -> profile dropdown updates", t4_pass,
           f"HTTP {r4.status_code}, Updated Email: '{u4.get('email')}'")

    # --------------------------------------------------------------------------
    # TEST 5: Change Designation/Department from Profile settings -> updates
    # --------------------------------------------------------------------------
    r5 = client.put("/api/auth/profile", headers={"Authorization": f"Bearer {admin_token}"}, json={
        "designation": "Joint Secretary & Administrator",
        "department": "Infrastructure & Project Monitoring Division (IPMD), MoSPI"
    })
    u5 = r5.json().get("user", {}) if r5.status_code == 200 else {}
    t5_pass = (
        r5.status_code == 200 and
        u5.get("designation") == "Joint Secretary & Administrator" and
        u5.get("department") == "Infrastructure & Project Monitoring Division (IPMD), MoSPI"
    )
    record(5, "Change Designation/Department -> profile dropdown updates", t5_pass,
           f"HTTP {r5.status_code}, Desig: '{u5.get('designation')}', Dept: '{u5.get('department')}'")

    # Capture current authoritative state in DB before negative tests
    db_path = BACKEND_DIR / "infrastructure_projects.sqlite3"
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT full_name, email, designation, department FROM users WHERE role = 'ADMIN' LIMIT 1;")
    pre_attack_row = dict(cur.fetchone())
    conn.close()

    # --------------------------------------------------------------------------
    # TEST 6: Wrong Admin username/password -> HTTP 401 -> profile NOT updated
    # --------------------------------------------------------------------------
    r6 = client.post("/api/auth/login/admin", json={
        "username": "wrong_admin",
        "password": "wrong_password",
        "full_name": "Hacker Attacker",
        "email": "hacker@evil.com"
    })
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT full_name, email FROM users WHERE role = 'ADMIN' LIMIT 1;")
    post_6_row = dict(cur.fetchone())
    conn.close()
    t6_pass = (r6.status_code == 401) and (post_6_row["full_name"] == pre_attack_row["full_name"])
    record(6, "Wrong Admin username/password -> HTTP 401 -> profile must NOT be updated", t6_pass,
           f"HTTP {r6.status_code}, Stored Name: '{post_6_row['full_name']}' (Unchanged: {post_6_row['full_name'] == pre_attack_row['full_name']})")

    # --------------------------------------------------------------------------
    # TEST 7: Correct profile information + wrong password -> HTTP 401 -> NO update
    # --------------------------------------------------------------------------
    r7 = client.post("/api/auth/login/admin", json={
        "username": admin_user,
        "password": "IncorrectPassword999",
        "full_name": "Fake Name Attempt",
        "email": "fake@attempt.com"
    })
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT full_name, email FROM users WHERE role = 'ADMIN' LIMIT 1;")
    post_7_row = dict(cur.fetchone())
    conn.close()
    t7_pass = (r7.status_code == 401) and (post_7_row["full_name"] == pre_attack_row["full_name"])
    record(7, "Correct profile information + wrong password -> HTTP 401 -> NO profile update", t7_pass,
           f"HTTP {r7.status_code}, Stored Name: '{post_7_row['full_name']}' (Unchanged: {post_7_row['full_name'] == pre_attack_row['full_name']})")

    # --------------------------------------------------------------------------
    # TEST 8: Correct password + wrong username -> HTTP 401 -> NO profile update
    # --------------------------------------------------------------------------
    r8 = client.post("/api/auth/login/admin", json={
        "username": "wrong_username_admin",
        "password": admin_pass,
        "full_name": "Another Fake Name",
        "email": "another@fake.com"
    })
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT full_name, email FROM users WHERE role = 'ADMIN' LIMIT 1;")
    post_8_row = dict(cur.fetchone())
    conn.close()
    t8_pass = (r8.status_code == 401) and (post_8_row["full_name"] == pre_attack_row["full_name"])
    record(8, "Correct password + wrong username -> HTTP 401 -> NO profile update", t8_pass,
           f"HTTP {r8.status_code}, Stored Name: '{post_8_row['full_name']}' (Unchanged: {post_8_row['full_name'] == pre_attack_row['full_name']})")

    # --------------------------------------------------------------------------
    # TEST 9: Client sends role=ADMIN -> cannot bypass authentication
    # --------------------------------------------------------------------------
    r9 = client.post("/api/auth/login/admin", json={
        "username": "unauthorized_user",
        "password": "some_password",
        "role": "ADMIN",
        "is_admin": True,
        "user_id": 1
    })
    t9_pass = (r9.status_code == 401)
    record(9, "Client sends role=ADMIN -> cannot bypass authentication", t9_pass,
           f"HTTP {r9.status_code} (Expected 401)")

    # --------------------------------------------------------------------------
    # TEST 10: Exactly one Admin remains in database
    # --------------------------------------------------------------------------
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS total_admins FROM users WHERE role = 'ADMIN';")
    total_admins = cur.fetchone()["total_admins"]
    conn.close()
    t10_pass = (total_admins == 1)
    record(10, "Exactly one Admin remains in database", t10_pass,
           f"Admin Count: {total_admins} (Expected 1)")

    # --------------------------------------------------------------------------
    # TEST 11: ADMIN_PASSWORD is absent from frontend/build artifacts
    # --------------------------------------------------------------------------
    frontend_dir = PROJECT_ROOT / "src"
    dist_dir = PROJECT_ROOT / "dist"
    public_dir = PROJECT_ROOT / "public"

    found_in_files = []
    for search_dir in [frontend_dir, dist_dir, public_dir]:
        if search_dir.exists():
            for p in search_dir.rglob("*"):
                if p.is_file() and p.suffix in [".ts", ".tsx", ".js", ".jsx", ".html", ".css", ".map", ".json"]:
                    try:
                        content = p.read_text(encoding="utf-8", errors="ignore")
                        if admin_pass in content:
                            found_in_files.append(str(p.relative_to(PROJECT_ROOT)))
                    except Exception:
                        pass
    t11_pass = (len(found_in_files) == 0)
    record(11, "ADMIN_PASSWORD is absent from frontend/build artifacts", t11_pass,
           f"Instances found: {len(found_in_files)}")

    print("=" * 70)
    passed_count = sum(1 for r in results if r["passed"])
    total_count = len(results)
    pct = (passed_count / total_count) * 100.0 if total_count > 0 else 0
    print(f"RESULTS: {passed_count}/{total_count} TESTS PASSED ({pct:.1f}%)")
    print("=" * 70)

    if passed_count != total_count:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
