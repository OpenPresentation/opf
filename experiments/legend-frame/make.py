"""legend-frame (LY-03, MX-07): a right legend with long series names leaves the chart frame in Keynote (layouts-lots
slides 31 and 36, chart2/chart3: legendPos r, automatic layout) or is cut at the frame (m-charts slide 5, chart7, pie:
"Europe, Middle East and Africa").
(b) lots charts 2, 3: legendPos b; (c1) lots charts 2, 3: a manual legend layout inside the frame (edge x 0.62 y 0.05
w 0.37 h 0.9), plot automatic; (c2) c1 plus a manual inner plot left of it (x 0.1 y 0.05 w 0.48 h 0.8);
(d) m-charts chart7: manual legend layout x 0.62 w 0.37 (y 0.05 h 0.9); its inner plot already ends at 0.49, kept."""
import re, sys
sys.path.insert(0, '/Users/michael/opf-work/keynote-036/experiments/_lib')
from xv import Group, W
LOTS = f'{W}/build/036/layouts/layouts-lots/default.pptx'
MCH = f'{W}/build/036/matrix/m-charts/default.pptx'
LEG = '<c:layout><c:manualLayout><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="0.62"/><c:y val="0.05"/><c:w val="0.37"/><c:h val="0.9"/></c:manualLayout></c:layout>'
PLOT = '<c:layout><c:manualLayout><c:layoutTarget val="inner"/><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="0.1"/><c:y val="0.05"/><c:w val="0.48"/><c:h val="0.8"/></c:manualLayout></c:layout>'
def legend_layout(x):
    assert x.count('<c:legend><c:legendPos val="r"/><c:overlay') == 1
    return x.replace('<c:legend><c:legendPos val="r"/><c:overlay', f'<c:legend><c:legendPos val="r"/>{LEG}<c:overlay')
def plot(x):
    assert x.count('<c:plotArea><c:layout/>') == 1
    return x.replace('<c:plotArea><c:layout/>', f'<c:plotArea>{PLOT}')
def bottom(x):
    assert x.count('<c:legendPos val="r"/>') == 1
    return x.replace('<c:legendPos val="r"/>', '<c:legendPos val="b"/>')
CH = ['ppt/charts/chart2.xml', 'ppt/charts/chart3.xml']
g = Group('legend-frame')
LOOK = 'slides 31 and 36: legend inside the chart frame (slide 31: not over the list at the right; slide 36: entries not cut "(thous"); plot size; back.pptx legend layout/legendPos kept'
g.control('lots-a-exported', LOTS, LOOK, 'layouts-lots default as exported: chart2 (slide 31), chart3 (slide 36) legendPos r, no manual layout')
g.variant('lots-b-legend-bottom', LOTS, {c: bottom for c in CH}, 'charts 2, 3: legendPos b', LOOK, 'legend-frame/lots-a-exported')
g.variant('lots-c1-legend-manual', LOTS, {c: legend_layout for c in CH}, 'charts 2, 3: legend manualLayout edge x 0.62 y 0.05 w 0.37 h 0.9; plot automatic', LOOK, 'legend-frame/lots-a-exported')
g.variant('lots-c2-legend-and-plot-manual', LOTS, {c: (lambda x: plot(legend_layout(x))) for c in CH}, 'c1 plus plot inner manualLayout x 0.1 y 0.05 w 0.48 h 0.8', LOOK, 'legend-frame/lots-c1-legend-manual')
LOOK7 = 'slide 5 (right chart, pie): legend entry "Europe, Middle East and Africa" whole or wrapped inside the frame; back.pptx chart7 legend layout'
g.control('mcharts-a-exported', MCH, LOOK7, 'm-charts default as exported: chart7 legendPos r, no legend layout, inner plot x 0.0424 w 0.4477')
g.variant('mcharts-d-legend-manual', MCH, {'ppt/charts/chart7.xml': legend_layout}, 'chart7: legend manualLayout edge x 0.62 y 0.05 w 0.37 h 0.9 (plot unchanged; it ends at 0.49)', LOOK7, 'legend-frame/mcharts-a-exported')
g.write()
