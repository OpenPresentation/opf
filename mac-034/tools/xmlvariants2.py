"""Second round of single-difference variants of r1-line (explicit-chart-reference-lines slide 1 alone).

usage: python3 xmlvariants2.py <r1-line.pptx> <r1-line-norefs.pptx> <out-dir>
"""
import os
import re
import sys
import zipfile

src, norefs, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
CH = 'ppt/charts/chart1.xml'
ref_layout = re.search(r'<c:plotArea><c:layout>.*?</c:layout>', zipfile.ZipFile(norefs).read(CH).decode(), re.S).group(0)


def groups(x):
    return list(re.finditer(r'<c:lineChart>.*?</c:lineChart>', x, re.S))


def drop_helper_group(x):
    g = groups(x)
    return x[:g[1].start()] + x[g[1].end():] if len(g) > 1 else x


def drop_group_dlbls(x):
    # The group-level <c:dLbls> that sits directly in the first lineChart (after its </c:ser> elements).
    g = groups(x)[0]
    body = g.group(0)
    new = re.sub(r'(</c:ser>\s*)<c:dLbls>.*?</c:dLbls>', r'\1', body, count=1, flags=re.S)
    return x[:g.start()] + new + x[g.end():]


def outer_layout(x):
    return re.sub(r'<c:plotArea><c:layout>.*?</c:layout>', lambda _: ref_layout, x, count=1, flags=re.S)


def helper_no_dlbls(x):
    g = groups(x)[1]
    body = re.sub(r'<c:dLbls>.*?</c:dLbls>', '', g.group(0), flags=re.S)
    return x[:g.start()] + body + x[g.end():]


def helper_dlbls_complete(x):
    # Give the helper series' dLbls the full set of group flags (showPercent, showBubbleSize) like the data group's.
    g = groups(x)[1]
    body = g.group(0).replace('<c:showSerName val="0"/></c:dLbls>', '<c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>')
    body = body.replace('<c:showSerName val="0"/></c:dLbl>', '<c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbl>')
    return x[:g.start()] + body + x[g.end():]


VARIANTS = {
    'drop-helper-group': drop_helper_group,
    'drop-group-dlbls': drop_group_dlbls,
    'outer-layout': outer_layout,
    'helper-no-dlbls': helper_no_dlbls,
    'helper-dlbls-complete': helper_dlbls_complete,
}
zin = zipfile.ZipFile(src)
for name, fn in VARIANTS.items():
    dst = os.path.join(out, f'r1-line__{name}.pptx')
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
        for n in zin.namelist():
            data = zin.read(n)
            if n == CH:
                x = data.decode()
                y = fn(x)
                print(name, 'changed' if y != x else 'UNCHANGED')
                data = y.encode()
            z.writestr(zipfile.ZipInfo(n, zin.getinfo(n).date_time), data, compress_type=zipfile.ZIP_DEFLATED)
