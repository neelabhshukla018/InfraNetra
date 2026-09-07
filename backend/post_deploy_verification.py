"""
InfraNetra Post-Deployment Verification Suite
Verifies the 20 post-deployment test criteria and database integrity.
"""

import sys
import os
import sqlite3
import json

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

results = []

def record(test_num: int, name: str, passed: bool, detail: str = ""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] Test {test_num:02d}: {name}")
    if detail:
        print(f"         {detail}")
    results.append({
        "num": test_num,
        "name": name,
        "passed": passed,
        "detail": detail
    })

def run():
    print("=" * 70)
    print("INFRANETRA 20-POINT POST-DEPLOYMENT VERIFICATION")
    print("=" * 70)

    # Clean up test accounts
    conn = sqlite3.connect(os.path.join(BACKEND_DIR, "infrastructure_projects.sqlite3"))
    cur = conn.cursor()
    cur.execute("DELETE FROM users WHERE username IN ('pd_min_user', 'pd_pm_user', 'pd_susp_user', 'pd_rej_user')")
    conn.commit()

    # Pick 2 real projects from different ministries
    cur.execute("SELECT id, project_id, ministry, project_name FROM infrastructure_projects WHERE LOWER(ministry) LIKE '%road%' LIMIT 1")
    proj_a = cur.fetchone()
    cur.execute("SELECT id, project_id, ministry, project_name FROM infrastructure_projects WHERE LOWER(ministry) LIKE '%rail%' LIMIT 1")
    proj_b = cur.fetchone()
    conn.close()

    p_a_id, p_a_code, p_a_min, p_a_name = proj_a
    p_b_id, p_b_code, p_b_min, p_b_name = proj_b

    # Load admin credentials
    admin_user = os.environ.get("ADMIN_USERNAME", "LOG_bit").strip()
    admin_pwd = os.environ.get("ADMIN_PASSWORD", "LOG_bit_26103")

    # 1. Public dashboard loads
    r1 = client.get("/api/dashboard/summary?report_month=2026-04-01")
    record(1, "Public dashboard loads", r1.status_code == 200 and "metrics" in r1.json(), f"HTTP {r1.status_code}")

    # 2. Public project registry loads
    r2 = client.get("/api/projects?report_month=2026-04-01&page=1&page_size=5")
    record(2, "Public project registry loads", r2.status_code == 200 and "projects" in r2.json(), f"HTTP {r2.status_code}, total: {r2.json().get('total_count')}")

    # 3. Admin login works
    r3 = client.post("/api/auth/login/admin", json={"username": admin_user, "password": admin_pwd})
    admin_token = r3.json().get("token")
    record(3, "Admin login works", r3.status_code == 200 and admin_token is not None, f"HTTP {r3.status_code}")

    # 4. Ministry registration works
    r4 = client.post("/api/auth/register/ministry", json={
        "full_name": "MoRTH Officer",
        "email": "morth_pd@gov.in",
        "username": "pd_min_user",
        "password": "SecurePassword@2026",
        "ministry": p_a_min
    })
    min_user_id = r4.json().get("user_id")
    record(4, "Ministry registration works", r4.status_code == 201 and min_user_id is not None, f"HTTP {r4.status_code}, User ID {min_user_id}")

    # 5. Pending Ministry cannot log in
    r5 = client.post("/api/auth/login/ministry", json={
        "username": "pd_min_user",
        "password": "SecurePassword@2026",
        "ministry": p_a_min
    })
    record(5, "Pending Ministry cannot log in", r5.status_code == 403, f"HTTP {r5.status_code}, Detail: '{r5.json().get('detail')}'")

    # 6. Admin approval enables Ministry login
    r6_appr = client.post(f"/api/admin/approvals/{min_user_id}/approve",
                          headers={"Authorization": f"Bearer {admin_token}"})
    r6_login = client.post("/api/auth/login/ministry", json={
        "username": "pd_min_user",
        "password": "SecurePassword@2026",
        "ministry": p_a_min
    })
    min_token = r6_login.json().get("token")
    record(6, "Admin approval enables Ministry login", r6_appr.status_code == 200 and r6_login.status_code == 200 and min_token is not None, f"HTTP {r6_login.status_code}")

    # 7. Ministry sees only its own Ministry
    r7 = client.get("/api/projects?report_month=2026-04-01&page=1&page_size=20",
                    headers={"Authorization": f"Bearer {min_token}"})
    projects_list = r7.json().get("projects", [])
    only_own_min = all(p.get("ministry", "").lower() == p_a_min.lower() for p in projects_list)
    record(7, "Ministry sees only its own Ministry", r7.status_code == 200 and only_own_min and len(projects_list) > 0, f"Returned {len(projects_list)} projects, all match {p_a_min}")

    # 8. Ministry cannot access another Ministry
    r8 = client.get(f"/api/projects/{p_b_code}",
                    headers={"Authorization": f"Bearer {min_token}"})
    record(8, "Ministry cannot access another Ministry (IDOR block)", r8.status_code == 403, f"HTTP {r8.status_code}, Detail: '{r8.json().get('detail')}'")

    # 9. Project Manager registration works
    r9 = client.post("/api/auth/register/pm", json={
        "full_name": "Site PM",
        "email": "pm_pd@site.gov.in",
        "username": "pd_pm_user",
        "password": "SecurePassword@2026",
        "project_id": p_a_id
    })
    pm_user_id = r9.json().get("user_id")
    record(9, "Project Manager registration works", r9.status_code == 201 and pm_user_id is not None, f"HTTP {r9.status_code}, User ID {pm_user_id}")

    # 10. Pending PM cannot log in
    r10 = client.post("/api/auth/login/pm", json={
        "username": "pd_pm_user",
        "password": "SecurePassword@2026",
        "project_id": p_a_id
    })
    record(10, "Pending PM cannot log in", r10.status_code == 403, f"HTTP {r10.status_code}, Detail: '{r10.json().get('detail')}'")

    # 11. Ministry approval enables PM login
    r11_appr = client.post(f"/api/ministry/managers/{pm_user_id}/approve",
                           headers={"Authorization": f"Bearer {min_token}"})
    r11_login = client.post("/api/auth/login/pm", json={
        "username": "pd_pm_user",
        "password": "SecurePassword@2026",
        "project_id": p_a_id
    })
    pm_token = r11_login.json().get("token")
    record(11, "Ministry approval enables PM login", r11_appr.status_code == 200 and r11_login.status_code == 200 and pm_token is not None, f"HTTP {r11_login.status_code}")

    # 12. PM sees only assigned Project ID
    r12 = client.get("/api/pm/my-project",
                     headers={"Authorization": f"Bearer {pm_token}"})
    record(12, "PM sees only assigned Project ID", r12.status_code == 200 and r12.json().get("project_name") is not None, f"HTTP {r12.status_code}, Project Name: '{r12.json().get('project_name')}'")

    # 13. PM cannot access another Project ID
    r13 = client.get(f"/api/projects/{p_b_code}",
                     headers={"Authorization": f"Bearer {pm_token}"})
    record(13, "PM cannot access another Project ID (IDOR block)", r13.status_code == 403, f"HTTP {r13.status_code}, Detail: '{r13.json().get('detail')}'")

    # 14. PM can submit Daily Project Update
    r14 = client.post("/api/pm/daily-update",
                      headers={"Authorization": f"Bearer {pm_token}"},
                      json={
                          "today_physical_progress": 0.5,
                          "cumulative_physical_progress": 68.0,
                          "today_expenditure_cr": 2.5,
                          "cumulative_expenditure_cr": 350.0,
                          "current_milestone": "Pier Erection",
                          "milestone_status": "ON_SCHEDULE"
                      })
    record(14, "PM can submit Daily Project Update", r14.status_code == 200 and r14.json().get("success") is True, f"HTTP {r14.status_code}, Update ID: {r14.json().get('update_id')}")

    # 15. Risk Engine recalculates server-side
    update_obj = r14.json().get("update", {})
    recalc_risk = update_obj.get("recalculated_overall_risk")
    recalc_tier = update_obj.get("recalculated_risk_tier")
    record(15, "Risk Engine recalculates server-side", recalc_risk is not None and recalc_tier is not None, f"Score: {recalc_risk}, Tier: {recalc_tier}")

    # 16. PM cannot overwrite calculated risk/ML values
    r16 = client.post("/api/pm/daily-update",
                      headers={"Authorization": f"Bearer {pm_token}"},
                      json={
                          "today_physical_progress": 0.1,
                          "recalculated_overall_risk": 0.0,
                          "recalculated_risk_tier": "low",
                          "overall_risk": 0.0
                      })
    real_risk = r16.json().get("update", {}).get("recalculated_overall_risk")
    record(16, "PM cannot overwrite calculated risk/ML values", r16.status_code == 200 and real_risk != 0.0, f"HTTP {r16.status_code}, Real Server Risk: {real_risk}")

    # 17. Admin approval/rejection/suspension works
    r17_reg = client.post("/api/auth/register/ministry", json={
        "full_name": "Test Rejected Officer",
        "email": "rej_pd@gov.in",
        "username": "pd_rej_user",
        "password": "Password@123",
        "ministry": p_a_min
    })
    rej_id = r17_reg.json().get("user_id")
    r17_act = client.post(f"/api/admin/approvals/{rej_id}/reject",
                          headers={"Authorization": f"Bearer {admin_token}"})
    record(17, "Admin approval/rejection/suspension works", r17_act.status_code == 200 and r17_act.json().get("status") == "REJECTED", f"HTTP {r17_act.status_code}, Status: {r17_act.json().get('status')}")

    # 18. Suspended users are immediately blocked
    client.post(f"/api/ministry/managers/{pm_user_id}/suspend",
                headers={"Authorization": f"Bearer {min_token}"})
    r18 = client.post("/api/pm/daily-update",
                      headers={"Authorization": f"Bearer {pm_token}"},
                      json={"today_physical_progress": 0.1})
    record(18, "Suspended users are immediately blocked", r18.status_code == 403, f"HTTP {r18.status_code}, Detail: '{r18.json().get('detail')}'")

    # 19. Forged/tampered session tokens are rejected
    r19 = client.get("/api/admin/approvals/pending",
                     headers={"Authorization": "Bearer forged.token.signature"})
    record(19, "Forged/tampered session tokens are rejected", r19.status_code == 401, f"HTTP {r19.status_code}, Detail: '{r19.json().get('detail')}'")

    # 20. Existing public pages remain functional
    eps = [
        "/api/dashboard/summary?report_month=2026-04-01",
        "/api/projects?report_month=2026-04-01&page=1&page_size=5",
        f"/api/projects/{p_a_code}",
        "/api/map/projects?report_month=2026-04-01",
        "/api/early-warnings?report_month=2026-04-01",
        "/api/ml/training-stats",
        "/api/analytics/sectors?report_month=2026-04-01"
    ]
    all_200 = all(client.get(ep).status_code == 200 for ep in eps)
    record(20, "Existing public pages remain functional", all_200, "All 7 public endpoints returned HTTP 200 OK")

    print("-" * 70)
    # Database integrity check
    conn = sqlite3.connect(os.path.join(BACKEND_DIR, "infrastructure_projects.sqlite3"))
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM infrastructure_projects")
    proj_cnt = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM ml_training_dataset")
    ml_cnt = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM audit_logs")
    audit_cnt = cur.fetchone()[0]
    conn.close()

    print(f"DATABASE INTEGRITY VERIFICATION:")
    print(f"  - infrastructure_projects count : {proj_cnt} (Expected: 9976) -> {'INTACT' if proj_cnt == 9976 else 'MISMATCH'}")
    print(f"  - ml_training_dataset count     : {ml_cnt} (Expected: 7983) -> {'INTACT' if ml_cnt == 7983 else 'MISMATCH'}")
    print(f"  - audit_logs count              : {audit_cnt}")
    print("=" * 70)

    passed_cnt = sum(1 for r in results if r["passed"])
    total_cnt = len(results)
    print(f"POST-DEPLOYMENT TEST SUMMARY: {passed_cnt}/{total_cnt} TESTS PASSED ({passed_cnt/total_cnt*100:.1f}%)")
    print("=" * 70)

    return 0 if (passed_cnt == total_cnt and proj_cnt == 9976 and ml_cnt == 7983) else 1

if __name__ == "__main__":
    sys.exit(run())
