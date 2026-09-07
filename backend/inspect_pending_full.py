import sys
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from main import app
from fastapi.testclient import TestClient
import os

client = TestClient(app)

admin_user = os.environ.get("ADMIN_USERNAME", "LOG_bit").strip()
admin_pass = os.environ.get("ADMIN_PASSWORD", "LOG_bit_26103").strip()

login_res = client.post('/api/auth/login/admin', json={'username': admin_user, 'password': admin_pass})
token = login_res.json().get('token')

headers = {'Authorization': f'Bearer {token}'}
r = client.get('/api/admin/approvals/pending', headers=headers)
data = r.json()

print(f"Total pending_users: {len(data.get('pending_users', []))}")
print(f"Total ministries: {len(data.get('ministries', []))}")
print(f"Total managers: {len(data.get('managers', []))}")

print("\n--- PENDING MINISTRY REGISTRATIONS ---")
for m in data.get('ministries', []):
    print(f"ID={m.get('id')} | user={m.get('username')} | name={m.get('full_name')} | email={m.get('email')} | ministry={m.get('assigned_ministry') or m.get('ministry')}")

print("\n--- PENDING PROJECT MANAGER REGISTRATIONS ---")
for pm in data.get('managers', []):
    print(f"ID={pm.get('id')} | user={pm.get('username')} | name={pm.get('full_name')} | email={pm.get('email')} | project_id={pm.get('project_id') or pm.get('assigned_project_code')} | name={pm.get('project_name')}")
