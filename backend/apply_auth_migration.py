"""
Apply additive authentication, assignments, daily updates, and audit logging schema to SQLite database.
Seeds default administrator account securely with hashed password.
"""

import os
import sqlite3
from pathlib import Path
from auth import hash_password, record_audit_log

BASE_DIR = Path(__file__).resolve().parent
SQLITE_DB_PATH = BASE_DIR / "infrastructure_projects.sqlite3"
SCHEMA_PATH = BASE_DIR / "schema_auth.sql"


def apply_migration():
    print(f"Connecting to database: {SQLITE_DB_PATH}...")
    conn = sqlite3.connect(SQLITE_DB_PATH)
    cur = conn.cursor()

    # 1. Execute additive schema SQL
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    cur.executescript(schema_sql)
    conn.commit()
    print("Additive schema tables and indexes successfully created.")

    # 2. Seed default Administrator if no admin exists
    cur.execute("SELECT id FROM users WHERE role = 'ADMIN';")
    admin_row = cur.fetchone()
    if not admin_row:
        admin_username = "admin"
        admin_initial_pwd = os.environ.get("ADMIN_INITIAL_PASSWORD", "Admin@InfraNetra2026")
        pwd_hash, salt = hash_password(admin_initial_pwd)
        cur.execute("""
            INSERT INTO users (
                username, password_hash, salt, full_name, email,
                phone, designation, role, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            admin_username,
            pwd_hash,
            salt,
            "Dr. Rajeshwar Sharma, IAS",
            "r.sharma@mospi.gov.in",
            "+91-11-23340001",
            "MoSPI Joint Secretary & Platform Admin",
            "ADMIN",
            "APPROVED"
        ))
        conn.commit()
        admin_id = cur.lastrowid
        print(f"Default Administrator account initialized: username='{admin_username}', status='APPROVED'.")

        record_audit_log(
            actor_id=admin_id,
            actor_username=admin_username,
            actor_role="ADMIN",
            action="INITIALIZE_ADMIN_ACCOUNT",
            target_type="USER",
            target_id=str(admin_id),
            details="System bootstrap created primary administrative officer account.",
            result="SUCCESS"
        )
    else:
        print("Administrator account already exists. Skipping seed.")

    # Verify tables
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [r[0] for r in cur.fetchall()]
    print("All SQLite tables now in database:", tables)

    conn.close()
    print("Migration and verification complete.")


if __name__ == "__main__":
    apply_migration()
