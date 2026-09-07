import sys
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from inspect_candidates import inspect_sqlite, inspect_supabase

sqlite_users = inspect_sqlite()
supabase_users = inspect_supabase()

print("Admin in SQLite:", [u['username'] for u in sqlite_users if u['role'] == 'ADMIN'])
print("Admin in Supabase:", [u['username'] for u in supabase_users if u['role'] == 'ADMIN'])

print("\nGenuine users in SQLite:")
for u in sqlite_users:
    uname = u['username'].lower()
    if 'test' not in uname and not uname.startswith('clerk_') and not uname.startswith('archived_') and not uname.startswith('pd_') and not uname.startswith('e2e_') and u['role'] != 'ADMIN':
        print(f"  ID={u['id']} | user={u['username']} | role={u['role']} | status={u['status']}")

print("\nGenuine users in Supabase:")
for u in supabase_users:
    uname = u['username'].lower()
    if 'test' not in uname and not uname.startswith('clerk_') and not uname.startswith('archived_') and not uname.startswith('pd_') and not uname.startswith('e2e_') and u['role'] != 'ADMIN':
        print(f"  ID={u['id']} | user={u['username']} | role={u['role']} | status={u['status']}")
