import json

with open('diagnostic_report.json') as f:
    d = json.load(f)

supa_users = {u['id']: u for u in d['supabase']['users']}
supa_updates = d['supabase']['daily_project_updates']

overlapping_user_ids = set(up['manager_user_id'] for up in supa_updates if up['manager_user_id'] in supa_users)
print('Supabase overlapping user IDs count:', len(overlapping_user_ids))
print('Overlapping user IDs:', sorted(list(overlapping_user_ids)))
for uid in sorted(list(overlapping_user_ids)):
    u = supa_users[uid]
    print(f"User {uid}: username={u['username']}, role={u['role']}, status={u['status']}, name={u['full_name']}")

print('\nTotal daily updates in Supabase:', len(supa_updates))
manager_counts = {}
for up in supa_updates:
    mid = up['manager_user_id']
    manager_counts[mid] = manager_counts.get(mid, 0) + 1
print('Update counts per manager:', manager_counts)
