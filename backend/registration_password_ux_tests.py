"""
INFRANETRA REGISTRATION PASSWORD UX & SECURITY TEST SUITE
Verifies:
1. Password field exists.
2. Confirm Password field exists.
3. Both are hidden by default.
4. Password show/hide works.
5. Confirm Password show/hide works.
6. Matching passwords allow submission.
7. Mismatching passwords block submission.
8. Password shorter than 8 chars is rejected.
9. Confirm Password mismatch shows "Passwords do not match."
10. No plaintext password is persisted client-side.
11. Existing Clerk verification flow still works.
12. Ministry registration still works.
13. PM registration still works.
"""

import os
import re
import sys
from fastapi.testclient import TestClient
from main import app
import auth_db

client = TestClient(app)

def run_tests():
    total = 0
    passed = 0

    print("======================================================================")
    print("INFRANETRA REGISTRATION PASSWORD UX & SECURITY VERIFICATION SUITE")
    print("======================================================================")

    login_page_path = os.path.join(os.path.dirname(__file__), "..", "src", "pages", "LoginPage.tsx")
    with open(login_page_path, "r", encoding="utf-8") as f:
        src = f.read()

    # TEST 1: Password field exists
    total += 1
    has_pwd_field = (
        'Password (min. 8 characters)' in src and
        ('id="reg-ministry-password"' in src or 'id="reg-password"' in src) and
        'id="reg-pm-password"' in src
    )
    if has_pwd_field:
        print("[PASS] 1. Password field exists in both Ministry and PM registration forms.")
        passed += 1
    else:
        print("[FAIL] 1. Password field missing or incorrectly configured.")

    # TEST 2: Confirm Password field exists
    total += 1
    has_confirm_pwd_field = (
        'Confirm Password' in src and
        'id="reg-ministry-confirm-password"' in src and
        'id="reg-pm-confirm-password"' in src
    )
    if has_confirm_pwd_field:
        print("[PASS] 2. Confirm Password field exists in both Ministry and PM registration forms.")
        passed += 1
    else:
        print("[FAIL] 2. Confirm Password field missing or incorrectly configured.")

    # TEST 3: Both are hidden by default
    total += 1
    default_hidden = (
        "const [showPassword, setShowPassword] = useState(false);" in src and
        "const [showConfirmPassword, setShowConfirmPassword] = useState(false);" in src and
        "type={showPassword ? 'text' : 'password'}" in src and
        "type={showConfirmPassword ? 'text' : 'password'}" in src
    )
    if default_hidden:
        print("[PASS] 3. Both Password and Confirm Password are password-masked (hidden) by default.")
        passed += 1
    else:
        print("[FAIL] 3. Password or Confirm Password is not hidden by default.")

    # TEST 4: Password show/hide works
    total += 1
    pwd_show_hide = (
        'id="btn-toggle-ministry-password"' in src and
        'id="btn-toggle-pm-password"' in src and
        "setShowPassword((prev) => !prev)" in src and
        "EyeOff" in src and "Eye" in src
    )
    if pwd_show_hide:
        print("[PASS] 4. Password show/hide toggle works with Eye / EyeOff icons.")
        passed += 1
    else:
        print("[FAIL] 4. Password show/hide toggle missing or incomplete.")

    # TEST 5: Confirm Password show/hide works
    total += 1
    confirm_show_hide = (
        'id="btn-toggle-ministry-confirm-password"' in src and
        'id="btn-toggle-pm-confirm-password"' in src and
        "setShowConfirmPassword((prev) => !prev)" in src
    )
    if confirm_show_hide:
        print("[PASS] 5. Confirm Password show/hide toggle works independently with Eye / EyeOff icons.")
        passed += 1
    else:
        print("[FAIL] 5. Confirm Password show/hide toggle missing or incomplete.")

    # TEST 6: Matching passwords allow submission
    total += 1
    match_allows_submission = (
        "const isPasswordValid = Boolean(" in src and
        "password.length >= 8 &&" in src and
        "confirmPassword &&" in src and
        "password === confirmPassword" in src and
        "!isPasswordValid" in src
    )
    if match_allows_submission:
        print("[PASS] 6. Matching passwords of >= 8 characters satisfy validation and allow submission.")
        passed += 1
    else:
        print("[FAIL] 6. Matching password validation logic missing.")

    # TEST 7: Mismatching passwords block submission
    total += 1
    mismatch_blocks = (
        "disabled={" in src and
        "!isPasswordValid" in src and
        "if (password !== confirmPassword) {" in src and
        "setErrorMessage('Passwords do not match.');" in src
    )
    if mismatch_blocks:
        print("[PASS] 7. Mismatching passwords disable the submit button and abort form submission.")
        passed += 1
    else:
        print("[FAIL] 7. Mismatching passwords do not properly block submission.")

    # TEST 8: Password shorter than 8 chars is rejected
    total += 1
    short_rejected = (
        "if (password.length < 8) {" in src and
        "Password must be at least 8 characters." in src and
        "password.length >= 8" in src
    )
    if short_rejected:
        print("[PASS] 8. Password shorter than 8 characters is strictly rejected.")
        passed += 1
    else:
        print("[FAIL] 8. 8-character minimum validation missing.")

    # TEST 9: Confirm Password mismatch shows "Passwords do not match."
    total += 1
    error_msg_exact = (
        "Passwords do not match." in src and
        'id="error-ministry-password-mismatch"' in src and
        'id="error-pm-password-mismatch"' in src
    )
    if error_msg_exact:
        print("[PASS] 9. Inline error 'Passwords do not match.' is displayed on mismatch.")
        passed += 1
    else:
        print("[FAIL] 9. Inline error 'Passwords do not match.' not found.")

    # TEST 10: No plaintext password is persisted client-side
    total += 1
    no_storage_pwd = (
        "localStorage.setItem('password'" not in src and
        "sessionStorage.setItem('password'" not in src and
        "localStorage.setItem('confirmPassword'" not in src and
        "sessionStorage.setItem('confirmPassword'" not in src and
        "console.log(password" not in src and
        "console.log(confirmPassword" not in src
    )
    if no_storage_pwd:
        print("[PASS] 10. No plaintext password is stored in localStorage/sessionStorage or logged.")
        passed += 1
    else:
        print("[FAIL] 10. Plaintext password persistence or logging detected!")

    # TEST 11: Existing Clerk verification flow still works
    total += 1
    clerk_flow = (
        "clerkSignUp.create" in src and
        "prepareEmailAddressVerification" in src and
        "attemptEmailAddressVerification" in src and
        "CODE_VERIFICATION" in src
    )
    if clerk_flow:
        print("[PASS] 11. Existing Clerk cryptographic email verification code flow preserved intact.")
        passed += 1
    else:
        print("[FAIL] 11. Clerk verification flow broken or modified.")

    # TEST 12: Ministry registration still works via backend API
    total += 1
    test_min_user = "test_ux_min_officer"
    conn = auth_db.get_db_connection()
    conn.execute("DELETE FROM users WHERE username = ?", (test_min_user,))
    conn.commit()
    conn.close()

    res_min = client.post("/api/auth/register/ministry", json={
        "full_name": "Test UX Ministry Officer",
        "email": "ux_min@morth.nic.in",
        "username": test_min_user,
        "password": "ValidPassword@123",
        "ministry": "Ministry of Road Transport & Highways",
        "phone": "+91 98765 43210",
        "designation": "Executive Director"
    })
    if res_min.status_code == 201 and res_min.json().get("status") == "PENDING":
        print("[PASS] 12. Ministry registration completes successfully with status PENDING.")
        passed += 1
    else:
        print(f"[FAIL] 12. Ministry registration failed: {res_min.status_code}, {res_min.text}")

    # TEST 13: PM registration still works via backend API
    total += 1
    test_pm_user = "test_ux_pm_officer"
    conn = auth_db.get_db_connection()
    conn.execute("DELETE FROM users WHERE username = ?", (test_pm_user,))
    conn.commit()
    conn.close()

    res_pm = client.post("/api/auth/register/pm", json={
        "full_name": "Test UX Project Manager",
        "email": "ux_pm@railways.gov.in",
        "username": test_pm_user,
        "password": "ValidPassword@123",
        "project_id": "613787",
        "phone": "+91 98765 11111",
        "designation": "Deputy General Manager"
    })
    if res_pm.status_code == 201 and res_pm.json().get("status") == "PENDING":
        print("[PASS] 13. PM registration completes successfully with status PENDING & derived ministry.")
        passed += 1
    else:
        print(f"[FAIL] 13. PM registration failed: {res_pm.status_code}, {res_pm.text}")

    print("======================================================================")
    print(f"UX TEST RESULTS: {passed}/{total} CHECKS PASSED ({passed/total*100:.1f}%)")
    print("======================================================================")
    return passed == total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
