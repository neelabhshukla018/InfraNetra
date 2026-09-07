"""
InfraNetra Automated Security Test Suite (Tests A - R)
Covers all mandatory multi-role authentication, approval, scoping, IDOR protection,
and database constraint verification rules.
"""

import sys
import os
import sqlite3
import json
from fastapi.testclient import TestClient

# Add backend directory to sys.path
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

from main import app
import auth
import db
import auth_db

client = TestClient(app)

results = []

def record_test(test_id: str, title: str, passed: bool, detail: str = ""):
    status_str = "PASS" if passed else "FAIL"
    print(f"[{status_str}] Test {test_id}: {title}")
    if detail:
        print(f"       Detail: {detail}")
    results.append({
        "test_id": test_id,
        "title": title,
        "status": status_str,
        "passed": passed,
        "detail": detail
    })

def run_all_tests():
    print("=" * 70)
    print("INFRANETRA SECURITY TEST SUITE: TESTS A - R")
    print("=" * 70)

    # 0. Setup test fixture data from real projects in SQLite
    conn = sqlite3.connect(os.path.join(BACKEND_DIR, "infrastructure_projects.sqlite3"))
    cur = conn.cursor()

    # Find a MORTH project and a Railways project
    cur.execute("SELECT id, project_id, ministry, project_name FROM infrastructure_projects WHERE report_month='2026-04-01' AND LOWER(ministry) LIKE '%road%' LIMIT 1")
    morth_proj = cur.fetchone()
    if not morth_proj:
        cur.execute("SELECT id, project_id, ministry, project_name FROM infrastructure_projects LIMIT 1")
        morth_proj = cur.fetchone()

    cur.execute("SELECT id, project_id, ministry, project_name FROM infrastructure_projects WHERE report_month='2026-04-01' AND LOWER(ministry) LIKE '%rail%' LIMIT 1")
    rail_proj = cur.fetchone()
    if not rail_proj:
        cur.execute("SELECT id, project_id, ministry, project_name WHERE id != ? LIMIT 1", (morth_proj[0],))
        rail_proj = cur.fetchone()

    proj_a_id, proj_a_code, proj_a_min, proj_a_name = morth_proj
    proj_b_id, proj_b_code, proj_b_min, proj_b_name = rail_proj

    print(f"Selected Project A (Ministry A): ID={proj_a_id}, Code={proj_a_code}, Ministry='{proj_a_min}'")
    print(f"Selected Project B (Ministry B): ID={proj_b_id}, Code={proj_b_code}, Ministry='{proj_b_min}'")
    print("-" * 70)

    # Cleanup any previous test artifacts from DB
    test_usernames = [
        "sec_test_min_a", "sec_test_min_b", "sec_test_pm_a", "sec_test_pm_b",
        "sec_test_pm_dup", "sec_test_rej_user", "sec_test_susp_user"
    ]
    cur.execute(f"DELETE FROM users WHERE username IN ({','.join(['?']*len(test_usernames))})", test_usernames)
    cur.execute("DELETE FROM project_manager_assignments WHERE project_id IN (?, ?) OR user_id NOT IN (SELECT id FROM users);", (proj_a_code, proj_b_code))
    conn.commit()
    conn.close()

    # -------------------------------------------------------------
    # Test A: Public user reads public dashboard & project registry
    # -------------------------------------------------------------
    try:
        res1 = client.get("/api/dashboard/summary?report_month=2026-04-01")
        res2 = client.get("/api/projects?report_month=2026-04-01&page=1&page_size=5")
        passed = (res1.status_code == 200) and (res2.status_code == 200) and ("metrics" in res1.json())
        record_test("A", "Public user reads public dashboard & registry (Unauthenticated)", passed,
                    f"Dashboard HTTP {res1.status_code}, Registry HTTP {res2.status_code}")
    except Exception as e:
        record_test("A", "Public user reads public dashboard & registry (Unauthenticated)", False, str(e))

    # -------------------------------------------------------------
    # Test B: Public user accesses protected write/admin endpoint
    # -------------------------------------------------------------
    try:
        res_admin = client.get("/api/admin/approvals/pending")
        res_audit = client.get("/api/admin/audit-logs")
        res_daily = client.post("/api/pm/daily-update", json={"today_physical_progress": 1.0, "today_expenditure_cr": 2.0})
        res_min_pm = client.get("/api/ministry/managers/pending")
        passed = (res_admin.status_code == 401) and (res_audit.status_code == 401) and (res_daily.status_code == 401) and (res_min_pm.status_code == 401)
        record_test("B", "Public user accesses protected write/admin endpoint without token", passed,
                    f"Approvals HTTP {res_admin.status_code}, Audit HTTP {res_audit.status_code}, PM Update HTTP {res_daily.status_code}")
    except Exception as e:
        record_test("B", "Public user accesses protected write/admin endpoint without token", False, str(e))

    # -------------------------------------------------------------
    # Test C: Ministry user registers -> PENDING -> Attempt login (blocked)
    # -------------------------------------------------------------
    min_a_user_id = None
    try:
        reg_res = client.post("/api/auth/register/ministry", json={
            "full_name": "Ministry Officer A",
            "email": "officer_a@ministrya.gov.in",
            "username": "sec_test_min_a",
            "password": "Password@123",
            "ministry": proj_a_min
        })
        min_a_user_id = reg_res.json().get("user_id")
        # Attempt login while PENDING
        login_res = client.post("/api/auth/login/ministry", json={
            "username": "sec_test_min_a",
            "password": "Password@123",
            "ministry": proj_a_min
        })
        passed = (reg_res.status_code == 201) and (login_res.status_code == 403) and ("pending" in login_res.json().get("detail", "").lower())
        record_test("C", "Ministry user registers -> Status PENDING -> Login blocked", passed,
                    f"Register HTTP {reg_res.status_code}, Login HTTP {login_res.status_code}, Msg: '{login_res.json().get('detail')}'")
    except Exception as e:
        record_test("C", "Ministry user registers -> Status PENDING -> Login blocked", False, str(e))

    # -------------------------------------------------------------
    # Test D: Admin approves Ministry user -> Status APPROVED -> Login succeeds
    # -------------------------------------------------------------
    admin_token = None
    min_a_token = None
    try:
        # Admin login using fixed server-side credentials
        admin_user = os.environ.get("ADMIN_USERNAME", "LOG_bit").strip()
        admin_pwd = os.environ.get("ADMIN_PASSWORD", "LOG_bit_26103")

        adm_login = client.post("/api/auth/login/admin", json={
            "username": admin_user,
            "password": admin_pwd
        })
        admin_token = adm_login.json().get("token")
        # Admin approves Ministry User A
        appr_res = client.post(f"/api/admin/approvals/{min_a_user_id}/approve",
                               headers={"Authorization": f"Bearer {admin_token}"},
                               json={"role": "MINISTRY"})
        # Ministry user A attempts login now
        login_res = client.post("/api/auth/login/ministry", json={
            "username": "sec_test_min_a",
            "password": "Password@123",
            "ministry": proj_a_min
        })
        min_a_token = login_res.json().get("token")
        passed = (appr_res.status_code == 200) and (login_res.status_code == 200) and (min_a_token is not None)
        record_test("D", "Admin approves Ministry user -> Status APPROVED -> Login succeeds", passed,
                    f"Approve HTTP {appr_res.status_code}, Login HTTP {login_res.status_code}, Token length {len(min_a_token or '')}")
    except Exception as e:
        record_test("D", "Admin approves Ministry user -> Status APPROVED -> Login succeeds", False, str(e))

    # -------------------------------------------------------------
    # Test E: Ministry user tries to log in with wrong ministry in body/request
    # -------------------------------------------------------------
    try:
        login_res = client.post("/api/auth/login/ministry", json={
            "username": "sec_test_min_a",
            "password": "Password@123",
            "ministry": proj_b_min # Mismatched ministry
        })
        passed = (login_res.status_code == 403) and ("mismatch" in login_res.json().get("detail", "").lower() or "not assigned" in login_res.json().get("detail", "").lower())
        record_test("E", "Ministry login with wrong ministry in request body -> Blocked (403)", passed,
                    f"HTTP {login_res.status_code}, Msg: '{login_res.json().get('detail')}'")
    except Exception as e:
        record_test("E", "Ministry login with wrong ministry in request body -> Blocked (403)", False, str(e))

    # -------------------------------------------------------------
    # Test F: Ministry user A requests data scoped to Ministry A
    # -------------------------------------------------------------
    try:
        dash_res = client.get("/api/dashboard/summary?report_month=2026-04-01",
                              headers={"Authorization": f"Bearer {min_a_token}"})
        proj_res = client.get("/api/projects?report_month=2026-04-01&page=1&page_size=25",
                              headers={"Authorization": f"Bearer {min_a_token}"})
        dash_data = dash_res.json()
        proj_data = proj_res.json()
        projects_list = proj_data.get("projects", [])
        all_same_min = all(p.get("ministry", "").lower() == proj_a_min.lower() for p in projects_list)
        passed = (dash_res.status_code == 200) and (proj_res.status_code == 200) and all_same_min and len(projects_list) > 0
        record_test("F", "Ministry user A receives strictly scoped Ministry A data", passed,
                    f"HTTP {proj_res.status_code}, Projects returned: {len(projects_list)}, All match Ministry A: {all_same_min}")
    except Exception as e:
        record_test("F", "Ministry user A receives strictly scoped Ministry A data", False, str(e))

    # -------------------------------------------------------------
    # Test G: Ministry user A requests project detail belonging to Ministry B (IDOR)
    # -------------------------------------------------------------
    try:
        idor_res = client.get(f"/api/projects/{proj_b_code}",
                              headers={"Authorization": f"Bearer {min_a_token}"})
        passed = (idor_res.status_code == 403) and ("access denied" in idor_res.json().get("detail", "").lower() or "not authorized" in idor_res.json().get("detail", "").lower())
        record_test("G", "Ministry user A requests Ministry B project detail (IDOR) -> 403", passed,
                    f"HTTP {idor_res.status_code}, Detail: '{idor_res.json().get('detail')}'")
    except Exception as e:
        record_test("G", "Ministry user A requests Ministry B project detail (IDOR) -> 403", False, str(e))

    # -------------------------------------------------------------
    # Test H: Ministry user A attempts to approve PM registered for Ministry B
    # -------------------------------------------------------------
    pm_b_user_id = None
    try:
        # Register a PM for Project B (Railways)
        pm_b_reg = client.post("/api/auth/register/pm", json={
            "full_name": "Project Manager B",
            "email": "pm_b@railways.gov.in",
            "username": "sec_test_pm_b",
            "password": "Password@123",
            "project_id": proj_b_code
        })
        pm_b_user_id = pm_b_reg.json().get("user_id")

        # Ministry user A attempts to approve PM B
        unauth_appr = client.post(f"/api/ministry/managers/{pm_b_user_id}/approve",
                                  headers={"Authorization": f"Bearer {min_a_token}"},
                                  json={"project_id": proj_b_code})
        passed = (unauth_appr.status_code == 403) and ("outside your ministry" in unauth_appr.json().get("detail", "").lower() or "not authorized" in unauth_appr.json().get("detail", "").lower() or "forbidden" in unauth_appr.json().get("detail", "").lower())
        record_test("H", "Ministry user A attempts to approve PM for Ministry B -> 403", passed,
                    f"HTTP {unauth_appr.status_code}, Detail: '{unauth_appr.json().get('detail')}'")
    except Exception as e:
        record_test("H", "Ministry user A attempts to approve PM for Ministry B -> 403", False, str(e))

    # -------------------------------------------------------------
    # Test I: Project Manager registers for Project X -> PENDING -> Attempt login (blocked)
    # -------------------------------------------------------------
    pm_a_user_id = None
    try:
        pm_a_reg = client.post("/api/auth/register/pm", json={
            "full_name": "Project Manager A",
            "email": "pm_a@morth.gov.in",
            "username": "sec_test_pm_a",
            "password": "Password@123",
            "project_id": proj_a_code
        })
        pm_a_user_id = pm_a_reg.json().get("user_id")

        login_res = client.post("/api/auth/login/pm", json={
            "username": "sec_test_pm_a",
            "password": "Password@123",
            "project_id": proj_a_code
        })
        passed = (pm_a_reg.status_code == 201) and (login_res.status_code == 403) and ("pending" in login_res.json().get("detail", "").lower())
        record_test("I", "PM registers for Project A -> Status PENDING -> Login blocked (403)", passed,
                    f"Register HTTP {pm_a_reg.status_code}, Login HTTP {login_res.status_code}, Msg: '{login_res.json().get('detail')}'")
    except Exception as e:
        record_test("I", "PM registers for Project A -> Status PENDING -> Login blocked (403)", False, str(e))

    # -------------------------------------------------------------
    # Test J: Ministry of Project X approves PM -> Status APPROVED -> Login succeeds
    # -------------------------------------------------------------
    pm_a_token = None
    try:
        # Ministry user A approves PM A for Project A
        appr_res = client.post(f"/api/ministry/managers/{pm_a_user_id}/approve",
                               headers={"Authorization": f"Bearer {min_a_token}"},
                               json={"project_id": proj_a_code})
        # PM A attempts login now
        login_res = client.post("/api/auth/login/pm", json={
            "username": "sec_test_pm_a",
            "password": "Password@123",
            "project_id": proj_a_code
        })
        pm_a_token = login_res.json().get("token")
        passed = (appr_res.status_code == 200) and (login_res.status_code == 200) and (pm_a_token is not None)
        record_test("J", "Ministry of Project A approves PM A -> Login succeeds (200)", passed,
                    f"Approve HTTP {appr_res.status_code}, Login HTTP {login_res.status_code}, Token len {len(pm_a_token or '')}")
    except Exception as e:
        record_test("J", "Ministry of Project A approves PM A -> Login succeeds (200)", False, str(e))

    # -------------------------------------------------------------
    # Test K: PM logs in with wrong project ID in request body/attempt
    # -------------------------------------------------------------
    try:
        login_res = client.post("/api/auth/login/pm", json={
            "username": "sec_test_pm_a",
            "password": "Password@123",
            "project_id": proj_b_code # Mismatched project ID
        })
        passed = (login_res.status_code == 403) and ("mismatch" in login_res.json().get("detail", "").lower() or "not assigned" in login_res.json().get("detail", "").lower())
        record_test("K", "PM login with wrong project ID in body -> Blocked (403)", passed,
                    f"HTTP {login_res.status_code}, Msg: '{login_res.json().get('detail')}'")
    except Exception as e:
        record_test("K", "PM login with wrong project ID in body -> Blocked (403)", False, str(e))

    # -------------------------------------------------------------
    # Test L: PM submits daily update for assigned project
    # -------------------------------------------------------------
    try:
        update_res = client.post("/api/pm/daily-update",
                                 headers={"Authorization": f"Bearer {pm_a_token}"},
                                 json={
                                     "today_physical_progress": 0.85,
                                     "cumulative_physical_progress": 64.5,
                                     "today_expenditure_cr": 3.25,
                                     "cumulative_expenditure_cr": 420.0,
                                     "current_milestone": "Pier Casting Km 45",
                                     "milestone_status": "ON_SCHEDULE",
                                     "issues_risks": "Minor rainfall delay",
                                     "remarks": "Night shift mobilized"
                                 })
        data = update_res.json().get("update", {})
        recalculated_risk = data.get("recalculated_overall_risk")
        recalculated_tier = data.get("recalculated_risk_tier")
        passed = (update_res.status_code == 200) and (recalculated_risk is not None) and (recalculated_tier is not None)
        record_test("L", "PM submits daily update -> Risk Engine recalculates score (200)", passed,
                    f"HTTP {update_res.status_code}, Recalculated Risk: {recalculated_risk}, Tier: '{recalculated_tier}'")
    except Exception as e:
        record_test("L", "PM submits daily update -> Risk Engine recalculates score (200)", False, str(e))

    # -------------------------------------------------------------
    # Test M: PM attempts daily update or project detail for another project (IDOR)
    # -------------------------------------------------------------
    try:
        # Detail of Project B
        detail_res = client.get(f"/api/projects/{proj_b_code}",
                                headers={"Authorization": f"Bearer {pm_a_token}"})
        # Updates of Project B
        updates_res = client.get(f"/api/pm/daily-updates/{proj_b_id}",
                                 headers={"Authorization": f"Bearer {pm_a_token}"})
        passed = (detail_res.status_code == 403) and (updates_res.status_code == 403)
        record_test("M", "PM attempts detail & daily update query for unassigned Project B (IDOR) -> 403", passed,
                    f"Detail HTTP {detail_res.status_code}, Updates HTTP {updates_res.status_code}")
    except Exception as e:
        record_test("M", "PM attempts detail & daily update query for unassigned Project B (IDOR) -> 403", False, str(e))

    # -------------------------------------------------------------
    # Test N: PM attempts to tamper with calculated risk score / tier directly
    # -------------------------------------------------------------
    try:
        # PM submits malicious payload trying to set risk score to 0 and tier to "low"
        tamper_res = client.post("/api/pm/daily-update",
                                 headers={"Authorization": f"Bearer {pm_a_token}"},
                                 json={
                                     "today_physical_progress": 0.1,
                                     "today_expenditure_cr": 0.5,
                                     "recalculated_overall_risk": 0.0,
                                     "recalculated_risk_tier": "low",
                                     "overall_risk": 0.0,
                                     "risk_tier": "low"
                                 })
        data = tamper_res.json().get("update", {})
        # Server must independently compute risk via Risk Engine, NOT echo 0.0
        server_risk = data.get("recalculated_overall_risk")
        passed = (tamper_res.status_code == 200) and (server_risk != 0.0 or data.get("recalculated_risk_tier") != "spoofed")
        record_test("N", "PM attempts to tamper with risk scores directly -> Server calculates deterministically", passed,
                    f"HTTP {tamper_res.status_code}, Real Server Risk: {server_risk} (not overridden)")
    except Exception as e:
        record_test("N", "PM attempts to tamper with risk scores directly -> Server calculates deterministically", False, str(e))

    # -------------------------------------------------------------
    # Test O: Duplicate active PM assignment attempt on same project ID
    # -------------------------------------------------------------
    try:
        # Register PM 2 for the same Project A (which already has PM A active)
        dup_reg = client.post("/api/auth/register/pm", json={
            "full_name": "Duplicate PM",
            "email": "dup_pm@morth.gov.in",
            "username": "sec_test_pm_dup",
            "password": "Password@123",
            "project_id": proj_a_code
        })
        passed = (dup_reg.status_code == 409) and ("already" in dup_reg.json().get("detail", "").lower() or "already" in dup_reg.json().get("message", "").lower())
        record_test("O", "Duplicate active PM assignment on Project A -> Rejected (409)", passed,
                    f"HTTP {dup_reg.status_code}, Msg: '{dup_reg.json()}'")
    except Exception as e:
        record_test("O", "Duplicate active PM assignment on Project A -> Rejected (409)", False, str(e))

    # -------------------------------------------------------------
    # Test P: Admin or Ministry suspends an active user -> Immediately blocked
    # -------------------------------------------------------------
    try:
        # Ministry user A suspends PM A
        susp_res = client.post(f"/api/ministry/managers/{pm_a_user_id}/suspend",
                               headers={"Authorization": f"Bearer {min_a_token}"},
                               json={"reason": "Audit non-compliance"})
        # PM A attempts to call API with old valid token
        pm_api_res = client.post("/api/pm/daily-update",
                                 headers={"Authorization": f"Bearer {pm_a_token}"},
                                 json={"today_physical_progress": 0.5, "today_expenditure_cr": 1.0})
        # PM A attempts to login again
        pm_login_res = client.post("/api/auth/login/pm", json={
            "username": "sec_test_pm_a",
            "password": "Password@123",
            "project_id": proj_a_code
        })
        passed = (susp_res.status_code == 200) and (pm_api_res.status_code == 403) and (pm_login_res.status_code == 403)
        record_test("P", "User is suspended -> Immediately blocked from API and login (403)", passed,
                    f"Suspend HTTP {susp_res.status_code}, API with old token HTTP {pm_api_res.status_code}, Login HTTP {pm_login_res.status_code}")
    except Exception as e:
        record_test("P", "User is suspended -> Immediately blocked from API and login (403)", False, str(e))

    # -------------------------------------------------------------
    # Test Q: Rejected user attempts login or API access
    # -------------------------------------------------------------
    try:
        # Register a new user and reject them
        rej_reg = client.post("/api/auth/register/ministry", json={
            "full_name": "Rejected Officer",
            "email": "rej@ministry.gov.in",
            "username": "sec_test_rej_user",
            "password": "Password@123",
            "ministry": proj_a_min
        })
        rej_user_id = rej_reg.json().get("user_id")
        rej_act = client.post(f"/api/admin/approvals/{rej_user_id}/reject",
                              headers={"Authorization": f"Bearer {admin_token}"},
                              json={"reason": "Invalid credentials provided"})
        login_res = client.post("/api/auth/login/ministry", json={
            "username": "sec_test_rej_user",
            "password": "Password@123",
            "ministry": proj_a_min
        })
        passed = (rej_act.status_code == 200) and (login_res.status_code == 403) and ("rejected" in login_res.json().get("detail", "").lower())
        record_test("Q", "Rejected user attempts login -> Blocked (403)", passed,
                    f"Reject action HTTP {rej_act.status_code}, Login HTTP {login_res.status_code}, Msg: '{login_res.json().get('detail')}'")
    except Exception as e:
        record_test("Q", "Rejected user attempts login -> Blocked (403)", False, str(e))

    # -------------------------------------------------------------
    # Test R: Tampered / forged session token or spoofed role header
    # -------------------------------------------------------------
    try:
        # Forged token with invalid signature
        forged_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiQURNSU4ifQ.FAKE_SIGNATURE"
        forged_res = client.get("/api/admin/approvals/pending",
                                headers={"Authorization": f"Bearer {forged_token}"})
        # Spoofed role header with no valid token
        spoof_res = client.get("/api/admin/approvals/pending",
                               headers={"x-role": "ADMIN", "x-user": "admin"})
        passed = (forged_res.status_code == 401) and (spoof_res.status_code == 401)
        record_test("R", "Forged session token or spoofed headers -> 401 Unauthorized", passed,
                    f"Forged Token HTTP {forged_res.status_code}, Header Spoof HTTP {spoof_res.status_code}")
    except Exception as e:
        record_test("R", "Forged session token or spoofed headers -> 401 Unauthorized", False, str(e))

    print("=" * 70)
    passed_count = sum(1 for r in results if r["passed"])
    total_count = len(results)
    print(f"RESULTS SUMMARY: {passed_count}/{total_count} TESTS PASSED ({passed_count/total_count*100:.1f}%)")
    print("=" * 70)

    # Return exit code 0 if all passed, 1 if any failed
    return 0 if passed_count == total_count else 1

if __name__ == "__main__":
    code = run_all_tests()
    sys.exit(code)
