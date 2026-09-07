import sqlite3

conn = sqlite3.connect('backend/infrastructure_projects.sqlite3')
cur = conn.cursor()

print("--- TABLES AND INDEXES ---")
for row in cur.execute("SELECT type, name, sql FROM sqlite_master WHERE name LIKE '%project_manager%' OR name LIKE '%infrastructure_projects%' OR name = 'users'"):
    print(row[0], row[1])
    print(row[2])
    print("-" * 40)

print("--- CURRENT ASSIGNMENTS ---")
cur.execute("SELECT id, user_id, project_id, status FROM project_manager_assignments")
for r in cur.fetchall():
    print(r)
conn.close()
