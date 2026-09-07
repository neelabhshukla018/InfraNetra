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
print('Admin login status:', login_res.status_code)

if token:
    headers = {'Authorization': f'Bearer {token}'}
    r = client.get('/api/admin/approvals/pending', headers=headers)
    print('Approvals status:', r.status_code)
    data = r.json()
    pending = data.get('pending_users', []) if isinstance(data, dict) else data
    print(f'Total requests in Admin Role Approvals queue: {len(pending)}\n')
    for i, a in enumerate(pending, 1):
        print(f"[{i:02d}] ID={a.get('id')} | user={a.get('username')} | name={a.get('full_name')} | email={a.get('email')} | role={a.get('role')} | status={a.get('status')} | ministry={a.get('assigned_ministry') or a.get('ministry')} | proj={a.get('assigned_project_code') or a.get('project_id')}")
