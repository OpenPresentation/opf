"""Side-by-side sheets: OPF preview | Keynote slide (scaled to 1280x720) | difference.

usage: python3 -I sheets.py <corpus-dir>   (reads <dir>/preview, <dir>/keynote; writes <dir>/keynote-sheets, <dir>/keynote-scores.json)
"""
import glob
import json
import os
import re
import sys

from PIL import Image, ImageChops, ImageDraw, ImageOps

root = sys.argv[1]
out = os.path.join(root, 'keynote-sheets')
scaled = os.path.join(root, 'keynote-1280')
os.makedirs(out, exist_ok=True)
os.makedirs(scaled, exist_ok=True)
scores = {}
for kdir in sorted(glob.glob(os.path.join(root, 'keynote', '*'))):
    if not os.path.isdir(kdir):
        continue
    name = os.path.basename(kdir)
    deck = name.split('~')[0]
    pngs = sorted(p for p in glob.glob(os.path.join(kdir, 'slides', '*.png')) if not os.path.basename(p).startswith('_'))
    previews = sorted(glob.glob(os.path.join(root, 'preview', deck, 'slide-*.png')), key=lambda p: int(re.search(r'(\d+)\.png$', p).group(1)))
    entry = {'keynoteSlides': len(pngs), 'previewSlides': len(previews), 'slides': []}
    os.makedirs(os.path.join(scaled, name), exist_ok=True)
    for i, kp in enumerate(pngs):
        k = Image.open(kp).convert('RGB')
        native = k.size
        k = k.resize((1280, 720), Image.LANCZOS)
        k.save(os.path.join(scaled, name, f'slide-{i + 1}.png'))
        if i >= len(previews):
            entry['slides'].append({'n': i + 1, 'native': native, 'note': 'no preview'})
            continue
        p = Image.open(previews[i]).convert('RGB').resize((1280, 720))
        diff = ImageChops.difference(p, k).convert('L')
        hist = diff.histogram()
        changed = sum(hist[24:]) / (1280 * 720)
        sheet = Image.new('RGB', (1280 * 3 + 40, 720 + 40), 'white')
        sheet.paste(p, (0, 40))
        sheet.paste(k, (1280 + 20, 40))
        sheet.paste(ImageOps.invert(diff.point(lambda v: 255 if v >= 24 else 0)).convert('RGB'), (2560 + 40, 40))
        d = ImageDraw.Draw(sheet)
        d.text((8, 10), f'{name} slide {i + 1}: OPF preview', fill='black')
        d.text((1300, 10), f'Keynote 15.1.1 (native {native[0]}x{native[1]}, scaled)', fill='black')
        d.text((2608, 10), f'difference >= 24/255: {changed:.1%} of pixels', fill='black')
        sheet.save(os.path.join(out, f'{name}-{i + 1}.png'), optimize=True)
        entry['slides'].append({'n': i + 1, 'native': native, 'changed': round(changed, 4)})
    scores[name] = entry
json.dump(scores, open(os.path.join(root, 'keynote-scores.json'), 'w'), indent=1)
for n, e in scores.items():
    worst = sorted((s for s in e['slides'] if 'changed' in s), key=lambda s: -s['changed'])[:3]
    print(f"{n:40s} keynote={e['keynoteSlides']:3d} preview={e['previewSlides']:3d} worst=" + ', '.join(f"{s['n']}:{s['changed']:.0%}" for s in worst))
