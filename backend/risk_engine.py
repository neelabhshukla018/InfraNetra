"""
InfraNetra Deterministic Risk Engine & Early Warning Generator.
Grounded exclusively in MoSPI PAIMANA Flash Report database records.
No simulated narratives or fabricated data.
"""

import re
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple


def parse_iso_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse date strings safely (handles YYYY-MM-DD or YYYY-MM)."""
    if not date_str:
        return None
    s = str(date_str).strip()
    m = re.match(r"^(\d{4})-(\d{1,2})", s)
    if not m:
        return None
    year, month = int(m.group(1)), int(m.group(2))
    day = 1
    day_match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if day_match:
        day = min(int(day_match.group(3)), 28)
    try:
        return datetime(year, month, day)
    except Exception:
        return None


def calculate_month_difference(d1: Optional[datetime], d2: Optional[datetime]) -> Optional[int]:
    """Return d1 - d2 in approximate whole months."""
    if not d1 or not d2:
        return None
    return (d1.year - d2.year) * 12 + (d1.month - d2.month)


def compute_project_risk(
    project: Dict[str, Any],
    prev_snapshot: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Compute deterministic risk score (0-100) and component breakdown.
    
    Components:
    1. Cost Overrun (0 - 30 pts)
    2. Schedule Extension (0 - 30 pts)
    3. Progress Velocity / Stagnation (0 - 25 pts)
    4. Capital Exposure (0 - 15 pts)
    """
    orig_cost = project.get("original_cost")
    rev_cost = project.get("revised_cost") or orig_cost
    expenditure = project.get("expenditure")
    progress = project.get("physical_progress")
    
    orig_date_dt = parse_iso_date(project.get("original_completion_date"))
    rev_date_dt = parse_iso_date(project.get("revised_completion_date"))
    act_date_dt = parse_iso_date(project.get("actual_completion_date"))

    effective_target_dt = act_date_dt or rev_date_dt

    # 1. Cost Overrun Component (0-30 pts)
    cost_pts = 0.0
    cost_overrun_pct = 0.0
    if orig_cost and orig_cost > 0 and rev_cost is not None:
        cost_overrun_pct = round(((rev_cost - orig_cost) / orig_cost) * 100.0, 2)
        if cost_overrun_pct > 25.0:
            cost_pts = 30.0
        elif cost_overrun_pct > 10.0:
            cost_pts = 20.0
        elif cost_overrun_pct > 0.0:
            cost_pts = 10.0

    # 2. Schedule Extension Component (0-30 pts)
    sched_pts = 0.0
    delay_months = 0
    if orig_date_dt and effective_target_dt:
        diff = calculate_month_difference(effective_target_dt, orig_date_dt)
        if diff is not None and diff > 0:
            delay_months = diff
            if delay_months > 18:
                sched_pts = 30.0
            elif delay_months > 6:
                sched_pts = 20.0
            else:
                sched_pts = 10.0

    # 3. Progress Velocity / Stagnation Component (0-25 pts)
    progress_pts = 0.0
    progress_delta: Optional[float] = None
    if prev_snapshot and prev_snapshot.get("physical_progress") is not None and progress is not None:
        prev_p = float(prev_snapshot["physical_progress"])
        curr_p = float(progress)
        progress_delta = round(curr_p - prev_p, 2)
        if curr_p < 100.0:
            if progress_delta < 0:
                progress_pts = 25.0  # Data regression/decline
            elif progress_delta == 0:
                progress_pts = 18.0  # Stagnant across consecutive snapshots
            elif progress_delta < 1.0:
                progress_pts = 10.0  # Very sluggish progress
            else:
                progress_pts = 0.0
    else:
        # Fallback when single snapshot: expenditure vs physical progress divergence
        if rev_cost and rev_cost > 0 and expenditure is not None and progress is not None:
            exp_ratio = expenditure / rev_cost
            prog_ratio = (progress / 100.0)
            if exp_ratio > (prog_ratio + 0.20):
                progress_pts = 15.0
            else:
                progress_pts = 5.0
        else:
            progress_pts = 5.0

    # 4. Capital Exposure Component (0-15 pts)
    exposure_pts = 0.0
    val = rev_cost if rev_cost is not None else (orig_cost or 0.0)
    if val >= 10000.0:  # Rs. 10,000 Cr+
        exposure_pts = 15.0
    elif val >= 5000.0:  # Rs. 5,000 Cr+
        exposure_pts = 10.0
    elif val >= 1000.0:  # Rs. 1,000 Cr+
        exposure_pts = 5.0

    total_score = min(100.0, max(0.0, cost_pts + sched_pts + progress_pts + exposure_pts))
    total_score = round(total_score, 1)

    if total_score >= 75.0:
        risk_level = "CRITICAL"
    elif total_score >= 50.0:
        risk_level = "HIGH"
    elif total_score >= 25.0:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return {
        "score": total_score,
        "level": risk_level,
        "cost_overrun_pct": cost_overrun_pct,
        "delay_months": delay_months,
        "progress_delta": progress_delta,
        "components": {
            "cost_overrun_score": cost_pts,
            "schedule_extension_score": sched_pts,
            "progress_velocity_score": progress_pts,
            "capital_exposure_score": exposure_pts,
        }
    }


def generate_early_warnings(
    project: Dict[str, Any],
    prev_snapshot: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Generate deterministic, data-grounded early warnings for a project.
    Strictly generated from the 4 explicit triggers.
    """
    warnings = []
    pid = project.get("project_id", "")
    pname = project.get("project_name", "")
    orig_cost = project.get("original_cost")
    rev_cost = project.get("revised_cost")
    expenditure = project.get("expenditure")
    progress = project.get("physical_progress")
    orig_date = project.get("original_completion_date")
    rev_date = project.get("revised_completion_date")
    act_date = project.get("actual_completion_date")
    report_month = project.get("report_month", "")

    # Trigger 1: Cost Escalation
    if orig_cost and rev_cost and rev_cost > orig_cost:
        pct = round(((rev_cost - orig_cost) / orig_cost) * 100.0, 2)
        diff = round(rev_cost - orig_cost, 2)
        severity = "CRITICAL" if pct >= 25.0 or diff >= 1000.0 else "HIGH"
        warnings.append({
            "id": f"ew-cost-{pid}-{report_month}",
            "project_id": pid,
            "project_name": pname,
            "category": "COST_ESCALATION",
            "title": "Cost Escalation Detected",
            "description": f"Approved budget increased from ₹{orig_cost:,.2f} Cr to ₹{rev_cost:,.2f} Cr (+₹{diff:,.2f} Cr, +{pct}%).",
            "severity": severity,
            "metric": f"+{pct}%",
            "report_month": report_month,
        })

    # Trigger 2: Schedule Extension
    orig_date_dt = parse_iso_date(orig_date)
    rev_date_dt = parse_iso_date(rev_date)
    if orig_date_dt and rev_date_dt and rev_date_dt > orig_date_dt:
        delay_m = calculate_month_difference(rev_date_dt, orig_date_dt) or 0
        severity = "CRITICAL" if delay_m > 18 else ("HIGH" if delay_m > 6 else "MEDIUM")
        warnings.append({
            "id": f"ew-sched-{pid}-{report_month}",
            "project_id": pid,
            "project_name": pname,
            "category": "SCHEDULE_EXTENSION",
            "title": "Target Completion Postponed",
            "description": f"Anticipated completion deferred from {orig_date} to {rev_date} ({delay_m} months delay).",
            "severity": severity,
            "metric": f"+{delay_m} months",
            "report_month": report_month,
        })

    # Trigger 3: Progress Stagnation / Decline
    if prev_snapshot and prev_snapshot.get("physical_progress") is not None and progress is not None:
        prev_p = float(prev_snapshot["physical_progress"])
        curr_p = float(progress)
        if curr_p < 100.0 and act_date is None:
            if curr_p < prev_p:
                warnings.append({
                    "id": f"ew-prog-dec-{pid}-{report_month}",
                    "project_id": pid,
                    "project_name": pname,
                    "category": "PROGRESS_DECLINE",
                    "title": "Physical Progress Regression",
                    "description": f"Reported physical progress decreased from {prev_p}% in {prev_snapshot.get('report_month', 'previous month')} to {curr_p}%.",
                    "severity": "CRITICAL",
                    "metric": f"{round(curr_p - prev_p, 1)}%",
                    "report_month": report_month,
                })
            elif curr_p == prev_p:
                warnings.append({
                    "id": f"ew-prog-stag-{pid}-{report_month}",
                    "project_id": pid,
                    "project_name": pname,
                    "category": "PROGRESS_STAGNATION",
                    "title": "Zero Progress in Reporting Period",
                    "description": f"Physical execution remained stagnant at {curr_p}% between consecutive monthly reporting cycles.",
                    "severity": "HIGH",
                    "metric": "0% change",
                    "report_month": report_month,
                })

    # Trigger 4: Expenditure Divergence
    eff_cost = rev_cost or orig_cost
    if eff_cost and eff_cost > 0 and expenditure is not None and progress is not None:
        exp_pct = round((expenditure / eff_cost) * 100.0, 1)
        if exp_pct > (progress + 20.0):
            diff_pct = round(exp_pct - progress, 1)
            severity = "CRITICAL" if diff_pct > 35.0 else "MEDIUM"
            warnings.append({
                "id": f"ew-exp-div-{pid}-{report_month}",
                "project_id": pid,
                "project_name": pname,
                "category": "EXPENDITURE_DIVERGENCE",
                "title": "Financial Outlay Divergence",
                "description": f"Cumulative expenditure reached {exp_pct}% of cost (₹{expenditure:,.2f} Cr) against only {progress}% physical completion (+{diff_pct}% gap).",
                "severity": severity,
                "metric": f"+{diff_pct}% gap",
                "report_month": report_month,
            })

    return warnings
