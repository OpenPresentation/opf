"""Verify the combined immutable Windows tab/font checkpoint without Office."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'artifact-manifest.json').read_text(encoding='utf-8'))
records = manifest['artifacts']
expected = {record['path']: record for record in records}
assert len(records) == len(expected) == manifest['files']
actual = {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p != root / 'artifact-manifest.json'}
assert actual == set(expected), ('inventory mismatch', actual ^ set(expected))
for name, record in expected.items():
    local = root / name
    assert not local.is_symlink() and local.resolve().is_relative_to(root)
    assert local.suffix.lower() not in {'.ttf', '.otf', '.woff', '.woff2', '.pdf', '.fntdata', '.odttf', '.eot', '.svg'}
    raw = local.read_bytes()
    assert len(raw) == record['bytes'] and hashlib.sha256(raw).hexdigest() == record['sha256'], name
assert sum(r['bytes'] for r in records) == manifest['bytes']
children = {}
for name in ['tabs', 'fonts']:
    result = subprocess.run([sys.executable, str(root / name / 'portable-verify.py')], capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, (name, result.stdout, result.stderr)
    children[name] = json.loads(result.stdout)
    assert children[name]['passed'] is True
print(json.dumps({'passed': True, 'hashedFiles': len(records), 'children': children, 'nativeCompatibilityComplete': False, 'officeCalls': 0}))
