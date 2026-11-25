"""label-separator (MX-05): Keynote drops the category name from column data labels (m-charts slide 5, chart6.xml:
series-level c:dLbls showCatName 1, separator ": ") and drops the pie label separator so each label is on two lines
(slide 12, chart17.xml: per-point c:dLbl showCatName 1, separator ", ").
(b1) chart6: showCatName and separator moved from the series-level c:dLbls of the two bar series to a c:dLbl per point
(series level: showCatName 0, no separator); (b2) the same c:dLbl per point added, series level kept.
(c1) chart17: every c:separator "; "; (c2) every c:separator a newline."""
import re, sys
sys.path.insert(0, '/Users/michael/opf-work/keynote-036/experiments/_lib')
from xv import Group, W
SRC = f'{W}/build/036/matrix/m-charts/default.pptx'
C6, C17 = 'ppt/charts/chart6.xml', 'ppt/charts/chart17.xml'
def per_point(move):
    def fn(x):
        def ser(m):
            s = m.group(0)
            if '<c:barChart>' in s: pass
            d = re.search(r'<c:dLbls>(<c:numFmt.*?)<c:showLeaderLines val="0"/></c:dLbls>', s, re.S)
            if not d or '<c:showCatName val="1"/>' not in d.group(1) or '<c:dLbl>' in d.group(0): return s
            body = d.group(1)  # numFmt spPr txPr dLblPos show* separator
            n = int(re.search(r'<c:cat>.*?<c:ptCount val="(\d+)"/>', s, re.S).group(1))
            lbls = ''.join(f'<c:dLbl><c:idx val="{i}"/>{body}</c:dLbl>' for i in range(n))
            series = body
            if move:
                series = re.sub(r'<c:separator>[^<]*</c:separator>', '', body).replace('<c:showCatName val="1"/>', '<c:showCatName val="0"/>')
            return s.replace(d.group(0), f'<c:dLbls>{lbls}{series}<c:showLeaderLines val="0"/></c:dLbls>')
        return re.sub(r'<c:ser>.*?</c:ser>', ser, x, flags=re.S)
    return fn
def sep(new):
    return lambda x: re.sub(r'<c:separator>[^<]*</c:separator>', f'<c:separator>{new}</c:separator>', x)
g = Group('label-separator')
LOOK5 = 'slide 5 (left chart): column labels read "North: 42" (preview) or "42" (a); back.pptx chart6 showCatName per point/series'
LOOK12 = 'slide 12: pie labels on one line "AMER, 25" (preview) or two lines "AMER"/"25" (a); back.pptx chart17 c:separator'
g.control('a-exported', SRC, LOOK5 + '; ' + LOOK12, 'as exported (m-charts default)')
g.variant('b1-catname-per-point-moved', SRC, {C6: per_point(True)}, 'chart6 bar series: a c:dLbl per point (idx 0..2) with showCatName 1 and separator ": "; series level showCatName 0, no separator', LOOK5, 'label-separator/a-exported')
g.variant('b2-catname-per-point-added', SRC, {C6: per_point(False)}, 'chart6 bar series: a c:dLbl per point with showCatName 1 and ": " added; series level unchanged', LOOK5, 'label-separator/a-exported')
g.variant('c1-separator-semicolon', SRC, {C17: sep('; ')}, 'chart17: every c:separator "; "', LOOK12, 'label-separator/a-exported')
g.variant('c2-separator-newline', SRC, {C17: sep('\n')}, 'chart17: every c:separator a newline character', LOOK12, 'label-separator/a-exported')
g.write()
