import sys
import os
import json
import pymupdf

sys.stdout.reconfigure(encoding='utf-8')

pdf_path = "backend/uploads/FlashReport_April2026.pdf"
doc = pymupdf.open(pdf_path)
print(f"Opened PDF with {len(doc)} pages", flush=True)

summary_tables = []
project_tables = []
other_tables = []

for p in range(len(doc)):
    page = doc[p]
    tabs = page.find_tables().tables
    if p % 20 == 0:
        print(f"Processing page {p+1}/{len(doc)}...", flush=True)
    for t_idx, tab in enumerate(tabs):
        rows = tab.extract()
        if not rows:
            continue
        hdr_cells = [str(c).replace('\n', ' ').strip().lower() for c in rows[0] if c]
        hdr_str = ' | '.join(hdr_cells)
        
        is_summary = (
            'project count' in hdr_str or 
            'sector name' in hdr_str or 
            'state name' in hdr_str or
            'allocated to' in hdr_str
        )
        
        is_project = (
            not is_summary and 
            'project name' in hdr_str and
            ('state' in hdr_str or 'cost' in hdr_str)
        )
        
        item = {
            "page": p + 1,
            "table_index": t_idx,
            "num_rows": len(rows),
            "num_cols": len(rows[0]),
            "header": hdr_str[:100]
        }
        if is_summary:
            summary_tables.append(item)
        elif is_project:
            project_tables.append(item)
        else:
            other_tables.append(item)

print(f"\nDone! Results:", flush=True)
print(f"Summary tables: {len(summary_tables)}", flush=True)
print(f"Project tables: {len(project_tables)}", flush=True)
print(f"Other tables: {len(other_tables)}", flush=True)

project_pages = sorted(list(set(t["page"] for t in project_tables)))
print(f"Pages containing project tables ({len(project_pages)} pages):", flush=True)
print(f"First 10 pages: {project_pages[:10]}", flush=True)
print(f"Last 10 pages: {project_pages[-10:]}", flush=True)

with open("backend/audit_results.json", "w", encoding="utf-8") as f:
    json.dump({
        "summary_tables": summary_tables,
        "project_tables": project_tables,
        "other_tables": other_tables,
        "project_pages": project_pages
    }, f, indent=2)

print("Saved audit_results.json", flush=True)
