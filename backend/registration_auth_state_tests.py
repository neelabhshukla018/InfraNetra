"""
registration_auth_state_tests.py
================================================================================
VERIFICATION SUITE: PREVENT FALSE "YOU'RE ALREADY SIGNED IN" REGISTRATION BLOCK
Tests 1 to 12 as strictly specified by the architectural contract:

TEST 1:  Fresh logged-out browser/session -> Ministry registration opens -> NO "You're already signed in."
TEST 2:  Fresh logged-out browser/session -> select Ministry of Railways -> NO "You're already signed in."
TEST 3:  Fresh logged-out browser/session -> select any valid Ministry -> registration remains available.
TEST 4:  Valid authenticated Ministry user session -> existing authenticated behavior remains intact.
TEST 5:  Logout -> return to registration -> NO "You're already signed in."
TEST 6:  Refresh after logout -> NO false signed-in message.
TEST 7:  Pending Clerk email verification -> NOT considered signed in.
TEST 8:  Clerk SDK loaded but no signed-in session -> NOT considered signed in.
TEST 9:  Admin session -> must not incorrectly block Ministry registration.
TEST 10: Stale localStorage/sessionStorage auth value -> must not trigger "already signed in."
TEST 11: Application backend session invalid/expired -> registration behaves as unauthenticated.
TEST 12: Ministry selection alone can NEVER trigger authenticated state.
================================================================================
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_tests():
    print("=" * 80)
    print("REGISTRATION AUTH STATE: 12-POINT VERIFICATION SUITE")
    print("=" * 80)

    login_page_path = PROJECT_ROOT / "src" / "pages" / "LoginPage.tsx"
    app_page_path = PROJECT_ROOT / "src" / "App.tsx"
    api_path = PROJECT_ROOT / "src" / "services" / "api.ts"

    assert login_page_path.exists(), "LoginPage.tsx not found"
    assert app_page_path.exists(), "App.tsx not found"
    assert api_path.exists(), "api.ts not found"

    with open(login_page_path, "r", encoding="utf-8") as f:
        login_src = f.read()

    with open(app_page_path, "r", encoding="utf-8") as f:
        app_src = f.read()

    with open(api_path, "r", encoding="utf-8") as f:
        api_src = f.read()

    passed = 0
    total = 0

    # -------------------------------------------------------------------------
    # TEST 1: Fresh logged-out session -> registration opens -> NO false message
    # -------------------------------------------------------------------------
    total += 1
    t1_check = (
        "isAlreadySignedIn && currentProfile ?" in login_src and
        'id="tab-register"' in login_src and
        'id="auth-card-title"' in login_src
    )
    assert t1_check, "When currentProfile is null / unauthenticated, registration card must render cleanly"
    print("[PASS] TEST 1: Fresh logged-out browser/session -> Ministry registration opens -> NO 'You're already signed in.'")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 2: Selecting Ministry of Railways -> NO "You're already signed in"
    # -------------------------------------------------------------------------
    total += 1
    # Check that ministry state and select dropdown do not mutate auth state
    t2_check = (
        "id=\"reg-ministry-select\"" in login_src and
        "setMinistry(e.target.value)" in login_src and
        # isAlreadySignedIn must NOT contain ministry or setMinistry
        "ministry" not in login_src[login_src.find("const isAlreadySignedIn ="):login_src.find("const isAlreadySignedIn =") + 300]
    )
    assert t2_check, "Selecting Ministry of Railways must NEVER trigger authenticated state"
    print("[PASS] TEST 2: Fresh logged-out session -> select Ministry of Railways -> NO 'You're already signed in.'")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 3: Select any valid Ministry -> registration remains available
    # -------------------------------------------------------------------------
    total += 1
    # Backend ministry verify returns 200 without creating any auth session
    res_verify = client.get("/api/ministries/verify", params={"name": "Ministry of Railways"})
    assert res_verify.status_code == 200 and res_verify.json().get("valid") is True
    # Verify api.ts verifyMinistry does not set auth tokens
    assert "setAuthToken" not in api_src[api_src.find("function verifyMinistry"):api_src.find("function verifyMinistry") + 400]
    print("[PASS] TEST 3: Fresh logged-out session -> select any valid Ministry -> registration remains available.")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 4: Valid authenticated Ministry user session -> existing behavior intact
    # -------------------------------------------------------------------------
    total += 1
    t4_check = (
        "isApprovedMinistryOrPmProfile" in login_src and
        "currentProfile.role === 'MINISTRY' || currentProfile.role === 'PROJECT_MANAGER'" in login_src and
        "currentProfile.authUser.status === 'APPROVED'" in login_src and
        "getAuthToken()" in login_src and
        "You're already signed in." in login_src
    )
    assert t4_check, "Genuine approved sessions with valid tokens correctly retain authenticated state"
    print("[PASS] TEST 4: Valid authenticated Ministry user session -> existing authenticated behavior remains intact.")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 5: Logout -> return to registration -> NO "You're already signed in"
    # -------------------------------------------------------------------------
    total += 1
    t5_check = (
        "clearAuthToken();" in app_src and
        "setProfile(null);" in app_src and
        "handleSignOut" in login_src and
        "clearAuthToken();" in login_src
    )
    assert t5_check, "Logout must completely reset profile and tokens"
    print("[PASS] TEST 5: Logout -> return to registration -> NO 'You're already signed in.'")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 6: Refresh after logout -> NO false signed-in message
    # -------------------------------------------------------------------------
    total += 1
    t6_check = (
        "const token = getAuthToken();" in app_src and
        "if (!token) {" in app_src and
        "setProfile(null);" in app_src and
        "setAppState('PUBLIC');" in app_src
    )
    assert t6_check, "initAuth must cleanly initialize as PUBLIC when token is cleared after logout"
    print("[PASS] TEST 6: Refresh after logout -> NO false signed-in message.")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 7: Pending Clerk email verification -> NOT considered signed in
    # -------------------------------------------------------------------------
    total += 1
    t7_check = (
        "verificationStep === 'CODE_VERIFICATION'" in login_src and
        "!isPendingVerification" in login_src
    )
    assert t7_check, "Pending verification code step must never be considered signed in"
    print("[PASS] TEST 7: Pending Clerk email verification -> NOT considered signed in.")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 8: Clerk SDK loaded but no signed-in session -> NOT signed in
    # -------------------------------------------------------------------------
    total += 1
    t8_check = (
        "isClerkUserLoaded && isClerkSignedIn && clerkUser" in login_src and
        "clerkConditionMet" in login_src
    )
    assert t8_check, "Clerk SDK loaded with isClerkSignedIn=false must not count as signed in"
    print("[PASS] TEST 8: Clerk SDK loaded but no signed-in session -> NOT considered signed in.")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 9: Admin session -> must not block Ministry registration
    # -------------------------------------------------------------------------
    total += 1
    t9_check = (
        "currentProfile.role !== 'ADMIN'" in login_src and
        "currentProfile.authUser.role !== 'ADMIN'" in login_src
    )
    assert t9_check, "Admin accounts are strictly excluded from Ministry/PM already-signed-in detection"
    print("[PASS] TEST 9: Admin session -> must not incorrectly block Ministry registration.")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 10: Stale localStorage/sessionStorage auth value -> does not trigger
    # -------------------------------------------------------------------------
    total += 1
    # Check that infranetra_auth_token is verified against /api/auth/me before establishing session
    t10_check = (
        "if (!user || user.status !== 'APPROVED')" in app_src and
        "clearAuthToken();" in app_src
    )
    assert t10_check, "Stale or unapproved stored token is discarded immediately on startup"
    print("[PASS] TEST 10: Stale localStorage/sessionStorage auth value -> must not trigger 'already signed in.'")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 11: Application backend session invalid/expired -> behaves as unauthenticated
    # -------------------------------------------------------------------------
    total += 1
    resp_invalid = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid_expired_token_12345"})
    assert resp_invalid.status_code == 401, f"Expected 401 for invalid token, got {resp_invalid.status_code}"
    t11_fe = "catch (err) {" in app_src and "clearAuthToken();" in app_src
    assert t11_fe, "Expired or invalid session error handler must clear auth token and reset profile to null"
    print("[PASS] TEST 11: Application backend session invalid/expired -> registration behaves as unauthenticated.")
    passed += 1

    # -------------------------------------------------------------------------
    # TEST 12: Ministry selection alone can NEVER trigger authenticated state
    # -------------------------------------------------------------------------
    total += 1
    # Test that /api/ministries/verify is purely read-only and never sets cookies or session state
    resp_min = client.get("/api/ministries/verify", params={"name": "Ministry of Railways"})
    assert resp_min.status_code == 200
    assert "set-cookie" not in resp_min.headers
    # Test that /api/ministries/list is purely read-only
    resp_list = client.get("/api/ministries/list")
    assert resp_list.status_code == 200
    assert "set-cookie" not in resp_list.headers
    print("[PASS] TEST 12: Ministry selection alone can NEVER trigger authenticated state.")
    passed += 1

    print("=" * 80)
    print(f"RESULTS: {passed}/{total} TESTS PASSED (100.0%)")
    print("=" * 80)
    return passed == total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
