// opf-pptx#175: the classic chart series in ECMA-376 schema order (Part 1, dml-chart.xsd).
//
// pptxgenjs-plus 4.3.4 writes a line series' c:dLbls before its c:marker, and gives radar series the bar-only
// c:invertIfNegative; the scatter X axis (a c:valAx) carries the category-axis-only c:auto, c:lblAlgn and c:noMultiLvlLbl.
// PowerPoint opens these parts, but stricter consumers (the Open XML SDK validator, LibreOffice, Keynote) may not. This runs
// last on each generated chart part, after every other chart rewrite: a series whose children are already in sequence keeps
// its bytes, and only a series that needs it is rebuilt (stable, so repeated c:dPt keep their order).

const SHARED = ['idx', 'order', 'tx', 'spPr'];
const BAR = [...SHARED, 'invertIfNegative', 'pictureOptions', 'dPt', 'dLbls', 'trendline', 'errBars', 'cat', 'val', 'shape', 'extLst'];
const LINE = [...SHARED, 'marker', 'dPt', 'dLbls', 'trendline', 'errBars', 'cat', 'val', 'smooth', 'extLst'];
const AREA = [...SHARED, 'pictureOptions', 'dPt', 'dLbls', 'trendline', 'errBars', 'cat', 'val', 'extLst'];
const RADAR = [...SHARED, 'marker', 'dPt', 'dLbls', 'cat', 'val', 'extLst'];
const SCATTER = [...SHARED, 'marker', 'dPt', 'dLbls', 'trendline', 'errBars', 'xVal', 'yVal', 'smooth', 'extLst'];
const PIE = [...SHARED, 'explosion', 'dPt', 'dLbls', 'cat', 'val', 'extLst'];

/** The CT_*Ser child sequence of each classic chart group. */
export const SERIES_SEQUENCES = Object.freeze({
  barChart: BAR, bar3DChart: BAR,
  lineChart: LINE, line3DChart: LINE,
  areaChart: AREA, area3DChart: AREA,
  radarChart: RADAR,
  scatterChart: SCATTER,
  pieChart: PIE, pie3DChart: PIE, doughnutChart: PIE, ofPieChart: PIE,
});

// The top-level children of an element body, each with the whitespace before it: [{name, text}], or null when the body is
// not a plain run of elements (text content, comments or an unbalanced tag), which is then left alone.
function children(body) {
  const out = [];
  const tag = /<(\/?)([A-Za-z_][\w.:-]*)\b[^>]*?(\/?)>/g;
  let depth = 0, start = 0, name = null, match;
  while ((match = tag.exec(body))) {
    const [, close, tagName, selfClose] = match;
    if (depth === 0) {
      if (close || body.slice(start, match.index).trim()) return null;
      name = tagName;
    }
    if (close) depth--;
    else if (!selfClose) depth++;
    if (depth < 0) return null;
    if (depth === 0) {
      out.push({name, text: body.slice(start, tag.lastIndex)});
      start = tag.lastIndex;
    }
  }
  if (depth !== 0 || body.slice(start).trim()) return null;
  return {items: out, tail: body.slice(start)};
}

function orderSeries(ser, sequence) {
  const body = ser.slice('<c:ser>'.length, -'</c:ser>'.length);
  const parsed = children(body);
  if (!parsed || parsed.items.some(item => !item.name.startsWith('c:'))) return ser;
  const rank = item => sequence.indexOf(item.name.slice(2));
  // A child the series type does not define (c:invertIfNegative in a radar series) is dropped; the rest sort stably by rank.
  const kept = parsed.items.filter(item => rank(item) >= 0);
  const ordered = kept.map((item, position) => ({item, position, rank: rank(item)}))
    .sort((a, b) => a.rank - b.rank || a.position - b.position)
    .map(entry => entry.item);
  if (kept.length === parsed.items.length && ordered.every((item, index) => item === parsed.items[index])) return ser;
  return `<c:ser>${ordered.map(item => item.text).join('')}${parsed.tail}</c:ser>`;
}

// CT_ValAx has no c:auto, c:lblAlgn or c:noMultiLvlLbl (they belong to CT_CatAx); the generator writes them on the scatter X axis.
const CATEGORY_AXIS_ONLY = /\s*<c:(?:auto|lblAlgn|noMultiLvlLbl)\b[^>]*\/>/g;

/** Every classic chart series of a chart part in its CT_*Ser sequence, and every c:valAx without category-axis children. */
export function orderChartSeries(xml) {
  let out = xml;
  for (const [group, sequence] of Object.entries(SERIES_SEQUENCES)) {
    if (!out.includes(`<c:${group}>`)) continue;
    out = out.replace(new RegExp(`<c:${group}>[\\s\\S]*?</c:${group}>`, 'g'), block => block.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, ser => orderSeries(ser, sequence)));
  }
  return out.replace(/<c:valAx>[\s\S]*?<\/c:valAx>/g, axis => axis.replace(CATEGORY_AXIS_ONLY, ''));
}
