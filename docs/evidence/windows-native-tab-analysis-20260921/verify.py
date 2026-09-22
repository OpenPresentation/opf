#!/usr/bin/env python3
"""Verify the portable native tab quantization analysis with stdlib only."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "artifact-manifest.json"
EXPECTED_REPORT_SHA256 = "dd2dc51ec6714c864479b93791eefe9807ab9f8c649f7a3c7bcabaca61b5a71c"
EXPECTED_SLIDE_XML_SHA256 = "b7bf2146362d7147d3b840d381dc339a3cf37f0cb51ea141909a9819dfe40117"
EXPECTED_PPTX_SHA256 = "73f271c2e360ba47b00894ca577a3c12fc5ebb006aca4d8dacd907a1b2d0d6f1"
FORBIDDEN_SUFFIXES = {
    ".pptx",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".pdf",
    ".ttf",
    ".otf",
    ".woff",
    ".woff2",
    ".eot",
    ".log",
    ".pyc",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    manifest = load_json(MANIFEST)
    require(manifest["schemaVersion"] == 1, "manifest schema version changed")
    require(
        manifest["kind"] == "opf-native-tab-quantization-portable-analysis",
        "manifest kind changed",
    )

    actual_paths: list[str] = []
    for path in ROOT.rglob("*"):
        require(not path.is_symlink(), f"symlink is not portable evidence: {path}")
        if path.is_file() and path != MANIFEST:
            actual_paths.append(path.relative_to(ROOT).as_posix())
    actual_paths.sort()
    listed = sorted(item["path"] for item in manifest["artifacts"])
    require(actual_paths == listed, "manifest inventory differs from bundle files")
    require(manifest["files"] == len(listed), "manifest file count changed")

    actual_bytes = 0
    for item in manifest["artifacts"]:
        path = ROOT / item["path"]
        require(path.is_file(), f"missing manifest file: {item['path']}")
        require(path.stat().st_size == item["bytes"], f"size mismatch: {item['path']}")
        require(sha256(path) == item["sha256"], f"hash mismatch: {item['path']}")
        require(path.suffix.lower() not in FORBIDDEN_SUFFIXES, f"forbidden file: {item['path']}")
        require("screenshot" not in path.name.lower(), f"screenshot file present: {item['path']}")
        require("recent" not in path.name.lower(), f"recent-file data present: {item['path']}")
        actual_bytes += path.stat().st_size
    require(manifest["bytes"] == actual_bytes, "manifest byte count changed")

    report_path = ROOT / "inputs" / "native-tab-v2-04-report.json"
    slide_xml_path = ROOT / "inputs" / "native-tab-v2-04-slide1.xml"
    require(sha256(report_path) == EXPECTED_REPORT_SHA256, "raw report bytes changed")
    require(sha256(slide_xml_path) == EXPECTED_SLIDE_XML_SHA256, "slide XML bytes changed")
    ET.fromstring(slide_xml_path.read_bytes())

    provenance = load_json(ROOT / "provenance.json")
    require(
        provenance["mergedCoreEvidence"]["commit"]
        == "3847f712ccb2379952bcc8ab7c9fdbaedfd0a4ce",
        "merged core evidence commit changed",
    )
    provenance_inputs = {item["bundlePath"]: item for item in provenance["inputs"]}
    require(
        provenance_inputs["inputs/native-tab-v2-04-report.json"]["sha256"]
        == EXPECTED_REPORT_SHA256,
        "report provenance changed",
    )
    slide_provenance = provenance_inputs["inputs/native-tab-v2-04-slide1.xml"]
    require(slide_provenance["sha256"] == EXPECTED_SLIDE_XML_SHA256, "XML provenance changed")
    require(
        slide_provenance["originContainerSha256"] == EXPECTED_PPTX_SHA256,
        "source PPTX provenance changed",
    )
    require(slide_provenance["originZipMember"] == "ppt/slides/slide1.xml", "ZIP member changed")
    require(slide_provenance["zipCrc32"] == "5dc67820", "ZIP member CRC changed")

    report = load_json(report_path)
    require(report["source"]["sha256"] == EXPECTED_PPTX_SHA256, "report source hash changed")
    require(report["source"]["reopenedSha256"] == EXPECTED_PPTX_SHA256, "reopened hash changed")
    require(report["cleanupConfirmed"] is True, "cleanup is not confirmed")
    require(report["officeOperationsStopped"] is False, "worker recorded stopped Office operations")
    require(report["lastStage"] == "worker.complete", "worker did not complete")
    require(report["error"] is None, "worker report contains an error")
    require(report["requested"]["tolerancePoints"] == 0.02, "native tolerance changed")
    require(len(report["requested"]["targets"]) == 9, "target count changed")
    require(len(report["original"]["observation"]["records"]) == 9, "original record count changed")
    require(len(report["reopened"]["observation"]["records"]) == 9, "reopened record count changed")

    for phase in ("original", "reopened"):
        metrics = report["metrics"][phase]
        require(metrics["tolerancePoints"] == 0.02, f"{phase} tolerance changed")
        require(metrics["tabGatePassed"] is False, f"{phase} tab gate changed")
        require(metrics["literalGatePassed"] is True, f"{phase} literal gate changed")
        require(metrics["pairAgreementGatePassed"] is False, f"{phase} pair gate changed")
        require(
            metrics["maximumTabErrorPoints"] == 0.022655487060546875,
            f"{phase} tab maximum changed",
        )
        require(
            metrics["maximumLiteralErrorPoints"] == 2.288818359375e-05,
            f"{phase} literal maximum changed",
        )
        require(
            metrics["maximumPairDeltaPoints"] == 0.022678375244140625,
            f"{phase} pair maximum changed",
        )
    persistence = report["metrics"]["persistence"]
    require(persistence["tolerancePoints"] == 0.02, "persistence tolerance changed")
    require(persistence["gatePassed"] is True, "persistence gate changed")
    require(persistence["maximumDeltaPoints"] == 0, "persistence delta changed")
    require(report["metrics"]["content"]["passed"] is True, "content check changed")
    require(report["metrics"]["rasterStable"] is True, "retained raster result changed")
    require(report["metrics"]["sourceStable"] is True, "retained source result changed")

    supporting_path = ROOT / "supporting-data.json"
    supporting = load_json(supporting_path)
    require(len(supporting["rows"]) == 9, "analysis row count changed")
    require(all(supporting["checks"].values()), "one or more quantization checks failed")
    require(
        supporting["inputs"]["report"]
        == {"path": "inputs/native-tab-v2-04-report.json", "sha256": EXPECTED_REPORT_SHA256},
        "analysis report binding is not portable",
    )
    require(
        supporting["inputs"]["slideXml"]["path"]
        == "inputs/native-tab-v2-04-slide1.xml",
        "analysis XML binding is not portable",
    )
    require(
        supporting["inputs"]["slideXml"]["sha256"] == EXPECTED_SLIDE_XML_SHA256,
        "analysis XML hash changed",
    )
    require(
        supporting["distinctObservedTabTextOffsets"]
        == [16.25, 16.299999237060547, 77.29999542236328],
        "observed offset buckets changed",
    )

    inventory = load_json(ROOT / "input-inventory-review.json")
    require(len(inventory["reviewedInputs"]) == 2, "raw input inventory changed")
    raw_report_text = report_path.read_text(encoding="utf-8-sig")
    require(raw_report_text.count(r"C:\\Users\\micha") == 7, "host-profile path inventory changed")
    secret_pattern = re.compile(
        r"(?i)(password\s*[:=]|api[_ -]?key\s*[:=]|authorization\s*[:=]|bearer\s+[A-Za-z0-9]|secret\s*[:=]|token\s*[:=]|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})"
    )
    require(secret_pattern.search(raw_report_text) is None, "credential or email pattern in raw report")
    slide_text = slide_xml_path.read_text(encoding="utf-8")
    require(secret_pattern.search(slide_text) is None, "credential or email pattern in slide XML")

    analyzer_text = (ROOT / "analyze.py").read_text(encoding="utf-8")
    require("sources/opf" not in analyzer_text, "analyzer depends on original source tree")
    require("parent.parent" not in analyzer_text, "analyzer depends on original run directory")
    replay_descriptor, replay_name = tempfile.mkstemp(
        prefix="opf-tab-quantization-replay-", suffix=".json"
    )
    os.close(replay_descriptor)
    replay_path = Path(replay_name)
    try:
        completed = subprocess.run(
            [
                sys.executable,
                str(ROOT / "analyze.py"),
                "--output",
                str(replay_path),
                "--overwrite",
            ],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
            timeout=60,
        )
        require(completed.returncode == 0, f"independent replay failed: {completed.stderr}")
        require(replay_path.read_bytes() == supporting_path.read_bytes(), "replay bytes differ")
        refused = subprocess.run(
            [sys.executable, str(ROOT / "analyze.py"), "--output", str(replay_path)],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
            timeout=60,
        )
        require(refused.returncode != 0, "analyzer overwrote an existing output")
        require("refusing to overwrite" in refused.stderr, "overwrite refusal was not explicit")
    finally:
        replay_path.unlink(missing_ok=True)

    result = {
        "passed": True,
        "manifestFiles": len(listed),
        "manifestBytes": actual_bytes,
        "analysisRows": len(supporting["rows"]),
        "quantizationChecks": len(supporting["checks"]),
        "rawInputs": 2,
        "replayByteIdentical": True,
        "overwriteRefused": True,
        "forbiddenFiles": 0,
        "officeCalls": 0,
        "fontCalls": 0,
    }
    print(json.dumps(result, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
