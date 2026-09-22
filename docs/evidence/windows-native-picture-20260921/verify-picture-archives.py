"""Independent standard-library archive/XML checks; no Office automation."""
import hashlib
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile


def sha(data):
    return hashlib.sha256(data).hexdigest()


rows = []
for supplied in sys.argv[2:]:
    file = Path(supplied).resolve()
    raw = file.read_bytes()
    row = {"path": str(file), "sha256": sha(raw), "xmlParts": 0, "errors": [], "media": []}
    try:
        with zipfile.ZipFile(file) as archive:
            failed = archive.testzip()
            if failed:
                row["errors"].append("ZIP CRC failed: " + failed)
            for name in archive.namelist():
                if name.endswith((".xml", ".rels")):
                    ET.fromstring(archive.read(name))
                    row["xmlParts"] += 1
                if name.startswith("ppt/media/") and not name.endswith("/"):
                    row["media"].append({"name": name, "sha256": sha(archive.read(name))})
    except Exception as error:
        row["errors"].append(str(error))
    rows.append(row)

assert rows, "Provide at least one explicit PPTX path."
report = {
    "scope": "ZIP CRC and XML well-formedness through independent Python readers; no Open XML schema, native rendering or editability claim.",
    "python": sys.version,
    "verifierSha256": sha(Path(__file__).read_bytes()),
    "passed": all(not row["errors"] for row in rows),
    "files": rows,
}
Path(sys.argv[1]).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"passed": report["passed"], "files": len(rows)}))
sys.exit(0 if report["passed"] else 1)
