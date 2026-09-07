import json

with open("backend/canonical_results.json", "r", encoding="utf-8") as f:
    d = json.load(f)

records = d["canonical_records"]

# Select 20 representative canonical records
multi_sec = [r for r in records if len(r.get("source_pages", [])) > 1]
t3 = [r for r in records if "Table 3" in r.get("source_section", "")]
t4 = [r for r in records if "Table 4" in r.get("source_section", "")]
t5 = [r for r in records if "Table 5" in r.get("source_section", "")]
t6 = [r for r in records if "Table 6" in r.get("source_section", "") and len(r.get("source_pages", [])) == 1]

selected = (
    multi_sec[:6] +    # Multi-section consolidated projects
    t3[:2] +           # Completed projects
    t4[:3] +           # Newly added projects
    t5[:3] +           # North Eastern Region
    t6[:6]             # General ongoing projects from Table 6
)[:20]

with open("backend/sample_20_canonical.json", "w", encoding="utf-8") as out:
    json.dump(selected, out, indent=2, ensure_ascii=False)

print(f"Successfully selected {len(selected)} canonical records.")
for i, r in enumerate(selected, 1):
    print(f"{i}. ID: {r['project_id']} | Name: {r['project_name'][:35]} | Sec: {r['source_section']} | Pages: {r['source_pages']} | Cost: {r['original_cost']}/{r['revised_cost']} | Exp: {r['expenditure']} | Prog: {r['physical_progress']}%")
