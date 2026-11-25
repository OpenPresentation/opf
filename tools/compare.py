#!/usr/bin/env python3
"""Compare OPF's preview pictures with Keynote's slide pictures, slide by slide (layout, not pixels). Pillow only.

  compare.py --preview <dir> --keynote <dir> [--map <run.json|probe.json|"3,7">] [--out scores.json] [--width 1280]
             [--blur 1.5] [--tol 24] [--shift 2] [--boxes 5] [--preview-includes-hidden]

OPF previews (opf convert, the corpus builder) leave hidden slides out and number the rest 1..n; with --map giving skipped slides,
compare.py maps preview picture k to the k-th slide that is not skipped (scores.json `previewMapping`), unless
--preview-includes-hidden.

<dir>s hold slide-NN.png (OPF previews; kn-run names Keynote's pictures by Keynote's slide number, so a skipped slide is simply
missing). Older Keynote folders with <name>.NNN.png are read in order; then --map gives the skipped slide numbers (run.json or
probe.json of that file, or a comma list) so picture k maps to the k-th slide that is not skipped.
Loading: the embedded ICC profile (Keynote writes Display P3) is converted to sRGB with ImageCms, alpha is composited onto white.
Both pictures go to one size (--width wide, the preview's aspect), grayscale, Gaussian blur (--blur px). A pixel differs when its
gray level differs by more than --tol AND no pixel within --shift px in the other picture is within --tol (so a 2 to 3 px shift
does not count). score = share of differing pixels. Regions: connected differing areas (on an 8 px grid), the --boxes largest,
as [x0, y0, x1, y1] in slide fractions. Slides are ranked by score (high first). A score only ranks; look at both pictures.
"""
import io
import json
import os
import re
import sys

from PIL import Image, ImageChops, ImageCms, ImageFilter

SRGB = ImageCms.createProfile('sRGB')


def load(path):
    """Open a slide picture as it looks: embedded profile applied (to sRGB), alpha composited onto white."""
    im = Image.open(path)
    icc = im.info.get('icc_profile')
    im = im.convert('RGBA')
    if icc:
        try:
            rgb = ImageCms.profileToProfile(im.convert('RGB'), ImageCms.ImageCmsProfile(io.BytesIO(icc)), SRGB, outputMode='RGB')
            rgb.putalpha(im.getchannel('A'))
            im = rgb
        except Exception:  # noqa: BLE001  (a broken profile: use the pixels as they are)
            pass
    white = Image.new('RGBA', im.size, (255, 255, 255, 255))
    return Image.alpha_composite(white, im).convert('RGB')


NUM = re.compile(r'(?:slide-|\.)(\d+)\.png$', re.I)


def pictures(d):
    files = [f for f in os.listdir(d) if f.lower().endswith('.png')]
    named = {}
    other = []
    for f in files:
        m = re.match(r'slide-(\d+)\.png$', f, re.I)
        if m:
            named[int(m.group(1))] = os.path.join(d, f)
        else:
            m = NUM.search(f)
            if m:
                other.append((int(m.group(1)), os.path.join(d, f)))
    return named, [p for _, p in sorted(other)]


def skipped_from(arg):
    if not arg:
        return []
    if os.path.exists(arg):
        with open(arg) as f:
            j = json.load(f)
        return list(j.get('skippedSlides') or [])
    return [int(x) for x in arg.split(',') if x.strip()]


def prep(im, size, blur):
    g = im.resize(size, Image.LANCZOS).convert('L')
    return g.filter(ImageFilter.GaussianBlur(blur)) if blur > 0 else g


def diff_mask(a, b, tol, shift):
    """Pixels of a that have no pixel within tol in b within shift px, OR'd with the same from b to a."""
    def one_way(x, y):
        # min |x - shifted(y)| over shifts: use max/min filters of y (a pixel is matched if x lies within [min-tol, max+tol])
        k = 2 * shift + 1
        ymax = y.filter(ImageFilter.MaxFilter(k)) if shift else y
        ymin = y.filter(ImageFilter.MinFilter(k)) if shift else y
        over = ImageChops.subtract(x, ymax)            # x - max, clipped at 0
        under = ImageChops.subtract(ymin, x)           # min - x, clipped at 0
        d = ImageChops.lighter(over, under)
        return d.point(lambda v: 255 if v > tol else 0)
    return ImageChops.lighter(one_way(a, b), one_way(b, a))


def regions(mask, nbox, cell=8):
    w, h = mask.size
    gw, gh = (w + cell - 1) // cell, (h + cell - 1) // cell
    small = mask.resize((gw, gh), Image.BOX)
    px = small.load()
    on = [[px[x, y] > 8 for x in range(gw)] for y in range(gh)]
    seen = [[False] * gw for _ in range(gh)]
    comps = []
    for y in range(gh):
        for x in range(gw):
            if on[y][x] and not seen[y][x]:
                stack = [(x, y)]
                seen[y][x] = True
                x0 = x1 = x
                y0 = y1 = y
                n = 0
                while stack:
                    cx, cy = stack.pop()
                    n += 1
                    x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < gw and 0 <= ny < gh and on[ny][nx] and not seen[ny][nx]:
                                seen[ny][nx] = True
                                stack.append((nx, ny))
                comps.append((n, [round(x0 / gw, 4), round(y0 / gh, 4), round((x1 + 1) / gw, 4), round((y1 + 1) / gh, 4)]))
    comps.sort(key=lambda c: -c[0])
    return [{'box': b, 'cells': n, 'share': round(n / (gw * gh), 5)} for n, b in comps[:nbox]]


def compare_pair(pa, pk, width, blur, tol, shift, nbox):
    a = load(pa)
    k = load(pk)
    size = (width, round(width * a.height / a.width))
    ga, gk = prep(a, size, blur), prep(k, size, blur)
    m = diff_mask(ga, gk, tol, shift)
    hist = m.histogram()
    score = hist[255] / float(size[0] * size[1])
    return {'score': round(score, 5), 'regions': regions(m, nbox), 'size': list(size),
            'keynoteSize': list(k.size), 'previewSize': list(a.size),
            'aspectDiffers': abs(a.width / a.height - k.width / k.height) > 0.01}


def arg(argv, k, default=None):
    if k in argv:
        return argv[argv.index(k) + 1]
    return default


def main(argv):
    if not argv or '-h' in argv or '--help' in argv:
        print(__doc__)
        return 0
    pdir, kdir = arg(argv, '--preview'), arg(argv, '--keynote')
    out = arg(argv, '--out')
    width = int(arg(argv, '--width', '1280'))
    blur = float(arg(argv, '--blur', '1.5'))
    tol = int(arg(argv, '--tol', '24'))
    shift = int(arg(argv, '--shift', '2'))
    nbox = int(arg(argv, '--boxes', '5'))
    skipped = skipped_from(arg(argv, '--map'))
    pnamed, pother = pictures(pdir)
    if not pnamed and pother:
        pnamed = {i + 1: p for i, p in enumerate(pother)}
    # OPF's previews leave hidden slides out and number the rest 1..n (opf convert without --include-hidden), so with skipped
    # slides the preview's picture k is the k-th slide that is not skipped. Detected when the counts say so; --preview-includes-hidden
    # turns it off.
    preview_map = 'by number'
    if skipped and '--preview-includes-hidden' not in argv:
        nums = [n for n in range(1, len(pnamed) + len(skipped) + 1) if n not in skipped]
        if len(nums) == len(pnamed):
            pnamed = {nums[i]: pnamed[k] for i, k in enumerate(sorted(pnamed))}
            preview_map = 'preview leaves hidden slides out: picture k = k-th slide that is not skipped'
    knamed, kother = pictures(kdir)
    if not knamed and kother:
        nums = [n for n in range(1, len(kother) + len(skipped) + 1) if n not in skipped]
        knamed = dict(zip(nums, kother))
    res = {'preview': os.path.abspath(pdir), 'keynote': os.path.abspath(kdir), 'skipped': skipped, 'previewMapping': preview_map,
           'settings': {'width': width, 'blur': blur, 'tol': tol, 'shift': shift, 'iccToSrgb': True, 'alphaOnWhite': True},
           'previewCount': len(pnamed), 'keynoteCount': len(knamed), 'slides': []}
    for n in sorted(set(pnamed) | set(knamed) | set(skipped)):
        row = {'slide': n, 'preview': pnamed.get(n), 'keynote': knamed.get(n)}
        if n in pnamed and n in knamed:
            row.update(compare_pair(pnamed[n], knamed[n], width, blur, tol, shift, nbox))
        else:
            row['score'] = None
            row['note'] = ('skipped in Keynote (not exported)' if n in skipped else
                           'no Keynote picture' if n not in knamed else 'no preview picture')
        res['slides'].append(row)
    ranked = sorted([r for r in res['slides'] if r['score'] is not None], key=lambda r: -r['score'])
    for i, r in enumerate(ranked, 1):
        r['rank'] = i
    res['ranking'] = [r['slide'] for r in ranked]
    s = json.dumps(res, indent=1)
    if out:
        with open(out, 'w') as f:
            f.write(s)
        print('%d slides compared, %d without a pair; top: %s' % (len(ranked), len(res['slides']) - len(ranked),
              ', '.join('%d (%.3f)' % (r['slide'], r['score']) for r in ranked[:5])))
    else:
        print(s)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
