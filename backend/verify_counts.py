import json

with open('backend/test_data_candidates_report.json', 'r', encoding='utf-8') as f:
    report = json.load(f)

print(f"Pending queue candidates: {len(report['pending_queue'])}")
print(f"Other ministry tests: {len(report['other_ministry_tests'])}")
print(f"PM tests: {len(report['pm_tests'])}")
print(f"Archived test records: {len(report['archived'])}")
total_test = len(report['pending_queue']) + len(report['other_ministry_tests']) + len(report['pm_tests']) + len(report['archived'])
print(f"Total test/demo candidates: {total_test}")
