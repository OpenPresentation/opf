"""plot-area (MX-02): m-negative-bars slide 8 (chart8.xml), all-positive horizontal bars with a manual OUTER plot area;
Keynote cuts the category names at the left ("ranes", "tware"). Slides 1-6 (negative range) get an INNER plot from
lowLabelPlot (packages/pptx/src/index.js:4001, called at :4199 only when the value minimum is below 0).
(b) inner plot as lowLabelPlot's non-whole branch would write it: left = the names' inset, top/right/bottom = the outer
box. Slide 8 has the same names, frame, font and labels as slide 1, so the inset is slide 1's: chart1.xml writes
x 0.0877 y 0.0777 w 0.9037 h 0.9029 (= 0.0086 + 0.9828 - 0.0877) (inferred equal; not computed by OPF for slide 8).
(c) no manual layout (c:layout empty): Keynote's automatic plot."""
import re, sys
sys.path.insert(0, '/Users/michael/opf-work/keynote-036/experiments/_lib')
from xv import Group, W
SRC = f'{W}/build/036/matrix/m-negative-bars/default.pptx'
C = 'ppt/charts/chart8.xml'
OUTER = '<c:layout><c:manualLayout><c:layoutTarget val="outer"/><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="0.0086"/><c:y val="0.0777"/><c:w val="0.9828"/><c:h val="0.9029"/></c:manualLayout></c:layout>'
INNER = '<c:layout><c:manualLayout><c:layoutTarget val="inner"/><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="0.0877"/><c:y val="0.0777"/><c:w val="0.9037"/><c:h val="0.9029"/></c:manualLayout></c:layout>'
def rep(new):
    def fn(x):
        assert x.count(OUTER) == 1
        return x.replace(OUTER, new)
    return fn
g = Group('plot-area')
LOOK = 'slide 8: category names "Cranes", "Software", "Leasing", "Repairs" whole at the left of the bars (a: "ranes", "tware"); plot size against slide 1; back.pptx chart8 c:plotArea/c:layout'
g.control('a-exported', SRC, LOOK, 'as exported: chart8 manualLayout layoutTarget outer x 0.0086 y 0.0777 w 0.9828 h 0.9029')
g.variant('b-inner', SRC, {C: rep(INNER)}, 'chart8: layoutTarget inner x 0.0877 y 0.0777 w 0.9037 h 0.9029 (slide 1\'s inner box)', LOOK, 'plot-area/a-exported')
g.variant('c-automatic', SRC, {C: rep('<c:layout/>')}, 'chart8: no manual layout (empty c:layout)', LOOK, 'plot-area/a-exported')
g.write()
