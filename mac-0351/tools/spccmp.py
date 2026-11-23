"""Letter spacing in Keynote: compare Keynote's export of each file with that of its ~nospc copy (every spc removed), slide by slide.
A slide whose text carries spc and whose two exports differ shows that Keynote applies the spacing; identical exports mean it ignores it.
usage: python3 spccmp.py <dir>   (reads <dir>/keynote/<b>/slides and <dir>/keynote/<b>~nospc/slides; writes <dir>/spc-report.json and crops)"""
import glob, json, os, re, sys, zipfile
from PIL import Image, ImageChops, ImageDraw
root = sys.argv[1]
out = {}
os.makedirs(os.path.join(root, 'crops'), exist_ok=True)
for d in sorted(glob.glob(os.path.join(root, 'keynote', '*~nospc'))):
    b = os.path.basename(d)[:-6]
    z = zipfile.ZipFile(os.path.join(root, 'pptx', b + '.pptx'))
    spc = {}
    for n in z.namelist():
        m = re.match(r'ppt/slides/slide(\d+)\.xml$', n)
        if m:
            v = re.findall(r'<a:(?:rPr|defRPr|endParaRPr)\b[^>]*?\bspc="(-?\d+)"', z.read(n).decode())
            if v: spc[int(m.group(1))] = sorted(set(v), key=int)
    a = sorted(glob.glob(os.path.join(root, 'keynote', b, 'slides', '*.png')))
    c = sorted(glob.glob(os.path.join(d, 'slides', '*.png')))
    rows = []
    for i, (pa, pc) in enumerate(zip(a, c), 1):
        ia, ic = Image.open(pa).convert('RGB'), Image.open(pc).convert('RGB')
        diff = ImageChops.difference(ia, ic).convert('L').point(lambda x: 255 if x >= 24 else 0)
        box = diff.getbbox()
        share = round(sum(diff.histogram()[255:]) / (ia.size[0] * ia.size[1]), 4)
        row = {'slide': i, 'spc': spc.get(i), 'changedShare': share, 'bbox': box}
        if box:
            x0, y0, x1, y1 = box; pad = 20
            x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(ia.size[0], x1 + pad), min(ia.size[1], y1 + pad)
            ca, cc = ia.crop((x0, y0, x1, y1)), ic.crop((x0, y0, x1, y1))
            w, h = ca.size
            s = Image.new('RGB', (w, 2 * h + 50), 'white'); dr = ImageDraw.Draw(s)
            dr.text((4, 2), f'{b} slide {i}: Keynote, with spc {spc.get(i)}', fill='black'); s.paste(ca, (0, 18))
            dr.text((4, h + 22), 'Keynote, spc removed', fill='black'); s.paste(cc, (0, h + 38))
            s.save(os.path.join(root, 'crops', f'{b}-{i}.png'))
        rows.append(row)
    out[b] = rows
    for r in rows:
        if r['spc'] or r['changedShare']:
            print(f"{b:22s} slide {r['slide']:2d} spc={r['spc']} changed={r['changedShare']:.2%} bbox={r['bbox']}")
json.dump(out, open(os.path.join(root, 'spc-report.json'), 'w'), indent=1)
