"""One sheet per slide: panels left to right with captions, each scaled to 640x360 (or the first panel's aspect).
usage: python3 sheet3.py <out.png> <caption> <label1>=<png1> [<label2>=<png2> ...]   (a missing file draws an empty panel)"""
import os, sys
from PIL import Image, ImageDraw
from kload import load
out, caption, panels = sys.argv[1], sys.argv[2], [a.split('=', 1) for a in sys.argv[3:]]
W = 640
ims = []
for label, p in panels:
    im = load(p) if os.path.exists(p) else None
    ims.append((label, im))
first = next(im for _, im in ims if im is not None)
H = round(W * first.size[1] / first.size[0])
sheet = Image.new('RGB', (len(ims) * (W + 10) + 10, H + 56), 'white')
d = ImageDraw.Draw(sheet)
d.text((10, 6), caption, fill='black')
for i, (label, im) in enumerate(ims):
    x = 10 + i * (W + 10)
    d.text((x, 26), label, fill='black')
    if im is not None:
        sheet.paste(im.resize((W, H), Image.LANCZOS), (x, 46))
    else:
        d.rectangle((x, 46, x + W, 46 + H), outline='gray'); d.text((x + 10, 56), 'not available', fill='gray')
sheet.save(out)
