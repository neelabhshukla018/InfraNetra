"""
InfraNetra Explainable Runtime Schedule-Risk Engine.

Grounded strictly in project dates and reported physical progress.
NOTE: InfraNetra runtime schedule-risk heuristic; not an official PAIMANA methodology.

This module computes a transparent, date-aware live schedule risk layer alongside
existing ML models and deterministic 4-factor risk assessments without altering them.
"""

import calendar
import re
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

# ==============================================================================
# CONFIGURATION: WEIGHTS, THRESHOLDS, AND RISK BANDS
# Single centralized configuration - no magic numbers scattered across code.
# InfraNetra runtime schedule-risk heuristic; not an official PAIMANA methodology.
# ==============================================================================

# Heuristic scoring component weights (sum to 1.00 / 100%)
# InfraNetra runtime schedule-risk heuristic; not an official PAIMANA methodology.
SCHEDULE_RISK_WEIGHTS = {
    "deadline_status": 0.35,      # 35% weight: whether original/revised deadlines have lapsed
    "progress_gap": 0.35,         # 35% weight: Time-Elapsed Baseline % minus Physical Progress %
    "deadline_proximity": 0.15,   # 15% weight: proximity to active deadline
    "schedule_extension": 0.15,   # 15% weight: degree of approved time extension
}

# Risk Band Cutoffs (0 to 100 scale)
SCHEDULE_RISK_BANDS = [
    (0.0, 30.0, "LOW"),
    (30.1, 50.0, "MODERATE"),
    (50.1, 70.0, "HIGH"),
    (70.1, 100.0, "CRITICAL"),
]

# Progress Gap Thresholds (percentage points between Time-Elapsed Baseline and Physical Progress)
PROGRESS_GAP_THRESHOLDS = {
    "critical": 35.0,  # >= 35 pp gap -> 100% gap penalty
    "high": 20.0,      # >= 20 pp gap -> 75% gap penalty
    "moderate": 10.0,  # >= 10 pp gap -> 45% gap penalty
    "mild": 3.0,       # >= 3 pp gap -> 20% gap penalty
}

# Deadline Proximity Thresholds (days remaining to active deadline)
PROXIMITY_THRESHOLDS = {
    "imminent": 30,    # <= 30 days remaining -> high urgency
    "near": 90,        # <= 90 days remaining -> moderate urgency
    "medium": 180,     # <= 180 days remaining -> mild urgency
}

# Schedule Extension Thresholds (days extended)
EXTENSION_THRESHOLDS = {
    "severe": 730,     # >= 2 years (730 days) extension
    "major": 365,      # >= 1 year (365 days) extension
    "moderate": 180,   # >= 6 months (180 days) extension
    "minor": 30,       # >= 1 month (30 days) extension
}


# ==============================================================================
# DATE NORMALIZATION UTILITIES
# ==============================================================================

def normalize_date(raw_date: Any, is_end_date: bool = False) -> Optional[date]:
    """
    Safely normalize date input into a python datetime.date object.

    Handles formats present in database, reports, and frontend:
    - datetime.date or datetime.datetime instances
    - ISO format: YYYY-MM-DD
    - Standard slash/hyphen/dot: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    - Month-year slash/hyphen/dot: MM/YYYY, MM-YYYY, MM.YYYY (e.g., '03/2015')
    - Year-month hyphen/slash/dot: YYYY-MM, YYYY/MM, YYYY.MM
    - ISO datetime strings with time/timezone (e.g., '2024-05-01T00:00:00Z', '2024-05-01 12:00:00+05:30')

    Month-Only Date Convention Documentation:
    When only month and year are provided in the MoSPI Flash dataset (e.g., '03/2015'):
    - For start_date (is_end_date=False): Normalizes deterministically to the 1st calendar day of the
      month (e.g., '03/2015' -> 2015-03-01), marking project approval or inception.
    - For completion deadlines (is_end_date=True): Normalizes deterministically to the last calendar day
      of the month (e.g., '08/2027' -> 2027-08-31) using calendar.monthrange, reflecting the
      contractual completion milestone through the close of the target month.
    """
    if raw_date is None:
        return None

    if isinstance(raw_date, datetime):
        return raw_date.date()
    if isinstance(raw_date, date):
        return raw_date

    s = str(raw_date).strip()
    if not s or s.upper() in ("NA", "N/A", "NONE", "NULL", "-", "N/A (ONGOING)", ""):
        return None

    # Strip any trailing time / timezone component if present
    s = re.sub(r"[T\s].*$", "", s)

    # 1. YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
    m_iso = re.match(r"^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$", s)
    if m_iso:
        y, m, d = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
        try:
            return date(y, m, d)
        except ValueError:
            return None

    # 2. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    m_dmy = re.match(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$", s)
    if m_dmy:
        d, m, y = int(m_dmy.group(1)), int(m_dmy.group(2)), int(m_dmy.group(3))
        try:
            return date(y, m, d)
        except ValueError:
            return None

    # 3. MM/YYYY or MM-YYYY or MM.YYYY (standard in MoSPI Flash Reports)
    m_my = re.match(r"^(\d{1,2})[/.-](\d{4})$", s)
    if m_my:
        m, y = int(m_my.group(1)), int(m_my.group(2))
        try:
            if is_end_date:
                last_day = calendar.monthrange(y, m)[1]
                return date(y, m, last_day)
            else:
                return date(y, m, 1)
        except (ValueError, calendar.IllegalMonthError):
            return None

    # 4. YYYY-MM or YYYY/MM or YYYY.MM
    m_ym = re.match(r"^(\d{4})[/.-](\d{1,2})$", s)
    if m_ym:
        y, m = int(m_ym.group(1)), int(m_ym.group(2))
        try:
            if is_end_date:
                last_day = calendar.monthrange(y, m)[1]
                return date(y, m, last_day)
            else:
                return date(y, m, 1)
        except (ValueError, calendar.IllegalMonthError):
            return None

    return None


def get_risk_level_from_score(score: float) -> str:
    """Map numeric score (0-100) to standard risk band."""
    for low, high, level in SCHEDULE_RISK_BANDS:
        if low <= score <= high:
            return level
    return "CRITICAL" if score > 70.0 else "LOW"


# ==============================================================================
# CORE SCHEDULE RISK ENGINE
# ==============================================================================

def calculate_live_schedule_risk(
    project: Dict[str, Any],
    today: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Compute explainable date-based live schedule risk for an infrastructure project.

    Grounding & Methodology:
    NOTE: InfraNetra runtime schedule-risk heuristic; not an official PAIMANA methodology.

    Args:
        project: Dictionary containing project data fields.
        today: Optional injected execution date (for deterministic testing).
               Defaults to current runtime UTC date if None.

    Returns:
        Structured dictionary adhering to InfraNetra's schedule risk contract.
    """
    # Dynamic execution date - never hardcoded in production
    execution_today: date = today if today is not None else datetime.now(timezone.utc).date()
    today_iso = execution_today.isoformat()

    # Extract & normalize dates using actual database field mapping
    raw_start = project.get("start_date") or project.get("date_of_approval")
    raw_orig_comp = project.get("original_completion_date") or project.get("target_completion_date")
    raw_rev_comp = project.get("revised_completion_date")
    raw_act_comp = project.get("actual_completion_date")
    project_status = str(project.get("status") or "").strip()

    start_dt = normalize_date(raw_start, is_end_date=False)
    orig_dt = normalize_date(raw_orig_comp, is_end_date=True)
    rev_dt = normalize_date(raw_rev_comp, is_end_date=True)
    act_dt = normalize_date(raw_act_comp, is_end_date=True)

    # 1. SPECIAL CASE HANDLING: Missing essential dates
    if not start_dt:
        return {
            "schedule_analysis_available": False,
            "unavailability_reason": "Start Date / Date of Approval is missing or invalid in project records.",
            "is_completed": False,
            "start_date": None,
            "original_completion_date": orig_dt.isoformat() if orig_dt else None,
            "revised_completion_date": rev_dt.isoformat() if rev_dt else None,
            "actual_completion_date": act_dt.isoformat() if act_dt else None,
            "today": today_iso,
            "planned_duration_days": None,
            "elapsed_days": None,
            "time_elapsed_baseline_percentage": None,
            "elapsed_percentage": None,
            "physical_progress_percentage": None,
            "progress_gap": None,
            "progress_gap_label": "Time-vs-Physical Progress Gap",
            "time_elapsed_label": "Time-Elapsed Baseline",
            "active_deadline_type": "NONE",
            "active_deadline": None,
            "days_to_active_deadline": None,
            "days_to_original_deadline": None,
            "days_to_revised_deadline": None,
            "extension_days": None,
            "extension_label": "No schedule extension",
            "original_deadline_status": "NOT_AVAILABLE",
            "revised_deadline_status": "NOT_AVAILABLE",
            "deadline_display_status": "Dates Incomplete",
            "schedule_risk_score": 0.0,
            "schedule_risk_level": "LOW",
            "schedule_risk_reasons": ["Schedule risk analysis unavailable: project start date is missing."],
            "score_breakdown": {
                "deadline_status_score": 0.0,
                "progress_gap_score": 0.0,
                "deadline_proximity_score": 0.0,
                "schedule_extension_score": 0.0,
            },
            "disclaimer": "InfraNetra runtime schedule-risk heuristic; not an official PAIMANA methodology.",
        }

    if not orig_dt:
        return {
            "schedule_analysis_available": False,
            "unavailability_reason": "Original Completion Date / Target DoC is missing or invalid in project records.",
            "is_completed": False,
            "start_date": start_dt.isoformat(),
            "original_completion_date": None,
            "revised_completion_date": rev_dt.isoformat() if rev_dt else None,
            "actual_completion_date": act_dt.isoformat() if act_dt else None,
            "today": today_iso,
            "planned_duration_days": None,
            "elapsed_days": None,
            "time_elapsed_baseline_percentage": None,
            "elapsed_percentage": None,
            "physical_progress_percentage": None,
            "progress_gap": None,
            "progress_gap_label": "Time-vs-Physical Progress Gap",
            "time_elapsed_label": "Time-Elapsed Baseline",
            "active_deadline_type": "NONE",
            "active_deadline": None,
            "days_to_active_deadline": None,
            "days_to_original_deadline": None,
            "days_to_revised_deadline": None,
            "extension_days": None,
            "extension_label": "No schedule extension",
            "original_deadline_status": "NOT_AVAILABLE",
            "revised_deadline_status": "NOT_AVAILABLE",
            "deadline_display_status": "Dates Incomplete",
            "schedule_risk_score": 0.0,
            "schedule_risk_level": "LOW",
            "schedule_risk_reasons": ["Schedule risk analysis unavailable: original completion date is missing."],
            "score_breakdown": {
                "deadline_status_score": 0.0,
                "progress_gap_score": 0.0,
                "deadline_proximity_score": 0.0,
                "schedule_extension_score": 0.0,
            },
            "disclaimer": "InfraNetra runtime schedule-risk heuristic; not an official PAIMANA methodology.",
        }

    # 2. PLANNED DURATION & INVALID ORDERING CHECK
    planned_duration_days = (orig_dt - start_dt).days
    if planned_duration_days <= 0:
        return {
            "schedule_analysis_available": False,
            "unavailability_reason": f"Invalid timeline ordering: original completion date ({orig_dt.isoformat()}) does not succeed start date ({start_dt.isoformat()}).",
            "is_completed": False,
            "start_date": start_dt.isoformat(),
            "original_completion_date": orig_dt.isoformat(),
            "revised_completion_date": rev_dt.isoformat() if rev_dt else None,
            "actual_completion_date": act_dt.isoformat() if act_dt else None,
            "today": today_iso,
            "planned_duration_days": planned_duration_days,
            "elapsed_days": None,
            "time_elapsed_baseline_percentage": None,
            "elapsed_percentage": None,
            "physical_progress_percentage": None,
            "progress_gap": None,
            "progress_gap_label": "Time-vs-Physical Progress Gap",
            "time_elapsed_label": "Time-Elapsed Baseline",
            "active_deadline_type": "NONE",
            "active_deadline": None,
            "days_to_active_deadline": None,
            "days_to_original_deadline": None,
            "days_to_revised_deadline": None,
            "extension_days": None,
            "extension_label": "No schedule extension",
            "original_deadline_status": "INVALID_TIMELINE",
            "revised_deadline_status": "INVALID_TIMELINE",
            "deadline_display_status": "Invalid Date Ordering",
            "schedule_risk_score": 0.0,
            "schedule_risk_level": "LOW",
            "schedule_risk_reasons": ["Schedule risk analysis unavailable: original completion date precedes start date."],
            "score_breakdown": {
                "deadline_status_score": 0.0,
                "progress_gap_score": 0.0,
                "deadline_proximity_score": 0.0,
                "schedule_extension_score": 0.0,
            },
            "disclaimer": "InfraNetra runtime schedule-risk heuristic; not an official PAIMANA methodology.",
        }

    # 3. ELAPSED TIME & TIME-ELAPSED BASELINE
    # Clamped so future start date does not generate negative elapsed days
    raw_elapsed_days = (execution_today - start_dt).days
    is_future_start = raw_elapsed_days < 0
    elapsed_days = max(0, raw_elapsed_days)

    # Time-Elapsed Baseline % (Schedule Time Consumed against original planned baseline duration)
    # Labeled strictly as "Time-Elapsed Baseline" / "Schedule Time Consumed", NOT engineering expected progress.
    raw_elapsed_pct = (elapsed_days / planned_duration_days) * 100.0
    time_elapsed_baseline_percentage = round(min(200.0, max(0.0, raw_elapsed_pct)), 2)

    # 4. PHYSICAL PROGRESS VALIDATION
    raw_phys = project.get("physical_progress")
    if raw_phys is None and isinstance(project.get("financials"), dict):
        raw_phys = project["financials"].get("physical_progress_pct")

    physical_progress: Optional[float] = None
    if raw_phys is not None:
        try:
            if isinstance(raw_phys, str):
                raw_phys = raw_phys.replace("%", "").strip()
            val = float(raw_phys)
            physical_progress = round(min(100.0, max(0.0, val)), 2)
        except (ValueError, TypeError):
            physical_progress = None

    # 5. TIME-VS-PHYSICAL PROGRESS GAP
    # Formula: progress_gap = Time-Elapsed Baseline - Physical Progress
    # Described strictly as "Time-vs-Physical Progress Gap", not automatically actual project delay.
    progress_gap: Optional[float] = None
    if physical_progress is not None:
        progress_gap = round(time_elapsed_baseline_percentage - physical_progress, 2)

    # 6. DEADLINE STATUS & ACTIVE DEADLINE IDENTIFICATION
    # Original deadline
    days_to_orig = (orig_dt - execution_today).days
    if execution_today > orig_dt:
        original_deadline_status = "ORIGINAL_DEADLINE_MISSED"
    else:
        original_deadline_status = "BEFORE_ORIGINAL_DEADLINE"

    # Revised deadline
    revised_deadline_status = "REVISED_DEADLINE_NOT_APPLICABLE"
    days_to_rev: Optional[int] = None
    extension_days: Optional[int] = None
    extension_label: str = "No schedule extension"

    if rev_dt:
        days_to_rev = (rev_dt - execution_today).days
        if execution_today > rev_dt:
            revised_deadline_status = "REVISED_DEADLINE_MISSED"
        else:
            revised_deadline_status = "BEFORE_REVISED_DEADLINE"

        # Extension analysis
        extension_days = (rev_dt - orig_dt).days
        if extension_days > 0:
            extension_label = f"Extended by {extension_days} days"
        elif extension_days == 0:
            extension_label = "No schedule extension"
        else:
            extension_label = f"Schedule brought forward by {abs(extension_days)} days"

    # Active Deadline Logic:
    # Use original deadline until it is missed.
    # Once original deadline is missed and a valid revised deadline exists: use revised deadline as active deadline.
    if original_deadline_status == "BEFORE_ORIGINAL_DEADLINE" or not rev_dt:
        active_deadline_type = "ORIGINAL"
        active_deadline = orig_dt.isoformat()
        days_to_active = days_to_orig
    else:
        active_deadline_type = "REVISED"
        active_deadline = rev_dt.isoformat()
        days_to_active = days_to_rev

    # Deadline Display Status (Exact Human-Readable Label)
    if original_deadline_status == "ORIGINAL_DEADLINE_MISSED":
        if rev_dt:
            if revised_deadline_status == "REVISED_DEADLINE_MISSED":
                deadline_display_status = "Revised Deadline Missed"
            else:
                deadline_display_status = "Original Deadline Missed / Revised Deadline Active"
        else:
            deadline_display_status = "Original Deadline Missed"
    else:
        deadline_display_status = "Operating Before Original Deadline"

    # 7. SPECIAL CASE: COMPLETED / COMMISSIONED PROJECT
    # If project has an actual completion date or status indicates completion,
    # freeze live schedule escalation. Do not continue calculating active delay risk.
    is_completed = bool(act_dt) or project_status.lower() in ("completed", "commissioned")
    if is_completed:
        comp_reasons = [
            f"Project is marked as {project_status or 'Completed'} (Actual Completion: {act_dt.isoformat() if act_dt else 'Recorded'}).",
            "Live schedule risk escalation is frozen for completed projects.",
            f"Final recorded physical progress: {physical_progress if physical_progress is not None else 100.0}%.",
        ]
        if extension_days and extension_days > 0:
            comp_reasons.append(f"Project was completed with a net schedule extension of {extension_days} days.")

        return {
            "schedule_analysis_available": True,
            "unavailability_reason": None,
            "is_completed": True,
            "start_date": start_dt.isoformat(),
            "original_completion_date": orig_dt.isoformat(),
            "revised_completion_date": rev_dt.isoformat() if rev_dt else None,
            "actual_completion_date": act_dt.isoformat() if act_dt else None,
            "today": today_iso,
            "planned_duration_days": planned_duration_days,
            "elapsed_days": elapsed_days,
            "time_elapsed_baseline_percentage": time_elapsed_baseline_percentage,
            "elapsed_percentage": time_elapsed_baseline_percentage,
            "physical_progress_percentage": physical_progress if physical_progress is not None else 100.0,
            "progress_gap": 0.0,
            "progress_gap_label": "Time-vs-Physical Progress Gap",
            "time_elapsed_label": "Time-Elapsed Baseline",
            "active_deadline_type": active_deadline_type,
            "active_deadline": active_deadline,
            "days_to_active_deadline": days_to_active,
            "days_to_original_deadline": days_to_orig,
            "days_to_revised_deadline": days_to_rev,
            "extension_days": extension_days,
            "extension_label": extension_label,
            "original_deadline_status": original_deadline_status,
            "revised_deadline_status": revised_deadline_status,
            "deadline_display_status": "Project Completed",
            "schedule_risk_score": 0.0,
            "schedule_risk_level": "LOW",
            "schedule_risk_reasons": comp_reasons,
            "score_breakdown": {
                "deadline_status_score": 0.0,
                "progress_gap_score": 0.0,
                "deadline_proximity_score": 0.0,
                "schedule_extension_score": 0.0,
            },
            "disclaimer": "InfraNetra runtime schedule-risk heuristic; not an official PAIMANA methodology.",
        }

    # 8. RULE-BASED SCHEDULE RISK SCORING (0 to 100)
    # Grounded in dates and progress.
    # InfraNetra runtime schedule-risk heuristic; not an official PAIMANA methodology.
    reasons: List[str] = []

    # If future start date, add informative notification
    if is_future_start:
        reasons.append(
            f"Project is scheduled to start on {start_dt.strftime('%d-%m-%Y')} "
            f"({abs(raw_elapsed_days)} days remaining until start); schedule time elapsed is 0%."
        )

    # Component 1: Deadline Status (0 - 100 raw -> weighted by 35%)
    raw_status_pts = 0.0
    if original_deadline_status == "BEFORE_ORIGINAL_DEADLINE":
        raw_status_pts = 0.0
        reasons.append(f"Operating before original completion deadline ({orig_dt.strftime('%d-%m-%Y')}).")
    elif original_deadline_status == "ORIGINAL_DEADLINE_MISSED":
        if rev_dt:
            if revised_deadline_status == "BEFORE_REVISED_DEADLINE":
                raw_status_pts = 55.0
                reasons.append(
                    f"Original completion date passed on {orig_dt.strftime('%d-%m-%Y')}; "
                    f"operating under revised deadline ({rev_dt.strftime('%d-%m-%Y')})."
                )
            else:  # REVISED_DEADLINE_MISSED
                raw_status_pts = 100.0
                reasons.append(
                    f"Both original deadline ({orig_dt.strftime('%d-%m-%Y')}) and "
                    f"revised deadline ({rev_dt.strftime('%d-%m-%Y')}) have lapsed."
                )
        else:
            # Original deadline passed, no revised date approved
            raw_status_pts = 90.0
            reasons.append(
                f"Original completion date passed on {orig_dt.strftime('%d-%m-%Y')} "
                "with no revised completion date registered."
            )

    # Component 2: Progress Gap (0 - 100 raw -> weighted by 35%)
    raw_gap_pts = 0.0
    if progress_gap is not None:
        if progress_gap >= PROGRESS_GAP_THRESHOLDS["critical"]:
            raw_gap_pts = 100.0
            reasons.append(
                f"Critical execution gap: {physical_progress}% physical progress reported "
                f"against {time_elapsed_baseline_percentage}% schedule time consumed ({progress_gap:+.1f} pp gap)."
            )
        elif progress_gap >= PROGRESS_GAP_THRESHOLDS["high"]:
            raw_gap_pts = 75.0
            reasons.append(
                f"High execution gap: physical progress ({physical_progress}%) is "
                f"{progress_gap:.1f} pp behind schedule time consumed ({time_elapsed_baseline_percentage}%)."
            )
        elif progress_gap >= PROGRESS_GAP_THRESHOLDS["moderate"]:
            raw_gap_pts = 45.0
            reasons.append(
                f"Moderate execution gap: physical progress ({physical_progress}%) is "
                f"{progress_gap:.1f} pp behind schedule time consumed ({time_elapsed_baseline_percentage}%)."
            )
        elif progress_gap >= PROGRESS_GAP_THRESHOLDS["mild"]:
            raw_gap_pts = 20.0
            reasons.append(
                f"Minor progress deviation: physical progress ({physical_progress}%) is "
                f"{progress_gap:.1f} pp behind schedule time consumed ({time_elapsed_baseline_percentage}%)."
            )
        elif progress_gap <= -5.0:
            raw_gap_pts = 0.0
            reasons.append(
                f"Favorable progress: physical progress ({physical_progress}%) is ahead of "
                f"time-elapsed baseline ({time_elapsed_baseline_percentage}%)."
            )
        else:
            raw_gap_pts = 10.0
            reasons.append(
                f"Physical progress ({physical_progress}%) is reasonably aligned with "
                f"schedule time consumed ({time_elapsed_baseline_percentage}%)."
            )
    else:
        # Physical progress data is not recorded
        raw_gap_pts = 30.0
        reasons.append(
            f"Physical progress data is unrecorded; time-elapsed baseline is at {time_elapsed_baseline_percentage}%."
        )

    # Component 3: Deadline Proximity (0 - 100 raw -> weighted by 15%)
    raw_prox_pts = 0.0
    if days_to_active is not None:
        if days_to_active < 0:
            # Overdue
            raw_prox_pts = 100.0
            reasons.append(f"Active deadline ({active_deadline}) is overdue by {abs(days_to_active)} days.")
        elif days_to_active <= PROXIMITY_THRESHOLDS["imminent"]:
            # Imminent: <= 30 days
            if physical_progress and physical_progress >= 90.0:
                raw_prox_pts = 30.0
                reasons.append(
                    f"Active deadline is imminent ({days_to_active} days remaining), with high physical completion ({physical_progress}%)."
                )
            else:
                raw_prox_pts = 90.0
                reasons.append(
                    f"Active deadline is imminent ({days_to_active} days remaining) with {physical_progress or 0}% physical progress."
                )
        elif days_to_active <= PROXIMITY_THRESHOLDS["near"]:
            # Near: <= 90 days
            if physical_progress and physical_progress >= 85.0:
                raw_prox_pts = 20.0
            else:
                raw_prox_pts = 60.0
            reasons.append(f"Active deadline is approaching ({days_to_active} days remaining).")
        elif days_to_active <= PROXIMITY_THRESHOLDS["medium"]:
            # Medium: <= 180 days
            raw_prox_pts = 30.0
            reasons.append(f"{days_to_active} days remaining to active deadline ({active_deadline}).")
        else:
            raw_prox_pts = 5.0
            reasons.append(f"Comfortable schedule buffer ({days_to_active} days remaining to active deadline).")

    # Component 4: Schedule Extension (0 - 100 raw -> weighted by 15%)
    raw_ext_pts = 0.0
    if extension_days is not None:
        if extension_days >= EXTENSION_THRESHOLDS["severe"]:
            raw_ext_pts = 100.0
            reasons.append(f"Severe schedule extension: target completion postponed by {extension_days} days (>= 2 years).")
        elif extension_days >= EXTENSION_THRESHOLDS["major"]:
            raw_ext_pts = 75.0
            reasons.append(f"Major schedule extension: target completion postponed by {extension_days} days (>= 1 year).")
        elif extension_days >= EXTENSION_THRESHOLDS["moderate"]:
            raw_ext_pts = 45.0
            reasons.append(f"Moderate schedule extension: target completion postponed by {extension_days} days.")
        elif extension_days >= EXTENSION_THRESHOLDS["minor"]:
            raw_ext_pts = 20.0
            reasons.append(f"Minor schedule extension of {extension_days} days approved.")
        elif extension_days <= 0:
            raw_ext_pts = 0.0
            if extension_days < 0:
                reasons.append(f"Contractual schedule brought forward by {abs(extension_days)} days.")
            else:
                reasons.append("Project operating without any schedule extension.")
    else:
        raw_ext_pts = 0.0
        reasons.append("No schedule extension history on record.")

    # Apply centralized weights
    weighted_status = raw_status_pts * SCHEDULE_RISK_WEIGHTS["deadline_status"]
    weighted_gap = raw_gap_pts * SCHEDULE_RISK_WEIGHTS["progress_gap"]
    weighted_prox = raw_prox_pts * SCHEDULE_RISK_WEIGHTS["deadline_proximity"]
    weighted_ext = raw_ext_pts * SCHEDULE_RISK_WEIGHTS["schedule_extension"]

    total_score = round(min(100.0, max(0.0, weighted_status + weighted_gap + weighted_prox + weighted_ext)), 1)
    risk_level = get_risk_level_from_score(total_score)

    return {
        "schedule_analysis_available": True,
        "unavailability_reason": None,
        "is_completed": False,
        "start_date": start_dt.isoformat(),
        "original_completion_date": orig_dt.isoformat(),
        "revised_completion_date": rev_dt.isoformat() if rev_dt else None,
        "actual_completion_date": act_dt.isoformat() if act_dt else None,
        "today": today_iso,
        "planned_duration_days": planned_duration_days,
        "elapsed_days": elapsed_days,
        "time_elapsed_baseline_percentage": time_elapsed_baseline_percentage,
        "elapsed_percentage": time_elapsed_baseline_percentage,  # backward compatibility alias
        "physical_progress_percentage": physical_progress,
        "progress_gap": progress_gap,
        "progress_gap_label": "Time-vs-Physical Progress Gap",
        "time_elapsed_label": "Time-Elapsed Baseline",
        "active_deadline_type": active_deadline_type,
        "active_deadline": active_deadline,
        "days_to_active_deadline": days_to_active,
        "days_to_original_deadline": days_to_orig,
        "days_to_revised_deadline": days_to_rev,
        "extension_days": extension_days,
        "extension_label": extension_label,
        "original_deadline_status": original_deadline_status,
        "revised_deadline_status": revised_deadline_status,
        "deadline_display_status": deadline_display_status,
        "schedule_risk_score": total_score,
        "schedule_risk_level": risk_level,
        "schedule_risk_reasons": reasons,
        "score_breakdown": {
            "deadline_status_score": round(weighted_status, 1),
            "progress_gap_score": round(weighted_gap, 1),
            "deadline_proximity_score": round(weighted_prox, 1),
            "schedule_extension_score": round(weighted_ext, 1),
        },
        "disclaimer": "InfraNetra runtime schedule-risk heuristic; not an official PAIMANA methodology.",
    }
