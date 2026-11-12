"""Swap axis positions back to a vertical chart's in line-only charts whose catAx says axPos l.

usage: python3 axfix.py <in.pptx> <out.pptx> <axpos|axpos-tick>
"""
import re
import sys
import zipfile

src, dst, mode = sys.argv[1:4]
zin = zipfile.ZipFile(src)
changed = []


def fix(x):
    def cat(m):
        a = m.group(0).replace('<c:axPos val="l"/>', '<c:axPos val="b"/>')
        if mode == 'axpos-tick':
            a = re.sub(r'<c:tickLblPos val="\w+"/>', '<c:tickLblPos val="low"/>', a)
        return a

    def val(m):
        a = m.group(0).replace('<c:axPos val="b"/>', '<c:axPos val="l"/>')
        if mode == 'axpos-tick':
            a = re.sub(r'<c:tickLblPos val="\w+"/>', '<c:tickLblPos val="nextTo"/>', a)
        return a

    x = re.sub(r'<c:catAx>.*?</c:catAx>', cat, x, flags=re.S)
    return re.sub(r'<c:valAx>.*?</c:valAx>', val, x, flags=re.S)


with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
    for n in zin.namelist():
        data = zin.read(n)
        if re.match(r'ppt/charts/chart\d+\.xml$', n):
            x = data.decode()
            if '<c:lineChart>' in x and '<c:barChart>' not in x and re.search(r'<c:catAx>.*?<c:axPos val="l"/>', x, re.S):
                y = fix(x)
                if y != x:
                    changed.append(n.split('/')[-1])
                    data = y.encode()
        z.writestr(zipfile.ZipInfo(n, zin.getinfo(n).date_time), data, compress_type=zipfile.ZIP_DEFLATED)
print(dst, mode, 'changed:', ', '.join(changed) or 'none')
