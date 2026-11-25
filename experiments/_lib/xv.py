"""Shared helpers for the XML variants: copy a .pptx part by part, change only the named parts, keep every other
part byte-identical (same ZipInfo, same bytes), verify, and append manifest rows.
Manifest rows go to <group>/manifest-rows.tsv; experiments/build_manifest.py joins them into MANIFEST.tsv."""
import os, re, shutil, subprocess, sys, zipfile, hashlib, json
import xml.dom.minidom
W = '/Users/michael/opf-work/keynote-036'
EXP = f'{W}/experiments'

class Group:
    def __init__(self, name):
        self.name = name
        self.dir = f'{EXP}/{name}'
        os.makedirs(self.dir, exist_ok=True)
        self.rows = []

    def control(self, vid, src, look, what='as exported (byte copy)'):
        """A byte copy of an existing export, so the group folder holds its own control."""
        dst = f'{self.dir}/{vid}.pptx'
        shutil.copyfile(src, dst)
        self._check(dst, src, set())
        self.rows.append([dst, self.name, vid, src, what, look, '-'])
        return dst

    def variant(self, vid, src, edits, what, look, control, add=None, remove=()):
        """edits: {part: fn(str)->str} (text parts). add: {part: bytes} new parts. remove: parts to drop."""
        dst = f'{self.dir}/{vid}.pptx'
        zin = zipfile.ZipFile(src)
        changed = set()
        with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
            for info in zin.infolist():
                if info.filename in remove:
                    changed.add(info.filename); continue
                data = zin.read(info.filename)
                if info.filename in edits:
                    new = edits[info.filename](data.decode('utf-8')).encode('utf-8')
                    assert new != data, f'{vid}: {info.filename} unchanged'
                    data = new
                    changed.add(info.filename)
                z.writestr(info, data)
            for part, data in (add or {}).items():
                z.writestr(part, data); changed.add(part)
        missing = set(edits) - changed
        assert changed, f'{vid}: no part changed'
        assert not missing, f'{vid}: parts not found {missing}'
        self._check(dst, src, changed)
        self.rows.append([dst, self.name, vid, src, what, look, control])
        return dst

    def _check(self, dst, src, changed):
        z = zipfile.ZipFile(dst)
        assert z.testzip() is None, f'{dst}: bad CRC'
        a = zipfile.ZipFile(src)
        for n in z.namelist():
            d = z.read(n)
            if n.endswith('.xml') or n.endswith('.rels'):
                xml.dom.minidom.parseString(d)  # well-formed
            if n not in changed:
                assert d == a.read(n), f'{dst}: {n} differs but was not edited'
        r = subprocess.run([sys.executable, f'{W}/tools/pptx_inspect.py', '--summary', dst], capture_output=True, text=True, timeout=300)
        assert r.returncode == 0, f'pptx_inspect failed on {dst}: {r.stderr[-500:]}'

    def write(self):
        with open(f'{self.dir}/manifest-rows.tsv', 'w') as f:
            for r in self.rows:
                f.write('\t'.join(str(c).replace('\t', ' ').replace('\n', ' ') for c in r) + '\n')
        print(f'{self.name}: {len(self.rows)} files')

def nth(pattern, s, n, flags=re.S):
    """Span of the n-th (0-based) match."""
    m = list(re.finditer(pattern, s, flags))
    return m[n]

def sub_in(pattern, s, fn, n=None, flags=re.S):
    """Apply fn to the text of every (or the n-th) match of pattern."""
    ms = list(re.finditer(pattern, s, flags))
    assert ms, f'no match for {pattern[:60]}'
    if n is not None:
        ms = [ms[n]]
    out, last = [], 0
    for m in ms:
        out.append(s[last:m.start()]); out.append(fn(m.group(0))); last = m.end()
    out.append(s[last:])
    return ''.join(out)
