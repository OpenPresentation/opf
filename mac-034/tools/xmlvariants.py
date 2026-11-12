"""Diagnostic XML variants of a PPTX's chart parts (originals untouched).

usage: python3 xmlvariants.py <in.pptx> <out-dir>
Writes <out-dir>/<stem>__<variant>.pptx for each variant below, applied to every ppt/charts/chartN.xml.
"""
import os
import re
import sys
import zipfile

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
stem = os.path.splitext(os.path.basename(src))[0]


def no_ref_ext(x):
    return re.sub(r'<c:extLst>(?:(?!</c:extLst>).)*opf:reference(?:(?!</c:extLst>).)*</c:extLst>', '', x, flags=re.S)


def no_legend_entry(x):
    return re.sub(r'<c:legendEntry>.*?</c:legendEntry>', '', x, flags=re.S)


def no_dlbl(x):
    return re.sub(r'<c:dLbl>.*?</c:dLbl>', '', x, flags=re.S)


def merge_line_groups(x):
    # Move the series of every later <c:lineChart> that shares the first one's axis ids into the first group.
    groups = list(re.finditer(r'<c:lineChart>(.*?)</c:lineChart>', x, flags=re.S))
    if len(groups) < 2:
        return x
    first = groups[0]
    ax = re.findall(r'<c:axId val="(\d+)"/>', first.group(1))
    extra = []
    drop = []
    for g in groups[1:]:
        if re.findall(r'<c:axId val="(\d+)"/>', g.group(1)) == ax:
            extra += re.findall(r'<c:ser>.*?</c:ser>', g.group(1), flags=re.S)
            drop.append(g)
    if not extra:
        return x
    body = first.group(1)
    last_ser = list(re.finditer(r'</c:ser>', body))[-1].end()
    merged = '<c:lineChart>' + body[:last_ser] + ''.join(extra) + body[last_ser:] + '</c:lineChart>'
    pieces = []
    pos = 0
    for g in [first] + drop:
        pieces.append(x[pos:g.start()])
        pieces.append(merged if g is first else '')
        pos = g.end()
    pieces.append(x[pos:])
    return ''.join(pieces)


def all_fixes(x):
    return merge_line_groups(no_dlbl(no_legend_entry(no_ref_ext(x))))


VARIANTS = {
    'no-ref-ext': no_ref_ext,
    'no-legend-entry': no_legend_entry,
    'no-dlbl': no_dlbl,
    'merge-line-groups': merge_line_groups,
    'all-four': all_fixes,
}

zin = zipfile.ZipFile(src)
names = zin.namelist()
for vname, fn in VARIANTS.items():
    dst = os.path.join(out, f'{stem}__{vname}.pptx')
    changed = 0
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
        for n in names:
            data = zin.read(n)
            if re.match(r'ppt/charts/chart\d+\.xml$', n):
                x = data.decode('utf8')
                y = fn(x)
                if y != x:
                    changed += 1
                data = y.encode('utf8')
            info = zin.getinfo(n)
            zout.writestr(zipfile.ZipInfo(n, info.date_time), data, compress_type=zipfile.ZIP_DEFLATED)
    print(f'{os.path.basename(dst)}: {changed} chart part(s) changed')
