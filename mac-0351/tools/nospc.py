"""Copy a PPTX with every run's letter spacing (spc on a:rPr / a:defRPr / a:endParaRPr) removed; print the slides that had any.
usage: python3 nospc.py <in.pptx> <out.pptx>"""
import re, sys, zipfile
src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src)
zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
pat = re.compile(r'(<a:(?:rPr|defRPr|endParaRPr)\b[^>]*?)\s+spc="-?\d+"')
hits = {}
for info in zin.infolist():
    data = zin.read(info.filename)
    if info.filename.endswith('.xml') and info.filename.startswith('ppt/'):
        text = data.decode('utf-8')
        vals = re.findall(r'<a:(?:rPr|defRPr|endParaRPr)\b[^>]*?\bspc="(-?\d+)"', text)
        if vals:
            hits[info.filename] = sorted(set(vals), key=int)
            text = pat.sub(r'\1', text)
            while pat.search(text):
                text = pat.sub(r'\1', text)
            data = text.encode('utf-8')
    zout.writestr(info, data)
zout.close()
for k, v in sorted(hits.items()):
    print(k, ','.join(v))
