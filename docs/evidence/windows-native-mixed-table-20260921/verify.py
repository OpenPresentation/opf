#!/usr/bin/env python3
"""Verify the portable mixed-table evidence without Office or font operations."""

from __future__ import annotations

import hashlib
import json
import struct
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "artifact-manifest.json"
SOURCE_SHA256 = "f92c5d5565afa1d03fc6df0cdc8d482771d5ebd5a5403f7a888f75e2ad020a51"
WORKER_SHA256 = "ad21e9037ed5d091a2c11e4041155067030e0d8705d27321d3148748e0744ffa"
NATIVE_PNG_SHA256 = "ceed1e7089510f9acaa0413674fb36ee76cb343a39638bb13fba53380c64602d"
ESTIMATED_PNG_SHA256 = "ed6c82fe9f77ee1d69d8a547a9b52ece9c36fddaee6b2deb57dd0dd6c5eb6418"
AUDIT_V1_SHA256 = "87ef1b092e9a5d6c78678c8c79655d2a8e647eb77b0ff733743cd5fa12316906"
AUDIT_V2_SHA256 = "1a7a2f8fac50502505139d44fd5895fd14ebe522d32ca4efe17cea842ca1fafc"
FONT_HASHES = {
    "ca019755404c45627a8566915df99068949dc32ee2bce48d6aeee7542d2a0a89",
    "074cd1b89d53765d90d0ed3b4bfe49523efaaf4f3f430c006bc3233778b0ebb5",
    "51edbfa32d8af939913ae1f4ad0a5173e32083499218c133384638090295f0b0",
    "25f5672c1985d168d6bc2973864fc5a7e374bb95fe8d0f91cff47ae17fa67691",
}
FONT_SUFFIXES = {".ttf", ".otf", ".woff", ".woff2", ".eot", ".fntdata", ".odttf"}
NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def png_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:24]
    require(data[:8] == b"\x89PNG\r\n\x1a\n", f"invalid PNG signature: {path}")
    require(data[12:16] == b"IHDR", f"missing PNG IHDR: {path}")
    return struct.unpack(">II", data[16:24])


def close(a: float, b: float, tolerance: float = 0.02) -> bool:
    return abs(float(a) - float(b)) <= tolerance


def main() -> int:
    manifest = load_json(MANIFEST)
    require(manifest["schemaVersion"] == 1, "manifest schema changed")
    require(manifest["kind"] == "opf-native-mixed-table-portable-evidence", "manifest kind changed")

    actual_files: list[str] = []
    for path in ROOT.rglob("*"):
        require(not path.is_symlink(), f"symlink found: {path}")
        if path.is_file() and path != MANIFEST:
            actual_files.append(path.relative_to(ROOT).as_posix())
    actual_files.sort()
    listed = sorted(item["path"] for item in manifest["artifacts"])
    require(actual_files == listed, "manifest inventory differs from bundle files")
    require(manifest["files"] == len(listed), "manifest file count changed")
    actual_bytes = 0
    allowed_pngs = {"native-run/native-observation.png", "estimated/preview.png"}
    for item in manifest["artifacts"]:
        path = ROOT / item["path"]
        require(path.stat().st_size == item["bytes"], f"size mismatch: {item['path']}")
        require(sha256(path) == item["sha256"], f"hash mismatch: {item['path']}")
        suffix = path.suffix.lower()
        require(suffix not in FONT_SUFFIXES, f"font program copied: {item['path']}")
        require(suffix not in {".svg", ".pdf"}, f"forbidden SVG/PDF copied: {item['path']}")
        if suffix == ".png":
            require(item["path"] in allowed_pngs, f"unexpected PNG: {item['path']}")
        require("screenshot" not in path.name.lower(), f"workspace screenshot copied: {item['path']}")
        require("recent" not in path.name.lower(), f"recent-file data copied: {item['path']}")
        actual_bytes += path.stat().st_size
    require(manifest["bytes"] == actual_bytes, "manifest byte count changed")

    ledger = load_json(ROOT / "source-copy-ledger.json")
    require(ledger["files"] == len(ledger["entries"]) == 32, "copy-ledger count changed")
    require(ledger["allCopiesExact"] is True, "copy ledger is not exact")
    for item in ledger["entries"]:
        path = ROOT / item["bundlePath"]
        require(path.is_file(), f"ledger file missing: {item['bundlePath']}")
        require(path.stat().st_size == item["bytes"], f"ledger size mismatch: {item['bundlePath']}")
        require(sha256(path) == item["sha256"], f"ledger hash mismatch: {item['bundlePath']}")

    omissions = load_json(ROOT / "omissions.json")
    require(len(omissions["fontPrograms"]) == 4, "font omission count changed")
    require({item["sha256"] for item in omissions["fontPrograms"]} == FONT_HASHES, "font hashes changed")
    require(
        omissions["fontBearingSvg"]["sha256"]
        == "459d2c4ddd614662f0171846f8c0c5f59573557c0d5c0602736473c4698d0486",
        "omitted SVG hash changed",
    )
    require(len(omissions["duplicateSourceFiles"]) == 7, "duplicate-source ledger changed")
    require(all(value == 0 for value in omissions["claims"].values()), "an excluded artifact was copied")

    for path in ROOT.rglob("*.json"):
        load_json(path)
    stage_lines = [
        line
        for line in (ROOT / "native-run" / "stages.jsonl")
        .read_text(encoding="utf-8-sig")
        .splitlines()
        if line.strip()
    ]
    stages = [json.loads(line.lstrip("\ufeff")) for line in stage_lines]
    require(len(stages) == 523, "stage count changed")
    require([row["sequence"] for row in stages] == list(range(1, 524)), "stage sequence changed")
    require(not [row for row in stages if row["status"] == "error"], "stage error found")
    begin_indices = [index for index, row in enumerate(stages) if row["status"] == "begin"]
    require(len(begin_indices) == 260, "COM begin count changed")
    paired = set()
    for index in begin_indices:
        require(index + 1 < len(stages), "COM begin has no successor")
        require(stages[index + 1]["stage"] == stages[index]["stage"], "COM stage pair changed")
        require(stages[index + 1]["status"] == "success", "COM begin lacks success")
        paired.update((index, index + 1))
    unpaired_success = [
        row["stage"]
        for index, row in enumerate(stages)
        if row["status"] == "success" and index not in paired
    ]
    require(
        unpaired_success == ["worker.initialize", "observation.presentation.cleanup", "worker.complete"],
        "lifecycle marker sequence changed",
    )

    report = load_json(ROOT / "native-run" / "report.json")
    request = load_json(ROOT / "native-run" / "request.json")
    supervisor = load_json(ROOT / "native-run" / "supervisor.json")
    worker = load_json(ROOT / "native-run" / "worker.json")
    progress = load_json(ROOT / "native-run" / "progress.json")
    registration = load_json(ROOT / "native-run" / "font-registration.json")
    require(worker["exitCode"] == 0 and worker["timedOut"] is False, "worker lifecycle changed")
    require(report["cleanupConfirmed"] is True, "cleanup is not confirmed")
    require(report["officeOperationsStopped"] is False, "Office operations stopped")
    require(report["lastStage"] == "worker.complete" and report["error"] is None, "worker report failed")
    require(progress["sequence"] == 523 and progress["stage"] == "worker.complete", "progress changed")
    require(supervisor["officeLifecycleComplete"] is True, "parent lifecycle changed")
    require(supervisor["officeCleanupConfirmed"] is True, "parent Office cleanup changed")
    require(supervisor["fontCleanupConfirmed"] is True, "parent font cleanup changed")
    require(supervisor["metricsGatePassed"] is True, "parent metric gate changed")
    require(len(supervisor["inputChecks"]) == 34, "supervisor hash-check count changed")
    require(
        all(
            item["matched"] is True
            and item["expected"] == item["actual"]
            for item in supervisor["inputChecks"]
        ),
        "one or more supervisor input hashes changed",
    )
    close_successes = [
        row
        for row in stages
        if row["stage"] == "observation.presentation.close" and row["status"] == "success"
    ]
    require(len(close_successes) == 1, "owned presentation close count changed")
    require(len(registration) == 4, "font registration record count changed")
    require({item["sha256"] for item in registration} == FONT_HASHES, "registered font hashes changed")
    require(all(item["added"] == 1 and item["removed"] is True for item in registration), "owned font cleanup changed")

    source_path = ROOT / "native-run" / "inputs" / "table-fixture" / "source.pptx"
    require(sha256(source_path) == SOURCE_SHA256, "source PPTX changed")
    require(report["source"]["sha256"] == SOURCE_SHA256, "reported source hash changed")
    require(report["source"]["snapshotSha256"] == SOURCE_SHA256, "snapshot hash changed")
    require(sha256(ROOT / "native-run" / "inputs" / "native-mixed-table-observe.ps1") == WORKER_SHA256, "worker changed")
    with zipfile.ZipFile(source_path) as archive:
        require(archive.testzip() is None, "source PPTX CRC failure")
        names = archive.namelist()
        require(
            not [name for name in names if Path(name).suffix.lower() in FONT_SUFFIXES or name.lower().startswith("ppt/fonts/")],
            "source PPTX embeds a font program",
        )
        xml_names = [name for name in names if name.endswith((".xml", ".rels"))]
        for name in xml_names:
            ET.fromstring(archive.read(name))
        slide_xml = ET.fromstring(archive.read("ppt/slides/slide1.xml"))

    frame = slide_xml.find(".//p:graphicFrame", NS)
    require(frame is not None, "source table frame missing")
    off = frame.find("./p:xfrm/a:off", NS)
    ext = frame.find("./p:xfrm/a:ext", NS)
    row = frame.find(".//a:tr", NS)
    grid = frame.find(".//a:tblGrid/a:gridCol", NS)
    cell_properties = frame.find(".//a:tcPr", NS)
    spacing = frame.find(".//a:pPr/a:lnSpc/a:spcPts", NS)
    require(all(value is not None for value in (off, ext, row, grid, cell_properties, spacing)), "source geometry XML incomplete")
    expected_geometry = {
        "left": int(off.attrib["x"]) / 12700,
        "top": int(off.attrib["y"]) / 12700,
        "width": int(ext.attrib["cx"]) / 12700,
        "height": int(ext.attrib["cy"]) / 12700,
    }
    expected_margins = {
        "marginLeft": int(cell_properties.attrib["marL"]) / 12700,
        "marginRight": int(cell_properties.attrib["marR"]) / 12700,
        "marginTop": int(cell_properties.attrib["marT"]) / 12700,
        "marginBottom": int(cell_properties.attrib["marB"]) / 12700,
    }
    expected_row_height = int(row.attrib["h"]) / 12700
    expected_column_width = int(grid.attrib["w"]) / 12700
    requested_spacing = int(spacing.attrib["val"]) / 100

    observation = report["observation"]
    require(observation["readOnly"] == -1, "presentation was not observed read-only")
    require(observation["slideCount"] == 1 and observation["shapeCount"] == 1, "slide/shape count changed")
    require(close(observation["slideWidth"], 960) and close(observation["slideHeight"], 540), "slide geometry changed")
    for geometry_name in ("shape", "cell"):
        actual = observation["shape"]["geometry"] if geometry_name == "shape" else observation["cell"]["geometry"]
        require(
            all(close(actual[key], expected_geometry[key]) for key in expected_geometry),
            f"{geometry_name} outer geometry differs from source XML",
        )
    require(close(observation["table"]["rowHeight"], expected_row_height), "row height changed")
    require(close(observation["table"]["columnWidth"], expected_column_width), "column width changed")
    require(
        all(close(observation["cell"]["frame"][key], value) for key, value in expected_margins.items()),
        "cell margins differ from source XML",
    )

    expected = request["expectations"]
    whole = observation["cell"]["whole"]
    require(whole["text"] == expected["text"], "whole-cell text changed")
    require(whole["start"] == 1 and whole["length"] == len(expected["text"]) == 245, "whole-cell range changed")
    require(whole["text"].count("\t") == 1 and "\n" not in whole["text"] and "\r" not in whole["text"], "tab/hard-break content changed")
    actual_runs = observation["cell"]["runs"]
    expected_runs = expected["runs"]
    require(len(actual_runs) == len(expected_runs) == 5, "run count changed")
    for actual, wanted in zip(actual_runs, expected_runs):
        require(actual["start"] == wanted["start"] and actual["length"] == wanted["length"], "run range changed")
        require(actual["text"] == wanted["text"], "run text changed")
        font = actual["font"]
        require(font["name"] == "Carlito" and close(font["size"], wanted["size"]), "run family/size changed")
        require(font["bold"] == (-1 if wanted.get("bold") else 0), "run bold changed")
        require(font["italic"] == (-1 if wanted.get("italic") else 0), "run italic changed")

    probes = observation["cell"]["characters"]
    require(len(probes) == len(expected["characterProbes"]) == 7, "probe count changed")
    for actual, wanted in zip(probes, expected["characterProbes"]):
        require(actual["position"] == actual["start"] == wanted["position"], "probe start changed")
        require(actual["length"] == 1 and actual["text"] == wanted["text"], "probe text changed")
        containing = next(
            run
            for run in expected_runs
            if run["start"] <= wanted["position"] < run["start"] + run["length"]
        )
        font = actual["font"]
        require(font["name"] == "Carlito" and close(font["size"], containing["size"]), "probe family/size changed")
        require(font["bold"] == (-1 if containing.get("bold") else 0), "probe bold changed")
        require(font["italic"] == (-1 if containing.get("italic") else 0), "probe italic changed")

    lines = observation["cell"]["lines"]["records"]
    require(len(lines) == observation["cell"]["lines"]["count"] == 3, "native line count changed")
    intervals = []
    reconstructed = []
    cursor = 0
    for line in lines:
        start0 = line["start"] - 1
        end0 = start0 + line["length"]
        require(start0 == cursor, "native line intervals are not contiguous")
        require(whole["text"][start0:end0] == line["text"], "native line text changed")
        intervals.append([start0, end0])
        reconstructed.append(line["text"])
        cursor = end0
    require(intervals == [[0, 92], [92, 194], [194, 245]], "native soft intervals changed")
    require("".join(reconstructed) == whole["text"], "native lines do not reconstruct source")
    inspection = load_json(ROOT / "native-run" / "inputs" / "table-fixture" / "inspection.json")
    estimated_lines = inspection["acceptedLayoutTrace"]["lines"]
    estimated_intervals = [[line["start"], line["end"]] for line in estimated_lines]
    require(estimated_intervals == [[0, 78], [78, 172], [172, 245]], "estimated intervals changed")
    require(intervals != estimated_intervals, "native and estimated intervals unexpectedly match")

    paragraph = observation["cell"]["paragraph"]
    require(paragraph["count"] == 1 and paragraph["explicitTabStopCount"] == 0, "paragraph/tab-stop count changed")
    require(paragraph["defaultTabSpacing"] == 72, "native default tab spacing changed")
    after_tab = next(item for item in probes if item["purpose"] == "after-tab")
    require(after_tab["bounds"]["left"] - whole["bounds"]["left"] == 72, "native tab offset changed")
    require(requested_spacing == 36.6, "source requested spacing changed")
    require(close(paragraph["spaceWithin"], requested_spacing), "native SpaceWithin changed")
    line_tops = [line["bounds"]["top"] for line in lines]
    require(line_tops == [6, 43, 80], "native line tops changed")
    require([line_tops[i + 1] - line_tops[i] for i in range(2)] == [37, 37], "native line step changed")

    metrics = report["metrics"]
    require(metrics["contentAndStylePassed"] is True, "worker content/style gate changed")
    require(metrics["geometryPassed"] is True, "worker geometry gate changed")
    require(metrics["softWrapPassed"] is True, "worker soft-wrap gate changed")
    require(metrics["inputsStable"] is True and metrics["rasterPresent"] is True, "worker integrity/raster gate changed")
    require(metrics["gatePassed"] is True and not metrics["failures"], "worker aggregate gate changed")

    native_png = ROOT / "native-run" / "native-observation.png"
    estimated_png = ROOT / "estimated" / "preview.png"
    require(sha256(native_png) == NATIVE_PNG_SHA256, "native PNG changed")
    require(sha256(estimated_png) == ESTIMATED_PNG_SHA256, "estimated PNG changed")
    require(png_dimensions(native_png) == (1280, 720), "native PNG dimensions changed")
    require(png_dimensions(estimated_png) == (1280, 720), "estimated PNG dimensions changed")
    review = load_json(ROOT / "review" / "root-review.json")
    require(len(review["images"]) == 2 and all(item["fullSlideReviewed"] for item in review["images"]), "root image review changed")
    require({item["sha256"] for item in review["images"]} == {NATIVE_PNG_SHA256, ESTIMATED_PNG_SHA256}, "review image binding changed")

    pure = load_json(ROOT / "controls" / "pure-regression-02.json")
    fixture_control = load_json(ROOT / "controls" / "fixture-contract-02.json")
    require(pure["passed"] is True and pure["officeOrComCalls"] == 0, "pure regression changed")
    require(fixture_control["passed"] is True, "fixture contract changed")
    require(fixture_control["officeCalls"] == fixture_control["fontRegistrationCalls"] == 0, "fixture control used Office/fonts")

    audit_v1 = load_json(ROOT / "audit" / "report.json")
    audit_v2 = load_json(ROOT / "audit" / "report-v2.json")
    require(sha256(ROOT / "audit" / "report.json") == AUDIT_V1_SHA256, "v1 audit changed")
    require(sha256(ROOT / "audit" / "report-v2.json") == AUDIT_V2_SHA256, "v2 audit changed")
    for version, audit in ((1, audit_v1), (2, audit_v2)):
        require(audit["summary"]["passed"] is True, f"v{version} audit failed")
        require(audit["summary"]["passedChecks"] == audit["summary"]["checkCount"] == 9, f"v{version} audit count changed")
        require(all(item["passed"] for item in audit["checks"]), f"v{version} audit check failed")
    v2_names = {item["name"] for item in audit_v2["checks"]}
    require(
        "whole-cell text, five exact native runs, seven character text/starts/styles, one paragraph/tab" in v2_names,
        "v2 probe-style check missing",
    )
    require(
        "native shape/cell bounds, table extents, and frame margins match source XML within 0.02 pt" in v2_names,
        "v2 outer-geometry check missing",
    )

    generation = load_json(ROOT / "native-run" / "inputs" / "table-fixture" / "generation.json")
    require(generation["generatedAt"] == "2026-09-21T00:00:00.000Z", "fixed generation metadata changed")
    context = load_json(ROOT / "source-context.json")
    require(context["source"]["generatedAtMeaning"] == "fixed reproducibility metadata, not actual wall-clock generation time", "generatedAt scope changed")
    require(context["portableRecipe"]["nativeExecutionByPortableVerifier"] is False, "portable verifier native scope changed")

    result = {
        "passed": True,
        "manifestFiles": len(listed),
        "manifestBytes": actual_bytes,
        "sourceCopies": ledger["files"],
        "stages": len(stages),
        "pairedComCalls": len(begin_indices),
        "inputHashChecks": len(supervisor["inputChecks"]),
        "ownedPresentationCloses": len(close_successes),
        "ownedFontRemovals": len(registration),
        "authoredRuns": len(actual_runs),
        "characterProbesWithContainingRunStyle": len(probes),
        "nativeLineIntervals0": intervals,
        "estimatedLineIntervals0": estimated_intervals,
        "auditV1": "9/9",
        "auditV2": "9/9",
        "forbiddenArtifacts": 0,
        "officeCalls": 0,
        "fontCalls": 0,
    }
    print(json.dumps(result, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
