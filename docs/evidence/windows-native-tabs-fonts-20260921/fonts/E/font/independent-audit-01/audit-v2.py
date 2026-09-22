#!/usr/bin/env python3
"""Offline, read-only audit of native-font-edit-01. Python stdlib only."""
from __future__ import annotations

import hashlib
import json
import os
import struct
import sys
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from xml.etree import ElementTree as ET


AUDIT_DIR = Path(__file__).resolve().parent
ROOT = AUDIT_DIR.parent
RUN = ROOT / "native-font-edit-01"
FIXTURE = ROOT / "font-edit-fixture-01"
CONSUMER = ROOT / "registry-consumer"
SOURCE = ROOT / "sources" / "opf-pptx" / "test"
REPORT_OUT = AUDIT_DIR / "report-v2.json"
EXPECTED_FACES = {
    "fonts/Carlito-400-normal.ttf": ("Carlito", "Regular"),
    "fonts/Carlito-400-italic.ttf": ("Carlito", "Italic"),
    "fonts/Carlito-700-normal.ttf": ("Carlito", "Bold"),
    "fonts/Carlito-700-italic.ttf": ("Carlito", "Bold Italic"),
}
EXPECTED_BODY = "Regular 18 | Bold 20 | Italic 22 | BoldItalic 24"
EXPECTED_RUNS = [
    {"start": 1, "length": 10, "text": "Regular 18", "size": 18, "bold": 0, "italic": 0},
    {"start": 14, "length": 7, "text": "Bold 20", "size": 20, "bold": -1, "italic": 0},
    {"start": 24, "length": 9, "text": "Italic 22", "size": 22, "bold": 0, "italic": -1},
    {"start": 36, "length": 13, "text": "BoldItalic 24", "size": 24, "bold": -1, "italic": -1},
]

checks: list[dict] = []
details: dict = {}


def check(name: str, passed: bool, evidence=None) -> None:
    checks.append({"name": name, "passed": bool(passed), "evidence": evidence})


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def load_json(path: Path):
    with path.open("r", encoding="utf-8-sig") as f:
        return json.load(f, parse_float=Decimal)


def jsonable(obj):
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, Path):
        return str(obj)
    if isinstance(obj, dict):
        return {str(k): jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [jsonable(v) for v in obj]
    return obj


def png_info(path: Path) -> dict:
    with path.open("rb") as f:
        header = f.read(24)
    if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise ValueError("not a PNG with an IHDR chunk")
    width, height = struct.unpack(">II", header[16:24])
    return {"width": width, "height": height}


def ttf_identity(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 12:
        raise ValueError("short sfnt header")
    signature = data[:4].hex()
    count = struct.unpack_from(">H", data, 4)[0]
    tables = {}
    for i in range(count):
        pos = 12 + i * 16
        if pos + 16 > len(data):
            raise ValueError("truncated table directory")
        tag, _checksum, offset, length = struct.unpack_from(">4sIII", data, pos)
        if offset + length > len(data):
            raise ValueError(f"table outside file: {tag!r}")
        tables[tag.decode("ascii", "replace")] = (offset, length)
    if "name" not in tables:
        raise ValueError("missing name table")
    off, length = tables["name"]
    name_table = data[off : off + length]
    fmt, name_count, string_offset = struct.unpack_from(">HHH", name_table, 0)
    if fmt not in (0, 1):
        raise ValueError(f"unsupported name table format {fmt}")
    names = defaultdict(set)
    for i in range(name_count):
        pos = 6 + i * 12
        platform, _encoding, _language, name_id, byte_len, byte_off = struct.unpack_from(">HHHHHH", name_table, pos)
        raw = name_table[string_offset + byte_off : string_offset + byte_off + byte_len]
        if platform in (0, 3):
            text = raw.decode("utf-16-be", "replace")
        elif platform == 1:
            text = raw.decode("mac_roman", "replace")
        else:
            text = raw.decode("latin-1", "replace")
        text = text.replace("\x00", "").strip()
        if text and name_id in (1, 2, 4, 6, 16, 17):
            names[name_id].add(text)
    fs_type = None
    if "OS/2" in tables:
        os2off, os2len = tables["OS/2"]
        if os2len >= 10:
            fs_type = struct.unpack_from(">H", data, os2off + 8)[0]
    return {
        "sfntSignature": signature,
        "bytes": len(data),
        "nameTableFormat": fmt,
        "nameRecords": {str(k): sorted(v) for k, v in sorted(names.items())},
        "familyNames": sorted(names.get(1, set()) | names.get(16, set())),
        "subfamilyNames": sorted(names.get(2, set()) | names.get(17, set())),
        "fullNames": sorted(names.get(4, set())),
        "postScriptNames": sorted(names.get(6, set())),
        "os2FsType": fs_type,
    }


def audit() -> dict:
    if REPORT_OUT.exists():
        raise FileExistsError(f"preserve existing report: {REPORT_OUT}")
    request_path = RUN / "request.json"
    report_path = RUN / "report.json"
    supervisor_path = RUN / "supervisor.json"
    stages_path = RUN / "stages.jsonl"
    worker_path = RUN / "worker.json"

    request = load_json(request_path)
    worker_report = load_json(report_path)
    supervisor = load_json(supervisor_path)
    worker = load_json(worker_path)
    generation = load_json(FIXTURE / "generation.json")
    generation_copy = load_json(RUN / "inputs" / "generation.json")

    details["rawRun"] = {
        "requestSha256": sha256(request_path),
        "workerReportSha256": sha256(report_path),
        "supervisorSha256": sha256(supervisor_path),
        "workerSummarySha256": sha256(worker_path),
        "stagesSha256": sha256(stages_path),
        "savedPresentation": {"path": str(RUN / "native-font-edit.pptx"), "sha256": sha256(RUN / "native-font-edit.pptx")},
        "worker": jsonable(worker),
        "supervisor": {
            "exitCode": supervisor.get("exitCode"),
            "timedOut": supervisor.get("timedOut"),
            "officeLifecycleComplete": supervisor.get("officeLifecycleComplete"),
            "metricsGatePassed": supervisor.get("metricsGatePassed"),
            "officeCleanupConfirmed": supervisor.get("officeCleanupConfirmed"),
            "fontCleanupConfirmed": supervisor.get("fontCleanupConfirmed"),
            "inputsUnchanged": supervisor.get("inputsUnchanged"),
            "lastDurableStage": supervisor.get("lastDurableStage"),
            "lastDurableStatus": supervisor.get("lastDurableStatus"),
            "parentError": supervisor.get("parentError"),
        },
    }
    check("supervised_native_lifecycle_passed", bool(
        worker.get("exitCode") == 0
        and worker.get("timedOut") is False
        and supervisor.get("exitCode") == 0
        and supervisor.get("timedOut") is False
        and supervisor.get("officeLifecycleComplete") is True
        and supervisor.get("metricsGatePassed") is True
        and supervisor.get("officeCleanupConfirmed") is True
        and supervisor.get("fontCleanupConfirmed") is True
        and supervisor.get("inputsUnchanged") is True
        and supervisor.get("lastDurableStage") == "worker.complete"
        and supervisor.get("lastDurableStatus") == "success"
        and worker_report.get("cleanupConfirmed") is True
        and worker_report.get("lastStage") == "worker.complete"
        and worker_report.get("lastStatus") == "success"
        and worker_report.get("error") is None
        and worker_report.get("metrics", {}).get("gatePassed") is True
    ), details["rawRun"]["supervisor"])
    check("worker_timeout_bound_recorded", worker.get("timeoutSeconds") == 45 and worker.get("timeoutSeconds") <= 60,
          {"timeoutSeconds": worker.get("timeoutSeconds"), "startedAt": worker.get("startedAt"), "finishedAt": worker.get("finishedAt")})

    # Validate source/consumer package pins and the immutable four-face fixture.
    consumer_lock = CONSUMER / "package-lock.json"
    installed_font_package = CONSUMER / "node_modules" / "@expo-google-fonts" / "carlito" / "package.json"
    installed_render_manifest = CONSUMER / "node_modules" / "@openpresentation" / "opf-render" / "dist" / "font-manifest.js"
    consumer_package_json = load_json(CONSUMER / "package.json")
    installed_font_meta = load_json(installed_font_package)
    consumer_lock_hash = sha256(consumer_lock)
    package_manifest_hash = sha256(installed_font_package)
    render_manifest_hash = sha256(installed_render_manifest)
    expected_font_entries = generation.get("fonts", [])
    face_entries = []
    face_paths = [entry.get("file") for entry in expected_font_entries]
    faces_valid = len(expected_font_entries) == 4 and set(face_paths) == set(EXPECTED_FACES) and len(set(face_paths)) == 4
    for entry in expected_font_entries:
        rel = entry.get("file", "")
        font_path = FIXTURE / Path(rel.replace("/", os.sep))
        snap_path = RUN / "inputs" / Path(rel.replace("/", os.sep))
        expected_family, expected_subfamily = EXPECTED_FACES.get(rel, (None, None))
        actual_hash = sha256(font_path)
        snap_hash = sha256(snap_path)
        identity = ttf_identity(font_path)
        identity_ok = expected_family in identity["familyNames"] and expected_subfamily in identity["subfamilyNames"] and identity["os2FsType"] == 0
        face_entries.append({
            "file": rel,
            "sha256": actual_hash,
            "generationSha256": entry.get("sha256"),
            "snapshotSha256": snap_hash,
            "identity": identity,
            "identityMatchesExpected": identity_ok,
        })
        faces_valid = faces_valid and actual_hash == entry.get("sha256") == snap_hash and identity_ok
    license_path = FIXTURE / generation["license"]["file"]
    license_snap = RUN / "inputs" / generation["license"]["file"]
    license_bytes = license_path.read_bytes()
    license_text = license_bytes.decode("utf-8-sig", "replace")
    license_hash = sha256(license_path)
    license_ok = (
        license_hash == generation["license"]["sha256"]
        and sha256(license_snap) == license_hash
        and generation["license"].get("spdx") == "OFL-1.1"
        and "SIL OPEN FONT LICENSE" in license_text
    )
    lock_pin_ok = consumer_lock_hash == generation.get("registryLockSha256")
    font_manifest_pin_ok = render_manifest_hash == generation.get("fontManifest", {}).get("sha256")
    package_pin_ok = (
        installed_font_meta.get("name") == generation.get("package", {}).get("name")
        and installed_font_meta.get("version") == generation.get("package", {}).get("version")
        and package_manifest_hash == generation.get("package", {}).get("manifestSha256")
    )
    lock_json = load_json(consumer_lock)
    lock_font_version = lock_json.get("packages", {}).get("node_modules/@expo-google-fonts/carlito", {}).get("version")
    lock_render_version = lock_json.get("packages", {}).get("node_modules/@openpresentation/opf-render", {}).get("version")
    version_pins_ok = (
        lock_font_version == generation["package"]["version"]
        and lock_render_version == generation["fontManifest"]["version"]
        and consumer_package_json.get("dependencies", {}).get("@openpresentation/opf-render") == lock_render_version
    )
    details["fontProvenance"] = {
        "generationSha256": sha256(FIXTURE / "generation.json"),
        "generationSnapshotSha256": sha256(RUN / "inputs" / "generation.json"),
        "registrationFlags": generation.get("registration", {}).get("flags"),
        "registrationScope": generation.get("registration", {}).get("scope"),
        "package": generation.get("package"),
        "installedPackageJsonSha256": package_manifest_hash,
        "registryLockSha256": consumer_lock_hash,
        "fontManifest": generation.get("fontManifest"),
        "installedFontManifestSha256": render_manifest_hash,
        "license": {
            "file": generation["license"]["file"],
            "spdx": generation["license"].get("spdx"),
            "sha256": license_hash,
            "snapshotSha256": sha256(license_snap),
            "bytes": len(license_bytes),
            "hasOflText": "SIL OPEN FONT LICENSE" in license_text,
        },
        "faces": face_entries,
        "registrationLedger": jsonable(load_json(RUN / "font-registration.json")),
    }
    check("generation_and_snapshot_match", sha256(FIXTURE / "generation.json") == sha256(RUN / "inputs" / "generation.json"), details["fontProvenance"]["generationSha256"])
    check("four_exact_unique_carlito_face_hashes_and_names_match", faces_valid, face_entries)
    check("license_hash_and_snapshot_match_ofl_1_1", license_ok, details["fontProvenance"]["license"])
    check("font_package_manifest_pin_matches_installed_bytes", package_pin_ok, {"name": installed_font_meta.get("name"), "version": installed_font_meta.get("version"), "sha256": package_manifest_hash})
    check("registry_lock_and_render_font_manifest_pins_match", lock_pin_ok and font_manifest_pin_ok and version_pins_ok, {
        "registryLockSha256": consumer_lock_hash,
        "fontManifestSha256": render_manifest_hash,
        "lockedFontPackageVersion": lock_font_version,
        "lockedRenderVersion": lock_render_version,
    })
    ledger = load_json(RUN / "font-registration.json")
    if isinstance(ledger, dict):
        ledger = [ledger]
    ledger_expected = {entry["file"]: entry["sha256"] for entry in expected_font_entries}
    ledger_ok = len(ledger) == 4 and {row.get("file") for row in ledger} == set(ledger_expected) and all(
        row.get("sha256") == ledger_expected.get(row.get("file")) and row.get("added") == 1 and row.get("removed") is True
        for row in ledger
    )
    check("raw_font_registration_ledger_has_four_owned_add_remove_pairs", ledger_ok, jsonable(ledger))
    helper_path = SOURCE / "native-text-fonts.ps1"
    helper_snapshot = RUN / "inputs" / "native-text-fonts.ps1"
    helper_text = helper_snapshot.read_text(encoding="utf-8-sig")
    helper_flags_ok = (
        "AddFontResourceExW($fontPath,0" in helper_text
        and "RemoveFontResourceExW((Join-Path $EvidenceRoot $face.file),0" in helper_text
        and "foreach($face in $fonts)" in helper_text
        and "finally {" in helper_text
        and "$face.removed=[OpfNativeTextFonts]::RemoveFontResourceExW" in helper_text
    )
    check("hash_pinned_parent_helper_uses_flags_zero_and_removes_owned_additions", helper_flags_ok and sha256(helper_path) == sha256(helper_snapshot), {
        "helperSha256": sha256(helper_path),
        "helperSnapshotSha256": sha256(helper_snapshot),
        "generationFlags": generation.get("registration", {}).get("flags"),
    })

    # Check all 20 supervisor post-run hashes against the bytes on disk.
    input_rows = supervisor.get("inputChecks", [])
    input_results = []
    for row in input_rows:
        path = Path(row["path"])
        try:
            actual = sha256(path)
            exists = True
        except Exception as exc:  # durable independent diagnosis
            actual = None
            exists = False
            row_error = f"{type(exc).__name__}: {exc}"
        else:
            row_error = None
        match = exists and actual == row.get("expected") == row.get("actual") and row.get("matched") is True and row.get("error") is None
        input_results.append({"path": str(path), "expected": row.get("expected"), "supervisorActual": row.get("actual"), "recomputedActual": actual, "matched": match, "error": row_error})
    details["postRunInputHashes"] = input_results
    check("all_20_post_run_input_hashes_independently_match", len(input_results) == 20 and all(r["matched"] for r in input_results), {"count": len(input_results), "mismatches": [r for r in input_results if not r["matched"]]})

    # Native observations, styles, explicit text spans, and exact decimal geometry drift.
    requested = request["expectations"]
    phases = {phase: worker_report[phase]["observation"] for phase in ("original", "edited", "reopened")}
    names = {"title": "OPF heading slides.0.title line 0", "body": "OPF text slides.0.text line 0"}
    phase_summary = {}
    obs_ok = True
    for phase_name, obs in phases.items():
        phase_ok = obs.get("slideCount") == 1 and obs.get("shapeCount") == 2 and len(obs.get("shapes", [])) == 2
        by_role = {shape.get("role"): shape for shape in obs.get("shapes", [])}
        phase_ok = phase_ok and set(by_role) == {"title", "body"}
        for role, shape_name in names.items():
            shape = by_role.get(role, {})
            phase_ok = phase_ok and shape.get("name") == shape_name and shape.get("type") is not None
        if phase_name == "original":
            phase_ok = phase_ok and by_role.get("title", {}).get("whole", {}).get("text") == requested["original"]["title"]
            phase_ok = phase_ok and by_role.get("body", {}).get("whole", {}).get("text") == requested["original"]["body"]
        else:
            title = by_role.get("title", {}).get("whole", {})
            title_exp = requested["title"]
            phase_ok = phase_ok and title.get("text") == title_exp["text"] and title.get("length") == len(title_exp["text"])
            phase_ok = phase_ok and title.get("font", {}).get("name") == title_exp["family"]
            phase_ok = phase_ok and Decimal(str(title.get("font", {}).get("size"))) == Decimal(str(title_exp["size"]))
            phase_ok = phase_ok and title.get("font", {}).get("bold") == (-1 if title_exp["bold"] else 0)
            phase_ok = phase_ok and title.get("font", {}).get("italic") == (-1 if title_exp["italic"] else 0)
            body_shape = by_role.get("body", {})
            body_whole = body_shape.get("whole", {})
            body_exp = requested["body"]
            phase_ok = phase_ok and body_whole.get("text") == body_exp["text"] and body_whole.get("length") == len(body_exp["text"])
            phase_ok = phase_ok and body_whole.get("font", {}).get("name") == body_exp["family"]
            phase_ok = phase_ok and Decimal(str(body_whole.get("font", {}).get("size"))) == Decimal(str(body_exp["defaultSize"]))
            runs = body_shape.get("runs", [])
            phase_ok = phase_ok and len(runs) == 4
            for index, expected in enumerate(EXPECTED_RUNS):
                if index >= len(runs):
                    phase_ok = False
                    continue
                run = runs[index]
                actual = run.get("font", {})
                phase_ok = phase_ok and run.get("text") == expected["text"]
                phase_ok = phase_ok and run.get("length") == expected["length"]
                phase_ok = phase_ok and expected["text"] == EXPECTED_BODY[expected["start"] - 1 : expected["start"] - 1 + expected["length"]]
                phase_ok = phase_ok and actual.get("name") == "Carlito"
                phase_ok = phase_ok and Decimal(str(actual.get("size"))) == Decimal(expected["size"])
                phase_ok = phase_ok and actual.get("bold") == expected["bold"] and actual.get("italic") == expected["italic"]
        phase_summary[phase_name] = {
            "slideCount": obs.get("slideCount"),
            "shapeCount": obs.get("shapeCount"),
            "slideSizePoints": [jsonable(obs.get("slideWidth")), jsonable(obs.get("slideHeight"))],
            "shapes": jsonable(obs.get("shapes", [])),
            "passed": bool(phase_ok),
        }
        obs_ok = obs_ok and phase_ok
    details["observations"] = phase_summary
    check("original_edited_reopened_content_styles_and_four_exact_span_lengths_match", obs_ok, {k: v["passed"] for k, v in phase_summary.items()})

    tolerance = Decimal(str(requested.get("tolerancePoints", "NaN")))
    max_delta = Decimal(0)
    deltas = []
    edited = phases["edited"]
    reopened = phases["reopened"]
    for role in ("title", "body"):
        a = next(s for s in edited["shapes"] if s.get("role") == role)
        b = next(s for s in reopened["shapes"] if s.get("role") == role)
        paths = [("geometry", a.get("geometry", {}), b.get("geometry", {})), ("whole.bounds", a.get("whole", {}).get("bounds", {}), b.get("whole", {}).get("bounds", {}))]
        for index, (arun, brun) in enumerate(zip(a.get("runs", []), b.get("runs", []))):
            paths.append((f"runs[{index}].bounds", arun.get("bounds", {}), brun.get("bounds", {})))
        for label, av, bv in paths:
            for key in ("left", "top", "width", "height"):
                delta = abs(Decimal(str(av[key])) - Decimal(str(bv[key])))
                if delta > max_delta:
                    max_delta = delta
                deltas.append({"role": role, "range": label, "coordinate": key, "edited": str(av[key]), "reopened": str(bv[key]), "absoluteDelta": str(delta)})
    persisted_max = Decimal(str(worker_report.get("metrics", {}).get("persistence", {}).get("maximumDeltaPoints", "NaN")))
    persistence_ok = max_delta <= tolerance and max_delta == persisted_max and worker_report.get("metrics", {}).get("persistence", {}).get("gatePassed") is True
    details["geometryPersistence"] = {"tolerancePoints": str(tolerance), "independentlyComputedMaximumDeltaPoints": str(max_delta), "workerReportedMaximumDeltaPoints": str(persisted_max), "comparisons": deltas}
    check("all_reported_double_geometry_and_range_bounds_reopen_within_tolerance", persistence_ok, {"maximumDeltaPoints": str(max_delta), "tolerancePoints": str(tolerance), "comparisonCount": len(deltas)})

    # Verify PNG bytes, hashes, dimensions, and identical edited/reopened rendering.
    pngs = {}
    png_ok = True
    for phase_name in ("original", "edited", "reopened"):
        record = worker_report[phase_name]["raster"]
        path = Path(record["path"])
        actual_hash = sha256(path)
        dims = png_info(path)
        phase_ok = actual_hash == record.get("sha256") and dims == {"width": 1280, "height": 720}
        pngs[phase_name] = {"path": str(path), "sha256": actual_hash, "reportedSha256": record.get("sha256"), **dims, "passed": phase_ok}
        png_ok = png_ok and phase_ok
    png_ok = png_ok and pngs["edited"]["sha256"] == pngs["reopened"]["sha256"]
    details["rasters"] = pngs
    check("png_hashes_dimensions_and_reopened_raster_stability_match", png_ok, {k: {a: b for a, b in v.items() if a != "path"} for k, v in pngs.items()})

    # Validate stage pairing, ordering, ownership, and absence of operations after error.
    stage_rows = []
    with stages_path.open("r", encoding="utf-8-sig") as f:
        for line_no, line in enumerate(f, 1):
            if line.strip():
                row = json.loads(line, parse_float=Decimal)
                row["_line"] = line_no
                stage_rows.append(row)
    stage_sequence_ok = [row.get("sequence") for row in stage_rows] == list(range(1, len(stage_rows) + 1))
    no_stage_errors = all(row.get("status") != "error" for row in stage_rows)
    grouped = defaultdict(list)
    for row in stage_rows:
        grouped[row.get("stage")].append(row.get("status"))
    special = {"worker.initialize", "edited.presentation.cleanup", "reopened.presentation.cleanup", "worker.complete"}
    pairs_ok = True
    for stage, statuses in grouped.items():
        if stage in special:
            pairs_ok = pairs_ok and statuses == ["success"]
        else:
            pairs_ok = pairs_ok and statuses == ["begin", "success"]
    stage_name_list = [row.get("stage") for row in stage_rows]
    positions = {name: stage_name_list.index(name) for name in (
        "input.presentation.open", "edited.presentation.saveAs-owned-copy-no-font-embedding", "edited.presentation.close",
        "reopen.presentation.open-readonly", "reopened.presentation.close", "worker.complete"
    )}
    order_ok = positions["input.presentation.open"] < positions["edited.presentation.saveAs-owned-copy-no-font-embedding"] < positions["edited.presentation.close"] < positions["reopen.presentation.open-readonly"] < positions["reopened.presentation.close"] < positions["worker.complete"]
    close_rows = [row for row in stage_rows if row.get("stage") in ("edited.presentation.close", "reopened.presentation.close") and row.get("status") == "begin"]
    saved_path = str(RUN / "native-font-edit.pptx")
    close_paths_ok = len(close_rows) == 2 and all(Path(row.get("ownedPresentationPath", "")).resolve() == Path(saved_path).resolve() for row in close_rows)
    no_forbidden_app_ops = not any(any(term in str(row.get("stage", "")).lower() for term in ("quit", "discard", "closeall")) for row in stage_rows)
    details["lifecycleStages"] = {
        "rowCount": len(stage_rows),
        "sequenceContinuous": stage_sequence_ok,
        "statusCounts": dict(Counter(row.get("status") for row in stage_rows)),
        "allWrappedCallsBeginAndSucceed": pairs_ok,
        "errorRows": [jsonable(row) for row in stage_rows if row.get("status") == "error"],
        "orderedEvents": positions,
        "presentationCloseRows": jsonable(close_rows),
        "allClosesTargetExactOwnedSavedPath": close_paths_ok,
        "lastStage": jsonable(stage_rows[-1]) if stage_rows else None,
        "noQuitDiscardOrCloseAllStage": no_forbidden_app_ops,
    }
    check("stage_log_is_contiguous_successful_and_contains_both_owned_closes", len(stage_rows) > 0 and stage_sequence_ok and no_stage_errors and pairs_ok and order_ok and close_paths_ok and no_forbidden_app_ops and stage_rows[-1].get("stage") == "worker.complete", details["lifecycleStages"])
    source_script = RUN / "inputs" / "native-font-edit.ps1"
    source_script_text = source_script.read_text(encoding="utf-8-sig")
    no_quit_code = not any(token in source_script_text for token in ("Application.Quit", ".Quit(", "CloseAll", ".Discard(", "CloseAll"))
    check("worker_source_contains_no_quit_discard_or_closeall_calls", no_quit_code, {"snapshotSha256": sha256(source_script), "forbiddenTokensFound": [token for token in ("Application.Quit", ".Quit(", "CloseAll", ".Discard(") if token in source_script_text]})

    # Independent PPTX archive CRC/XML and font-program checks.
    pptx_path = RUN / "native-font-edit.pptx"
    zip_details = {"path": str(pptx_path), "sha256": sha256(pptx_path), "bytes": pptx_path.stat().st_size}
    with zipfile.ZipFile(pptx_path, "r") as zf:
        bad_crc = zf.testzip()
        names = zf.namelist()
        xml_members = [name for name in names if name.lower().endswith((".xml", ".rels"))]
        xml_errors = []
        embedded_font_tags = []
        for name in xml_members:
            try:
                root = ET.fromstring(zf.read(name))
                for element in root.iter():
                    local = element.tag.rsplit("}", 1)[-1].lower()
                    if "embeddedfont" in local or local in ("embedfont", "fontdata"):
                        embedded_font_tags.append({"member": name, "tag": local})
            except Exception as exc:
                xml_errors.append({"member": name, "error": f"{type(exc).__name__}: {exc}"})
        font_program_members = [name for name in names if name.lower().endswith((".ttf", ".otf", ".ttc", ".fntdata", ".odttf")) or "/fonts/" in name.lower() or name.lower().startswith("ppt/fonts/")]
        zip_details.update({
            "memberCount": len(names),
            "xmlAndRelsCount": len(xml_members),
            "badCrcMember": bad_crc,
            "xmlErrors": xml_errors,
            "fontProgramMembers": font_program_members,
            "embeddedFontTags": embedded_font_tags,
            "members": names,
        })
    pptx_ok = bad_crc is None and not xml_errors and not font_program_members and not embedded_font_tags
    details["pptxArchive"] = zip_details
    check("saved_pptx_crc_xml_and_no_embedded_font_programs", pptx_ok, {k: zip_details[k] for k in ("sha256", "bytes", "memberCount", "xmlAndRelsCount", "badCrcMember", "xmlErrors", "fontProgramMembers", "embeddedFontTags")})

    details["currentRegistryReimport"] = {"performed": False, "reason": "Parent owns current-registry semantic reimport; this audit deliberately uses stdlib-only raw evidence."}
    passed = all(row["passed"] for row in checks)
    return {
        "schemaVersion": 1,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "scope": "Read-only stdlib audit of native-font-edit-01. This script hashes but never copies font programs; it does not invoke Office/COM or register/install fonts.",
        "root": str(ROOT),
        "auditScript": {"path": str(Path(__file__).resolve()), "sha256": sha256(Path(__file__).resolve())},
        "summary": {"passed": passed, "checkCount": len(checks), "passedChecks": sum(1 for row in checks if row["passed"]), "failedChecks": [row["name"] for row in checks if not row["passed"]]},
        "checks": checks,
        "details": details,
        "limitations": [
            "No native PowerPoint, COM, font registration, font installation, or user-interface operation was performed by this audit.",
            "Reported font-family/style values plus TTF identities do not prove which physical font supplied every glyph or exclude fallback/synthetic styling.",
            "Current-registry fromPptx semantic reimport is intentionally left to the parent audit.",
        ],
    }


try:
    report = audit()
    REPORT_OUT.write_text(json.dumps(jsonable(report), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], indent=2))
    sys.exit(0 if report["summary"]["passed"] else 1)
except Exception as exc:
    failure = {
        "schemaVersion": 1,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "scope": "Read-only stdlib audit; no Office/COM or font registration/install occurred.",
        "auditScript": {"path": str(Path(__file__).resolve()), "sha256": sha256(Path(__file__).resolve())},
        "passed": False,
        "failure": f"{type(exc).__name__}: {exc}",
        "checksCompletedBeforeFailure": checks,
    }
    if not REPORT_OUT.exists():
        REPORT_OUT.write_text(json.dumps(jsonable(failure), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"passed": False, "failure": failure["failure"]}, indent=2), file=sys.stderr)
    sys.exit(2)
