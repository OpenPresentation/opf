"""Prototype: split a slide-number placeholder holding [runs][slidenum field][runs] into three shapes.

The placeholder keeps only the field (PowerPoint's live number, Keynote's own number); the words before it go into a plain text box
that ends where the number starts (right-aligned), the words after it into one that starts where the number ends (left-aligned).
The number's width is estimated (digits * 0.56 em) for this prototype only.

usage: python3 split.py <in.pptx> <out.pptx>
"""
import re
import sys
import zipfile

src, dst = sys.argv[1:3]


def split_shape(sp, next_id):
    p = re.search(r'<a:p>(<a:pPr.*?</a:pPr>)(.*?)(<a:endParaRPr[^>]*/>)?</a:p>', sp, re.S)
    if not p:
        return sp, next_id
    ppr, body, end = p.group(1), p.group(2), p.group(3) or ''
    fld = re.search(r'<a:fld.*?</a:fld>', body, re.S)
    if not fld:
        return sp, next_id
    before, after = body[:fld.start()], body[fld.end():]
    if not (before.strip() or after.strip()):
        return sp, next_id
    num = re.search(r'<a:t>([^<]*)</a:t>', fld.group(0)).group(1)
    size = int(re.search(r'sz="(\d+)"', fld.group(0)).group(1)) / 100  # pt
    width = int(len(num) * 0.56 * size * 12700)  # EMU
    off = re.search(r'<a:off x="(\d+)" y="(\d+)"/><a:ext cx="(\d+)" cy="(\d+)"/>', sp)
    x, y, cx, cy = map(int, off.groups())
    algn = re.search(r'algn="(\w+)"', ppr)
    algn = algn.group(1) if algn else 'l'
    if algn == 'ctr':
        nx = x + (cx - width) // 2
    elif algn == 'r':
        nx = x + cx - width
    else:
        nx = x
    # the number placeholder: only the field, centered in a frame exactly its width
    number = sp.replace(p.group(0), f'<a:p>{ppr}{fld.group(0)}{end}</a:p>')
    number = number.replace(off.group(0), f'<a:off x="{nx}" y="{y}"/><a:ext cx="{width}" cy="{cy}"/>')
    number = re.sub(r'algn="\w+"', 'algn="ctr"', number, count=1)
    shapes = [number]

    def box(text_runs, bx, bcx, align):
        nonlocal next_id
        next_id += 1
        body_pr = re.search(r'<a:bodyPr.*?(?:/>|</a:bodyPr>)', sp, re.S).group(0)
        ppr2 = re.sub(r'algn="\w+"', f'algn="{align}"', ppr) if 'algn=' in ppr else ppr.replace('<a:pPr', f'<a:pPr algn="{align}"', 1)
        return (f'<p:sp><p:nvSpPr><p:cNvPr id="{next_id}" name="Slide number text {next_id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
                f'<p:spPr><a:xfrm><a:off x="{bx}" y="{y}"/><a:ext cx="{bcx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>'
                f'<p:txBody>{body_pr}<a:lstStyle/><a:p>{ppr2}{text_runs}{end}</a:p></p:txBody></p:sp>')
    if before.strip():
        shapes.append(box(before, x, nx - x, 'r'))
    if after.strip():
        shapes.append(box(after, nx + width, x + cx - nx - width, 'l'))
    return ''.join(shapes), next_id


zin = zipfile.ZipFile(src)
with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
    for n in zin.namelist():
        d = zin.read(n)
        if re.match(r'ppt/slides/slide\d+\.xml$', n):
            x = d.decode()
            next_id = max(int(i) for i in re.findall(r'<p:cNvPr id="(\d+)"', x)) + 100
            def repl(m):
                global next_id
                out, next_id = split_shape(m.group(0), next_id)
                return out
            x = re.sub(r'<p:sp>(?:(?!</p:sp>).)*?<p:ph type="sldNum".*?</p:sp>', repl, x, flags=re.S)
            d = x.encode()
        z.writestr(zipfile.ZipInfo(n, zin.getinfo(n).date_time), d, compress_type=zipfile.ZIP_DEFLATED)
print('ok', dst)
