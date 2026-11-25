"""tick-skip (MX-04): m-negative-bars slide 5 (chart5.xml), a column chart with four long category names; Keynote draws
every other name, each on one line. (b) c:tickLblSkip 1 on c:catAx; (c) b plus a line break in each category name of
the cache (c:strCache only; the embedded workbook keeps the one-line names)."""
import re, sys
sys.path.insert(0, '/Users/michael/opf-work/keynote-036/experiments/_lib')
from xv import Group, W
SRC = f'{W}/build/036/matrix/m-negative-bars/default.pptx'
C = 'ppt/charts/chart5.xml'
def skip(x):
    assert '<c:tickLblSkip' not in x
    return re.sub(r'(<c:catAx>.*?)(\s*<c:noMultiLvlLbl )', r'\1<c:tickLblSkip val="1"/>\2', x, count=1, flags=re.S)
def breaks(x):
    def cat(m):
        def pt(q):
            words = q.group(2).split(' ')
            h = (len(words) + 1) // 2
            return f'{q.group(1)}{" ".join(words[:h])}\n{" ".join(words[h:])}</c:v>'
        return re.sub(r'(<c:pt idx="\d+"><c:v>)([^<]*)</c:v>', pt, m.group(0))
    return re.sub(r'<c:cat>.*?</c:cat>', cat, x, flags=re.S)
g = Group('tick-skip')
LOOK = 'slide 5: how many of the four category names Keynote draws (a: 2 of 4) and on how many lines; back.pptx chart5 c:tickLblSkip kept?'
g.control('a-exported', SRC, LOOK, 'as exported: chart5 c:catAx without c:tickLblSkip')
g.variant('b-ticklblskip-1', SRC, {C: skip}, 'chart5: <c:tickLblSkip val="1"/> in c:catAx (before c:noMultiLvlLbl, schema order)', LOOK, 'tick-skip/a-exported')
g.variant('c-ticklblskip-1-linebreaks', SRC, {C: lambda x: breaks(skip(x))}, 'b plus each category name split in two lines with a newline in c:strCache c:v ("Container cranes\\nand straddle carriers")', LOOK, 'tick-skip/b-ticklblskip-1')
g.write()
