"""1416: the open Mac experiments of opf#1416 rebuilt on the 0.36.0 corpus files (method of
prior/mac-0351/tools/variants1416.py, which edited the 0.35.1 files). Bases:
build/036/qualification/pptx/coverage-charts.pptx (19 slides), coverage-backgrounds.pptx, coverage-furniture.pptx,
and for item 7 also build/036/matrix/m-links/default.pptx and build/036/layouts/layouts-ordinary/default.pptx.
Item -> variants (see MANIFEST.tsv): 1 radar-nofill; 2 axis-*; 3 bg-alpha-on-white; 4 tile-*; 5 reflabel-*;
6 linelabel-*, stacked-*; 7 hlink-*; 8 none (a routing change, not an XML edit)."""
import colorsys, io, re, sys, zipfile
sys.path.insert(0, '/Users/michael/opf-work/keynote-036/experiments/_lib')
from xv import Group, W
from PIL import Image
Q = f'{W}/build/036/qualification/pptx'
CH, BG, FU = f'{Q}/coverage-charts.pptx', f'{Q}/coverage-backgrounds.pptx', f'{Q}/coverage-furniture.pptx'
ML, LO = f'{W}/build/036/matrix/m-links/default.pptx', f'{W}/build/036/layouts/layouts-ordinary/default.pptx'
g = Group('1416')
g.control('charts-a-exported', CH, 'control for items 1, 2, 5, 6 (slides 5, 14, 16, 4, 10)', 'coverage-charts 0.36.0 as exported')
g.control('backgrounds-a-exported', BG, 'control for items 3, 4 (slides 5, 11)', 'coverage-backgrounds 0.36.0 as exported')

# 1. radar: series area fill a:noFill (standard chart9, marker chart10; filled chart11 untouched)
def nofill(x):
    def ser(m):
        return re.sub(r'(<c:ser>.*?<c:spPr>)<a:solidFill>.*?</a:solidFill>(<a:ln)', r'\1<a:noFill/>\2', m.group(0), count=1, flags=re.S)
    return re.sub(r'<c:ser>.*?</c:ser>', ser, x, flags=re.S)
g.variant('1-radar-nofill', CH, {'ppt/charts/chart9.xml': nofill, 'ppt/charts/chart10.xml': nofill},
          'item 1: chart9 (standard radar) and chart10 (marker radar): each series c:spPr solidFill -> a:noFill (line and markers kept)',
          'slide 5: standard and marker radar drawn as lines only (not filled); legend keys; axis labels collide/clip?', '1416/charts-a-exported')

# 2. secondary axis (chart26, second c:valAx): no c:majorUnit; General format; both
def second(f):
    def g2(x):
        m = list(re.finditer(r'<c:valAx>.*?</c:valAx>', x, re.S))[1]
        return x[:m.start()] + f(m.group(0)) + x[m.end():]
    return g2
no_major = lambda v: re.sub(r'\s*<c:majorUnit val="[^"]*"/>', '', v)
general = lambda v: v.replace('<c:numFmt formatCode="0%" sourceLinked="0"/>', '<c:numFmt formatCode="General" sourceLinked="0"/>')
LOOK2 = 'slide 14: secondary (right) axis labels: 0%, 10% ... 40% (five) or only 0% and 40%; legend over the top label?'
g.variant('2-axis-no-majorunit', CH, {'ppt/charts/chart26.xml': second(no_major)}, 'item 2: chart26 secondary c:valAx without c:majorUnit (was 0.1)', LOOK2, '1416/charts-a-exported')
g.variant('2-axis-general', CH, {'ppt/charts/chart26.xml': second(general)}, 'item 2: chart26 secondary c:valAx numFmt General (was 0%), majorUnit kept', LOOK2, '1416/charts-a-exported')
g.variant('2-axis-both', CH, {'ppt/charts/chart26.xml': second(lambda v: general(no_major(v)))}, 'item 2: both edits', LOOK2, '1416/charts-a-exported')

# 3. background alpha: the 85% background composited onto white at export (what the #1298 route would write)
def composite():
    r, gg, b = (int('2874A6'[i:i + 2], 16) / 255 for i in (0, 2, 4))
    h, l, s = colorsys.rgb_to_hls(r, gg, b)
    r, gg, b = colorsys.hls_to_rgb(h, l * 0.6, s)
    return ''.join(f'{round((0.85 * c + 0.15) * 255):02X}' for c in (r, gg, b))
ON_WHITE = composite()
def bg_white(x):
    old = '<a:solidFill><a:schemeClr val="accent1"><a:lumMod val="60000"/><a:alpha val="85000"/></a:schemeClr></a:solidFill>'
    assert x.count(old) == 1
    return x.replace(old, f'<a:solidFill><a:srgbClr val="{ON_WHITE}"/></a:solidFill>')
g.variant('3-bg-alpha-on-white', BG, {'ppt/slides/slide5.xml': bg_white},
          f'item 3: slide 5 background accent1 lumMod 60% alpha 85% replaced by the color composited onto white, srgbClr {ON_WHITE}',
          'slide 5: background color in the window and in Play (owner only) against the preview (59, 98, 123); the exported PNG no longer has alpha 217', '1416/backgrounds-a-exported')

# 4. tiled background (slide 11): the tile as the slide's p:bg picture fill, the full-slide p:pic removed; 100% and 75%; 75% with a grayscale PNG
def as_bg(scale):
    def fn(x):
        pic = re.search(r'<p:pic>.*?</p:pic>', x, re.S).group(0)
        blip = re.search(r'<a:blip .*?</a:blip>', pic, re.S).group(0)
        tile = re.search(r'<a:tile [^>]*/>', pic).group(0)
        if scale != 100000:
            tile = tile.replace('sx="100000" sy="100000"', f'sx="{scale}" sy="{scale}"')
        bg = f'<p:bg><p:bgPr><a:blipFill dpi="0" rotWithShape="1">{blip}<a:srcRect/>{tile}</a:blipFill><a:effectLst/></p:bgPr></p:bg>'
        x = re.sub(r'<p:bg>.*?</p:bg>', bg, x, count=1, flags=re.S)
        return x.replace(pic, '')
    return fn
rels11 = zipfile.ZipFile(BG).read('ppt/slides/_rels/slide11.xml.rels').decode()
s11 = zipfile.ZipFile(BG).read('ppt/slides/slide11.xml').decode()
rid = re.search(r'<p:pic>.*?<a:blip r:embed="([^"]+)"', s11, re.S).group(1)
media = 'ppt/' + re.search(rf'Id="{rid}"[^>]*Target="\.\./([^"]+)"', rels11).group(1)
def gray_png(b):
    im = Image.open(io.BytesIO(b)); mode = 'LA' if 'A' in im.mode else 'L'; o = io.BytesIO(); im.convert(mode).save(o, 'PNG'); return o.getvalue()
LOOK4 = 'slide 11: tile count (preview: 2 by 2 tiles), tile size against the preview, grayscale (a:grayscl) and 40% opacity (alphaModFix) kept?'
g.variant('4-tile-as-bg', BG, {'ppt/slides/slide11.xml': as_bg(100000)}, 'item 4: slide 11 tile as p:bg blipFill (blip with a:grayscl and alphaModFix 40% kept), the full-slide p:pic removed, tile sx/sy 100%', LOOK4, '1416/backgrounds-a-exported')
g.variant('4-tile-as-bg-75', BG, {'ppt/slides/slide11.xml': as_bg(75000)}, 'item 4: as 4-tile-as-bg with tile sx/sy 75% (0.35.1 round: 2 by 2 at the preview size, but in color)', LOOK4, '1416/4-tile-as-bg')
zb = zipfile.ZipFile(BG)
g.variant('4-tile-as-bg-75-gray-png', BG, {'ppt/slides/slide11.xml': as_bg(75000)}, f'item 4: as 4-tile-as-bg-75 and the tile PNG ({media}) itself converted to grayscale, in case Keynote drops a:grayscl on a p:bg fill', LOOK4, '1416/4-tile-as-bg-75')
# the PNG edit is a binary part: patch the last variant in place (the helper edits text parts only)
import shutil, os
dst = f'{g.dir}/4-tile-as-bg-75-gray-png.pptx'; tmp = dst + '.tmp'
with zipfile.ZipFile(dst) as zi, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zo:
    for info in zi.infolist():
        d = zi.read(info.filename)
        zo.writestr(info, gray_png(d) if info.filename == media else d)
os.replace(tmp, dst)
g._check(dst, BG, {'ppt/slides/slide11.xml', media})

# 5. bar reference label "Target 30 min" (slide 16, a text box beside the reference line at the plot bottom): outside the category range
def move_label(y):
    def fn(x):
        m = re.search(r'(<p:cNvPr id="\d+" name="OPF chart 28:0 label"/>.*?<a:off x="\d+" y=")(\d+)(")', x, re.S)
        return x[:m.start(2)] + str(y) + x[m.end(2):]
    return fn
LINE_TOP, LINE_BOTTOM, LABEL_H = 1642872, 1642872 + 3618738, 285750
LOOK5 = 'slide 16: "Target 30 min" clear of the East bar value label; inside the chart frame; next to its reference line'
g.variant('5-reflabel-above-plot', CH, {'ppt/slides/slide16.xml': move_label(LINE_TOP - LABEL_H)}, f'item 5: the label text box moved above the plot top (y {LINE_TOP - LABEL_H}, ends where the reference line starts); x unchanged', LOOK5, '1416/charts-a-exported')
g.variant('5-reflabel-below-plot', CH, {'ppt/slides/slide16.xml': move_label(LINE_BOTTOM)}, f'item 5: the label text box moved below the plot bottom (y {LINE_BOTTOM}, where the line ends: over the value axis labels?)', LOOK5, '1416/charts-a-exported')

# 6. direct line labels ("170 Visits", "31 Self-serve") and stacked lines
RICH = r'<c:dLbl><c:idx val="(\d+)"/><c:tx><c:rich>.*?</c:rich></c:tx>(.*?)</c:dLbl>'
def series_level(x):
    def ser(m):
        s = m.group(0)
        d = re.search(r'<c:dLbls>(.*?)</c:dLbls>', s, re.S)
        r = re.search(RICH, d.group(1), re.S) if d else None
        if not r: return s
        k = int(r.group(1)); rest = r.group(2)
        n = int(re.search(r'<c:val>.*?<c:ptCount val="(\d+)"/>', s, re.S).group(1))
        sp = re.search(r'<c:spPr>.*?</c:spPr>', rest, re.S).group(0)
        tx = re.search(r'<c:txPr>.*?</c:txPr>', rest, re.S)
        pos = re.search(r'<c:dLblPos val="[^"]*"/>', rest).group(0)
        dels = ''.join(f'<c:dLbl><c:idx val="{i}"/><c:delete val="1"/></c:dLbl>' for i in range(n) if i != k)
        new = (f'<c:dLbls>{dels}<c:numFmt formatCode="General" sourceLinked="0"/>{sp}{tx.group(0) if tx else ""}{pos}'
               '<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="1"/><c:showPercent val="0"/>'
               '<c:showBubbleSize val="0"/><c:separator> </c:separator><c:showLeaderLines val="0"/></c:dLbls>')
        return s.replace(d.group(0), new)
    return re.sub(r'<c:ser>.*?</c:ser>', ser, x, flags=re.S)
def point_fields(x):
    def one(m):
        body = m.group(2)
        body = body.replace('<c:showVal val="0"/>', '<c:showVal val="1"/>').replace('<c:showSerName val="0"/>', '<c:showSerName val="1"/>')
        if '<c:separator>' not in body:
            body = body.replace('<c:showBubbleSize val="0"/>', '<c:showBubbleSize val="0"/><c:separator> </c:separator>')
        return f'<c:dLbl><c:idx val="{m.group(1)}"/>{body}</c:dLbl>'
    return re.sub(RICH, one, x, flags=re.S)
LOOK6 = 'slides 4 and 10: the line-end labels ("55 Enterprise", "170 Visits") drawn or dropped; their text and place; back.pptx c:dLbls'
L6 = {'ppt/charts/chart7.xml', 'ppt/charts/chart8.xml', 'ppt/charts/chart22.xml'}
g.variant('6-linelabel-series-level', CH, {c: series_level for c in L6},
          'item 6: charts 7, 8 (slide 4), 22 (slide 10): the per-point rich label (c:tx rich on the last point) replaced by a series-level label showVal+showSerName, separator " ", the other points c:delete; Keynote/PowerPoint order is name then value ("Visits 170")', LOOK6, '1416/charts-a-exported')
g.variant('6-linelabel-point-fields', CH, {c: point_fields for c in L6},
          'item 6: the same last-point c:dLbl kept but without c:tx rich: showVal 1 + showSerName 1, separator " " (field label, not static text)', LOOK6, '1416/charts-a-exported')
def unstack_cumulative(x):
    assert x.count('<c:grouping val="stacked"/>') == 1
    x = x.replace('<c:grouping val="stacked"/>', '<c:grouping val="standard"/>')
    acc = {}
    def ser(m):
        s = m.group(0)
        def val(v):
            def pt(q):
                i = int(q.group(1)); acc[i] = acc.get(i, 0) + float(q.group(2))
                t = acc[i]
                return f'<c:pt idx="{i}"><c:v>{int(t) if t == int(t) else t}</c:v></c:pt>'
            return re.sub(r'<c:pt idx="(\d+)"><c:v>([^<]*)</c:v></c:pt>', pt, v.group(0))
        return re.sub(r'<c:val>.*?</c:val>', val, s, count=1, flags=re.S)
    return re.sub(r'<c:ser>.*?</c:ser>', ser, x, flags=re.S)
g.variant('6-stacked-as-cumulative', CH, {'ppt/charts/chart7.xml': unstack_cumulative, 'ppt/charts/chart8.xml': unstack_cumulative},
          'item 6: slide 4 charts 7, 8: c:grouping stacked -> standard with each series\' cached values made cumulative (18..122 instead of 18..55); the embedded workbook keeps the plain values; labels unchanged',
          'slide 4: lines at the stacked heights as in the preview (top line ends at 122), or as a (unstacked, 18 to 55)', '1416/charts-a-exported')

# 7. theme a:hlink in the design's text color (tx1 = dk1 000000) or its accent1 (2874A6)
def hlink(c):
    return lambda x: re.sub(r'<a:hlink><a:srgbClr val="[0-9A-F]{6}"/></a:hlink>', f'<a:hlink><a:srgbClr val="{c}"/></a:hlink>', x, count=1)
LOOK7 = ('link text color: m-links slide 3 (link inside a sentence, 0.36.0 still blue 0000EE), layouts-ordinary slide 6 (link on the blue band), '
         'coverage-furniture slide 4 (link footer; 0.36.0 links the shape, M65); probe.json paragraph color of the link run')
for base, tag in [(ML, 'mlinks'), (LO, 'ordinary'), (FU, 'furniture')]:
    g.control(f'7-{tag}-a-exported', base, LOOK7, f'item 7 control: {base.split("/build/036/")[1]} as exported, theme hlink 0000EE')
    g.variant(f'7-{tag}-hlink-text', base, {'ppt/theme/theme1.xml': hlink('000000')}, 'item 7: theme1 a:hlink = 000000 (the design\'s text color dk1/tx1)', LOOK7, f'1416/7-{tag}-a-exported')
    g.variant(f'7-{tag}-hlink-accent', base, {'ppt/theme/theme1.xml': hlink('2874A6')}, 'item 7: theme1 a:hlink = 2874A6 (the design\'s accent1)', LOOK7, f'1416/7-{tag}-a-exported')
g.write()
print('on white', ON_WHITE, 'tile media', media)
