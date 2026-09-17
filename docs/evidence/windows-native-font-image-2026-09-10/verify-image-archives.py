"""Independent ZIP/XML/relationship and source PNG CRC checks, no Office calls."""
import base64
import hashlib
import json
import posixpath
import struct
import zlib
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

root = Path(__file__).resolve().parent
paths = ["raw/images-native-node24-01/images-fit.pptx", "raw/images-native-node24-02/images-fit.pptx",
         "raw/image-open-opf-png/source.pptx", "raw/image-open-vendor-png/source.pptx"]
records = []
for path in paths:
    file = root / path
    with ZipFile(file) as archive:
        assert archive.testzip() is None
        entries = set(archive.namelist())
        xml_parts = relationships = 0
        for name in entries:
            if not (name.endswith(".xml") or name.endswith(".rels")):
                continue
            tree = ET.fromstring(archive.read(name))
            xml_parts += 1
            if name.endswith(".rels"):
                base = posixpath.dirname(name).replace("/_rels", "")
                if base == "_rels":
                    base = ""
                for relation in tree:
                    if relation.get("TargetMode") == "External":
                        continue
                    target = relation.get("Target")
                    resolved = target[1:] if target.startswith("/") else posixpath.normpath(posixpath.join(base, target))
                    assert resolved in entries, (name, resolved)
                    relationships += 1
        records.append({"file": path, "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
                        "xmlPartsParsed": xml_parts, "internalRelationshipsResolved": relationships, "zipCrcPassed": True})
source = json.loads((root / "raw/images-native-node24-02/images-fit.opf.json").read_text())
pngs = []
for slide in source["slides"][:3]:
    data = base64.b64decode(slide["image"]["src"].split(",")[1])
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    at = 8
    chunks = 0
    while at < len(data):
        length = struct.unpack(">I", data[at:at+4])[0]
        block = data[at+4:at+8+length]
        expected = struct.unpack(">I", data[at+8+length:at+12+length])[0]
        assert zlib.crc32(block) == expected
        at += length + 12
        chunks += 1
    assert at == len(data)
    pngs.append({"name": slide["image"]["alt"], "chunks": chunks, "crcPassed": True})
print(json.dumps({"archives": records, "sourcePngs": pngs,
                  "scope": "Structural checks do not establish Office acceptance or internal failure cause."}, indent=2))
