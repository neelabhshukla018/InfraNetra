import re
from pathlib import Path

api_ts_path = Path("d:/InfraNetra/src/services/api.ts")
content = api_ts_path.read_text(encoding="utf-8")

exports = re.findall(r"export\s+(?:async\s+)?(?:function|const)\s+([a-zA-Z0-9_]+)", content)
print("=== EXPORTS IN src/services/api.ts ===")
for exp in exports:
    print(f" - {exp}")

main_py_path = Path("d:/InfraNetra/backend/main.py")
main_content = main_py_path.read_text(encoding="utf-8")
routes = re.findall(r"@app\.(get|post|put|delete|patch)\([\"']([^\"']+)[\"']", main_content)
print("\n=== ROUTES IN backend/main.py ===")
for method, path in routes:
    print(f" - {method.upper()} {path}")
