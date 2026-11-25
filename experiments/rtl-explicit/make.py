"""rtl-explicit (MX-06) and rtl-table (LG-02).
rtl-explicit: m-text-flush-rtl slide 6, a Hebrew paragraph with Latin words in an English deck, line boxes without an
rtl attribute; Keynote picks the direction per line from the first strong character. (b) rtl="0" written on each a:pPr
of the four line boxes; (c) rtl="1" for comparison.
rtl-table: lang-rtl slides 1 (ar) and 2 (he): the table frame is at a:off x 6210300 (489 pt), a:tblPr rtl="1"; Keynote
draws the table from 61 to 489 pt. (b) rtl removed, grid and cells in visual order; (c1) rtl kept, a:off x = x + cx
(Keynote reads x as the right edge?); (c2) rtl kept, frame mirrored about the slide center (x = slide width - x - cx)."""
import re, sys, zipfile
sys.path.insert(0, '/Users/michael/opf-work/keynote-036/experiments/_lib')
from xv import Group, W

# --- rtl-explicit
g = Group('rtl-explicit')
SRC = f'{W}/build/036/matrix/m-text-flush-rtl/default.pptx'
def lines_rtl(val):
    def fn(x):
        def one(m):
            s = m.group(0)
            if 'name="OPF text slides.5.blocks.0.text line' not in s: return s
            return re.sub(r'<a:pPr ([^>]*?)(/?)>', lambda q: f'<a:pPr {q.group(1)} rtl="{val}"{q.group(2)}>', s)
        return re.sub(r'<p:sp>.*?</p:sp>', one, x, flags=re.S)
    return fn
LOOK = ('slide 6: word order of each line (Latin words "Northern Hub", "Dock Scheduler", "18" placed as in the preview build/036/matrix/m-text-flush-rtl/preview/slide-6.png?) '
        'and line ends; back.pptx a:pPr rtl per line; Format > Text paragraph direction (user interface)')
g.control('a-exported', SRC, LOOK, 'as exported: slide 6 line boxes a:pPr algn="r" with no rtl attribute (deck language en-US)')
g.variant('b-rtl0', SRC, {'ppt/slides/slide6.xml': lines_rtl('0')}, 'slide 6: rtl="0" on the a:pPr of the four line boxes', LOOK, 'rtl-explicit/a-exported')
g.variant('c-rtl1', SRC, {'ppt/slides/slide6.xml': lines_rtl('1')}, 'slide 6: rtl="1" on the a:pPr of the four line boxes (for comparison: the direction Keynote guesses)', LOOK, 'rtl-explicit/a-exported')
g.write()

# --- rtl-table
g = Group('rtl-table')
SRC = f'{W}/build/036/languages/lang-rtl/default.pptx'
SLIDES = ['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml']
SW = int(re.search(r'<p:sldSz cx="(\d+)"', zipfile.ZipFile(SRC).read('ppt/presentation.xml').decode()).group(1))
FRAME = r'<p:graphicFrame>(?:(?!</p:graphicFrame>).)*?<a:tblPr rtl="1"(?:(?!</p:graphicFrame>).)*?</p:graphicFrame>'

def visual_order(f):
    assert 'gridSpan' not in f and 'hMerge' not in f
    f = f.replace('<a:tblPr rtl="1" ', '<a:tblPr ').replace('<a:tblPr rtl="1"/>', '<a:tblPr/>')
    grid = re.search(r'<a:tblGrid>(.*?)</a:tblGrid>', f, re.S)
    cols = re.findall(r'<a:gridCol [^>]*?(?:/>|>.*?</a:gridCol>)', grid.group(1), re.S)
    f = f[:grid.start(1)] + ''.join(reversed(cols)) + f[grid.end(1):]
    def row(m):
        tr = m.group(0)
        head = re.match(r'<a:tr[^>]*>', tr).group(0)
        cells = re.findall(r'<a:tc>.*?</a:tc>', tr, re.S)
        rest = tr[len(head):]
        tail = rest[rest.rfind('</a:tc>') + len('</a:tc>'):]
        return head + ' '.join(reversed(cells)) + tail
    return re.sub(r'<a:tr[ >].*?</a:tr>', row, f, flags=re.S)

def move(fn):
    def frame(f):
        off = re.search(r'<p:xfrm><a:off x="(\d+)" y="(\d+)"/><a:ext cx="(\d+)"', f)
        x, cx = int(off.group(1)), int(off.group(3))
        return f.replace(off.group(0), off.group(0).replace(f'x="{x}"', f'x="{fn(x, cx)}"', 1), 1)
    return frame

def per_frame(fn):
    return lambda s: re.sub(FRAME, lambda m: fn(m.group(0)), s, flags=re.S)

LOOK = ('slides 1 (ar) and 2 (he): where the table lands (preview: right half, 489-917 pt; 0.36.0 in Keynote: 61-489 pt, over the chart) '
        'and its column order (first logical column at the right); probe.json table position x and cells; back.pptx a:off x and a:tblPr rtl')
g.control('a-exported', SRC, LOOK, 'as exported: table frame a:off x=6210300 cx=5433060, a:tblPr rtl="1", grid in logical order')
g.variant('b-ltr-visual-order', SRC, {s: per_frame(visual_order) for s in SLIDES},
          'rtl="1" removed from a:tblPr, a:gridCol and the a:tc of every row reversed (visual order); cell paragraphs keep rtl="1"; frame unchanged', LOOK, 'rtl-table/a-exported')
g.variant('c1-rtl-x-right-edge', SRC, {s: per_frame(move(lambda x, cx: x + cx)) for s in SLIDES},
          'rtl kept; a:off x = x + cx (11643360): if Keynote reads x as the right edge, the table lands at 489-917 pt', LOOK, 'rtl-table/a-exported')
g.variant('c2-rtl-x-mirrored', SRC, {s: per_frame(move(lambda x, cx: SW - x - cx)) for s in SLIDES},
          f'rtl kept; frame mirrored about the slide center: a:off x = {SW} - x - cx (548640)', LOOK, 'rtl-table/a-exported')
g.write()
