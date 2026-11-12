"""Complete the data-label flags wherever a c:dLbl or c:dLbls ends right after showSerName (all chart parts).

usage: python3 flagfix.py <in.pptx> <out.pptx>
"""
import re
import sys
import zipfile

src, dst = sys.argv[1:3]
zin = zipfile.ZipFile(src)
total = 0
with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
    for n in zin.namelist():
        data = zin.read(n)
        if re.match(r'ppt/charts/chart\d+\.xml$', n):
            x = data.decode()
            x, a = re.subn(r'<c:showSerName val="0"/></c:dLbl>', '<c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbl>', x)
            x, b = re.subn(r'<c:showSerName val="0"/></c:dLbls>', '<c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/><c:showLeaderLines val="0"/></c:dLbls>', x)
            total += a + b
            data = x.encode()
        z.writestr(zipfile.ZipInfo(n, zin.getinfo(n).date_time), data, compress_type=zipfile.ZIP_DEFLATED)
print(f'{dst}: {total} flag sets completed')
