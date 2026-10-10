// FA-15: child element order of the DrawingML chart types a classic chart part uses (ECMA-376 Part 1, dml-chart.xsd); opf-pptx#175
// added the area, radar, scatter, pie and doughnut groups, their series types and the data point. Stricter consumers (the Open XML
// SDK validator, LibreOffice, Keynote) reject a chart part whose children are out of sequence, so exports are checked against them:
// every child must be a known member of its parent's sequence, in non-decreasing sequence position, and required members present.
// A name in a group (the chart types of CT_PlotArea, the axes, crosses/crossesAt) shares one position.

const CHART_TYPES = ['areaChart', 'area3DChart', 'lineChart', 'line3DChart', 'stockChart', 'radarChart', 'scatterChart', 'pieChart', 'pie3DChart', 'doughnutChart', 'barChart', 'bar3DChart', 'ofPieChart', 'surfaceChart', 'surface3DChart', 'bubbleChart'];
const AXES = ['valAx', 'catAx', 'dateAx', 'serAx'];
const SER_SHARED = ['idx', 'order', 'tx', 'spPr'];
const AXIS_SHARED = ['axId', 'scaling', 'delete', 'axPos', 'majorGridlines', 'minorGridlines', 'title', 'numFmt', 'majorTickMark', 'minorTickMark', 'tickLblPos', 'spPr', 'txPr', 'crossAx', ['crosses', 'crossesAt']];

export const SEQUENCES = {
  chart: { order: ['title', 'autoTitleDeleted', 'pivotFmts', 'view3D', 'floor', 'sideWall', 'backWall', 'plotArea', 'legend', 'plotVisOnly', 'dispBlanksAs', 'showDLblsOverMax', 'extLst'], required: ['plotArea'] },
  plotArea: { order: ['layout', CHART_TYPES, AXES, 'dTable', 'spPr', 'extLst'], required: [CHART_TYPES] },
  barChart: { order: ['barDir', 'grouping', 'varyColors', 'ser', 'dLbls', 'gapWidth', 'overlap', 'serLines', 'axId', 'extLst'], required: ['barDir', 'axId'] },
  lineChart: { order: ['grouping', 'varyColors', 'ser', 'dLbls', 'dropLines', 'hiLowLines', 'upDownBars', 'marker', 'smooth', 'axId', 'extLst'], required: ['grouping', 'axId'] },
  areaChart: { order: ['grouping', 'varyColors', 'ser', 'dLbls', 'dropLines', 'axId', 'extLst'], required: ['axId'] },
  radarChart: { order: ['radarStyle', 'varyColors', 'ser', 'dLbls', 'axId', 'extLst'], required: ['radarStyle', 'axId'] },
  scatterChart: { order: ['scatterStyle', 'varyColors', 'ser', 'dLbls', 'axId', 'extLst'], required: ['scatterStyle', 'axId'] },
  pieChart: { order: ['varyColors', 'ser', 'dLbls', 'firstSliceAng', 'extLst'], required: [] },
  doughnutChart: { order: ['varyColors', 'ser', 'dLbls', 'firstSliceAng', 'holeSize', 'extLst'], required: [] },
  barSer: { order: [...SER_SHARED, 'invertIfNegative', 'pictureOptions', 'dPt', 'dLbls', 'trendline', 'errBars', 'cat', 'val', 'shape', 'extLst'], required: ['idx', 'order'] },
  lineSer: { order: [...SER_SHARED, 'marker', 'dPt', 'dLbls', 'trendline', 'errBars', 'cat', 'val', 'smooth', 'extLst'], required: ['idx', 'order'] },
  areaSer: { order: [...SER_SHARED, 'pictureOptions', 'dPt', 'dLbls', 'trendline', 'errBars', 'cat', 'val', 'extLst'], required: ['idx', 'order'] },
  radarSer: { order: [...SER_SHARED, 'marker', 'dPt', 'dLbls', 'cat', 'val', 'extLst'], required: ['idx', 'order'] },
  scatterSer: { order: [...SER_SHARED, 'marker', 'dPt', 'dLbls', 'trendline', 'errBars', 'xVal', 'yVal', 'smooth', 'extLst'], required: ['idx', 'order'] },
  pieSer: { order: [...SER_SHARED, 'explosion', 'dPt', 'dLbls', 'cat', 'val', 'extLst'], required: ['idx', 'order'] },
  dPt: { order: ['idx', 'invertIfNegative', 'marker', 'bubble3D', 'explosion', 'spPr', 'pictureOptions', 'extLst'], required: ['idx'] },
  dLbls: { order: ['dLbl', 'delete', 'numFmt', 'spPr', 'txPr', 'dLblPos', 'showLegendKey', 'showVal', 'showCatName', 'showSerName', 'showPercent', 'showBubbleSize', 'separator', 'showLeaderLines', 'leaderLines', 'extLst'], required: [] },
  catAx: { order: [...AXIS_SHARED, 'auto', 'lblAlgn', 'lblOffset', 'tickLblSkip', 'tickMarkSkip', 'noMultiLvlLbl', 'extLst'], required: ['axId', 'scaling', 'axPos', 'crossAx'] },
  valAx: { order: [...AXIS_SHARED, 'crossBetween', 'majorUnit', 'minorUnit', 'dispUnits', 'extLst'], required: ['axId', 'scaling', 'axPos', 'crossAx'] },
  scaling: { order: ['logBase', 'orientation', 'max', 'min', 'extLst'], required: [] },
  legend: { order: ['legendPos', 'legendEntry', 'layout', 'overlay', 'spPr', 'txPr', 'extLst'], required: [] },
  marker: { order: ['symbol', 'size', 'spPr', 'extLst'], required: [] },
};

// The series type (CT_*Ser) of each chart group; a pie and a doughnut share CT_PieSer.
const SERIES_TYPES = { barChart: 'barSer', lineChart: 'lineSer', areaChart: 'areaSer', radarChart: 'radarSer', scatterChart: 'scatterSer', pieChart: 'pieSer', doughnutChart: 'pieSer' };

/** A minimal element tree of well-formed generated XML: {name, children}. Text, comments and attributes are ignored. */
export function elementTree(xml) {
  const root = { name: '#root', children: [] };
  const stack = [root];
  for (const [, close, name, selfClose] of xml.matchAll(/<(\/?)([A-Za-z_][\w.:-]*)\b[^>]*?(\/?)>/g)) {
    if (name.startsWith('?')) continue;
    if (close) { stack.pop(); continue; }
    const node = { name, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root;
}

const local = (name) => name.replace(/^c:/, '');
const rank = (sequence, name) => sequence.findIndex((entry) => Array.isArray(entry) ? entry.includes(name) : entry === name);

/** Every order problem in a chart part (`c:` children of the checked types), as readable strings; [] when the part is in order. */
export function chartOrderProblems(xml) {
  const problems = [];
  const visit = (node, path, parentType) => {
    const name = node.name.startsWith('c:') ? local(node.name) : null;
    let type = name && SEQUENCES[name] ? name : null;
    if (name === 'ser') type = SERIES_TYPES[parentType] ?? null;
    if (name === 'marker' && parentType === 'lineChart') type = null; // CT_Boolean <c:marker val="1"/> on the chart group
    const here = `${path}/${node.name}`;
    if (type) {
      const { order, required } = SEQUENCES[type];
      let last = -1;
      for (const child of node.children) {
        if (!child.name.startsWith('c:')) { problems.push(`${here}: foreign child ${child.name}`); continue; }
        const position = rank(order, local(child.name));
        if (position < 0) { problems.push(`${here}: unexpected ${child.name}`); continue; }
        if (position < last) problems.push(`${here}: ${child.name} is out of order`);
        last = Math.max(last, position);
      }
      for (const entry of required) {
        const names = Array.isArray(entry) ? entry : [entry];
        if (!node.children.some((child) => names.includes(local(child.name)))) problems.push(`${here}: missing ${names.join('|')}`);
      }
    }
    for (const child of node.children) visit(child, here, name ?? parentType);
  };
  visit(elementTree(xml), '', null);
  return problems;
}
