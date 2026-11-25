"""one-series-highlight (MX-03): a highlighted point in a one-series chart. 0.36.0 writes the highlight as a second,
sparse series of the same name (c:overlap 100, c:legendEntry idx 1 deleted); Keynote shows both names in the legend,
half-width columns off their names, and a gray marker. Find a form where Keynote shows one legend entry, full-width
columns and the highlight color. Base: build/036/matrix/m-charts/default.pptx charts 1-3 (slides 1-3: column, bar,
line with markers)."""
import re, sys
sys.path.insert(0, '/Users/michael/opf-work/keynote-036/experiments/_lib')
from xv import Group, W
SRC = f'{W}/build/036/matrix/m-charts/default.pptx'
SRC0351 = f'{W}/build/0351/matrix/m-charts/default.pptx'
CHARTS = ['ppt/charts/chart1.xml', 'ppt/charts/chart2.xml', 'ppt/charts/chart3.xml']
g = Group('one-series-highlight')
LOOK = ('slides 1-3 (column, bar, line): legend entries (one "Wait"/"Visits", or two, or the categories); column/bar width and whether '
        'each sits on its category name; highlight color on North+East (1), North (2), March marker (3). back.pptx chart1-3: '
        'number of c:ser, c:dPt kept, c:legendEntry kept. Picture against a and against OPF preview build/036/matrix/m-charts/preview')

SER = r'<c:ser>.*?</c:ser>'
def sers(x):
    return list(re.finditer(SER, x, re.S))

def second_tx(new_tx):
    def edit(x):
        s = sers(x)[1]
        t = s.group(0)
        t2 = re.sub(r'<c:tx>.*?</c:tx>', new_tx, t, count=1, flags=re.S)
        assert t2 != t
        return x[:s.start()] + t2 + x[s.end():]
    return edit

def pts(ser):
    cache = re.search(r'<c:val>.*?<c:numCache>(.*?)</c:numCache>', ser, re.S).group(1)
    return {int(i): v for i, v in re.findall(r'<c:pt idx="(\d+)"><c:v>([^<]*)</c:v></c:pt>', cache)}

def merge(legend_deletes):
    def edit(x):
        s1, s2 = sers(x)[:2]
        a, b = s1.group(0), s2.group(0)
        line = '<c:marker>' in a and '<c:invertIfNegative' not in a
        p = pts(a); p.update(pts(b))
        n = int(re.search(r'<c:val>.*?<c:ptCount val="(\d+)"/>', a, re.S).group(1))
        dense = ''.join(f'<c:pt idx="{i}"><c:v>{p[i]}</c:v></c:pt>' for i in sorted(p))
        a = re.sub(r'(<c:val>.*?<c:ptCount val="\d+"/>).*?(\s*</c:numCache>)', lambda m: m.group(1) + dense + m.group(2), a, count=1, flags=re.S)
        hi = sorted(pts(b))
        if line:
            mk = re.search(r'<c:marker>.*?</c:marker>', b, re.S).group(0)
            dpt = ''.join(f'<c:dPt><c:idx val="{i}"/>{mk}<c:bubble3D val="0"/></c:dPt>' for i in hi)
            a = re.sub(r'(<c:marker>.*?</c:marker>)', lambda m: m.group(1) + dpt, a, count=1, flags=re.S)
        else:
            sp = re.search(r'<c:spPr>.*?</c:spPr>', b, re.S).group(0)
            dpt = ''.join(f'<c:dPt><c:idx val="{i}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/>{sp}</c:dPt>' for i in hi)
            a = re.sub(r'(<c:invertIfNegative val="0"/>)', lambda m: m.group(1) + dpt, a, count=1)
        # per-point labels of the highlight series move into the merged series' c:dLbls (c:dLbl come first, by idx)
        lb = re.findall(r'<c:dLbl>.*?</c:dLbl>', b, re.S)
        if lb:
            al = re.findall(r'<c:dLbl>.*?</c:dLbl>', a, re.S)
            allb = sorted(al + lb, key=lambda t: int(re.search(r'<c:idx val="(\d+)"/>', t).group(1)))
            a = re.sub(r'<c:dLbl>.*?</c:dLbl>', '', a, flags=re.S)
            a = a.replace('<c:dLbls>', '<c:dLbls>' + ''.join(allb), 1)
        a = re.sub(r'<c:extLst><c:ext uri="urn:openpresentation:chart-point-series:v1">.*?</c:extLst>', '', a, flags=re.S)
        x = x[:s1.start()] + a + x[s1.end():s2.start()] + x[s2.end():]
        x = re.sub(r'<c:legendEntry>.*?</c:legendEntry>', '', x, flags=re.S)
        if legend_deletes:
            ents = ''.join(f'<c:legendEntry><c:idx val="{i}"/><c:delete val="1"/></c:legendEntry>' for i in range(1, n))
            x = re.sub(r'(<c:legend><c:legendPos val="[a-z]+"/>)', lambda m: m.group(1) + ents, x, count=1)
        assert len(sers(x)) == 1
        return x
    return edit

g.control('a-exported', SRC, LOOK, '0.36.0 as exported: two series per chart (base sparse, highlight sparse, same name), c:overlap 100, c:legendEntry idx 1 deleted')
g.control('b-0351', SRC0351, LOOK, '0.35.1 export of the same deck (byte copy): one dense series, highlight as c:dPt, c:varyColors 0, c:overlap 0, no c:legendEntry')
g.variant('c1-second-no-tx', SRC, {c: second_tx('') for c in CHARTS},
          'highlight series without c:tx (no name); everything else as a', LOOK, 'one-series-highlight/a-exported')
g.variant('c2-second-empty-tx', SRC, {c: second_tx('<c:tx><c:strRef><c:f>Sheet1!$C$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v></c:v></c:pt></c:strCache></c:strRef></c:tx>') for c in CHARTS},
          'highlight series named with an empty c:v (the embedded workbook still says the name in C1); everything else as a', LOOK, 'one-series-highlight/a-exported')
g.variant('d1-one-series-dpt', SRC, {c: merge(False) for c in CHARTS},
          'the two series merged into one dense series (0.36.0 chart otherwise: inner plot, labels); the highlight as c:dPt (bar: spPr; line: marker); c:varyColors 0 (unchanged); c:legend kept, c:legendEntry removed; c:overlap left at 100 (one series)', LOOK, 'one-series-highlight/b-0351')
g.variant('d2-one-series-dpt-legend-deletes', SRC, {c: merge(True) for c in CHARTS},
          'as d1 plus c:legendEntry delete for idx 1..n-1 (in case Keynote lists the categories of a series with c:dPt)', LOOK, 'one-series-highlight/d1-one-series-dpt')

# RT-01 variant B (round-trip grader): two series kept, each value cache dense: every idx 0..n-1 written, the points a
# series does not draw as an empty c:v (Keynote wrote c:ptCount = points present for the sparse caches).
def dense_empty(x):
    def ser(m):
        s = m.group(0)
        def cache(c):
            body = c.group(0)
            n = int(re.search(r'<c:ptCount val="(\d+)"/>', body).group(1))
            have = dict(re.findall(r'<c:pt idx="(\d+)"><c:v>([^<]*)</c:v></c:pt>', body))
            pts = ''.join(f'<c:pt idx="{i}"><c:v>{have.get(str(i), "")}</c:v></c:pt>' for i in range(n))
            return re.sub(r'(<c:ptCount val="\d+"/>).*?(\s*</c:numCache>)', lambda q: q.group(1) + pts + q.group(2), body, count=1, flags=re.S)
        return re.sub(r'<c:val>.*?</c:val>', cache, s, count=1, flags=re.S)
    return re.sub(SER, ser, x, flags=re.S)
g.variant('e-two-series-dense-empty-points', SRC, {c: dense_empty for c in CHARTS},
          'RT-01 B: as a (two series), but each value cache lists every index; the points a series does not draw are <c:pt idx="i"><c:v></c:v></c:pt>',
          LOOK + '; round trip: back.pptx c:ptCount consistent and opf-036 convert back.pptx imports', 'one-series-highlight/a-exported')
g.write()
