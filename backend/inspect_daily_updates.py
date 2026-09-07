import sqlite3
import json
from pathlib import Path
from auth_supabase import _supa_request, is_supabase_auth_ready

backend_dir = Path("d:/InfraNetra/backend")

# 1. Inspect SQLite daily_project_updates
conn = sqlite3.connect(backend_dir / "infrastructure_projects.sqlite3")
cur = conn.cursor()
cur.execute("SELECT id, project_id, manager_user_id, update_date, today_physical_progress, cumulative_physical_progress, today_expenditure, cumulative_expenditure, milestone_status, current_milestone, issues_risks, remarks, created_at FROM daily_project_updates;")
sq_updates = [
    {
        "id": r[0], "project_id": r[1], "manager_user_id": r[2], "update_date": r[3],
        "today_phys": r[4], "cum_phys": r[5], "today_exp": r[6], "cum_exp": r[7],
        "milestone_status": r[8], "current_milestone": r[9], "issues_risks": r[10],
        "remarks": r[11], "created_at": r[12]
    }
    for r in cur.fetchall()
]
conn.close()

# 2. Inspect Supabase daily_project_updates
sb_updates = []
if is_supabase_auth_ready():
    st, data = _supa_request("GET", "/rest/v1/daily_project_updates?select=*&order=id.asc")
    if isinstance(data, list):
        sb_updates = data

print(f"Total SQLite daily_project_updates: {len(sq_updates)}")
print(f"Total Supabase daily_project_updates: {len(sb_updates)}")

print("\n--- SAMPLE SQLITE DAILY UPDATES ---")
for u in sq_updates[:10]:
    print(u)

print("\n--- SAMPLE SUPABASE DAILY UPDATES ---")
for u in sb_updates[:10]:
    print(u)

# Check unique project_ids and remarks/milestones
print("\nUnique project_ids in SQLite daily updates:", set(u["project_id"] for u in sq_updates))
print("Unique project_ids in Supabase daily updates:", set(u["project_id"] for u in sb_updates))

print("Unique manager_user_ids in SQLite daily updates:", sorted(list(set(u["manager_user_id"] for u in sq_updates))))
print("Unique manager_user_ids in Supabase daily updates:", sorted(list(set(u["manager_user_id"] for u in sb_updates))))
