"""
InfraNetra Verification Suite: PM Ministry-Scoping & Approval Authorization Tests (Tests 1 - 10)
Validates that PM requests are strictly scoped to the Project's authoritative Ministry,
Ministry users cannot cross-approve or view other ministries' PM requests,
Admin can oversee all, fake ministry submissions are discarded, and 1-project-1-PM is strictly enforced.
"""

import os
import sys
import sqlite3
import json
from fastapi.testclient import TestClient

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

from main import app
from auth import hash_password, create_session_token, get_db_connection

client = TestClient(app)

results = []

def record(test_num: int, title: str, passed: bool, detail: str = ""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] TEST {test_num}: {title}")
    if detail:
        print(f"       {detail}")
    results.append({
        "test_num": test_num,
        "title": title,
        "status": status,
        "passed": passed,
        "detail": detail,
    })


def run_tests():
    print("=" * 75)
    print("INFRANETRA PM APPROVAL SCOPING TEST SUITE (TESTS 1 - 10)")
    print("=" * 75)

    conn = get_db_connection()
    cur = conn.cursor()

    # Find Project A (MoRTH / Road) and Project B (Railways)
    cur.execute("SELECT id, project_id, ministry, project_name FROM infrastructure_projects WHERE report_month='2026-04-01' AND LOWER(ministry) LIKE '%road%' LIMIT 1")
    row_a = cur.fetchone()
    if not row_a:
        cur.execute("SELECT id, project_id, ministry, project_name FROM infrastructure_projects WHERE LOWER(ministry) LIKE '%road%' LIMIT 1")
        row_a = cur.fetchone()

    cur.execute("SELECT id, project_id, ministry, project_name FROM infrastructure_projects WHERE report_month='2026-04-01' AND LOWER(ministry) LIKE '%rail%' LIMIT 1")
    row_b = cur.fetchone()
    if not row_b:
        cur.execute("SELECT id, project_id, ministry, project_name FROM infrastructure_projects WHERE LOWER(ministry) LIKE '%rail%' LIMIT 1")
        row_b = cur.fetchone()

    proj_a_id = row_a["id"]
    proj_a_code = row_a["project_id"]
    proj_a_min = row_a["ministry"]
    proj_a_name = row_a["project_name"]

    proj_b_id = row_b["id"]
    proj_b_code = row_b["project_id"]
    proj_b_min = row_b["ministry"]
    proj_b_name = row_b["project_name"]

    print(f"Project A (Ministry A): Code={proj_a_code} (ID={proj_a_id}) -> '{proj_a_min}'")
    print(f"Project B (Ministry B): Code={proj_b_code} (ID={proj_b_id}) -> '{proj_b_min}'")
    print("-" * 75)

    # Clean up any test users and orphaned assignment records
    test_usernames = [
        "pm_scope_test_user1", "pm_scope_test_user2", "pm_scope_test_user3",
        "min_officer_a", "min_officer_b"
    ]
    cur.execute(f"DELETE FROM users WHERE username IN ({','.join(['?']*len(test_usernames))})", test_usernames)
    cur.execute("DELETE FROM project_manager_assignments WHERE user_id NOT IN (SELECT id FROM users)")
    cur.execute("DELETE FROM user_ministry_assignments WHERE user_id NOT IN (SELECT id FROM users)")
    conn.commit()

    # Create Ministry Officer A (MoRTH), Ministry Officer B (Railways)
    pwd_hash, salt = hash_password("Password@123")
    
    # Min Officer A
    cur.execute("""
        INSERT INTO users (username, password_hash, salt, full_name, email, role, status)
        VALUES ('min_officer_a', ?, ?, 'Officer A', 'officer.a@morth.gov.in', 'MINISTRY', 'APPROVED');
    """, (pwd_hash, salt))
    min_a_uid = cur.lastrowid
    cur.execute("INSERT INTO user_ministry_assignments (user_id, ministry, status) VALUES (?, ?, 'ACTIVE');", (min_a_uid, proj_a_min))

    # Min Officer B
    cur.execute("""
        INSERT INTO users (username, password_hash, salt, full_name, email, role, status)
        VALUES ('min_officer_b', ?, ?, 'Officer B', 'officer.b@railways.gov.in', 'MINISTRY', 'APPROVED');
    """, (pwd_hash, salt))
    min_b_uid = cur.lastrowid
    cur.execute("INSERT INTO user_ministry_assignments (user_id, ministry, status) VALUES (?, ?, 'ACTIVE');", (min_b_uid, proj_b_min))

    # Use existing single authoritative Admin User
    cur.execute("SELECT id, username FROM users WHERE role = 'ADMIN' LIMIT 1")
    admin_row = cur.fetchone()
    if admin_row:
        admin_uid = admin_row["id"]
        admin_username = admin_row["username"]
    else:
        cur.execute("""
            INSERT INTO users (username, password_hash, salt, full_name, email, role, status)
            VALUES ('admin_tester', ?, ?, 'System Admin', 'admin@mospi.gov.in', 'ADMIN', 'APPROVED');
        """, (pwd_hash, salt))
        admin_uid = cur.lastrowid
        admin_username = 'admin_tester'
        test_usernames.append('admin_tester')

    conn.commit()
    conn.close()

    token_min_a = create_session_token(min_a_uid, "min_officer_a", "MINISTRY")
    token_min_b = create_session_token(min_b_uid, "min_officer_b", "MINISTRY")
    token_admin = create_session_token(admin_uid, admin_username, "ADMIN")

    # =========================================================================
    # TEST 1: PM enters valid Project ID -> Correct Ministry automatically derived.
    # =========================================================================
    pm1_uid = None
    try:
        reg_res = client.post("/api/auth/register/pm", json={
            "project_id": proj_a_code,
            "username": "pm_scope_test_user1",
            "full_name": "Test PM One",
            "email": "pm1@infra.gov.in",
            "password": "Password@123",
            "phone": "9876543210",
            "designation": "Executive Engineer"
        })
        data = reg_res.json()
        pm1_uid = data.get("user_id")
        passed = (
            reg_res.status_code == 201 and
            data.get("ministry") == proj_a_min and
            data.get("approving_ministry") == proj_a_min and
            data.get("status") == "PENDING"
        )
        record(1, "PM enters valid Project ID -> Correct Ministry automatically derived", passed,
               f"HTTP {reg_res.status_code}, Derived Ministry: '{data.get('ministry')}' (Expected: '{proj_a_min}')")
    except Exception as e:
        record(1, "PM enters valid Project ID -> Correct Ministry automatically derived", False, str(e))

    # =========================================================================
    # TEST 2: PM attempts to submit fake ministry -> Server ignores/rejects fake ministry.
    # =========================================================================
    pm2_uid = None
    try:
        reg_res2 = client.post("/api/auth/register/pm", json={
            "project_id": proj_a_code,
            "username": "pm_scope_test_user2",
            "full_name": "Malicious PM",
            "email": "pm2@fake.gov.in",
            "password": "Password@123",
            "ministry": "Completely Fake Nonexistent Ministry", # Malicious client override attempt
            "approving_ministry": "Ministry of Coal"
        })
        data2 = reg_res2.json()
        pm2_uid = data2.get("user_id")
        passed = (
            reg_res2.status_code == 201 and
            data2.get("ministry") == proj_a_min and # Must be authoritative MoRTH, NOT fake
            data2.get("approving_ministry") == proj_a_min
        )
        record(2, "PM attempts to submit fake ministry -> Server ignores fake ministry and uses authoritative project ministry", passed,
               f"HTTP {reg_res2.status_code}, Assigned Ministry: '{data2.get('ministry')}'")
    except Exception as e:
        record(2, "PM attempts to submit fake ministry -> Server ignores fake ministry", False, str(e))

    # =========================================================================
    # TEST 3: Ministry A sees PM request for Ministry A project.
    # =========================================================================
    try:
        queue_res = client.get("/api/ministry/managers/pending", headers={"Authorization": f"Bearer {token_min_a}"})
        reqs = queue_res.json().get("requests", [])
        pm1_present = any(r["username"] == "pm_scope_test_user1" for r in reqs)
        all_match_a = all(r.get("ministry") == proj_a_min for r in reqs)
        passed = (queue_res.status_code == 200) and pm1_present and all_match_a
        record(3, "Ministry A sees PM request for Ministry A project in queue", passed,
               f"HTTP {queue_res.status_code}, PM1 in Queue: {pm1_present}, All requests match Ministry A: {all_match_a}")
    except Exception as e:
        record(3, "Ministry A sees PM request for Ministry A project in queue", False, str(e))

    # =========================================================================
    # TEST 4: Ministry B tries to see/approve Ministry A PM request -> 403 Forbidden.
    # =========================================================================
    try:
        # 1. Ministry B checks queue -> PM1 must NOT be in Ministry B queue
        queue_b = client.get("/api/ministry/managers/pending", headers={"Authorization": f"Bearer {token_min_b}"})
        reqs_b = queue_b.json().get("requests", [])
        pm1_in_b = any(r["username"] == "pm_scope_test_user1" for r in reqs_b)

        # 2. Ministry B explicitly attempts to approve PM1 (Project A) -> Must return 403
        appr_b = client.post(f"/api/ministry/managers/{pm1_uid}/approve", headers={"Authorization": f"Bearer {token_min_b}"})
        passed = (queue_b.status_code == 200) and (not pm1_in_b) and (appr_b.status_code == 403)
        record(4, "Ministry B tries to see/approve Ministry A PM request -> 403 Forbidden", passed,
               f"PM1 in Ministry B Queue: {pm1_in_b} (False expected), Cross-Ministry Approve HTTP {appr_b.status_code} (403 expected)")
    except Exception as e:
        record(4, "Ministry B tries to see/approve Ministry A PM request -> 403 Forbidden", False, str(e))

    # =========================================================================
    # TEST 5: Admin sees PM request from any Ministry.
    # =========================================================================
    try:
        admin_queue = client.get("/api/admin/managers/requests", headers={"Authorization": f"Bearer {token_admin}"})
        admin_reqs = admin_queue.json().get("requests", [])
        pm1_in_admin = any(r["username"] == "pm_scope_test_user1" for r in admin_reqs)
        passed = (admin_queue.status_code == 200) and pm1_in_admin
        record(5, "Admin sees PM request from any Ministry (unrestricted scope)", passed,
               f"HTTP {admin_queue.status_code}, Requests visible: {len(admin_reqs)}, PM1 visible: {pm1_in_admin}")
    except Exception as e:
        record(5, "Admin sees PM request from any Ministry (unrestricted scope)", False, str(e))

    # =========================================================================
    # TEST 6: PM changes project_id in request -> Server uses actual assigned project and blocks unauthorized access.
    # =========================================================================
    try:
        # First approve PM1 by authorized Ministry A
        appr_a = client.post(f"/api/ministry/managers/{pm1_uid}/approve", headers={"Authorization": f"Bearer {token_min_a}"})
        
        # PM1 logs in
        login_pm1 = client.post("/api/auth/login/pm", json={
            "username": "pm_scope_test_user1",
            "password": "Password@123",
            "project_id": proj_a_code
        })
        token_pm1 = login_pm1.json().get("token")

        # PM1 attempts to submit daily update with spoofed project_id = Project B
        spoof_res = client.post("/api/pm/daily-update",
                                headers={"Authorization": f"Bearer {token_pm1}"},
                                json={
                                    "project_id": proj_b_code, # Spoofed project ID in body
                                    "today_physical_progress": 0.5,
                                    "today_expenditure_cr": 1.0
                                })
        passed = (spoof_res.status_code == 403) and ("cannot update" in spoof_res.json().get("detail", "").lower() or "denied" in spoof_res.json().get("detail", "").lower())
        record(6, "PM changes project_id in update request -> Server blocks unauthorized access (403)", passed,
               f"Approve HTTP {appr_a.status_code}, Spoof Update HTTP {spoof_res.status_code}, Msg: '{spoof_res.json().get('detail')}'")
    except Exception as e:
        record(6, "PM changes project_id in update request -> Server blocks unauthorized access", False, str(e))

    # =========================================================================
    # TEST 7: Second ACTIVE PM registers/activates for same project -> 409 Conflict.
    # =========================================================================
    try:
        # PM1 is already ACTIVE for Project A. Now try to approve PM2 for Project A
        dup_appr = client.post(f"/api/ministry/managers/{pm2_uid}/approve", headers={"Authorization": f"Bearer {token_min_a}"})
        passed = (dup_appr.status_code == 409) and ("active" in dup_appr.json().get("detail", "").lower() or "already" in dup_appr.json().get("detail", "").lower())
        record(7, "Second ACTIVE PM activation for same project -> 409 Conflict", passed,
               f"Duplicate Approve HTTP {dup_appr.status_code}, Detail: '{dup_appr.json().get('detail')}'")
    except Exception as e:
        record(7, "Second ACTIVE PM activation for same project -> 409 Conflict", False, str(e))

    # =========================================================================
    # TEST 8: Approved PM accesses assigned project -> 200 OK.
    # =========================================================================
    try:
        detail_assigned = client.get(f"/api/projects/{proj_a_code}", headers={"Authorization": f"Bearer {token_pm1}"})
        passed = (detail_assigned.status_code == 200) and (detail_assigned.json().get("project_id") == proj_a_code)
        record(8, "Approved PM accesses assigned project -> 200 OK", passed,
               f"HTTP {detail_assigned.status_code}, Project ID: '{detail_assigned.json().get('project_id')}'")
    except Exception as e:
        record(8, "Approved PM accesses assigned project -> 200 OK", False, str(e))

    # =========================================================================
    # TEST 9: Approved PM accesses another project -> 403 Forbidden.
    # =========================================================================
    try:
        detail_other = client.get(f"/api/projects/{proj_b_code}", headers={"Authorization": f"Bearer {token_pm1}"})
        passed = (detail_other.status_code == 403) and ("restricted" in detail_other.json().get("detail", "").lower() or "denied" in detail_other.json().get("detail", "").lower())
        record(9, "Approved PM accesses another project -> 403 Forbidden", passed,
               f"HTTP {detail_other.status_code}, Detail: '{detail_other.json().get('detail')}'")
    except Exception as e:
        record(9, "Approved PM accesses another project -> 403 Forbidden", False, str(e))

    # =========================================================================
    # TEST 10: Existing Ministry and PM approval workflows continue working.
    # =========================================================================
    try:
        # Admin can approve, reject, and suspend; Ministry officer can submit decisions
        admin_rej = client.post(f"/api/admin/managers/{pm2_uid}/reject", headers={"Authorization": f"Bearer {token_admin}"})
        admin_susp = client.post(f"/api/admin/managers/{pm1_uid}/suspend", headers={"Authorization": f"Bearer {token_admin}"})
        
        # Verify suspended PM can no longer login
        susp_login = client.post("/api/auth/login/pm", json={
            "username": "pm_scope_test_user1",
            "password": "Password@123",
            "project_id": proj_a_code
        })
        passed = (
            admin_rej.status_code == 200 and
            admin_susp.status_code == 200 and
            susp_login.status_code == 403 and
            "suspended" in susp_login.json().get("detail", "").lower()
        )
        record(10, "Existing Ministry and PM approval workflows continue working seamlessly", passed,
               f"Admin Reject HTTP {admin_rej.status_code}, Admin Suspend HTTP {admin_susp.status_code}, Suspended Login HTTP {susp_login.status_code}")
    except Exception as e:
        record(10, "Existing Ministry and PM approval workflows continue working seamlessly", False, str(e))

    # Cleanup test users
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(f"DELETE FROM users WHERE username IN ({','.join(['?']*len(test_usernames))})", test_usernames)
    conn.commit()
    conn.close()

    print("=" * 75)
    total_passed = sum(1 for r in results if r["passed"])
    print(f"RESULTS: {total_passed}/{len(results)} TESTS PASSED ({total_passed / len(results) * 100:.1f}%)")
    print("=" * 75)
    if total_passed != len(results):
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
