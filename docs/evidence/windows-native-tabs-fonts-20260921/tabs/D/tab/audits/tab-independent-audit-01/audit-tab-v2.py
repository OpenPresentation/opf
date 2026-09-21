"""Independent stdlib audit of native-tab-v2-02 retained observations.

Offline only: reads report, request, logs, owned PPTX/rasters, and hash inputs.
It does not call PowerPoint or alter the observed run.
"""
from __future__ import annotations

import hashlib
import json
import math
import pathlib
import struct
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone


ARTIFACT_ROOT = pathlib.Path(__file__).resolve().parents[1]
RUN = ARTIFACT_ROOT / "native-tab-v2-02"
OUT = pathlib.Path(__file__).resolve().parent / "audit-report-v2.json"
TOLERANCE = 0.02
PERSISTENCE_NUMERIC = [
    "targetPoints", "tabStopPoints", "tabShapeLeft", "tabShapeTop", "literalShapeLeft", "literalShapeTop",
    "leadingTabBoundLeft", "leadingTabBoundTop", "leadingTabBoundWidth", "leadingTabBoundHeight",
    "tabTextBoundLeft", "tabTextBoundTop", "tabTextBoundWidth", "tabTextBoundHeight",
    "literalTextBoundLeft", "literalTextBoundTop", "literalTextBoundWidth", "literalTextBoundHeight",
    "leadingTabFontSize", "tabTextFontSize", "literalTextFontSize",
]
PERSISTENCE_EXACT = ["tabStopCount", "tabShapeName", "literalShapeName", "actualTabText", "literalText",
                     "leadingTabFontName", "tabTextFontName", "literalTextFontName"]
NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}


def sha(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: pathlib.Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def contained(path_text: str) -> pathlib.Path:
    path = pathlib.Path(path_text).resolve()
    assert path.is_relative_to(RUN.resolve()), f"owned path escaped run directory: {path}"
    return path


def offset_metrics(observation: dict, targets: list[float], tolerance: float) -> dict:
    records = observation["records"]
    if len(records) != len(targets):
        raise AssertionError(f"{observation.get('phase')} record count {len(records)} != targets {len(targets)}")
    rows = []
    for expected_index, (record, requested) in enumerate(zip(records, targets)):
        if record["index"] != expected_index:
            raise AssertionError(f"Unexpected record index at {expected_index}: {record['index']}")
        actual_tab = float(record["tabTextBoundLeft"]) - float(record["leadingTabBoundLeft"])
        actual_literal = float(record["literalTextBoundLeft"]) - float(record["tabShapeLeft"])
        tab_error = abs(actual_tab - float(requested))
        literal_error = abs(actual_literal - float(requested))
        pair_delta = abs(actual_tab - actual_literal)
        rows.append({
            "index": expected_index,
            "targetPoints": requested,
            "actualTabOffsetPoints": actual_tab,
            "actualLiteralOffsetPoints": actual_literal,
            "tabErrorPoints": tab_error,
            "literalErrorPoints": literal_error,
            "tabMinusLiteralPoints": actual_tab - actual_literal,
            "pairDeltaPoints": pair_delta,
            "tabGatePassed": tab_error <= tolerance,
            "literalGatePassed": literal_error <= tolerance,
            "pairAgreementGatePassed": pair_delta <= tolerance,
        })
    max_tab = max(row["tabErrorPoints"] for row in rows)
    max_literal = max(row["literalErrorPoints"] for row in rows)
    max_pair = max(row["pairDeltaPoints"] for row in rows)
    return {
        "phase": observation["phase"],
        "tolerancePoints": tolerance,
        "maxTabErrorPoints": max_tab,
        "maxTabErrorIndex": max(rows, key=lambda row: row["tabErrorPoints"])["index"],
        "maxLiteralErrorPoints": max_literal,
        "maxLiteralErrorIndex": max(rows, key=lambda row: row["literalErrorPoints"])["index"],
        "maxPairDeltaPoints": max_pair,
        "maxPairDeltaIndex": max(rows, key=lambda row: row["pairDeltaPoints"])["index"],
        "tabGatePassed": max_tab <= tolerance,
        "literalGatePassed": max_literal <= tolerance,
        "pairAgreementGatePassed": max_pair <= tolerance,
        "phaseGatePassed": max_tab <= tolerance and max_literal <= tolerance and max_pair <= tolerance,
        "records": rows,
    }


def phase_invariants(observation: dict, request: dict) -> dict:
    targets = request["targets"]
    font = request["font"]
    errors = []
    records = observation["records"]
    for index, (record, target) in enumerate(zip(records, targets)):
        checks = {
            "targetExact": record["targetPoints"] == target,
            "oneTabStop": record["tabStopCount"] == 1,
            "tabTextExact": record["actualTabText"] == request["literals"]["tabText"],
            "literalTextExact": record["literalText"] == request["literals"]["beforeText"],
            "shapeNamesExact": record["tabShapeName"] == f"tab-{index}" and record["literalShapeName"] == f"literal-{index}",
            "tabStopWithinTolerance": abs(float(record["tabStopPoints"]) - float(target)) <= request["tolerancePoints"],
            "fontsExact": all(record[key] == font["name"] for key in ("leadingTabFontName", "tabTextFontName", "literalTextFontName")),
            "fontSizesExact": all(float(record[key]) == float(font["size"]) for key in ("leadingTabFontSize", "tabTextFontSize", "literalTextFontSize")),
        }
        for name, passed in checks.items():
            if not passed:
                errors.append({"index": index, "check": name, "observed": record, "expectedTarget": target})
    return {"recordCount": len(records), "expectedRecordCount": len(targets),
            "allExactTabAndFontChecksPassed": len(errors) == 0, "failures": errors}


def stage_audit(run: pathlib.Path) -> dict:
    rows = [json.loads(line.lstrip("\ufeff")) for line in (run / "stages.jsonl").read_text(encoding="utf-8-sig").splitlines() if line.strip()]
    sequences = [int(row["sequence"]) for row in rows]
    ordered = sequences == list(range(1, len(rows) + 1))
    stack: list[str] = []
    pairing_errors = []
    standalone_success = []
    for row in rows:
        status = row["status"]
        stage = row["stage"]
        if status == "begin":
            stack.append(stage)
        elif stack:
            expected = stack.pop()
            if stage != expected or status != "success":
                pairing_errors.append({"sequence": row["sequence"], "expectedStage": expected, "actualStage": stage, "status": status})
        elif stage not in ("worker.initialize", "worker.failure") and not stage.endswith(".cleanup"):
            standalone_success.append({"sequence": row["sequence"], "stage": stage, "status": status})
    stage_counts = {}
    for row in rows:
        stage_counts.setdefault(row["stage"], {"begin": 0, "success": 0, "error": 0})
        stage_counts[row["stage"]][row["status"]] = stage_counts[row["stage"]].get(row["status"], 0) + 1
    required = [
        "application.create", "create.presentation.add", "create.presentation.saveAs",
        "original.presentation.close", "reopen.presentation.open-readonly", "reopened.presentation.close",
    ]
    required_results = {name: stage_counts.get(name, {}) for name in required}
    milestones_pass = all(required_results[name].get("success") == 1 and required_results[name].get("begin") == 1
                          for name in required)
    errors = [row for row in rows if row["status"] == "error"]
    native_error_events = [row for row in errors if row["stage"] != "worker.failure"]
    last = rows[-1] if rows else None
    return {
        "rowCount": len(rows), "sequenceContiguous": ordered,
        "beginTerminalPairsBalanced": not stack and not pairing_errors,
        "pairingErrors": pairing_errors, "unpairedSuccessEvents": standalone_success,
        "criticalLifecycleMilestones": required_results,
        "criticalLifecycleMilestonesPassed": milestones_pass,
        "nativeErrorEvents": native_error_events,
        "workerFailureEvents": [row for row in errors if row["stage"] == "worker.failure"],
        "lastEvent": {key: last.get(key) for key in ("sequence", "stage", "status", "error")} if last else None,
        "nativeCallsSucceeded": ordered and not stack and not pairing_errors and milestones_pass and not native_error_events,
    }


def pptx_audit(pptx_path: pathlib.Path) -> dict:
    with zipfile.ZipFile(pptx_path, "r") as archive:
        bad_member = archive.testzip()
        xml_members = [name for name in archive.namelist() if name.endswith((".xml", ".rels"))]
        malformed = []
        for name in xml_members:
            try:
                ET.fromstring(archive.read(name))
            except Exception as exc:
                malformed.append({"member": name, "error": str(exc)})
        slide = ET.fromstring(archive.read("ppt/slides/slide1.xml"))
        shape_rows = []
        for shape in slide.findall(".//p:sp", NS):
            prop = shape.find("./p:nvSpPr/p:cNvPr", NS)
            name = prop.attrib.get("name", "") if prop is not None else ""
            if not name.startswith(("tab-", "literal-")):
                continue
            tabs = shape.findall("./p:txBody/a:p/a:pPr/a:tabLst/a:tab", NS)
            txbody = shape.find("./p:txBody", NS)
            text = "".join(item.text or "" for item in txbody.findall(".//a:t", NS)) if txbody is not None else ""
            fonts = [node.attrib.get("typeface") for node in shape.findall(".//a:latin", NS)]
            shape_rows.append({"name": name, "tabStopPositionsEmu": [tab.attrib.get("pos") for tab in tabs],
                               "text": text, "latinTypefaces": fonts})
        embedded_font_members = [name for name in archive.namelist()
                                 if name.lower().endswith((".fntdata", ".odttf", ".ttf", ".otf", ".woff", ".woff2"))]
        return {"zipCrcPassed": bad_member is None, "badZipMember": bad_member,
                "xmlMemberCount": len(xml_members), "malformedXml": malformed,
                "slideShapeRows": shape_rows, "embeddedFontMembers": embedded_font_members,
                "archiveStructurePassed": bad_member is None and not malformed}


def xml_tab_font_audit(archive_info: dict, targets: list[float], font_name: str, tolerance: float) -> dict:
    rows = {row["name"]: row for row in archive_info["slideShapeRows"]}
    checks = []
    for index, target in enumerate(targets):
        tab_name, literal_name = f"tab-{index}", f"literal-{index}"
        tab, literal = rows.get(tab_name), rows.get(literal_name)
        tab_positions = tab["tabStopPositionsEmu"] if tab else []
        tab_points = [int(value) / 12700 for value in tab_positions]
        checks.append({
            "index": index,
            "tabShapePresent": tab is not None,
            "literalShapePresent": literal is not None,
            "oneExactTabStopWithinTolerance": len(tab_points) == 1 and abs(tab_points[0] - target) <= tolerance,
            "tabTextExact": (tab or {}).get("text") == "\tBefore",
            "literalTextExact": (literal or {}).get("text") == "Before",
            "tabFontExact": bool(tab and tab["latinTypefaces"] and all(name == font_name for name in tab["latinTypefaces"])),
            "literalFontExact": bool(literal and literal["latinTypefaces"] and all(name == font_name for name in literal["latinTypefaces"])),
            "targetPoints": target,
            "tabStopEmu": tab_positions,
            "tabStopPoints": tab_points,
        })
    exact_shape_inventory = len(rows) == len(targets) * 2 and all(f"tab-{i}" in rows and f"literal-{i}" in rows for i in range(len(targets)))
    return {"shapeInventoryExact": exact_shape_inventory, "checks": checks,
            "passed": exact_shape_inventory and all(all(check[key] for key in (
                "tabShapePresent", "literalShapePresent", "oneExactTabStopWithinTolerance", "tabTextExact",
                "literalTextExact", "tabFontExact", "literalFontExact")) for check in checks)}


def main() -> None:
    if OUT.exists():
        raise FileExistsError(f"Refusing to overwrite audit output: {OUT}")
    report_path = RUN / "report.json"
    request_path = RUN / "request.json"
    report = read_json(report_path)
    request = read_json(request_path)
    worker = read_json(RUN / "worker.json")
    supervisor = read_json(RUN / "supervisor.json")
    original = report["original"]["observation"]
    reopened = report["reopened"]["observation"]
    tolerance = float(request["tolerancePoints"])
    targets = [float(value) for value in request["targets"]]

    original_metrics = offset_metrics(original, targets, tolerance)
    reopened_metrics = offset_metrics(reopened, targets, tolerance)
    original_invariants = phase_invariants(original, request)
    reopened_invariants = phase_invariants(reopened, request)
    persistence = []
    for index, (before, after) in enumerate(zip(original["records"], reopened["records"])):
        deltas = {key: abs(float(before[key]) - float(after[key])) for key in PERSISTENCE_NUMERIC}
        exact = {key: before[key] == after[key] for key in PERSISTENCE_EXACT}
        persistence.append({"index": index, "maximumNumericDeltaPoints": max(deltas.values()),
                            "deltas": deltas, "exactFields": exact,
                            "passed": max(deltas.values()) <= tolerance and all(exact.values())})
    persistence_pass = len(persistence) == len(targets) and all(item["passed"] for item in persistence)

    pptx_path = contained(report["source"]["path"])
    original_raster_path = contained(report["original"]["raster"]["path"])
    reopened_raster_path = contained(report["reopened"]["raster"]["path"])
    path_mappings = {
        "presentation": str(pptx_path),
        "originalRaster": str(original_raster_path),
        "reopenedRaster": str(reopened_raster_path),
    }
    pptx_hash = sha(pptx_path)
    original_raster_hash = sha(original_raster_path)
    reopened_raster_hash = sha(reopened_raster_path)
    original_png = original_raster_path.read_bytes()
    reopened_png = reopened_raster_path.read_bytes()
    raster_size = struct.unpack(">II", reopened_png[16:24]) if reopened_png[:8] == b"\x89PNG\r\n\x1a\n" else None
    stage_info = stage_audit(RUN)
    archive_info = pptx_audit(pptx_path)
    xml_tab_font = xml_tab_font_audit(archive_info, targets, request["font"]["name"], tolerance)

    input_results = {}
    for field in ("verifier", "processHelper"):
        item = request[field]
        external = pathlib.Path(item["path"]).resolve()
        snapshot = contained(item["snapshotPath"])
        external_hash = sha(external)
        snapshot_hash = sha(snapshot)
        input_results[field] = {"externalPath": str(external), "externalSha256": external_hash,
                                "recordedSha256": item["sha256"], "externalMatches": external_hash == item["sha256"],
                                "snapshotPath": str(snapshot), "snapshotSha256": snapshot_hash,
                                "recordedSnapshotSha256": item["snapshotSha256"],
                                "snapshotMatches": snapshot_hash == item["snapshotSha256"],
                                "externalAndSnapshotEqual": external_hash == snapshot_hash}
    host = request["host"]
    host_hash = sha(pathlib.Path(host["path"]).resolve())
    font = request["font"]
    font_hash = sha(pathlib.Path(font["path"]).resolve())

    source_matches = pptx_hash == report["source"]["sha256"] == report["source"]["reopenedSha256"]
    raster_records_match = (original_raster_hash == report["original"]["raster"]["sha256"] and
                            reopened_raster_hash == report["reopened"]["raster"]["sha256"])
    raster_persisted = original_raster_hash == reopened_raster_hash and original_png == reopened_png
    request_snapshot_hash = sha(contained(request["verifier"]["snapshotPath"]))
    expected_font_exact = all(row["fontsExact"] and row["fontSizesExact"]
                              for observation in (original, reopened)
                              for row in [{"fontsExact": all(rec[key] == font["name"] for key in ("leadingTabFontName", "tabTextFontName", "literalTextFontName")),
                                           "fontSizesExact": all(float(rec[key]) == float(font["size"]) for key in ("leadingTabFontSize", "tabTextFontSize", "literalTextFontSize"))}
                                          for rec in observation["records"]])

    native_calls_succeeded = stage_info["nativeCallsSucceeded"] and stage_info["criticalLifecycleMilestonesPassed"]
    worker_postprocessing_failed = (worker.get("exitCode") != 0 and not worker.get("timedOut") and
                                     report.get("lastStage") == "worker.failure" and
                                     "Measure-Object" in (report.get("error") or "") or
                                     (worker.get("exitCode") != 0 and not worker.get("timedOut") and
                                      report.get("lastStage") == "worker.failure" and
                                      "Property" in (report.get("error") or "")))
    worker_postprocessing_failed = bool(worker_postprocessing_failed)
    cleanup_confirmed = report.get("cleanupConfirmed") is True and supervisor.get("cleanupConfirmed") is True and not worker.get("timedOut")

    checks = {
        "allNineOriginalAndReopenedRecordsPresent": len(original["records"]) == 9 and len(reopened["records"]) == 9 and len(targets) == 9,
        "exactTabAndFontInOriginal": original_invariants["allExactTabAndFontChecksPassed"],
        "exactTabAndFontInReopened": reopened_invariants["allExactTabAndFontChecksPassed"],
        "phaseObservationPersistence": persistence_pass,
        "sourcePptxPathAndShaStable": source_matches,
        "sourceRasterPathsAndHashesMatchReport": raster_records_match,
        "rasterBytesPersistAfterReopen": raster_persisted,
        "verifierAndHelperSnapshotsMatchRecorded": all(v["snapshotMatches"] for v in input_results.values()),
        "processHelperExternalMatchesRecorded": input_results["processHelper"]["externalMatches"],
        "pptxXmlTabsAndFontsMatch": xml_tab_font["passed"],
        "hostSnapshotMatches": host_hash == host["sha256"],
        "fontHashMatches": font_hash == font["sha256"],
        "zipCrcAndXmlValid": archive_info["archiveStructurePassed"],
        "nativeLifecycleCallsSucceeded": native_calls_succeeded,
        "nativeLifecycleCleanupConfirmed": cleanup_confirmed,
        "workerPostprocessingFailureCaptured": worker_postprocessing_failed,
    }

    report_out = {
        "schemaVersion": 1,
        "scope": "Independent offline recomputation from raw native observations, request, lifecycle log, owned PPTX and rasters. No Office calls or source edits were made.",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "auditScript": str(pathlib.Path(__file__).resolve()),
        "auditScriptSha256": sha(pathlib.Path(__file__).resolve()),
        "inputs": {
            "runDir": str(RUN.resolve()),
            "rawReportPath": str(report_path.resolve()), "rawReportSha256": sha(report_path),
            "requestPath": str(request_path.resolve()), "requestSha256": sha(request_path),
            "workerPath": str((RUN / "worker.json").resolve()), "workerSha256": sha(RUN / "worker.json"),
            "supervisorPath": str((RUN / "supervisor.json").resolve()), "supervisorSha256": sha(RUN / "supervisor.json"),
            "stagesPath": str((RUN / "stages.jsonl").resolve()), "stagesSha256": sha(RUN / "stages.jsonl"),
            "ownedPaths": path_mappings,
            "ownedSha256": {"pptx": pptx_hash, "originalRaster": original_raster_hash, "reopenedRaster": reopened_raster_hash},
            "host": {"path": host["path"], "actualSha256": host_hash, "expectedSha256": host["sha256"]},
            "font": {"path": font["path"], "actualSha256": font_hash, "expectedSha256": font["sha256"]},
            "sourceInputs": input_results,
            "liveVerifierMatchesRecordedHash": input_results["verifier"]["externalMatches"],
            "liveVerifierDriftNote": (None if input_results["verifier"]["externalMatches"] else
                "Current external verifier differs from the hash recorded in the run request; the retained verifier snapshot still matches the request hash. The audit does not infer when the external file changed."),
        },
        "nativeLifecycle": {
            "nativeCallsSucceeded": native_calls_succeeded,
            "cleanupConfirmed": cleanup_confirmed,
            "officeOperationsStopped": report.get("officeOperationsStopped"),
            "stageAudit": stage_info,
            "worker": {"exitCode": worker.get("exitCode"), "timedOut": worker.get("timedOut"),
                       "supervisorExitCode": supervisor.get("exitCode"), "reportLastStage": report.get("lastStage"),
                       "reportLastStatus": report.get("lastStatus"), "reportError": report.get("error"),
                       "postprocessingFailure": worker_postprocessing_failed,
                       "interpretation": "Native create/save/close/open-read-only/reopen-observe/export/close calls are recorded as successful and cleanup is confirmed. Worker exit 1 is a later metrics-postprocessing failure; report.metrics is null, so independent metrics below are authoritative calculations over raw observations."},
        },
        "observations": {
            "requestedTargetsPoints": targets,
            "tolerancePoints": tolerance,
            "original": {"invariants": original_invariants, "metrics": original_metrics},
            "reopened": {"invariants": reopened_invariants, "metrics": reopened_metrics},
            "persistence": {"passed": persistence_pass, "maximumDeltaPoints": max(item["maximumNumericDeltaPoints"] for item in persistence), "records": persistence},
            "storedReportMetrics": report.get("metrics"),
        },
        "raster": {"originalSha256": original_raster_hash, "reopenedSha256": reopened_raster_hash,
                   "reportHashesMatch": raster_records_match, "byteIdentical": raster_persisted,
                   "bytes": len(original_png), "pngDimensions": list(raster_size) if raster_size else None},
            "presentation": {"sha256": pptx_hash, "matchesSavedAndReopenedReportHashes": source_matches,
                         "zipXmlAudit": archive_info, "tabAndFontXmlAudit": xml_tab_font},
        "checks": checks,
        "auditIntegrityPassed": all(checks.values()),
        "tabOffsetGatePassed": original_metrics["phaseGatePassed"] and reopened_metrics["phaseGatePassed"],
        "limitations": [
            "PowerPoint observations are read from the retained native-run report and ordered stage log; this audit does not repeat the Office calls.",
            "The retained worker report has metrics:null and ends at worker.failure due to the postprocessing Measure-Object/property error; metrics here are independently recomputed from its raw observations.",
            "A completed native lifecycle with confirmed cleanup does not imply the tab-offset gates passed; original and reopened visual tab offsets are separately reported.",
        ],
    }
    OUT.write_text(json.dumps(report_out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"auditIntegrityPassed": report_out["auditIntegrityPassed"],
                      "nativeCallsSucceeded": native_calls_succeeded, "cleanupConfirmed": cleanup_confirmed,
                      "tabOffsetGatePassed": report_out["tabOffsetGatePassed"],
                      "originalMaxTabError": original_metrics["maxTabErrorPoints"],
                      "reopenedMaxTabError": reopened_metrics["maxTabErrorPoints"],
                      "rasterByteIdentical": raster_persisted, "workerExitCode": worker.get("exitCode"),
                      "report": str(OUT.resolve())}))
    if not report_out["auditIntegrityPassed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
