import asyncio
import sqlite3
import httpx
import os
import json
from dotenv import load_dotenv
from db import update_completed_projects_actual_dates, rebuild_ml_training_dataset, get_ml_training_statistics

load_dotenv("backend/.env")
load_dotenv(".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

async def run():
    print("==================================================")
    print("STEP 1: Updating Completed Projects Actual Dates...")
    print("==================================================")
    update_res = await update_completed_projects_actual_dates()
    print("Update Result:", json.dumps(update_res, indent=2))

    print("\n==================================================")
    print("STEP 2: Rebuilding ml_training_dataset...")
    print("==================================================")
    rebuild_res = await rebuild_ml_training_dataset()
    print("Rebuild Result (summary):", {k: v for k, v in rebuild_res.items() if k != "stats"})

    print("\n==================================================")
    print("STEP 3: SQL Verification on infrastructure_projects (SQLite)")
    print("==================================================")
    conn = sqlite3.connect("backend/infrastructure_projects.sqlite3")
    cur = conn.cursor()
    cur.execute("""
        SELECT
            COUNT(*) AS total_rows,
            COUNT(NULLIF(TRIM(actual_completion_date), '')) AS actual_date_rows,
            COUNT(NULLIF(TRIM(original_completion_date), '')) AS original_date_rows,
            COUNT(NULLIF(TRIM(revised_completion_date), '')) AS revised_date_rows
        FROM infrastructure_projects;
    """)
    totals = cur.fetchone()
    print(f"Total Rows:          {totals[0]}")
    print(f"Actual Date Rows:    {totals[1]}")
    print(f"Original Date Rows:  {totals[2]}")
    print(f"Revised Date Rows:   {totals[3]}")

    print("\nBreakdown by report_month:")
    cur.execute("""
        SELECT
            report_month,
            COUNT(*) AS total_rows,
            COUNT(NULLIF(TRIM(actual_completion_date), '')) AS actual_date_rows,
            COUNT(NULLIF(TRIM(original_completion_date), '')) AS original_date_rows,
            COUNT(NULLIF(TRIM(revised_completion_date), '')) AS revised_date_rows
        FROM infrastructure_projects
        GROUP BY report_month
        ORDER BY report_month;
    """)
    for r in cur.fetchall():
        print(f"  {r[0]} | Total: {r[1]:<5} | Actual: {r[2]:<3} | Orig: {r[3]:<5} | Rev: {r[4]:<5}")

    print("\n==================================================")
    print("STEP 4: Sample 20 projects with actual_completion_date")
    print("==================================================")
    cur.execute("""
        SELECT
            project_id,
            project_name,
            original_completion_date,
            revised_completion_date,
            actual_completion_date,
            report_month,
            source_section
        FROM infrastructure_projects
        WHERE actual_completion_date IS NOT NULL
          AND TRIM(actual_completion_date) <> ''
        LIMIT 20;
    """)
    sample_rows = cur.fetchall()
    print(f"Retrieved {len(sample_rows)} sample rows:")
    for idx, r in enumerate(sample_rows):
        print(f"[{idx+1:02d}] {r[0]:<20} | month={r[5]} | orig={str(r[2]):<7} | rev={str(r[3]):<7} | act={str(r[4]):<7} | sec={r[6]} | {r[1][:40]}")

    print("\n==================================================")
    print("STEP 5: ML Training Dataset Metrics (Task Requirement 16)")
    print("==================================================")
    stats = await get_ml_training_statistics()
    print(f"Number of rows with valid actual completion dates: {stats['rows_with_valid_actual_date']}")
    print(f"Number of valid time-training records:             {stats['valid_time_training_records']}")
    print(f"Number of time-overrun projects:                   {stats['time_overrun_projects']}")
    print(f"Number of valid cost-training records:             {stats['valid_cost_training_records']}")
    print(f"Number of cost-overrun projects:                   {stats['cost_overrun_projects']}")

    print("\nSample 10 rows from ml_training_dataset with actual dates:")
    cur.execute("""
        SELECT
            project_id,
            original_cost,
            revised_cost,
            cost_overrun_pct,
            cost_overrun,
            original_completion_date,
            actual_completion_date,
            delay_months,
            time_overrun
        FROM ml_training_dataset
        WHERE actual_completion_date IS NOT NULL
          AND TRIM(actual_completion_date) <> ''
        LIMIT 10;
    """)
    for r in cur.fetchall():
        print(f"  pid={r[0]:<20} | orig_cost={r[1]} | rev_cost={r[2]} | cost_pct={r[3]}% | cost_ovr={r[4]} | orig_d={r[5]} | act_d={r[6]} | delay_mo={r[7]} | time_ovr={r[8]}")

    conn.close()

    if SUPABASE_URL and KEY:
        print("\n==================================================")
        print("STEP 6: Supabase Verification")
        print("==================================================")
        headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Prefer": "count=exact"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            r_all = await client.head(f"{SUPABASE_URL}/rest/v1/infrastructure_projects", headers=headers)
            print("Supabase infrastructure_projects total:", r_all.headers.get("Content-Range"))

            r_act = await client.head(f"{SUPABASE_URL}/rest/v1/infrastructure_projects?actual_completion_date=not.is.null&actual_completion_date=neq.", headers=headers)
            print("Supabase infrastructure_projects actual_date rows:", r_act.headers.get("Content-Range"))

            r_ml = await client.head(f"{SUPABASE_URL}/rest/v1/ml_training_dataset", headers=headers)
            print("Supabase ml_training_dataset total:", r_ml.headers.get("Content-Range"))

            r_ml_act = await client.head(f"{SUPABASE_URL}/rest/v1/ml_training_dataset?delay_months=not.is.null", headers=headers)
            print("Supabase ml_training_dataset with delay_months:", r_ml_act.headers.get("Content-Range"))

if __name__ == "__main__":
    asyncio.run(run())
