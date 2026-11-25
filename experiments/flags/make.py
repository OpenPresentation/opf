"""Flag re-exports of OPF 0.36.0 for the Keynote experiment round.
Builds three families with bin/build-deck (--suffix), then, for every family that uses --typefaces safe, replaces
preview/ with a preview laid out in the safe families (preview of the plain deck kept in preview-selected/).
The safe preview is drawn from a copy of the deck whose design.fontScheme names the safe families (read from the
safe export's theme); the copy is exported again and its slide/chart parts are compared with the safe export
(safe-preview.json: identical => the preview shows exactly the layout the safe file carries).
usage: python3 make.py [family ...]"""
import json, os, re, subprocess, sys, zipfile, shutil, hashlib
from concurrent.futures import ThreadPoolExecutor
W = '/Users/michael/opf-work/keynote-036'
BD = f'{W}/bin/build-deck'
OPF = f'{W}/bin/opf-036'
S36 = f'{W}/src-036'
L, M, G = f'{W}/decks/layouts', f'{W}/decks/matrix', f'{W}/decks/languages'
QUAL = {
    'layout-sampler': f'{S36}/examples/technical/layout-sampler.opf.json',
    'data-story-academy': f'{S36}/examples/gallery/design-and-media/data-story-academy-corporate-programs.opf.json',
    'full-feature-tour': f'{S36}/examples/technical/full-feature-tour.opf.json',
    'table-and-code': f'{S36}/examples/technical/table-and-code.opf.json',
}
FAMILIES = {
    'x-safe': ('-safe', ['--typefaces', 'safe'], [
        ('layouts-ordinary', f'{L}/layouts-ordinary.opf.json'), ('layouts-little', f'{L}/layouts-little.opf.json'),
        ('layouts-lots', f'{L}/layouts-lots.opf.json'), ('sweep-tables', f'{M}/sweep-tables.opf.json'),
        ('m-text-flush', f'{M}/m-text-flush.opf.json'), ('m-charts', f'{M}/m-charts.opf.json'),
        ('lang-latin-1', f'{G}/lang-latin-1.opf.json'), ('lang-cyrillic-greek', f'{G}/lang-cyrillic-greek.opf.json'),
        ('lang-other', f'{G}/lang-other.opf.json')] + list(QUAL.items())),
    'x-smartart-shapes': ('-smartart-shapes', ['--smart-art', 'shapes'], [
        ('layouts-ordinary', f'{L}/layouts-ordinary.opf.json'), ('layouts-little', f'{L}/layouts-little.opf.json'),
        ('layouts-lots', f'{L}/layouts-lots.opf.json')]),
    'x-keynote-profile': ('-keynote-profile', ['--body-text', 'native', '--typefaces', 'safe', '--slide-numbers', 'static'], [
        ('layouts-ordinary', f'{L}/layouts-ordinary.opf.json'), ('layouts-lots', f'{L}/layouts-lots.opf.json'),
        ('footers', f'{S36}/scripts/native-acceptance/qualification/decks/footers.opf.json'),
        ('data-story-academy', QUAL['data-story-academy'])]),
}

def build(fam, suffix, flags, name, src):
    r = subprocess.run([BD, '--force', '--suffix', suffix, '036', fam, src, name, '--', *flags], capture_output=True, text=True, timeout=1800)
    return (r.stdout + r.stderr).strip()

PARTS = re.compile(r'^ppt/(slides|charts)/[^/]+\.xml$')
def parts(p):
    z = zipfile.ZipFile(p)
    return {n: hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if PARTS.match(n)}

def safe_preview(fam, suffix, flags, name, src):
    out = f'{W}/build/036/{fam}/{name}{suffix}'
    ref = f'{out}/default.pptx'
    theme = zipfile.ZipFile(ref).read('ppt/theme/theme1.xml').decode()
    major = re.search(r'<a:majorFont><a:latin typeface="([^"]*)"', theme).group(1)
    minor = re.search(r'<a:minorFont><a:latin typeface="([^"]*)"', theme).group(1)
    d = json.load(open(src))
    design = d.setdefault('design', {})
    fs = design.get('fontScheme')
    base = {'id': fs} if isinstance(fs, str) else dict(fs or {})
    base.update({'major': major, 'minor': minor, 'heading': major, 'body': minor, 'accent': minor, 'code': 'Courier New'})
    design['fontScheme'] = base
    tmpdir = f'{W}/experiments/flags/_safe-decks'
    os.makedirs(tmpdir, exist_ok=True)
    copy = f'{tmpdir}/{name}{suffix}.opf.json'
    json.dump(d, open(copy, 'w'), ensure_ascii=False, indent=1)
    adir = os.path.dirname(src)
    # check: the copy exported with the family's flags minus --typefaces equals the safe export (default and native)
    noface = []
    i = 0
    while i < len(flags):
        if flags[i] == '--typefaces': i += 2; continue
        noface.append(flags[i]); i += 1
    check = {'major': major, 'minor': minor, 'deckCopy': copy}
    bj = json.load(open(f'{out}/build.json'))
    for mode, extra in [('default', []), ('native', ['--body-text', 'native'])]:
        if not bj['exports'][mode]['ok']:
            check[mode] = {'skipped': 'no such export (build.json: ' + (bj['exports'][mode].get('stderr') or '').replace('\n', ' ')[:120] + ')'}
            continue
        tgt = f'{out}/{mode}.pptx'
        if not os.path.exists(tgt):
            tgt = ref  # same as default
        tmp = f'{tmpdir}/{name}{suffix}~{mode}.pptx'
        subprocess.run([OPF, 'convert', copy, tmp, '--force', '--asset-dir', adir, *extra, *noface], capture_output=True, text=True, timeout=1800)
        a, b = parts(tgt), parts(tmp)
        diff = sorted(set(a) ^ set(b)) + sorted(n for n in a if n in b and a[n] != b[n])
        check[mode] = {'partsCompared': len(a), 'differingParts': diff}
        os.remove(tmp)
    if os.path.isdir(f'{out}/preview') and not os.path.isdir(f'{out}/preview-selected'):
        os.rename(f'{out}/preview', f'{out}/preview-selected')
    shutil.rmtree(f'{out}/preview', ignore_errors=True)
    os.makedirs(f'{out}/preview')
    r = subprocess.run([OPF, 'convert', copy, f'{out}/preview/slide-{{n}}.png', '--force', '--asset-dir', adir], capture_output=True, text=True, timeout=1800)
    check['previewStatus'] = r.returncode
    check['previewFiles'] = len([f for f in os.listdir(f'{out}/preview') if f.endswith('.png')])
    json.dump(check, open(f'{out}/safe-preview.json', 'w'), indent=1)
    d = lambda m: len(check[m]['differingParts']) if 'differingParts' in check[m] else 'skipped'
    return f'{fam}/{name}{suffix}: safe preview {check["previewFiles"]} png, default diff {d("default")}, native diff {d("native")}'

args = sys.argv[1:]
preview_only = '--preview-only' in args
args = [a for a in args if a != '--preview-only']
fams = args or list(FAMILIES)
jobs = [(f, *FAMILIES[f][:2], n, s) for f in fams for n, s in FAMILIES[f][2]]
if not preview_only:
    with ThreadPoolExecutor(4) as ex:
        for line in ex.map(lambda j: build(*j), jobs): print(line, flush=True)
with ThreadPoolExecutor(4) as ex:
    for line in ex.map(lambda j: safe_preview(*j) if '--typefaces' in j[2] else f'{j[0]}/{j[3]}{j[1]}: preview as built', jobs): print(line, flush=True)
