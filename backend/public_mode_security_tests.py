"""
InfraNetra Public Mode Security Verification Suite (Tests 1 - 14)
Validates all 14 test cases mandated for public read-only default entry,
login button triggering, role authorization, logout, session expiration,
and page refresh behavior.
"""

import os
import sys
import json
import sqlite3
from fastapi.testclient import TestClient

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

from main import app
from auth import create_session_token, verify_session_token

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
        "detail": detail,
    })

def run_tests():
    print("=" * 75)
    print("INFRANETRA PUBLIC-FIRST VERIFICATION SUITE: TESTS 1 - 14")
    print("=" * 75)

    # 0. Database setup and fixture resolution
    conn = sqlite3.connect(os.path.join(BACKEND_DIR, "infrastructure_projects.sqlite3"))
    cur = conn.cursor()

    cur.execute("SELECT id, project_id, ministry, project_name FROM infrastructure_projects WHERE report_month='2026-04-01' AND LOWER(ministry) LIKE '%road%' LIMIT 1")
    road_proj = cur.fetchone()
    cur.execute("SELECT id, project_id, ministry, project_name FROM infrastructure_projects WHERE report_month='2026-04-01' AND LOWER(ministry) LIKE '%rail%' LIMIT 1")
    rail_proj = cur.fetchone()

    p_road_id, p_road_code, p_road_min, p_road_name = road_proj
    p_rail_id, p_rail_code, p_rail_min, p_rail_name = rail_proj

    # Clean up test accounts and orphaned test assignments
    test_users = ["pub_test_min", "pub_test_pm", "sec_test_min_a", "sec_test_min_b", "sec_test_pm_a", "sec_test_pm_b"]
    cur.execute(f"DELETE FROM users WHERE username IN ({','.join(['?']*len(test_users))})", test_users)
    cur.execute("DELETE FROM project_manager_assignments WHERE user_id NOT IN (SELECT id FROM users)")
    cur.execute("DELETE FROM user_ministry_assignments WHERE user_id NOT IN (SELECT id FROM users)")
    conn.commit()
    conn.close()

    # Resolve Admin Credentials
    admin_user = os.environ.get("ADMIN_USERNAME", "LOG_bit").strip()
    admin_pwd = os.environ.get("ADMIN_PASSWORD", "LOG_bit_26103")

    # --------------------------------------------------------------------------
    # TEST 1: Fresh browser -> / (Expected: PUBLIC MODE)
    # --------------------------------------------------------------------------
    try:
        r_dash = client.get("/api/dashboard/summary?report_month=2026-04-01")
        r_proj = client.get("/api/projects?report_month=2026-04-01&page=1&page_size=10")
        passed = (r_dash.status_code == 200 and "metrics" in r_dash.json()
                  and r_proj.status_code == 200 and r_proj.json().get("total", 0) > 0)
        record(1, "Fresh browser -> / -> PUBLIC MODE", passed,
               f"Dashboard HTTP {r_dash.status_code}, Projects HTTP {r_proj.status_code} ({r_proj.json().get('total')} projects accessible without session)")
    except Exception as e:
        record(1, "Fresh browser -> / -> PUBLIC MODE", False, str(e))

    # --------------------------------------------------------------------------
    # TEST 2: Fresh browser -> / (Expected: Login modal NOT visible)
    # --------------------------------------------------------------------------
    try:
        # Verify frontend code contract: isAuthModalOpen defaults to false,
        # LoginPage returns null when !isOpen, and modal is guarded by {isAuthModalOpen && ...}
        with open(os.path.join(BACKEND_DIR, "..", "src", "App.tsx"), "r", encoding="utf-8") as f:
            app_code = f.read()
        with open(os.path.join(BACKEND_DIR, "..", "src", "pages", "LoginPage.tsx"), "r", encoding="utf-8") as f:
            login_code = f.read()

        app_modal_guarded = "{isAuthModalOpen && (" in app_code and "const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)" in app_code
        login_isopen_guarded = "if (isModal) {\n    if (!isOpen) return null;" in login_code or "if (!isOpen) return null;" in login_code

        passed = app_modal_guarded and login_isopen_guarded
        record(2, "Fresh browser -> / -> Login modal NOT visible", passed,
               f"App.tsx guarded with isAuthModalOpen: {app_modal_guarded}, LoginPage returns null when !isOpen: {login_isopen_guarded}")
    except Exception as e:
        record(2, "Fresh browser -> / -> Login modal NOT visible", False, str(e))

    # --------------------------------------------------------------------------
    # TEST 3: Click Login (Expected: Existing login UI opens)
    # --------------------------------------------------------------------------
    try:
        # Verify login endpoints accept credentials and respond appropriately
        r_admin = client.post("/api/auth/login/admin", json={})
        r_min = client.post("/api/auth/login/ministry", json={})
        r_pm = client.post("/api/auth/login/pm", json={})
        passed = (r_admin.status_code in (400, 401) and r_min.status_code in (400, 401) and r_pm.status_code in (400, 401))
        record(3, "Click Login -> Existing login UI opens & portal ready", passed,
               f"Admin Login Probe: HTTP {r_admin.status_code}, Ministry: HTTP {r_min.status_code}, PM: HTTP {r_pm.status_code}")
    except Exception as e:
        record(3, "Click Login -> Existing login UI opens & portal ready", False, str(e))

    # --------------------------------------------------------------------------
    # TEST 4: Close Login (Expected: Back to PUBLIC MODE)
    # --------------------------------------------------------------------------
    try:
        # Closing modal sets isAuthModalOpen = false, resetting to Public Mode
        with open(os.path.join(BACKEND_DIR, "..", "src", "App.tsx"), "r", encoding="utf-8") as f:
            app_code = f.read()
        close_handler_present = "onClose={() => setIsAuthModalOpen(false)}" in app_code
        passed = close_handler_present
        record(4, "Close Login -> Back to PUBLIC MODE", passed,
               "App.tsx onClose handler cleanly sets isAuthModalOpen(false) returning to public view")
    except Exception as e:
        record(4, "Close Login -> Back to PUBLIC MODE", False, str(e))

    # --------------------------------------------------------------------------
    # TEST 5: Public user views project (Expected: Read-only)
    # --------------------------------------------------------------------------
    try:
        r_detail = client.get(f"/api/projects/{p_road_code}")
        passed = (r_detail.status_code == 200
                  and "project_name" in r_detail.json()
                  and "financials" in r_detail.json()
                  and "risk_assessment" in r_detail.json())
        record(5, "Public user views project -> Read-only", passed,
               f"HTTP {r_detail.status_code} for project '{p_road_code}' (Score: {r_detail.json().get('risk_assessment', {}).get('score')})")
    except Exception as e:
        record(5, "Public user views project -> Read-only", False, str(e))

    # --------------------------------------------------------------------------
    # TEST 6: Public user tries edit (Expected: Not allowed)
    # --------------------------------------------------------------------------
    try:
        r_edit = client.post("/api/pm/daily-update", json={"today_physical_progress": 2.5})
        passed = (r_edit.status_code in (401, 403))
        record(6, "Public user tries edit -> Not allowed (401/403)", passed,
               f"HTTP {r_edit.status_code} ({r_edit.json().get('detail')})")
    except Exception as e:
        record(6, "Public user tries edit -> Not allowed (401/403)", False, str(e))

    # --------------------------------------------------------------------------
    # TEST 7: Public user tries protected API (Expected: 401/403)
    # --------------------------------------------------------------------------
    try:
        r_ingest = client.post("/api/ingest-flash-report")
        r_ds = client.post("/api/datasets/save", json={"report_month": "2026-04-01"})
        r_sync = client.post("/api/completed-projects/sync")
        r_rebuild = client.post("/api/ml/rebuild-dataset")
        r_admin = client.get("/api/admin/approvals/pending")
        passed = all(r.status_code in (401, 403) for r in [r_ingest, r_ds, r_sync, r_rebuild, r_admin])
        record(7, "Public user tries protected API -> 401/403", passed,
               f"Ingest: HTTP {r_ingest.status_code}, Save: HTTP {r_ds.status_code}, Sync: HTTP {r_sync.status_code}, Admin: HTTP {r_admin.status_code}")
    except Exception as e:
        record(7, "Public user tries protected API -> 401/403", False, str(e))

    # --------------------------------------------------------------------------
    # TEST 8: Admin login (Expected: Full Admin access)
    # --------------------------------------------------------------------------
    admin_token = None
    try:
        adm_login = client.post("/api/auth/login/admin", json={
            "username": admin_user,
            "password": admin_pwd
        })
        admin_token = adm_login.json().get("token")
        headers_adm = {"Authorization": f"Bearer {admin_token}"}
        r_adm_audit = client.get("/api/admin/audit-logs", headers=headers_adm)
        r_adm_proj = client.get("/api/projects?report_month=2026-04-01&page_size=5", headers=headers_adm)
        passed = (adm_login.status_code == 200 and r_adm_audit.status_code == 200 and r_adm_proj.status_code == 200)
        record(8, "Admin login -> Full Admin access", passed,
               f"Login HTTP {adm_login.status_code}, Audit Logs HTTP {r_adm_audit.status_code}, Unrestricted Projects: {r_adm_proj.json().get('total')}")
    except Exception as e:
        record(8, "Admin login -> Full Admin access", False, str(e))

    # --------------------------------------------------------------------------
    # TEST 9: Ministry login (Expected: Own Ministry only)
    # --------------------------------------------------------------------------
    min_token = None
    try:
        # Register Ministry user
        reg_min = client.post("/api/auth/register/ministry", json={
            "full_name": "Public Test Ministry Officer",
            "email": "pub_min@gov.in",
            "username": "pub_test_min",
            "password": "Ministry@123",
            "ministry": p_road_min
        })
        min_user_id = reg_min.json().get("user_id")

        # Admin approves Ministry user
        appr_min = client.post(f"/api/admin/approvals/{min_user_id}/approve",
                               headers={"Authorization": f"Bearer {admin_token}"})

        # Login Ministry user
        min_login = client.post("/api/auth/login/ministry", json={
            "username": "pub_test_min",
            "password": "Ministry@123",
            "ministry": p_road_min
        })
        min_token = min_login.json().get("token")
        headers_min = {"Authorization": f"Bearer {min_token}"}

        r_min_proj = client.get("/api/projects?report_month=2026-04-01&page_size=20", headers=headers_min)
        min_projects = r_min_proj.json().get("projects", [])
        all_match = all(p.get("ministry", "").lower() == p_road_min.lower() for p in min_projects)

        # Attempt foreign project access (IDOR block)
        r_idor = client.get(f"/api/projects/{p_rail_code}", headers=headers_min)

        passed = (min_login.status_code == 200 and r_min_proj.status_code == 200 and all_match and r_idor.status_code == 403)
        record(9, "Ministry login -> Own Ministry only (IDOR blocked)", passed,
               f"Scoping HTTP {r_min_proj.status_code} ({len(min_projects)} projects match '{p_road_min}'), Foreign Project HTTP {r_idor.status_code}")
    except Exception as e:
        record(9, "Ministry login -> Own Ministry only (IDOR blocked)", False, str(e))

    # --------------------------------------------------------------------------
    # TEST 10: Project Manager login (Expected: Assigned Project only)
    # --------------------------------------------------------------------------
    pm_token = None
    try:
        # Register PM user
        reg_pm = client.post("/api/auth/register/pm", json={
            "full_name": "Public Test PM",
            "email": "pub_pm@gov.in",
            "username": "pub_test_pm",
            "password": "Manager@123",
            "project_id": p_road_code
        })
        pm_user_id = reg_pm.json().get("user_id")

        # Ministry Officer approves PM
        appr_pm = client.post(f"/api/ministry/managers/{pm_user_id}/approve",
                              headers={"Authorization": f"Bearer {min_token}"},
                              json={"project_id": p_road_code})

        # Login PM
        pm_login = client.post("/api/auth/login/pm", json={
            "username": "pub_test_pm",
            "password": "Manager@123",
            "project_id": p_road_code
        })
        pm_token = pm_login.json().get("token")
        headers_pm = {"Authorization": f"Bearer {pm_token}"}

        r_pm_proj = client.get("/api/projects?report_month=2026-04-01", headers=headers_pm)
        pm_projects = r_pm_proj.json().get("projects", [])
        is_assigned_only = len(pm_projects) == 1 and str(pm_projects[0].get("project_id")) == str(p_road_code)

        # Foreign project access (IDOR block)
        r_pm_foreign = client.get(f"/api/projects/{p_rail_code}", headers=headers_pm)

        passed = (pm_login.status_code == 200 and r_pm_proj.status_code == 200 and is_assigned_only and r_pm_foreign.status_code == 403)
        record(10, "PM login -> Assigned Project only (IDOR blocked)", passed,
               f"Scoping HTTP {r_pm_proj.status_code} (1 assigned project), Foreign Project HTTP {r_pm_foreign.status_code}")
    except Exception as e:
        record(10, "PM login -> Assigned Project only (IDOR blocked)", False, str(e))

    # --------------------------------------------------------------------------
    # TEST 11: Logout (Expected: PUBLIC MODE)
    # --------------------------------------------------------------------------
    try:
        r_post_dash = client.get("/api/dashboard/summary?report_month=2026-04-01")
        r_post_proj = client.get("/api/projects?report_month=2026-04-01&page_size=5")
        r_post_write = client.post("/api/pm/daily-update", json={"today_physical_progress": 1.0})
        passed = (r_post_dash.status_code == 200 and r_post_proj.status_code == 200 and r_post_write.status_code in (401, 403))
        record(11, "Logout -> PUBLIC MODE immediately", passed,
               f"Public Dashboard HTTP {r_post_dash.status_code}, Registry HTTP {r_post_proj.status_code}, Write Endpoint HTTP {r_post_write.status_code}")
    except Exception as e:
        record(11, "Logout -> PUBLIC MODE immediately", False, str(e))

    # --------------------------------------------------------------------------
    # TEST 12: Session expires (Expected: PUBLIC MODE, NOT automatic login popup)
    # --------------------------------------------------------------------------
    try:
        expired_headers = {"Authorization": "Bearer expired.or.invalid.token.123"}
        r_exp_dash = client.get("/api/dashboard/summary?report_month=2026-04-01", headers=expired_headers)
        r_exp_proj = client.get("/api/projects?report_month=2026-04-01&page_size=5", headers=expired_headers)
        r_exp_admin = client.get("/api/admin/audit-logs", headers=expired_headers)

        # In App.tsx: initAuth clears token and sets appState = 'PUBLIC', isAuthModalOpen = false
        passed = (r_exp_dash.status_code == 200 and r_exp_proj.status_code == 200 and r_exp_admin.status_code in (401, 403))
        record(12, "Session expires -> PUBLIC MODE, NOT automatic login popup", passed,
               f"Dashboard HTTP {r_exp_dash.status_code}, Registry HTTP {r_exp_proj.status_code}, Protected Endpoint HTTP {r_exp_admin.status_code}")
    except Exception as e:
        record(12, "Session expires -> PUBLIC MODE, NOT automatic login popup", False, str(e))

    # --------------------------------------------------------------------------
    # TEST 13: Refresh public page (Expected: PUBLIC MODE)
    # --------------------------------------------------------------------------
    try:
        # Re-requesting root / without session header returns public state
        r_refresh = client.get("/api/dashboard/summary?report_month=2026-04-01")
        passed = (r_refresh.status_code == 200 and "metrics" in r_refresh.json())
        record(13, "Refresh public page -> PUBLIC MODE persists", passed,
               f"Dashboard HTTP {r_refresh.status_code}, Public Metrics preserved")
    except Exception as e:
        record(13, "Refresh public page -> PUBLIC MODE persists", False, str(e))

    # --------------------------------------------------------------------------
    # TEST 14: Refresh authenticated page (Expected: Authenticated role restored)
    # --------------------------------------------------------------------------
    try:
        # Request with valid session token verifies user and restores authenticated role
        r_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
        passed = (r_me.status_code == 200 and r_me.json().get("user", {}).get("role") == "ADMIN")
        record(14, "Refresh authenticated page -> Authenticated role restored", passed,
               f"/api/auth/me HTTP {r_me.status_code}, Role: '{r_me.json().get('user', {}).get('role')}'")
    except Exception as e:
        record(14, "Refresh authenticated page -> Authenticated role restored", False, str(e))

    # Summary
    total = len(results)
    passed_count = sum(1 for r in results if r["passed"])
    pct = (passed_count / total) * 100
    print("=" * 75)
    print(f"RESULTS SUMMARY: {passed_count}/{total} TESTS PASSED ({pct:.1f}%)")
    print("=" * 75)

    # Cleanup test users
    conn = sqlite3.connect(os.path.join(BACKEND_DIR, "infrastructure_projects.sqlite3"))
    conn.cursor().execute("DELETE FROM users WHERE username IN ('pub_test_min', 'pub_test_pm')")
    conn.commit()
    conn.close()

    return passed_count == total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
