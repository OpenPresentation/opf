#!/usr/bin/env python3
"""Snapshot historical audit evidence without modifying it; standard library only."""
import argparse
import gzip
import hashlib
import html
import io
import json
import os
import posixpath
import re
import shutil
import sys
import tarfile
from pathlib import Path
from urllib.parse import urlsplit

from verify import verify_root

DIRECTORY = Path(__file__).resolve().parent
REPOSITORY = DIRECTORY.parent.parent
EXCLUDED = {"gallery-source", ".git", "node_modules", ".cache", "cache", "__pycache__"}
TEXT_EXTENSIONS = {".json", ".html", ".md", ".mjs", ".py", ".log", ".yaml"}
SECRET_PATTERNS = {
    "private-key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "github-token": re.compile(rb"(?:github_pat_[A-Za-z0-9_]{40,}|gh[pousr]_[A-Za-z0-9]{36,255})"),
    "openai-key": re.compile(rb"sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}"),
    "slack-token": re.compile(rb"xox[baprs]-[A-Za-z0-9-]{20,}"),
    "aws-access-key": re.compile(rb"(?:AKIA|ASIA)[A-Z0-9]{16}"),
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode()


def source_files(source):
    files = []
    excluded = []
    for base, dirs, names in os.walk(source):
        for directory in sorted(dirs):
            if directory in EXCLUDED:
                excluded.append(str((Path(base) / directory).relative_to(source)))
        dirs[:] = sorted(directory for directory in dirs if directory not in EXCLUDED)
        for name in sorted(names):
            file = Path(base) / name
            if file.is_symlink():
                raise ValueError("Unexpected evidence symlink: " + str(file.relative_to(source)))
            files.append(file)
    return sorted(files), excluded


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--prepare", action="store_true")
    mode.add_argument("--seal", action="store_true")
    parser.add_argument("--source", type=Path, default=REPOSITORY / "artifacts/design-audit")
    parser.add_argument("--metadata", type=Path)
    args = parser.parse_args()
    if args.seal and not args.metadata:
        parser.error("--seal requires final --metadata from the primary agent")
    source = args.source.resolve()
    staging_root = DIRECTORY / ".build"
    if source == staging_root or source.is_relative_to(staging_root):
        raise ValueError("Source evidence must be outside the disposable staging directory")
    files, excluded = source_files(source)
    original = {str(file.relative_to(source)): file.read_bytes() for file in files}
    supplemental_names = set()
    for file in sorted((DIRECTORY / "user-reference").glob("*")):
        if file.is_file():
            name = "user-reference/" + file.name
            original[name] = file.read_bytes()
            supplemental_names.add(name)
    originals_manifest = [{"sourceRelativePath": name, "origin": "handoff-user-reference" if name in supplemental_names else "audit", "bytes": len(data), "sha256": digest(data)} for name, data in original.items()]
    secret_findings = []
    scanned = 0
    log_count = 0
    for name, data in original.items():
        if Path(name).suffix in TEXT_EXTENSIONS:
            scanned += 1
            log_count += Path(name).suffix == ".log"
            for kind, pattern in SECRET_PATTERNS.items():
                if pattern.search(data):
                    secret_findings.append({"file": name, "kind": kind})
    if secret_findings:
        # Never print matched values. Preserve the originals in place and stop export for review.
        print(json.dumps({"valid": False, "credentialPatternMatches": secret_findings}, indent=2))
        return 1

    text_names = {name for name in original if Path(name).suffix in TEXT_EXTENSIONS}
    mapping = {name: ("portable/" if name in text_names else "original/") + name for name in original}
    bundle = DIRECTORY / ".build/slide-design-audit"
    if bundle.exists():
        shutil.rmtree(bundle)
    bundle.mkdir(parents=True)
    normalizations = []

    def relative_target(name, current):
        return posixpath.relpath(mapping[name], posixpath.dirname("portable/" + current))

    def known_reference(value, current):
        if value.startswith("data:"):
            return value
        # Query/hash suffixes are preserved; line suffixes are provenance, not removed.
        parts = re.match(r"^([^?#]+)([?#].*)?$", value)
        if not parts:
            return None
        path_part, suffix = parts.group(1), parts.group(2) or ""
        prefix = str(source) + "/"
        if path_part.startswith(prefix):
            candidates = [path_part[len(prefix):]]
        elif "/artifacts/design-audit/" in path_part:
            candidates = [path_part.split("/artifacts/design-audit/", 1)[1]]
        elif path_part.startswith("artifacts/design-audit/"):
            candidates = [path_part[len("artifacts/design-audit/"):]]
        elif not urlsplit(path_part).scheme and not path_part.startswith("/"):
            candidates = [posixpath.normpath(posixpath.join(posixpath.dirname(current), path_part)), posixpath.normpath(path_part)]
        else:
            return None
        for candidate in candidates:
            if candidate in mapping:
                return relative_target(candidate, current) + suffix
        return None

    absolute_audit_pattern = re.compile(r"/(?:[^/\s\"'<>`\\)\]}]+/)*artifacts/design-audit/([^\s\"'<>`\\)\]}]+)")
    repository_pattern = re.compile(r"/Users/[^/\s\"'<>]+/Source/([^/\s\"'<>]+)/([^\s\"'<>`\\)\]}]+)")
    other_machine_pattern = re.compile(r"/Users/[^\s\"'<>`\\)\]}]+")
    temporary_machine_pattern = re.compile(r"/(?:private/)?var/folders/[^\s\"'<>`\\)\]}]+")
    temporary_proof_pattern = re.compile(r"/(?:private/)?tmp/[^\s\"'<>`\\)\]}]+")
    local_pattern = re.compile(r"https?://(?:localhost|127\.0\.0\.1)(?::\d+)?/([^\s\"'<>`\\)\]}]*)")

    def normalize_local_url(match, current):
        path = match.group(1)
        if path.startswith("portable/"):
            relative = path[len("portable/"):]
            parts = relative.split("#", 1)
            target = mapping.get(parts[0])
            if parts[0] in {"index.html", "catalog.json"}:
                target = "portable/" + parts[0]
            if target:
                return posixpath.relpath(target, posixpath.dirname("portable/" + current)) + ("#" + parts[1] if len(parts) > 1 else "")
        return known_reference(path, current) or "temporary-proof:historical-static-server/" + path

    def normalize_string(value, current):
        if value.startswith("data:"):
            return value
        if value.endswith("/handoff/slide-design-audit/.build/slide-design-audit"):
            return "temporary-proof:prepared-bundle-root"
        exact = known_reference(value, current)
        if exact is not None:
            return exact
        if value.startswith("artifacts/design-audit/gallery-source/"):
            return "repository:gallery/" + value[len("artifacts/design-audit/gallery-source/"):]
        if value == "docs/slide-design-principles.md":
            return relative_target("slide-design-principles.md", current)
        if value.startswith(("docs/", "spec/", "packages/", "scripts/")) and not re.search(r"\s", value):
            return "repository:opf/" + value
        sibling = re.match(r"^\.\./(opf(?:-render|-editor|-pptx)?|pptx-gallery|pptx-dev|openpresentation-site)/(.+)$", value)
        if sibling and not re.search(r"\s", value):
            return "repository:" + sibling.group(1) + "/" + sibling.group(2)
        repository_reference = re.match(r"^(opf(?:-render|-editor|-pptx)?|pptx-gallery|pptx-dev|openpresentation-site)/(.+)$", value)
        if repository_reference and not re.search(r"\s", value):
            return "repository:" + repository_reference.group(1) + "/" + repository_reference.group(2)
        result = absolute_audit_pattern.sub(lambda match: relative_target(match.group(1), current) if match.group(1) in mapping else "historical-audit-reference:" + match.group(1), value)
        result = repository_pattern.sub(lambda match: "repository:" + match.group(1) + "/" + match.group(2), result)
        result = other_machine_pattern.sub(lambda match: "external-provenance:" + match.group(0).split("/", 3)[-1], result)
        result = temporary_machine_pattern.sub(lambda match: "external-provenance:temporary-user-file/" + match.group(0).rsplit("/", 1)[-1], result)
        result = temporary_proof_pattern.sub(lambda match: "temporary-proof:" + match.group(0).rsplit("/", 1)[-1], result)
        result = local_pattern.sub(lambda match: normalize_local_url(match, current), result)
        return result

    def normalize_json(value, current):
        if isinstance(value, dict):
            return {key: normalize_json(child, current) for key, child in value.items()}
        if isinstance(value, list):
            return [normalize_json(child, current) for child in value]
        if isinstance(value, str):
            return normalize_string(value, current)
        return value

    def normalize_text(text, current):
        # JSON script payloads must be normalized structurally, not by substituting encoded source/data strings.
        json_script = re.compile(r'(<script\b[^>]*type=["\']application/json["\'][^>]*>)([\s\S]*?)(</script>)', re.I)
        saved_blocks = []

        def protect_script(match):
            data = normalize_json(json.loads(match.group(2)), current)
            normalized = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</script", "<\\/script")
            saved_blocks.append(match.group(1) + normalized + match.group(3))
            return "__PORTABLE_JSON_BLOCK_" + str(len(saved_blocks) - 1) + "__"

        result = json_script.sub(protect_script, text) if current.endswith(".html") else text
        # Static attributes and quoted path literals use the source file's original context.
        result = re.sub(r'(["\'])([^"\'\n<>]+)\1', lambda match: match.group(1) + (known_reference(match.group(2), current) or match.group(2)) + match.group(1), result)
        result = normalize_string(result, current)
        for index, block in enumerate(saved_blocks):
            result = result.replace("__PORTABLE_JSON_BLOCK_" + str(index) + "__", block)
        return result

    def write(name, data):
        file = bundle / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(data)

    for name, data in original.items():
        write("original/" + name, data)
        if name in text_names:
            if Path(name).suffix == ".json":
                copied = json_bytes(normalize_json(json.loads(data), name))
            else:
                copied = normalize_text(data.decode(), name).encode()
            if b"/Users/" in copied or re.search(rb"https?://(?:localhost|127\.0\.0\.1)(?::\d+)?", copied):
                raise ValueError("Machine-dependent portable copy remains: " + name)
            # Every data URL remains exact; data URLs are never normalized or decoded/re-encoded.
            data_url_pattern = rb"data:[^\s\"'<>]+"
            if sorted(re.findall(data_url_pattern, data)) != sorted(re.findall(data_url_pattern, copied)):
                raise ValueError("Data URL bytes changed: " + name)
            write("portable/" + name, copied)
            normalizations.append({"source": "original/" + name, "portable": "portable/" + name, "originalSha256": digest(data), "portableSha256": digest(copied), "changed": copied != data})

    load_original = lambda name: json.loads(original[name])
    proposals = load_original("proposal-queue.json")
    gallery = load_original("gallery/baseline/manifest.json")
    columns = load_original("columns/manifest.json")
    auto = load_original("auto/index.json")
    stress = load_original("candidates/sparse-stress/report.json")
    counts = {"proposals": len(proposals["items"]), "gallery": len(gallery["entries"]), "columns": len(columns["entries"]) + len(columns["controls"]), "auto": len(auto["cases"]), "stress": len(stress["cases"])}
    if counts != {"proposals": 35, "gallery": 28, "columns": 34, "auto": 20, "stress": 21}:
        raise ValueError("Unexpected review counts: " + str(counts))
    approval_state = {
        "status": "All 35 proposals remain individually pending; export does not approve any item.",
        "reviewMethod": "Discuss and approve the complete batch per layout or logical item, one item at a time.",
        "sharedEngineSchemaDefaultApproval": False,
        "auditBranchMergeApproval": False,
        "releaseApproval": False,
        "separatelyAuthorized": "Principles-only documentation merge to main; handled separately by the primary agent.",
        "contentConstraints": ["Text #6: preserve content; longer prose is rejected as a design fix.", "List #7: consider whole title-and-body group centering while preserving proximity; avoid isolated-body centering."],
        "currentStackRefreshRequired": True,
        "overallDesignGoal": "Blocked awaiting individual proposal decisions; transport completion does not achieve the overall goal.",
        "items": [{"id": item["id"], "title": item["title"], "decision": item["decision"], "approvalScope": item["approvalScope"]} for item in proposals["items"]],
    }
    (DIRECTORY / "approval-state.json").write_bytes(json_bytes(approval_state))
    write("approval-state.json", json_bytes(approval_state))

    def from_context(value, context):
        target = known_reference(value, context)
        if target is None:
            raise ValueError("Missing index reference: " + context + ":" + value)
        absolute = posixpath.normpath(posixpath.join("portable", posixpath.dirname(context), target))
        return posixpath.relpath(absolute, "portable")

    def catalog_entry(record, context):
        return {"id": record["id"], "title": record.get("title", record.get("name", record["id"])), "files": {key: from_context(value, context) for key, value in record.get("files", {}).items() if isinstance(value, str)}}

    catalog = {
        "scope": "Portable transport index; historical proposals remain individually unapproved.",
        "counts": counts,
        "proposals": [{"id": item["id"], "title": item["title"], "decision": item["decision"], "evidence": [{**entry, "file": from_context(entry["file"], "proposal-queue.json")} for entry in item["evidence"]]} for item in proposals["items"]],
        "gallery": [catalog_entry(item, "gallery/baseline/manifest.json") for item in gallery["entries"]],
        "columns": [catalog_entry(item, "columns/manifest.json") for item in columns["entries"] + columns["controls"]],
        "auto": [catalog_entry(item, "auto/index.json") for item in auto["cases"]],
        "stress": [{"id": item["id"], "layout": item["layout"], "variants": [{"state": variant["state"], "files": {key: from_context(variant[key], "candidates/sparse-stress/report.json") for key in ["png", "opf", "geometry", "svg"] if key in variant}} for variant in item["variants"]]} for item in stress["cases"]],
    }
    if "integration-20261020/manifest.json" in original:
        refreshed = load_original("integration-20261020/manifest.json")
        catalog["currentStackRefresh"] = {
            "scope": "Same-content current-stack evidence must be reviewed before renewing historical recommendations.",
            "counts": refreshed["counts"],
            "manifest": from_context("integration-20261020/manifest.json", "catalog.json"),
            "report": from_context("integration-20261020/report.html", "catalog.json"),
        }
    write("portable/catalog.json", json_bytes(catalog))
    rows = []
    for kind in ["proposals", "gallery", "columns", "auto", "stress"]:
        entries = catalog[kind]
        items = []
        for item in entries:
            links = item.get("files", {})
            if kind == "proposals":
                links = {entry["label"]: entry["file"] for entry in item["evidence"]}
            if kind == "stress":
                links = {variant["state"] + ":" + key: value for variant in item["variants"] for key, value in variant["files"].items()}
            anchors = " · ".join('<a href="' + html.escape(value, quote=True) + '">' + html.escape(key) + '</a>' for key, value in links.items())
            items.append('<li><strong>' + html.escape(item["id"]) + '</strong> ' + html.escape(item.get("title", "")) + '<br>' + anchors + '</li>')
        rows.append('<details><summary>' + html.escape(kind) + ': ' + str(len(entries)) + '</summary><ol>' + ''.join(items) + '</ol></details>')
    current_links = '<p>Start with the <a href="integration-20261020/report.html">82 same-content current-stack comparisons</a> and <a href="integration-20261020/manifest.json">refresh provenance/diagnostics</a>. New upstream behavior may supersede historical critiques.</p>' if "currentStackRefresh" in catalog else ''
    continuation_links = []
    for filename, label in [("cloud-continuation.md", "First cloud action and user instructions"), ("upstream-reassessment.md", "Upstream reassessment"), ("verification.json", "Current-stack verification"), ("portable-viewer-qa.json", "Relocated browser QA")]:
        relative = "integration-20261020/" + filename
        if relative in original:
            continuation_links.append('<a href="' + relative + '">' + label + '</a>')
    if continuation_links:
        current_links += '<p>' + ' · '.join(continuation_links) + '</p>'
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portable slide design audit</title><style>body{font:16px/1.55 system-ui,sans-serif;max-width:1100px;margin:40px auto;padding:0 20px;color:#17202b}a{color:#185790}li{margin:12px 0}details{margin:24px 0}summary{font-weight:700;cursor:pointer}.links{display:flex;gap:24px;flex-wrap:wrap}</style><h1>Portable slide design audit</h1><p>Historical evidence and proposals, preserved for cloud continuation. Viewing an item does not approve it. No shared engine change is authorized by this export.</p>''' + current_links + '''<div class="links"><a href="proposals.html">35 proposals · three at a time</a><a href="report.html">Gallery, columns and auto review · three at a time</a><a href="candidates/sparse-stress/report.html">21 stress comparisons · three at a time</a><a href="slide-design-principles.md">Timeless design principles</a><a href="catalog.json">Complete JSON index</a><a href="user-reference/provenance.json">User reference feedback</a></div><p>Every retained original file and its SHA256 are in <a href="../manifest.json">the manifest</a>. Normalized JSON and HTML point to preserved original PNG/SVG pixels. Original SHA fields describe original bytes; normalized files have separate hashes. Deliberately rejected controls and overflow are evidence, not recommendations.</p>''' + ''.join(rows) + '</html>'
    write("portable/index.html", page.encode())
    write("README.md", (DIRECTORY / "README.md").read_bytes())
    write("verify.py", (DIRECTORY / "verify.py").read_bytes())
    write("build_bundle.py", (DIRECTORY / "build_bundle.py").read_bytes())
    integration = json.loads(args.metadata.read_text(encoding="utf-8")) if args.metadata else {"status": "PREPARATION_ONLY_AWAITING_PRIMARYREADY", "finalReferences": None}
    write("integration-metadata.json", json_bytes(integration))
    inventory = []
    for file in sorted(bundle.rglob("*")):
        if file.is_file():
            data = file.read_bytes()
            inventory.append({"path": str(file.relative_to(bundle)), "bytes": len(data), "sha256": digest(data)})
    manifest = {
        "format": "slide-design-audit-portable-v1",
        "status": "sealed" if args.seal else "prepared-not-final",
        "original-source-root": str(source),
        "integration": integration,
        "approvalState": approval_state,
        "reviewCounts": counts,
        "sourceFileCount": len(original),
        "sourceAuditFileCount": len(files),
        "supplementalEvidenceFiles": sorted(supplemental_names),
        "sourceBytes": sum(len(data) for data in original.values()),
        "exclusions": {"directoryNames": sorted(EXCLUDED), "excludedPaths": excluded, "symlinks": "Rejected, never followed"},
        "credentialScan": {"textFiles": scanned, "logFiles": log_count, "patterns": sorted(SECRET_PATTERNS), "matches": 0, "matchedValuesPrinted": False},
        "normalization": {"originalEvidence": "Exact source bytes", "media": "Exact PNG/SVG bytes stored once under original/", "portableText": "Machine audit paths become verified relative references; other machine source paths become repository:/external-provenance: identifiers", "dataUrls": "Exact bytes preserved", "historicalHashFields": "Continue to refer to original evidence bytes", "files": normalizations},
        "originalFiles": originals_manifest,
        "files": inventory,
        "determinism": {"entryOrder": "sorted path", "mtime": 0, "uid": 0, "gid": 0, "mode": "0644", "gzipMtime": 0, "gzipFilename": "", "compressionLevel": 9},
    }
    write("manifest.json", json_bytes(manifest))
    verification = verify_root(bundle)
    (DIRECTORY / "preparation-verification.json").write_bytes(json_bytes(verification))
    (DIRECTORY / "prepared-inventory.json").write_bytes(json_bytes({key: manifest[key] for key in ["status", "original-source-root", "integration", "reviewCounts", "sourceFileCount", "sourceBytes", "exclusions", "credentialScan", "originalFiles"]}))
    # Re-read source bytes: export must not modify evidence, and concurrent edits must be captured by a later preparation.
    final_source_files, _ = source_files(source)
    if final_source_files != files:
        raise ValueError("Evidence file inventory changed during snapshot; retry after primary-ready integration")
    if any(file.read_bytes() != original[str(file.relative_to(source))] for file in files):
        raise ValueError("Evidence changed during snapshot; retry after primary-ready integration")
    if not verification["valid"]:
        print(json.dumps(verification, indent=2))
        return 1
    result = {"status": manifest["status"], "sourceFileCount": len(original), "sourceBytes": manifest["sourceBytes"], "bundleFiles": len(inventory) + 1, "reviewCounts": counts, "credentialMatches": 0, "verification": verification["checked"]}
    if args.seal:
        archive_path = DIRECTORY / "slide-design-audit.tar.gz"
        with archive_path.open("wb") as raw:
            with gzip.GzipFile(fileobj=raw, filename="", mode="wb", compresslevel=9, mtime=0) as compressed:
                with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as archive:
                    for file in sorted(bundle.rglob("*")):
                        if not file.is_file():
                            continue
                        data = file.read_bytes()
                        entry = tarfile.TarInfo("slide-design-audit/" + str(file.relative_to(bundle)))
                        entry.size = len(data)
                        entry.mode = 0o644
                        entry.mtime = 0
                        entry.uid = entry.gid = 0
                        entry.uname = entry.gname = ""
                        archive.addfile(entry, io.BytesIO(data))
        archive_bytes = archive_path.read_bytes()
        if len(archive_bytes) >= 50_000_000:
            raise ValueError("Archive exceeds the requested 50MB blob budget")
        (DIRECTORY / "archive.sha256").write_text(digest(archive_bytes) + "  slide-design-audit.tar.gz\n", encoding="utf-8")
        (DIRECTORY / "inventory.json").write_bytes(json_bytes(manifest))
        (DIRECTORY / "verification.json").write_bytes(json_bytes(verification))
        for stale in ["prepared-inventory.json", "preparation-verification.json"]:
            (DIRECTORY / stale).unlink(missing_ok=True)
        result.update({"archiveBytes": len(archive_bytes), "archiveSha256": digest(archive_bytes)})
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
