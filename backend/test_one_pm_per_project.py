import sys
import time
import uuid
import sqlite3
import httpx
from concurrent.futures import ThreadPoolExecutor

BASE_URL = "http://127.0.0.1:8000"
DB_PATH = "backend/infrastructure_projects.sqlite3"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def cleanup_test_users(usernames):
    conn = get_db()
    cur = conn.cursor()
    placeholders = ",".join(["?"] * len(usernames))
    cur.execute(f"SELECT id FROM users WHERE username IN ({placeholders})", usernames)
    uids = [r["id"] for r in cur.fetchall()]
    if uids:
        ph_ids = ",".join(["?"] * len(uids))
        cur.execute(f"DELETE FROM project_manager_assignments WHERE user_id IN ({ph_ids})", uids)
        cur.execute(f"DELETE FROM users WHERE id IN ({ph_ids})", uids)
        conn.commit()
    conn.close()

def get_or_create_admin():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, username FROM users WHERE role = 'ADMIN' AND status = 'APPROVED' LIMIT 1")
    row = cur.fetchone()
    if row:
        conn.close()
        return row["id"], row["username"]
    from auth import hash_password
    pwd_hash, salt = hash_password("Admin@123456")
    cur.execute("""
        INSERT INTO users (username, password_hash, salt, full_name, email, role, status)
        VALUES ('test_admin_sys', ?, ?, 'System Admin', 'admin@infranetra.gov.in', 'ADMIN', 'APPROVED')
    """, (pwd_hash, salt))
    admin_id = cur.lastrowid
    conn.commit()
    conn.close()
    return admin_id, 'test_admin_sys'

def get_admin_token(username="test_admin_sys", password="Admin@123456"):
    # If standard admin login
    r = httpx.post(f"{BASE_URL}/api/auth/login/admin", json={"username": username, "password": password})
    if r.status_code == 200:
        return r.json().get("token")
    # Alternatively generate token directly via auth module
    from auth import create_session_token
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, username, role, status FROM users WHERE username = ?", (username,))
    u = dict(cur.fetchone())
    conn.close()
    return create_session_token(u["id"], u["username"], u["role"])

def run_tests():
    print("==================================================")
    print("RUNNING ONE PROJECT MANAGER PER PROJECT ID TEST SUITE")
    print("==================================================")

    test_prefix = f"pm_test_{uuid.uuid4().hex[:6]}"
    test_pms = []

    # Select canonical test projects:
    # We will use '702668' (unassigned) and '705237' (unassigned)
    proj_a = "702668"
    proj_b = "705237"

    admin_id, admin_user = get_or_create_admin()
    admin_token = get_admin_token(admin_user)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Clean any old test records for these projects
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM project_manager_assignments WHERE project_id IN (?, ?)", (proj_a, proj_b))
    conn.commit()
    conn.close()

    pm1_user = f"{test_prefix}_pm1"
    pm2_user = f"{test_prefix}_pm2"
    pm3_user = f"{test_prefix}_pm3"
    pm4_user = f"{test_prefix}_pm4"
    test_pms.extend([pm1_user, pm2_user, pm3_user, pm4_user])

    # ----------------------------------------------------
    # TEST 1: Unassigned project -> PM 1 registration succeeds -> PENDING
    # ----------------------------------------------------
    print("\n--- TEST 1: Unassigned Project -> PM 1 Registration (PENDING) ---")
    resp1 = httpx.post(f"{BASE_URL}/api/auth/register/pm", json={
        "username": pm1_user,
        "password": "Password@123",
        "full_name": "Project Manager One",
        "email": f"{pm1_user}@example.com",
        "project_id": proj_a,
        "phone": "9876543210"
    })
    assert resp1.status_code == 201, f"Expected 201, got {resp1.status_code}: {resp1.text}"
    data1 = resp1.json()
    assert data1.get("status") == "PENDING", f"Expected PENDING status, got {data1.get('status')}"
    pm1_id = data1["user_id"]
    print(f"PASS: PM 1 registered with user_id={pm1_id}, status=PENDING")

    # ----------------------------------------------------
    # TEST 2 & TEST 5: Same project -> PM 2 registration -> 409 (PENDING counts as OCCUPIED)
    # ----------------------------------------------------
    print("\n--- TEST 2 & 5: Same Project -> PM 2 Registration (Blocked by PENDING PM) ---")
    resp2 = httpx.post(f"{BASE_URL}/api/auth/register/pm", json={
        "username": pm2_user,
        "password": "Password@123",
        "full_name": "Project Manager Two",
        "email": f"{pm2_user}@example.com",
        "project_id": proj_a,
        "phone": "9876543211"
    })
    assert resp2.status_code == 409, f"Expected 409, got {resp2.status_code}: {resp2.text}"
    body2 = resp2.json()
    expected_detail = "Project Already Assigned"
    expected_message = "This project already has an assigned Project Manager. Please enter a different Project ID"
    assert body2.get("detail") == expected_detail, f"Expected detail '{expected_detail}', got '{body2.get('detail')}'"
    assert body2.get("message") == expected_message, f"Expected message '{expected_message}', got '{body2.get('message')}'"
    print(f"PASS: PM 2 blocked with 409 and exact message: {body2}")

    # Verify PM 2 account was NOT created
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE username = ?", (pm2_user,))
    assert cur.fetchone() is None, "PM 2 account must not exist in database"
    conn.close()
    print("PASS: PM 2 user account was not created.")

    # ----------------------------------------------------
    # TEST 3: PM 1 approved -> ACTIVE
    # ----------------------------------------------------
    print("\n--- TEST 3: Approve PM 1 -> ACTIVE ---")
    resp_appr = httpx.post(f"{BASE_URL}/api/admin/approvals/{pm1_id}/approve", headers=admin_headers)
    assert resp_appr.status_code == 200, f"Expected 200, got {resp_appr.status_code}: {resp_appr.text}"
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT status FROM project_manager_assignments WHERE user_id = ?", (pm1_id,))
    row = cur.fetchone()
    assert row["status"] == "ACTIVE", f"Expected ACTIVE assignment, got {row['status']}"
    conn.close()
    print(f"PASS: PM 1 approved, assignment is now ACTIVE.")

    # ----------------------------------------------------
    # TEST 4: Same project -> PM 3 registration -> 409 (ACTIVE counts as OCCUPIED)
    # ----------------------------------------------------
    print("\n--- TEST 4: Same Project -> PM 3 Registration (Blocked by ACTIVE PM) ---")
    resp3 = httpx.post(f"{BASE_URL}/api/auth/register/pm", json={
        "username": pm3_user,
        "password": "Password@123",
        "full_name": "Project Manager Three",
        "email": f"{pm3_user}@example.com",
        "project_id": proj_a,
        "phone": "9876543212"
    })
    assert resp3.status_code == 409, f"Expected 409, got {resp3.status_code}: {resp3.text}"
    body3 = resp3.json()
    assert body3.get("detail") == expected_detail
    assert body3.get("message") == expected_message
    print(f"PASS: PM 3 registration blocked with 409 and exact message.")

    # ----------------------------------------------------
    # TEST 6: SUSPENDED PM remains assigned -> second PM blocked (409)
    # ----------------------------------------------------
    print("\n--- TEST 6: Suspend PM 1 -> Second PM Still Blocked (Occupied) ---")
    resp_susp = httpx.post(f"{BASE_URL}/api/admin/approvals/{pm1_id}/suspend", headers=admin_headers)
    assert resp_susp.status_code == 200, f"Expected 200, got {resp_susp.status_code}: {resp_susp.text}"

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT u.status as u_status, a.status as a_status FROM users u JOIN project_manager_assignments a ON u.id = a.user_id WHERE u.id = ?", (pm1_id,))
    row = cur.fetchone()
    assert row["u_status"] == "SUSPENDED", f"Expected user status SUSPENDED, got {row['u_status']}"
    assert row["a_status"] == "ACTIVE", f"Expected assignment status ACTIVE, got {row['a_status']}"
    conn.close()

    # Try registering PM 4 for the same project
    resp4 = httpx.post(f"{BASE_URL}/api/auth/register/pm", json={
        "username": pm4_user,
        "password": "Password@123",
        "full_name": "Project Manager Four",
        "email": f"{pm4_user}@example.com",
        "project_id": proj_a,
        "phone": "9876543213"
    })
    assert resp4.status_code == 409, f"Expected 409, got {resp4.status_code}: {resp4.text}"
    body4 = resp4.json()
    assert body4.get("detail") == expected_detail
    assert body4.get("message") == expected_message
    print("PASS: Suspended PM continues to occupy project. New registration blocked with 409.")

    # ----------------------------------------------------
    # TEST 7: PM rejected -> assignment REVOKED -> new PM can register
    # ----------------------------------------------------
    print("\n--- TEST 7: PM Rejected -> Assignment Revoked -> New PM Can Register ---")
    resp_rej = httpx.post(f"{BASE_URL}/api/admin/approvals/{pm1_id}/reject", headers=admin_headers)
    assert resp_rej.status_code == 200, f"Expected 200, got {resp_rej.status_code}: {resp_rej.text}"

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT status FROM project_manager_assignments WHERE user_id = ?", (pm1_id,))
    row = cur.fetchone()
    assert row["status"] == "REVOKED", f"Expected REVOKED assignment, got {row['status']}"
    conn.close()

    # Now PM 4 should be able to register successfully
    resp4_success = httpx.post(f"{BASE_URL}/api/auth/register/pm", json={
        "username": pm4_user,
        "password": "Password@123",
        "full_name": "Project Manager Four",
        "email": f"{pm4_user}@example.com",
        "project_id": proj_a,
        "phone": "9876543213"
    })
    assert resp4_success.status_code == 201, f"Expected 201, got {resp4_success.status_code}: {resp4_success.text}"
    pm4_id = resp4_success.json()["user_id"]
    print(f"PASS: After rejection/revocation, project released. PM 4 registered with user_id={pm4_id}")

    # ----------------------------------------------------
    # TEST 8: Direct approval race / Old duplicate state protection
    # ----------------------------------------------------
    print("\n--- TEST 8: Approval Conflict Protection ---")
    # Create another PM in PENDING state directly in DB to simulate legacy duplicate data
    legacy_pm = f"{test_prefix}_legacy"
    test_pms.append(legacy_pm)
    conn = get_db()
    cur = conn.cursor()
    from auth import hash_password
    pwd_hash, salt = hash_password("Password@123")
    cur.execute("""
        INSERT INTO users (username, password_hash, salt, full_name, email, role, status)
        VALUES (?, ?, ?, 'Legacy PM', 'legacy@example.com', 'PROJECT_MANAGER', 'PENDING')
    """, (legacy_pm, pwd_hash, salt))
    legacy_id = cur.lastrowid
    # To bypass partial unique index for this test, insert as REVOKED then attempt approval:
    # Even if an assignment was somehow present, approve will check occupancy!
    cur.execute("""
        INSERT INTO project_manager_assignments (user_id, project_id, status)
        VALUES (?, ?, 'REVOKED')
    """, (legacy_id, proj_a))
    conn.commit()
    conn.close()

    # Approve PM 4 first -> ACTIVE
    httpx.post(f"{BASE_URL}/api/admin/approvals/{pm4_id}/approve", headers=admin_headers)

    # Now attempt to approve legacy PM for the same project -> MUST BE BLOCKED WITH 409
    resp_legacy_appr = httpx.post(f"{BASE_URL}/api/admin/approvals/{legacy_id}/approve", headers=admin_headers)
    assert resp_legacy_appr.status_code == 409, f"Expected 409, got {resp_legacy_appr.status_code}: {resp_legacy_appr.text}"
    body_leg = resp_legacy_appr.json()
    assert body_leg.get("detail") == expected_detail
    assert body_leg.get("message") == expected_message
    print("PASS: Approval conflict blocked with 409 and exact message.")

    # ----------------------------------------------------
    # TEST 9: Concurrent registration race (simultaneous requests)
    # ----------------------------------------------------
    print("\n--- TEST 9: Concurrency Race Test (Simultaneous Registrations on Project B) ---")
    race_pm1 = f"{test_prefix}_race1"
    race_pm2 = f"{test_prefix}_race2"
    test_pms.extend([race_pm1, race_pm2])

    req1 = {
        "username": race_pm1,
        "password": "Password@123",
        "full_name": "Race PM 1",
        "email": f"{race_pm1}@example.com",
        "project_id": proj_b,
        "phone": "9876543221"
    }
    req2 = {
        "username": race_pm2,
        "password": "Password@123",
        "full_name": "Race PM 2",
        "email": f"{race_pm2}@example.com",
        "project_id": proj_b,
        "phone": "9876543222"
    }

    def do_register(payload):
        return httpx.post(f"{BASE_URL}/api/auth/register/pm", json=payload, timeout=10.0)

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(do_register, req1)
        f2 = executor.submit(do_register, req2)
        r1 = f1.result()
        r2 = f2.result()

    statuses = sorted([r1.status_code, r2.status_code])
    print(f"Concurrent registration responses: {r1.status_code}, {r2.status_code}")
    assert statuses == [201, 409], f"Expected exactly one 201 and one 409, got {statuses}"

    conflict_resp = r1 if r1.status_code == 409 else r2
    body_conflict = conflict_resp.json()
    assert body_conflict.get("detail") == expected_detail
    assert body_conflict.get("message") == expected_message
    print("PASS: Concurrent registration guaranteed exactly one 201 and one 409 with exact message!")

    # ----------------------------------------------------
    # TEST 10: Invalid project ID -> 404 / project-not-found -> NOT 409
    # ----------------------------------------------------
    print("\n--- TEST 10: Invalid Project ID -> 404 ---")
    resp10 = httpx.post(f"{BASE_URL}/api/auth/register/pm", json={
        "username": f"{test_prefix}_invalid",
        "password": "Password@123",
        "full_name": "Invalid PM",
        "email": "invalid@example.com",
        "project_id": "NON_EXISTENT_9999999",
        "phone": "9876543233"
    })
    assert resp10.status_code == 404, f"Expected 404, got {resp10.status_code}: {resp10.text}"
    assert "not found" in resp10.json().get("detail", "").lower()
    print("PASS: Invalid project ID correctly returned 404 Not Found.")

    # ----------------------------------------------------
    # TEST 11: Internal infrastructure_projects.id used as public project ID -> reject (404)
    # ----------------------------------------------------
    print("\n--- TEST 11: Internal DB ID used as public Project ID -> 404 ---")
    # An integer ID like "1" or "33" that isn't the canonical code should fail
    resp11 = httpx.post(f"{BASE_URL}/api/auth/register/pm", json={
        "username": f"{test_prefix}_int_id",
        "password": "Password@123",
        "full_name": "Int ID PM",
        "email": "int_id@example.com",
        "project_id": "99999999",
        "phone": "9876543234"
    })
    assert resp11.status_code == 404, f"Expected 404, got {resp11.status_code}"
    print("PASS: Internal/non-canonical ID correctly rejected.")

    # ----------------------------------------------------
    # TEST 12: Ministry assignment to occupied project -> blocked
    # ----------------------------------------------------
    print("\n--- TEST 12: Ministry Project Creation with PM on Occupied Project -> 409 ---")
    # proj_a is occupied by PM 4
    # Attempt to create project with assign_pm=True on proj_a
    from auth_db import create_new_project
    ministry_actor = {"id": admin_id, "username": admin_user, "role": "MINISTRY", "assigned_ministry": "Ministry of Housing & Urban Affairs", "status": "APPROVED"}
    ministry_payload = {
        "project_id": proj_a,
        "project_name": "Duplicate Ministry Project",
        "ministry": "Ministry of Housing & Urban Affairs",
        "assign_pm": True,
        "pm_username": f"{test_prefix}_min_pm",
        "pm_full_name": "Ministry PM",
        "pm_email": "min_pm@example.com",
        "pm_password": "Password@123"
    }
    test_pms.append(f"{test_prefix}_min_pm")
    resp12 = httpx.post(f"{BASE_URL}/api/projects", json=ministry_payload, headers=admin_headers)
    assert resp12.status_code == 409, f"Expected 409, got {resp12.status_code}: {resp12.text}"
    body12 = resp12.json()
    assert body12.get("detail") == expected_detail
    assert body12.get("message") == expected_message
    print("PASS: Ministry project assignment to occupied project returned 409 and exact message.")

    # ----------------------------------------------------
    # AUDIT LOG VERIFICATION
    # ----------------------------------------------------
    print("\n--- VERIFYING AUDIT LOGS FOR PM_REGISTRATION_BLOCKED_DUPLICATE ---")
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT action, target_type, target_id, result FROM audit_logs WHERE action = 'PM_REGISTRATION_BLOCKED_DUPLICATE' ORDER BY id DESC LIMIT 5")
    audit_rows = cur.fetchall()
    assert len(audit_rows) > 0, "Expected at least one PM_REGISTRATION_BLOCKED_DUPLICATE audit entry"
    for r in audit_rows:
        print(f"Audit log entry: action={r['action']}, target_id={r['target_id']}, result={r['result']}")
    conn.close()
    print("PASS: Audit trail records PM_REGISTRATION_BLOCKED_DUPLICATE correctly.")

    # ----------------------------------------------------
    # REQUIREMENT 19: DATABASE DUPLICATE SCAN
    # ----------------------------------------------------
    print("\n--- REQUIREMENT 19: DATABASE DUPLICATE SCAN ---")
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT project_id, COUNT(*) as active_count
        FROM project_manager_assignments
        WHERE status IN ('ACTIVE', 'PENDING')
        GROUP BY project_id
        HAVING COUNT(*) > 1;
    """)
    duplicates = cur.fetchall()
    conn.close()
    print(f"Duplicate scan found: {len(duplicates)} projects with > 1 active/pending PM.")
    assert len(duplicates) == 0, f"Found duplicate current assignments: {duplicates}"
    print("PASS: Database scan verified COUNT <= 1 for all projects! ZERO duplicates found.")

    # Cleanup test accounts
    print("\n--- CLEANING UP TEST ACCOUNTS ---")
    cleanup_test_users(test_pms)
    print("PASS: Cleaned up test records.")

    print("\n==================================================")
    print("ALL 12 TESTS + CONCURRENCY + DUPLICATE SCAN PASSED!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
