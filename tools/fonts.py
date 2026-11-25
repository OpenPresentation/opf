#!/usr/bin/env python3
"""Installed font families on this Mac, and which fonts a .pptx names that are not installed.

  fonts.py --list [--out installed-fonts.json]       write the installed families (CoreText through `swift`, no prompt)
  fonts.py <file.pptx>... [--installed installed-fonts.json] [--json]
                                                    per file: every font the package names, where, and whether installed

Installed = the faces CoreText reports as available (CTFontCollectionCreateFromAvailableFonts). Every face's `name` table is
read from its file so localized family names count too (a deck may name "等线" for DengXian, "游ゴシック" for Yu Gothic).
Fonts that macOS can download on demand but has not downloaded are NOT installed (Keynote substitutes them).
Matching is case-insensitive on family, full name, PostScript name and every localized family name.
"""
import json
import os
import re
import struct
import subprocess
import sys
import tempfile
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_LIST = os.path.join(HERE, 'installed-fonts.json')

SWIFT = r'''
import CoreText
import Foundation
let c = CTFontCollectionCreateFromAvailableFonts(nil)
let ds = CTFontCollectionCreateMatchingFontDescriptors(c) as! [CTFontDescriptor]
var out: [[String: String]] = []
for d in ds {
  var r: [String: String] = [:]
  if let f = CTFontDescriptorCopyAttribute(d, kCTFontFamilyNameAttribute) as? String { r["family"] = f }
  if let f = CTFontDescriptorCopyAttribute(d, kCTFontNameAttribute) as? String { r["postscript"] = f }
  if let f = CTFontDescriptorCopyAttribute(d, kCTFontDisplayNameAttribute) as? String { r["display"] = f }
  if let f = CTFontDescriptorCopyAttribute(d, kCTFontStyleNameAttribute) as? String { r["style"] = f }
  if let u = CTFontDescriptorCopyAttribute(d, kCTFontURLAttribute) as? URL { r["file"] = u.path }
  out.append(r)
}
FileHandle.standardOutput.write(try! JSONSerialization.data(withJSONObject: out, options: []))
'''


def name_table_names(path):
    """All family-ish names (nameID 1, 4, 16) in every language from a .ttf/.otf/.ttc file's `name` tables."""
    names = set()
    try:
        with open(path, 'rb') as f:
            data = f.read()
    except OSError:
        return names
    offsets = [0]
    if data[:4] == b'ttcf':
        n = struct.unpack('>I', data[8:12])[0]
        offsets = list(struct.unpack('>%dI' % n, data[12:12 + 4 * n]))
    for off in offsets:
        try:
            num = struct.unpack('>H', data[off + 4:off + 6])[0]
            for i in range(num):
                rec = off + 12 + 16 * i
                tag, _, toff, tlen = struct.unpack('>4sIII', data[rec:rec + 16])
                if tag != b'name':
                    continue
                fmt, count, soff = struct.unpack('>HHH', data[toff:toff + 6])
                for j in range(count):
                    r = toff + 6 + 12 * j
                    pid, eid, lid, nid, ln, lo = struct.unpack('>HHHHHH', data[r:r + 12])
                    if nid not in (1, 4, 16):
                        continue
                    raw = data[toff + soff + lo:toff + soff + lo + ln]
                    if pid == 3 or pid == 0:
                        s = raw.decode('utf-16-be', 'replace')
                    elif pid == 1 and eid == 0:
                        s = raw.decode('mac_roman', 'replace')
                    else:
                        continue
                    s = s.strip('\x00').strip()
                    if s:
                        names.add(s)
        except struct.error:
            continue
    return names


def build_list():
    with tempfile.NamedTemporaryFile('w', suffix='.swift', delete=False) as t:
        t.write(SWIFT)
        sp = t.name
    try:
        out = subprocess.run(['swift', sp], capture_output=True, check=True, timeout=300).stdout
    finally:
        os.unlink(sp)
    faces = json.loads(out)
    fams = {}
    files_seen = {}
    for fc in faces:
        fam = fc.get('family') or '?'
        e = fams.setdefault(fam, {'family': fam, 'faces': [], 'names': set(), 'files': set()})
        e['faces'].append({k: fc.get(k) for k in ('postscript', 'display', 'style')})
        for k in ('family', 'postscript', 'display'):
            if fc.get(k):
                e['names'].add(fc[k])
        p = fc.get('file')
        if p:
            e['files'].add(p)
            if p not in files_seen:
                files_seen[p] = name_table_names(p)
            e['names'] |= files_seen[p]
    res = []
    for fam in sorted(fams, key=str.lower):
        e = fams[fam]
        res.append({'family': fam, 'names': sorted(e['names']), 'files': sorted(e['files']), 'faces': e['faces']})
    return {'source': 'CoreText CTFontCollectionCreateFromAvailableFonts + name tables', 'faceCount': len(faces),
            'familyCount': len(res), 'families': res}


def load_list(path):
    if not os.path.exists(path):
        d = build_list()
        with open(path, 'w') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
    with open(path) as f:
        return json.load(f)


def index(lst):
    idx = {}
    for e in lst['families']:
        for n in e['names'] + [e['family']]:
            idx[n.lower()] = e['family']
    return idx


TF = re.compile(r'<a:(latin|ea|cs|sym|font|buFont)\b([^>]*)>')
ATTR = re.compile(r'(\w+)="([^"]*)"')


def unesc(s):
    return s.replace('&amp;', '&').replace('&quot;', '"').replace('&apos;', "'").replace('&lt;', '<').replace('&gt;', '>')


def pptx_fonts(path):
    """{font name: {'where': set of 'theme:major/latin', 'theme:minor/Hans', 'slide3:ea', ...}}"""
    used = {}
    with zipfile.ZipFile(path) as z:
        for n in z.namelist():
            if not n.endswith('.xml') or not n.startswith('ppt/'):
                continue
            x = z.read(n).decode('utf-8', 'replace')
            part = n[4:-4]
            if part.startswith('theme/'):
                # mark major / minor scope
                for scope in ('majorFont', 'minorFont'):
                    m = re.search(r'<a:%s>(.*?)</a:%s>' % (scope, scope), x, re.S)
                    if not m:
                        continue
                    for el, attrs in TF.findall(m.group(1)):
                        a = dict(ATTR.findall(attrs))
                        tf = unesc(a.get('typeface', ''))
                        if not tf:
                            continue
                        where = '%s:%s/%s' % (part, scope[:5], a.get('script') or el)
                        used.setdefault(tf, set()).add(where)
                continue
            for el, attrs in TF.findall(x):
                a = dict(ATTR.findall(attrs))
                tf = unesc(a.get('typeface', ''))
                if not tf or tf.startswith('+'):
                    continue
                used.setdefault(tf, set()).add('%s:%s' % (part, el))
    return used


def check(path, idx):
    used = pptx_fonts(path)
    rows = []
    for name in sorted(used, key=str.lower):
        where = sorted(used[name])
        theme_script_only = all(re.search(r':(major|minor)/(?!latin$|ea$|cs$)', w) for w in where)
        rows.append({'name': name, 'installed': name.lower() in idx, 'installedAs': idx.get(name.lower()),
                     'themeScriptListOnly': theme_script_only, 'where': where[:12], 'whereCount': len(where)})
    return {'file': path, 'fonts': rows, 'missing': [r['name'] for r in rows if not r['installed']],
            'missingUsedOutsideThemeScriptList': [r['name'] for r in rows if not r['installed'] and not r['themeScriptListOnly']]}


def main(argv):
    if not argv or argv[0] in ('-h', '--help'):
        print(__doc__)
        return 0
    if argv[0] == '--list':
        out = argv[argv.index('--out') + 1] if '--out' in argv else DEFAULT_LIST
        d = build_list()
        with open(out, 'w') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
        print('%d families (%d faces) -> %s' % (d['familyCount'], d['faceCount'], out))
        return 0
    lst_path = DEFAULT_LIST
    as_json = False
    files = []
    i = 0
    while i < len(argv):
        if argv[i] == '--installed':
            lst_path = argv[i + 1]
            i += 2
            continue
        if argv[i] == '--json':
            as_json = True
        else:
            files.append(argv[i])
        i += 1
    idx = index(load_list(lst_path))
    res = [check(f, idx) for f in files]
    if as_json:
        print(json.dumps(res, ensure_ascii=False, indent=1))
    else:
        for r in res:
            print('%s\tnot installed, named in runs/theme latin-ea-cs: %s\t(+%d only in the theme per-script list)' % (
                r['file'], ', '.join(r['missingUsedOutsideThemeScriptList']) or '-',
                len(r['missing']) - len(r['missingUsedOutsideThemeScriptList'])))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
