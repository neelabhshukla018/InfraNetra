import json

with open('backend/classified_candidates.json', 'r', encoding='utf-8') as f:
    classified = json.load(f)

print(f"Total candidates: {len(classified)}")

group_pending_queue = []
group_other_ministry_tests = []
group_pm_tests = []
group_archived = []
group_genuine = []
group_admin = []

for c in classified:
    cat = c['category']
    uname = c['username']
    role = c['role']
    status = c['status']

    if cat == 'REAL_ADMIN':
        group_admin.append(c)
    elif cat == 'GENUINE_USER':
        group_genuine.append(c)
    else:
        # Test/Demo candidate
        if uname.startswith('archived_user_'):
            group_archived.append(c)
        elif status == 'PENDING' and role == 'MINISTRY':
            group_pending_queue.append(c)
        elif role == 'MINISTRY':
            group_other_ministry_tests.append(c)
        elif role == 'PROJECT_MANAGER':
            group_pm_tests.append(c)
        else:
            group_other_ministry_tests.append(c)

print(f"1. Admin (Protect): {len(group_admin)}")
print(f"2. Genuine Non-Admin (Protect): {len(group_genuine)}")
print(f"3. Active Admin Approvals Queue Candidates: {len(group_pending_queue)}")
print(f"4. Other Ministry Test Records: {len(group_other_ministry_tests)}")
print(f"5. PM Test Records: {len(group_pm_tests)}")
print(f"6. Archived Test Placeholders: {len(group_archived)}")

report = {
    "admin": group_admin,
    "genuine": group_genuine,
    "pending_queue": group_pending_queue,
    "other_ministry_tests": group_other_ministry_tests,
    "pm_tests": group_pm_tests,
    "archived": group_archived,
}

with open('backend/test_data_candidates_report.json', 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2)

print("\n--- PENDING QUEUE CANDIDATES ---")
for x in group_pending_queue:
    print(f"ID={x['id']} | {x['username']} | {x['full_name']} | {x['email']} | {x['ministry']} | reasons: {', '.join(x['reasons'])}")

print("\n--- GENUINE ACCOUNTS IDENTIFIED (TO KEEP) ---")
for x in group_genuine:
    print(f"ID={x['id']} | {x['username']} | {x['full_name']} | {x['email']} | role={x['role']} | status={x['status']}")
