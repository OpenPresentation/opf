#!/usr/bin/env python3
"""Offline-only verifier for the native font inventory evidence bundle."""

from __future__ import annotations

import hashlib
import json
import math
import sys
import zipfile
from datetime import datetime
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parent
FORBIDDEN_SUFFIXES = {".ttf", ".otf", ".woff", ".woff2", ".eot", ".svg", ".pdf"}


def fail(message: str) -> None:
    raise AssertionError(message)


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def load_json(relative: str):
    return json.loads((ROOT / relative).read_text(encoding="utf-8-sig"))


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_manifest() -> int:
    manifest = load_json("MANIFEST.sha256.json")
    require(manifest.get("schemaVersion") == 1, "manifest schema")
    entries = manifest.get("entries")
    require(isinstance(entries, list) and entries, "manifest entries")
    expected = {}
    for item in entries:
        relative = item.get("path")
        pure = PurePosixPath(relative)
        require(not pure.is_absolute() and ".." not in pure.parts, f"unsafe manifest path: {relative}")
        require(relative not in expected, f"duplicate manifest path: {relative}")
        expected[relative] = item
    actual = {}
    for path in ROOT.rglob("*"):
        require(not path.is_symlink(), f"symlink forbidden: {path}")
        if path.is_file() and path.name != "MANIFEST.sha256.json":
            relative = path.relative_to(ROOT).as_posix()
            require(path.suffix.lower() not in FORBIDDEN_SUFFIXES, f"forbidden payload: {relative}")
            actual[relative] = path
    require(set(actual) == set(expected), "bundle inventory does not match manifest")
    for relative, path in actual.items():
        item = expected[relative]
        require(path.stat().st_size == item["bytes"], f"size mismatch: {relative}")
        require(sha256(path) == item["sha256"], f"hash mismatch: {relative}")
    return len(expected) + 1


def verify_attempt() -> dict:
    worker = load_json("attempt/worker.json")
    report = load_json("attempt/report.json")
    request = load_json("attempt/request.json")
    progress = load_json("attempt/progress.json")
    supervisor = load_json("attempt/supervisor.json")
    registrations = load_json("attempt/font-registration.json")
    audit = load_json("audit/report-v2.json")
    repro = load_json("audit/parser-repro.json")
    diagnosis = load_json("audit/inventory-registration-array-diagnosis.json")
    worker02 = load_json("future-worker02/worker02-parser-check.json")

    require(worker["exitCode"] == 0 and worker["timedOut"] is False, "child worker outcome")
    started = datetime.fromisoformat(worker["startedAt"].replace("Z", "+00:00"))
    finished = datetime.fromisoformat(worker["finishedAt"].replace("Z", "+00:00"))
    require(math.isclose((finished - started).total_seconds(), 1.368945, rel_tol=0, abs_tol=1e-9), "worker duration")
    require(report["cleanupConfirmed"] is True and report["officeOperationsStopped"] is False, "raw worker lifecycle")
    require(report["ownedCloseCount"] == 1, "raw owned-close count")
    require(report["lastStage"] == "worker.complete" and report["lastStatus"] == "success", "raw final stage")
    require(progress["stage"] == "worker.complete" and progress["status"] == "success", "durable progress")

    lines = [line for line in (ROOT / "attempt/stages.jsonl").read_text(encoding="utf-8-sig").splitlines() if line]
    stages = [json.loads(line) for line in lines]
    require(len(stages) == 143, "stage record count")
    require([row["sequence"] for row in stages] == list(range(1, 144)), "stage sequence")
    begins = [(index, row) for index, row in enumerate(stages) if row["status"] == "begin"]
    require(len(begins) == 70, "begin count")
    require(sum(row["status"] == "error" for row in stages) == 0, "no COM-stage error")
    for index, row in begins:
        require(index + 1 < len(stages), f"unpaired begin at {row['sequence']}")
        following = stages[index + 1]
        require(following["stage"] == row["stage"] and following["status"] == "success", f"pair mismatch at {row['sequence']}")
    require(sum(row["stage"] == "presentation.close-owned-snapshot" and row["status"] == "begin" for row in stages) == 1, "one close call")

    require(isinstance(registrations, list) and len(registrations) == 4, "four raw registration rows")
    require(all(row["added"] == 1 and row["removed"] is True for row in registrations), "all four owned removals")

    require(supervisor["fontCleanupConfirmed"] is False, "preserve raw parent cleanup failure")
    require(supervisor["lifecycleComplete"] is False, "preserve raw parent lifecycle failure")
    require(supervisor["contentGatePassed"] is False, "preserve raw parent content failure")
    require(supervisor["nativeFontsGatePassed"] is False, "preserve raw allowlist failure")
    wrapped = supervisor["fontRegistrations"]
    require(isinstance(wrapped, list) and len(wrapped) == 1 and wrapped[0]["Count"] == 4, "raw wrapped-array symptom")
    require(repro["pipelineWrappedCount"] == 1 and repro["pipelineWrappedFirstCount"] == 4, "PS5 parser reproduction")
    require(repro["fixedCount"] == 4 and repro["rawRowsAllRemoved"] is True, "corrected parser reproduction")
    require(diagnosis["originalExpressionOuterCount"] == 1 and diagnosis["decodedThenWrappedCount"] == 4, "root diagnosis")

    expected_runs = [
        (1, 8, "Regular ", "Carlito", 18, 0, 0),
        (9, 5, "Bold ", "Carlito", 20, -1, 0),
        (14, 7, "Italic ", "Carlito", 22, 0, -1),
        (21, 10, "BoldItalic", "Carlito", 24, -1, -1),
    ]
    require(report["contentGate"]["passed"] is True, "raw content gate")
    require(len(report["authoredRuns"]) == 4, "four authored runs")
    actual_runs = []
    for row in report["authoredRuns"]:
        font = row["font"]
        actual_runs.append((row["start"], row["length"], row["text"], font["name"], font["size"], font["bold"], font["italic"]))
    require(actual_runs == expected_runs, "exact current run content/styles")

    font_rows = report["nativeFontsObservation"]["entries"]
    require([(row["name"], row["embedded"], row["embeddable"]) for row in font_rows] == [("Carlito", 0, -1), ("Aptos", 0, -1)], "native font observations")
    require(report["nativeFontsGate"]["passed"] is False, "native font gate must fail")
    require(report["nativeFontsGate"]["unexpectedNames"] == ["Aptos"], "unexpected Aptos")

    computed_hash_records = 2 * len(request["inputs"]) + 2 * len(request["registryBindings"]["packages"])
    require(computed_hash_records == len(audit["inputAudit"]["checks"]) == 42, "computed input hash record count")
    require(all(check["matched"] for check in audit["inputAudit"]["checks"]), "all input hash records match")
    derived = audit["derivedDecision"]
    require(derived == {
        "lifecycleComplete": True,
        "contentGatePassed": True,
        "nativeFontsGatePassed": False,
        "fontCleanupConfirmed": True,
        "inputsUnchanged": True,
        "embeddingAuthorized": False,
        "outcome": "completed-readonly-observation-rejected-native-font-allowlist",
    }, "corrected offline decision")
    require(audit["officeUiFontOrComCallsByAudit"] == 0, "audit remained offline")

    require(worker02["actualRawRowCount"] == 4 and worker02["actualRawCleanupPassed"] is True, "future parser handles actual array")
    require(worker02["fewerRejected"] and worker02["emptyRejected"] and worker02["failedRemovalRejected"] and worker02["zeroAdditionRejected"], "future parser negative controls")

    omitted = load_json("OMITTED.json")["fontPrograms"]
    require(len(omitted) == 4, "four excluded font programs")
    require(all(item["sourceRelativeToAttempt"].startswith("inputs/font-fixture/fonts/") and item["sourceRelativeToAttempt"].endswith(".ttf") for item in omitted), "font omissions are exact TTF inputs")
    require(all(len(item["sha256"]) == 64 and item["bytes"] > 0 for item in omitted), "omission identities")
    omitted_by_source = {item["sourceRelativeToAttempt"]: item for item in omitted}
    marker = "native-font-inventory-01/inputs/"
    for item in request["inputs"]:
        normalized = item["snapshotPath"].replace("\\", "/")
        require(marker in normalized, f"unexpected snapshot path: {normalized}")
        relative = normalized.split(marker, 1)[1]
        bundled = ROOT / "attempt/inputs" / Path(*PurePosixPath(relative).parts)
        if bundled.is_file():
            require(sha256(bundled) == item["sha256"], f"request snapshot hash: {relative}")
        else:
            omission = omitted_by_source.get("inputs/" + relative)
            require(omission is not None and omission["sha256"] == item["sha256"], f"missing snapshot identity: {relative}")

    with zipfile.ZipFile(ROOT / "attempt/inputs/source.pptx") as archive:
        names = [name.lower() for name in archive.namelist()]
    require(not any(name.startswith("ppt/fonts/") for name in names), "source PPTX has no embedded fonts")
    require(not any(PurePosixPath(name).suffix in FORBIDDEN_SUFFIXES for name in names), "source PPTX has no forbidden font/media payload")

    return {
        "stageRecords": len(stages),
        "pairedComCalls": len(begins),
        "ownedCloseCalls": 1,
        "styles": len(actual_runs),
        "hashRecords": computed_hash_records,
        "ownedFontRemovals": len(registrations),
        "nativeFontNames": [row["name"] for row in font_rows],
        "rawSupervisorLifecycleComplete": supervisor["lifecycleComplete"],
        "offlineCorrectedLifecycleComplete": derived["lifecycleComplete"],
        "nativeFontsGatePassed": derived["nativeFontsGatePassed"],
        "embeddingAuthorized": derived["embeddingAuthorized"],
    }


def main() -> None:
    files = verify_manifest()
    result = verify_attempt()
    print(json.dumps({"status": "PASS", "manifestFilesIncludingManifest": files, **result}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise
