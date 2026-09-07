import sqlite3
from pathlib import Path

db_path = Path(__file__).resolve().parent / "infrastructure_projects.sqlite3"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# 1. Add department column if not present
cols = [r["name"] for r in cur.execute("PRAGMA table_info(users)").fetchall()]
if "department" not in cols:
    cur.execute("ALTER TABLE users ADD COLUMN department TEXT;")
    print("Added 'department' column to users table.")

# 2. Update Admin record with authoritative department
cur.execute("""
    UPDATE users
    SET department = 'Infrastructure and Project Monitoring Division (IPMD), MoSPI'
    WHERE role = 'ADMIN';
""")

# 3. Create unique index for exactly one admin if not present
cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_single_admin ON users(role) WHERE role = 'ADMIN';")

conn.commit()

# Print admin row details
admin_row = cur.execute("SELECT id, username, full_name, email, designation, department, role, status FROM users WHERE role = 'ADMIN';").fetchone()
print("Authoritative Admin Record:", dict(admin_row))

admin_count = cur.execute("SELECT COUNT(*) FROM users WHERE role = 'ADMIN';").fetchone()[0]
print("Total Admin Count in Database:", admin_count)

conn.close()
