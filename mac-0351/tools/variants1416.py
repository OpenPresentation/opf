"""#1416 Mac experiments: write XML variants of the 0.35.1 coverage files. Each variant changes only the named parts.
usage: python3 variants1416.py <c0351-pptx-dir> <out-dir>"""
import io, re, sys, zipfile
from PIL import Image
src, out = sys.argv[1], sys.argv[2]

def variant(name, base, edits):
    zin = zipfile.ZipFile(f'{src}/{base}.pptx')
    with zipfile.ZipFile(f'{out}/{base}~{name}.pptx', 'w', zipfile.ZIP_DEFLATED) as z:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename in edits:
                new = edits[info.filename](data)
                assert new != data, f'{name}: {info.filename} unchanged'
                data = new
            z.writestr(info, data)
    print(name, sorted(edits))

def text(f):
    return lambda b: f(b.decode('utf-8')).encode('utf-8')

# 1. Radar: the series area fill becomes a:noFill (standard radar chart9, marker radar chart10); the line and markers keep theirs.
def nofill(x):
    def ser(m):
        return re.sub(r'(<c:ser>.*?<c:spPr>)<a:solidFill>.*?</a:solidFill>(<a:ln)', r'\1<a:noFill/>\2', m.group(0), count=1, flags=re.S)
    return re.sub(r'<c:ser>.*?</c:ser>', ser, x, flags=re.S)
variant('radar-nofill', 'coverage-charts', {'ppt/charts/chart9.xml': text(nofill), 'ppt/charts/chart10.xml': text(nofill)})

# 2. Secondary axis (chart26, second c:valAx): without c:majorUnit; with a General number format; both.
def second(f):
    def g(x):
        parts = list(re.finditer(r'<c:valAx>.*?</c:valAx>', x, re.S))
        m = parts[1]
        return x[:m.start()] + f(m.group(0)) + x[m.end():]
    return text(g)
no_major = lambda v: re.sub(r'\s*<c:majorUnit val="[^"]*"/>', '', v)
general = lambda v: v.replace('<c:numFmt formatCode="0%" sourceLinked="0"/>', '<c:numFmt formatCode="General" sourceLinked="0"/>')
variant('axis-no-majorunit', 'coverage-charts', {'ppt/charts/chart26.xml': second(no_major)})
variant('axis-general', 'coverage-charts', {'ppt/charts/chart26.xml': second(general)})
variant('axis-both', 'coverage-charts', {'ppt/charts/chart26.xml': second(lambda v: general(no_major(v)))})

# 4. Tiled background (slide 11): (a) the tile as the slide's p:bg picture fill, the full-slide p:pic removed; (b) the PNG with a 96 dpi
# pHYs chunk (the size PowerPoint assumes); (c) the p:pic tile scaled to 50%.
def as_bg(x):
    pic = re.search(r'<p:pic>.*?</p:pic>', x, re.S).group(0)
    blip = re.search(r'<a:blip .*?</a:blip>', pic, re.S).group(0)
    tile = re.search(r'<a:tile [^>]*/>', pic).group(0)
    bg = f'<p:bg><p:bgPr><a:blipFill dpi="0" rotWithShape="1">{blip}<a:srcRect/>{tile}</a:blipFill><a:effectLst/></p:bgPr></p:bg>'
    x = re.sub(r'<p:bg>.*?</p:bg>', bg, x, count=1, flags=re.S)
    return x.replace(pic, '')
variant('tile-as-bg', 'coverage-backgrounds', {'ppt/slides/slide11.xml': text(as_bg)})
def dpi96(b):
    im = Image.open(io.BytesIO(b)); o = io.BytesIO(); im.save(o, 'PNG', dpi=(96, 96)); return o.getvalue()
variant('tile-png-96dpi', 'coverage-backgrounds', {'ppt/media/image-11-1.png': dpi96})
variant('tile-half', 'coverage-backgrounds', {'ppt/slides/slide11.xml': text(lambda x: re.sub(r'(<a:tile [^>]*?)sx="100000" sy="100000"', r'\1sx="50000" sy="50000"', x))})

# 4 (second round): the p:bg picture fill with the PNG at 96 dpi, and with the tile at 75%.
variant('tile-as-bg-96dpi', 'coverage-backgrounds', {'ppt/slides/slide11.xml': text(as_bg), 'ppt/media/image-11-1.png': dpi96})
variant('tile-as-bg-75', 'coverage-backgrounds', {'ppt/slides/slide11.xml': text(lambda x: re.sub(r'(<a:tile [^>]*?)sx="100000" sy="100000"', r'\1sx="75000" sy="75000"', as_bg(x)))})
