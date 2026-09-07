import json

with open('backend/test_data_candidates_report.json', 'r', encoding='utf-8') as f:
    report = json.load(f)

def format_table(items):
    lines = [
        "| User ID | Username | Full Name | Email | Role | Status | Ministry | Linked PM Project | Origin / Reason |",
        "|---|---|---|---|---|---|---|---|---|"
    ]
    for x in items:
        uid = str(x.get('id', ''))
        uname = x.get('username', '')
        fname = x.get('full_name', '')
        email = x.get('email', '')
        role = x.get('role', '')
        status = x.get('status', '')
        ministry = str(x.get('ministry') or '-')
        proj = str(x.get('project_id') or '-')
        reasons = "; ".join(x.get('reasons', []))
        lines.append(f"| {uid} | `{uname}` | {fname} | `{email}` | {role} | {status} | {ministry} | {proj} | {reasons} |")
    return "\n".join(lines)

with open('backend/candidates_table.md', 'w', encoding='utf-8') as f:
    f.write("### GROUP 1: Pending Ministry Officers in Admin Approval Queue (Direct Cause of Issue)\n\n")
    f.write(format_table(report['pending_queue']))
    f.write("\n\n### GROUP 2: Other Test Ministry Officer Records (Non-Pending / Completed Tests)\n\n")
    f.write(format_table(report['other_ministry_tests']))
    f.write("\n\n### GROUP 3: Test Project Manager Records\n\n")
    f.write(format_table(report['pm_tests']))
    f.write("\n\n### GROUP 4: Archived Test User Placeholders\n\n")
    f.write(format_table(report['archived']))
    f.write("\n\n### PROTECTED REAL ACCOUNTS (WILL NOT BE DELETED)\n\n")
    f.write("#### Admin Account (Single Real Admin):\n\n")
    f.write(format_table(report['admin']))
    f.write("\n\n#### Genuine Non-Admin Accounts:\n\n")
    f.write(format_table(report['genuine']))

print("Generated backend/candidates_table.md")
