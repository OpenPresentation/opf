"""Inspect an owned native tab-control PDF without extracting font programs.

Usage: python test/native-tab-pdf.py <fresh-control-directory>
Requires pdfplumber and pypdf. Keep the PDF private; publish only this report,
its raster, native observations and source hashes. PDF coordinates have their
own precision and do not replace the native 0.02 point acceptance gate.
"""
import hashlib
import json
import platform
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

import pdfplumber
import pypdf


def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


root = Path(sys.argv[1]).resolve(strict=True)
control = json.loads((root / "control.json").read_text(encoding="utf-8-sig"))
source = root / "private-native-proof.pdf"
pptx = root / "native-created-tabs.pptx"
assert sha(source) == control["privatePdfSha256"]
assert sha(pptx) == control["pptxSha256"]
created, reopened = control["observations"]
assert created["phase"] == "created" and reopened["phase"] == "reopened"
assert created["records"] == reopened["records"]
assert len(created["records"]) == 9
for phase in [created, reopened]:
    assert sha(root / (phase["phase"] + ".png")) == phase["pngSha256"]
assert created["pngSha256"] == reopened["pngSha256"]
ns = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "p": "http://schemas.openxmlformats.org/presentationml/2006/main"}
with ZipFile(pptx) as archive:
    slide = ET.fromstring(archive.read("ppt/slides/slide1.xml"))
    shapes = {s.find("p:nvSpPr/p:cNvPr", ns).get("name"): s
              for s in slide.findall(".//p:sp", ns)}
    xml_tabs = []
    for index, native in enumerate(created["records"]):
        shape = shapes[f"tab-{index}"]
        tabs = shape.findall(".//a:tab", ns)
        assert len(tabs) == 1
        position = int(tabs[0].get("pos")) / 12700
        assert abs(position - native["targetPoints"]) <= 1 / 12700
        xml_tabs.append(position)
with pdfplumber.open(source) as pdf:
    assert len(pdf.pages) == 1
    page = pdf.pages[0]
    assert (float(page.width), float(page.height)) == (960, 540)
    words = sorted(page.extract_words(extra_attrs=["fontname"],
                                     x_tolerance=1, y_tolerance=2),
                   key=lambda word: word["top"])
    assert len(words) == 18 and all(word["text"] == "Before" for word in words)
    records = []
    for index, native in enumerate(created["records"]):
        tab, literal = words[index * 2:index * 2 + 2]
        assert native["actualTabText"] == "\tBefore" and native["literalText"] == "Before"
        target = native["targetPoints"]
        offset = native["tabTextBoundLeft"] - native["leadingTabBoundLeft"]
        records.append({"targetPoints": target, "drawingMlTabPoints": xml_tabs[index],
                        "nativeTabOffsetPoints": offset,
                        "nativeTabErrorPoints": abs(offset - target),
                        "nativeLiteralOffsetPoints": native["literalTextBoundLeft"] - native["tabShapeLeft"],
                        "pdfTabX": tab["x0"], "pdfLiteralX": literal["x0"],
                        "pdfTabMinusLiteralPoints": tab["x0"] - literal["x0"],
                        "pdfTabFont": tab["fontname"], "pdfLiteralFont": literal["fontname"]})
    png = root / "pdf-render.png"
    page.to_image(resolution=96).save(png)
reader = pypdf.PdfReader(source)
fonts = [{"resource": str(key), "baseFont": str(value.get_object().get("/BaseFont")),
          "subtype": str(value.get_object().get("/Subtype"))}
         for key, value in reader.pages[0]["/Resources"]["/Font"].items()]
report = {"pdfSha256": sha(source), "pptxSha256": sha(pptx), "rasterSha256": sha(png),
          "extractorSha256": sha(Path(__file__)), "python": platform.python_version(),
          "pdfplumber": pdfplumber.__version__, "pypdf": pypdf.__version__,
          "records": records, "fonts": fonts, "saveReopenObservationsAndRasterIdentical": True,
          "nativeTabTolerancePoints": 0.02,
          "nativeTabGatePassed": all(r["nativeTabErrorPoints"] <= 0.02 for r in records),
          "scope": "PowerPoint-created control, no OPF input. Native bounds retain their 0.02 pt gate. PDF coordinates are independent observations with separate serialization precision, not proof of screen pixel placement or per-glyph physical font-file identity. No font programs are extracted."}
(root / "pdf-control-comparison.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"records": len(records), "nativeTabGatePassed": report["nativeTabGatePassed"],
                  "maximumNativeTabErrorPoints": max(r["nativeTabErrorPoints"] for r in records),
                  "fonts": fonts}))
