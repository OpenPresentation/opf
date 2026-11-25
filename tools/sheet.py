#!/usr/bin/env python3
"""Labeled pictures for findings and contact sheets for grading. Pillow only; fonts from this Mac.

Finding sheet (ONE picture per finding):
  sheet.py --out finding.jpg --title "Title line" [--crop x0,y0,x1,y1] [--cols N] [--width 2400]
           --panel <png> <program> <version> <mode> "<caption>" [--frame x0,y0,x1,y1 ...] --panel ...
  program: opf | keynote | any text ("OPF preview" and "Keynote 16.0" are written for opf / keynote); version: 0.35.1 | 0.36.0 | main
  | any text; mode: default | native | static. --frame (repeatable) belongs to the panel before it: a red rectangle in slide
  fractions. --crop zooms every panel to one region (slide fractions; frames are mapped into the crop). Panels go side by side
  (--cols default: all in one row up to 3, else 2 per row). The label bar is part of each panel picture, on top of the slide (it never covers slide content).
  Or: sheet.py --spec finding.json --out finding.jpg   ({"title", "crop", "cols", "panels": [{"image", "program", "version",
  "mode", "caption", "frames": [[x0,y0,x1,y1]]}]})

Contact sheet of a deck for grading:
  sheet.py --grid --preview <dir> --keynote <dir> --deck <name> --version 0.36.0 --mode default --out-prefix <path/name>
           [--scores scores.json] [--per-page 12] [--cols 4] [--keynote-version 16.0]
  Per slide one cell: OPF preview above Keynote; every picture labeled (slide number, program, version, mode; Keynote also the
  compare score). Pages of at most --per-page slides, about 2000 px wide: <out-prefix>-p1.jpg, -p2.jpg ...

JPEG quality 85. Pictures are loaded with their ICC profile converted to sRGB and alpha composited onto white (compare.load).
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from compare import load, pictures  # noqa: E402

FONT_BOLD = ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc']
FONT_REG = ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc']
RED = (230, 20, 20)
KEYNOTE = 'Keynote 16.0'


def font(paths, size):
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
    return ImageFont.load_default()


def program_name(p):
    return {'opf': 'OPF preview', 'keynote': KEYNOTE}.get(p.lower(), p)


def fit_text(draw, text, f, maxw):
    if draw.textlength(text, font=f) <= maxw:
        return text
    while text and draw.textlength(text + '…', font=f) > maxw:
        text = text[:-1]
    return text + '…'


def wrap(draw, text, f, maxw, maxlines=3):
    words = text.split()
    lines, cur = [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=f) <= maxw:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    if len(lines) > maxlines:
        lines = lines[:maxlines]
        lines[-1] = fit_text(draw, lines[-1] + ' …', f, maxw)
    return lines


def label_inside(im, head, caption=None, scale=1.0, color=(20, 20, 20)):
    """Return the panel picture with a label bar on top (part of the panel image, so a crop or copy of the panel keeps its
    label, and the bar never covers slide content): bold head line, optional wrapped caption."""
    probe = ImageDraw.Draw(im)
    w = im.width
    hs = max(13, int(w / 42 * scale))
    cs = max(12, int(hs * 0.82))
    fb, fr = font(FONT_BOLD, hs), font(FONT_REG, cs)
    pad = max(4, hs // 3)
    lines = wrap(probe, caption, fr, w - 2 * pad) if caption else []
    h = pad + hs + (len(lines) * (cs + 3)) + pad + (2 if lines else 0)
    out = Image.new('RGB', (w, im.height + h), color)
    out.paste(im, (0, h))
    d = ImageDraw.Draw(out)
    d.text((pad, pad - 1), fit_text(d, head, fb, w - 2 * pad), font=fb, fill=(255, 255, 255))
    y = pad + hs + 2
    for ln in lines:
        d.text((pad, y), ln, font=fr, fill=(255, 235, 150))
        y += cs + 3
    return out, h


def frames(im, boxes, crop=None, width=None, top=0):
    """Red rectangles in slide fractions; `top` = height of the label bar above the slide picture."""
    d = ImageDraw.Draw(im)
    lw = width or max(3, im.width // 300)
    for b in boxes:
        x0, y0, x1, y1 = b
        if crop:
            cx0, cy0, cx1, cy1 = crop
            x0, x1 = (x0 - cx0) / (cx1 - cx0), (x1 - cx0) / (cx1 - cx0)
            y0, y1 = (y0 - cy0) / (cy1 - cy0), (y1 - cy0) / (cy1 - cy0)
        hh = im.height - top
        r = [x0 * im.width, top + y0 * hh, x1 * im.width, top + y1 * hh]
        for k in range(lw):
            d.rectangle([r[0] - k, r[1] - k, r[2] + k, r[3] + k], outline=RED)


def finding(spec, out, maxw=2400):
    panels = spec['panels']
    n = len(panels)
    cols = int(spec.get('cols') or (n if n <= 3 else 2))
    rows = (n + cols - 1) // cols
    gap = 12
    pw = (maxw - gap * (cols + 1)) // cols
    crop = spec.get('crop')
    ims = []
    for p in panels:
        im = load(p['image'])
        if crop:
            x0, y0, x1, y1 = crop
            im = im.crop((int(x0 * im.width), int(y0 * im.height), int(x1 * im.width), int(y1 * im.height)))
        im = im.resize((pw, round(pw * im.height / im.width)), Image.LANCZOS)
        fr = p.get('frames') or []
        if fr:
            frames(im, fr, crop)
        im, hb = label_inside(im, ' · '.join(x for x in (program_name(p.get('program', '')), p.get('version', ''),
                                                     p.get('mode', '')) if x), p.get('caption'),
                          color=(10, 60, 120) if p.get('program', '').lower() == 'keynote' else (20, 20, 20))
        ims.append(im)
    ph = max(i.height for i in ims)
    title_h = 0
    title = spec.get('title')
    ft = font(FONT_BOLD, max(20, maxw // 70))
    if title:
        title_h = ft.size + 2 * gap
    W = maxw
    H = title_h + rows * (ph + gap) + gap
    sheet = Image.new('RGB', (W, H), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    if title:
        d.text((gap, gap), fit_text(d, title, ft, W - 2 * gap), font=ft, fill=(0, 0, 0))
    for i, im in enumerate(ims):
        r, c = divmod(i, cols)
        x = gap + c * (pw + gap)
        y = title_h + gap + r * (ph + gap)
        sheet.paste(im, (x, y))
        d.rectangle([x - 1, y - 1, x + im.width, y + im.height], outline=(160, 160, 160))
    sheet.save(out, 'JPEG', quality=85, optimize=True)
    return out


def grid(pdir, kdir, deck, version, mode, prefix, scores=None, per_page=12, cols=4, kver='16.0'):
    pn, po = pictures(pdir)
    if not pn and po:
        pn = {i + 1: p for i, p in enumerate(po)}
    kn, _ = pictures(kdir)
    sc = {}
    skipped = []
    if scores:
        with open(scores) as f:
            sj = json.load(f)
        sc = {r['slide']: r for r in sj['slides']}
        skipped = sj.get('skipped') or []
        # use compare.py's pairing (it maps previews around hidden slides)
        pn = {r['slide']: r['preview'] for r in sj['slides'] if r.get('preview')}
        kn = {r['slide']: r['keynote'] for r in sj['slides'] if r.get('keynote')}
    nums = sorted(set(pn) | set(kn) | set(skipped))
    cw = 480
    gap = 10
    outs = []
    pages = [nums[i:i + per_page] for i in range(0, len(nums), per_page)]
    for pi, page in enumerate(pages, 1):
        rows = (len(page) + cols - 1) // cols
        cells = []
        for n in page:
            pair = []
            for which, path in (('opf', pn.get(n)), ('keynote', kn.get(n))):
                if path:
                    im = load(path)
                    im = im.resize((cw, round(cw * im.height / im.width)), Image.LANCZOS)
                else:
                    im = Image.new('RGB', (cw, 270), (235, 235, 235))
                    ImageDraw.Draw(im).text((20, 120), 'skipped in Keynote (not exported)' if n in skipped else 'no picture',
                                            font=font(FONT_REG, 18), fill=(90, 90, 90))
                if which == 'opf':
                    head = '%d · OPF preview · %s · %s' % (n, version, mode)
                    im, _ = label_inside(im, head, None, scale=1.05)
                else:
                    s = sc.get(n, {}).get('score')
                    head = '%d · Keynote %s · %s · %s%s' % (n, kver, version, mode, (' · score %.3f' % s) if s is not None else '')
                    im, _ = label_inside(im, head, None, scale=1.05, color=(10, 60, 120))
                pair.append(im)
            ch = pair[0].height + pair[1].height + 4
            cell = Image.new('RGB', (cw, ch), (255, 255, 255))
            cell.paste(pair[0], (0, 0))
            cell.paste(pair[1], (0, pair[0].height + 4))
            cells.append(cell)
        chh = max(c.height for c in cells)
        title_h = 44
        W = cols * cw + (cols + 1) * gap
        H = title_h + rows * (chh + gap) + gap
        sheet = Image.new('RGB', (W, H), (255, 255, 255))
        d = ImageDraw.Draw(sheet)
        d.text((gap, 10), '%s · %s · %s — OPF preview (top) vs Keynote %s (bottom) · page %d of %d · slides %d–%d'
               % (deck, version, mode, kver, pi, len(pages), page[0], page[-1]), font=font(FONT_BOLD, 24), fill=(0, 0, 0))
        for i, c in enumerate(cells):
            r, k = divmod(i, cols)
            x = gap + k * (cw + gap)
            y = title_h + r * (chh + gap)
            sheet.paste(c, (x, y))
            d.rectangle([x - 1, y - 1, x + cw, y + c.height], outline=(150, 150, 150))
        out = '%s-p%d.jpg' % (prefix, pi)
        sheet.save(out, 'JPEG', quality=85, optimize=True)
        outs.append(out)
    return outs


def arg(argv, k, default=None):
    if k in argv:
        return argv[argv.index(k) + 1]
    return default


def parse_box(s):
    v = [float(x) for x in s.split(',')]
    assert len(v) == 4, s
    return v


def main(argv):
    if not argv or '-h' in argv or '--help' in argv:
        print(__doc__)
        return 0
    if '--grid' in argv:
        outs = grid(arg(argv, '--preview'), arg(argv, '--keynote'), arg(argv, '--deck', '?'), arg(argv, '--version', '?'),
                    arg(argv, '--mode', '?'), arg(argv, '--out-prefix'), arg(argv, '--scores'),
                    int(arg(argv, '--per-page', '12')), int(arg(argv, '--cols', '4')), arg(argv, '--keynote-version', '16.0'))
        print('\n'.join(outs))
        return 0
    out = arg(argv, '--out')
    if '--spec' in argv:
        with open(arg(argv, '--spec')) as f:
            spec = json.load(f)
    else:
        spec = {'title': arg(argv, '--title'), 'panels': []}
        if arg(argv, '--crop'):
            spec['crop'] = parse_box(arg(argv, '--crop'))
        if arg(argv, '--cols'):
            spec['cols'] = int(arg(argv, '--cols'))
        i = 0
        while i < len(argv):
            if argv[i] == '--panel':
                img, prog, ver, mode, cap = argv[i + 1:i + 6]
                spec['panels'].append({'image': img, 'program': prog, 'version': ver, 'mode': mode, 'caption': cap, 'frames': []})
                i += 6
                continue
            if argv[i] == '--frame':
                spec['panels'][-1]['frames'].append(parse_box(argv[i + 1]))
                i += 2
                continue
            i += 1
    print(finding(spec, out, int(arg(argv, '--width', '2400'))))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
