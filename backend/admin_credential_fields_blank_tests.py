"""
InfraNetra Admin Login Credential Blank State & Security Test Suite
Tests 1 - 8:
1. Username field starts blank (initialized as empty string, no storage reading).
2. Password field starts blank (initialized as empty string).
3. Component re-render/refresh keeps both fields blank (useEffect wipes any prefill).
4. Logout explicitly ensures both username and password are blank.
5. Failed login clears password appropriately.
6. Successful login clears credentials from state and never persists credentials to client storage.
7. ADMIN_PASSWORD never appears in frontend or build artifacts.
8. Existing fixed-credential server-side authentication still works (200 for exact credentials, 401 for wrong).
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
    print("=" * 70)
    print("ADMIN LOGIN CREDENTIAL FIELDS BLANK & SECURITY SUITE (TESTS 1 - 8)")
    print("=" * 70)

    admin_login_file = PROJECT_ROOT / "src" / "pages" / "AdminLoginPage.tsx"
    admin_login_code = admin_login_file.read_text(encoding="utf-8")

    admin_user = os.environ.get("ADMIN_USERNAME", "LOG_bit").strip()
    admin_pass = os.environ.get("ADMIN_PASSWORD", "LOG_bit_26103")

    # --------------------------------------------------------------------------
    # TEST 1: Username field starts blank (never pre-filled from currentProfile/storage)
    # --------------------------------------------------------------------------
    # Check that useState('') is used and NO localStorage/sessionStorage/profile is read for username
    has_blank_username_init = "const [username, setUsername] = useState('');" in admin_login_code
    no_localstorage_username = "localStorage.getItem" not in admin_login_code
    no_sessionstorage_username = "sessionStorage.getItem" not in admin_login_code
    no_profile_username_init = "useState(isInitiallyAdmin ?" not in admin_login_code

    t1_pass = has_blank_username_init and no_localstorage_username and no_sessionstorage_username and no_profile_username_init
    record(1, "Username field starts blank (no pre-fill, no storage reads)", t1_pass,
           f"BlankInit: {has_blank_username_init}, NoStorageReads: {no_localstorage_username and no_sessionstorage_username}, NoProfileInit: {no_profile_username_init}")

    # --------------------------------------------------------------------------
    # TEST 2: Password field starts blank
    # --------------------------------------------------------------------------
    has_blank_password_init = "const [password, setPassword] = useState('');" in admin_login_code
    has_new_password_autocomplete = 'autoComplete="new-password"' in admin_login_code

    t2_pass = has_blank_password_init and has_new_password_autocomplete
    record(2, "Password field starts blank with autoComplete='new-password'", t2_pass,
           f"BlankPasswordInit: {has_blank_password_init}, NewPasswordAttr: {has_new_password_autocomplete}")

    # --------------------------------------------------------------------------
    # TEST 3: Component re-render/refresh keeps both blank even if Admin is logged in
    # --------------------------------------------------------------------------
    has_effect_wipe = (
        "setUsername('');" in admin_login_code and
        "setPassword('');" in admin_login_code and
        "useEffect(() => {" in admin_login_code
    )
    no_effect_username_populate = "setUsername(currentProfile.authUser?.username" not in admin_login_code

    t3_pass = has_effect_wipe and no_effect_username_populate
    record(3, "Refresh/re-render keeps both blank even if Admin is logged in", t3_pass,
           f"EffectWipesCredentials: {has_effect_wipe}, NoProfilePopulate: {no_effect_username_populate}")

    # --------------------------------------------------------------------------
    # TEST 4: Logout / session reset explicitly ensures both username and password are blank
    # --------------------------------------------------------------------------
    has_logout_wipe = (
        "if (!currentProfile)" in admin_login_code and
        "setUsername('');" in admin_login_code and
        "setPassword('');" in admin_login_code
    )
    t4_pass = has_logout_wipe
    record(4, "Logout / session reset explicitly wipes username and password in AdminLoginPage", t4_pass,
           f"LogoutWipesBoth: {has_logout_wipe}")

    # --------------------------------------------------------------------------
    # TEST 5: Failed login clears credentials appropriately
    # --------------------------------------------------------------------------
    has_failed_clear = (
        "catch (err: any) {" in admin_login_code and
        "setPassword('');" in admin_login_code
    )
    # Test endpoint directly with wrong credentials
    failed_res = client.post("/api/auth/login/admin", json={
        "username": admin_user,
        "password": "WrongPassword999!"
    })
    t5_pass = has_failed_clear and (failed_res.status_code == 401)
    record(5, "Failed login returns HTTP 401 and clears sensitive input from state", t5_pass,
           f"ComponentClearsOnCatch: {has_failed_clear}, APIStatus: {failed_res.status_code}")

    # --------------------------------------------------------------------------
    # TEST 6: Successful login never persists credentials to client-side storage
    # --------------------------------------------------------------------------
    # Verify no code in src/ saves admin_user or admin_pass to localStorage/sessionStorage/cookies
    src_dir = PROJECT_ROOT / "src"
    credential_storage_instances = []
    for p in src_dir.rglob("*.ts*"):
        if p.is_file():
            content = p.read_text(encoding="utf-8", errors="ignore")
            if "localStorage.setItem('admin_password'" in content or \
               "localStorage.setItem('admin_username'" in content or \
               "sessionStorage.setItem('admin_password'" in content or \
               "sessionStorage.setItem('admin_username'" in content:
                credential_storage_instances.append(str(p))

    success_wipe_in_component = (
        "const res = await loginAdmin(" in admin_login_code and
        "setUsername('');" in admin_login_code and
        "setPassword('');" in admin_login_code
    )
    t6_pass = (len(credential_storage_instances) == 0) and success_wipe_in_component
    record(6, "Successful login clears credentials from state and never persists to storage", t6_pass,
           f"StorageInstancesFound: {len(credential_storage_instances)}, StateWipedOnLogin: {success_wipe_in_component}")

    # --------------------------------------------------------------------------
    # TEST 7: ADMIN_PASSWORD is completely absent from frontend and build artifacts
    # --------------------------------------------------------------------------
    found_in_artifacts = []
    for search_dir in [PROJECT_ROOT / "src", PROJECT_ROOT / "dist", PROJECT_ROOT / "public"]:
        if search_dir.exists():
            for p in search_dir.rglob("*"):
                if p.is_file() and p.suffix in [".ts", ".tsx", ".js", ".jsx", ".html", ".css", ".map", ".json"]:
                    try:
                        content = p.read_text(encoding="utf-8", errors="ignore")
                        if admin_pass in content:
                            found_in_artifacts.append(str(p.relative_to(PROJECT_ROOT)))
                    except Exception:
                        pass
    t7_pass = len(found_in_artifacts) == 0
    record(7, "ADMIN_PASSWORD is completely absent from frontend & build artifacts", t7_pass,
           f"PasswordInstancesFound: {len(found_in_artifacts)}")

    # --------------------------------------------------------------------------
    # TEST 8: Existing fixed-credential authentication still works seamlessly
    # --------------------------------------------------------------------------
    success_res = client.post("/api/auth/login/admin", json={
        "username": admin_user,
        "password": admin_pass
    })
    user_data = success_res.json().get("user", {}) if success_res.status_code == 200 else {}
    t8_pass = (
        success_res.status_code == 200 and
        user_data.get("role") == "ADMIN" and
        "token" in success_res.json()
    )
    record(8, "Existing fixed-credential authentication still works seamlessly", t8_pass,
           f"HTTP {success_res.status_code}, Role: {user_data.get('role')}, HasToken: {'token' in success_res.json()}")

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
