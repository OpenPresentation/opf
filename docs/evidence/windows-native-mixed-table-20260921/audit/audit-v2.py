#!/usr/bin/env python3
"""Read-only independent audit of the native mixed-table observation run."""
from __future__ import annotations

import hashlib
import json
import struct
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
RUN = ROOT / "native-mixed-table-01"
FIXTURE = ROOT / "R" / "mixed-table-registry-01"
REPORT_PATH = HERE / "report-v2.json"
EXPECTED_SOURCE_SHA256 = "f92c5d5565afa1d03fc6df0cdc8d482771d5ebd5a5403f7a888f75e2ad020a51"
PPTX_FONT_SUFFIXES = (".ttf", ".otf", ".woff", ".woff2", ".eot", ".fntdata", ".odttf")
NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


checks: list[dict] = []


def check(name: str, passed: bool, evidence: dict):
    checks.append({"name": name, "passed": bool(passed), "evidence": evidence})


def main() -> int:
    if REPORT_PATH.exists():
        raise FileExistsError(f"Preserve existing audit report: {REPORT_PATH}")

    request = load_json(RUN / "request.json")
    report = load_json(RUN / "report.json")
    supervisor = load_json(RUN / "supervisor.json")
    worker = load_json(RUN / "worker.json")
    registration = load_json(RUN / "font-registration.json")
    progress = load_json(RUN / "progress.json")
    stage_lines = [line for line in (RUN / "stages.jsonl").read_text(encoding="utf-8-sig").splitlines() if line.strip()]
    stages = [json.loads(line.lstrip("\ufeff")) for line in stage_lines]

    # Rehash both sides of every supervisor external/snapshot record independently.
    input_checks = supervisor["inputChecks"]
    mismatches = []
    for row in input_checks:
        path = Path(row["path"])
        try:
            actual = sha256(path)
        except Exception as exc:  # Record the failure without losing the rest of the audit.
            actual = None
            mismatches.append({"path": str(path), "expected": row.get("expected"), "error": str(exc)})
        if actual != row.get("expected") or actual != row.get("actual") or row.get("matched") is not True:
            mismatches.append({"path": str(path), "expected": row.get("expected"), "recordedActual": row.get("actual"), "independentActual": actual})
    external_source = Path(request["source"]["path"])
    source_snapshot = Path(request["source"]["snapshotPath"])
    source_hash = sha256(external_source)
    snapshot_hash = sha256(source_snapshot)
    check(
        "34 external-and-snapshot input hashes match",
        len(input_checks) == 34 and not mismatches and supervisor["inputsUnchanged"] is True,
        {"hashCheckRows": len(input_checks), "allMatch": not mismatches, "mismatches": mismatches,
         "sourceSha256": source_hash, "snapshotSha256": snapshot_hash,
         "sourceExpectedSha256": request["source"]["sha256"],
         "snapshotExpectedSha256": request["source"]["snapshotSha256"]},
    )

    # Native worker and parent lifecycle are separate gates; do not infer beyond their records.
    close_begin = [s for s in stages if s["stage"] == "observation.presentation.close" and s["status"] == "begin"]
    close_success = [s for s in stages if s["stage"] == "observation.presentation.close" and s["status"] == "success"]
    lifecycle_passed = (
        worker["exitCode"] == 0 and worker["timedOut"] is False
        and report["cleanupConfirmed"] is True and report["officeOperationsStopped"] is False
        and report["lastStage"] == "worker.complete" and report["error"] in (None, "")
        and supervisor["officeLifecycleComplete"] is True
        and supervisor["officeCleanupConfirmed"] is True
        and supervisor["fontCleanupConfirmed"] is True
        and supervisor["metricsGatePassed"] is True
        and len(close_begin) == len(close_success) == 1
        and close_success[0]["ownedPresentationPath"] == request["source"]["snapshotPath"]
    )
    check(
        "successful read-only lifecycle closes only the owned source snapshot once",
        lifecycle_passed,
        {"workerExitCode": worker["exitCode"], "timedOut": worker["timedOut"],
         "lastStage": report["lastStage"], "cleanupConfirmed": report["cleanupConfirmed"],
         "officeOperationsStopped": report["officeOperationsStopped"],
         "ownedPresentationCloseBeginCount": len(close_begin), "ownedPresentationCloseSuccessCount": len(close_success),
         "closedPath": close_success[0]["ownedPresentationPath"] if close_success else None,
         "parent": {key: supervisor.get(key) for key in ("officeLifecycleComplete", "metricsGatePassed", "officeCleanupConfirmed", "fontCleanupConfirmed")},
         "scope": report["scope"]},
    )

    # COM-stage begin/success records must be contiguous and successful; the three
    # unpaired successes are explicit lifecycle markers, not COM operations.
    stage_errors = [s for s in stages if s["status"] == "error"]
    sequences = [s["sequence"] for s in stages]
    begin_rows = [i for i, s in enumerate(stages) if s["status"] == "begin"]
    bad_pairs = []
    paired_indices = set()
    for i in begin_rows:
        if i + 1 >= len(stages) or stages[i + 1]["stage"] != stages[i]["stage"] or stages[i + 1]["status"] != "success":
            bad_pairs.append({"sequence": stages[i]["sequence"], "stage": stages[i]["stage"],
                              "next": stages[i + 1] if i + 1 < len(stages) else None})
        else:
            paired_indices.add(i)
            paired_indices.add(i + 1)
    unpaired_successes = [s for i, s in enumerate(stages) if s["status"] == "success" and i not in paired_indices]
    expected_markers = ["worker.initialize", "observation.presentation.cleanup", "worker.complete"]
    stage_pair_passed = (
        sequences == list(range(1, len(stages) + 1)) and not stage_errors and not bad_pairs
        and len(begin_rows) == len(paired_indices) // 2
        and [s["stage"] for s in unpaired_successes] == expected_markers
        and progress["sequence"] == stages[-1]["sequence"]
        and progress["stage"] == "worker.complete" and progress["status"] == "success"
    )
    check(
        "durable stage sequence and COM begin/success pairing",
        stage_pair_passed,
        {"stageRows": len(stages), "statusCounts": {status: sum(s["status"] == status for s in stages) for status in ("begin", "success", "error")},
         "comBeginSuccessPairs": len(begin_rows), "unpairedLifecycleSuccesses": [s["stage"] for s in unpaired_successes],
         "sequenceContinuous": sequences == list(range(1, len(stages) + 1)),
         "errorRows": len(stage_errors), "badPairs": bad_pairs,
         "lastStage": stages[-1]["stage"], "lastDurableStage": progress["stage"]},
    )

    # Exact content/style ranges and all captured character offsets.
    observation = report["observation"]
    cell = observation["cell"]
    whole = cell["whole"]
    expected = request["expectations"]
    expected_text = expected["text"]
    text = whole["text"]
    run_results = []
    for actual, wanted in zip(cell["runs"], expected["runs"]):
        font = actual["font"]
        run_results.append({
            "start": actual["start"], "length": actual["length"], "text": actual["text"],
            "size": font["size"], "sizeDeltaPoints": float(font["size"]) - float(wanted["size"]),
            "bold": font["bold"], "italic": font["italic"], "font": font["name"],
            "passed": (actual["start"] == wanted["start"] and actual["length"] == wanted["length"]
                       and actual["text"] == wanted["text"] and font["name"] == "Carlito"
                       and abs(float(font["size"]) - float(wanted["size"])) <= 0.02
                       and font["bold"] == (-1 if wanted["bold"] else 0)
                       and font["italic"] == (-1 if wanted["italic"] else 0)),
        })
    probe_results = []
    for actual, wanted in zip(cell["characters"], expected["characterProbes"]):
        probe_position = int(wanted["position"])
        containing_run = next(
            (r for r in expected["runs"]
             if int(r["start"]) <= probe_position < int(r["start"]) + int(r["length"])),
            None,
        )
        observed_font = actual["font"]
        expected_bold = -1 if containing_run and containing_run["bold"] else 0
        expected_italic = -1 if containing_run and containing_run["italic"] else 0
        probe_style_pass = bool(
            containing_run is not None
            and observed_font["name"] == "Carlito"
            and abs(float(observed_font["size"]) - float(containing_run["size"])) <= 0.02
            and observed_font["bold"] == expected_bold
            and observed_font["italic"] == expected_italic
        )
        probe_results.append({"requestedPosition": wanted["position"], "reportedPosition": actual["position"],
                              "actualStart": actual["start"], "length": actual["length"],
                              "text": actual["text"], "purpose": actual["purpose"],
                              "containingExpectedRunStart": containing_run["start"] if containing_run else None,
                              "observedFont": observed_font,
                              "expectedFont": ({"name": "Carlito", "size": containing_run["size"],
                                               "bold": expected_bold, "italic": expected_italic}
                                              if containing_run else None),
                              "stylePassed": probe_style_pass,
                              "passed": actual["position"] == wanted["position"] and actual["start"] == wanted["position"]
                                       and actual["length"] == 1 and actual["text"] == wanted["text"]
                                       and probe_style_pass})
    exact_content_pass = (
        text == expected_text and len(text) == 245 and whole["start"] == 1 and whole["length"] == 245
        and text.count("\t") == 1 and "\n" not in text and "\r" not in text
        and len(cell["runs"]) == len(expected["runs"]) == 5 and all(r["passed"] for r in run_results)
        and len(cell["characters"]) == len(expected["characterProbes"]) == 7
        and all(p["passed"] for p in probe_results)
        and observation["readOnly"] == -1 and observation["slideCount"] == 1 and observation["shapeCount"] == 1
        and observation["shape"]["hasTable"] == -1
        and observation["table"]["rowCount"] == 1 and observation["table"]["columnCount"] == 1
        and cell["paragraph"]["count"] == 1 and cell["paragraph"]["explicitTabStopCount"] == 0
    )
    check(
        "whole-cell text, five exact native runs, seven character text/starts/styles, one paragraph/tab",
        exact_content_pass,
        {"wholeStart": whole["start"], "wholeLength": whole["length"], "pythonTextLength": len(text),
         "tabCount": text.count("\t"), "hardBreakCount": text.count("\n") + text.count("\r"),
         "runs": run_results, "characterProbes": probe_results,
         "paragraphCount": cell["paragraph"]["count"], "explicitTabStopCount": cell["paragraph"]["explicitTabStopCount"]},
    )

    # Reconstruct line ranges from actual native TextRange2 Starts and lengths.
    line_records = cell["lines"]["records"]
    intervals = []
    contiguous = True
    cursor = 0
    reconstructed = []
    for line in line_records:
        start0 = int(line["start"]) - 1
        end0 = start0 + int(line["length"])
        piece = text[start0:end0]
        contiguous = contiguous and start0 == cursor and piece == line["text"] and len(piece) == int(line["length"])
        intervals.append({"startInclusive0": start0, "endExclusive0": end0,
                          "startOneBased": line["start"], "length": line["length"], "text": line["text"]})
        reconstructed.append(piece)
        cursor = end0
    line_text = "".join(reconstructed)
    expected_intervals = [[0, 92], [92, 194], [194, 245]]
    actual_intervals = [[item["startInclusive0"], item["endExclusive0"]] for item in intervals]
    native_lines_pass = (
        cell["lines"]["count"] == cell["lines"]["capturedCount"] == len(line_records) == 3
        and contiguous and cursor == len(text) == 245 and line_text == text
        and actual_intervals == expected_intervals
        and all("\n" not in item["text"] and "\r" not in item["text"] for item in intervals)
    )
    estimated = [[0, 78], [78, 172], [172, 245]]
    check(
        "native TextRange2 lines reconstruct 245 characters without hard breaks",
        native_lines_pass,
        {"nativeHalfOpenOffsets0": actual_intervals, "expectedNativeOffsets0": expected_intervals,
         "estimatedHalfOpenOffsets0": estimated, "nativeDiffersFromEstimated": actual_intervals != estimated,
         "reconstructedLength": len(line_text), "reconstructedEqualsWholeCell": line_text == text,
         "lines": intervals, "estimatedOffsetsAreNonbindingProbes": expected["estimatedLayoutTrace"]},
    )

    # Compare observed outer shape/cell, table rows/columns, and frame margins with
    # the unchanged source DrawingML values, allowing at most 0.02 pt. The cell
    # geometry is a COM observation compared with the enclosing graphic-frame
    # extent; the source XML does not encode an independent cell coordinate box.
    shape_geometry = observation["shape"]["geometry"]
    cell_geometry = cell["geometry"]
    whole_bounds = whole["bounds"]
    after_tab = next(p for p in cell["characters"] if p["purpose"] == "after-tab")
    paragraph = cell["paragraph"]
    tab_evidence = {"explicitTabStopCount": paragraph["explicitTabStopCount"],
                    "defaultSpacingPoints": paragraph["defaultTabSpacing"],
                    "tabCharacterStart": next(p["start"] for p in cell["characters"] if p["purpose"] == "tab"),
                    "afterTabCharacterStart": after_tab["start"],
                    "wholeTextRangeOriginLeftPoints": whole_bounds["left"],
                    "afterTabCharacterBoundLeftPoints": after_tab["bounds"]["left"],
                    "afterTabOffsetFromTextRangeOriginPoints": float(after_tab["bounds"]["left"]) - float(whole_bounds["left"])}
    emu_per_point = 12700.0
    with zipfile.ZipFile(external_source) as zf:
        geometry_slide = ET.fromstring(zf.read("ppt/slides/slide1.xml"))
    graphic_frame = geometry_slide.find(".//p:graphicFrame", NS)
    transform = graphic_frame.find("./p:xfrm", NS) if graphic_frame is not None else None
    offset = transform.find("./a:off", NS) if transform is not None else None
    extent = transform.find("./a:ext", NS) if transform is not None else None
    table_node = graphic_frame.find(".//a:tbl", NS) if graphic_frame is not None else None
    row_node = table_node.find("./a:tr", NS) if table_node is not None else None
    grid_column = table_node.find("./a:tblGrid/a:gridCol", NS) if table_node is not None else None
    cell_node = row_node.find("./a:tc", NS) if row_node is not None else None
    cell_properties = cell_node.find("./a:tcPr", NS) if cell_node is not None else None
    expected_geometry = None
    expected_frame = None
    if all(node is not None for node in (offset, extent, row_node, grid_column, cell_properties)):
        expected_geometry = {
            "left": int(offset.attrib["x"]) / emu_per_point,
            "top": int(offset.attrib["y"]) / emu_per_point,
            "width": int(extent.attrib["cx"]) / emu_per_point,
            "height": int(extent.attrib["cy"]) / emu_per_point,
        }
        expected_frame = {
            key: int(cell_properties.attrib[attr]) / emu_per_point
            for key, attr in (("marginLeft", "marL"), ("marginRight", "marR"),
                              ("marginTop", "marT"), ("marginBottom", "marB"))
        }
    geometry_tolerance = 0.02
    geometry_deltas = {}
    if expected_geometry is not None and expected_frame is not None:
        for label, observed in (("shape", shape_geometry), ("cell", cell_geometry)):
            for key, wanted_value in expected_geometry.items():
                geometry_deltas[f"{label}.{key}"] = abs(float(observed[key]) - wanted_value)
        for key, wanted_value in expected_frame.items():
            geometry_deltas[f"frame.{key}"] = abs(float(cell["frame"][key]) - wanted_value)
        geometry_deltas["table.rowHeight"] = abs(
            float(observation["table"]["rowHeight"]) - int(row_node.attrib["h"]) / emu_per_point
        )
        geometry_deltas["table.columnWidth"] = abs(
            float(observation["table"]["columnWidth"]) - int(grid_column.attrib["w"]) / emu_per_point
        )
    geometry_pass = bool(
        expected_geometry is not None and expected_frame is not None
        and all(delta <= geometry_tolerance for delta in geometry_deltas.values())
        and observation["slideWidth"] == 960 and observation["slideHeight"] == 540
        and cell["frame"]["wordWrap"] == -1 and cell["frame"]["autoSize"] == 0
        and cell["frame"]["verticalAnchor"] == 1
    )
    check(
        "native shape/cell bounds, table extents, and frame margins match source XML within 0.02 pt",
        geometry_pass,
        {"geometryTolerancePoints": geometry_tolerance,
         "sourceSlideXmlGeometryPoints": expected_geometry,
         "sourceSlideXmlFrameMarginsPoints": expected_frame,
         "observedTableShapeGeometryPoints": shape_geometry,
         "observedCellGeometryPoints": cell_geometry,
         "observedTableRowHeightAndColumnWidth": {"rowHeight": observation["table"]["rowHeight"],
                                                   "columnWidth": observation["table"]["columnWidth"]},
         "observedCellFrame": cell["frame"],
         "absoluteDeltasPoints": geometry_deltas,
         "maximumAbsoluteDeltaPoints": max(geometry_deltas.values()) if geometry_deltas else None,
         "paragraph": paragraph, "tabProbeGeometry": tab_evidence,
         "limitation": "Cell bounds are compared with the enclosing graphic-frame extents; source XML has no separate cell coordinate box. TextRange2 bounds are recorded without inferring coordinate origin or engine cause."},
    )

    # Font registration is reported separately from the worker's family-name/style observations.
    font_rows = registration
    font_hashes = {entry["sha256"] for entry in request["fontFixture"]["fonts"]}
    font_cleanup_pass = (len(font_rows) == 4 and len({entry["sha256"] for entry in font_rows}) == 4
                        and {entry["sha256"] for entry in font_rows} == font_hashes
                        and all(entry["added"] == 1 and entry["removed"] is True for entry in font_rows))
    check("four unique session font additions were removed", font_cleanup_pass,
          {"registrationRecords": font_rows, "uniqueExpectedFontHashes": len(font_hashes),
           "allAddedOnceAndRemoved": font_cleanup_pass})

    # Inspect only retained source PPTX bytes (no Office); parse package XML and table text.
    source_pptx = external_source
    with zipfile.ZipFile(source_pptx) as zf:
        bad_member = zf.testzip()
        names = zf.namelist()
        xml_names = [n for n in names if n.endswith((".xml", ".rels"))]
        parsed_xml = {n: ET.fromstring(zf.read(n)) for n in xml_names}
        slide_root = parsed_xml["ppt/slides/slide1.xml"]
        graphic_frames = slide_root.findall(".//p:graphicFrame", NS)
        tables = [frame.find(".//a:tbl", NS) for frame in graphic_frames]
        tables = [table for table in tables if table is not None]
        rows = tables[0].findall("./a:tr", NS) if len(tables) == 1 else []
        cells = rows[0].findall("./a:tc", NS) if len(rows) == 1 else []
        source_xml_text = "".join(node.text or "" for node in tables[0].findall(".//a:t", NS)) if len(tables) == 1 else ""
        source_hard_breaks = sum(len(table.findall(".//a:br", NS)) for table in tables)
        xml_font_tags = [
            f"{name}:{node.tag.rsplit('}', 1)[-1]}"
            for name, root in parsed_xml.items()
            for node in root.iter()
            if "embeddedfont" in node.tag.rsplit("}", 1)[-1].lower()
        ]
        suspicious_members = [name for name in names if any(name.lower().endswith(suffix) for suffix in PPTX_FONT_SUFFIXES)
                              or "/fonts/" in name.lower()]
    pptx_hash_matches = (source_hash == snapshot_hash == request["source"]["sha256"] == EXPECTED_SOURCE_SHA256)
    source_xml_pass = (bad_member is None and len(xml_names) > 0 and len(graphic_frames) == 1
                       and len(tables) == 1 and len(rows) == 1 and len(cells) == 1
                       and source_xml_text == expected_text and source_hard_breaks == 0
                       and not xml_font_tags and not suspicious_members and pptx_hash_matches)
    check(
        "unchanged source PPTX CRC/XML and source table content; no embedded font program",
        source_xml_pass,
        {"sourceSha256": source_hash, "snapshotSha256": snapshot_hash,
         "expectedSha256": EXPECTED_SOURCE_SHA256, "sourceAndSnapshotByteIdentical": source_pptx.read_bytes() == source_snapshot.read_bytes(),
         "zipMembers": len(names), "zipCrcError": bad_member, "xmlAndRelsParsed": len(xml_names),
         "tableShapeCount": len(tables), "rows": len(rows), "cells": len(cells),
         "tableXmlTextLength": len(source_xml_text), "tableXmlTextMatchesNative": source_xml_text == expected_text,
         "sourceXmlHardBreakCount": source_hard_breaks, "embeddedFontXmlTags": xml_font_tags,
         "fontProgramOrFontsDirectoryMembers": suspicious_members},
    )

    png_path = RUN / "native-observation.png"
    png_bytes = png_path.read_bytes()
    png_dimensions = struct.unpack(">II", png_bytes[16:24]) if png_bytes.startswith(b"\x89PNG\r\n\x1a\n") and len(png_bytes) >= 24 else None
    raster_pass = (png_dimensions == (1280, 720)
                   and hashlib.sha256(png_bytes).hexdigest() == report["raster"]["sha256"]
                   and report["raster"]["width"] == 1280 and report["raster"]["height"] == 720)
    check("native observation PNG hash and dimensions", raster_pass,
          {"path": str(png_path), "sha256": hashlib.sha256(png_bytes).hexdigest(),
           "reportedSha256": report["raster"]["sha256"], "dimensions": png_dimensions,
           "visualReview": "Not performed by this offline audit; root separately reviewed the full raster."})

    passed = all(item["passed"] for item in checks)
    audit_hash = sha256(Path(__file__).resolve())
    result = {
        "schemaVersion": 1,
        "kind": "opf-pptx-mixed-table-independent-native-audit",
        "createdBy": "independent read-only stdlib audit",
        "scope": "Raw native-mixed-table-01 evidence, source/snapshot hashes, stages, registration records, exact character probe styles, source-derived geometry tolerances, line ranges, and source PPTX ZIP/XML. No Office/COM, font registration, UI, source edit, or Git operation was performed by this audit.",
        "auditScript": {"path": str(Path(__file__).resolve()), "sha256": audit_hash},
        "run": {"path": str(RUN), "workerSha256": request["verifier"]["sha256"],
                "sourceSha256": request["source"]["sha256"], "reportSha256": sha256(RUN / "report.json"),
                "requestSha256": sha256(RUN / "request.json"), "supervisorSha256": sha256(RUN / "supervisor.json"),
                "stagesSha256": sha256(RUN / "stages.jsonl"), "fontRegistrationSha256": sha256(RUN / "font-registration.json")},
        "summary": {"passed": passed, "checkCount": len(checks), "passedChecks": sum(c["passed"] for c in checks),
                    "failedChecks": [c["name"] for c in checks if not c["passed"]]},
        "checks": checks,
        "nativeLineHalfOpenOffsets0": actual_intervals,
        "nativeGeometry": {"tableShape": shape_geometry, "cellShape": cell_geometry, "wholeTextRange": whole_bounds,
                           "paragraph": paragraph, "tab": tab_evidence},
        "limitations": [
            "The native run is a read-only observation; it does not test edit/save/reopen persistence.",
            "The source PPTX is unchanged. This report makes no engine-cause claim about native line wrapping, tab positions, text-range bounds, or the differences from the estimated offline boundaries.",
            "Character style checks compare the seven observed probe records with their containing expected text runs; they do not establish physical per-glyph font identity.",
            "Geometry checks compare observed shape/cell bounds, table row/column extents, and cell margins with saved DrawingML within 0.02 point; the cell uses its enclosing graphic-frame extent because the source XML has no separate cell-coordinate box.",
            "Reported Carlito family/style properties and successful session registration do not identify the physical font used for every glyph.",
            "The root supervisor separately reviewed the full raster. This auditor parsed its hash and dimensions but did not visually inspect it or certify browser/native fidelity.",
        ],
    }
    REPORT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(result["summary"], separators=(",", ":")))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
