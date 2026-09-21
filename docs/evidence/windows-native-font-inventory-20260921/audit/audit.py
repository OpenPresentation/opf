"""Audit one frozen native font-inventory attempt without Office or font APIs."""
from __future__ import annotations

import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("attempt", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    attempt = args.attempt.resolve()
    output = args.output.resolve()
    require(not output.exists(), "preserve the existing audit output")

    worker = load(attempt / "worker.json")
    report = load(attempt / "report.json")
    request = load(attempt / "request.json")
    progress = load(attempt / "progress.json")
    supervisor = load(attempt / "supervisor.json")
    registrations = load(attempt / "font-registration.json")
    stages = [json.loads(line) for line in (attempt / "stages.jsonl").read_text(encoding="utf-8-sig").splitlines() if line]

    require(worker["timedOut"] is False and worker["exitCode"] == 0, "worker did not complete")
    require(report["error"] is None and report["officeOperationsStopped"] is False, "worker recorded an error or stop latch")
    require(report["cleanupConfirmed"] is True and report["ownedCloseCount"] == 1, "owned close not confirmed")
    require(progress["stage"] == "worker.complete" and progress["status"] == "success" and progress["cleanupConfirmed"] is True, "terminal progress differs")

    require(len(stages) == 143, "unexpected stage count")
    require([row["sequence"] for row in stages] == list(range(1, 144)), "stage sequence is not contiguous")
    require(not [row for row in stages if row["status"] == "error"], "stage log contains an error")
    begin_count = sum(row["status"] == "begin" for row in stages)
    success_count = sum(row["status"] == "success" for row in stages)
    require((begin_count, success_count) == (70, 73), "stage status counts differ")
    for index, row in enumerate(stages):
        if row["status"] == "begin":
            require(index + 1 < len(stages), f"unterminated begin at {index}")
            following = stages[index + 1]
            require(following["stage"] == row["stage"] and following["status"] == "success", f"unpaired COM stage {row['stage']}")
    close_begins = [row for row in stages if row["stage"] == "presentation.close-owned-snapshot" and row["status"] == "begin"]
    require(len(close_begins) == 1, "expected one owned close call")
    require(sum(row["stage"] == "presentation.owned-close-confirmed" and row["status"] == "success" for row in stages) == 1, "owned close confirmation differs")

    input_checks = []
    for item in request["inputs"]:
        for field in ("sourcePath", "snapshotPath"):
            path = Path(item[field])
            actual = sha256(path)
            input_checks.append({"role": item["role"], "kind": field, "path": str(path), "expected": item["sha256"], "actual": actual, "matched": actual == item["sha256"]})
    for package in request["registryBindings"]["packages"]:
        for role, field, expected_field in (("manifest", "manifestPath", "manifestSha256"), ("entrypoint", "entrypointRealpath", "entrypointSha256")):
            path = Path(package[field])
            actual = sha256(path)
            input_checks.append({"role": f"{package['name']} {role}", "kind": field, "path": str(path), "expected": package[expected_field], "actual": actual, "matched": actual == package[expected_field]})
    require(all(item["matched"] for item in input_checks), "an input hash differs")

    expected = request["expectations"]
    opened = report["openedDocument"]
    require(report["source"]["openedPathMatches"] is True and report["source"]["readOnly"] is True and report["source"]["unchanged"] is True, "source ownership/read-only/unchanged check differs")
    require((opened["slideCount"], opened["shapeCount"], opened["hasTextFrame"]) == (1, 1, True), "document structure differs")
    require((opened["text"], opened["textStart"], opened["textLength"]) == (expected["text"], 1, len(expected["text"])), "whole current text differs")
    require(report["contentGate"]["passed"] is True and not report["contentGate"]["failures"], "content gate did not pass")
    require(len(report["authoredRuns"]) == len(expected["runs"]) == 4, "authored run count differs")
    for actual, wanted in zip(report["authoredRuns"], expected["runs"]):
        require((actual["start"], actual["length"], actual["text"]) == (wanted["start"], wanted["length"], wanted["text"]), "authored run range/text differs")
        require(actual["font"]["name"] == "Carlito" and actual["font"]["size"] == wanted["size"], "authored run family/size differs")
        require(actual["font"]["bold"] == (-1 if wanted["bold"] else 0), "authored run bold differs")
        require(actual["font"]["italic"] == (-1 if wanted["italic"] else 0), "authored run italic differs")

    fonts = report["nativeFontsObservation"]
    require(fonts["count"] == len(fonts["entries"]) == 2, "native font count differs")
    require([(entry["name"], entry["embedded"], entry["embeddable"]) for entry in fonts["entries"]] == [("Carlito", 0, -1), ("Aptos", 0, -1)], "native font entries differ")
    require(report["nativeFontsGate"]["passed"] is False and report["nativeFontsGate"]["unexpectedNames"] == ["Aptos"], "native allowlist result differs")

    require(isinstance(registrations, list) and len(registrations) == 4, "registration root is not four rows")
    require(all(row["added"] >= 1 and row["removed"] is True for row in registrations), "font registration cleanup differs")

    # Preserve the parent-report defect as evidence while deriving the value from
    # the raw JSON root array. The defect cannot convert the failed native gate
    # into a pass; it only understates cleanup/lifecycle/content completion.
    require(supervisor["fontCleanupConfirmed"] is False and supervisor["lifecycleComplete"] is False and supervisor["contentGatePassed"] is False, "expected supervisor parser symptom is absent")
    require(supervisor["nativeFontsGatePassed"] is False, "supervisor unexpectedly passed the native gate")
    corrected_lifecycle = bool(
        not worker["timedOut"] and worker["exitCode"] == 0
        and progress["stage"] == "worker.complete" and progress["status"] == "success" and progress["cleanupConfirmed"]
        and report["cleanupConfirmed"] and report["ownedCloseCount"] == 1
        and all(row["added"] >= 1 and row["removed"] is True for row in registrations)
        and all(item["matched"] for item in input_checks)
    )
    require(corrected_lifecycle, "derived lifecycle did not complete")
    duration_seconds = (datetime.fromisoformat(worker["finishedAt"].replace("Z", "+00:00")) - datetime.fromisoformat(worker["startedAt"].replace("Z", "+00:00"))).total_seconds()

    source_hashes = {name: sha256(attempt / name) for name in (
        "worker.json", "report.json", "request.json", "progress.json", "supervisor.json", "font-registration.json", "stages.jsonl", "inputs/native-font-inventory.ps1"
    )}
    result = {
        "kind": "native-font-inventory-independent-audit",
        "attempt": str(attempt),
        "officeUiFontOrComCallsByAudit": 0,
        "rawHashes": source_hashes,
        "stageAudit": {"count": len(stages), "begin": begin_count, "success": success_count, "errors": 0, "pairedComCalls": begin_count, "ownedCloseCalls": 1},
        "inputAudit": {"count": len(input_checks), "allMatched": True, "checks": input_checks},
        "worker": {"exitCode": 0, "timedOut": False, "durationSeconds": duration_seconds, "terminalStage": "worker.complete", "cleanupConfirmed": True, "ownedCloseCount": 1},
        "fontRegistrationCleanup": {"rawRootType": "array", "count": 4, "allAddedOnce": all(row["added"] == 1 for row in registrations), "allRemoved": True, "confirmed": True},
        "content": {"passed": True, "text": opened["text"], "textStart": opened["textStart"], "textLength": opened["textLength"], "authoredRuns": report["authoredRuns"]},
        "nativeFonts": {"passed": False, "entries": fonts["entries"], "unexpectedNames": ["Aptos"], "embeddingAuthorized": False},
        "supervisorParserDefect": {"present": True, "rawArrayCount": 4, "reportedCleanupConfirmed": supervisor["fontCleanupConfirmed"], "effect": "Supervisor understated cleanup, lifecycle, and content completion; it did not turn the failed native allowlist into a pass."},
        "derivedDecision": {"lifecycleComplete": True, "contentGatePassed": True, "nativeFontsGatePassed": False, "fontCleanupConfirmed": True, "inputsUnchanged": True, "embeddingAuthorized": False, "outcome": "completed-readonly-observation-rejected-native-font-allowlist"},
        "limitations": report["limitations"],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(result, stream, indent=2, ensure_ascii=False)
        stream.write("\n")
    print(json.dumps({"passed": True, "lifecycleComplete": True, "contentGatePassed": True, "nativeFontsGatePassed": False, "fontCleanupConfirmed": True, "embeddingAuthorized": False}))


if __name__ == "__main__":
    main()
