"""
InfraNetra Verification Suite: Strict Canonical Project ID Database Validation Tests (Tests 1 - 8)

Validates Requirement:
TEST 1: Real canonical infrastructure_projects.project_id from Supabase -> ACCEPT (HTTP 200 on lookup, HTTP 201 on registration).
TEST 2: Corresponding internal infrastructure_projects.id (e.g. id=9, 30576) -> REJECT 404 (Lookup 404).
TEST 3: Random numeric ID not in dataset -> REJECT 404.
TEST 4: Random alphanumeric ID not in dataset -> REJECT 404.
TEST 5: Real-looking external project identifier absent from dataset -> REJECT 404.
TEST 6: Direct API bypass with internal DB id (POST /api/auth/register/pm with DB id) -> REJECT 404.
TEST 7: Direct API bypass with random ID (POST /api/auth/register/pm with random ID) -> REJECT 404.
TEST 8: Canonical project_id + fake client-supplied ministry -> canonical project accepted, fake ministry ignored, actual derived.
"""

import os
import sys
import json
import sqlite3
from typing import Dict, Any, Optional
from fastapi.testclient import TestClient

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

from main import app
from auth import hash_password, create_session_token, get_db_connection
from auth_db import get_authoritative_project, lookup_project_details
from auth_supabase import is_supabase_auth_ready, get_headers, SUPABASE_URL

client = TestClient(app)

results = []

def record(test_num: int, title: str, passed: bool, detail: str = ""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] TEST {test_num}: {title}")
    if detail:
        print(f"       {detail}")
    results.append({
        "test_num": test_num,
        "title": title,
        "status": status,
        "passed": passed,
        "detail": detail,
    })


def cleanup_test_data(usernames):
    """Clean up test users and associated assignments/logs from both SQLite and Supabase."""
    # 1. SQLite cleanup
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(f"SELECT id FROM users WHERE username IN ({','.join(['?']*len(usernames))})", usernames)
        uids = [r["id"] for r in cur.fetchall()]
        if uids:
            cur.execute(f"DELETE FROM project_manager_assignments WHERE user_id IN ({','.join(['?']*len(uids))})", uids)
            cur.execute(f"DELETE FROM user_ministry_assignments WHERE user_id IN ({','.join(['?']*len(uids))})", uids)
            cur.execute(f"DELETE FROM daily_project_updates WHERE manager_user_id IN ({','.join(['?']*len(uids))})", uids)
            cur.execute(f"DELETE FROM audit_logs WHERE actor_id IN ({','.join(['?']*len(uids))})", uids)
            cur.execute(f"DELETE FROM users WHERE id IN ({','.join(['?']*len(uids))})", uids)
        cur.execute(f"DELETE FROM audit_logs WHERE actor_username IN ({','.join(['?']*len(usernames))})", usernames)
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[SQLite Cleanup Error] {e}")

    # 2. Supabase cleanup
    try:
        if is_supabase_auth_ready():
            import httpx
            with httpx.Client(timeout=10.0) as http_client:
                h = get_headers()
                names_in = f"({','.join(usernames)})"
                u_resp = http_client.get(f"{SUPABASE_URL}/rest/v1/users?username=in.{names_in}&select=id", headers=h)
                if u_resp.status_code == 200 and u_resp.json():
                    uids = [str(u["id"]) for u in u_resp.json()]
                    if uids:
                        ids_in = f"({','.join(uids)})"
                        http_client.delete(f"{SUPABASE_URL}/rest/v1/project_manager_assignments?user_id=in.{ids_in}", headers=h)
                        http_client.delete(f"{SUPABASE_URL}/rest/v1/user_ministry_assignments?user_id=in.{ids_in}", headers=h)
                        http_client.delete(f"{SUPABASE_URL}/rest/v1/daily_project_updates?user_id=in.{ids_in}", headers=h)
                        http_client.delete(f"{SUPABASE_URL}/rest/v1/audit_logs?actor_id=in.{ids_in}", headers=h)
                        http_client.delete(f"{SUPABASE_URL}/rest/v1/users?id=in.{ids_in}", headers=h)
                http_client.delete(f"{SUPABASE_URL}/rest/v1/audit_logs?actor_username=in.{names_in}", headers=h)
    except Exception as e:
        print(f"[Supabase Cleanup Warning] {e}")


def run_tests():
    print("=" * 80)
    print("INFRANETRA STRICT CANONICAL PROJECT ID DATABASE VALIDATION TEST SUITE")
    print("Authoritative Source of Truth: Supabase PostgreSQL infrastructure_projects.project_id")
    print("=" * 80)

    test_usernames = [
        "canon_pm_test_u1",
        "canon_pm_test_u2",
        "canon_pm_test_u6",
        "canon_pm_test_u7",
        "canon_pm_test_u8",
    ]

    # Pre-test cleanup
    cleanup_test_data(test_usernames)

    # Find a real project from Supabase/database where internal id != project_id
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, project_id, ministry, project_name
        FROM infrastructure_projects
        WHERE project_id IS NOT NULL AND length(project_id) > 2 AND CAST(id AS TEXT) != project_id
        ORDER BY report_month DESC
        LIMIT 1;
    """)
    row = cur.fetchone()
    conn.close()

    assert row is not None, "Need at least 1 real project with id != project_id"
    proj = dict(row)
    db_id = str(proj["id"]).strip()
    canonical_id = str(proj["project_id"]).strip()
    proj_name = proj["project_name"]
    proj_min = proj["ministry"]

    print(f"Target Project: Canonical Project ID='{canonical_id}' | Internal DB ID='{db_id}'")
    print(f"Project Name: '{proj_name[:40]}...' | Ministry: '{proj_min}'")
    print("-" * 80)

    # =========================================================================
    # TEST 1: Real canonical infrastructure_projects.project_id -> ACCEPT
    # =========================================================================
    try:
        lookup_resp = client.get(f"/api/projects/lookup/{canonical_id}")
        l_data = lookup_resp.json()

        reg_resp = client.post("/api/auth/register/pm", json={
            "username": "canon_pm_test_u1",
            "full_name": "Canonical PM One",
            "email": "canon1@gov.in",
            "password": "Password@123",
            "phone": "9876543210",
            "designation": "Project Director",
            "project_id": canonical_id
        })
        r_data = reg_resp.json()
        passed = (
            lookup_resp.status_code == 200 and
            l_data.get("project_found") is True and
            l_data.get("canonical_project_id") == canonical_id and
            reg_resp.status_code == 201 and
            r_data.get("success") is True and
            r_data.get("status") == "PENDING" and
            r_data.get("project_id") == canonical_id and
            r_data.get("ministry") == proj_min
        )
        record(1, "Real canonical infrastructure_projects.project_id -> ACCEPT", passed,
               f"Lookup HTTP {lookup_resp.status_code}, Reg HTTP {reg_resp.status_code}, status={r_data.get('status')}")
    except Exception as e:
        record(1, "Real canonical infrastructure_projects.project_id -> ACCEPT", False, str(e))

    # =========================================================================
    # TEST 2: Corresponding internal infrastructure_projects.id -> REJECT 404
    # =========================================================================
    try:
        lookup_resp = client.get(f"/api/projects/lookup/{db_id}")
        passed = (
            lookup_resp.status_code == 404 and
            "not found" in lookup_resp.json().get("detail", "").lower()
        )
        record(2, "Corresponding internal database id -> REJECT 404", passed,
               f"Tested DB ID '{db_id}', Lookup HTTP {lookup_resp.status_code}, detail='{lookup_resp.json().get('detail')}'")
    except Exception as e:
        record(2, "Corresponding internal database id -> REJECT 404", False, str(e))

    # =========================================================================
    # TEST 3: Random numeric ID -> 404
    # =========================================================================
    try:
        fake_numeric = "999888777"
        lookup_resp = client.get(f"/api/projects/lookup/{fake_numeric}")
        passed = (
            lookup_resp.status_code == 404 and
            "not found" in lookup_resp.json().get("detail", "").lower()
        )
        record(3, "Random numeric ID -> REJECT 404", passed,
               f"Tested '{fake_numeric}', HTTP {lookup_resp.status_code}, detail='{lookup_resp.json().get('detail')}'")
    except Exception as e:
        record(3, "Random numeric ID -> REJECT 404", False, str(e))

    # =========================================================================
    # TEST 4: Random alphanumeric ID -> 404
    # =========================================================================
    try:
        fake_alpha = "RANDOM_ALPHA_PROJECT_XYZ_999"
        lookup_resp = client.get(f"/api/projects/lookup/{fake_alpha}")
        passed = (
            lookup_resp.status_code == 404 and
            "not found" in lookup_resp.json().get("detail", "").lower()
        )
        record(4, "Random alphanumeric ID -> REJECT 404", passed,
               f"Tested '{fake_alpha}', HTTP {lookup_resp.status_code}, detail='{lookup_resp.json().get('detail')}'")
    except Exception as e:
        record(4, "Random alphanumeric ID -> REJECT 404", False, str(e))

    # =========================================================================
    # TEST 5: A valid external/real project identifier absent from dataset -> 404
    # =========================================================================
    try:
        external_id = "NHAI-2026-CORRIDOR-DELHI-MUMBAI-SPECIAL"
        lookup_resp = client.get(f"/api/projects/lookup/{external_id}")
        passed = (
            lookup_resp.status_code == 404 and
            "not found" in lookup_resp.json().get("detail", "").lower()
        )
        record(5, "Valid external identifier absent from dataset -> REJECT 404", passed,
               f"Tested '{external_id}', HTTP {lookup_resp.status_code}, detail='{lookup_resp.json().get('detail')}'")
    except Exception as e:
        record(5, "Valid external identifier absent from dataset -> REJECT 404", False, str(e))

    # =========================================================================
    # TEST 6: Direct API bypass with internal DB id -> 404
    # =========================================================================
    try:
        reg_resp = client.post("/api/auth/register/pm", json={
            "username": "canon_pm_test_u6",
            "full_name": "Bypass DB ID User",
            "email": "bypass_db_id@gov.in",
            "password": "Password@123",
            "project_id": db_id # Sent internal database id
        })
        passed = (
            reg_resp.status_code == 404 and
            "not found" in reg_resp.json().get("detail", "").lower()
        )
        record(6, "Direct API bypass with internal DB id -> REJECT 404", passed,
               f"Tested DB ID '{db_id}', Reg HTTP {reg_resp.status_code}, detail='{reg_resp.json().get('detail')}'")
    except Exception as e:
        record(6, "Direct API bypass with internal DB id -> REJECT 404", False, str(e))

    # =========================================================================
    # TEST 7: Direct API bypass with random ID -> 404
    # =========================================================================
    try:
        random_bypass_id = "RANDOM_BYPASS_ATTACK_888"
        reg_resp = client.post("/api/auth/register/pm", json={
            "username": "canon_pm_test_u7",
            "full_name": "Bypass Random User",
            "email": "bypass_random@gov.in",
            "password": "Password@123",
            "project_id": random_bypass_id
        })
        passed = (
            reg_resp.status_code == 404 and
            "not found" in reg_resp.json().get("detail", "").lower()
        )
        record(7, "Direct API bypass with random ID -> REJECT 404", passed,
               f"Tested '{random_bypass_id}', Reg HTTP {reg_resp.status_code}, detail='{reg_resp.json().get('detail')}'")
    except Exception as e:
        record(7, "Direct API bypass with random ID -> REJECT 404", False, str(e))

    # =========================================================================
    # TEST 8: Canonical project_id + fake ministry -> accepted, fake ignored
    # =========================================================================
    try:
        cleanup_test_data(["canon_pm_test_u1"]) # Release project to respect One PM per project rule
        reg_resp = client.post("/api/auth/register/pm", json={
            "username": "canon_pm_test_u8",
            "full_name": "Fake Ministry User",
            "email": "fake_min_u8@gov.in",
            "password": "Password@123",
            "project_id": canonical_id,
            "ministry": "Malicious Fake Moon Ministry",
            "approving_ministry": "Malicious Fake Moon Ministry",
            "project_name": "Tampered Name"
        })
        r_data = reg_resp.json()
        passed = (
            reg_resp.status_code == 201 and
            r_data.get("ministry") == proj_min and
            r_data.get("project_name") == proj_name and
            r_data.get("ministry") != "Malicious Fake Moon Ministry"
        )
        record(8, "Canonical project_id + fake ministry -> accepted, fake ignored, DB derived", passed,
               f"Reg HTTP {reg_resp.status_code}, derived ministry='{r_data.get('ministry')}' (expected '{proj_min}')")
    except Exception as e:
        record(8, "Canonical project_id + fake ministry -> accepted, fake ignored, DB derived", False, str(e))

    # Explicit Regression Test: internal database ID != canonical project_id -> registration rejected
    print("-" * 80)
    print("EXPLICIT REGRESSION TEST: internal database ID != canonical project_id")
    test_db_id = "9" # as observed by user
    r_check = client.get(f"/api/projects/lookup/{test_db_id}")
    print(f"Lookup for internal database ID '9' -> HTTP {r_check.status_code} ({r_check.json().get('detail')})")
    assert r_check.status_code == 404, f"Expected 404 for internal DB ID 9, got {r_check.status_code}"

    # Cleanup test data after run
    cleanup_test_data(test_usernames)

    print("=" * 80)
    total_passed = sum(1 for r in results if r["passed"])
    print(f"RESULTS: {total_passed}/{len(results)} TESTS PASSED ({total_passed / len(results) * 100:.1f}%)")
    print("=" * 80)
    if total_passed != len(results):
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
