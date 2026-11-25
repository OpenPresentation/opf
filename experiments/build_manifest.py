"""Join every experiment into experiments/MANIFEST.tsv and experiments/pptx-list.txt (for tools/kn-run --list).
MANIFEST.tsv columns: path, group, id, variant, source, changed, look (what and where in Keynote), control.
pptx-list.txt: <absolute path> TAB <group>__<id>__<variant>."""
import glob, json, os, re
W = '/Users/michael/opf-work/keynote-036'
E = f'{W}/experiments'
rows = []

GROUP_ID = {'alt-text': 'LY-04', 'pic-placeholders': 'UNSUPPORTED-MEDIA', 'one-series-highlight': 'MX-03', 'plot-area': 'MX-02',
            'flush-space': 'MX-01', 'rtl-explicit': 'MX-06', 'rtl-table': 'LG-02', 'title-one-paragraph': 'LY-01',
            'tick-skip': 'MX-04', 'label-separator': 'MX-05'}
def ident(group, vid):
    if group in ('graders', 'roundtrip-xml') or vid.startswith('RT-'):
        m = re.match(r'([A-Z]{2}-\d\d)-(.*)', vid); return m.group(1), m.group(2)
    if group == '1416':
        m = re.match(r'(\d)-(.*)', vid)
        return (f'1416-{m.group(1)}', m.group(2)) if m else ('1416', vid)
    if group == 'legend-frame':
        return ('MX-07' if vid.startswith('mcharts') else 'LY-03'), vid
    if group == 'one-series-highlight' and vid.startswith('e-'):
        return 'RT-01', vid
    return GROUP_ID[group], vid

for f in sorted(glob.glob(f'{E}/*/manifest-rows.tsv')):
    for line in open(f):
        path, group, vid, src, what, look, control = line.rstrip('\n').split('\t')
        i, v = ident(group, vid)
        rows.append([path, group, i, v, src, what, look, control])

# flag re-exports
FLAG_LOOK = {
    'x-safe': ('--typefaces safe (Arial/Georgia/Courier New written and measured)',
               'every slide against preview/ (drawn with the safe families; the Aptos preview is preview-selected/): line breaks and overlaps of '
               'LG-01, SW-01 (sweep-tables 7, 12, 13), MX-07/MX-08 (m-charts 5, m-text-flush 5), LY-01/LY-02 (layouts-lots); no missing-fonts banner'),
    'x-smartart-shapes': ('--smart-art shapes', 'SmartArt slides (ordinary 16, 19; little 16, 18, 19, 20; lots: see build.json): probe class shape/group (editable) instead of image; looks like the preview'),
    'x-keynote-profile': ('--body-text native --typefaces safe --slide-numbers static (the "Keynote profile" of opf#1298; one file, default.pptx; native/static not made: duplicate-option)',
                          'every slide against preview/ (safe families): re-wrapped text inside its boxes, footer "N / M" as text, no missing-fonts banner; compare x-safe'),
}
CTRL_DIRS = ['layouts', 'matrix', 'languages', 'examples']
def control_for(name, mode):
    base = {'data-story-academy': 'data-story-academy-corporate-programs'}.get(name, name)
    for d in CTRL_DIRS:
        p = f'{W}/build/036/{d}/{base}/{mode}.pptx'
        if os.path.exists(p): return p
    q = f'{W}/build/036/qualification/pptx/{name}{"" if mode == "default" else {"native": "~native-body", "static": "~static"}[mode]}.pptx'
    if os.path.exists(q): return q
    p = f'{W}/build/036/{d}/{base}/default.pptx'
    return '-'
for fam, (what, look) in FLAG_LOOK.items():
    for bj in sorted(glob.glob(f'{W}/build/036/{fam}/*/build.json')):
        b = json.load(open(bj)); d = os.path.dirname(bj); name = os.path.basename(d)
        deck = re.sub(r'-(safe|smartart-shapes|keynote-profile)$', '', name)
        for mode in ('default', 'native', 'static'):
            p = f'{d}/{mode}.pptx'
            if not os.path.exists(p): continue
            rows.append([p, fam, deck, mode, b['source'], f'{what}; mode {mode}', look, control_for(deck, mode)])

# minimal decks
MIN_LOOK = {
    'SW-01': 'header words whole? (Tea|m, Participant|s, Completio|n)', 'SW-02': 'native: note right under the table (default is right)',
    'LG-01': 'Catalan lines run into the Latin block?', 'LG-02': 'rtl table drawn left of its frame over the chart?',
    'LG-03': 'Amharic line 3 starts with the word separator; line 1 width', 'LG-04': 'native: Korean wraps inside a word?',
    'MX-01': 'right/center lines a space off (0.36.0) or flush (0.35.1)', 'MX-02': 'bar names cut at the left ("ranes")',
    'MX-03': 'legend twice, half-width columns, gray highlight', 'MX-04': 'every other long column name dropped',
    'MX-05': 'category name dropped from data labels; pie separator', 'MX-06': 'Hebrew line word order', 'MX-07': 'pie legend entry cut',
    'MX-08': 'table header "Termina|l"', 'LY-01': 'long title wraps again and overprints', 'LY-02': 'per-line boxes overrun',
    'LY-03': 'legend leaves the chart frame', 'LY-04': 'Description = shape name; SmartArt a picture',
    'LY-05': 'round trip: back.pptx c:multiLvlStrRef for "Month: place" categories', 'LY-05-dash': 'round trip control: " - " instead of ": " (multiLvlStrRef or not?)',
    'LY-05-space': 'round trip control: a space instead of ": "', 'LY-06': 'back.pptx layout copies ("Section 0")',
    'RT-01': 'round trip: back.pptx c:ptCount vs idx; opf-036 imports back.pptx?', 'RT-02': 'round trip: c:multiLvlStrRef',
    'RT-03': 'picture Description; back.pptx name/descr/title', 'RT-04': 'round trip: OPF tags dropped (ppt/tags, p:custDataLst)',
    'RT-05': 'text in a non-rectangular shape becomes group of shape + text box', 'RT-06': 'title size shrink / truncation',
    'RT-07': 'rtl lost on paragraphs starting with Latin/digits', 'RT-08': 'table right alignment written back?', 'RT-09': 'chart axis details rewritten',
}
for bj in sorted(glob.glob(f'{W}/build/*/x-min/*/build.json')):
    b = json.load(open(bj)); d = os.path.dirname(bj); i = os.path.basename(d); ver = bj.split('/build/')[1].split('/')[0]
    for mode in ('default', 'native', 'static'):
        p = f'{d}/{mode}.pptx'
        if not os.path.exists(p): continue
        other = f'{W}/build/0351/x-min/{i}/{mode}.pptx' if ver == '036' else f'{W}/build/036/x-min/{i}/{mode}.pptx'
        rows.append([p, 'x-min', i, f'{ver}-{mode}', b['source'], f'minimal deck, OPF {ver}, mode {mode}', MIN_LOOK.get(i, '') + ' (slide 1; LY-04 slides 1-2)',
                     other if os.path.exists(other) else f'{W}/build/{ver}/x-min/{i}/default.pptx' if mode != 'default' else '-'])

# a control (byte copy of a file opened in the main passes) names the Keynote output that already exists for those bytes
def keynote_out(src):
    m = re.match(rf'{W}/build/(036|0351)/([^/]+)/([^/]+)/(default|native|static)\.pptx$', src)
    if m:
        k = f'{W}/keynote/{m.group(1)}/{m.group(2)}/{m.group(3)}~{m.group(4)}'
    else:
        m = re.match(rf'{W}/build/036/qualification/pptx/([^/]+)\.pptx$', src) or re.match(rf'{W}/experiments/fonttest/([^/]+)\.pptx$', src)
        if not m: return None
        k = f'{W}/keynote/036/qualification/{m.group(1)}' if '/qualification/' in src else f'{W}/keynote/036/experiments-fonttest/{m.group(1)}'
    return k if os.path.isdir(k) else None
for r in rows:
    if r[7] == '-' and r[1] not in ('x-min', 'x-safe', 'x-smartart-shapes', 'x-keynote-profile'):
        k = keynote_out(r[4])
        r[7] = f'- (control; Keynote output of these bytes already exists: {k})' if k else '- (control; no earlier Keynote output of these bytes found)'

names = set()
with open(f'{E}/MANIFEST.tsv', 'w') as m, open(f'{E}/pptx-list.txt', 'w') as l, open(f'{E}/pptx-list-new.txt', 'w') as n:
    n.write('# as pptx-list.txt without the controls whose bytes Keynote already opened in the main passes (MANIFEST.tsv control column says where)\n')
    m.write('path\tgroup\tid\tvariant\tsource\tchanged\tlook\tcontrol\n')
    l.write('# experiments for kn-run --list (built by experiments/build_manifest.py); name = <group>__<id>__<variant>\n')
    for r in rows:
        assert os.path.exists(r[0]), r[0]
        name = f'{r[1]}__{r[2]}__{r[3]}'
        assert name not in names, name
        names.add(name)
        m.write('\t'.join(c.replace('\t', ' ').replace('\n', ' ') for c in r) + '\n')
        l.write(f'{r[0]}\t{name}\n')
        if 'already exists' not in r[7]: n.write(f'{r[0]}\t{name}\n')
from collections import Counter
c = Counter(r[1] for r in rows)
print(len(rows), dict(sorted(c.items())))
