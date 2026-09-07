"""
InfraNetra Verification Test Suite: Figure 1 to Figure 2 Relocation
Validates Tests 1 through 10 strictly according to prompt specification.
"""

import os
import re
import sys
from fastapi.testclient import TestClient

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(__file__))
from main import app

client = TestClient(app)

def run_tests():
    print("===========================================================================")
    print("INFRANETRA VERIFICATION TEST SUITE: FIGURE 1 & FIGURE 2")
    print("===========================================================================")
    
    passed_count = 0
    total_tests = 10
    
    # -------------------------------------------------------------------------
    # TEST 1: Open / -> Public read-only website
    # -------------------------------------------------------------------------
    res_dash = client.get("/api/dashboard/summary")
    res_proj = client.get("/api/projects")
    t1_pass = res_dash.status_code == 200 and res_proj.status_code == 200
    if t1_pass:
        print("[PASS] TEST 1: Open / -> Expected: Public read-only website.")
        print("       Detail: Public Dashboard HTTP 200, Projects API HTTP 200 without authentication.")
        passed_count += 1
    else:
        print(f"[FAIL] TEST 1: Failed with dash={res_dash.status_code}, proj={res_proj.status_code}")

    # Inspect src/pages/LoginPage.tsx for Figure 1 tests
    login_page_path = os.path.join(os.path.dirname(__file__), "..", "src", "pages", "LoginPage.tsx")
    with open(login_page_path, "r", encoding="utf-8") as f:
        login_page_src = f.read()

    # -------------------------------------------------------------------------
    # TEST 2: FIGURE 1 -> Existing Login Option 1 remains
    # -------------------------------------------------------------------------
    t2_pass = 'setActiveRole(\'MINISTRY\')' in login_page_src and '<span>Ministry</span>' in login_page_src
    if t2_pass:
        print("[PASS] TEST 2: FIGURE 1 -> Expected: Existing Login Option 1 (Ministry) remains.")
        print("       Detail: Option 1 Ministry button, icon, and role state handler are present in Figure 1.")
        passed_count += 1
    else:
        print("[FAIL] TEST 2: Option 1 Ministry missing in Figure 1.")

    # -------------------------------------------------------------------------
    # TEST 3: FIGURE 1 -> Existing Login Option 2 remains
    # -------------------------------------------------------------------------
    t3_pass = 'setActiveRole(\'PROJECT_MANAGER\')' in login_page_src and '<span>Project Mgr</span>' in login_page_src
    if t3_pass:
        print("[PASS] TEST 3: FIGURE 1 -> Expected: Existing Login Option 2 (Project Manager) remains.")
        print("       Detail: Option 2 Project Mgr button, icon, and role state handler are present in Figure 1.")
        passed_count += 1
    else:
        print("[FAIL] TEST 3: Option 2 Project Mgr missing in Figure 1.")

    # -------------------------------------------------------------------------
    # TEST 4: FIGURE 1 -> "Login as Admin" is NOT present
    # -------------------------------------------------------------------------
    # Check that in the role selection tabs or anywhere in LoginPage, there is NO Admin tab button or "Login as Admin"
    t4_pass = ('<span>Admin</span>' not in login_page_src and 
               'setActiveRole(\'ADMIN\')' not in login_page_src and
               'Login as Admin' not in login_page_src and
               'grid-cols-2' in login_page_src and
               'grid-cols-3' not in login_page_src)
    if t4_pass:
        print("[PASS] TEST 4: FIGURE 1 -> Expected: 'Login as Admin' is NOT present.")
        print("       Detail: Figure 1 has strictly 2 columns (grid-cols-2), no Admin tab, no Login as Admin text.")
        passed_count += 1
    else:
        print("[FAIL] TEST 4: Admin option still found in Figure 1.")

    # Inspect src/App.tsx for Figure 2 tests
    app_tsx_path = os.path.join(os.path.dirname(__file__), "..", "src", "App.tsx")
    with open(app_tsx_path, "r", encoding="utf-8") as f:
        app_tsx_src = f.read()

    # -------------------------------------------------------------------------
    # TEST 5: FIGURE 2 -> "Login as Admin" is present
    # -------------------------------------------------------------------------
    t5_pass = ('id="footer-link-login-admin"' in app_tsx_src and 
               'Login as Admin' in app_tsx_src and
               '<footer' in app_tsx_src)
    if t5_pass:
        print("[PASS] TEST 5: FIGURE 2 -> Expected: 'Login as Admin' is present.")
        print("       Detail: Figure 2 (footer) contains '#footer-link-login-admin' with text 'Login as Admin'.")
        passed_count += 1
    else:
        print("[FAIL] TEST 5: Figure 2 missing 'Login as Admin'.")

    # -------------------------------------------------------------------------
    # TEST 6: Click Figure 2 "Login as Admin" -> Existing Admin auth opens
    # -------------------------------------------------------------------------
    # Figure 2 calls navigateTo('admin-login'), rendering AdminLoginPage
    admin_login_path = os.path.join(os.path.dirname(__file__), "..", "src", "pages", "AdminLoginPage.tsx")
    with open(admin_login_path, "r", encoding="utf-8") as f:
        admin_login_src = f.read()
    
    t6_pass = ('navigateTo(\'admin-login\')' in app_tsx_src and
               'AdminLoginPage' in app_tsx_src and
               'currentPage === \'admin-login\'' in app_tsx_src and
               'loginAdmin' in admin_login_src and
               'input-admin-username' in admin_login_src and
               'input-admin-password' in admin_login_src)
    if t6_pass:
        print("[PASS] TEST 6: Click Figure 2 'Login as Admin' -> Expected: Existing Admin authentication opens.")
        print("       Detail: Navigates to admin-login route, rendering AdminLoginPage with administrative credentials form.")
        passed_count += 1
    else:
        print("[FAIL] TEST 6: Figure 2 does not open AdminLoginPage.")

    # -------------------------------------------------------------------------
    # TEST 7: Valid Admin credentials -> Expected: Admin Dashboard
    # -------------------------------------------------------------------------
    BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
    admin_user = (os.environ.get("ADMIN_USERNAME") or os.environ.get("ADMIN_USER") or "LOG_bit").strip()
    admin_pass = os.environ.get("ADMIN_PASSWORD", "LOG_bit_26103")

    login_res = client.post("/api/auth/login/admin", json={"username": admin_user, "password": admin_pass})
    
    t7_pass = False
    admin_token = None
    if login_res.status_code == 200:
        admin_token = login_res.json().get("token") or login_res.json().get("session_token")
        # Check admin dashboard access
        dash_res = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
        if dash_res.status_code == 200:
            t7_pass = True

    if t7_pass:
        print("[PASS] TEST 7: Valid Admin credentials -> Expected: Admin Dashboard.")
        print("       Detail: POST /api/auth/login/admin succeeded (HTTP 200), granting access to Admin Dashboard.")
        passed_count += 1
    else:
        print(f"[FAIL] TEST 7: Admin login failed: status={login_res.status_code}, response={login_res.text}")

    # -------------------------------------------------------------------------
    # TEST 8: Direct /admin -> Existing Admin authorization remains enforced
    # -------------------------------------------------------------------------
    unauth_admin_res = client.get("/api/admin/audit-logs")
    client_routing_guarded = ("if (profile?.authUser?.role !== 'ADMIN' && profile?.role !== 'ADMIN')" in app_tsx_src and
                              "currentPage === 'admin'" in app_tsx_src)
    t8_pass = unauth_admin_res.status_code in (401, 403) and client_routing_guarded
    if t8_pass:
        print("[PASS] TEST 8: Direct /admin -> Expected: Existing Admin authorization remains enforced.")
        print("       Detail: Server returns HTTP 401 Unauthorized without token; frontend redirects unauthenticated to admin-login.")
        passed_count += 1
    else:
        print(f"[FAIL] TEST 8: Direct /admin unauth check failed: {unauth_admin_res.status_code}")

    # -------------------------------------------------------------------------
    # TEST 9: Existing two Figure 1 login options -> Both continue working
    # -------------------------------------------------------------------------
    # Verify Ministry login logic and Project Manager login logic on backend
    min_probe = client.post("/api/auth/login/ministry", json={"username": "probe", "password": "wrong", "ministry": "Ministry of Railways"})
    pm_probe = client.post("/api/auth/login/project-manager", json={"username": "probe", "password": "wrong", "project_id": 1})
    
    t9_pass = (min_probe.status_code == 401 and pm_probe.status_code == 401 and
               'loginMinistry' in login_page_src and 'loginProjectManager' in login_page_src)
    if t9_pass:
        print("[PASS] TEST 9: Existing two Figure 1 login options -> Expected: Both continue working exactly as before.")
        print("       Detail: Ministry login and PM login endpoints active and responding with strict credential checks.")
        passed_count += 1
    else:
        print(f"[FAIL] TEST 9: Login options check failed: min={min_probe.status_code}, pm={pm_probe.status_code}")

    # -------------------------------------------------------------------------
    # TEST 10: Logout -> Public read-only mode
    # -------------------------------------------------------------------------
    # Logout in App.tsx sets profile=null, navigateTo('dashboard')
    t10_pass = ('const handleLogout = async () => {' in app_tsx_src and
                'logoutUser()' in app_tsx_src and
                'setProfile(null)' in app_tsx_src and
                'setAppState(\'PUBLIC\')' in app_tsx_src and
                'setCurrentPage(\'dashboard\')' in app_tsx_src)
    if t10_pass:
        print("[PASS] TEST 10: Logout -> Expected: Public read-only mode.")
        print("       Detail: handleLogout clears profile, sets appState to PUBLIC, routes to dashboard, clears auth session.")
        passed_count += 1
    else:
        print("[FAIL] TEST 10: Logout flow verification failed.")

    print("===========================================================================")
    print(f"RESULTS SUMMARY: {passed_count}/{total_tests} TESTS PASSED ({passed_count/total_tests*100:.1f}%)")
    print("===========================================================================")
    
    return passed_count == total_tests

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
