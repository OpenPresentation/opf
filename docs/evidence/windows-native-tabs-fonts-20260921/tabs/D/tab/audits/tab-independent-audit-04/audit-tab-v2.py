"""Independent stdlib audit of the final native tab-control run.

Offline only. This reads retained JSON, JSONL, PNG, and PPTX evidence and never
starts or automates Office. It refuses to overwrite its result.
"""
from __future__ import annotations

import hashlib
import json
import math
import pathlib
import struct
import sys
import zipfile
import zlib
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any


ARTIFACT_ROOT = pathlib.Path(__file__).resolve().parents[1]
RUN = ARTIFACT_ROOT / "native-tab-v2-04"
OUT = pathlib.Path(__file__).resolve().parent / "audit-report-v2.json"
PERSISTENCE_FIELDS = [
    "tabStopPoints", "tabShapeLeft", "tabShapeTop", "literalShapeLeft", "literalShapeTop",
    "leadingTabBoundLeft", "leadingTabBoundTop", "leadingTabBoundWidth", "leadingTabBoundHeight",
    "tabTextBoundLeft", "tabTextBoundTop", "tabTextBoundWidth", "tabTextBoundHeight",
    "literalTextBoundLeft", "literalTextBoundTop", "literalTextBoundWidth", "literalTextBoundHeight",
    "leadingTabFontSize", "tabTextFontSize", "literalTextFontSize",
]
EXACT_PERSISTENCE_FIELDS = [
    "index", "targetPoints", "tabStopCount", "tabShapeName", "literalShapeName",
    "actualTabText", "literalText", "leadingTabFontName", "tabTextFontName", "literalTextFontName",
]
NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: pathlib.Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def owned_path(path_text: str) -> pathlib.Path:
    path = pathlib.Path(path_text).resolve()
    if not path.is_relative_to(RUN.resolve()):
        raise AssertionError(f"owned path escaped run directory: {path}")
    return path


def exact_differences(expected: Any, actual: Any, prefix: str = "$") -> list[dict[str, Any]]:
    differences: list[dict[str, Any]] = []
    if (isinstance(expected, (int, float)) and not isinstance(expected, bool) and
            isinstance(actual, (int, float)) and not isinstance(actual, bool)):
        if expected != actual:
            differences.append({"path": prefix, "expected": expected, "actual": actual,
                                "reason": "numeric value differs"})
        return differences
    if type(expected) is not type(actual):
        return [{"path": prefix, "expected": expected, "actual": actual,
                 "reason": f"type {type(expected).__name__} != {type(actual).__name__}"}]
    if isinstance(expected, dict):
        if expected.keys() != actual.keys():
            differences.append({"path": prefix, "expectedKeys": list(expected),
                                "actualKeys": list(actual), "reason": "keys differ"})
        for key in expected.keys() & actual.keys():
            differences.extend(exact_differences(expected[key], actual[key], f"{prefix}.{key}"))
    elif isinstance(expected, list):
        if len(expected) != len(actual):
            differences.append({"path": prefix, "expectedLength": len(expected),
                                "actualLength": len(actual), "reason": "length differs"})
        for index, (left, right) in enumerate(zip(expected, actual)):
            differences.extend(exact_differences(left, right, f"{prefix}[{index}]"))
    elif expected != actual:
        differences.append({"path": prefix, "expected": expected, "actual": actual,
                            "reason": "value differs"})
    return differences


def recompute_phase(observation: dict[str, Any], tolerance: float) -> dict[str, Any]:
    rows = []
    maximum_tab_error = 0.0
    maximum_literal_error = 0.0
    maximum_pair_delta = 0.0
    tab_gate = True
    literal_gate = True
    pair_gate = True
    for record in observation["records"]:
        tab_offset = float(record["tabTextBoundLeft"]) - float(record["leadingTabBoundLeft"])
        literal_offset = float(record["literalTextBoundLeft"]) - float(record["tabShapeLeft"])
        tab_error = abs(tab_offset - float(record["targetPoints"]))
        literal_error = abs(literal_offset - float(record["targetPoints"]))
        pair_delta = abs(tab_offset - literal_offset)
        maximum_tab_error = max(maximum_tab_error, tab_error)
        maximum_literal_error = max(maximum_literal_error, literal_error)
        maximum_pair_delta = max(maximum_pair_delta, pair_delta)
        tab_gate = tab_gate and tab_error <= tolerance
        literal_gate = literal_gate and literal_error <= tolerance
        pair_gate = pair_gate and pair_delta <= tolerance
        rows.append({
            "index": record["index"],
            "targetPoints": record["targetPoints"],
            "actualTabOffsetPoints": tab_offset,
            "actualLiteralOffsetPoints": literal_offset,
            "tabErrorPoints": tab_error,
            "literalErrorPoints": literal_error,
            "tabMinusLiteralPoints": tab_offset - literal_offset,
            "tabGatePassed": tab_error <= tolerance,
            "literalGatePassed": literal_error <= tolerance,
            "pairAgreementGatePassed": pair_delta <= tolerance,
        })
    return {
        "phase": observation["phase"],
        "tolerancePoints": tolerance,
        "tabGatePassed": tab_gate,
        "literalGatePassed": literal_gate,
        "pairAgreementGatePassed": pair_gate,
        "maximumTabErrorPoints": maximum_tab_error,
        "maximumLiteralErrorPoints": maximum_literal_error,
        "maximumPairDeltaPoints": maximum_pair_delta,
        "records": rows,
    }


def recompute_persistence(original: dict[str, Any], reopened: dict[str, Any], tolerance: float) -> dict[str, Any]:
    rows = []
    maximum = 0.0
    if len(original["records"]) != len(reopened["records"]):
        raise AssertionError("original/reopened record counts differ")
    for index, (before, after) in enumerate(zip(original["records"], reopened["records"])):
        deltas = {}
        record_maximum = 0.0
        for field in PERSISTENCE_FIELDS:
            delta = abs(float(before[field]) - float(after[field]))
            deltas[field] = delta
            maximum = max(maximum, delta)
            record_maximum = max(record_maximum, delta)
        rows.append({"index": index, "maximumDeltaPoints": record_maximum, "deltas": deltas})
    return {"tolerancePoints": tolerance, "gatePassed": maximum <= tolerance,
            "maximumDeltaPoints": maximum, "records": rows}


def recompute_content(original: dict[str, Any], reopened: dict[str, Any], request: dict[str, Any]) -> dict[str, Any]:
    failures: list[str] = []
    for observation in (original, reopened):
        phase = observation["phase"]
        if observation["slideCount"] != 1:
            failures.append(f"{phase}: slideCount={observation['slideCount']}")
        if observation["shapeCount"] != 18:
            failures.append(f"{phase}: shapeCount={observation['shapeCount']}")
        if len(observation["records"]) != 9:
            failures.append(f"{phase}: recordCount={len(observation['records'])}")
        for record in observation["records"]:
            index = record["index"]
            if record["tabShapeName"] != f"tab-{index}" or record["literalShapeName"] != f"literal-{index}":
                failures.append(f"{phase} pair {index}: shape names changed")
            if (record["actualTabText"] != request["literals"]["tabText"] or
                    record["literalText"] != request["literals"]["beforeText"]):
                failures.append(f"{phase} pair {index}: literal text changed")
            if record["tabStopCount"] != 1:
                failures.append(f"{phase} pair {index}: tabStopCount={record['tabStopCount']}")
            for name in (record["leadingTabFontName"], record["tabTextFontName"], record["literalTextFontName"]):
                if name.casefold() != request["font"]["name"].casefold():
                    failures.append(f"{phase} pair {index}: font={name}")
            for size in (record["leadingTabFontSize"], record["tabTextFontSize"], record["literalTextFontSize"]):
                if abs(float(size) - float(request["font"]["size"])) > 0.02:
                    failures.append(f"{phase} pair {index}: fontSize={size}")
    return {"passed": not failures, "failures": failures}


def observation_audit(observation: dict[str, Any], request: dict[str, Any]) -> dict[str, Any]:
    failures = []
    targets = request["targets"]
    records = observation["records"]
    if observation["slideCount"] != 1 or observation["shapeCount"] != 18:
        failures.append("slide or shape count differs from 1/18")
    if float(observation["slideWidth"]) != 960.0 or float(observation["slideHeight"]) != 540.0:
        failures.append("slide dimensions differ from 960 x 540 points")
    if len(records) != 9:
        failures.append(f"record count {len(records)} != 9")
    rows = []
    for index, (record, target) in enumerate(zip(records, targets)):
        numeric_fields = ["targetPoints", *PERSISTENCE_FIELDS]
        finite = all(math.isfinite(float(record[field])) for field in numeric_fields)
        checks = {
            "indexExact": record["index"] == index,
            "targetExact": record["targetPoints"] == target,
            "tabStopWithinTolerance": abs(float(record["tabStopPoints"]) - float(target)) <= float(request["tolerancePoints"]),
            "namesExact": record["tabShapeName"] == f"tab-{index}" and record["literalShapeName"] == f"literal-{index}",
            "textsExact": record["actualTabText"] == request["literals"]["tabText"] and record["literalText"] == request["literals"]["beforeText"],
            "oneTabStop": record["tabStopCount"] == 1,
            "fontsExact": all(record[field] == request["font"]["name"] for field in ("leadingTabFontName", "tabTextFontName", "literalTextFontName")),
            "fontSizesExact": all(float(record[field]) == float(request["font"]["size"]) for field in ("leadingTabFontSize", "tabTextFontSize", "literalTextFontSize")),
            "allNumericValuesFinite": finite,
        }
        if not all(checks.values()):
            failures.append({"index": index, "failed": [name for name, passed in checks.items() if not passed]})
        rows.append({"index": index, "targetPoints": target, "checks": checks})
    return {"passed": not failures, "recordCount": len(records), "records": rows, "failures": failures}


def exact_persistence_audit(original: dict[str, Any], reopened: dict[str, Any]) -> dict[str, Any]:
    failures = []
    for index, (before, after) in enumerate(zip(original["records"], reopened["records"])):
        changed = [field for field in EXACT_PERSISTENCE_FIELDS if before[field] != after[field]]
        if changed:
            failures.append({"index": index, "fields": changed})
    return {"passed": len(original["records"]) == len(reopened["records"]) and not failures,
            "failures": failures}


def stage_audit() -> dict[str, Any]:
    path = RUN / "stages.jsonl"
    rows = [json.loads(line.lstrip("\ufeff")) for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
    sequence_ok = [row["sequence"] for row in rows] == list(range(1, len(rows) + 1))
    stack: list[str] = []
    pairing_errors = []
    standalone = []
    for row in rows:
        if row["status"] == "begin":
            stack.append(row["stage"])
        elif stack:
            expected = stack.pop()
            if row["status"] != "success" or row["stage"] != expected:
                pairing_errors.append({"sequence": row["sequence"], "expected": expected,
                                       "stage": row["stage"], "status": row["status"]})
        else:
            standalone.append({"sequence": row["sequence"], "stage": row["stage"], "status": row["status"]})
    expected_standalone = [
        "worker.initialize", "original.presentation.cleanup", "reopened.presentation.cleanup", "worker.complete"
    ]
    required = [
        "application.create", "create.presentation.add", "create.presentation.saveAs",
        "original.export.png", "original.presentation.close", "reopen.presentation.open-readonly",
        "reopened.export.png", "reopened.presentation.close",
    ]
    counts: dict[str, dict[str, int]] = {}
    for row in rows:
        counts.setdefault(row["stage"], {})
        counts[row["stage"]][row["status"]] = counts[row["stage"]].get(row["status"], 0) + 1
    required_ok = all(counts.get(name, {}).get("begin") == 1 and counts[name].get("success") == 1 for name in required)
    errors = [row for row in rows if row["status"] == "error"]
    progress = read_json(RUN / "progress.json")
    last = rows[-1]
    progress_matches = all(progress.get(key) == last.get(key) for key in (
        "sequence", "timestamp", "stage", "status", "error", "cleanupConfirmed", "officeOperationsStopped", "ownedPresentationPath"
    ))
    standalone_names = [row["stage"] for row in standalone]
    return {
        "passed": sequence_ok and not stack and not pairing_errors and not errors and required_ok and
                  standalone_names == expected_standalone and progress_matches,
        "rowCount": len(rows), "beginCount": sum(row["status"] == "begin" for row in rows),
        "successCount": sum(row["status"] == "success" for row in rows),
        "sequenceContiguous": sequence_ok, "unclosedBeginStages": stack,
        "pairingErrors": pairing_errors, "errorEvents": errors,
        "standaloneTerminalEvents": standalone, "expectedStandaloneStages": expected_standalone,
        "criticalLifecycle": {name: counts.get(name, {}) for name in required},
        "criticalLifecyclePassed": required_ok, "progressMatchesLastStage": progress_matches,
        "lastStage": last,
    }


def png_audit(path: pathlib.Path) -> dict[str, Any]:
    data = path.read_bytes()
    valid_signature = data.startswith(b"\x89PNG\r\n\x1a\n")
    offset = 8
    chunks = []
    crc_failures = []
    width = height = None
    ended = False
    while valid_signature and offset + 12 <= len(data):
        length = struct.unpack(">I", data[offset:offset + 4])[0]
        chunk_type = data[offset + 4:offset + 8]
        end = offset + 12 + length
        if end > len(data):
            crc_failures.append("truncated chunk")
            break
        payload = data[offset + 8:offset + 8 + length]
        recorded_crc = struct.unpack(">I", data[offset + 8 + length:end])[0]
        calculated_crc = zlib.crc32(chunk_type + payload) & 0xFFFFFFFF
        name = chunk_type.decode("ascii", errors="replace")
        chunks.append(name)
        if recorded_crc != calculated_crc:
            crc_failures.append(name)
        if name == "IHDR" and length == 13:
            width, height = struct.unpack(">II", payload[:8])
        offset = end
        if name == "IEND":
            ended = True
            break
    return {"passed": valid_signature and ended and offset == len(data) and not crc_failures,
            "bytes": len(data), "sha256": sha256(path), "width": width, "height": height,
            "chunks": chunks, "crcFailures": crc_failures}


def pptx_audit(path: pathlib.Path, request: dict[str, Any]) -> dict[str, Any]:
    malformed = []
    required_members = {"[Content_Types].xml", "ppt/presentation.xml", "ppt/slides/slide1.xml"}
    with zipfile.ZipFile(path, "r") as archive:
        names = archive.namelist()
        bad_member = archive.testzip()
        xml_members = [name for name in names if name.endswith((".xml", ".rels"))]
        for name in xml_members:
            try:
                ET.fromstring(archive.read(name))
            except Exception as exc:
                malformed.append({"member": name, "error": str(exc)})
        presentation = ET.fromstring(archive.read("ppt/presentation.xml"))
        slide_count = len(presentation.findall("./p:sldIdLst/p:sldId", NS))
        slide = ET.fromstring(archive.read("ppt/slides/slide1.xml"))
        shapes = {}
        for shape in slide.findall(".//p:sp", NS):
            props = shape.find("./p:nvSpPr/p:cNvPr", NS)
            name = props.attrib.get("name", "") if props is not None else ""
            if not name.startswith(("tab-", "literal-")):
                continue
            text = "".join(node.text or "" for node in shape.findall(".//a:t", NS))
            tabs = shape.findall("./p:txBody/a:p/a:pPr/a:tabLst/a:tab", NS)
            typefaces = [node.attrib.get("typeface") for node in shape.findall(".//a:latin", NS)]
            sizes = [node.attrib.get("sz") for node in shape.findall(".//a:rPr", NS) if "sz" in node.attrib]
            shapes[name] = {"text": text, "tabStopEmu": [node.attrib.get("pos") for node in tabs],
                            "latinTypefaces": typefaces, "fontSizesHundredthPoint": sizes}
        embedded_fonts = [name for name in names if name.lower().endswith(
            (".fntdata", ".odttf", ".ttf", ".otf", ".woff", ".woff2"))]
        macro_members = [name for name in names if name.lower().endswith("vbaProject.bin".lower())]

    shape_checks = []
    for index, target in enumerate(request["targets"]):
        tab = shapes.get(f"tab-{index}")
        literal = shapes.get(f"literal-{index}")
        tab_points = [int(value) / 12700.0 for value in tab["tabStopEmu"]] if tab else []
        shape_checks.append({
            "index": index,
            "tabShapePresent": tab is not None,
            "literalShapePresent": literal is not None,
            "tabTextExact": bool(tab and tab["text"] == request["literals"]["tabText"]),
            "literalTextExact": bool(literal and literal["text"] == request["literals"]["beforeText"]),
            "oneTabStopWithinTolerance": len(tab_points) == 1 and abs(tab_points[0] - float(target)) <= float(request["tolerancePoints"]),
            "tabStopPoints": tab_points,
            "tabFontExact": bool(tab and tab["latinTypefaces"] and all(value == request["font"]["name"] for value in tab["latinTypefaces"])),
            "literalFontExact": bool(literal and literal["latinTypefaces"] and all(value == request["font"]["name"] for value in literal["latinTypefaces"])),
            "fontSizesExact": bool(tab and literal and
                                   all(value == str(int(float(request["font"]["size"]) * 100))
                                       for value in tab["fontSizesHundredthPoint"] + literal["fontSizesHundredthPoint"])),
        })
    shape_inventory = len(shapes) == 18 and set(shapes) == {
        *(f"tab-{index}" for index in range(9)), *(f"literal-{index}" for index in range(9))
    }
    per_shape_pass = all(all(row[key] for key in (
        "tabShapePresent", "literalShapePresent", "tabTextExact", "literalTextExact",
        "oneTabStopWithinTolerance", "tabFontExact", "literalFontExact", "fontSizesExact"
    )) for row in shape_checks)
    passed = (bad_member is None and not malformed and required_members.issubset(names) and
              slide_count == 1 and shape_inventory and per_shape_pass and not embedded_fonts and not macro_members)
    return {
        "passed": passed, "zipCrcPassed": bad_member is None, "badZipMember": bad_member,
        "memberCount": len(names), "requiredMembersPresent": required_members.issubset(names),
        "xmlRelationshipMemberCount": len(xml_members), "malformedXml": malformed,
        "slideCount": slide_count, "shapeInventoryExact": shape_inventory,
        "shapeChecks": shape_checks, "embeddedFontMembers": embedded_fonts, "macroMembers": macro_members,
    }


def input_hash_audit(request: dict[str, Any], report: dict[str, Any]) -> dict[str, Any]:
    results = {}
    for field in ("verifier", "processHelper"):
        requested = request[field]
        reported = report["inputs"][field]
        snapshot = owned_path(requested["snapshotPath"])
        snapshot_hash = sha256(snapshot)
        live = pathlib.Path(requested["path"]).resolve()
        live_hash = sha256(live)
        results[field] = {
            "snapshotPath": str(snapshot), "snapshotSha256": snapshot_hash,
            "snapshotMatchesRequest": snapshot_hash == requested["snapshotSha256"] == requested["sha256"],
            "snapshotMatchesReport": snapshot_hash == reported["snapshotSha256"] == reported["sha256"],
            "livePath": str(live), "liveSha256": live_hash,
            "liveMatchesRecorded": live_hash == requested["sha256"],
        }
    return results


def numeric_phase_differences(left: dict[str, Any], right: dict[str, Any]) -> list[dict[str, Any]]:
    output = []
    scalar_fields = ["maximumTabErrorPoints", "maximumLiteralErrorPoints", "maximumPairDeltaPoints"]
    record_fields = ["actualTabOffsetPoints", "actualLiteralOffsetPoints", "tabErrorPoints",
                     "literalErrorPoints", "tabMinusLiteralPoints"]
    for field in scalar_fields:
        delta = float(right[field]) - float(left[field])
        if delta:
            output.append({"path": field, "deltaPoints": delta})
    for index, (before, after) in enumerate(zip(left["records"], right["records"])):
        for field in record_fields:
            delta = float(after[field]) - float(before[field])
            if delta:
                output.append({"path": f"records[{index}].{field}", "deltaPoints": delta})
    return output


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

    pptx = owned_path(report["source"]["path"])
    original_png_path = owned_path(report["original"]["raster"]["path"])
    reopened_png_path = owned_path(report["reopened"]["raster"]["path"])
    pptx_hash = sha256(pptx)
    original_png_hash = sha256(original_png_path)
    reopened_png_hash = sha256(reopened_png_path)
    source_stable = pptx_hash == report["source"]["sha256"] == report["source"]["reopenedSha256"]
    raster_stable = (original_png_hash == report["original"]["raster"]["sha256"] ==
                     reopened_png_hash == report["reopened"]["raster"]["sha256"] and
                     original_png_path.read_bytes() == reopened_png_path.read_bytes())

    recomputed_original = recompute_phase(original, tolerance)
    recomputed_reopened = recompute_phase(reopened, tolerance)
    recomputed_persistence = recompute_persistence(original, reopened, tolerance)
    recomputed_content_result = recompute_content(original, reopened, request)
    recomputed_metrics = {
        "tolerancePoints": tolerance,
        "original": recomputed_original,
        "reopened": recomputed_reopened,
        "persistence": recomputed_persistence,
        "content": recomputed_content_result,
        "rasterStable": raster_stable,
        "sourceStable": source_stable,
    }
    metric_differences = exact_differences(report["metrics"], recomputed_metrics)

    original_observation = observation_audit(original, request)
    reopened_observation = observation_audit(reopened, request)
    exact_persistence = exact_persistence_audit(original, reopened)
    stages = stage_audit()
    original_png = png_audit(original_png_path)
    reopened_png = png_audit(reopened_png_path)
    presentation = pptx_audit(pptx, request)
    source_inputs = input_hash_audit(request, report)

    host_hash = sha256(pathlib.Path(request["host"]["path"]).resolve())
    font_hash = sha256(pathlib.Path(request["font"]["path"]).resolve())
    office_hash = sha256(pathlib.Path(report["environment"]["powerPointExecutable"]).resolve())

    replay_path = RUN / "metrics.root-replay.json"
    precision_path = RUN / "root-precision-check.json"
    replay = read_json(replay_path)
    precision = read_json(precision_path)
    replay_original_differences = numeric_phase_differences(report["metrics"]["original"], replay["metrics"]["original"])
    replay_reopened_differences = numeric_phase_differences(report["metrics"]["reopened"], replay["metrics"]["reopened"])
    replay_max_delta = max([abs(item["deltaPoints"]) for item in
                            replay_original_differences + replay_reopened_differences] or [0.0])
    replay_gates_same = all(
        replay["metrics"][phase][gate] == report["metrics"][phase][gate]
        for phase in ("original", "reopened")
        for gate in ("tabGatePassed", "literalGatePassed", "pairAgreementGatePassed")
    )

    worker_success = (worker["exitCode"] == 0 and worker["timedOut"] is False and
                      supervisor["exitCode"] == 0 and supervisor["timedOut"] is False and
                      supervisor["cleanupConfirmed"] is True and report["cleanupConfirmed"] is True and
                      report["officeOperationsStopped"] is False and report["lastStage"] == "worker.complete" and
                      report["lastStatus"] == "success" and report["error"] is None)
    request_report_alignment = (
        request["targets"] == report["requested"]["targets"] and
        request["literals"] == report["requested"]["literals"] and
        request["font"]["name"] == report["requested"]["font"]["name"] and
        request["font"]["size"] == report["requested"]["font"]["size"] and
        request["tolerancePoints"] == report["requested"]["tolerancePoints"]
    )
    expected_native_failure = (
        recomputed_original["tabGatePassed"] is False and
        recomputed_original["literalGatePassed"] is True and
        recomputed_original["pairAgreementGatePassed"] is False and
        recomputed_reopened["tabGatePassed"] is False and
        recomputed_reopened["literalGatePassed"] is True and
        recomputed_reopened["pairAgreementGatePassed"] is False
    )

    checks = {
        "workerLifecyclePassed": worker_success,
        "durableStagesPassed": stages["passed"],
        "requestAndReportAlign": request_report_alignment,
        "allNineOriginalObservationsValid": original_observation["passed"],
        "allNineReopenedObservationsValid": reopened_observation["passed"],
        "exactFieldsPersistedAcrossReopen": exact_persistence["passed"],
        "storedMetricsExactlyRecomputedFromFullPrecisionObservations": not metric_differences,
        "storedPhaseMetricsCoverAllNineRecords": (len(recomputed_original["records"]) == 9 and
                                                   len(recomputed_reopened["records"]) == 9),
        "storedPersistenceExactlyRecomputed": report["metrics"]["persistence"] == recomputed_persistence,
        "storedContentExactlyRecomputed": report["metrics"]["content"] == recomputed_content_result,
        "contentAndFontsPassed": recomputed_content_result["passed"],
        "expectedNativePoint02FailureCapturedSeparately": expected_native_failure,
        "presentationHashStable": source_stable,
        "presentationZipCrcXmlAndDrawingMlPassed": presentation["passed"],
        "pngHashesBytesAndStructurePassed": raster_stable and original_png["passed"] and reopened_png["passed"],
        "snapshotHashesMatchRecorded": all(item["snapshotMatchesRequest"] and item["snapshotMatchesReport"]
                                            for item in source_inputs.values()),
        "hostFontAndOfficeHashesMatchRecorded": (
            host_hash == request["host"]["sha256"] == report["environment"]["hostExecutableSha256"] and
            font_hash == request["font"]["sha256"] == report["environment"]["calibriSha256"] and
            office_hash == report["environment"]["powerPointExecutableSha256"]
        ),
        "rootPrecisionCheckConfirmsPythonExactReplay": (
            precision.get("pythonBinaryDoubleMetricsExactlyMatch") is True and not precision.get("differences")
        ),
        "powershellReplayRepresentationDifferenceIsBoundedAndGateStable": (
            replay["regression"]["officeOrComCalls"] == 0 and
            replay["regression"]["exactAndNativeStyleMetricsIdentical"] is True and
            replay_gates_same and replay_max_delta < 3e-14
        ),
    }

    result = {
        "schemaVersion": 1,
        "scope": "Independent Python-stdlib audit of retained native-tab-v2-04 bytes. No Office, COM, UI, or source mutation.",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "auditScript": {"path": str(pathlib.Path(__file__).resolve()),
                        "sha256": sha256(pathlib.Path(__file__).resolve())},
        "inputs": {
            "runDirectory": str(RUN.resolve()),
            "report": {"path": str(report_path.resolve()), "sha256": sha256(report_path)},
            "request": {"path": str(request_path.resolve()), "sha256": sha256(request_path)},
            "worker": {"path": str((RUN / "worker.json").resolve()), "sha256": sha256(RUN / "worker.json")},
            "supervisor": {"path": str((RUN / "supervisor.json").resolve()), "sha256": sha256(RUN / "supervisor.json")},
            "stages": {"path": str((RUN / "stages.jsonl").resolve()), "sha256": sha256(RUN / "stages.jsonl")},
            "powershellReplay": {"path": str(replay_path.resolve()), "sha256": sha256(replay_path)},
            "rootPrecisionCheck": {"path": str(precision_path.resolve()), "sha256": sha256(precision_path)},
            "sourceInputs": source_inputs,
        },
        "nativeLifecycle": {"passed": worker_success, "worker": worker, "supervisor": supervisor,
                            "reportTerminal": {key: report.get(key) for key in
                                               ("cleanupConfirmed", "officeOperationsStopped", "lastStage", "lastStatus", "error")},
                            "stages": stages},
        "observations": {"original": original_observation, "reopened": reopened_observation,
                         "exactPersistence": exact_persistence},
        "metricPrecision": {
            "storedMetricsExactlyRecomputed": not metric_differences,
            "exactDifferences": metric_differences,
            "recomputed": recomputed_metrics,
            "nativeTolerancePoint02GatePassed": not expected_native_failure,
            "interpretation": "The worker and owned lifecycle passed. The observed native tab-target and pair-agreement results fail the separate 0.02-point gates in both phases; this is fidelity evidence, not a worker failure.",
            "powershellReplay": {
                "phaseNumericDifferences": {"original": replay_original_differences,
                                            "reopened": replay_reopened_differences},
                "maximumAbsoluteDifferencePoints": replay_max_delta,
                "phaseGatesUnchanged": replay_gates_same,
                "note": "Windows PowerShell 5.1 ConvertFrom-Json materializes JSON numbers as Decimal before the verifier casts them to Double. Index 8 offsets therefore differ by roughly 1.4e-14 points from direct binary-double JSON replay, and their subtraction differs by roughly 2.8e-14 points; maxima and gates are unchanged.",
            },
        },
        "presentation": {"path": str(pptx), "sha256": pptx_hash,
                         "hashMatchesSavedAndReopened": source_stable, "package": presentation},
        "rasters": {"byteIdentical": raster_stable, "original": original_png, "reopened": reopened_png},
        "environmentHashes": {"host": host_hash, "font": font_hash, "powerPointExecutable": office_hash},
        "checks": checks,
        "auditIntegrityPassed": all(checks.values()),
        "nativeTolerancePoint02GatePassed": not expected_native_failure,
        "limitations": [
            "This audit validates retained bytes and observations; it does not repeat the native Office calls.",
            "Raster byte stability verifies save/reopen persistence for this run, not universal pixel equivalence.",
            "The PowerShell replay's Decimal-to-Double conversion is reported separately from the exact Python binary-double replay of the JSON observations.",
        ],
    }
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    summary = {
        "auditIntegrityPassed": result["auditIntegrityPassed"],
        "workerLifecyclePassed": worker_success,
        "cleanupConfirmed": report["cleanupConfirmed"],
        "storedMetricsExactlyRecomputed": not metric_differences,
        "allNineRecordsPerPhase": len(recomputed_original["records"]) == len(recomputed_reopened["records"]) == 9,
        "nativeTolerancePoint02GatePassed": result["nativeTolerancePoint02GatePassed"],
        "maximumTabErrorPoints": recomputed_original["maximumTabErrorPoints"],
        "maximumPairDeltaPoints": recomputed_original["maximumPairDeltaPoints"],
        "report": str(OUT.resolve()),
    }
    print(json.dumps(summary, separators=(",", ":")))
    if not result["auditIntegrityPassed"]:
        print(json.dumps({key: value for key, value in checks.items() if not value}, indent=2), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
