import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import pymupdf


def normalize_report_month(raw_month: str, text_context: str = "") -> str:
    """Normalize user input or detected text into standard format:
    January PDF   -> "2026-01"
    February PDF  -> "2026-02"
    ...
    December PDF  -> "2026-12"
    Explicit raw_month ALWAYS takes priority over PDF first_page_text to prevent month leakage.
    """
    month_map = {
        "01": "01", "jan": "01", "january": "01",
        "02": "02", "feb": "02", "february": "02",
        "03": "03", "mar": "03", "march": "03",
        "04": "04", "apr": "04", "april": "04",
        "05": "05", "may": "05",
        "06": "06", "jun": "06", "june": "06",
        "07": "07", "jul": "07", "july": "07",
        "08": "08", "aug": "08", "august": "08",
        "09": "09", "sep": "09", "sept": "09", "september": "09",
        "10": "10", "oct": "10", "october": "10",
        "11": "11", "nov": "11", "november": "11",
        "12": "12", "dec": "12", "december": "12",
    }

    s = (raw_month or "").strip().lower()
    
    # Check explicit user input first
    if s:
        # ISO match like '2026-06' or '2026-06-01'
        iso_match = re.match(r"^(\d{4})-(\d{1,2})", s)
        if iso_match:
            y, m = iso_match.groups()
            return f"{y}-{int(m):02d}"
        
        # Word or token match
        year_match = re.search(r"\b(20\d{2})\b", s)
        year = year_match.group(1) if year_match else "2026"

        for key, val in month_map.items():
            if re.search(r"\b" + re.escape(key) + r"\b", s) or key == s:
                return f"{year}-{val}"

        # Substring match if full word boundary didn't hit
        for key in ("january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"):
            if key in s:
                return f"{year}-{month_map[key]}"

    # Fallback to text_context if raw_month was not provided
    t = (text_context or "").lower()
    if t:
        year_match = re.search(r"\b(20\d{2})\b", t)
        year = year_match.group(1) if year_match else "2026"
        for key in ("january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"):
            if key in t:
                return f"{year}-{month_map[key]}"

    return "2026-04"


def clean_cell(cell: Any) -> str:
    if cell is None:
        return ""
    # Normalize internal newlines and multiple spaces
    text = str(cell).replace("\r", " ").replace("\n", " ")
    cleaned = " ".join(text.split()).strip()
    # Remove leading fragment artifacts like "IV)" or "riM)" caused by adjacent column border clipping
    cleaned = re.sub(r"^[A-Za-z0-9]+\)\s*", "", cleaned).strip()
    return cleaned


def parse_numeric(val: Any) -> Optional[float]:
    if val is None:
        return None
    s = str(val).strip().replace(",", "").replace("%", "")
    if not s or s.lower() in ("-", "--", "---", "n/a", "na", "null", "none", "nil", ""):
        return None
    match = re.search(r"[-+]?\d*\.?\d+", s)
    if match:
        try:
            return float(match.group(0))
        except ValueError:
            return None
    return None


def parse_compound_costs(cost_cell: str) -> Tuple[Optional[float], Optional[float]]:
    """Parse '1313.28 (1313.28)' or '8797 (11256)' or '43,367' into (original_cost, revised_cost).
    Never invents missing values.
    """
    if not cost_cell:
        return None, None
    nums = re.findall(r"[-+]?\d*\.?\d+", cost_cell.replace(",", ""))
    if not nums:
        return None, None
    try:
        orig = float(nums[0])
    except ValueError:
        orig = None
    rev = None
    if len(nums) > 1:
        try:
            rev = float(nums[1])
        except ValueError:
            rev = None
    return orig, rev


def clean_date_str(d_str: Any) -> Optional[str]:
    """Clean date strings like '04/2026', '2026-04', 'NA', '-', returning standardized MM/YYYY or None.
    Never parse 'NA', empty strings, or invalid dates as dates.
    """
    if d_str is None:
        return None
    s = str(d_str).strip()
    if not s or s.upper() in ("NA", "N/A", "-", "--", "---", "NIL", "NONE", "NULL", ""):
        return None
    # Check MM/YYYY or M/YYYY
    m1 = re.search(r"\b(\d{1,2})[/.-](\d{4})\b", s)
    if m1:
        month = int(m1.group(1))
        year = int(m1.group(2))
        if 1 <= month <= 12 and 1900 <= year <= 2100:
            return f"{month:02d}/{year}"
    # Check YYYY-MM or YYYY/MM
    m2 = re.search(r"\b(\d{4})[/.-](\d{1,2})\b", s)
    if m2:
        year = int(m2.group(1))
        month = int(m2.group(2))
        if 1 <= month <= 12 and 1900 <= year <= 2100:
            return f"{month:02d}/{year}"
    return None


def parse_completed_project_dates(date_cell: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Parse Completed Projects date cell:
    Header: Actual Date of Completion (Orignal/Target DoC) (Revised DoC) MM/YYYY
    Cell: 03/2026 (06/2023) (-)
    Returns (orig_doc, rev_doc, actual_doc).
    """
    if not date_cell:
        return None, None, None
    s = str(date_cell).strip()
    parens = re.findall(r"\(([^)]+)\)", s)
    actual_raw = re.sub(r"\([^)]*\)", "", s).strip()

    actual_doc = clean_date_str(actual_raw)
    orig_doc = clean_date_str(parens[0]) if len(parens) > 0 else None
    rev_doc = clean_date_str(parens[1]) if len(parens) > 1 else None

    return orig_doc, rev_doc, actual_doc


def parse_standard_project_dates(date_cell: str) -> Tuple[Optional[str], Optional[str]]:
    """Parse standard project date cell:
    (Orignal/Target DoC) (Revised DoC) MM/YYYY or 01/2024 (12/2025)
    Returns (orig_doc, rev_doc).
    """
    if not date_cell:
        return None, None
    parens = re.findall(r"\(([^)]+)\)", date_cell)
    outside = re.sub(r"\([^)]*\)", "", date_cell).strip()

    if len(parens) >= 2:
        orig_doc = clean_date_str(parens[0])
        rev_doc = clean_date_str(parens[1])
    elif len(parens) == 1:
        if outside:
            orig_doc = clean_date_str(outside)
            rev_doc = clean_date_str(parens[0])
        else:
            orig_doc = clean_date_str(parens[0])
            rev_doc = None
    else:
        orig_doc = clean_date_str(outside)
        rev_doc = None

    return orig_doc, rev_doc


def parse_compound_dates(date_cell: str) -> Tuple[str, str]:
    """Parse '01/2024 (12/2025)' into (primary_date, secondary_date)."""
    d1, d2 = parse_standard_project_dates(date_cell)
    return d1 or "", d2 or ""


def parse_compound_project_cell(cell_text: str, default_pid: str) -> Tuple[str, str, str]:
    """Parse cell containing 'Project Name (Agency) (Project Code) (Legacy OCMS Code) (PMGID)'.
    Extracts (project_id, project_name, agency).
    """
    cleaned = clean_cell(cell_text)
    if not cleaned:
        return default_pid, "", ""

    parens = re.findall(r"\(([^)]+)\)", cleaned)
    project_id = ""
    agency = ""

    known_agencies = [
        "NHAI", "NHIDCL", "MORTH", "MINISTRY", "RAILWAY", "SECL", "IOCL", "BPCL", "HPCL",
        "ONGC", "NTPC", "POWERGRID", "AAI", "DMRC", "SAIL", "BMRCL", "RVNL", "DVC",
        "SCCL", "MCL", "ECL", "WCL", "NCL", "BCCL", "NBCC", "CPCL", "GAIL", "NRL",
        "SJVN", "NEEPCO", "MRPL", "CIL"
    ]

    # Check parentheses for project code (5-6 digit integer) and agency
    for p in parens:
        p_clean = p.strip()
        if p_clean.isdigit() and len(p_clean) >= 5:
            project_id = p_clean
        elif not agency and any(k in p_clean.upper() for k in known_agencies):
            agency = p_clean

    # Fallback search for alphanumeric project code like N16000430
    if not project_id and parens:
        for p in reversed(parens):
            p_clean = p.strip()
            if re.match(r"^[A-Z]?\d{4,8}$", p_clean) and p_clean != agency:
                project_id = p_clean
                break

    if not project_id:
        project_id = default_pid

    # Clean project name by trimming trailing metadata brackets
    first_meta_paren = -1
    for m in re.finditer(r"\(([^)]+)\)", cleaned):
        content = m.group(1).strip()
        if (
            content == agency
            or content == project_id
            or (content.isdigit() and len(content) >= 5)
            or any(k in content.upper() for k in ["NHAI", "NHIDCL", "MINISTRY", "RAILWAY", "SECL"])
        ):
            first_meta_paren = m.start()
            break

    if first_meta_paren > 5:
        p_name = cleaned[:first_meta_paren].strip()
    else:
        p_name = cleaned
        for p in parens:
            p_clean = p.strip()
            if (
                p_clean == project_id
                or p_clean == agency
                or (p_clean.isdigit() and len(p_clean) >= 5)
                or p_clean.startswith(("N2", "N1", "N0", "N3", "N6"))
            ):
                p_name = p_name.replace(f"({p})", "").strip()

    p_name = re.sub(r"^\d+\s*[-.]\s*", "", p_name).strip()
    p_name = re.sub(r"\s+", " ", p_name).strip()

    return project_id, p_name, agency


def infer_ministry_sector(agency: str, curr_ministry: str, curr_sector: str) -> Tuple[str, str]:
    """Infer Ministry and Sector from Agency when available, falling back to section context."""
    ministry = curr_ministry
    sector = curr_sector

    if agency:
        ag_upper = agency.upper()
        if any(k in ag_upper for k in ["NHAI", "NHIDCL", "MORTH"]):
            sector = sector or "Road Transport & Highways"
            ministry = ministry or "Ministry of Road Transport & Highways"
        elif any(k in ag_upper for k in ["RAILWAY", "ECR", "SCR", "WR", "SWR", "SECR", "ECOR", "DMRC", "BMRCL", "MMRCL", "RVNL"]):
            sector = sector or "Railways"
            ministry = ministry or "Ministry of Railways"
        elif any(k in ag_upper for k in ["IOCL", "BPCL", "HPCL", "ONGC", "GAIL", "NRL", "CPCL", "PETROLEUM"]):
            sector = sector or "Petroleum & Natural Gas"
            ministry = ministry or "Ministry of Petroleum & Natural Gas"
        elif any(k in ag_upper for k in ["POWERGRID", "NTPC", "SJVN", "NEEPCO", "DVC"]):
            sector = sector or "Power"
            ministry = ministry or "Ministry of Power"
        elif any(k in ag_upper for k in ["SECL", "MCL", "ECL", "WCL", "NCL", "BCCL", "SCCL", "COAL"]):
            sector = sector or "Coal"
            ministry = ministry or "Ministry of Coal"
        elif "AAI" in ag_upper or "AIRPORT" in ag_upper:
            sector = sector or "Civil Aviation"
            ministry = ministry or "Ministry of Civil Aviation"
        elif "SAIL" in ag_upper or "STEEL" in ag_upper:
            sector = sector or "Steel"
            ministry = ministry or "Ministry of Steel"
        elif "NBCC" in ag_upper or "HOUSING" in ag_upper:
            sector = sector or "Urban Development"
            ministry = ministry or "Ministry of Housing & Urban Affairs"

    return ministry, sector


def extract_paimana_pdf(pdf_path: Any, raw_month: str) -> Dict[str, Any]:
    """Open a PAIMANA Flash Report PDF using PyMuPDF, read all pages,
    validate and filter project rows, track source_page for every record,
    and generate project-level validation metrics.
    """
    path_obj = Path(pdf_path)
    if not path_obj.exists():
        raise FileNotFoundError(f"File not found: {path_obj}")

    doc = pymupdf.open(str(path_obj))
    total_pages = len(doc)
    pages_with_text = 0
    sample_text = ""
    tables_found_count = 0

    first_page_text = doc[0].get_text("text") if total_pages > 0 else ""
    report_month = normalize_report_month(raw_month, first_page_text)

    # Validation accounting counters
    total_rows_extracted = 0
    header_rows_removed = 0
    summary_rows_removed = 0
    blank_rows_removed = 0
    invalid_rows = 0
    duplicate_rows_detected = 0

    valid_records: List[Dict[str, Any]] = []
    seen_row_signatures = set()

    current_sector = ""
    current_ministry = ""
    current_section = ""

    for page_num in range(total_pages):
        page = doc[page_num]
        src_page = page_num + 1
        text = page.get_text("text")
        lower_page_text = text.lower()

        # Dynamically track report section from section dividers or headers
        if (
            "completed projects during month" in lower_page_text
            or "table 3: completed projects" in lower_page_text
            or "table 3 : completed projects" in lower_page_text
        ):
            current_section = "Table 3 Completed Projects"
        elif (
            "newly added projects" in lower_page_text
            or "table 4: newly added" in lower_page_text
            or "table 4 : newly added" in lower_page_text
        ):
            current_section = "Table 4 Newly Added Projects"
        elif (
            "north eastern region" in lower_page_text
            or "table 5: ongoing projects" in lower_page_text
            or "table 5 : ongoing projects" in lower_page_text
        ):
            current_section = "Table 5 North Eastern Region"
        elif (
            "all ongoing projects" in lower_page_text
            or "table 6: all ongoing" in lower_page_text
            or "table 6 : all ongoing" in lower_page_text
        ):
            current_section = "Table 6 All Ongoing Projects"
        elif "top projects overview" in lower_page_text or (9 <= src_page <= 22):
            current_section = "Top Projects Overview"

        if text.strip():
            pages_with_text += 1
            if not sample_text:
                sample_text = text.strip()[:400]

        tabs = page.find_tables()
        if not tabs.tables:
            continue

        tables_found_count += len(tabs.tables)

        for tab in tabs.tables:
            raw_rows = tab.extract()
            if not raw_rows or len(raw_rows) < 2:
                continue

            hdr_cells = [clean_cell(c).lower() for c in raw_rows[0] if c]
            hdr_str = " ".join(hdr_cells)

            # Skip aggregate / summary-level tables
            if (
                "project count" in hdr_str
                or ("sector name" in hdr_str and "project name" not in hdr_str)
                or ("state name" in hdr_str and "project name" not in hdr_str)
                or "ministry-wise ongoing" in hdr_str
                or "ongoing projects state-wise" in hdr_str
            ):
                summary_rows_removed += (len(raw_rows) - 1)
                total_rows_extracted += (len(raw_rows) - 1)
                continue

            is_type_a = "project id" in hdr_str and "project name" in hdr_str
            is_type_b = "project name" in hdr_str and ("state" in hdr_str or "approval" in hdr_str or "cost" in hdr_str)

            if not (is_type_a or is_type_b):
                summary_rows_removed += (len(raw_rows) - 1)
                total_rows_extracted += (len(raw_rows) - 1)
                continue

            is_completed_table = (
                "actual date of completion" in hdr_str
                or ("completed projects" in hdr_str and "date of approval" in hdr_str)
                or (current_section == "Table 3 Completed Projects" and "approval" in hdr_str)
            )

            for r_idx in range(1, len(raw_rows)):
                total_rows_extracted += 1
                row = raw_rows[r_idx]
                if not row or all(clean_cell(c) == "" for c in row):
                    blank_rows_removed += 1
                    continue

                row_cells = [clean_cell(c) for c in row]
                row_str = " ".join(row_cells).lower()

                # Check for repeated table headers
                if any(k in row_str for k in [
                    "project name (agency)", "date of approval", "orignal/target doc", "original cost (₹ crores)"
                ]):
                    header_rows_removed += 1
                    continue
                if row_cells[0].lower() in ("sl.no", "s.no.", "s.no", "sl no"):
                    header_rows_removed += 1
                    continue

                # Check for summary / total / sub-total rows
                if row_cells[0].lower() in ("total", "sub-total", "sub total", "grand total") or any(
                    row_cells[i].lower().startswith("total") for i in range(min(2, len(row_cells)))
                ):
                    summary_rows_removed += 1
                    continue

                # Check for section dividers (e.g. Sector: Power, Ministry of Railways)
                lower_first = row_cells[0].lower()
                if (
                    any(lower_first.startswith(pfx) for pfx in ("sector:", "sector -", "ministry:", "ministry -", "ministry of", "department of", "table "))
                    or lower_first in ("railways", "roads & highways", "power", "coal", "petroleum", "civil aviation", "steel", "healthcare", "education", "real estate", "waste & water", "urban public transport", "shipping & ports", "telecommunications")
                ):
                    if "ministry" in lower_first or "department" in lower_first:
                        current_ministry = row_cells[0].split(":", 1)[-1].strip()
                    elif "sector" in lower_first:
                        current_sector = row_cells[0].split(":", 1)[-1].strip()
                    else:
                        current_sector = row_cells[0].strip()
                    summary_rows_removed += 1
                    continue

                # Parse row based on table structure
                if is_type_a:
                    # 7 columns: S.NO., PROJECT ID, PROJECT NAME, ORIGINAL COST, REVISED COST, EXPENDITURE, PHYSICAL PROGRESS
                    sl_no = row_cells[0]
                    p_id = row_cells[1] if len(row_cells) > 1 else ""
                    p_name = row_cells[2] if len(row_cells) > 2 else ""
                    orig_cost = parse_numeric(row_cells[3]) if len(row_cells) > 3 else None
                    rev_cost = parse_numeric(row_cells[4]) if len(row_cells) > 4 else None
                    exp = parse_numeric(row_cells[5]) if len(row_cells) > 5 else None
                    prog = parse_numeric(row_cells[6]) if len(row_cells) > 6 else None
                    agency = ""
                    state = ""
                    start_date = ""
                    orig_doc = ""
                    rev_doc = ""
                    actual_doc = None
                else:
                    # 8 columns: Sl.No, Project Name (Agency) (Code)..., State, Approval Date, DoC, Costs, Exp, Progress
                    sl_no = row_cells[0]
                    combined_cell = row_cells[1] if len(row_cells) > 1 else ""
                    state = row_cells[2] if len(row_cells) > 2 else ""
                    approval_cell = row_cells[3] if len(row_cells) > 3 else ""
                    doc_cell = row_cells[4] if len(row_cells) > 4 else ""
                    cost_cell = row_cells[5] if len(row_cells) > 5 else ""
                    exp_cell = row_cells[6] if len(row_cells) > 6 else ""
                    prog_cell = row_cells[7] if len(row_cells) > 7 else ""

                    month_tag = report_month.replace("-", "") if report_month else "202604"
                    default_pid = f"PAIMANA-{month_tag}-{int(sl_no):04d}" if sl_no.isdigit() else f"PAIMANA-{month_tag}-P{src_page}-{r_idx:02d}"
                    p_id, p_name, agency = parse_compound_project_cell(combined_cell, default_pid)

                    start_date, _ = parse_compound_dates(approval_cell)
                    if is_completed_table:
                        orig_doc, rev_doc, actual_doc = parse_completed_project_dates(doc_cell)
                    else:
                        orig_doc, rev_doc = parse_standard_project_dates(doc_cell)
                        actual_doc = None

                    orig_cost, rev_cost = parse_compound_costs(cost_cell)
                    exp = parse_numeric(exp_cell)
                    prog = parse_numeric(prog_cell)

                # Validate project name
                if not p_name or len(p_name) < 3 or p_name.lower() in ("project name", "name of project", "name"):
                    invalid_rows += 1
                    continue

                # Exclude ministry / sector divider rows where all numeric values are None
                if orig_cost is None and rev_cost is None and exp is None and prog is None:
                    if any(p_name.lower().startswith(pfx) for pfx in ("ministry of", "department of", "ministry:", "department:")):
                        current_ministry = p_name
                    else:
                        current_sector = p_name
                    summary_rows_removed += 1
                    continue

                # Check exact row duplicate signature
                row_sig = (src_page, p_id, p_name[:40], orig_cost)
                if row_sig in seen_row_signatures:
                    duplicate_rows_detected += 1
                    continue
                seen_row_signatures.add(row_sig)

                # Infer sector and ministry context
                ministry, sector = infer_ministry_sector(agency, current_ministry, current_sector)
                source_section = "Table 3 Completed Projects" if is_completed_table else (current_section or get_source_section(src_page))

                rec = {
                    "project_id": p_id,
                    "project_name": p_name,
                    "agency": agency,
                    "ministry": ministry,
                    "sector": sector,
                    "state": state,
                    "start_date": clean_date_str(start_date) or "",
                    "original_completion_date": orig_doc or "",
                    "revised_completion_date": rev_doc or "",
                    "actual_completion_date": actual_doc or "",
                    "original_cost": orig_cost,
                    "revised_cost": rev_cost,
                    "expenditure": exp,
                    "physical_progress": prog,
                    "report_month": report_month,
                    "source_page": src_page,
                    "source_pages": [src_page],
                    "source_section": source_section,
                }
                valid_records.append(rec)

    doc.close()

    # Calculate missing fields count (genuine projects where optional numeric fields are null in PDF)
    missing_fields_count = sum(
        1 for r in valid_records if (r["revised_cost"] is None or r["expenditure"] is None or r["physical_progress"] is None)
    )

    validation_report = {
        "total_rows_extracted": total_rows_extracted,
        "valid_project_rows": len(valid_records),
        "summary_rows_removed": summary_rows_removed,
        "header_rows_removed": header_rows_removed,
        "duplicate_rows_detected": duplicate_rows_detected,
        "invalid_rows": invalid_rows,
        "records_with_missing_fields": missing_fields_count,
    }

    # Step 7: Consolidate into canonical dataset (one record per unique project_id)
    canonical_records, canonical_metrics = consolidate_canonical_records(valid_records, total_rows_extracted, report_month=report_month)

    return {
        "success": True,
        "report_month": report_month,
        "total_pages": total_pages,
        "pages_with_text": pages_with_text,
        "records_extracted": len(valid_records),
        "records": valid_records,
        "canonical_records": canonical_records,
        "canonical_metrics": canonical_metrics,
        "validation_report": validation_report,
        "preview": {
            "tables_detected": tables_found_count,
            "text_sample": sample_text,
            "sample_records": canonical_records[:20],
        },
    }


def get_source_section(page_num: int) -> str:
    """Map page number to official Flash Report report sections."""
    if 9 <= page_num <= 22:
        return "Top Projects Overview"
    elif 34 <= page_num <= 35:
        return "Table 3 Completed Projects"
    elif 36 <= page_num <= 39:
        return "Table 4 Newly Added Projects"
    elif 40 <= page_num <= 53:
        return "Table 5 North Eastern Region"
    elif 54 <= page_num <= 162:
        return "Table 6 All Ongoing Projects"
    return "Flash Report Register"


def consolidate_canonical_records(
    records: List[Dict[str, Any]], total_raw_rows: int, report_month: str = "2026-04"
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Group valid project records by normalized project_id, consolidating records that
    appear across multiple report sections while preserving all source sections and pages.
    """
    pid_groups: Dict[str, List[Dict[str, Any]]] = {}
    for r in records:
        pid = re.sub(r"\s+", "", str(r["project_id"])).strip()
        if pid not in pid_groups:
            pid_groups[pid] = []
        pid_groups[pid].append(r)

    canonical_records: List[Dict[str, Any]] = []
    multi_section_count = 0

    for pid, entries in pid_groups.items():
        sections = sorted(list(set(e["source_section"] for e in entries)))
        pages = sorted(list(set(e["source_page"] for e in entries)))
        if len(entries) > 1 or len(sections) > 1:
            multi_section_count += 1

        # Sort entries prioritizing detailed register (Table 6/5) over summary overviews
        entries_sorted = sorted(
            entries,
            key=lambda x: (
                0 if "Table 6" in x.get("source_section", "") else
                1 if "Table 5" in x.get("source_section", "") else
                2 if "Table 4" in x.get("source_section", "") else
                3 if "Table 3" in x.get("source_section", "") else 4
            ),
        )

        # If any entry has actual_completion_date (e.g. Table 3 Completed Projects), prioritize its completion dates
        completed_entries = [e for e in entries if e.get("actual_completion_date")]
        if completed_entries:
            comp = completed_entries[0]
            orig_doc_val = comp.get("original_completion_date") or next((e["original_completion_date"] for e in entries_sorted if e.get("original_completion_date")), "")
            rev_doc_val = comp.get("revised_completion_date") or next((e["revised_completion_date"] for e in entries_sorted if e.get("revised_completion_date")), "")
            actual_doc_val = comp.get("actual_completion_date", "")
        else:
            orig_doc_val = next((e["original_completion_date"] for e in entries_sorted if e.get("original_completion_date")), "")
            rev_doc_val = next((e["revised_completion_date"] for e in entries_sorted if e.get("revised_completion_date")), "")
            actual_doc_val = ""

        canon: Dict[str, Any] = {
            "project_id": pid,
            # Longest non-empty project name
            "project_name": max((e["project_name"] for e in entries if e["project_name"]), key=len),
            # Prioritized metadata
            "agency": next((e["agency"] for e in entries_sorted if e.get("agency")), ""),
            "ministry": next((e["ministry"] for e in entries_sorted if e.get("ministry")), ""),
            "sector": next((e["sector"] for e in entries_sorted if e.get("sector")), ""),
            "state": next((e["state"] for e in entries_sorted if e.get("state")), ""),
            # Dates
            "start_date": next((e["start_date"] for e in entries_sorted if e.get("start_date")), ""),
            "original_completion_date": orig_doc_val,
            "revised_completion_date": rev_doc_val,
            "actual_completion_date": actual_doc_val,
            # Costs & Progress (non-null official values)
            "original_cost": next((e["original_cost"] for e in entries_sorted if e.get("original_cost") is not None), None),
            "revised_cost": next((e["revised_cost"] for e in entries_sorted if e.get("revised_cost") is not None), None),
            "expenditure": next((e["expenditure"] for e in entries_sorted if e.get("expenditure") is not None), None),
            "physical_progress": next((e["physical_progress"] for e in entries_sorted if e.get("physical_progress") is not None), None),
            "report_month": report_month,
            "source_page": pages[0],
            "source_pages": pages,
            "source_section": ", ".join(sections),
        }
        canonical_records.append(canon)

    # Missing fields among canonical records (where revised_cost, exp, or progress is None)
    canonical_missing_count = sum(
        1 for c in canonical_records if c["revised_cost"] is None or c["expenditure"] is None or c["physical_progress"] is None
    )

    canonical_metrics = {
        "raw_rows": total_raw_rows,
        "valid_project_rows": len(records),
        "unique_project_count": len(canonical_records),
        "projects_appearing_in_multiple_sections": multi_section_count,
        "projects_with_missing_fields": canonical_missing_count,
    }

    return canonical_records, canonical_metrics
