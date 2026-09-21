"""Synthetic, offline negative controls for audit-furniture-native.py.

These runs clone retained observations and mutate one owned evidence item each.
They are not PowerPoint executions and make no product-acceptance claim.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


HERE = Path(__file__).resolve().parent
ARTIFACTS = HERE.parent
REPO = ARTIFACTS.parent.parent
BASELINE = ARTIFACTS / "furniture-baseline-native-01"
TEXT_CLEAR = ARTIFACTS / "furniture-text-clear-native-01"
AUDITOR = ARTIFACTS / "audit-furniture-native.py"
PLANS = ARTIFACTS / "furniture-plans-01"
PYTHON = Path(r"C:\Users\micha\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe")


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def dump(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def rebase(run: Path, source: Path) -> None:
    """Copy JSON-linked owned paths into this synthetic run; leave provenance refs external."""
    report_path = run / "report.json"
    report = load(report_path)
    for key in ("saved", "reopened"):
        old = Path(report[key]["path"])
        report[key]["path"] = str((run / old.relative_to(source)).resolve())
    for phase in report["phases"].values():
        for raster in phase["rasters"]:
            old = Path(raster["path"])
            raster["path"] = str((run / old.relative_to(source)).resolve())
    dump(report_path, report)

    request_path = run / "request.json"
    request = load(request_path)
    for key in ("source", "actionPlan", "verifier", "processHelper"):
        old = Path(request[key]["snapshotPath"])
        request[key]["snapshotPath"] = str((run / old.relative_to(source)).resolve())
    dump(request_path, request)


def copy_fixture(case_id: str, fixture: Path) -> Path:
    target = HERE / "cases" / case_id
    if target.exists():
        raise FileExistsError(f"Refusing to overwrite synthetic case: {target}")
    shutil.copytree(fixture, target)
    rebase(target, fixture.resolve())
    return target


def run_audit(case_id: str, fixture: Path, mutate) -> dict:
    run = copy_fixture(case_id, fixture)
    mutate(run)
    result_name = "control-audit.json"
    proc = subprocess.run(
        [str(PYTHON), str(AUDITOR), str(run), result_name],
        cwd=str(REPO), capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    (run / "auditor-stdout.txt").write_text(proc.stdout, encoding="utf-8")
    (run / "auditor-stderr.txt").write_text(proc.stderr, encoding="utf-8")
    audit_path = run / result_name
    durable = audit_path.is_file()
    audit = load(audit_path) if durable else None
    failed_checks = [check for check in (audit or {}).get("checks", []) if not check.get("passed")]
    passed_control = proc.returncode != 0 and durable and audit.get("passed") is False and bool(failed_checks)
    return {
        "caseId": case_id,
        "synthetic": True,
        "fixture": str(fixture.resolve()),
        "runDir": str(run.resolve()),
        "expected": "auditor exits nonzero and writes a durable failed audit JSON",
        "returnCode": proc.returncode,
        "stdout": proc.stdout,
        "stdoutSha256": sha(run / "auditor-stdout.txt"),
        "stderr": proc.stderr,
        "stderrSha256": sha(run / "auditor-stderr.txt"),
        "durableAudit": durable,
        "auditSha256": sha(audit_path) if durable else None,
        "auditorSha256": sha(AUDITOR),
        "passedControl": passed_control,
        "failedChecks": failed_checks,
    }


def mutate_missing_raster(run: Path) -> None:
    report = load(run / "report.json")
    raster = report["phases"]["edited"]["rasters"][1]
    Path(raster["path"]).unlink()


def mutate_mismatched_plan(run: Path) -> None:
    request_path = run / "request.json"
    request = load(request_path)
    external = PLANS / "text-clear.json"
    request["actionPlan"]["path"] = str(external.resolve())
    request["actionPlan"]["sha256"] = sha(external)
    # Keep the baseline empty action-plan snapshot and its own valid hash.
    dump(request_path, request)


def mutate_failed_worker(run: Path) -> None:
    worker_path = run / "worker.json"
    worker = load(worker_path)
    worker["exitCode"] = 17
    dump(worker_path, worker)


def mutate_geometry(run: Path) -> None:
    report_path = run / "report.json"
    report = load(report_path)
    shape = report["phases"]["reopened"]["slides"][0]["shapes"][0]
    shape["left"] = float(shape["left"]) + 0.03
    dump(report_path, report)


def mutate_current_text(run: Path) -> None:
    report_path = run / "report.json"
    report = load(report_path)
    action = next(action for action in load(run / "inputs" / "action-plan.json") if action["op"] == "set-text")
    reopened = report["phases"]["reopened"]["slides"][action["slideIndex"] - 1]["shapes"]
    target = next(shape for shape in reopened if shape["name"] == action["shapeName"])
    target["text"] = str(target.get("text", "")) + " [synthetic stale current text]"
    dump(report_path, report)


def mutate_missing_close(run: Path) -> None:
    path = run / "stages.jsonl"
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
    rows = [row for row in rows if row["stage"] != "reopened.presentation.close"]
    for sequence, row in enumerate(rows, start=1):
        row["sequence"] = sequence
    path.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows), encoding="utf-8")


def main() -> None:
    if (HERE / "cases").exists() or (HERE / "control-suite.json").exists():
        raise SystemExit(f"Refusing to overwrite non-empty control directory: {HERE}")
    if not PYTHON.is_file() or not AUDITOR.is_file():
        raise FileNotFoundError("Bundled Python or native auditor is missing.")
    (HERE / "cases").mkdir(parents=True)
    cases = [
        run_audit("missing-raster", BASELINE, mutate_missing_raster),
        run_audit("mismatched-action-snapshot", BASELINE, mutate_mismatched_plan),
        run_audit("failed-worker", BASELINE, mutate_failed_worker),
        run_audit("geometry-over-tolerance", BASELINE, mutate_geometry),
        run_audit("current-text-mismatch", TEXT_CLEAR, mutate_current_text),
        run_audit("missing-close-stage", BASELINE, mutate_missing_close),
    ]
    summary = {
        "schemaVersion": 1,
        "scope": "Synthetic offline fault controls over copied native-run evidence. No Office/UI was called; these are auditor negative controls, not native executions.",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "pythonExecutable": str(PYTHON),
        "pythonVersion": subprocess.run([str(PYTHON), "--version"], capture_output=True, text=True).stdout.strip(),
        "harnessSha256": sha(Path(__file__).resolve()),
        "auditorPath": str(AUDITOR.resolve()),
        "auditorSha256": sha(AUDITOR),
        "cases": cases,
        "allControlsPassed": all(case["passedControl"] for case in cases),
        "limitations": [
            "A missing top-level report.json is not one of the six controls. Static inspection shows the auditor reads required top-level JSON before its per-check exception handling, so that condition may terminate without a durable audit JSON.",
            "Mutated reports/stages/worker fields are explicitly synthetic; no result here represents PowerPoint behavior.",
        ],
    }
    dump(HERE / "control-suite.json", summary)
    print(json.dumps({"allControlsPassed": summary["allControlsPassed"], "cases": len(cases),
                      "failures": [case["caseId"] for case in cases if not case["passedControl"]]}))
    if not summary["allControlsPassed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
