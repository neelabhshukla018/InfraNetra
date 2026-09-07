"""
InfraNetra Direct Admin Dashboard Redirect & Session Verification Suite
Tests 1 - 10:
1. Open Admin Login Page while logged out (shows username & password).
2. Direct redirect on login: successful fixed-credential authentication immediately calls onNavigate('admin').
3. Already authenticated Admin is immediately redirected to Admin Dashboard (useEffect onNavigate('admin')).
4. Intermediate authenticated-session page is NOT shown (no intermediate screen, no 'Session Authenticated - Credentials Blank').
5. "Edit Profile Settings" button is completely removed from AdminLoginPage.
6. Admin Dashboard / Control Center (/api/admin/audit-logs) opens successfully with valid token.
7. Admin profile dropdown in Navbar shows Full Name, ADMIN, Email, Designation, Department, Active Officer Session, Log Out.
8. Admin can edit profile from existing dashboard/Navbar modal via PUT /api/auth/profile.
9. Global Logout remains available and functional from dashboard/Navbar profile dropdown.
10. Wrong Admin credentials return HTTP 401.
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
    print("=" * 75)
    print("DIRECT ADMIN DASHBOARD REDIRECT & SESSION VERIFICATION SUITE (TESTS 1 - 10)")
    print("=" * 75)

    admin_login_file = PROJECT_ROOT / "src" / "pages" / "AdminLoginPage.tsx"
    admin_login_code = admin_login_file.read_text(encoding="utf-8")

    app_file = PROJECT_ROOT / "src" / "App.tsx"
    app_code = app_file.read_text(encoding="utf-8")

    navbar_file = PROJECT_ROOT / "src" / "components" / "Navbar.tsx"
    navbar_code = navbar_file.read_text(encoding="utf-8")

    admin_user = os.environ.get("ADMIN_USERNAME", "LOG_bit").strip()
    admin_pass = os.environ.get("ADMIN_PASSWORD", "LOG_bit_26103")

    # --------------------------------------------------------------------------
    # TEST 1: Open Admin Login Page while logged out (shows username & password)
    # --------------------------------------------------------------------------
    has_portal = "CENTRAL ADMINISTRATION PORTAL" in admin_login_code
    has_user = "input-admin-username" in admin_login_code and "ADMINISTRATIVE USERNAME" in admin_login_code
    has_pwd = "input-admin-password" in admin_login_code and "PASSWORD" in admin_login_code
    has_btn = "btn-authenticate-admin" in admin_login_code and "Authenticate as Administrator" in admin_login_code

    t1_pass = has_portal and has_user and has_pwd and has_btn
    record(1, "Admin Login Page displays authentication form when logged out", t1_pass,
           f"Portal: {has_portal}, UsernameInput: {has_user}, PasswordInput: {has_pwd}, SubmitBtn: {has_btn}")

    # --------------------------------------------------------------------------
    # TEST 2: Successful login immediately triggers direct redirect to Admin Dashboard
    # --------------------------------------------------------------------------
    has_direct_nav_on_login = (
        "onAdminLogin(adminProfile);" in admin_login_code and
        "onNavigate('admin');" in admin_login_code
    )
    has_app_direct_nav = "navigateTo('admin');" in app_code and "handleAdminLogin = (adminProfile: Profile)" in app_code

    t2_pass = has_direct_nav_on_login and has_app_direct_nav
    record(2, "Successful login immediately triggers direct redirect to Admin Dashboard", t2_pass,
           f"ComponentDirectRedirect: {has_direct_nav_on_login}, AppDirectRedirect: {has_app_direct_nav}")

    # --------------------------------------------------------------------------
    # TEST 3: Already authenticated Admin is immediately redirected to Admin Dashboard
    # --------------------------------------------------------------------------
    has_effect_redirect = (
        "if (currentProfile?.role === 'ADMIN' || currentProfile?.authUser?.role === 'ADMIN')" in admin_login_code and
        "onNavigate('admin');" in admin_login_code
    )
    has_url_redirect = (
        "if (pageParam === 'admin-login' || path.includes('/admin-login') || hash.includes('admin-login'))" in app_code and
        "setCurrentPage('admin');" in app_code
    )

    t3_pass = has_effect_redirect and has_url_redirect
    record(3, "Already authenticated Admin navigating to admin-login immediately redirects to dashboard", t3_pass,
           f"EffectRedirect: {has_effect_redirect}, UrlRouteRedirect: {has_url_redirect}")

    # --------------------------------------------------------------------------
    # TEST 4: Intermediate authenticated-session page is NOT shown
    # --------------------------------------------------------------------------
    no_intermediate_blank_msg = "Session Authenticated - Credentials Blank" not in admin_login_code
    no_secured_pwd_msg = "Password secured & hidden during active authenticated session" not in admin_login_code
    no_proceed_btn = "Proceed to Admin Control Center" not in admin_login_code and "btn-goto-admin-center" not in admin_login_code

    t4_pass = no_intermediate_blank_msg and no_secured_pwd_msg and no_proceed_btn
    record(4, "Intermediate authenticated-session screen is completely removed", t4_pass,
           f"NoIntermediateBlankMsg: {no_intermediate_blank_msg}, NoSecuredMsg: {no_secured_pwd_msg}, NoProceedBtn: {no_proceed_btn}")

    # --------------------------------------------------------------------------
    # TEST 5: 'Edit Profile Settings' is NOT present on AdminLoginPage
    # --------------------------------------------------------------------------
    no_edit_btn_on_login = "btn-edit-admin-profile" not in admin_login_code and "Edit Profile Settings" not in admin_login_code
    t5_pass = no_edit_btn_on_login
    record(5, "'Edit Profile Settings' is completely removed from AdminLoginPage", t5_pass,
           f"EditProfileAbsentFromLoginPage: {no_edit_btn_on_login}")

    # --------------------------------------------------------------------------
    # TEST 6: Admin Dashboard / Control Center API opens successfully with valid token
    # --------------------------------------------------------------------------
    login_res = client.post("/api/auth/login/admin", json={
        "username": admin_user,
        "password": admin_pass
    })
    token = login_res.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}
    dash_res = client.get("/api/admin/audit-logs", headers=headers)

    t6_pass = (login_res.status_code == 200) and (dash_res.status_code == 200)
    record(6, "Admin Dashboard / Control Center API is accessible and returns HTTP 200", t6_pass,
           f"LoginStatus: {login_res.status_code}, DashboardApiStatus: {dash_res.status_code}")

    # --------------------------------------------------------------------------
    # TEST 7: Admin profile dropdown in Navbar shows all required details
    # --------------------------------------------------------------------------
    has_active_officer = "Active Officer Session" in navbar_code
    has_admin_control = "Admin Control Center" in navbar_code
    has_dropdown_logout = "Log Out of Account" in navbar_code or "btn-logout" in navbar_code
    has_profile_dept = "profile.department" in navbar_code
    has_profile_email = "profile.email" in navbar_code

    t7_pass = has_active_officer and has_admin_control and has_dropdown_logout and has_profile_dept and has_profile_email
    record(7, "Admin profile dropdown in Navbar retains all profile attributes & actions", t7_pass,
           f"ActiveOfficerBadge: {has_active_officer}, AdminControlCenter: {has_admin_control}, Logout: {has_dropdown_logout}")

    # --------------------------------------------------------------------------
    # TEST 8: Admin can still edit profile from existing dashboard/Navbar modal via API
    # --------------------------------------------------------------------------
    has_modal_in_navbar = "AdminProfileSettingsModal" in navbar_code and "btn-open-profile-settings" in navbar_code
    up_res = client.put("/api/auth/profile", headers=headers, json={
        "full_name": "Shri Rajesh Kumar Sharma",
        "email": "r.sharma@mospi.gov.in",
        "designation": "Director General",
        "department": "Infrastructure & Project Monitoring Division (IPMD), MoSPI"
    })
    updated_user = up_res.json().get("user", {}) if up_res.status_code == 200 else {}
    t8_pass = has_modal_in_navbar and (up_res.status_code == 200) and (updated_user.get("full_name") == "Shri Rajesh Kumar Sharma")
    record(8, "Profile editing remains active in dashboard/Navbar and updates database", t8_pass,
           f"NavbarModalWired: {has_modal_in_navbar}, UpdateApiStatus: {up_res.status_code}, Name: '{updated_user.get('full_name')}'")

    # --------------------------------------------------------------------------
    # TEST 9: Logout remains available from dashboard/profile dropdown
    # --------------------------------------------------------------------------
    has_logout_button = "id=\"btn-logout\"" in navbar_code
    t9_pass = has_logout_button
    record(9, "Logout remains available from authenticated Admin profile dropdown", t9_pass,
           f"NavbarLogoutButton: {has_logout_button}")

    # --------------------------------------------------------------------------
    # TEST 10: Wrong Admin credentials still return HTTP 401
    # --------------------------------------------------------------------------
    wrong_pwd_res = client.post("/api/auth/login/admin", json={
        "username": admin_user,
        "password": "WrongPassword999!"
    })
    wrong_usr_res = client.post("/api/auth/login/admin", json={
        "username": "unauthorized_admin",
        "password": admin_pass
    })
    t10_pass = (wrong_pwd_res.status_code == 401) and (wrong_usr_res.status_code == 401)
    record(10, "Wrong Admin credentials return HTTP 401", t10_pass,
           f"WrongPwdStatus: {wrong_pwd_res.status_code}, WrongUserStatus: {wrong_usr_res.status_code}")

    print("=" * 75)
    passed_count = sum(1 for r in results if r["passed"])
    total_count = len(results)
    pct = (passed_count / total_count) * 100.0 if total_count > 0 else 0
    print(f"RESULTS: {passed_count}/{total_count} TESTS PASSED ({pct:.1f}%)")
    print("=" * 75)

    if passed_count != total_count:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
