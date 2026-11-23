"""Variants of reference-line helper series (series carrying the opf:reference extension) for Keynote label/legend tests.

usage: python3 refvariants.py <in.pptx> <out-dir> <variant>...
variants: L1-literal-numfmt, L2-sername, L3-showval, G-blank-name, G-label-name, L1G-label-name
"""
import os
import re
import sys
import zipfile

src, out, *wanted = sys.argv[1:]
os.makedirs(out, exist_ok=True)
stem = os.path.splitext(os.path.basename(src))[0]


def helpers(x):
    return [m for m in re.finditer(r'<c:ser>(?:(?!</c:ser>).)*?opf:reference(?:(?!</c:ser>).)*?</c:ser>', x, re.S)]


def label_of(ser):
    m = re.search(r'<c:dLbl>.*?<a:t>([^<]*)</a:t>', ser, re.S)
    return m.group(1) if m else None


def edit_helpers(x, fn):
    out, pos = [], 0
    for m in helpers(x):
        out += [x[pos:m.start()], fn(m.group(0))]
        pos = m.end()
    return ''.join(out + [x[pos:]])


def literal(label):
    return '&quot;' + label.replace('&quot;', '') + '&quot;'


def L1(ser):
    lab = label_of(ser)
    if not lab:
        return ser
    ser = re.sub(r'(<c:dLbl>.*?</c:tx>)', lambda m: m.group(1) + f'<c:numFmt formatCode="{literal(lab)}" sourceLinked="0"/>', ser, count=1, flags=re.S)
    return re.sub(r'(<c:dLbl>.*?)<c:showVal val="0"/>', r'\1<c:showVal val="1"/>', ser, count=1, flags=re.S)


def L2(ser):
    lab = label_of(ser)
    if not lab:
        return ser
    ser = re.sub(r'(<c:dLbl>(?:(?!</c:dLbl>).)*?)<c:tx>.*?</c:tx>', r'\1', ser, count=1, flags=re.S)
    ser = re.sub(r'(<c:dLbl>.*?)<c:showSerName val="0"/>', r'\1<c:showSerName val="1"/>', ser, count=1, flags=re.S)
    return set_name(ser, lab)


def L3(ser):
    return re.sub(r'(<c:dLbl>.*?)<c:showVal val="0"/>', r'\1<c:showVal val="1"/>', ser, count=1, flags=re.S)


def set_name(ser, name):
    return re.sub(r'(<c:tx>\s*<c:strRef>.*?<c:pt idx="0">\s*<c:v>)[^<]*(</c:v>)', lambda m: m.group(1) + name + m.group(2), ser, count=1, flags=re.S)


VARIANTS = {
    'L1-literal-numfmt': lambda x: edit_helpers(x, L1),
    'L2-sername': lambda x: edit_helpers(x, L2),
    'L3-showval': lambda x: edit_helpers(x, L3),
    'G-blank-name': lambda x: edit_helpers(x, lambda s: set_name(s, ' ')),
    'G-label-name': lambda x: edit_helpers(x, lambda s: set_name(s, label_of(s) or ' ')),
    'L1G-label-name': lambda x: edit_helpers(x, lambda s: set_name(L1(s), label_of(s) or ' ')),
}
zin = zipfile.ZipFile(src)
for v in wanted:
    dst = os.path.join(out, f'{stem}__{v}.pptx')
    changed = 0
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
        for n in zin.namelist():
            data = zin.read(n)
            if re.match(r'ppt/charts/chart\d+\.xml$', n):
                x = data.decode()
                y = VARIANTS[v](x)
                changed += y != x
                data = y.encode()
            z.writestr(zipfile.ZipInfo(n, zin.getinfo(n).date_time), data, compress_type=zipfile.ZIP_DEFLATED)
    print(os.path.basename(dst), 'charts changed:', changed)
