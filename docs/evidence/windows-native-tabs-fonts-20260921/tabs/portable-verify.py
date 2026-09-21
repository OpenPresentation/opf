"""Verify the portable D plain-tab evidence bundle without Office or external packages."""
from pathlib import Path
import hashlib
import json
import math
import zipfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parent
manifest = json.loads((root / "artifact-manifest.json").read_text(encoding="utf-8"))
assert manifest["schemaVersion"] == 1
assert manifest["kind"] == "opf-pptx-native-tab-evidence-manifest"
assert manifest["gate"] == "D/plain-native-tab-control"
records = manifest["artifacts"]
expected = {record["path"]: record for record in records}
assert len(expected) == len(records) == manifest["files"], "duplicate or missing manifest records"
actual = {path.relative_to(root).as_posix() for path in root.rglob("*")
          if path.is_file() and path.name != "artifact-manifest.json"}
assert actual == set(expected), ("inventory mismatch", sorted(actual - set(expected)), sorted(set(expected) - actual))

forbidden_suffixes = {".pdf", ".ttf", ".otf", ".woff", ".woff2", ".eot", ".fntdata", ".odttf"}
forbidden_parts = {"screenshot", "recent", "__pycache__"}
decks = 0
json_files = 0
jsonl_rows = 0
for relative, record in expected.items():
    path = (root / relative).resolve()
    assert path.is_relative_to(root) and not path.is_symlink(), relative
    assert path.suffix.lower() not in forbidden_suffixes, relative
    assert not any(part in relative.lower() for part in forbidden_parts), relative
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
                assert not name.lower().endswith((".fntdata", ".ttf", ".otf", ".odttf", ".woff", ".woff2")), (relative, name)
                if name.endswith((".xml", ".rels")):
                    ET.fromstring(archive.read(name))
        decks += 1
assert sum(record["bytes"] for record in records) == manifest["bytes"], "manifest byte total"

def load(relative):
    return json.loads((root / relative).read_text(encoding="utf-8-sig"))

native = "D/tab/native"
r1 = load(f"{native}/native-tab-v2-01/report.json")
w1 = load(f"{native}/native-tab-v2-01/worker.json")
ui1 = load(f"{native}/native-tab-v2-01/supervisor-ui-close.json")
assert w1["exitCode"] == 1 and w1["timedOut"] is False
assert r1["cleanupConfirmed"] is False and r1["lastStage"] == "worker.failure" and r1["metrics"] is None
assert ui1["savedBytesUnchanged"] is True and ui1["workerCleanupRecordUnchanged"] is True

r2 = load(f"{native}/native-tab-v2-02/report.json")
w2 = load(f"{native}/native-tab-v2-02/worker.json")
s2 = load(f"{native}/native-tab-v2-02/supervisor.json")
assert w2["exitCode"] == 1 and w2["timedOut"] is False
assert r2["cleanupConfirmed"] is True and s2["cleanupConfirmed"] is True and r2["metrics"] is None
for recovery in ("metrics.recovered.json", "metrics.root-recovered.json"):
    recovered = load(f"{native}/native-tab-v2-02/{recovery}")
    assert recovered["sourceReport"]["metricsWasNull"] is True
    assert recovered["metrics"]["original"]["tabGatePassed"] is False

for run in ("native-tab-v2-03", "native-tab-v2-04"):
    report = load(f"{native}/{run}/report.json")
    worker = load(f"{native}/{run}/worker.json")
    supervisor = load(f"{native}/{run}/supervisor.json")
    metrics = report["metrics"]
    assert worker["exitCode"] == 0 and worker["timedOut"] is False
    assert supervisor["exitCode"] == 0 and supervisor["cleanupConfirmed"] is True
    assert report["cleanupConfirmed"] is True and report["officeOperationsStopped"] is False
    assert report["lastStage"] == "worker.complete" and report["error"] is None
    assert metrics["content"]["passed"] is True and metrics["persistence"]["gatePassed"] is True
    assert metrics["sourceStable"] is True and metrics["rasterStable"] is True
    for phase in ("original", "reopened"):
        assert len(metrics[phase]["records"]) == 9
        assert metrics[phase]["tabGatePassed"] is False
        assert metrics[phase]["literalGatePassed"] is True
        assert metrics[phase]["pairAgreementGatePassed"] is False
        assert metrics[phase]["maximumTabErrorPoints"] == 0.022655487060546875
        assert metrics[phase]["maximumPairDeltaPoints"] == 0.022678375244140625

audit01 = load("D/tab/audits/tab-independent-audit-01/audit-report-v2.json")
audit04 = load("D/tab/audits/tab-independent-audit-04/audit-report-v2.json")
assert audit01["auditIntegrityPassed"] is True and audit01["tabOffsetGatePassed"] is False
assert audit04["auditIntegrityPassed"] is True
assert audit04["nativeTolerancePoint02GatePassed"] is False
assert audit04["metricPrecision"]["storedMetricsExactlyRecomputed"] is True
assert audit04["metricPrecision"]["exactDifferences"] == []

precision = load(f"{native}/native-tab-v2-04/root-precision-check.json")
replay = load(f"{native}/native-tab-v2-04/metrics.root-replay.json")
assert precision["pythonBinaryDoubleMetricsExactlyMatch"] is True and precision["differences"] == []
assert replay["regression"]["officeOrComCalls"] == 0
assert replay["regression"]["exactAndNativeStyleMetricsIdentical"] is True

for name in ("tab-v2-root-controls-01.json", "tab-v2-root-controls-02.json",
             "tab-v2-root-regression-02.json", "tab-v2-root-regression-03.json",
             "tab-v2-root-regression-04.json"):
    result = load(f"D/tab/pure-controls/{name}")
    assert result["passed"] is True, name
    if "officeOrComCalls" in result:
        assert result["officeOrComCalls"] == 0, name

context = load("source-context.json")
assert context["schemaVersion"] == 1 and context["kind"] == "opf-pptx-native-tab-source-context"
assert context["pullRequest"]["number"] == 48 and context["pullRequest"]["headCommit"] == "4b5d756"
assert context["pullRequest"]["verifierSha256"] == "6a0f8f33e1072cf373e7b6c744d248ae89ec66901e7b8a3be6c89a32cce660dd"
assert context["finalVerifierSnapshotMatchesPr48"] is True
for run, item in context["runSnapshots"].items():
    local = root / native / run / "inputs" / "native-tab-control-v2.ps1"
    assert hashlib.sha256(local.read_bytes()).hexdigest() == item["verifierSnapshotSha256"], run

review = load("visual-review.json")
assert review["schemaVersion"] == 1 and review["reviewDate"] == "2026-09-21"
assert len(review["images"]) == 6
for item in review["images"]:
    path = root / item["path"]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == item["sha256"], item["path"]

print(json.dumps({
    "passed": True,
    "schema": manifest["kind"],
    "hashedFiles": len(expected),
    "jsonFiles": json_files,
    "jsonlRows": jsonl_rows,
    "pptxCrcXmlFontChecks": decks,
    "workerLifecyclePassedRun04": True,
    "nativeTolerancePoint02GatePassed": False,
    "mixedSizeTableStatus": "open",
    "officeCalls": 0,
}, separators=(",", ":")))
