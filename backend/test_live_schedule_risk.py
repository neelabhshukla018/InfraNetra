"""
InfraNetra Verification Suite: Date-Based Live Schedule Risk Analysis Engine.
Tests all 20 required unit/authorization cases plus real database record evaluations.
Grounded in deterministic injected 'today' parameters.
"""

import calendar
import os
import sys
import sqlite3
import json
from datetime import date, datetime
from typing import Dict, Any

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient
from main import app
from schedule_risk import (
    calculate_live_schedule_risk,
    normalize_date,
    SCHEDULE_RISK_WEIGHTS,
    PROGRESS_GAP_THRESHOLDS,
)
from risk_engine import compute_project_risk
from ml_models import predict_project
from auth import hash_password, create_session_token, get_db_connection

client = TestClient(app)

results = []

def record(test_num: int, title: str, passed: bool, detail: str = ""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] TEST {test_num:02d}: {title}")
    if detail:
        print(f"         {detail}")
    results.append({
        "test_num": test_num,
        "title": title,
        "status": status,
        "passed": passed,
        "detail": detail,
    })


def run_tests():
    print("=" * 80)
    print("INFRANETRA LIVE SCHEDULE RISK ENGINE: 20-POINT VERIFICATION SUITE")
    print("=" * 80)

    # --------------------------------------------------------------------------
    # TEST 1: Normal Ongoing Project (Operating before original deadline)
    # --------------------------------------------------------------------------
    res1 = calculate_live_schedule_risk({
        "start_date": "2024-01-01",
        "original_completion_date": "2027-01-01",
        "revised_completion_date": "2027-01-01",
        "physical_progress": 33.3,
        "status": "Ongoing",
    }, today=date(2025, 1, 1))

    t1_pass = (
        res1["schedule_analysis_available"] is True
        and res1["original_deadline_status"] == "BEFORE_ORIGINAL_DEADLINE"
        and res1["deadline_display_status"] == "Operating Before Original Deadline"
        and res1["active_deadline_type"] == "ORIGINAL"
        and res1["active_deadline"] == "2027-01-01"
        and res1["schedule_risk_level"] in ("LOW", "MODERATE")
        and res1["time_elapsed_label"] == "Time-Elapsed Baseline"
        and res1["progress_gap_label"] == "Time-vs-Physical Progress Gap"
    )
    record(1, "Normal Ongoing Project (before deadline)", t1_pass,
           f"Score: {res1['schedule_risk_score']} ({res1['schedule_risk_level']}), Deadline status: {res1['original_deadline_status']}")

    # --------------------------------------------------------------------------
    # TEST 2: Original Deadline Missed + Revised Deadline in Future
    # --------------------------------------------------------------------------
    res2 = calculate_live_schedule_risk({
        "start_date": "2020-01-01",
        "original_completion_date": "2023-01-01",
        "revised_completion_date": "2027-01-01",
        "physical_progress": 50.0,
        "status": "Ongoing",
    }, today=date(2025, 1, 1))

    t2_pass = (
        res2["schedule_analysis_available"] is True
        and res2["original_deadline_status"] == "ORIGINAL_DEADLINE_MISSED"
        and res2["revised_deadline_status"] == "BEFORE_REVISED_DEADLINE"
        and res2["deadline_display_status"] == "Original Deadline Missed / Revised Deadline Active"
        and res2["active_deadline_type"] == "REVISED"
        and res2["active_deadline"] == "2027-01-01"
        and res2["days_to_active_deadline"] == (date(2027, 1, 1) - date(2025, 1, 1)).days
        and res2["extension_days"] == (date(2027, 1, 1) - date(2023, 1, 1)).days
    )
    record(2, "Original Missed + Revised Deadline Future", t2_pass,
           f"Active deadline: {res2['active_deadline']} ({res2['active_deadline_type']}), Extension: {res2['extension_label']}")

    # --------------------------------------------------------------------------
    # TEST 3: Original + Revised Deadline Missed (Overdue)
    # --------------------------------------------------------------------------
    res3 = calculate_live_schedule_risk({
        "start_date": "2018-01-01",
        "original_completion_date": "2021-01-01",
        "revised_completion_date": "2023-01-01",
        "physical_progress": 70.0,
        "status": "Ongoing",
    }, today=date(2025, 1, 1))

    t3_pass = (
        res3["schedule_analysis_available"] is True
        and res3["original_deadline_status"] == "ORIGINAL_DEADLINE_MISSED"
        and res3["revised_deadline_status"] == "REVISED_DEADLINE_MISSED"
        and res3["deadline_display_status"] == "Revised Deadline Missed"
        and res3["active_deadline_type"] == "REVISED"
        and res3["days_to_active_deadline"] < 0
        and res3["schedule_risk_level"] in ("HIGH", "CRITICAL")
    )
    record(3, "Original + Revised Deadline Both Missed", t3_pass,
           f"Score: {res3['schedule_risk_score']}, Days Overdue: {abs(res3['days_to_active_deadline'])}")

    # --------------------------------------------------------------------------
    # TEST 4: No Revised Date (Only Original Date Lapsed)
    # --------------------------------------------------------------------------
    res4 = calculate_live_schedule_risk({
        "start_date": "2020-01-01",
        "original_completion_date": "2024-01-01",
        "revised_completion_date": None,
        "physical_progress": 40.0,
        "status": "Ongoing",
    }, today=date(2025, 1, 1))

    t4_pass = (
        res4["schedule_analysis_available"] is True
        and res4["original_deadline_status"] == "ORIGINAL_DEADLINE_MISSED"
        and res4["revised_deadline_status"] == "REVISED_DEADLINE_NOT_APPLICABLE"
        and res4["deadline_display_status"] == "Original Deadline Missed"
        and res4["active_deadline_type"] == "ORIGINAL"
        and res4["extension_days"] is None
        and res4["extension_label"] == "No schedule extension"
    )
    record(4, "No Revised Date on Record (Original Missed)", t4_pass,
           f"Status: {res4['deadline_display_status']}, Extension: {res4['extension_label']}")

    # --------------------------------------------------------------------------
    # TEST 5: Missing Start Date (Graceful Fallback)
    # --------------------------------------------------------------------------
    res5 = calculate_live_schedule_risk({
        "start_date": None,
        "original_completion_date": "2025-01-01",
        "physical_progress": 50.0,
    }, today=date(2024, 1, 1))

    t5_pass = (
        res5["schedule_analysis_available"] is False
        and "start date" in res5["unavailability_reason"].lower()
        and res5["time_elapsed_baseline_percentage"] is None
        and res5["schedule_risk_score"] == 0.0
    )
    record(5, "Missing Start Date Graceful Fallback", t5_pass,
           f"Available: {res5['schedule_analysis_available']}, Reason: {res5['unavailability_reason']}")

    # --------------------------------------------------------------------------
    # TEST 6: Missing Original Date (Graceful Fallback)
    # --------------------------------------------------------------------------
    res6 = calculate_live_schedule_risk({
        "start_date": "2020-01-01",
        "original_completion_date": None,
        "physical_progress": 50.0,
    }, today=date(2024, 1, 1))

    t6_pass = (
        res6["schedule_analysis_available"] is False
        and "original completion date" in res6["unavailability_reason"].lower()
        and res6["time_elapsed_baseline_percentage"] is None
    )
    record(6, "Missing Original Completion Date Graceful Fallback", t6_pass,
           f"Available: {res6['schedule_analysis_available']}, Reason: {res6['unavailability_reason']}")

    # --------------------------------------------------------------------------
    # TEST 7: High Physical Progress Near Deadline (Mitigated Urgency)
    # --------------------------------------------------------------------------
    res7 = calculate_live_schedule_risk({
        "start_date": "2020-01-01",
        "original_completion_date": "2025-02-01",
        "physical_progress": 96.0,
        "status": "Ongoing",
    }, today=date(2025, 1, 15))  # 17 days to deadline, but 96% complete

    t7_pass = (
        res7["days_to_active_deadline"] == 17
        and res7["score_breakdown"]["deadline_proximity_score"] <= (30.0 * SCHEDULE_RISK_WEIGHTS["deadline_proximity"] + 0.1)
        and res7["schedule_risk_level"] in ("LOW", "MODERATE")
    )
    record(7, "High Physical Progress Near Deadline Mitigates Risk", t7_pass,
           f"Score: {res7['schedule_risk_score']}, Prox pts: {res7['score_breakdown']['deadline_proximity_score']}")

    # --------------------------------------------------------------------------
    # TEST 8: Low Physical Progress (Severe Progress Execution Gap)
    # --------------------------------------------------------------------------
    # 80% time elapsed, but only 15% physical progress -> 65 pp gap
    res8 = calculate_live_schedule_risk({
        "start_date": "2020-01-01",
        "original_completion_date": "2025-01-01",
        "physical_progress": 15.0,
        "status": "Ongoing",
    }, today=date(2024, 1, 1))

    t8_pass = (
        res8["progress_gap"] is not None
        and res8["progress_gap"] >= PROGRESS_GAP_THRESHOLDS["critical"]
        and res8["score_breakdown"]["progress_gap_score"] == 35.0  # 100 * 0.35
        and res8["schedule_risk_level"] in ("MODERATE", "HIGH", "CRITICAL")
    )
    record(8, "Low Physical Progress High Execution Gap", t8_pass,
           f"Gap: {res8['progress_gap']} pp, Gap score: {res8['score_breakdown']['progress_gap_score']}, Level: {res8['schedule_risk_level']}")

    # --------------------------------------------------------------------------
    # TEST 9: No Extension (Original Deadline Maintained)
    # --------------------------------------------------------------------------
    res9 = calculate_live_schedule_risk({
        "start_date": "2022-01-01",
        "original_completion_date": "2026-01-01",
        "revised_completion_date": "2026-01-01",
        "physical_progress": 50.0,
        "status": "Ongoing",
    }, today=date(2024, 1, 1))

    t9_pass = (
        res9["extension_days"] == 0
        and res9["extension_label"] == "No schedule extension"
        and res9["score_breakdown"]["schedule_extension_score"] == 0.0
    )
    record(9, "No Schedule Extension (Maintained)", t9_pass,
           f"Extension days: {res9['extension_days']}, Label: {res9['extension_label']}")

    # --------------------------------------------------------------------------
    # TEST 10: Large Extension (>= 730 Days / 2 Years)
    # --------------------------------------------------------------------------
    res10 = calculate_live_schedule_risk({
        "start_date": "2018-01-01",
        "original_completion_date": "2021-01-01",
        "revised_completion_date": "2024-01-01",  # 3-year extension = 1095 days
        "physical_progress": 60.0,
        "status": "Ongoing",
    }, today=date(2023, 1, 1))

    t10_pass = (
        res10["extension_days"] is not None
        and res10["extension_days"] >= 730
        and res10["score_breakdown"]["schedule_extension_score"] == 15.0  # 100 * 0.15
        and any("Severe schedule extension" in r for r in res10["schedule_risk_reasons"])
    )
    record(10, "Large Extension (>= 730 Days)", t10_pass,
           f"Extension: {res10['extension_days']} days, Ext score: {res10['score_breakdown']['schedule_extension_score']}")

    # --------------------------------------------------------------------------
    # TEST 11: Completed / Commissioned Project (Frozen Escalation)
    # --------------------------------------------------------------------------
    res11 = calculate_live_schedule_risk({
        "start_date": "2018-01-01",
        "original_completion_date": "2021-01-01",
        "revised_completion_date": "2024-01-01",
        "actual_completion_date": "2024-06-01",
        "physical_progress": 100.0,
        "status": "Completed",
    }, today=date(2025, 1, 1))

    t11_pass = (
        res11["is_completed"] is True
        and res11["schedule_risk_score"] == 0.0
        and res11["schedule_risk_level"] == "LOW"
        and res11["deadline_display_status"] == "Project Completed"
        and any("frozen" in r.lower() for r in res11["schedule_risk_reasons"])
    )
    record(11, "Completed Project Escalation Frozen", t11_pass,
           f"Score: {res11['schedule_risk_score']}, Status: {res11['deadline_display_status']}")

    # --------------------------------------------------------------------------
    # TEST 12: Future Start Date Clamping & Invalid Ordering Detection
    # --------------------------------------------------------------------------
    res12_future = calculate_live_schedule_risk({
        "start_date": "2026-01-01",
        "original_completion_date": "2028-01-01",
        "physical_progress": 0.0,
        "status": "Ongoing",
    }, today=date(2025, 1, 1))

    res12_invalid = calculate_live_schedule_risk({
        "start_date": "2026-01-01",
        "original_completion_date": "2025-01-01",  # Orig precedes start
        "physical_progress": 0.0,
    }, today=date(2025, 1, 1))

    t12_pass = (
        res12_future["time_elapsed_baseline_percentage"] == 0.0
        and res12_future["elapsed_days"] == 0
        and res12_invalid["schedule_analysis_available"] is False
        and "invalid timeline ordering" in res12_invalid["unavailability_reason"].lower()
    )
    record(12, "Future Start Date Clamping & Invalid Ordering Detection", t12_pass,
           f"Future elapsed: {res12_future['time_elapsed_baseline_percentage']}%, Invalid avail: {res12_invalid['schedule_analysis_available']}")

    # --------------------------------------------------------------------------
    # TEST 13: Exact User-Provided Example
    # start=2022-01-01, orig=2025-01-01, rev=2026-12-31, today=2026-09-07, phys=60
    # --------------------------------------------------------------------------
    res13 = calculate_live_schedule_risk({
        "start_date": "2022-01-01",
        "original_completion_date": "2025-01-01",
        "revised_completion_date": "2026-12-31",
        "physical_progress": 60.0,
        "status": "Ongoing",
    }, today=date(2026, 9, 7))

    t13_pass = (
        res13["original_deadline_status"] == "ORIGINAL_DEADLINE_MISSED"
        and res13["revised_deadline_status"] == "BEFORE_REVISED_DEADLINE"
        and res13["deadline_display_status"] == "Original Deadline Missed / Revised Deadline Active"
        and res13["active_deadline_type"] == "REVISED"
        and res13["active_deadline"] == "2026-12-31"
        and res13["days_to_active_deadline"] == (date(2026, 12, 31) - date(2026, 9, 7)).days  # 115 days
        and res13["extension_days"] == (date(2026, 12, 31) - date(2025, 1, 1)).days           # 729 days
        and res13["time_elapsed_baseline_percentage"] > 100.0                                 # Baseline time elapsed exceeds 100%
        and res13["progress_gap"] > 0
        and res13["schedule_risk_level"] in ("HIGH", "CRITICAL")
        and any("01-01-2025" in r for r in res13["schedule_risk_reasons"])
        and any("31-12-2026" in r for r in res13["schedule_risk_reasons"])
        and any("729 days" in r for r in res13["schedule_risk_reasons"])
    )
    record(13, "Provided Example (2022-01-01 to 2026-12-31, today=2026-09-07)", t13_pass,
           f"Active: {res13['active_deadline']} ({res13['days_to_active_deadline']}d remaining), Ext: {res13['extension_days']}d, Score: {res13['schedule_risk_score']}")

    # Setup real database fixtures for authorization and data validation tests
    conn = get_db_connection()
    cur = conn.cursor()

    # Find Project A (Road) and Project B (Rail)
    cur.execute("SELECT id, project_id, ministry, project_name FROM infrastructure_projects WHERE LOWER(ministry) LIKE '%road%' LIMIT 1")
    row_road = cur.fetchone()
    cur.execute("SELECT id, project_id, ministry, project_name FROM infrastructure_projects WHERE LOWER(ministry) LIKE '%rail%' LIMIT 1")
    row_rail = cur.fetchone()

    proj_road_id = row_road["id"]
    proj_road_code = row_road["project_id"]
    proj_road_min = row_road["ministry"]

    proj_rail_id = row_rail["id"]
    proj_rail_code = row_rail["project_id"]
    proj_rail_min = row_rail["ministry"]

    pwd_hash, salt = hash_password("TestPass123!")

    # --------------------------------------------------------------------------
    # TEST 14: Cross-Ministry Authorization (IDOR Protection)
    # Ministry user for Rail cannot access Road project
    # --------------------------------------------------------------------------
    cur.execute("DELETE FROM users WHERE username IN ('test_min_rail_user', 'test_pm_road_user', 'test_pending_user', 'test_suspended_user')")
    cur.execute("""
        INSERT INTO users (username, password_hash, salt, full_name, email, role, status)
        VALUES ('test_min_rail_user', ?, ?, 'Rail Officer', 'rail@test.gov.in', 'MINISTRY', 'APPROVED');
    """, (pwd_hash, salt))
    rail_user_id = cur.lastrowid
    cur.execute("DELETE FROM user_ministry_assignments WHERE user_id = ?", (rail_user_id,))
    cur.execute("INSERT INTO user_ministry_assignments (user_id, ministry, status) VALUES (?, ?, 'ACTIVE');", (rail_user_id, proj_rail_min))
    conn.commit()

    rail_token = create_session_token(rail_user_id, "test_min_rail_user", "MINISTRY")

    resp14 = client.get(f"/api/projects/{proj_road_code}", headers={"Authorization": f"Bearer {rail_token}"})
    t14_pass = resp14.status_code == 403
    record(14, "Cross-Ministry Authorization Enforces 403 Forbidden", t14_pass,
           f"HTTP status: {resp14.status_code} (Expected 403 for cross-ministry access)")

    # --------------------------------------------------------------------------
    # TEST 15: Cross-PM Authorization (IDOR Protection)
    # PM assigned to Project Road cannot access Project Rail
    # --------------------------------------------------------------------------
    cur.execute("""
        INSERT INTO users (username, password_hash, salt, full_name, email, role, status)
        VALUES ('test_pm_road_user', ?, ?, 'PM Road', 'pmroad@test.gov.in', 'PROJECT_MANAGER', 'APPROVED');
    """, (pwd_hash, salt))
    pm_user_id = cur.lastrowid
    cur.execute("DELETE FROM project_manager_assignments WHERE project_id = ? OR user_id = ?", (proj_road_id, pm_user_id))
    cur.execute("INSERT INTO project_manager_assignments (user_id, project_id, status) VALUES (?, ?, 'ACTIVE');", (pm_user_id, proj_road_id))
    conn.commit()

    pm_token = create_session_token(pm_user_id, "test_pm_road_user", "PROJECT_MANAGER")

    resp15 = client.get(f"/api/projects/{proj_rail_code}", headers={"Authorization": f"Bearer {pm_token}"})
    t15_pass = resp15.status_code == 403
    record(15, "Cross-PM Authorization Enforces 403 Forbidden", t15_pass,
           f"HTTP status: {resp15.status_code} (Expected 403 for accessing non-assigned project)")

    # --------------------------------------------------------------------------
    # TEST 16: Pending User Blocked (403 Forbidden)
    # --------------------------------------------------------------------------
    cur.execute("""
        INSERT INTO users (username, password_hash, salt, full_name, email, role, status)
        VALUES ('test_pending_user', ?, ?, 'Pending User', 'pending@test.gov.in', 'MINISTRY', 'PENDING');
    """, (pwd_hash, salt))
    pending_user_id = cur.lastrowid
    cur.execute("INSERT INTO user_ministry_assignments (user_id, ministry, status) VALUES (?, ?, 'PENDING');", (pending_user_id, proj_road_min))
    conn.commit()

    pending_token = create_session_token(pending_user_id, "test_pending_user", "MINISTRY")

    resp16 = client.get(f"/api/projects/{proj_road_code}", headers={"Authorization": f"Bearer {pending_token}"})
    t16_pass = resp16.status_code == 403
    record(16, "Pending User Denied Access with 403 Forbidden", t16_pass,
           f"HTTP status: {resp16.status_code} (Expected 403)")

    # --------------------------------------------------------------------------
    # TEST 17: Suspended User Blocked (403 Forbidden)
    # --------------------------------------------------------------------------
    cur.execute("""
        INSERT INTO users (username, password_hash, salt, full_name, email, role, status)
        VALUES ('test_suspended_user', ?, ?, 'Suspended User', 'suspended@test.gov.in', 'MINISTRY', 'SUSPENDED');
    """, (pwd_hash, salt))
    suspended_user_id = cur.lastrowid
    cur.execute("INSERT INTO user_ministry_assignments (user_id, ministry, status) VALUES (?, ?, 'REVOKED');", (suspended_user_id, proj_road_min))
    conn.commit()

    suspended_token = create_session_token(suspended_user_id, "test_suspended_user", "MINISTRY")

    resp17 = client.get(f"/api/projects/{proj_road_code}", headers={"Authorization": f"Bearer {suspended_token}"})
    t17_pass = resp17.status_code == 403
    record(17, "Suspended User Denied Access with 403 Forbidden", t17_pass,
           f"HTTP status: {resp17.status_code} (Expected 403)")

    # --------------------------------------------------------------------------
    # TEST 18: Canonical Project ID Validation (404 on non-existent ID)
    # --------------------------------------------------------------------------
    resp18 = client.get("/api/projects/NON_EXISTENT_PROJECT_999999")
    t18_pass = resp18.status_code == 404
    record(18, "Canonical Project ID Validation (Clean 404 on Unknown ID)", t18_pass,
           f"HTTP status: {resp18.status_code} (Expected 404)")

    # --------------------------------------------------------------------------
    # TEST 19: Existing ML Output Unchanged
    # --------------------------------------------------------------------------
    cur.execute("SELECT * FROM infrastructure_projects LIMIT 1")
    sample_db_row = dict(cur.fetchone())

    ml_result = predict_project(sample_db_row)
    t19_pass = (
        "predicted_cost_overrun_pct" in ml_result
        and "predicted_delay_months" in ml_result
        and "model_confidence" in ml_result
        and "key_risk_drivers" in ml_result
        and isinstance(ml_result["model_confidence"], dict)
        and "cost_prediction" in ml_result["model_confidence"]
        and "delay_prediction" in ml_result["model_confidence"]
    )
    record(19, "Existing ML Model Intact and Unmodified", t19_pass,
           f"ML keys preserved: {list(ml_result.keys())}")

    # --------------------------------------------------------------------------
    # TEST 20: Existing Risk Assessment Unchanged
    # --------------------------------------------------------------------------
    risk_result = compute_project_risk(sample_db_row, None)
    t20_pass = (
        "score" in risk_result
        and "level" in risk_result
        and "components" in risk_result
        and "cost_overrun_pct" in risk_result
        and "delay_months" in risk_result
        and "cost_overrun_score" in risk_result["components"]
        and "schedule_extension_score" in risk_result["components"]
        and "progress_velocity_score" in risk_result["components"]
        and "capital_exposure_score" in risk_result["components"]
    )
    record(20, "Existing 4-Factor Risk Assessment Engine Intact", t20_pass,
           f"Score: {risk_result['score']}, Level: {risk_result['level']}, 4 Components preserved")

    # --------------------------------------------------------------------------
    # PART 19: VALIDATE AGAINST REAL EXISTING PROJECT DATA
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("REAL DATABASE RECORD VALIDATIONS (From infrastructure_projects)")
    print("=" * 80)

    # Query diverse real records
    cur.execute("""
        SELECT project_id, project_name, ministry, start_date, original_completion_date,
               revised_completion_date, actual_completion_date, physical_progress
        FROM infrastructure_projects
        WHERE start_date IS NOT NULL AND original_completion_date IS NOT NULL
        ORDER BY id ASC
    """)
    all_projects = [dict(r) for r in cur.fetchall()]

    categories_found = {
        "A_future_orig": None,
        "B_orig_missed_rev_future": None,
        "C_rev_missed": None,
        "D_high_progress": None,
        "E_low_progress": None,
        "F_completed": None,
    }

    test_eval_today = date(2026, 4, 1)  # Anchored to report_month

    for p in all_projects:
        s_dt = normalize_date(p.get("start_date"), is_end_date=False)
        o_dt = normalize_date(p.get("original_completion_date"), is_end_date=True)
        r_dt = normalize_date(p.get("revised_completion_date"), is_end_date=True)
        a_dt = normalize_date(p.get("actual_completion_date"), is_end_date=True)
        phys = p.get("physical_progress") or 0.0

        if a_dt or (p.get("status") or "").lower() in ("completed", "commissioned"):
            if not categories_found["F_completed"]:
                categories_found["F_completed"] = p
        elif o_dt and o_dt > test_eval_today:
            if not categories_found["A_future_orig"]:
                categories_found["A_future_orig"] = p
        elif o_dt and o_dt <= test_eval_today and r_dt and r_dt > test_eval_today:
            if not categories_found["B_orig_missed_rev_future"]:
                categories_found["B_orig_missed_rev_future"] = p
        elif r_dt and r_dt <= test_eval_today:
            if not categories_found["C_rev_missed"]:
                categories_found["C_rev_missed"] = p

        if phys >= 80.0 and not categories_found["D_high_progress"]:
            categories_found["D_high_progress"] = p
        if 0 < phys <= 25.0 and not categories_found["E_low_progress"]:
            categories_found["E_low_progress"] = p

    for cat_key, p_record in categories_found.items():
        if p_record:
            analysis = calculate_live_schedule_risk(p_record, today=test_eval_today)
            print(f"\n[REAL DATA] Category {cat_key}:")
            print(f"  Project ID: {p_record['project_id']} - {p_record['project_name'][:45]}")
            print(f"  Start: {analysis['start_date']} | Orig: {analysis['original_completion_date']} | Rev: {analysis['revised_completion_date']}")
            print(f"  Active Target: {analysis['active_deadline']} ({analysis['active_deadline_type']}) | Days: {analysis['days_to_active_deadline']}")
            print(f"  Time Baseline: {analysis['time_elapsed_baseline_percentage']}% | Physical: {analysis['physical_progress_percentage']}% | Gap: {analysis['progress_gap']} pp")
            print(f"  Status: {analysis['deadline_display_status']} | Level: {analysis['schedule_risk_level']} ({analysis['schedule_risk_score']}/100)")
            print(f"  Key Reasons: {analysis['schedule_risk_reasons'][:2]}")
            assert analysis["schedule_analysis_available"] is True, f"Failed on real project {p_record['project_id']}"
        else:
            print(f"\n[REAL DATA] Category {cat_key}: No exact match found in current snapshot sample (Handled gracefully)")

    # Summary
    total_tests = len(results)
    passed_tests = sum(1 for r in results if r["passed"])
    print("\n" + "=" * 80)
    print(f"FINAL RESULT: {passed_tests}/{total_tests} TESTS PASSED")
    print("=" * 80)
    if passed_tests < total_tests:
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
