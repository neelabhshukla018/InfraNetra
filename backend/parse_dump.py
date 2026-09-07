import json

with open('backend/all_users_dump.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"=== SUPABASE USERS ({len(data['supabase'])}) ===")
for u in data['supabase']:
    print(f"ID={u.get('id'):<3} | user={u.get('username',''):<25} | email={u.get('email',''):<35} | name={u.get('full_name',''):<30} | role={u.get('role',''):<15} | status={u.get('status',''):<10} | min={u.get('ministry')} | proj={u.get('project_id')}")

print(f"\n=== SQLITE USERS ({len(data['sqlite'])}) ===")
for u in data['sqlite']:
    print(f"ID={u.get('id'):<3} | user={u.get('username',''):<25} | email={u.get('email',''):<35} | name={u.get('full_name',''):<30} | role={u.get('role',''):<15} | status={u.get('status',''):<10} | min={u.get('ministry')} | proj={u.get('project_id')}")
