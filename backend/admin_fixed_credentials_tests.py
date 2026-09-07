"""
InfraNetra Authoritative Admin Login Test Suite (Tests 1 - 13)
Tests all 13 mandated tests for fixed pre-decided administrator credentials:
1. Exact ADMIN_USERNAME + exact ADMIN_PASSWORD -> Admin login SUCCESS
2. Correct username + wrong password -> 401
3. Wrong username + correct password -> 401
4. Wrong username + wrong password -> 401
5. Ministry credentials -> cannot authenticate as Admin
6. Project Manager credentials -> cannot authenticate as Admin
7. role=ADMIN sent by client -> ignored/rejected
8. is_admin=true sent by client -> ignored/rejected
9. Attempt to register/create another Admin -> rejected
10. Verify exactly one active Admin exists.
11. Successful Admin login shows actual authenticated Admin profile, not hardcoded personal information.
12. Profile dropdown still contains: Active Officer Session, Admin Control Center, Log Out
13. ADMIN_PASSWORD is not present anywhere in frontend/build artifacts.
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
from auth import create_session_token

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
    print("ADMIN FIXED CREDENTIALS & SINGLE IDENTITY VERIFICATION SUITE (TESTS 1 - 13)")
    print("=" * 70)

    admin_user = os.environ.get("ADMIN_USERNAME", "LOG_bit").strip()
    admin_pass = os.environ.get("ADMIN_PASSWORD", "LOG_bit_26103")

    # --------------------------------------------------------------------------
    # TEST 1: Exact ADMIN_USERNAME + exact ADMIN_PASSWORD -> Admin login SUCCESS
    # --------------------------------------------------------------------------
    r1 = client.post("/api/auth/login/admin", json={
        "username": admin_user,
        "password": admin_pass
    })
    token1 = r1.json().get("token") if r1.status_code == 200 else None
    t1_dash = False
    if token1:
        dash_res = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {token1}"})
        t1_dash = (dash_res.status_code == 200)

    t1_pass = (r1.status_code == 200) and bool(token1) and t1_dash
    record(1, "Exact ADMIN_USERNAME + exact ADMIN_PASSWORD -> Admin login SUCCESS", t1_pass,
           f"Login HTTP {r1.status_code}, Token generated: {bool(token1)}, Admin endpoint HTTP 200: {t1_dash}")

    # --------------------------------------------------------------------------
    # TEST 2: Correct username + wrong password -> 401
    # --------------------------------------------------------------------------
    r2 = client.post("/api/auth/login/admin", json={
        "username": admin_user,
        "password": "WrongPassword!999"
    })
    t2_pass = (r2.status_code == 401) and ("invalid administrator credentials" in r2.text.lower())
    record(2, "Correct username + wrong password -> 401", t2_pass,
           f"HTTP {r2.status_code}, Detail: '{r2.json().get('detail')}'")

    # --------------------------------------------------------------------------
    # TEST 3: Wrong username + correct password -> 401
    # --------------------------------------------------------------------------
    r3 = client.post("/api/auth/login/admin", json={
        "username": "other_user",
        "password": admin_pass
    })
    t3_pass = (r3.status_code == 401) and ("invalid administrator credentials" in r3.text.lower())
    record(3, "Wrong username + correct password -> 401", t3_pass,
           f"HTTP {r3.status_code}, Detail: '{r3.json().get('detail')}'")

    # --------------------------------------------------------------------------
    # TEST 4: Wrong username + wrong password -> 401
    # --------------------------------------------------------------------------
    r4 = client.post("/api/auth/login/admin", json={
        "username": "intruder_user",
        "password": "InvalidPassword123!"
    })
    t4_pass = (r4.status_code == 401) and ("invalid administrator credentials" in r4.text.lower())
    record(4, "Wrong username + wrong password -> 401", t4_pass,
           f"HTTP {r4.status_code}, Detail: '{r4.json().get('detail')}'")

    # --------------------------------------------------------------------------
    # TEST 5: Ministry credentials -> cannot authenticate as Admin
    # --------------------------------------------------------------------------
    r5 = client.post("/api/auth/login/admin", json={
        "username": "sec_test_min_a",
        "password": "Password@123"
    })
    t5_pass = (r5.status_code == 401) and ("invalid administrator credentials" in r5.text.lower())
    record(5, "Ministry credentials -> cannot authenticate as Admin", t5_pass,
           f"HTTP {r5.status_code}, Detail: '{r5.json().get('detail')}'")

    # --------------------------------------------------------------------------
    # TEST 6: Project Manager credentials -> cannot authenticate as Admin
    # --------------------------------------------------------------------------
    r6 = client.post("/api/auth/login/admin", json={
        "username": "sec_test_pm_a",
        "password": "Password@123"
    })
    t6_pass = (r6.status_code == 401) and ("invalid administrator credentials" in r6.text.lower())
    record(6, "Project Manager credentials -> cannot authenticate as Admin", t6_pass,
           f"HTTP {r6.status_code}, Detail: '{r6.json().get('detail')}'")

    # --------------------------------------------------------------------------
    # TEST 7: role=ADMIN sent by client -> ignored/rejected
    # --------------------------------------------------------------------------
    r7_fake = client.post("/api/auth/login/admin", json={
        "username": "fake_admin",
        "password": "FakePassword123",
        "role": "ADMIN"
    })
    r7_min = client.post("/api/auth/register/ministry", json={
        "username": "fake_admin_reg",
        "password": "Password@123",
        "full_name": "Fake Admin",
        "email": "fake@admin.gov.in",
        "ministry": "Ministry of Railways",
        "role": "ADMIN"
    })
    # Even if client sent role=ADMIN in registration, server must assign MINISTRY
    assigned_role = r7_min.json().get("role") if r7_min.status_code == 201 else None
    t7_pass = (r7_fake.status_code == 401) and (assigned_role != "ADMIN")
    record(7, "role=ADMIN sent by client -> ignored/rejected", t7_pass,
           f"Admin login with forged role rejected: HTTP {r7_fake.status_code}, Registration ignored client role: {assigned_role}")

    # --------------------------------------------------------------------------
    # TEST 8: is_admin=true sent by client -> ignored/rejected
    # --------------------------------------------------------------------------
    r8_fail = client.post("/api/auth/login/admin", json={
        "username": "attacker",
        "password": "bad_password",
        "is_admin": True,
        "role": "ADMIN"
    })
    r8_min = client.post("/api/auth/login/ministry", json={
        "username": "sec_test_min_a",
        "password": "Password@123",
        "ministry": "Ministry of Road Transport & Highways",
        "is_admin": True,
        "role": "ADMIN"
    })
    t8_token = r8_min.json().get("token") if r8_min.status_code == 200 else None
    t8_blocked = False
    if t8_token:
        adm_check = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {t8_token}"})
        t8_blocked = (adm_check.status_code == 403)
    else:
        t8_blocked = True

    t8_pass = (r8_fail.status_code == 401) and t8_blocked
    record(8, "is_admin=true sent by client -> ignored/rejected", t8_pass,
           f"Admin login with is_admin=true rejected: HTTP {r8_fail.status_code}, Ministry token cannot escalate: {t8_blocked}")

    # --------------------------------------------------------------------------
    # TEST 9: Attempt to register/create another Admin -> rejected
    # --------------------------------------------------------------------------
    db_path = BACKEND_DIR / "infrastructure_projects.sqlite3"
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    db_blocked = False
    try:
        cur.execute("""
            INSERT INTO users (username, password_hash, salt, full_name, email, role, status)
            VALUES ('second_admin_attempt', 'pwdhash', 'salt', 'Second Admin', 'admin2@mospi.gov.in', 'ADMIN', 'APPROVED');
        """)
        conn.commit()
    except sqlite3.IntegrityError:
        db_blocked = True
        conn.rollback()

    # Verify no admin registration endpoint exists
    r9_admin_reg = client.post("/api/auth/register/admin", json={"username": "new_admin", "password": "Password123"})
    endpoint_rejected = (r9_admin_reg.status_code in (404, 405))
    t9_pass = db_blocked and endpoint_rejected
    record(9, "Attempt to register/create another Admin -> rejected", t9_pass,
           f"Database unique constraint blocked 2nd admin: {db_blocked}, /api/auth/register/admin 404/405: {r9_admin_reg.status_code}")

    # --------------------------------------------------------------------------
    # TEST 10: Verify exactly one active Admin exists
    # --------------------------------------------------------------------------
    cur.execute("SELECT COUNT(*) FROM users WHERE role = 'ADMIN';")
    admin_count = cur.fetchone()[0]
    cur.execute("SELECT id, username, full_name, email, role, status FROM users WHERE role = 'ADMIN';")
    admin_record = cur.fetchone()
    conn.close()

    t10_pass = (admin_count == 1) and (admin_record[5] == "APPROVED")
    record(10, "Verify exactly one active Admin exists", t10_pass,
           f"Total Admin Count: {admin_count}, Active Admin ID: {admin_record[0]}, Username: '{admin_record[1]}'")

    # --------------------------------------------------------------------------
    # TEST 11: Successful Admin login shows actual authenticated Admin profile
    # --------------------------------------------------------------------------
    r11 = client.post("/api/auth/login/admin", json={
        "username": admin_user,
        "password": admin_pass
    })
    user_data = r11.json().get("user", {})
    actual_name = user_data.get("full_name")
    actual_email = user_data.get("email")
    actual_role = user_data.get("role")
    actual_dept = user_data.get("department")
    actual_desig = user_data.get("designation")

    t11_pass = (
        r11.status_code == 200
        and bool(actual_name)
        and actual_role == "ADMIN"
        and bool(actual_email)
        and bool(actual_dept)
        and bool(actual_desig)
    )
    record(11, "Successful Admin login shows actual authenticated Admin profile", t11_pass,
           f"Name: '{actual_name}', Role: '{actual_role}', Email: '{actual_email}', Dept: '{actual_dept}', Designation: '{actual_desig}'")

    # --------------------------------------------------------------------------
    # TEST 12: Profile dropdown still contains: Active Officer Session, Admin Control Center, Log Out
    # --------------------------------------------------------------------------
    navbar_file = PROJECT_ROOT / "src" / "components" / "Navbar.tsx"
    navbar_code = navbar_file.read_text(encoding="utf-8")

    has_active_session = "Active Officer Session" in navbar_code
    has_admin_control = "Admin Control Center" in navbar_code
    has_logout = "Log Out of Account" in navbar_code or "Log Out" in navbar_code

    t12_pass = has_active_session and has_admin_control and has_logout
    record(12, "Profile dropdown still contains: Active Officer Session, Admin Control Center, Log Out", t12_pass,
           f"Active Officer Session: {has_active_session}, Admin Control Center: {has_admin_control}, Log Out: {has_logout}")

    # --------------------------------------------------------------------------
    # TEST 13: ADMIN_PASSWORD is not present anywhere in frontend/build artifacts
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

    t13_pass = len(found_in_files) == 0
    record(13, "ADMIN_PASSWORD is not present anywhere in frontend/build artifacts", t13_pass,
           f"Password instances found: {len(found_in_files)}")

    # --------------------------------------------------------------------------
    # TEST 14: Admin Login Page contains username & password ONLY for authentication (no profile section)
    # --------------------------------------------------------------------------
    admin_login_file = PROJECT_ROOT / "src" / "pages" / "AdminLoginPage.tsx"
    admin_login_code = admin_login_file.read_text(encoding="utf-8")

    has_fullname = "input-admin-fullname" in admin_login_code or "Full Official Name" in admin_login_code
    has_email = "input-admin-email" in admin_login_code or "Official Email Address" in admin_login_code
    has_designation = "input-admin-designation" in admin_login_code or "Official Designation" in admin_login_code
    has_department = "input-admin-department" in admin_login_code or "Department / Organization" in admin_login_code
    has_user_field = "input-admin-username" in admin_login_code and "ADMINISTRATIVE USERNAME" in admin_login_code
    has_pwd_field = "input-admin-password" in admin_login_code and "PASSWORD" in admin_login_code
    has_auth_btn = "btn-authenticate-admin" in admin_login_code and "Authenticate as Administrator" in admin_login_code

    no_profile_fields = not any([has_fullname, has_email, has_designation, has_department])
    t14_pass = has_user_field and has_pwd_field and has_auth_btn and no_profile_fields
    record(14, "Admin Login Page contains username & password ONLY (profile section removed)", t14_pass,
           f"Username: {has_user_field}, Password: {has_pwd_field}, Button: {has_auth_btn}, ProfileFieldsAbsent: {no_profile_fields}")

    # --------------------------------------------------------------------------
    # TEST 15: Fake profile fields never grant Admin access without fixed credentials
    # --------------------------------------------------------------------------
    fake_profile_res = client.post("/api/auth/login/admin", json={
        "username": "fake_admin",
        "password": "wrong_password",
        "full_name": "Rajesh Kumar",
        "email": "r.kumar@morth.nic.in",
        "designation": "Director",
        "department": "Infrastructure & Project Monitoring Division (IPMD), MoSPI"
    })
    t15_pass = fake_profile_res.status_code == 401
    record(15, "Fake profile fields never grant Admin access without fixed credentials", t15_pass,
           f"HTTP {fake_profile_res.status_code} (Expected 401)")

    # --------------------------------------------------------------------------
    # TEST 16: Profile fields entered on Login Page saved to single Admin record on successful login
    # --------------------------------------------------------------------------
    success_with_fields = client.post("/api/auth/login/admin", json={
        "username": admin_user,
        "password": admin_pass,
        "full_name": "ABC",
        "email": "abc@example.gov.in",
        "designation": "Director",
        "department": "IPMD, MoSPI"
    })
    body_16 = success_with_fields.json() if success_with_fields.status_code == 200 else {}
    returned_user = body_16.get("user", {})
    t16_pass = (
        success_with_fields.status_code == 200 and
        returned_user.get("role") == "ADMIN" and
        returned_user.get("full_name") == "ABC" and
        returned_user.get("email") == "abc@example.gov.in" and
        returned_user.get("designation") == "Director" and
        returned_user.get("department") == "IPMD, MoSPI"
    )
    record(16, "Profile fields entered on Login Page saved to single Admin record on successful login", t16_pass,
           f"Login HTTP {success_with_fields.status_code}, User Name in token: '{returned_user.get('full_name')}', Dept: '{returned_user.get('department')}'")

    # --------------------------------------------------------------------------
    # TEST 17: Intermediate session screen removed from AdminLoginPage; direct redirect implemented
    # --------------------------------------------------------------------------
    has_sync_banner = "admin-sync-banner" in admin_login_code or "Authoritative Database Profile Synchronized" in admin_login_code
    has_profile_info_section = "Administrator Profile Information" in admin_login_code or "Database Synced" in admin_login_code
    has_goto_btn = "btn-goto-admin-center" in admin_login_code or "Proceed to Admin Control Center" in admin_login_code
    has_logout_on_page = "btn-admin-logout" in admin_login_code or "Log Out of Administrator Session" in admin_login_code
    has_edit_profile_on_login = "btn-edit-admin-profile" in admin_login_code or "Edit Profile Settings" in admin_login_code
    has_direct_nav = "onNavigate('admin')" in admin_login_code
    has_logout_in_dropdown = "Log Out of Account" in navbar_code
    has_settings_in_dropdown = "btn-open-profile-settings" in navbar_code

    t17_pass = (
        (not has_sync_banner) and
        (not has_profile_info_section) and
        (not has_goto_btn) and
        (not has_logout_on_page) and
        (not has_edit_profile_on_login) and
        has_direct_nav and
        has_logout_in_dropdown and
        has_settings_in_dropdown
    )
    record(17, "Intermediate session screen removed; direct redirect and dropdown actions preserved", t17_pass,
           f"NoIntermediateScreen: {not (has_goto_btn or has_edit_profile_on_login)}, DirectNav: {has_direct_nav}, DropdownActions: {has_logout_in_dropdown and has_settings_in_dropdown}")

    # --------------------------------------------------------------------------
    # TEST 18: Password is never returned from API and never autofilled after login
    # --------------------------------------------------------------------------
    login_body = success_with_fields.json()
    user_payload = login_body.get("user", {})
    t18_pass = (
        "password" not in user_payload and
        "password_hash" not in user_payload and
        "salt" not in user_payload and
        "ADMIN_PASSWORD" not in str(login_body)
    )
    record(18, "ADMIN_PASSWORD is never returned in API payloads or serialized to client", t18_pass,
           f"Password in user dict: {'password' in user_payload}, Password hash: {'password_hash' in user_payload}")

    # --------------------------------------------------------------------------
    # TEST 19: Profile dropdown and /api/auth/me remain synchronized with database
    # --------------------------------------------------------------------------
    auth_token = login_body.get("token")
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {auth_token}"})
    me_user = me_res.json().get("user", {}) if me_res.status_code == 200 else {}

    t19_pass = (
        me_res.status_code == 200 and
        me_user.get("role") == "ADMIN" and
        me_user.get("full_name") == user_payload.get("full_name") and
        me_user.get("email") == user_payload.get("email") and
        me_user.get("designation") == user_payload.get("designation")
    )
    record(19, "Authoritative Admin profile is identical across /api/auth/login/admin and /api/auth/me", t19_pass,
           f"HTTP {me_res.status_code}, Name: '{me_user.get('full_name')}', Role: '{me_user.get('role')}'")

    # --------------------------------------------------------------------------
    # TEST 20: Verified database contains strictly ONE Admin account
    # --------------------------------------------------------------------------
    db_path = BACKEND_DIR / "infrastructure_projects.sqlite3"
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS total_admins FROM users WHERE role = 'ADMIN';")
    total_admins = cur.fetchone()["total_admins"]
    conn.close()

    t20_pass = (total_admins == 1)
    record(20, "Database strictly maintains exactly ONE Admin account constraint", t20_pass,
           f"Total Admin Count: {total_admins} (Expected 1)")

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
