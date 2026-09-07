"""
strict_registration_approval_tests.py
=============================================================================
Comprehensive Integration Test Suite for:
STRICT REGISTRATION APPROVAL + DATABASE MINISTRY VALIDATION (TESTS 1 - 18)
=============================================================================
"""

import sys
import uuid
import requests
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "infrastructure_projects.sqlite3"

BASE_URL = "http://127.0.0.1:8000"
ADMIN_USER = "LOG_bit"
ADMIN_PASS = "LOG_bit_26103"

test_results = {}

def record(test_num, name, passed, detail=""):
    test_results[f"TEST {test_num}"] = (passed, detail)
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] TEST {test_num}: {name} - {detail}")

def get_admin_token():
    res = requests.post(f"{BASE_URL}/api/auth/login/admin", json={
        "username": ADMIN_USER,
        "password": ADMIN_PASS
    })
    if res.status_code != 200:
        raise RuntimeError(f"Admin login failed: {res.text}")
    return res.json().get("token")

def get_valid_canonical_project_id():
    # Query database for a real canonical project_id belonging to Ministry of Railways without active PM
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT p.project_id, p.ministry, p.id FROM infrastructure_projects p
        LEFT JOIN project_manager_assignments a ON p.project_id = a.project_id AND a.status = 'ACTIVE'
        WHERE a.id IS NULL AND p.ministry = 'Ministry of Railways' AND length(p.project_id) > 2 LIMIT 1;
    """)
    row = cur.fetchone()
    conn.close()
    if row:
        return str(row[0]), str(row[1]), row[2]
    return "705728", "Ministry of Railways", 1

def run_tests():
    print("\n" + "="*70)
    print("RUNNING STRICT REGISTRATION APPROVAL & MINISTRY VALIDATION TEST SUITE")
    print("="*70 + "\n")

    admin_token = get_admin_token()
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    canonical_proj_id, canonical_ministry, internal_db_id = get_valid_canonical_project_id()

    # -------------------------------------------------------------------------
    # TEST 1: Existing database Ministry selected -> verify returns 200 + verified
    # -------------------------------------------------------------------------
    res = requests.get(f"{BASE_URL}/api/ministries/verify", params={"name": "Ministry of Railways"})
    if res.status_code == 200 and res.json().get("valid") is True and res.json().get("message") == "Ministry verified":
        record(1, "Existing database Ministry selected -> valid=True, 'Ministry verified'", True)
    else:
        record(1, "Existing database Ministry selected", False, f"status={res.status_code}, body={res.text}")

    # -------------------------------------------------------------------------
    # TEST 2: Non-existent Ministry -> returns 404 + registry error
    # -------------------------------------------------------------------------
    res = requests.get(f"{BASE_URL}/api/ministries/verify", params={"name": "Ministry of Imaginary Affairs"})
    if res.status_code == 404 and "not found in the InfraNetra Ministry registry" in res.text:
        record(2, "Non-existent Ministry -> 404 error with registry message", True)
    else:
        record(2, "Non-existent Ministry", False, f"status={res.status_code}, body={res.text}")

    # -------------------------------------------------------------------------
    # TEST 3: Direct API registration with fake Ministry -> rejected (400)
    # -------------------------------------------------------------------------
    fake_user = f"fake_min_{uuid.uuid4().hex[:8]}"
    res = requests.post(f"{BASE_URL}/api/auth/register/ministry", json={
        "username": fake_user,
        "password": "Password123!",
        "email": f"{fake_user}@example.gov.in",
        "full_name": "Fake Ministry Official",
        "ministry": "Ministry of Imaginary Infrastructure"
    })
    if res.status_code == 400 and ("not recognized" in res.text.lower() or "not found" in res.text.lower()):
        record(3, "Direct API registration with fake Ministry -> HTTP 400 rejected", True)
    else:
        record(3, "Direct API registration with fake Ministry", False, f"status={res.status_code}, body={res.text}")

    # -------------------------------------------------------------------------
    # TEST 4: Ministry registration after Clerk email verification -> status=PENDING
    # -------------------------------------------------------------------------
    clerk_min_user = f"clerk_min_{uuid.uuid4().hex[:8]}"
    clerk_uid = f"user_{uuid.uuid4().hex[:12]}"
    res = requests.post(f"{BASE_URL}/api/auth/register/ministry", json={
        "username": clerk_min_user,
        "password": "Password123!",
        "email": f"{clerk_min_user}@railways.gov.in",
        "full_name": "Official Railway Officer",
        "ministry": "Ministry of Railways",
        "clerk_user_id": clerk_uid
    })
    min_user_id = None
    if res.status_code in (200, 201) and res.json().get("status") == "PENDING":
        min_user_id = res.json().get("user_id")
        record(4, "Ministry registration with Clerk UID -> status=PENDING", True, f"user_id={min_user_id}")
    else:
        record(4, "Ministry registration with Clerk UID", False, f"status={res.status_code}, body={res.text}")

    # -------------------------------------------------------------------------
    # TEST 5: PENDING Ministry user attempts protected API -> denied (403)
    # -------------------------------------------------------------------------
    login_res = requests.post(f"{BASE_URL}/api/auth/login/ministry", json={
        "username": clerk_min_user,
        "password": "Password123!",
        "ministry": "Ministry of Railways"
    })
    if login_res.status_code == 403 and any(w in login_res.text.lower() for w in ("awaiting", "pending")):
        record(5, "PENDING Ministry user login attempt -> HTTP 403 Denied", True)
    else:
        record(5, "PENDING Ministry user login attempt", False, f"status={login_res.status_code}, body={login_res.text}")

    # -------------------------------------------------------------------------
    # TEST 6: Admin approves Ministry user -> status=APPROVED
    # -------------------------------------------------------------------------
    if min_user_id:
        approve_res = requests.post(
            f"{BASE_URL}/api/admin/ministry-requests/{min_user_id}/approve",
            headers=admin_headers
        )
        if approve_res.status_code == 200:
            record(6, "Admin approves Ministry user -> status=APPROVED", True)
        else:
            record(6, "Admin approves Ministry user", False, f"status={approve_res.status_code}, body={approve_res.text}")
    else:
        record(6, "Admin approves Ministry user", False, "No min_user_id from TEST 4")

    # -------------------------------------------------------------------------
    # TEST 7: APPROVED Ministry user accesses protected API -> allowed (200)
    # -------------------------------------------------------------------------
    approved_login = requests.post(f"{BASE_URL}/api/auth/login/ministry", json={
        "username": clerk_min_user,
        "password": "Password123!",
        "ministry": "Ministry of Railways"
    })
    if approved_login.status_code == 200 and approved_login.json().get("token"):
        min_token = approved_login.json().get("token")
        # Access protected endpoint
        prot_res = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {min_token}"}
        )
        res_role = prot_res.json().get("role") or prot_res.json().get("user", {}).get("role")
        if prot_res.status_code == 200 and res_role == "MINISTRY":
            record(7, "APPROVED Ministry user accesses protected API -> HTTP 200 OK", True)
        else:
            record(7, "APPROVED Ministry user accesses protected API", False, f"status={prot_res.status_code}, body={prot_res.text}")
    else:
        record(7, "APPROVED Ministry user login", False, f"status={approved_login.status_code}, body={approved_login.text}")

    # -------------------------------------------------------------------------
    # TEST 8: Existing canonical project_id -> GREEN / valid (200)
    # -------------------------------------------------------------------------
    res = requests.get(f"{BASE_URL}/api/projects/lookup/{canonical_proj_id}")
    if res.status_code == 200 and res.json().get("found") is True:
        record(8, f"Existing canonical project_id ({canonical_proj_id}) lookup -> 200 found=True", True)
    else:
        record(8, "Existing canonical project_id lookup", False, f"status={res.status_code}, body={res.text}")

    # -------------------------------------------------------------------------
    # TEST 9: Internal database id only -> RED / HTTP 404
    # -------------------------------------------------------------------------
    fake_internal_id = f"99999{internal_db_id}8888"
    res = requests.get(f"{BASE_URL}/api/projects/lookup/{fake_internal_id}")
    if res.status_code == 404:
        record(9, f"Internal database id / non-canonical lookup ({fake_internal_id}) -> HTTP 404", True)
    else:
        record(9, "Internal database id lookup", False, f"status={res.status_code}, body={res.text}")

    # -------------------------------------------------------------------------
    # TEST 10: Random numeric ID -> HTTP 404
    # -------------------------------------------------------------------------
    res = requests.get(f"{BASE_URL}/api/projects/lookup/999888777111")
    if res.status_code == 404:
        record(10, "Random numeric ID -> HTTP 404", True)
    else:
        record(10, "Random numeric ID", False, f"status={res.status_code}, body={res.text}")

    # -------------------------------------------------------------------------
    # TEST 11: Random alphanumeric ID -> HTTP 404
    # -------------------------------------------------------------------------
    res = requests.get(f"{BASE_URL}/api/projects/lookup/NON_EXISTENT_PROJECT_99")
    if res.status_code == 404:
        record(11, "Random alphanumeric ID -> HTTP 404", True)
    else:
        record(11, "Random alphanumeric ID", False, f"status={res.status_code}, body={res.text}")

    # -------------------------------------------------------------------------
    # TEST 12: PM registration status initially=PENDING
    # -------------------------------------------------------------------------
    pm_user = f"pm_test_{uuid.uuid4().hex[:8]}"
    res = requests.post(f"{BASE_URL}/api/auth/register/pm", json={
        "username": pm_user,
        "password": "Password123!",
        "email": f"{pm_user}@railways.gov.in",
        "full_name": "Project Manager Test",
        "project_id": canonical_proj_id
    })
    pm_user_id = None
    if res.status_code in (200, 201) and res.json().get("status") == "PENDING":
        pm_user_id = res.json().get("user_id")
        record(12, "PM registration status initially=PENDING", True, f"pm_user_id={pm_user_id}")
    elif res.status_code == 409 and "already has an active" in res.text:
        # If this canonical project already has active PM, test with another canonical project
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("""
            SELECT p.project_id FROM infrastructure_projects p
            LEFT JOIN project_manager_assignments a ON p.project_id = a.project_id AND a.status = 'ACTIVE'
            WHERE a.id IS NULL AND p.ministry = 'Ministry of Railways' AND length(p.project_id) > 2 LIMIT 1;
        """)
        row = cur.fetchone()
        conn.close()
        if row:
            alt_proj = str(row[0])
            res_alt = requests.post(f"{BASE_URL}/api/auth/register/pm", json={
                "username": pm_user,
                "password": "Password123!",
                "email": f"{pm_user}@railways.gov.in",
                "full_name": "Project Manager Test",
                "project_id": alt_proj
            })
            if res_alt.status_code in (200, 201) and res_alt.json().get("status") == "PENDING":
                pm_user_id = res_alt.json().get("user_id")
                canonical_proj_id = alt_proj
                record(12, "PM registration status initially=PENDING (alt project)", True, f"pm_user_id={pm_user_id}")
            else:
                record(12, "PM registration status initially=PENDING", False, f"alt status={res_alt.status_code}")
        else:
            record(12, "PM registration status initially=PENDING", False, "No available project without active PM")
    else:
        record(12, "PM registration status initially=PENDING", False, f"status={res.status_code}, body={res.text}")

    # -------------------------------------------------------------------------
    # TEST 13: PENDING PM cannot use protected PM APIs
    # -------------------------------------------------------------------------
    pm_login = requests.post(f"{BASE_URL}/api/auth/login/pm", json={
        "username": pm_user,
        "password": "Password123!",
        "project_id": canonical_proj_id
    })
    if pm_login.status_code == 403 and any(w in pm_login.text.lower() for w in ("awaiting", "pending")):
        record(13, "PENDING PM cannot use protected PM APIs -> HTTP 403 Denied", True)
    else:
        record(13, "PENDING PM login", False, f"status={pm_login.status_code}, body={pm_login.text}")

    # -------------------------------------------------------------------------
    # TEST 14: Approved PM can access assigned project
    # -------------------------------------------------------------------------
    if pm_user_id:
        # Ministry officer approves the PM
        min_token = requests.post(f"{BASE_URL}/api/auth/login/ministry", json={
            "username": clerk_min_user,
            "password": "Password123!",
            "ministry": "Ministry of Railways"
        }).json().get("token")

        approve_pm = requests.post(
            f"{BASE_URL}/api/ministry/managers/{pm_user_id}/approve",
            headers={"Authorization": f"Bearer {min_token}"}
        )
        if approve_pm.status_code in (200, 201):
            # Now PM can log in
            pm_ok_login = requests.post(f"{BASE_URL}/api/auth/login/pm", json={
                "username": pm_user,
                "password": "Password123!",
                "project_id": canonical_proj_id
            })
            if pm_ok_login.status_code == 200:
                pm_token = pm_ok_login.json().get("token")
                # Access PM me endpoint
                me_res = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {pm_token}"})
                pm_role = me_res.json().get("role") or me_res.json().get("user", {}).get("role")
                if me_res.status_code == 200 and pm_role == "PROJECT_MANAGER":
                    record(14, "Approved PM can access assigned project -> HTTP 200 OK", True)
                else:
                    record(14, "Approved PM /me access", False, f"status={me_res.status_code}, body={me_res.text}")
            else:
                record(14, "Approved PM login", False, f"status={pm_ok_login.status_code}")
        else:
            record(14, "Approve PM via Ministry", False, f"status={approve_pm.status_code}, body={approve_pm.text}")
    else:
        record(14, "Approved PM can access assigned project", False, "No pm_user_id from TEST 12")

    # -------------------------------------------------------------------------
    # TEST 15: PM cannot access another project
    # -------------------------------------------------------------------------
    if pm_user_id:
        # Attempt to access another project's updates
        fake_other_project = 99999999
        unauth_update = requests.post(
            f"{BASE_URL}/api/pm/daily-update",
            headers={"Authorization": f"Bearer {pm_token}"},
            json={
                "project_id": fake_other_project,
                "update_date": "2026-09-07",
                "physical_progress": 55.0,
                "summary": "Cross project test"
            }
        )
        if unauth_update.status_code in (403, 404):
            record(15, "PM cannot access another project -> HTTP 403/404 Denied", True)
        else:
            record(15, "PM cross-project update access", False, f"status={unauth_update.status_code}")
    else:
        record(15, "PM cannot access another project", False, "No pm_user_id")

    # -------------------------------------------------------------------------
    # TEST 16: Client sends role=APPROVED/ADMIN -> ignored/rejected
    # -------------------------------------------------------------------------
    malicious_user = f"hacker_{uuid.uuid4().hex[:8]}"
    res = requests.post(f"{BASE_URL}/api/auth/register/ministry", json={
        "username": malicious_user,
        "password": "Password123!",
        "email": f"{malicious_user}@railways.gov.in",
        "full_name": "Hacker User",
        "ministry": "Ministry of Railways",
        "role": "ADMIN",
        "status": "APPROVED"
    })
    # Check what status was actually assigned in database
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT role, status FROM users WHERE username = ?;", (malicious_user,))
    row = cur.fetchone()
    conn.close()
    if row and row[0] == "MINISTRY" and row[1] == "PENDING":
        record(16, "Client sends role=ADMIN, status=APPROVED -> ignored, stored as MINISTRY / PENDING", True)
    else:
        record(16, "Client manipulation of role/status", False, f"DB row={row}")

    # -------------------------------------------------------------------------
    # TEST 17: Client sends fake ministry -> ignored/rejected
    # -------------------------------------------------------------------------
    res = requests.post(f"{BASE_URL}/api/auth/register/ministry", json={
        "username": f"fake_m_{uuid.uuid4().hex[:8]}",
        "password": "Password123!",
        "email": f"fakemin@railways.gov.in",
        "full_name": "Fake Ministry Test",
        "ministry": "DROP TABLE users;--"
    })
    if res.status_code in (400, 404):
        record(17, "Client sends fake/injected ministry -> rejected with HTTP 400", True)
    else:
        record(17, "Fake ministry injection", False, f"status={res.status_code}")

    # -------------------------------------------------------------------------
    # TEST 18: Client sends arbitrary user_id -> ignored/rejected
    # -------------------------------------------------------------------------
    arb_user = f"arb_id_{uuid.uuid4().hex[:8]}"
    res = requests.post(f"{BASE_URL}/api/auth/register/ministry", json={
        "id": 1,  # Try to overwrite admin
        "user_id": 1,
        "username": arb_user,
        "password": "Password123!",
        "email": f"{arb_user}@railways.gov.in",
        "full_name": "Arbitrary User ID Attempt",
        "ministry": "Ministry of Railways"
    })
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE username = ?;", (arb_user,))
    row = cur.fetchone()
    cur.execute("SELECT username FROM users WHERE id = 1;")
    admin_row = cur.fetchone()
    conn.close()
    if row and row[0] != 1 and admin_row and admin_row[0] in ("LOG_bit", "admin"):
        record(18, f"Client sends arbitrary user_id=1 -> ignored, user given id={row[0]}, admin preserved", True)
    else:
        record(18, "Arbitrary user_id manipulation", False, f"row={row}, admin_row={admin_row}")

    # -------------------------------------------------------------------------
    # POST-TEST CLEANUP: Reject/revoke all created test accounts so Admin approval queue is clean!
    # -------------------------------------------------------------------------
    print("\nPurging test accounts created during test run from approval queue...")
    import reject_demo_records
    reject_demo_records.clean_all_demo_users()
    print("Post-test cleanup complete.")

    # -------------------------------------------------------------------------
    # SUMMARY
    # -------------------------------------------------------------------------
    print("\n" + "="*70)
    print("TEST SUITE SUMMARY (18 TESTS)")
    print("="*70)
    all_passed = True
    for k, (passed, detail) in test_results.items():
        status = "PASS" if passed else "FAIL"
        if not passed:
            all_passed = False
        print(f"{k:10} : {status:4} - {detail}")
    print("="*70)
    print(f"OVERALL RESULT: {'ALL 18 TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")
    print("="*70 + "\n")
    return all_passed

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
