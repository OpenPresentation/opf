"""Verify portable E native-font evidence without Office or external packages."""
from pathlib import Path
import hashlib
import json
import zipfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parent
manifest = json.loads((root / "artifact-manifest.json").read_text(encoding="utf-8"))
assert manifest["schemaVersion"] == 1
assert manifest["kind"] == "opf-pptx-native-font-evidence-manifest"
assert manifest["gate"] == "E/native-font-edit-control"
records = manifest["artifacts"]
expected = {record["path"]: record for record in records}
assert len(expected) == len(records) == manifest["files"]
actual = {path.relative_to(root).as_posix() for path in root.rglob("*")
          if path.is_file() and path.name != "artifact-manifest.json"}
assert actual == set(expected), ("inventory mismatch", sorted(actual - set(expected)), sorted(set(expected) - actual))

font_suffixes = {".ttf", ".otf", ".woff", ".woff2", ".eot", ".fntdata", ".odttf"}
forbidden_suffixes = font_suffixes | {".pdf", ".svg"}
decks = 0
json_files = 0
jsonl_rows = 0
for relative, record in expected.items():
    path = (root / relative).resolve()
    assert path.is_relative_to(root) and not path.is_symlink(), relative
    assert path.suffix.lower() not in forbidden_suffixes, relative
    assert "screenshot" not in relative.lower() and "recent" not in relative.lower(), relative
    assert "__pycache__" not in relative.lower() and not relative.lower().endswith(".pyc"), relative
    raw = path.read_bytes()
    assert len(raw) == record["bytes"], (relative, "size")
    assert hashlib.sha256(raw).hexdigest() == record["sha256"], (relative, "sha256")
    if path.suffix.lower() == ".json":
        json.loads(raw.decode("utf-8-sig"))
        json_files += 1
    if path.suffix.lower() == ".jsonl":
        for line in raw.decode("utf-8-sig").splitlines():
            if line.strip():
                json.loads(line.lstrip("\ufeff"))
                jsonl_rows += 1
    if path.suffix.lower() == ".pptx":
        with zipfile.ZipFile(path) as archive:
            assert archive.testzip() is None, relative
            for name in archive.namelist():
                assert not any(name.lower().endswith(suffix) for suffix in font_suffixes | {".svg"}), (relative, name)
                if name.endswith((".xml", ".rels")):
                    ET.fromstring(archive.read(name))
        decks += 1
assert sum(record["bytes"] for record in records) == manifest["bytes"]

def load(relative):
    return json.loads((root / relative).read_text(encoding="utf-8-sig"))

native = "E/font/native-font-edit-01"
report = load(f"{native}/report.json")
worker = load(f"{native}/worker.json")
supervisor = load(f"{native}/supervisor.json")
registration = load(f"{native}/font-registration.json")
assert worker["exitCode"] == 0 and worker["timedOut"] is False
assert report["cleanupConfirmed"] is True and report["officeOperationsStopped"] is False
assert report["lastStage"] == "worker.complete" and report["error"] is None
assert supervisor["officeLifecycleComplete"] is True
assert supervisor["metricsGatePassed"] is True
assert supervisor["officeCleanupConfirmed"] is True and supervisor["fontCleanupConfirmed"] is True
assert supervisor["inputsUnchanged"] is True and len(supervisor["inputChecks"]) == 20
assert all(item["matched"] for item in supervisor["inputChecks"])
assert report["metrics"]["gatePassed"] is True
assert report["metrics"]["contentAndStylePassed"] is True
assert report["metrics"]["persistence"]["maximumDeltaPoints"] == 0
assert report["metrics"]["rasterStable"] is True and report["metrics"]["savedStable"] is True
assert len(registration) == 4 and all(item["added"] == 1 and item["removed"] is True for item in registration)

expected_runs = [
    ("Regular 18", 18, 0, 0),
    ("Bold 20", 20, -1, 0),
    ("Italic 22", 22, 0, -1),
    ("BoldItalic 24", 24, -1, -1),
]
for phase in ("edited", "reopened"):
    observation = report[phase]["observation"]
    assert observation["slideCount"] == 1 and observation["shapeCount"] == 2
    body = next(shape for shape in observation["shapes"] if shape["role"] == "body")
    assert len(body["runs"]) == 4
    for observed, expected_run in zip(body["runs"], expected_runs):
        text, size, bold, italic = expected_run
        assert observed["text"] == text
        assert observed["font"]["name"] == "Carlito"
        assert observed["font"]["size"] == size
        assert observed["font"]["bold"] == bold and observed["font"]["italic"] == italic

stages = [json.loads(line.lstrip("\ufeff")) for line in
          (root / native / "stages.jsonl").read_text(encoding="utf-8-sig").splitlines() if line.strip()]
assert len(stages) == 654
assert [row["sequence"] for row in stages] == list(range(1, 655))
assert not [row for row in stages if row["status"] == "error"]
close_success = [row["stage"] for row in stages if row["status"] == "success" and row["stage"] in
                 ("edited.presentation.close", "reopened.presentation.close")]
assert close_success == ["edited.presentation.close", "reopened.presentation.close"]

owner = load("E/font/owner-controls-01/report.json")
owner_audit = load("E/font/owner-controls-01/independent-cleanup-audit.json")
assert len(owner["reports"]) == 2 and owner_audit["passed"] is True and owner_audit["officeCalls"] == 0
dummy_add_remove = 0
for case in owner["reports"]:
    assert set(case["fonts"]) == {"value", "Count"}
    assert case["fonts"]["Count"] == 4 and len(case["fonts"]["value"]) == 4
    assert all(item["added"] == 1 and item["removed"] is True for item in case["fonts"]["value"])
    dummy_add_remove += len(case["fonts"]["value"])
assert dummy_add_remove == 8 and dummy_add_remove + len(registration) == 12

worker_review = load("E/font/worker-review-01/review.json")
audit_failed = load("E/font/independent-audit-01/report.json")
audit_pass = load("E/font/independent-audit-01/report-v2.json")
xml_review = load("E/font/independent-audit-01/xml-style-review.json")
assert worker_review["passed"] is True and worker_review["verification"]["officeOrComCalls"] == 0
assert audit_failed["summary"]["passed"] is False and audit_failed["summary"]["passedChecks"] == 15
assert audit_pass["summary"] == {"passed": True, "checkCount": 16, "passedChecks": 16, "failedChecks": []}
assert xml_review["passed"] is True and len(xml_review["checks"]) == 6 and all(item["passed"] for item in xml_review["checks"])

preflight = load("E/font/preflight/font-gate-preflight-corrected.json")
assert preflight["correction"]["requiredFlags"] == 0
contract = load("E/font/pure-controls/font-fixture-contract-check.json")
assert contract["passed"] is True and contract["officeOrFontCalls"] == 0 and contract["registrationArrayCount"] == 4
for name in ("font-edit-root-pure-01.json", "font-edit-root-pure-02.json"):
    pure = load(f"E/font/pure-controls/{name}")
    assert pure["passed"] is True and pure["officeOrComCalls"] == 0 and pure["runCount"] == 4

fixture_comparison = load("E/font/fixture-generator-02/comparison-to-native-inputs.json")
assert fixture_comparison["passed"] is True and len(fixture_comparison["files"]) == 6
assert all(item["byteIdentical"] is True for item in fixture_comparison["files"])
fixture_comparison_03 = load("E/font/fixture-generator-03/comparison-to-native-inputs.json")
generation_03 = load("E/font/fixture-generator-03/generation.json")
timing_03 = load("E/font/fixture-generator-03/generator-snapshot-timing.json")
sandbox_failure_03 = load("E/font/fixture-generator-03/initial-sandbox-failure.json")
generator_03 = root / "E/font/fixture-generator-03/generator-after-run.mjs"
generator_03_hash = hashlib.sha256(generator_03.read_bytes()).hexdigest()
assert fixture_comparison_03["passed"] is True and len(fixture_comparison_03["files"]) == 6
assert all(item["byteIdentical"] is True for item in fixture_comparison_03["files"])
assert generator_03_hash == generation_03["generatorSha256"] == timing_03["sha256"]
assert timing_03["matchesRecordedExecutionHash"] is True and timing_03["officeCalls"] == 0
assert sandbox_failure_03["kind"] == "environment-failure-before-output"
assert sandbox_failure_03["officeCalls"] == 0 and sandbox_failure_03["fontCalls"] == 0
semantic_failed = load("E/font/semantic-reimport-01/comparison.json")
semantic_pass = load("E/font/semantic-reimport-02/comparison.json")
assert semantic_failed["passed"] is False and semantic_pass["passed"] is True

omissions = load("omitted-font-programs.json")
assert omissions["schemaVersion"] == 1 and omissions["kind"] == "omitted-font-program-identities"
assert omissions["fontProgramsCopied"] == 0 and len(omissions["omitted"]) == 16
expected_hashes = {
    "ca019755404c45627a8566915df99068949dc32ee2bce48d6aeee7542d2a0a89",
    "074cd1b89d53765d90d0ed3b4bfe49523efaaf4f3f430c006bc3233778b0ebb5",
    "51edbfa32d8af939913ae1f4ad0a5173e32083499218c133384638090295f0b0",
    "25f5672c1985d168d6bc2973864fc5a7e374bb95fe8d0f91cff47ae17fa67691",
}
assert {item["sha256"] for item in omissions["omitted"]} == expected_hashes
assert all(item["omitted"] is True and item["reason"] == "font program intentionally excluded from portable evidence" for item in omissions["omitted"])
assert all(sum(item["sha256"] == value for item in omissions["omitted"]) == 4 for value in expected_hashes)

context = load("source-context.json")
assert context["schemaVersion"] == 1 and context["kind"] == "opf-pptx-native-font-source-context"
assert context["pullRequest"]["number"] == 49 and context["pullRequest"]["headCommit"] == "7538e4b"
assert context["pullRequest"]["workerSha256"] == "b18f9e2ab822a42b9204a15314ed5ef6e74b1d933ba3e5e7e4efc3a542368960"
assert context["nativeWorkerSnapshotMatchesPr49"] is True

review = load("visual-review.json")
assert review["schemaVersion"] == 1 and review["reviewDate"] == "2026-09-21"
assert review["noFitClippingObserved"] is True and len(review["images"]) == 3
for item in review["images"]:
    path = root / item["path"]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == item["sha256"]

print(json.dumps({
    "passed": True,
    "schema": manifest["kind"],
    "hashedFiles": len(expected),
    "jsonFiles": json_files,
    "jsonlRows": jsonl_rows,
    "pptxCrcXmlNoEmbeddedFontChecks": decks,
    "nativeStylesPassed": 4,
    "maximumPersistenceDeltaPoints": 0,
    "ownedPresentationCloses": 2,
    "nativeFontRemovals": 4,
    "combinedOwnedFontAddRemovePairs": 12,
    "fontProgramsCopied": 0,
    "officeCalls": 0,
}, separators=(",", ":")))
