import sqlite3

def apply_index():
    con = sqlite3.connect("backend/infrastructure_projects.sqlite3")
    cur = con.cursor()
    cur.execute("DROP INDEX IF EXISTS idx_unique_active_pm;")
    cur.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_or_pending_pm 
        ON project_manager_assignments(project_id) 
        WHERE status IN ('ACTIVE', 'PENDING');
    """)
    con.commit()
    print("Index created/updated successfully!")
    cur.execute("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='project_manager_assignments';")
    for r in cur.fetchall():
        print("Index:", r)
    con.close()

if __name__ == "__main__":
    apply_index()
