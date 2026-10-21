#!/usr/bin/env python3
"""Verify or safely extract a portable audit. Python standard library only."""
import argparse
import hashlib
import json
import re
import sys
import tarfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


def digest(data):
    return hashlib.sha256(data).hexdigest()


class References(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []
        self.json_blocks = []
        self.in_json = False

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        for key in ("src", "href", "poster"):
            if values.get(key):
                self.refs.append((key, values[key]))
        if tag == "script" and values.get("type") == "application/json":
            self.in_json = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_json = False

    def handle_data(self, data):
        if self.in_json:
            self.json_blocks.append(data)


PATH_KEYS = {"file", "png", "svg", "input", "opf", "geometry", "findings", "galleryPng", "href", "src", "poster", "comparison", "report", "before", "after", "contactSheet", "sheet", "json", "url"}
SUFFIXES = (".png", ".svg", ".json", ".html", ".md", ".mjs", ".log", ".py", ".yaml")


def json_refs(value, key=""):
    if isinstance(value, dict):
        for child_key, child in value.items():
            yield from json_refs(child, child_key)
    elif isinstance(value, list):
        for child in value:
            yield from json_refs(child, key)
    elif isinstance(value, str) and (key in PATH_KEYS or value.startswith(("../original/", "../../original/", "../../../original/"))):
        parts = urlsplit(value)
        if not parts.scheme and value.split("#")[0].split("?")[0].endswith(SUFFIXES) and not re.search(r"\s", value):
            yield key, value


def verify_root(root):
    root = root.resolve()
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    errors = []
    checked = {"hashes": 0, "jsonFiles": 0, "htmlFiles": 0, "localReferences": 0, "embeddedJsonBlocks": 0}
    for entry in manifest["files"]:
        file = root / entry["path"]
        if not file.is_file():
            errors.append({"kind": "missing-file", "file": entry["path"]})
        elif digest(file.read_bytes()) != entry["sha256"]:
            errors.append({"kind": "hash-mismatch", "file": entry["path"]})
        checked["hashes"] += 1

    def check_reference(file, role, value):
        parsed = urlsplit(value)
        if parsed.scheme or parsed.netloc or value.startswith("#") or not parsed.path:
            return
        target = (file.parent / unquote(parsed.path)).resolve()
        checked["localReferences"] += 1
        if not target.is_relative_to(root):
            errors.append({"kind": "reference-outside-bundle", "file": str(file.relative_to(root)), "role": role, "reference": value})
        elif not target.is_file():
            errors.append({"kind": "broken-reference", "file": str(file.relative_to(root)), "role": role, "reference": value})

    for file in sorted((root / "portable").rglob("*")):
        if not file.is_file():
            continue
        if file.suffix == ".json":
            try:
                value = json.loads(file.read_text(encoding="utf-8"))
                checked["jsonFiles"] += 1
                for role, ref in json_refs(value):
                    check_reference(file, role, ref)
            except (ValueError, UnicodeError) as error:
                errors.append({"kind": "invalid-json", "file": str(file.relative_to(root)), "message": str(error)})
        if file.suffix == ".html":
            parser = References()
            parser.feed(file.read_text(encoding="utf-8"))
            checked["htmlFiles"] += 1
            for role, ref in parser.refs:
                check_reference(file, role, ref)
            for block in parser.json_blocks:
                try:
                    value = json.loads(block)
                    checked["embeddedJsonBlocks"] += 1
                    for role, ref in json_refs(value):
                        check_reference(file, role, ref)
                except ValueError as error:
                    errors.append({"kind": "invalid-embedded-json", "file": str(file.relative_to(root)), "message": str(error)})
    actual = manifest["reviewCounts"]
    expected = {"proposals": 35, "gallery": 28, "columns": 34, "auto": 20, "stress": 21}
    if actual != expected:
        errors.append({"kind": "review-counts", "expected": expected, "actual": actual})
    return {"valid": not errors, "checked": checked, "reviewCounts": actual, "errors": errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path)
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--checksum", type=Path)
    parser.add_argument("--extract", type=Path)
    args = parser.parse_args()
    if args.archive:
        actual = digest(args.archive.read_bytes())
        if args.checksum:
            expected = args.checksum.read_text(encoding="utf-8").split()[0]
            if actual != expected:
                print(json.dumps({"valid": False, "error": "archive-checksum-mismatch"}))
                return 1
        if args.extract:
            target = args.extract.resolve()
            target.mkdir(parents=True, exist_ok=True)
            with tarfile.open(args.archive, "r:gz") as archive:
                for member in archive.getmembers():
                    destination = (target / member.name).resolve()
                    if not destination.is_relative_to(target) or not member.isfile():
                        raise ValueError("Archive contains an unsafe entry")
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    with archive.extractfile(member) as source:
                        destination.write_bytes(source.read())
            result = verify_root(target / "slide-design-audit")
        else:
            result = {"valid": True, "archiveSha256": actual}
    elif args.root:
        result = verify_root(args.root)
    else:
        parser.error("Provide --root or --archive")
    print(json.dumps(result, indent=2))
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    sys.exit(main())
