import os
import re
import sqlite3
import datetime
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import httpx
from dotenv import load_dotenv
from extractor import clean_date_str
from auth_db import (
    get_all_ministries,
    register_ministry_user,
    get_ministry_requests,
    approve_ministry_request,
    reject_ministry_request,
    suspend_ministry_user,
    register_project_manager_user,
    get_pm_requests,
    approve_pm_request,
    reject_pm_request,
    suspend_pm_user,
    submit_daily_project_update,
    get_daily_project_updates,
    get_audit_logs_list,
    get_project_ministry_and_name,
    lookup_project_details,
    get_authoritative_project,
)

# Load environment variables from backend/.env or root .env
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

SUPABASE_URL = (
    os.environ.get("SUPABASE_URL")
    or os.environ.get("VITE_SUPABASE_URL")
    or ""
).strip().rstrip("/")

SUPABASE_SERVICE_ROLE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_KEY")
    or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    or os.environ.get("VITE_SUPABASE_ANON_KEY")
    or ""
).strip()
_db_env = os.environ.get("SQLITE_DB_PATH", "infrastructure_projects.sqlite3").strip()
SQLITE_DB_PATH = Path(_db_env) if Path(_db_env).is_absolute() else (BASE_DIR / _db_env)


def is_supabase_configured() -> bool:
    """Check if Supabase credentials are validly specified."""
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL.startswith("http"))


def normalize_report_month_date(month_str: str) -> str:
    """Standardize report month strings like 'April 2026', '2026-04', or '2026-04-01' to '2026-04-01'."""
    s = str(month_str or "").strip()
    if not s:
        return "2026-04-01"

    # Matches YYYY-MM-DD
    m_full = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", s)
    if m_full:
        y, m, d = m_full.groups()
        return f"{y}-{int(m):02d}-{int(d):02d}"

    # Matches YYYY-MM
    m_ym = re.match(r"^(\d{4})-(\d{1,2})$", s)
    if m_ym:
        y, m = m_ym.groups()
        return f"{y}-{int(m):02d}-01"

    # Month mappings for full and short names
    months = {
        "january": "01", "jan": "01",
        "february": "02", "feb": "02",
        "march": "03", "mar": "03",
        "april": "04", "apr": "04",
        "may": "05",
        "june": "06", "jun": "06",
        "july": "07", "jul": "07",
        "august": "08", "aug": "08",
        "september": "09", "sep": "09", "sept": "09",
        "october": "10", "oct": "10",
        "november": "11", "nov": "11",
        "december": "12", "dec": "12"
    }

    year_match = re.search(r"\b(20\d{2})\b", s)
    year = year_match.group(1) if year_match else "2026"

    lower_s = s.lower()
    for m_name, m_num in months.items():
        if re.search(r"\b" + re.escape(m_name) + r"\b", lower_s) or m_name == lower_s:
            return f"{year}-{m_num}-01"

    for m_name in ("january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"):
        if m_name in lower_s:
            return f"{year}-{months[m_name]}-01"

    return "2026-04-01"


def format_canonical_record_for_db(record: Dict[str, Any], default_month: str = "2026-04") -> Dict[str, Any]:
    """Transform canonical project dictionary into database schema fields."""
    target_month = default_month or record.get("report_month", "2026-04")
    month_date = normalize_report_month_date(target_month)
    
    # Format source pages as string
    pages = record.get("source_pages", [])
    if isinstance(pages, list) and pages:
        pages_str = ", ".join(str(p) for p in sorted(pages))
    elif record.get("source_page"):
        pages_str = str(record.get("source_page"))
    else:
        pages_str = ""

    return {
        "project_id": re.sub(r"\s+", "", str(record.get("project_id", ""))).strip(),
        "project_name": str(record.get("project_name") or "").strip(),
        "agency": str(record.get("agency") or "").strip(),
        "ministry": str(record.get("ministry") or "").strip(),
        "sector": str(record.get("sector") or "").strip(),
        "state": str(record.get("state") or "").strip(),
        "start_date": clean_date_str(record.get("start_date")),
        "original_completion_date": clean_date_str(record.get("original_completion_date")),
        "revised_completion_date": clean_date_str(record.get("revised_completion_date")),
        "actual_completion_date": clean_date_str(record.get("actual_completion_date")),
        "original_cost": float(record["original_cost"]) if record.get("original_cost") is not None else None,
        "revised_cost": float(record["revised_cost"]) if record.get("revised_cost") is not None else None,
        "expenditure": float(record["expenditure"]) if record.get("expenditure") is not None else None,
        "physical_progress": float(record["physical_progress"]) if record.get("physical_progress") is not None else None,
        "report_month": month_date,
        "source_section": str(record.get("source_section") or "").strip(),
        "source_pages": pages_str,
    }


def init_sqlite_db() -> sqlite3.Connection:
    """Initialize local SQLite persistence with identical schema and constraint."""
    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS infrastructure_projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                project_name TEXT,
                agency TEXT,
                ministry TEXT,
                sector TEXT,
                state TEXT,
                start_date TEXT,
                original_completion_date TEXT,
                revised_completion_date TEXT,
                actual_completion_date TEXT,
                original_cost REAL,
                revised_cost REAL,
                expenditure REAL,
                physical_progress REAL,
                report_month TEXT NOT NULL,
                source_section TEXT,
                source_pages TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_project_report_month UNIQUE (project_id, report_month)
            );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_infra_report_month ON infrastructure_projects(report_month);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_infra_project_id ON infrastructure_projects(project_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_infra_sector ON infrastructure_projects(sector);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_infra_ministry ON infrastructure_projects(ministry);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_infra_state ON infrastructure_projects(state);")
    return conn


def upsert_to_sqlite(records: List[Dict[str, Any]]) -> int:
    """Upsert records into local SQLite database using ON CONFLICT clause."""
    conn = init_sqlite_db()
    cursor = conn.cursor()
    count = 0
    with conn:
        for r in records:
            cursor.execute("""
                INSERT INTO infrastructure_projects (
                    project_id, project_name, agency, ministry, sector, state,
                    start_date, original_completion_date, revised_completion_date,
                    actual_completion_date, original_cost, revised_cost, expenditure,
                    physical_progress, report_month, source_section, source_pages
                ) VALUES (
                    :project_id, :project_name, :agency, :ministry, :sector, :state,
                    :start_date, :original_completion_date, :revised_completion_date,
                    :actual_completion_date, :original_cost, :revised_cost, :expenditure,
                    :physical_progress, :report_month, :source_section, :source_pages
                )
                ON CONFLICT(project_id, report_month) DO UPDATE SET
                    project_name = excluded.project_name,
                    agency = excluded.agency,
                    ministry = excluded.ministry,
                    sector = excluded.sector,
                    state = excluded.state,
                    start_date = excluded.start_date,
                    original_completion_date = excluded.original_completion_date,
                    revised_completion_date = excluded.revised_completion_date,
                    actual_completion_date = excluded.actual_completion_date,
                    original_cost = excluded.original_cost,
                    revised_cost = excluded.revised_cost,
                    expenditure = excluded.expenditure,
                    physical_progress = excluded.physical_progress,
                    source_section = excluded.source_section,
                    source_pages = excluded.source_pages;
            """, r)
            count += 1
    conn.close()
    return count


async def upsert_to_supabase(records: List[Dict[str, Any]]) -> Tuple[int, int]:
    """Upsert records into remote Supabase table in batches via PostgREST."""
    if not is_supabase_configured():
        raise ValueError("Supabase is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.")

    endpoint = f"{SUPABASE_URL}/rest/v1/infrastructure_projects?on_conflict=project_id,report_month"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    inserted_or_updated = 0
    failed_records = 0
    batch_size = 500

    async with httpx.AsyncClient(timeout=60.0) as client:
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            try:
                resp = await client.post(endpoint, json=batch, headers=headers)
                if resp.status_code in (200, 201, 204):
                    inserted_or_updated += len(batch)
                else:
                    print(f"Supabase upsert batch error ({resp.status_code}): {resp.text}")
                    failed_records += len(batch)
            except Exception as e:
                print(f"Supabase request failed: {str(e)}")
                failed_records += len(batch)

    return inserted_or_updated, failed_records


def purge_stale_sqlite_records(month_date: str, valid_pids: set) -> int:
    """Ensure local SQLite snapshot for this month strictly contains only the valid canonical records."""
    conn = init_sqlite_db()
    cur = conn.cursor()
    cur.execute("SELECT project_id FROM infrastructure_projects WHERE report_month = ?", (month_date,))
    existing_pids = [r[0] for r in cur.fetchall()]
    stale_pids = [pid for pid in existing_pids if pid not in valid_pids]
    if stale_pids:
        cur.executemany(
            "DELETE FROM infrastructure_projects WHERE report_month = ? AND project_id = ?",
            [(month_date, pid) for pid in stale_pids]
        )
        conn.commit()
    conn.close()
    return len(stale_pids)


async def purge_stale_supabase_records(month_date: str, valid_pids: set) -> int:
    """Ensure remote Supabase snapshot for this month strictly contains only the valid canonical records."""
    if not is_supabase_configured():
        return 0

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    all_db_pids = []
    offset = 0
    page_size = 1000

    async with httpx.AsyncClient(timeout=60.0) as client:
        while True:
            h = {**headers, "Range": f"{offset}-{offset + page_size - 1}"}
            r = await client.get(
                f"{SUPABASE_URL}/rest/v1/infrastructure_projects?report_month=eq.{month_date}&select=project_id",
                headers=h,
            )
            if r.status_code not in (200, 206):
                break
            batch = r.json()
            all_db_pids.extend(item["project_id"] for item in batch)
            if len(batch) < page_size:
                break
            offset += page_size

        stale_pids = [pid for pid in all_db_pids if pid not in valid_pids]
        if stale_pids:
            batch_size = 50
            for i in range(0, len(stale_pids), batch_size):
                chunk = stale_pids[i : i + batch_size]
                in_list = f"({','.join(chunk)})"
                del_url = f"{SUPABASE_URL}/rest/v1/infrastructure_projects?report_month=eq.{month_date}&project_id=in.{in_list}"
                await client.delete(del_url, headers=headers)

    return len(stale_pids)


async def save_canonical_records(
    records: List[Dict[str, Any]], report_month: str = "2026-04"
) -> Dict[str, Any]:
    """Save the canonical records dataset to Supabase (with SQLite fallback)."""
    db_records = [format_canonical_record_for_db(r, default_month=report_month) for r in records]
    valid_pids = set(r["project_id"] for r in db_records)
    month_date = normalize_report_month_date(report_month)
    
    # Always maintain local SQLite persistence for instant recovery & query speed
    sqlite_count = upsert_to_sqlite(db_records)
    sqlite_purged = purge_stale_sqlite_records(month_date, valid_pids)
    if sqlite_purged > 0:
        print(f"Purged {sqlite_purged} stale records from SQLite for {month_date}")

    supabase_active = is_supabase_configured()
    inserted_count = sqlite_count
    failed_count = 0
    storage_backend = "sqlite (local verified)"

    if supabase_active:
        try:
            supa_inserted, supa_failed = await upsert_to_supabase(db_records)
            if supa_inserted > 0:
                inserted_count = supa_inserted
                failed_count = supa_failed
                storage_backend = "supabase"
                supa_purged = await purge_stale_supabase_records(month_date, valid_pids)
                if supa_purged > 0:
                    print(f"Purged {supa_purged} stale records from Supabase for {month_date}")
            else:
                print("Notice: Remote Supabase table 'infrastructure_projects' does not exist yet. Please run backend/supabase_schema.sql in Supabase SQL Editor.")
                inserted_count = sqlite_count
                failed_count = 0
                storage_backend = "sqlite (local verified; run supabase_schema.sql in Supabase)"
        except Exception as err:
            print(f"Supabase save failed, fell back to SQLite: {err}")
            inserted_count = sqlite_count
            failed_count = 0
            storage_backend = "sqlite (fallback)"

    norm_month = month_date[:7]
    return {
        "success": True,
        "report_month": norm_month,
        "records_received": len(records),
        "records_inserted_or_updated": inserted_count,
        "failed_records": failed_count,
        "storage_backend": storage_backend,
        "supabase_connected": supabase_active,
    }


async def get_report_month_summary(report_month: str = "2026-04") -> Dict[str, Any]:
    """Retrieve database count and summary metrics for the given report month."""
    month_date = normalize_report_month_date(report_month)
    norm_month = month_date[:7]
    supabase_active = is_supabase_configured()

    if supabase_active:
        try:
            endpoint = f"{SUPABASE_URL}/rest/v1/infrastructure_projects?report_month=eq.{month_date}"
            headers = {
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Range-Unit": "items",
                "Prefer": "count=exact",
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.head(endpoint, headers=headers)
                if resp.status_code in (200, 206):
                    crange = resp.headers.get("Content-Range", "")
                    # Example format: '0-2104/2105' or '*/2105'
                    if "/" in crange:
                        total_count = int(crange.split("/")[-1])
                        return {
                            "report_month": norm_month,
                            "total_projects": total_count,
                            "supabase_connected": True,
                            "storage_backend": "supabase",
                            "verified_at": datetime.datetime.now().isoformat(),
                        }
        except Exception as e:
            print(f"Error querying Supabase summary: {e}")

    # Query local SQLite
    conn = init_sqlite_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            COUNT(*) as total_projects,
            SUM(original_cost) as total_orig_cost,
            SUM(revised_cost) as total_rev_cost,
            SUM(expenditure) as total_expenditure
        FROM infrastructure_projects
        WHERE report_month = ?
    """, (month_date,))
    row = cursor.fetchone()
    conn.close()

    total_count = row["total_projects"] if row else 0
    return {
        "report_month": norm_month,
        "total_projects": total_count,
        "total_original_cost": round(row["total_orig_cost"] or 0, 2) if row else 0,
        "total_revised_cost": round(row["total_rev_cost"] or 0, 2) if row else 0,
        "total_expenditure": round(row["total_expenditure"] or 0, 2) if row else 0,
        "supabase_connected": supabase_active,
        "storage_backend": "supabase" if supabase_active else "sqlite (local verified)",
        "verified_at": datetime.datetime.now().isoformat(),
    }


async def check_supabase_health() -> Dict[str, Any]:
    """Verify Supabase connection health, secret key validity, and table schema."""
    if not SUPABASE_URL:
        return {
            "status": "missing_url",
            "supabase_connected": False,
            "supabase_url": None,
            "message": "SUPABASE_URL is not configured in backend/.env",
        }

    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not service_key:
        return {
            "status": "waiting_for_service_role_key",
            "supabase_connected": False,
            "supabase_url": SUPABASE_URL,
            "message": "SUPABASE_SERVICE_ROLE_KEY is waiting for your actual Supabase Service Role/Secret key. Please paste it into backend/.env.",
        }

    if service_key.startswith("sb_publishable_"):
        return {
            "status": "publishable_key_provided",
            "supabase_connected": False,
            "supabase_url": SUPABASE_URL,
            "message": "A publishable key was detected in SUPABASE_SERVICE_ROLE_KEY. Please replace it with the secret service_role key (from Supabase Dashboard -> Project Settings -> API -> service_role).",
        }

    key_to_use = service_key
    is_publishable = key_to_use.startswith("sb_publishable_")

    headers = {
        "apikey": key_to_use,
        "Authorization": f"Bearer {key_to_use}",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Check root PostgREST API
            resp = await client.get(f"{SUPABASE_URL}/rest/v1/", headers=headers)
            connected = resp.status_code in (200, 404)
            
            # Check table existence
            table_resp = await client.get(f"{SUPABASE_URL}/rest/v1/infrastructure_projects?limit=1", headers=headers)
            table_exists = table_resp.status_code in (200, 206)
            
            if resp.status_code in (401, 403):
                return {
                    "status": "authentication_error",
                    "supabase_connected": False,
                    "supabase_url": SUPABASE_URL,
                    "is_publishable_key": is_publishable,
                    "message": "Authentication failed with provided key. Please use the actual service_role secret key from Supabase Dashboard.",
                }

            return {
                "status": "healthy" if connected else "unhealthy",
                "supabase_connected": connected,
                "supabase_url": SUPABASE_URL,
                "table_exists": table_exists,
                "is_service_role": not is_publishable,
                "message": "Connected to Supabase successfully" if connected else f"Supabase responded with HTTP {resp.status_code}",
                "table_hint": "Table 'infrastructure_projects' verified" if table_exists else "Table 'infrastructure_projects' does not exist yet. Run backend/supabase_schema.sql in Supabase SQL editor.",
            }
    except Exception as e:
        return {
            "status": "connection_error",
            "supabase_connected": False,
            "supabase_url": SUPABASE_URL,
            "message": f"Could not connect to Supabase: {str(e)}",
        }


def format_month_label(month_str: str) -> str:
    """Format 'YYYY-MM-DD' or 'YYYY-MM' into 'Month YYYY' (e.g. 'March 2026') dynamically."""
    if not month_str:
        return ""
    try:
        parts = str(month_str).strip().split("-")
        if len(parts) >= 2:
            year = int(parts[0])
            month_num = int(parts[1])
            dt = datetime.date(year, month_num, 1)
            return dt.strftime("%B %Y")
    except Exception:
        pass
    return str(month_str)


async def get_available_months_list() -> List[Dict[str, Any]]:
    """Dynamically return all available report months from the database with counts and formatted labels.
    Never hard-codes months.
    """
    conn = init_sqlite_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT report_month, COUNT(*) AS project_count
        FROM infrastructure_projects
        WHERE report_month IS NOT NULL AND TRIM(report_month) != ''
        GROUP BY report_month
        ORDER BY report_month DESC;
    """)
    rows = cur.fetchall()
    conn.close()

    results = []
    for r in rows:
        rm = r["report_month"]
        cnt = r["project_count"]
        results.append({
            "report_month": rm,
            "label": format_month_label(rm),
            "project_count": cnt,
            "record_count": cnt,
            "available": cnt > 0,
        })
    return results


async def get_all_months_availability() -> List[Dict[str, Any]]:
    """Dynamically determine dataset availability and project counts for all detected months.
    Never hard-codes availability.
    """
    return await get_available_months_list()


def compute_delay_months(actual_date_str: Optional[str], orig_date_str: Optional[str]) -> Optional[int]:
    """Calculate delay_months = actual_completion_date - original_completion_date measured in months.
    Returns integer months, or None if either date is invalid/missing.
    """
    if not actual_date_str or not orig_date_str:
        return None
    d_act = clean_date_str(actual_date_str)
    d_orig = clean_date_str(orig_date_str)
    if not d_act or not d_orig:
        return None
    m_act, y_act = map(int, d_act.split("/"))
    m_orig, y_orig = map(int, d_orig.split("/"))
    return (y_act - y_orig) * 12 + (m_act - m_orig)


async def update_completed_projects_actual_dates() -> Dict[str, Any]:
    """Extract Table 3 completed projects from source Flash Reports (April, May, July 2026),
    and safely update infrastructure_projects (both SQLite and Supabase)
    so actual_completion_date, original_completion_date, revised_completion_date,
    and source_section are populated for records where the source PDF contains it.
    Preserves all existing monthly records and composite key (project_id, report_month).
    """
    from extractor import parse_completed_project_dates
    import pymupdf

    source_configs = [
        ("2026-04-01", BASE_DIR / "uploads" / "FlashReport_April2026.pdf"),
        ("2026-05-01", BASE_DIR / "uploads" / "FlashReport_May2026.pdf"),
        ("2026-07-01", BASE_DIR / "uploads" / "FlashReport_July_2026_d2486e8f.pdf"),
    ]

    updated_records = []

    for month_date, pdf_path in source_configs:
        if not pdf_path.exists():
            continue
        doc = pymupdf.open(str(pdf_path))
        month_tag = month_date[:7].replace("-", "")

        for p in range(len(doc)):
            text = doc[p].get_text("text")
            lower_text = text.lower()
            if "completed projects during month" in lower_text or "table 3: completed" in lower_text or "table 3 : completed" in lower_text:
                for t in doc[p].find_tables().tables:
                    rows = t.extract()
                    for r in rows[1:]:
                        if len(r) > 4 and r[0] and str(r[0]).strip().isdigit():
                            sl_no = str(r[0]).strip()
                            doc_cell = r[4]
                            orig_doc, rev_doc, actual_doc = parse_completed_project_dates(doc_cell)

                            default_pid = f"PAIMANA-{month_tag}-{int(sl_no):04d}"
                            updated_records.append({
                                "project_id": default_pid,
                                "report_month": month_date,
                                "original_completion_date": orig_doc,
                                "revised_completion_date": rev_doc,
                                "actual_completion_date": actual_doc,
                                "source_section": "Table 3 Completed Projects",
                            })
        doc.close()

    # 1. Update local SQLite
    conn = init_sqlite_db()
    cur = conn.cursor()
    sqlite_updated = 0
    with conn:
        for r in updated_records:
            cur.execute("""
                UPDATE infrastructure_projects
                SET original_completion_date = :original_completion_date,
                    revised_completion_date = :revised_completion_date,
                    actual_completion_date = :actual_completion_date,
                    source_section = :source_section
                WHERE project_id = :project_id AND report_month = :report_month;
            """, r)
            if cur.rowcount > 0:
                sqlite_updated += cur.rowcount
    conn.close()

    # 2. Update Supabase if configured
    supabase_updated = 0
    if is_supabase_configured():
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }
        endpoint = f"{SUPABASE_URL}/rest/v1/infrastructure_projects?on_conflict=project_id,report_month"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(endpoint, json=updated_records, headers=headers)
            if resp.status_code in (200, 201, 204):
                supabase_updated = len(updated_records)
            else:
                print(f"Supabase completed projects update error ({resp.status_code}): {resp.text}")

    return {
        "success": True,
        "completed_projects_processed": len(updated_records),
        "sqlite_rows_updated": sqlite_updated,
        "supabase_rows_updated": supabase_updated,
    }


async def rebuild_ml_training_dataset() -> Dict[str, Any]:
    """Rebuild ml_training_dataset from infrastructure_projects.
    Formulas:
    - cost_overrun_pct = ((revised_cost - original_cost) / original_cost) * 100
    - cost_overrun = 1 when revised_cost > original_cost otherwise 0
    - delay_months = actual_completion_date - original_completion_date measured in months
    - time_overrun = 1 when delay_months > 0 otherwise 0
    """
    conn = init_sqlite_db()
    cur = conn.cursor()

    # Ensure local SQLite ml_training_dataset table exists
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ml_training_dataset (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            project_name TEXT,
            ministry TEXT,
            sector TEXT,
            state TEXT,
            original_cost REAL,
            revised_cost REAL,
            expenditure REAL,
            original_completion_date TEXT,
            revised_completion_date TEXT,
            actual_completion_date TEXT,
            cost_overrun_pct REAL,
            cost_overrun INTEGER,
            delay_months INTEGER,
            time_overrun INTEGER
        );
    """)

    # Fetch all infrastructure_projects
    cur.execute("""
        SELECT
            project_id, project_name, ministry, sector, state,
            original_cost, revised_cost, expenditure,
            original_completion_date, revised_completion_date, actual_completion_date
        FROM infrastructure_projects;
    """)
    rows = cur.fetchall()

    training_records = []
    for r in rows:
        orig_cost = r[5]
        rev_cost = r[6]
        orig_date = clean_date_str(r[8])
        rev_date = clean_date_str(r[9])
        act_date = clean_date_str(r[10])

        # cost_overrun_pct
        if orig_cost is not None and orig_cost > 0 and rev_cost is not None:
            cost_overrun_pct = round(((rev_cost - orig_cost) / orig_cost) * 100.0, 2)
        else:
            cost_overrun_pct = 0.0

        # cost_overrun
        if rev_cost is not None and orig_cost is not None and rev_cost > orig_cost:
            cost_overrun = 1
        else:
            cost_overrun = 0

        # delay_months
        delay_months = compute_delay_months(act_date, orig_date)

        # time_overrun
        if delay_months is not None and delay_months > 0:
            time_overrun = 1
        else:
            time_overrun = 0

        rec = {
            "project_id": r[0],
            "project_name": r[1],
            "ministry": r[2],
            "sector": r[3],
            "state": r[4],
            "original_cost": orig_cost,
            "revised_cost": rev_cost,
            "expenditure": r[7],
            "original_completion_date": orig_date or "",
            "revised_completion_date": rev_date or "",
            "actual_completion_date": act_date or "",
            "cost_overrun_pct": cost_overrun_pct,
            "cost_overrun": cost_overrun,
            "delay_months": delay_months,
            "time_overrun": time_overrun,
        }
        training_records.append(rec)

    # 1. Update SQLite ml_training_dataset
    with conn:
        cur.execute("DELETE FROM ml_training_dataset;")
        cur.executemany("""
            INSERT INTO ml_training_dataset (
                project_id, project_name, ministry, sector, state,
                original_cost, revised_cost, expenditure,
                original_completion_date, revised_completion_date, actual_completion_date,
                cost_overrun_pct, cost_overrun, delay_months, time_overrun
            ) VALUES (
                :project_id, :project_name, :ministry, :sector, :state,
                :original_cost, :revised_cost, :expenditure,
                :original_completion_date, :revised_completion_date, :actual_completion_date,
                :cost_overrun_pct, :cost_overrun, :delay_months, :time_overrun
            );
        """, training_records)
    conn.close()

    # 2. Update Supabase ml_training_dataset
    supabase_inserted = 0
    if is_supabase_configured():
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            del_resp = await client.delete(
                f"{SUPABASE_URL}/rest/v1/ml_training_dataset?project_id=not.is.null",
                headers=headers
            )
            print(f"Cleared Supabase ml_training_dataset: {del_resp.status_code}")

            batch_size = 500
            for i in range(0, len(training_records), batch_size):
                batch = training_records[i:i + batch_size]
                ins_resp = await client.post(
                    f"{SUPABASE_URL}/rest/v1/ml_training_dataset",
                    json=batch,
                    headers=headers
                )
                if ins_resp.status_code in (200, 201, 204):
                    supabase_inserted += len(batch)
                else:
                    print(f"Supabase ml_training_dataset insert error ({ins_resp.status_code}): {ins_resp.text}")

    stats = await get_ml_training_statistics()
    return {
        "success": True,
        "total_records_built": len(training_records),
        "supabase_records_inserted": supabase_inserted,
        "stats": stats,
    }


async def get_ml_training_statistics() -> Dict[str, Any]:
    """Compute ML training metrics across infrastructure_projects and ml_training_dataset."""
    conn = init_sqlite_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            COUNT(*) AS total_rows,
            COUNT(NULLIF(TRIM(actual_completion_date), '')) AS actual_date_rows,
            COUNT(NULLIF(TRIM(original_completion_date), '')) AS original_date_rows,
            COUNT(NULLIF(TRIM(revised_completion_date), '')) AS revised_date_rows
        FROM infrastructure_projects;
    """)
    ip_stats = cur.fetchone()

    cur.execute("""
        SELECT
            COUNT(*) AS total_training_records,
            COUNT(delay_months) AS valid_time_training_records,
            COUNT(CASE WHEN time_overrun = 1 THEN 1 END) AS time_overrun_projects,
            COUNT(CASE WHEN original_cost IS NOT NULL AND revised_cost IS NOT NULL THEN 1 END) AS valid_cost_training_records,
            COUNT(CASE WHEN cost_overrun = 1 THEN 1 END) AS cost_overrun_projects
        FROM ml_training_dataset;
    """)
    ml_stats = cur.fetchone()
    conn.close()

    return {
        "total_infrastructure_rows": ip_stats[0] if ip_stats else 0,
        "rows_with_valid_actual_date": ip_stats[1] if ip_stats else 0,
        "rows_with_valid_original_date": ip_stats[2] if ip_stats else 0,
        "rows_with_valid_revised_date": ip_stats[3] if ip_stats else 0,
        "valid_time_training_records": ml_stats[1] if ml_stats else 0,
        "time_overrun_projects": ml_stats[2] if ml_stats else 0,
        "valid_cost_training_records": ml_stats[3] if ml_stats else 0,
        "cost_overrun_projects": ml_stats[4] if ml_stats else 0,
    }


# =====================================================================
# DYNAMIC DATABASE ACCESS FOR FRONTEND VIEWS (NO HARDCODED DATA)
# =====================================================================

from risk_engine import compute_project_risk, generate_early_warnings, parse_iso_date, calculate_month_difference
from ml_models import predict_project
from schedule_risk import calculate_live_schedule_risk

def get_latest_report_month() -> str:
    """Dynamically determine the latest available report_month using MAX(report_month)."""
    try:
        conn = init_sqlite_db()
        cur = conn.cursor()
        cur.execute("SELECT MAX(report_month) FROM infrastructure_projects WHERE report_month IS NOT NULL AND TRIM(report_month) != '';")
        row = cur.fetchone()
        conn.close()
        if row and row[0]:
            return row[0]
    except Exception as e:
        print(f"Error getting latest report month: {e}")
    return "2026-07-01"


def get_previous_report_month(target_month: str) -> Optional[str]:
    """Dynamically find the preceding chronological snapshot month from the database."""
    try:
        conn = init_sqlite_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT MAX(report_month) FROM infrastructure_projects WHERE report_month < ? AND report_month IS NOT NULL AND TRIM(report_month) != '';",
            (target_month,)
        )
        row = cur.fetchone()
        conn.close()
        if row and row[0]:
            return row[0]
    except Exception as e:
        print(f"Error getting previous report month for {target_month}: {e}")
    return None

STATE_COORDINATES = {
    "andaman & nicobar": (11.7401, 92.6586),
    "andhra pradesh": (15.9129, 79.7400),
    "arunachal pradesh": (28.2180, 94.7278),
    "assam": (26.2006, 92.9376),
    "bihar": (25.0961, 85.3131),
    "chandigarh": (30.7333, 76.7794),
    "chhattisgarh": (21.2787, 81.8661),
    "dadra & nagar haveli and daman & diu": (20.4283, 72.8397),
    "delhi": (28.7041, 77.1025),
    "goa": (15.2993, 74.1240),
    "gujarat": (22.2587, 71.1924),
    "haryana": (29.0588, 76.0856),
    "himachal pradesh": (31.1048, 77.1734),
    "jammu and kashmir": (33.7782, 76.5762),
    "jharkhand": (23.6102, 85.2799),
    "karnataka": (15.3173, 75.7139),
    "kerala": (10.8505, 76.2711),
    "ladakh": (34.1526, 77.5771),
    "madhya pradesh": (22.9734, 78.6569),
    "maharashtra": (19.7515, 75.7139),
    "manipur": (24.6637, 93.9063),
    "meghalaya": (25.4670, 91.3662),
    "mizoram": (23.1645, 92.9376),
    "nagaland": (26.1584, 94.5624),
    "odisha": (20.9517, 85.0985),
    "puducherry": (11.9416, 79.8083),
    "punjab": (31.1471, 75.3412),
    "rajasthan": (27.0238, 74.2179),
    "sikkim": (27.5330, 88.5122),
    "tamil nadu": (11.1271, 78.6569),
    "telangana": (18.1124, 79.0193),
    "tripura": (23.9408, 91.9882),
    "uttar pradesh": (26.8467, 80.9462),
    "uttarakhand": (30.0668, 79.0193),
    "west bengal": (22.9868, 87.8550),
    "central": (21.7679, 78.8718),
    "multi-state": (22.5, 80.0),
}


def resolve_state_coordinates(state_name: Optional[str]) -> Tuple[float, float, str]:
    """Resolve latitude, longitude and accuracy label for a project state."""
    if not state_name:
        return (21.7679, 78.8718, "State-level location")
    st = state_name.lower().strip()
    if "multi-state" in st or "multi-states" in st:
        m = re.search(r"\(([^,)]+)", st)
        if m:
            sub = m.group(1).strip().lower()
            if sub in STATE_COORDINATES:
                lat, lng = STATE_COORDINATES[sub]
                return (lat, lng, "State-level location")
        return (22.5, 80.0, "State-level location")
    for k, v in STATE_COORDINATES.items():
        if k in st or st in k:
            return (v[0], v[1], "State-level location")
    return (21.7679, 78.8718, "State-level location")


def get_resolved_report_month(report_month: Optional[str] = None) -> str:
    """Normalize and resolve requested report month dynamically against the database.
    If not specified or not in database, defaults to MAX(report_month).
    """
    if not report_month:
        return get_latest_report_month()

    norm = normalize_report_month_date(report_month)
    try:
        conn = init_sqlite_db()
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM infrastructure_projects WHERE report_month = ? LIMIT 1;", (norm,))
        row = cur.fetchone()
        conn.close()
        if row:
            return norm
    except Exception as e:
        print(f"Error resolving report month {norm}: {e}")

    return get_latest_report_month()


async def get_dashboard_summary(
    report_month: Optional[str] = None,
    ministry_scope: Optional[str] = None,
    project_id_scope: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Calculate dynamic dashboard metrics strictly from database records for the chosen snapshot month.
    Replaces all hardcoded figures (1847, 28.45 L Cr, 342, 84, etc.) with real computed values.
    Supports role-based scoping (ministry_scope, project_id_scope).
    """
    target_month = get_resolved_report_month(report_month)
    prev_month = get_previous_report_month(target_month)

    conn = init_sqlite_db()
    cur = conn.cursor()

    where_conds = ["report_month = ?"]
    query_params: List[Any] = [target_month]
    if project_id_scope:
        where_conds.append("project_id = ?")
        query_params.append(project_id_scope)
    elif ministry_scope:
        where_conds.append("LOWER(ministry) = LOWER(?)")
        query_params.append(ministry_scope)

    where_clause = " AND ".join(where_conds)

    # Aggregate core statistics
    cur.execute(f"""
        SELECT
            COUNT(*) AS total_projects,
            COALESCE(SUM(original_cost), 0.0) AS total_original_cost,
            COALESCE(SUM(COALESCE(revised_cost, original_cost)), 0.0) AS total_revised_cost,
            COALESCE(SUM(CASE WHEN revised_cost > original_cost THEN (revised_cost - original_cost) ELSE 0.0 END), 0.0) AS total_cost_overrun,
            COUNT(CASE WHEN revised_cost > original_cost THEN 1 END) AS projects_with_cost_overrun,
            COALESCE(SUM(expenditure), 0.0) AS total_expenditure,
            COUNT(CASE WHEN revised_completion_date > original_completion_date THEN 1 END) AS projects_with_time_overrun,
            COUNT(CASE WHEN actual_completion_date IS NOT NULL AND TRIM(actual_completion_date) != '' THEN 1 END) AS projects_completed,
            COUNT(CASE WHEN actual_completion_date IS NULL OR TRIM(actual_completion_date) = '' THEN 1 END) AS projects_ongoing
        FROM infrastructure_projects
        WHERE {where_clause};
    """, tuple(query_params))
    core = cur.fetchone()

    total_projects = core["total_projects"] or 0
    total_orig_cost = round(core["total_original_cost"], 2)
    total_rev_cost = round(core["total_revised_cost"], 2)
    total_cost_overrun = round(core["total_cost_overrun"], 2)
    cost_overrun_pct = round((total_cost_overrun / total_orig_cost * 100.0), 2) if total_orig_cost > 0 else 0.0
    projects_with_cost_overrun = core["projects_with_cost_overrun"] or 0
    total_expenditure = round(core["total_expenditure"], 2)
    expenditure_pct = round((total_expenditure / total_rev_cost * 100.0), 2) if total_rev_cost > 0 else 0.0
    projects_with_time_overrun = core["projects_with_time_overrun"] or 0
    projects_completed = core["projects_completed"] or 0
    projects_ongoing = core["projects_ongoing"] or 0

    # Fetch previous snapshot progress for velocity computation
    prev_progress_by_pid = {}
    if prev_month:
        cur.execute("SELECT project_id, physical_progress FROM infrastructure_projects WHERE report_month = ?;", (prev_month,))
        for r in cur.fetchall():
            prev_progress_by_pid[r["project_id"]] = r["physical_progress"]

    # Fetch all current projects to compute risk distribution & top items
    cur.execute(f"""
        SELECT project_id, project_name, sector, state, ministry, original_cost, revised_cost,
               expenditure, physical_progress, original_completion_date, revised_completion_date,
               actual_completion_date, report_month
        FROM infrastructure_projects
        WHERE {where_clause};
    """, tuple(query_params))
    all_projects = cur.fetchall()

    risk_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    scored_projects = []

    for p in all_projects:
        p_dict = dict(p)
        prev_p = {"physical_progress": prev_progress_by_pid.get(p_dict["project_id"])} if p_dict["project_id"] in prev_progress_by_pid else None
        risk = compute_project_risk(p_dict, prev_p)
        risk_counts[risk["level"]] = risk_counts.get(risk["level"], 0) + 1
        
        orig_c = p_dict.get("original_cost") or 0.0
        rev_c = p_dict.get("revised_cost") or orig_c
        overrun_amt = max(0.0, rev_c - orig_c)
        
        scored_projects.append({
            "project_id": p_dict["project_id"],
            "project_name": p_dict["project_name"],
            "sector": p_dict["sector"],
            "state": p_dict["state"],
            "original_cost": orig_c,
            "revised_cost": rev_c,
            "overrun_amount": round(overrun_amt, 2),
            "cost_overrun_pct": risk["cost_overrun_pct"],
            "delay_months": risk["delay_months"],
            "risk_score": risk["score"],
            "risk_level": risk["level"],
            "physical_progress": p_dict.get("physical_progress"),
        })

    # Top 10 by cost overrun amount
    top_cost_overruns = sorted(
        [p for p in scored_projects if p["overrun_amount"] > 0],
        key=lambda x: x["overrun_amount"],
        reverse=True
    )[:10]

    # Top 10 critical projects
    top_critical_projects = sorted(
        scored_projects,
        key=lambda x: (x["risk_score"], x["overrun_amount"]),
        reverse=True
    )[:10]

    # Sector breakdown
    cur.execute("""
        SELECT
            sector,
            COUNT(*) AS project_count,
            COALESCE(SUM(original_cost), 0.0) AS sector_original_cost,
            COALESCE(SUM(COALESCE(revised_cost, original_cost)), 0.0) AS sector_revised_cost,
            COALESCE(SUM(expenditure), 0.0) AS sector_expenditure,
            COUNT(CASE WHEN revised_cost > original_cost THEN 1 END) AS sector_cost_overruns,
            COUNT(CASE WHEN revised_completion_date > original_completion_date THEN 1 END) AS sector_time_overruns
        FROM infrastructure_projects
        WHERE report_month = ?
        GROUP BY sector
        ORDER BY project_count DESC;
    """, (target_month,))
    sector_rows = cur.fetchall()
    sector_breakdown = [
        {
            "sector": r["sector"] or "Other",
            "project_count": r["project_count"],
            "original_cost": round(r["sector_original_cost"], 2),
            "revised_cost": round(r["sector_revised_cost"], 2),
            "cost_overrun_amount": round(max(0.0, r["sector_revised_cost"] - r["sector_original_cost"]), 2),
            "expenditure": round(r["sector_expenditure"], 2),
            "cost_overrun_count": r["sector_cost_overruns"],
            "time_overrun_count": r["sector_time_overruns"],
        }
        for r in sector_rows
    ]

    # Get counts for all available snapshot months dynamically
    cur.execute("""
        SELECT report_month, COUNT(*) AS cnt
        FROM infrastructure_projects
        WHERE report_month IS NOT NULL AND TRIM(report_month) != ''
        GROUP BY report_month
        ORDER BY report_month DESC;
    """)
    month_rows = cur.fetchall()
    conn.close()

    available_months = [
        {
            "report_month": r["report_month"],
            "label": format_month_label(r["report_month"]),
            "available": r["cnt"] > 0,
            "record_count": r["cnt"],
            "project_count": r["cnt"],
        }
        for r in month_rows
    ]

    return {
        "report_month": target_month,
        "report_month_label": format_month_label(target_month),
        "available_months": available_months,
        "metrics": {
            "total_monitored_projects": total_projects,
            "total_original_cost_cr": total_orig_cost,
            "total_revised_cost_cr": total_rev_cost,
            "total_cost_overrun_cr": total_cost_overrun,
            "cost_overrun_pct": cost_overrun_pct,
            "projects_with_cost_overrun": projects_with_cost_overrun,
            "total_expenditure_cr": total_expenditure,
            "expenditure_pct_of_revised": expenditure_pct,
            "projects_with_time_overrun": projects_with_time_overrun,
            "projects_ongoing": projects_ongoing,
            "projects_completed": projects_completed,
        },
        "risk_distribution": risk_counts,
        "sector_breakdown": sector_breakdown,
        "top_cost_overruns": top_cost_overruns,
        "top_critical_projects": top_critical_projects,
    }


async def get_projects_registry(
    report_month: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    sector: Optional[str] = None,
    state: Optional[str] = None,
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    sort_by: str = "cost_overrun_pct",
    sort_dir: str = "desc",
    ministry_scope: Optional[str] = None,
    project_id_scope: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Retrieve paginated, filterable, sortable list of projects strictly from database.
    All computed columns (risk, deltas, status) are derived deterministically.
    Enforces role scoping (ministry_scope, project_id_scope).
    """
    target_month = get_resolved_report_month(report_month)
    prev_month = get_previous_report_month(target_month)

    conn = init_sqlite_db()
    cur = conn.cursor()

    # Load previous month's progress for delta comparison
    prev_progress_map = {}
    if prev_month:
        cur.execute("SELECT project_id, physical_progress FROM infrastructure_projects WHERE report_month = ?;", (prev_month,))
        for r in cur.fetchall():
            prev_progress_map[r["project_id"]] = r["physical_progress"]

    where_conds = ["report_month = ?"]
    query_params: List[Any] = [target_month]
    if project_id_scope:
        where_conds.append("project_id = ?")
        query_params.append(project_id_scope)
    elif ministry_scope:
        where_conds.append("LOWER(ministry) = LOWER(?)")
        query_params.append(ministry_scope)

    where_clause = " AND ".join(where_conds)

    # Base query for all projects in selected month
    cur.execute(f"""
        SELECT project_id, project_name, agency, ministry, sector, state,
               start_date, original_completion_date, revised_completion_date, actual_completion_date,
               original_cost, revised_cost, expenditure, physical_progress, report_month,
               source_section, source_pages
        FROM infrastructure_projects
        WHERE {where_clause};
    """, tuple(query_params))
    raw_projects = cur.fetchall()
    conn.close()

    # Transform and compute dynamic fields
    processed: List[Dict[str, Any]] = []
    search_q = (search or "").strip().lower()
    filter_sec = (sector or "").strip().lower()
    filter_st = (state or "").strip().lower()
    filter_stat = (status or "").strip().lower()
    filter_risk = (risk_level or "").strip().upper()

    for r in raw_projects:
        p = dict(r)
        orig_c = p.get("original_cost")
        rev_c = p.get("revised_cost") or orig_c
        act_date = str(p.get("actual_completion_date") or "").strip()
        is_completed = bool(act_date)

        # Status: "Completed" if Table 3 actual completion date is confirmed, else "Ongoing"
        proj_status = "Completed" if is_completed else "Ongoing"

        # Previous snapshot progress
        prev_p = {"physical_progress": prev_progress_map.get(p["project_id"])} if p["project_id"] in prev_progress_map else None
        risk_info = compute_project_risk(p, prev_p)

        overrun_amt = max(0.0, (rev_c or 0.0) - (orig_c or 0.0))

        # Search match
        if search_q:
            pid = str(p.get("project_id") or "").lower()
            pname = str(p.get("project_name") or "").lower()
            minis = str(p.get("ministry") or "").lower()
            sec = str(p.get("sector") or "").lower()
            st = str(p.get("state") or "").lower()
            if search_q not in pid and search_q not in pname and search_q not in minis and search_q not in sec and search_q not in st:
                continue

        # Filters
        if filter_sec and filter_sec != "all" and filter_sec not in str(p.get("sector") or "").lower():
            continue
        if filter_st and filter_st != "all" and filter_st not in str(p.get("state") or "").lower():
            continue
        if filter_stat and filter_stat != "all" and filter_stat != proj_status.lower():
            continue
        if filter_risk and filter_risk != "ALL" and filter_risk != risk_info["level"]:
            continue

        item = {
            "project_id": p["project_id"],
            "project_name": p["project_name"] or "Unnamed Project",
            "agency": p["agency"] or "N/A",
            "ministry": p["ministry"] or "N/A",
            "sector": p["sector"] or "General",
            "state": p["state"] or "Central",
            "status": proj_status,
            "start_date": p["start_date"] or "N/A",
            "original_completion_date": p["original_completion_date"] or "N/A",
            "revised_completion_date": p["revised_completion_date"] or "N/A",
            "actual_completion_date": act_date if act_date else "N/A",
            "original_cost": orig_c,
            "revised_cost": rev_c,
            "cost_overrun_amount": round(overrun_amt, 2),
            "cost_overrun_pct": risk_info["cost_overrun_pct"],
            "expenditure": p.get("expenditure"),
            "physical_progress": p.get("physical_progress"),
            "delay_months": risk_info["delay_months"],
            "progress_delta": risk_info.get("progress_delta"),
            "risk_score": risk_info["score"],
            "risk_level": risk_info["level"],
            "report_month": target_month,
        }
        processed.append(item)

    # Sorting
    reverse_order = (sort_dir.lower() == "desc")
    sort_key = sort_by.lower()

    def get_sort_val(item: Dict[str, Any]):
        val = item.get(sort_key)
        if val is None or val == "N/A":
            return -999999 if reverse_order else 999999
        return val

    try:
        processed.sort(key=get_sort_val, reverse=reverse_order)
    except Exception:
        processed.sort(key=lambda x: x.get("risk_score", 0), reverse=True)

    # Pagination
    total = len(processed)
    page_safe = max(1, page)
    page_size_safe = max(1, min(200, page_size))
    total_pages = max(1, (total + page_size_safe - 1) // page_size_safe)
    start_idx = (page_safe - 1) * page_size_safe
    end_idx = start_idx + page_size_safe
    paged_items = processed[start_idx:end_idx]

    return {
        "projects": paged_items,
        "total": total,
        "page": page_safe,
        "page_size": page_size_safe,
        "total_pages": total_pages,
        "report_month": target_month,
    }


async def get_project_detail_by_id(
    project_id: str,
    ministry_scope: Optional[str] = None,
    project_id_scope: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Retrieve comprehensive project detail across all 4 snapshots (April, May, June, July 2026).
    Includes monthly snapshot progression, deterministic risk, early warnings, and ML predictions.
    Enforces role scoping (ministry_scope, project_id_scope).
    """
    clean_id = re.sub(r"\s+", "", str(project_id or "")).strip()
    if not clean_id:
        return None

    # Enforce Project Manager scoping: cannot access any project other than assigned
    if project_id_scope and clean_id != str(project_id_scope).strip():
        return None

    conn = init_sqlite_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT project_id, project_name, agency, ministry, sector, state,
               start_date, original_completion_date, revised_completion_date, actual_completion_date,
               original_cost, revised_cost, expenditure, physical_progress, report_month,
               source_section, source_pages
        FROM infrastructure_projects
        WHERE project_id = ?
        ORDER BY report_month ASC;
    """, (clean_id,))
    rows = cur.fetchall()
    conn.close()

    if not rows:
        return None

    # Enforce Ministry scoping: cannot access any project belonging to another ministry
    if ministry_scope:
        latest_ministry = str(rows[-1]["ministry"] or "").strip().lower()
        if latest_ministry != ministry_scope.strip().lower():
            return None

    snapshots: List[Dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        orig_c = d.get("original_cost")
        rev_c = d.get("revised_cost") or orig_c
        overrun = max(0.0, (rev_c or 0.0) - (orig_c or 0.0))
        overrun_pct = round((overrun / orig_c * 100.0), 2) if orig_c and orig_c > 0 else 0.0
        
        act_d = str(d.get("actual_completion_date") or "").strip()
        
        snapshots.append({
            "report_month": d["report_month"],
            "report_month_label": format_month_label(d["report_month"]),
            "original_cost": orig_c,
            "revised_cost": rev_c,
            "cost_overrun_amount": round(overrun, 2),
            "cost_overrun_pct": overrun_pct,
            "expenditure": d.get("expenditure"),
            "physical_progress": d.get("physical_progress"),
            "original_completion_date": d.get("original_completion_date"),
            "revised_completion_date": d.get("revised_completion_date"),
            "actual_completion_date": act_d if act_d else None,
            "source_section": d.get("source_section"),
            "source_pages": d.get("source_pages"),
        })

    # Latest snapshot is current state
    latest = dict(rows[-1])
    prev = dict(rows[-2]) if len(rows) > 1 else None

    # Compute deterministic risk
    risk = compute_project_risk(latest, prev)

    # Generate data-grounded early warnings
    warnings = generate_early_warnings(latest, prev)

    # Generate non-leaking ML predictions
    ml_pred = predict_project(latest)

    # Compute date-based live schedule risk layer
    live_sched = calculate_live_schedule_risk(latest)

    act_date_str = str(latest.get("actual_completion_date") or "").strip()
    status = "Completed" if act_date_str else "Ongoing"

    return {
        "project_id": latest["project_id"],
        "project_name": latest["project_name"] or "Unnamed Project",
        "agency": latest["agency"] or "N/A",
        "ministry": latest["ministry"] or "N/A",
        "sector": latest["sector"] or "General",
        "state": latest["state"] or "Central",
        "status": status,
        "start_date": latest.get("start_date") or "N/A",
        "original_completion_date": latest.get("original_completion_date") or "N/A",
        "revised_completion_date": latest.get("revised_completion_date") or "N/A",
        "actual_completion_date": act_date_str if act_date_str else "N/A (Ongoing)",
        "financials": {
            "original_cost_cr": latest.get("original_cost"),
            "revised_cost_cr": latest.get("revised_cost") or latest.get("original_cost"),
            "cost_overrun_amount_cr": round(max(0.0, (latest.get("revised_cost") or 0.0) - (latest.get("original_cost") or 0.0)), 2),
            "cost_overrun_pct": risk["cost_overrun_pct"],
            "expenditure_cr": latest.get("expenditure"),
            "physical_progress_pct": latest.get("physical_progress"),
        },
        "schedule": {
            "delay_months": risk["delay_months"],
            "progress_delta": risk.get("progress_delta"),
        },
        "risk_assessment": risk,
        "early_warnings": warnings,
        "ml_predictions": ml_pred,
        "live_schedule_risk": live_sched,
        "snapshots": snapshots,
    }


async def get_map_markers(
    report_month: Optional[str] = None,
    ministry_scope: Optional[str] = None,
    project_id_scope: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Retrieve project location markers and aggregated state statistics strictly from database.
    If exact coordinates are unavailable, uses state-level coordinates with explicit label.
    Supports role scoping (ministry_scope, project_id_scope).
    """
    target_month = get_resolved_report_month(report_month)
    prev_month = get_previous_report_month(target_month)

    conn = init_sqlite_db()
    cur = conn.cursor()

    prev_progress_map = {}
    if prev_month:
        cur.execute("SELECT project_id, physical_progress FROM infrastructure_projects WHERE report_month = ?;", (prev_month,))
        for r in cur.fetchall():
            prev_progress_map[r["project_id"]] = r["physical_progress"]

    where_conds = ["report_month = ?"]
    query_params: List[Any] = [target_month]
    if project_id_scope:
        where_conds.append("project_id = ?")
        query_params.append(project_id_scope)
    elif ministry_scope:
        where_conds.append("LOWER(ministry) = LOWER(?)")
        query_params.append(ministry_scope)

    where_clause = " AND ".join(where_conds)

    cur.execute(f"""
        SELECT project_id, project_name, sector, state, ministry, original_cost, revised_cost,
               expenditure, physical_progress, original_completion_date, revised_completion_date,
               actual_completion_date, report_month
        FROM infrastructure_projects
        WHERE {where_clause};
    """, tuple(query_params))
    rows = cur.fetchall()
    conn.close()

    markers: List[Dict[str, Any]] = []
    state_stats: Dict[str, Dict[str, Any]] = {}

    for r in rows:
        p = dict(r)
        prev_p = {"physical_progress": prev_progress_map.get(p["project_id"])} if p["project_id"] in prev_progress_map else None
        risk = compute_project_risk(p, prev_p)

        lat, lng, accuracy = resolve_state_coordinates(p.get("state"))
        # Add slight pseudo-jitter based on project_id so markers in same state don't sit on identical pixel
        pid_hash = hash(p["project_id"]) % 100
        jitter_lat = round(lat + ((pid_hash % 10) - 5) * 0.08, 4)
        jitter_lng = round(lng + (((pid_hash // 10) % 10) - 5) * 0.08, 4)

        orig_c = p.get("original_cost") or 0.0
        rev_c = p.get("revised_cost") or orig_c
        act_date = str(p.get("actual_completion_date") or "").strip()

        markers.append({
            "project_id": p["project_id"],
            "project_name": p["project_name"] or "Unnamed",
            "sector": p["sector"] or "General",
            "state": p["state"] or "Central",
            "lat": jitter_lat,
            "lng": jitter_lng,
            "location_accuracy": accuracy,
            "original_cost": orig_c,
            "revised_cost": rev_c,
            "expenditure": p.get("expenditure"),
            "physical_progress": p.get("physical_progress"),
            "delay_months": risk["delay_months"],
            "risk_score": risk["score"],
            "risk_level": risk["level"],
            "status": "Completed" if act_date else "Ongoing",
        })

        # State Aggregation
        st_name = p.get("state") or "Central"
        if st_name not in state_stats:
            state_stats[st_name] = {
                "state": st_name,
                "project_count": 0,
                "total_cost": 0.0,
                "critical_projects": 0,
                "delay_samples": [],
            }
        state_stats[st_name]["project_count"] += 1
        state_stats[st_name]["total_cost"] += rev_c
        if risk["level"] == "CRITICAL":
            state_stats[st_name]["critical_projects"] += 1
        # Delay only recorded for valid completions or explicit postponements
        if risk["delay_months"] > 0:
            state_stats[st_name]["delay_samples"].append(risk["delay_months"])

    # Finalize state aggregates
    final_state_aggregates = []
    for st_name, data in state_stats.items():
        delays = data["delay_samples"]
        avg_delay = round(sum(delays) / len(delays), 1) if delays else 0.0
        final_state_aggregates.append({
            "state": st_name,
            "project_count": data["project_count"],
            "total_cost_cr": round(data["total_cost"], 2),
            "critical_projects": data["critical_projects"],
            "average_delay_months": avg_delay,
        })

    final_state_aggregates.sort(key=lambda x: x["project_count"], reverse=True)

    return {
        "report_month": target_month,
        "total_markers": len(markers),
        "markers": markers,
        "state_aggregates": final_state_aggregates,
    }


async def get_early_warnings_feed(
    report_month: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 150,
    ministry_scope: Optional[str] = None,
    project_id_scope: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate early warning signals across all monitored projects for the selected snapshot month.
    Purely data-driven: cost escalation, schedule extension, stagnation, and expenditure divergence.
    Supports role scoping (ministry_scope, project_id_scope).
    """
    target_month = get_resolved_report_month(report_month)
    prev_month = get_previous_report_month(target_month)

    conn = init_sqlite_db()
    cur = conn.cursor()

    prev_snapshot_map = {}
    if prev_month:
        cur.execute("SELECT project_id, physical_progress, report_month FROM infrastructure_projects WHERE report_month = ?;", (prev_month,))
        for r in cur.fetchall():
            prev_snapshot_map[r["project_id"]] = dict(r)

    where_conds = ["report_month = ?"]
    query_params: List[Any] = [target_month]
    if project_id_scope:
        where_conds.append("project_id = ?")
        query_params.append(project_id_scope)
    elif ministry_scope:
        where_conds.append("LOWER(ministry) = LOWER(?)")
        query_params.append(ministry_scope)

    where_clause = " AND ".join(where_conds)

    cur.execute(f"""
        SELECT project_id, project_name, sector, state, ministry, original_cost, revised_cost,
               expenditure, physical_progress, original_completion_date, revised_completion_date,
               actual_completion_date, report_month
        FROM infrastructure_projects
        WHERE {where_clause};
    """, tuple(query_params))
    rows = cur.fetchall()
    conn.close()

    all_warnings: List[Dict[str, Any]] = []
    filter_sev = (severity or "").strip().upper()

    for r in rows:
        p = dict(r)
        prev_p = prev_snapshot_map.get(p["project_id"])
        proj_warnings = generate_early_warnings(p, prev_p)
        for w in proj_warnings:
            if filter_sev and filter_sev != "ALL" and w["severity"] != filter_sev:
                continue
            all_warnings.append(w)

    # Sort CRITICAL first, then HIGH, then MEDIUM
    sev_rank = {"CRITICAL": 3, "HIGH": 2, "MEDIUM": 1, "LOW": 0}
    all_warnings.sort(key=lambda x: sev_rank.get(x["severity"], 0), reverse=True)

    return {
        "report_month": target_month,
        "total_warnings": len(all_warnings),
        "warnings": all_warnings[:limit],
    }


async def get_sector_analytics(
    report_month: Optional[str] = None,
    ministry_scope: Optional[str] = None,
) -> Dict[str, Any]:
    """Return aggregated sector-level cost, delay, and execution analytics with optional ministry scoping."""
    target_month = get_resolved_report_month(report_month)
    conn = init_sqlite_db()
    cur = conn.cursor()

    where_conds = ["report_month = ?"]
    query_params: List[Any] = [target_month]
    if ministry_scope:
        where_conds.append("LOWER(ministry) = LOWER(?)")
        query_params.append(ministry_scope)

    where_clause = " AND ".join(where_conds)

    cur.execute(f"""
        SELECT
            sector,
            COUNT(*) AS project_count,
            COALESCE(SUM(original_cost), 0.0) AS original_cost,
            COALESCE(SUM(COALESCE(revised_cost, original_cost)), 0.0) AS revised_cost,
            COALESCE(SUM(expenditure), 0.0) AS expenditure,
            AVG(physical_progress) AS avg_physical_progress,
            COUNT(CASE WHEN revised_cost > original_cost THEN 1 END) AS cost_overrun_count,
            COUNT(CASE WHEN revised_completion_date > original_completion_date THEN 1 END) AS time_overrun_count
        FROM infrastructure_projects
        WHERE {where_clause}
        GROUP BY sector
        ORDER BY project_count DESC;
    """, tuple(query_params))
    rows = cur.fetchall()
    conn.close()

    sectors = []
    for r in rows:
        orig = round(r["original_cost"], 2)
        rev = round(r["revised_cost"], 2)
        exp = round(r["expenditure"], 2)
        overrun = round(max(0.0, rev - orig), 2)
        pct = round((overrun / orig * 100.0), 2) if orig > 0 else 0.0
        avg_prog = round(r["avg_physical_progress"], 1) if r["avg_physical_progress"] is not None else None

        sectors.append({
            "sector": r["sector"] or "Other",
            "project_count": r["project_count"],
            "original_cost_cr": orig,
            "revised_cost_cr": rev,
            "cost_overrun_cr": overrun,
            "cost_overrun_pct": pct,
            "expenditure_cr": exp,
            "avg_physical_progress": avg_prog,
            "cost_overrun_count": r["cost_overrun_count"],
            "time_overrun_count": r["time_overrun_count"],
        })

    return {
        "report_month": target_month,
        "sectors": sectors,
    }


async def get_monthly_trends() -> Dict[str, Any]:
    """Retrieve 4-month historical trend across April, May, June, July 2026."""
    conn = init_sqlite_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            report_month,
            COUNT(*) AS project_count,
            COALESCE(SUM(original_cost), 0.0) AS original_cost,
            COALESCE(SUM(COALESCE(revised_cost, original_cost)), 0.0) AS revised_cost,
            COALESCE(SUM(expenditure), 0.0) AS expenditure,
            COUNT(CASE WHEN revised_cost > original_cost THEN 1 END) AS cost_overrun_count,
            COUNT(CASE WHEN revised_completion_date > original_completion_date THEN 1 END) AS time_overrun_count
        FROM infrastructure_projects
        GROUP BY report_month
        ORDER BY report_month ASC;
    """)
    rows = cur.fetchall()
    conn.close()

    trend = []
    for r in rows:
        m = r["report_month"]
        orig = round(r["original_cost"], 2)
        rev = round(r["revised_cost"], 2)
        overrun = round(max(0.0, rev - orig), 2)
        pct = round((overrun / orig * 100.0), 2) if orig > 0 else 0.0

        trend.append({
            "report_month": m,
            "label": format_month_label(m),
            "project_count": r["project_count"],
            "original_cost_cr": orig,
            "revised_cost_cr": rev,
            "cost_overrun_cr": overrun,
            "cost_overrun_pct": pct,
            "expenditure_cr": round(r["expenditure"], 2),
            "cost_overrun_projects": r["cost_overrun_count"],
            "delayed_projects": r["time_overrun_count"],
        })

    return {"monthly_trends": trend}



