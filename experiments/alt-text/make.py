"""alt-text: which p:cNvPr attribute Keynote 16.0 shows as an image's Description.
Base: build/036/x-min/LY-04/default.pptx (slide 1 picture with alt text; slide 2 SmartArt, whose fallback picture
carries its own descr). Every p:cNvPr that has a descr is edited."""
import re, sys
sys.path.insert(0, '/Users/michael/opf-work/keynote-036/experiments/_lib')
from xv import Group, W
from xml.sax.saxutils import unescape
SRC = f'{W}/build/036/x-min/LY-04/default.pptx'
SLIDES = ['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml']
g = Group('alt-text')

def per_cnvpr(fn):
    def edit(x):
        def one(m):
            tag = m.group(0)
            d = re.search(r' descr="([^"]*)"', tag)
            return fn(tag, d.group(1)) if d else tag
        return re.sub(r'<p:cNvPr [^>]*?/?>', one, x)
    return edit

def setattr_(tag, k, v):
    if re.search(rf' {k}="[^"]*"', tag):
        return re.sub(rf' {k}="[^"]*"', f' {k}="{v}"', tag)
    return tag.replace('<p:cNvPr ', f'<p:cNvPr {k}="{v}" ', 1)

LOOK = ('Keynote: select the picture on slide 1 and the SmartArt picture on slide 2, Format > Image > Description '
        '(user interface); probe.json images[].description; back.pptx p:cNvPr name/descr/title')
g.control('a-exported', SRC, LOOK, 'as exported: name="OPF image 1", descr=alt text, no title')
g.variant('b-name-is-alt', SRC, {p: per_cnvpr(lambda t, d: setattr_(t, 'name', d)) for p in SLIDES},
          'name = the alt text (descr kept, no title)', LOOK, 'alt-text/a-exported')
g.variant('c-title-is-alt', SRC, {p: per_cnvpr(lambda t, d: re.sub(r' descr="[^"]*"', '', setattr_(t, 'title', d))) for p in SLIDES},
          'title = the alt text, descr removed, name unchanged', LOOK, 'alt-text/a-exported')
g.variant('d-descr-only', SRC, {p: per_cnvpr(lambda t, d: setattr_(t, 'name', '')) for p in SLIDES},
          'descr only: name="" (name is a required attribute, so emptied), no title', LOOK, 'alt-text/a-exported')
g.variant('e-title-and-descr', SRC, {p: per_cnvpr(lambda t, d: setattr_(t, 'title', d)) for p in SLIDES},
          'title and descr both = the alt text, name unchanged', LOOK, 'alt-text/a-exported')
g.write()

# RT-03 (round-trip grader): coverage-images slide 1 picture p:cNvPr id="3" name="OPF image 1"
# descr="Harbor at dusk with cranes and containers" title="Harbor" (= experiments/fonttest/A-default-aptos.pptx)
g = Group('alt-text')  # same folder; rows appended to a second file and merged below
g.rows = []
CI = f'{W}/experiments/fonttest/A-default-aptos.pptx'
ALT = 'Harbor at dusk with cranes and containers'
TAG = '<p:cNvPr id="3" name="OPF image 1" descr="Harbor at dusk with cranes and containers" title="Harbor"/>'
def cnv(new):
    def fn(x):
        assert x.count(TAG) == 1
        return x.replace(TAG, new)
    return fn
L3 = 'slide 1 picture: probe.json images[].description; back.pptx p:cNvPr name/descr/title; Format > Image > Description (user interface)'
S1 = 'ppt/slides/slide1.xml'
g.control('RT-03-0-exported', CI, L3, 'coverage-images as exported: name="OPF image 1" descr=alt title="Harbor"')
g.variant('RT-03-a-no-title', CI, {S1: cnv('<p:cNvPr id="3" name="OPF image 1" descr="Harbor at dusk with cranes and containers"/>')}, 'title removed (expect Description "OPF image 1")', L3, 'alt-text/RT-03-0-exported')
g.variant('RT-03-b-name-alt', CI, {S1: cnv(f'<p:cNvPr id="3" name="{ALT}" descr="{ALT}"/>')}, 'name = the alt text, no title (expect Description = alt)', L3, 'alt-text/RT-03-0-exported')
g.variant('RT-03-c-name-empty', CI, {S1: cnv(f'<p:cNvPr id="3" name="" descr="{ALT}"/>')}, 'name="", descr kept, no title: does Keynote fall back to descr?', L3, 'alt-text/RT-03-0-exported')
g.variant('RT-03-d-title-alt-no-descr', CI, {S1: cnv(f'<p:cNvPr id="3" name="OPF image 1" title="{ALT}"/>')}, 'name kept, title = the alt text, descr removed (expect "<alt>\\n\\nOPF image 1")', L3, 'alt-text/RT-03-0-exported')
rows_rt03 = g.rows
import csv
with open(f'{g.dir}/manifest-rows.tsv', 'a') as f:
    for r in rows_rt03:
        f.write('\t'.join(str(c).replace('\t', ' ').replace('\n', ' ') for c in r) + '\n')
print('alt-text RT-03:', len(rows_rt03), 'files')
