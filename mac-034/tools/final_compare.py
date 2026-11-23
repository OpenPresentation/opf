"""Final Keynote pass: join Keynote's probe (titles, fonts, layouts) with what each PPTX says, and score every Keynote slide
against OPF's preview and against the previous Keynote pass of the same file.

usage: python3 final_compare.py <corpus-dir> <previous-corpus-dir>
writes <dir>/final-report.json and sheets in <dir>/keynote-sheets (preview | Keynote | difference)
"""
import glob
import json
import os
import re
import sys

from PIL import Image, ImageChops, ImageDraw

root, prev = sys.argv[1], sys.argv[2]
expect = json.load(open(os.path.join(root, 'pptx-expect.json')))
sheets = os.path.join(root, 'keynote-sheets')
os.makedirs(sheets, exist_ok=True)


def changed(a, b):
    hist = ImageChops.difference(a, b).convert('L').histogram()
    return round(sum(hist[24:]) / (a.size[0] * a.size[1]), 4)


report = {}
for name, e in expect.items():
    kdir = os.path.join(root, 'keynote', name)
    deck = name.split('~')[0]
    r = {'slidesPptx': len(e['slides'])}
    log = open(os.path.join(kdir, '_osascript.txt')).read().strip() if os.path.exists(os.path.join(kdir, '_osascript.txt')) else ''
    r['open'] = log
    probe = open(os.path.join(kdir, '_probe2.tsv')).read() if os.path.exists(os.path.join(kdir, '_probe2.tsv')) else ''
    rows = [line.split('\t') for line in probe.splitlines()]
    layouts = next((row for row in rows if row[0] == 'layouts'), None)
    r['keynoteLayouts'] = layouts[2].split(',') if layouts and len(layouts) > 2 else None
    r['size'] = next((row[1] for row in rows if row[0] == 'size'), None)
    slides = []
    for row in rows:
        if row[0] != 'slide' or len(row) < 10:
            continue
        n = int(row[1])
        x = e['slides'][n - 1] if n <= len(e['slides']) else {}
        t = x.get('title') or {}
        expected = ' | '.join(t.get('paragraphs', []))
        slides.append({
            'n': n, 'layout': row[2], 'layoutPptx': x.get('layout'), 'titleShowing': row[3] == 'true', 'titleParagraphs': int(row[4] or 0),
            'titleFont': row[5], 'titleSize': row[6], 'notesLength': int(row[7] or 0), 'fonts': row[8].split(',') if row[8] else [],
            'title': '|'.join(row[9:]), 'titlePptx': expected, 'titleParagraphsPptx': len(t.get('paragraphs', [])),
            'titleMatches': ' '.join(' | '.join(row[9:]).split()) == ' '.join(expected.split()) if t else None,
        })
    r['slides'] = slides
    pngs = sorted(glob.glob(os.path.join(kdir, 'slides', '*.png')))
    previews = sorted(glob.glob(os.path.join(root, 'preview', deck, 'slide-*.png')), key=lambda p: int(re.search(r'(\d+)\.png$', p).group(1)))
    r['keynoteSlides'] = len(pngs)
    scores = []
    for i, kp in enumerate(pngs):
        k = Image.open(kp).convert('RGB')
        s = {'n': i + 1}
        if i < len(previews):
            p = Image.open(previews[i]).convert('RGB')
            kk = k.resize(p.size, Image.LANCZOS)
            s['vsPreview'] = changed(p, kk)
            w, h = p.size
            sheet = Image.new('RGB', (w * 3 + 40, h + 40), 'white')
            sheet.paste(p, (10, 30)); sheet.paste(kk, (w + 20, 30)); sheet.paste(ImageChops.difference(p, kk), (2 * w + 30, 30))
            ImageDraw.Draw(sheet).text((10, 8), f'{name} slide {i + 1}: OPF preview | Keynote 15.1.1 | difference ({s["vsPreview"]:.1%} changed)', fill='black')
            sheet.save(os.path.join(sheets, f'{name}-{i + 1}.png'))
        old = os.path.join(prev, 'keynote-1280', name, f'slide-{i + 1}.png')
        if os.path.exists(old):
            o = Image.open(old).convert('RGB')
            s['vsPrevious'] = changed(o, k.resize(o.size, Image.LANCZOS))
        scores.append(s)
    r['scores'] = scores
    report[name] = r
json.dump(report, open(os.path.join(root, 'final-report.json'), 'w'), indent=1, ensure_ascii=False)
print(len(report), 'files')
