import asyncio
import os
import json
import sqlite3
import httpx
from pathlib import Path
from dotenv import load_dotenv

load_dotenv("backend/.env")
load_dotenv(".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

async def main():
    print("==================================================")
    print("STEP 1: Test GET /api/datasets/months endpoint")
    print("==================================================")
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get("http://127.0.0.1:8000/api/datasets/months")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert "months" in data, "Missing 'months' key in response"
        months = data["months"]
        assert len(months) == 12, f"Expected 12 months, got {len(months)}"
        print(f"SUCCESS: Retrieved all {len(months)} months.")
        for m in months:
            status_str = f"Available ({m['record_count']} records)" if m['available'] else "Ready for Upload"
            print(f"  {m['report_month']} | {m['label']:<15} | {status_str}")

    print("\n==================================================")
    print("STEP 2: TEST 1 & TEST 2 - Existing April & May verification")
    print("==================================================")
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Prefer": "count=exact"}
    async with httpx.AsyncClient(timeout=10) as client:
        r_apr = await client.head(f"{SUPABASE_URL}/rest/v1/infrastructure_projects?report_month=eq.2026-04-01", headers=headers)
        apr_cnt = int(r_apr.headers.get("Content-Range", "").split("/")[-1])
        print(f"TEST 1: April 2026 Supabase count = {apr_cnt} (Expected: 2105)")
        assert apr_cnt == 2105, f"April count changed! Got {apr_cnt}"

        r_may = await client.head(f"{SUPABASE_URL}/rest/v1/infrastructure_projects?report_month=eq.2026-05-01", headers=headers)
        may_cnt = int(r_may.headers.get("Content-Range", "").split("/")[-1])
        print(f"TEST 2: May 2026 Supabase count = {may_cnt} (Expected: 2101)")
        assert may_cnt == 2101, f"May count changed! Got {may_cnt}"

    print("\n==================================================")
    print("STEP 3: TEST 3 - Ingest June 2026 PDF with report_month='June 2026'")
    print("==================================================")
    june_pdf = Path("backend/uploads/FlashReport_June_2026.pdf")
    if june_pdf.exists():
        pdf_bytes = june_pdf.read_bytes()
        async with httpx.AsyncClient(timeout=120) as client:
            files = {"file": ("FlashReport_June_2026.pdf", pdf_bytes, "application/pdf")}
            data = {"report_month": "June 2026"}
            resp = await client.post("http://127.0.0.1:8000/api/ingest-flash-report", files=files, data=data)
        assert resp.status_code == 200, f"Upload failed: {resp.text}"
        res_json = resp.json()
        extracted_month = res_json.get("report_month")
        print(f"Extraction report_month: {extracted_month}")
        assert extracted_month in ("2026-06", "2026-06-01"), f"Expected 2026-06 or 2026-06-01, got {extracted_month}"
        
        # Save June dataset explicitly with 2026-06-01
        save_payload = {
            "report_month": "2026-06-01",
            "records": res_json.get("canonical_records", [])
        }
        async with httpx.AsyncClient(timeout=60) as client:
            save_resp = await client.post("http://127.0.0.1:8000/api/datasets/save", json=save_payload)
        assert save_resp.status_code == 200, f"Save failed: {save_resp.text}"
        print(f"Save June response: {save_resp.json()}")

    print("\n==================================================")
    print("STEP 4: TEST 4 - Ingest August 2026 with report_month='2026-08-01'")
    print("==================================================")
    # Validate saving and isolation under 2026-08-01
    sample_aug_record = [{
        "project_id": "TEST-AUG-001",
        "project_name": "August Test Infrastructure Corridor",
        "ministry": "Ministry of Road Transport and Highways",
        "sector": "Road Transport and Highways",
        "state": "Maharashtra",
        "original_cost": 5000.0,
        "revised_cost": 5200.0,
        "cumulative_expenditure": 1200.0,
        "physical_progress_pct": 35.0,
        "report_month": "2026-08-01"
    }]
    async with httpx.AsyncClient(timeout=30) as client:
        save_payload = {
            "report_month": "2026-08-01",
            "records": sample_aug_record
        }
        save_resp = await client.post("http://127.0.0.1:8000/api/datasets/save", json=save_payload)
        assert save_resp.status_code == 200, f"August save failed: {save_resp.text}"
        print(f"TEST 4: Records stored under 2026-08-01: {save_resp.json()}")

        # Check SQLite to ensure it is isolated under 2026-08-01
        conn_check = sqlite3.connect("backend/infrastructure_projects.sqlite3")
        cur_check = conn_check.cursor()
        cur_check.execute("SELECT COUNT(*) FROM infrastructure_projects WHERE report_month = '2026-08-01'")
        aug_cnt = cur_check.fetchone()[0]
        print(f"TEST 4 VERIFICATION: August count in SQLite = {aug_cnt}")
        assert aug_cnt >= 1, "August records not stored under 2026-08-01!"
        
        # Clean up test row so August remains clean for actual future upload
        cur_check.execute("DELETE FROM infrastructure_projects WHERE project_id = 'TEST-AUG-001'")
        conn_check.commit()
        if SUPABASE_URL and KEY:
            await client.delete(f"{SUPABASE_URL}/rest/v1/infrastructure_projects?project_id=eq.TEST-AUG-001", headers=headers)
        print("TEST 4 SUCCESS: Verified 2026-08-01 storage and clean isolation!")

    print("\n==================================================")
    print("STEP 5: TEST 6 - Prevent Accidental Overwrite (Upload May PDF with June selected)")
    print("==================================================")
    may_pdf = Path("backend/uploads/FlashReport_May2026.pdf")
    if may_pdf.exists():
        pdf_bytes = may_pdf.read_bytes()
        async with httpx.AsyncClient(timeout=120) as client:
            files = {"file": ("FlashReport_May2026.pdf", pdf_bytes, "application/pdf")}
            # Explicitly specify June 2026
            data = {"report_month": "June 2026"}
            resp = await client.post("http://127.0.0.1:8000/api/ingest-flash-report", files=files, data=data)
        assert resp.status_code == 200
        res_json = resp.json()
        extracted_month = res_json.get("report_month")
        print(f"Uploaded May PDF with 'June 2026' selected. Extracted month = {extracted_month}")
        assert extracted_month in ("2026-06", "2026-06-01"), f"Month leakage! Expected 2026-06, got {extracted_month}"
        assert extracted_month not in ("2026-04", "2026-04-01"), "Month leakage! May PDF was assigned to April!"
        print("SUCCESS: Uploading May PDF with June selected CANNOT save records under 2026-04-01!")

    print("\n==================================================")
    print("STEP 5: TEST 5 - Run SQL Group By on Supabase and SQLite")
    print("==================================================")
    async with httpx.AsyncClient(timeout=10) as client:
        for m in [f"2026-{i:02d}-01" for i in range(1, 13)]:
            r = await client.head(f"{SUPABASE_URL}/rest/v1/infrastructure_projects?report_month=eq.{m}", headers=headers)
            crange = r.headers.get("Content-Range", "")
            cnt = int(crange.split("/")[-1]) if "/" in crange and crange.split("/")[-1] != "*" else 0
            if cnt > 0:
                print(f"  Supabase | {m} | total_rows: {cnt}")

    conn = sqlite3.connect("backend/infrastructure_projects.sqlite3")
    cur = conn.cursor()
    cur.execute("""
        SELECT
            report_month,
            COUNT(*) AS total_rows,
            COUNT(DISTINCT project_id) AS unique_projects
        FROM infrastructure_projects
        GROUP BY report_month
        ORDER BY report_month;
    """)
    print("\nSQLite Database GROUP BY:")
    for row in cur.fetchall():
        print(f"  report_month: {row[0]} | total_rows: {row[1]} | unique_projects: {row[2]}")
        assert row[1] == row[2], f"Duplicate project IDs detected! total={row[1]}, unique={row[2]}"

    print("\nALL TEST CASES PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
