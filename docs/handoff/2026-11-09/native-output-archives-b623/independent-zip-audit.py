# Independent standard-library ZIP interoperability/CRC/size/SHA audit; no extraction.
import hashlib
import json
import pathlib
import stat
import zipfile

packet = pathlib.Path(__file__).resolve().parent
root = packet.parents[3]
manifest = json.loads((packet / 'manifest.json').read_text(encoding='utf-8'))
count = 0
expanded = 0
archives = []
for archive in manifest['archives']:
    archive_path = root / archive['archivePath']
    assert archive_path.stat().st_size == archive['bytes'] < 50 * 1024 * 1024
    assert hashlib.sha256(archive_path.read_bytes()).hexdigest() == archive['sha256']
    with zipfile.ZipFile(archive_path) as handle:
        entries = handle.infolist()
        assert [entry.filename for entry in entries] == [entry['path'] for entry in archive['files']]
        assert len(entries) == archive['expectedFiles']
        assert not handle.comment
        for member, expected in zip(entries, archive['files'], strict=True):
            assert not member.is_dir() and stat.S_ISREG(member.external_attr >> 16)
            assert member.date_time == (1980, 1, 1, 0, 0, 0)
            assert member.file_size == expected['bytes'] < 32 * 1024 * 1024
            assert not member.extra and not member.comment
            data = handle.read(member)  # zipfile verifies the recorded CRC.
            assert len(data) == expected['bytes']
            assert hashlib.sha256(data).hexdigest() == expected['sha256']
            count += 1
            expanded += len(data)
        assert handle.testzip() is None
    archives.append({'file': archive['file'], 'members': len(entries), 'bytes': archive['bytes'], 'sha256': archive['sha256']})
assert count == 464
assert expanded == 62403385
print(json.dumps({'result': 'PASS', 'reader': 'Python standard-library zipfile', 'source': manifest['source'], 'sourceTree': manifest['sourceTree'], 'archives': archives, 'members': count, 'expandedBytes': expanded, 'nativeAcceptance': False, 'suiteSealed': False}, indent=2))
