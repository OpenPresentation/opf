"""Verify this portable evidence inventory without Office or external packages."""
from pathlib import Path
import hashlib
import json
import zipfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'artifact-manifest.json').read_text(encoding='utf-8'))
expected = {record['path']: record for record in manifest['artifacts']}
assert len(expected) == len(manifest['artifacts']) == manifest['files'], 'Duplicate or missing manifest records'
actual = {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p.name != 'artifact-manifest.json'}
assert actual == set(expected), ('Inventory mismatch', actual - set(expected), set(expected) - actual)
decks = 0
for relative, record in expected.items():
    path = (root / relative).resolve()
    assert path.is_relative_to(root) and not path.is_symlink(), relative
    raw = path.read_bytes()
    assert len(raw) == record['bytes'], (relative, 'size changed')
    assert hashlib.sha256(raw).hexdigest() == record['sha256'], (relative, 'hash changed')
    if path.suffix == '.json':
        json.loads(raw.decode('utf-8-sig'))
    if path.suffix == '.pptx':
        with zipfile.ZipFile(path) as deck:
            assert deck.testzip() is None, relative
            for name in deck.namelist():
                assert not name.lower().endswith(('.fntdata', '.ttf', '.otf', '.odttf', '.woff', '.woff2')), (relative, name)
                if name.endswith(('.xml', '.rels')):
                    ET.fromstring(deck.read(name))
        decks += 1
assert sum(r['bytes'] for r in expected.values()) == manifest['bytes'], 'Manifest byte total changed'
print(json.dumps({'passed': True, 'hashedFiles': len(expected), 'pptxCrcXmlFontChecks': decks, 'officeCalls': 0}))
