#!/usr/bin/env python3
"""Offline check of separator run declarations in the saved PPTX."""
import hashlib
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

audit_dir = Path(__file__).resolve().parent
root_dir = audit_dir.parent
pptx_path = root_dir / "native-font-edit-01" / "native-font-edit.pptx"
worker_report_path = root_dir / "native-font-edit-01" / "report.json"
out = audit_dir / "xml-style-review.json"
if out.exists():
    raise SystemExit(f"Preserve existing report; refusing overwrite: {out}")

NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
NS = {"a": NS_A, "p": NS_P}


def sha(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def rpr_signature(rpr):
    if rpr is None:
        return None

    def node_signature(node):
        return {
            "tag": node.tag.rsplit("}", 1)[-1],
            "attributes": dict(sorted(node.attrib.items())),
            "children": [node_signature(child) for child in list(node)],
            "text": (node.text or "").strip() or None,
        }

    return node_signature(rpr)


checks = []
details = {}
try:
    with zipfile.ZipFile(pptx_path, "r") as zf:
        bad_crc = zf.testzip()
        xml = ET.fromstring(zf.read("ppt/slides/slide1.xml"))
        shapes = {}
        for shape in xml.findall(".//p:sp", NS):
            c_nv = shape.find("./p:nvSpPr/p:cNvPr", NS)
            if c_nv is None:
                continue
            shapes[c_nv.get("name")] = shape
        body_name = "OPF text slides.0.text line 0"
        body = shapes.get(body_name)
        if body is None:
            raise ValueError(f"Could not find body shape {body_name}")
        tx_body = body.find("./p:txBody", NS)
        paragraphs = tx_body.findall("./a:p", NS) if tx_body is not None else []
        if len(paragraphs) != 1:
            raise ValueError(f"Expected exactly one body paragraph, found {len(paragraphs)}")
        paragraph = paragraphs[0]
        runs = paragraph.findall("./a:r", NS)
        run_texts = ["".join(t.text or "" for t in run.findall("./a:t", NS)) for run in runs]
        run_rprs = [run.find("./a:rPr", NS) for run in runs]
        expected_runs = ["Regular 18 | ", "Bold 20", " | ", "Italic 22", " | ", "BoldItalic 24"]
        text_matches = run_texts == expected_runs
        separator_indices = [0, 2, 4]
        first_signature = rpr_signature(run_rprs[0])
        signatures_match = all(rpr_signature(run_rprs[i]) == first_signature for i in separator_indices)
        latin_names = []
        size_attrs = []
        bold_attrs = []
        italic_attrs = []
        for index in separator_indices:
            rpr = run_rprs[index]
            latin = rpr.find("./a:latin", NS) if rpr is not None else None
            latin_names.append(latin.get("typeface") if latin is not None else None)
            size_attrs.append(rpr.get("sz") if rpr is not None else None)
            bold_attrs.append(rpr.get("b") if rpr is not None else None)
            italic_attrs.append(rpr.get("i") if rpr is not None else None)
        font_family_matches = latin_names == ["Carlito"] * 3
        style_attrs_match_regular = all(value is None for value in size_attrs + bold_attrs + italic_attrs)
        paragraph_properties = paragraph.find("./a:pPr", NS)
        paragraph_default = paragraph_properties.find("./a:defRPr", NS) if paragraph_properties is not None else None
        def_rpr = rpr_signature(paragraph_default)

    report = json.loads(worker_report_path.read_text(encoding="utf-8-sig"))
    observed_regular = report["edited"]["observation"]["shapes"]
    observed_regular = next(s for s in observed_regular if s["role"] == "body")["runs"][0]
    observed_regular_style = {
        "text": observed_regular["text"],
        "length": observed_regular["length"],
        "family": observed_regular["font"]["name"],
        "size": observed_regular["font"]["size"],
        "bold": observed_regular["font"]["bold"],
        "italic": observed_regular["font"]["italic"],
    }
    direct_regular_observation_matches = (
        observed_regular_style["text"] == "Regular 18"
        and observed_regular_style["length"] == 10
        and observed_regular_style["family"] == "Carlito"
        and observed_regular_style["size"] == 18
        and observed_regular_style["bold"] == 0
        and observed_regular_style["italic"] == 0
    )
    checks = [
        {"name": "saved_pptx_crc_passed", "passed": bad_crc is None, "badMember": bad_crc},
        {"name": "body_has_exact_expected_six_xml_runs", "passed": text_matches, "runTexts": run_texts},
        {"name": "three_separators_have_matching_regular_run_properties", "passed": signatures_match, "separatorRunIndexesZeroBased": separator_indices},
        {"name": "separator_runs_declare_carlito_latin_typeface", "passed": font_family_matches, "latinTypefaces": latin_names},
        {"name": "separator_runs_do_not_override_size_bold_or_italic", "passed": style_attrs_match_regular, "sz": size_attrs, "b": bold_attrs, "i": italic_attrs},
        {"name": "regular_first_span_is_directly_observed_18pt_nonbold_nonitalic", "passed": direct_regular_observation_matches, "observation": observed_regular_style},
    ]
    details = {
        "pptx": {"path": str(pptx_path), "sha256": sha(pptx_path), "bytes": pptx_path.stat().st_size, "slidePart": "ppt/slides/slide1.xml"},
        "bodyShape": body_name,
        "xmlRunTexts": run_texts,
        "separatorArchiveProperties": [
            {"runIndexZeroBased": index, "text": run_texts[index], "rPr": rpr_signature(run_rprs[index])}
            for index in separator_indices
        ],
        "paragraphDefRPr": def_rpr,
        "directNativeTextRangeObservation": observed_regular_style,
        "interpretation": "Archive-declared style only: separator text shares the first regular run or has an identical rPr signature, including Carlito latin typeface and absent sz/b/i overrides. The saved XML has no local a:defRPr and the separators have no separately recorded TextRange2 observation; numeric 18pt regular is directly observed for the first regular span, not individually queried on each separator. This does not identify the physical glyph font.",
    }
    passed = all(row["passed"] for row in checks)
    result = {
        "schemaVersion": 1,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "scope": "Read-only standard-library PPTX XML check; no Office/COM or font operations.",
        "scriptSha256": sha(Path(__file__).resolve()),
        "workerReportSha256": sha(worker_report_path),
        "checks": checks,
        "details": details,
        "passed": passed,
    }
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"passed": passed, "checks": sum(1 for row in checks if row["passed"]), "total": len(checks)}, indent=2))
    sys.exit(0 if passed else 1)
except Exception as exc:
    result = {
        "schemaVersion": 1,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "scope": "Read-only standard-library PPTX XML check; no Office/COM or font operations.",
        "scriptSha256": sha(Path(__file__).resolve()),
        "passed": False,
        "failure": f"{type(exc).__name__}: {exc}",
        "checksCompletedBeforeFailure": checks,
        "details": details,
    }
    if not out.exists():
        out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"passed": False, "failure": result["failure"]}, indent=2), file=sys.stderr)
    sys.exit(2)
