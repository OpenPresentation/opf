// OPF chart type ids -> native PowerPoint chart constructs (FF-22).
//
// The core catalog keeps one chart type per Aspose.Slides ChartType
// (spec/catalogs/chart-types, OpenPresentation/opf#121) and deprecates the
// rest with a replacement id. The published core package this exporter
// depends on predates that metadata, so the mapping is carried here. Kept ids
// map to the exact Office construct; deprecated ids resolve to their
// replacement; any other id keeps the legacy substring heuristic.

const category = (pptx, extra = {}) => ({ family: 'category', pptx, ...extra });

export const CHART_TYPES = Object.freeze({
  column: category('bar', { aspose: 'ClusteredColumn', barDir: 'col', grouping: 'clustered' }),
  'stacked-column-3x': category('bar', { aspose: 'StackedColumn', barDir: 'col', grouping: 'stacked' }),
  '100pct-stacked-column-3x': category('bar', { aspose: 'PercentsStackedColumn', barDir: 'col', grouping: 'percentStacked' }),
  bar: category('bar', { aspose: 'ClusteredBar', barDir: 'bar', grouping: 'clustered' }),
  'stacked-bar-3x': category('bar', { aspose: 'StackedBar', barDir: 'bar', grouping: 'stacked' }),
  '100pct-stacked-bar-3x': category('bar', { aspose: 'PercentsStackedBar', barDir: 'bar', grouping: 'percentStacked' }),
  line: category('line', { aspose: 'Line', grouping: 'standard', markers: false }),
  'line-with-markers': category('line', { aspose: 'LineWithMarkers', grouping: 'standard', markers: true }),
  'stacked-line-3x': category('line', { aspose: 'StackedLine', grouping: 'stacked', markers: false }),
  'stacked-line-with-markers-3x': category('line', { aspose: 'StackedLineWithMarkers', grouping: 'stacked', markers: true }),
  area: category('area', { aspose: 'Area', grouping: 'standard' }),
  'stacked-area-3x': category('area', { aspose: 'StackedArea', grouping: 'stacked' }),
  '100pct-stacked-area-3x': category('area', { aspose: 'PercentsStackedArea', grouping: 'percentStacked' }),
  pie: { family: 'circular', pptx: 'pie', aspose: 'Pie' },
  doughnut: { family: 'circular', pptx: 'doughnut', aspose: 'Doughnut' },
  scatter: { family: 'xy', pptx: 'scatter', aspose: 'ScatterWithMarkers' },
  radar: category('radar', { aspose: 'Radar', radarStyle: 'standard', markers: false }),
  'radar-with-markers': category('radar', { aspose: 'RadarWithMarkers', radarStyle: 'marker', markers: true }),
  'filled-radar': category('radar', { aspose: 'FilledRadar', radarStyle: 'filled', markers: false }),
  // Office 2016 chartex constructs (cx:chartSpace, one cx:series per plot,
  // named by layoutId). `requires` is the markup-compatibility namespace the
  // slide's mc:Choice names, so older readers take the classic fallback.
  // `series` is the number of value columns the construct plots.
  treemap: chartex('treemap', 'Treemap', { requires: 'cx1', dimension: 'size', series: 1 }),
  histogram: chartex('clusteredColumn', 'Histogram', { requires: 'cx1', binning: true, series: 1, axes: true }),
  pareto: chartex('paretoLine', 'ParetoLine', { requires: 'cx1', binning: true, owner: 'clusteredColumn', series: 1, axes: true }),
  'box-and-whisker': chartex('boxWhisker', 'BoxAndWhisker', { requires: 'cx1', series: Infinity, axes: true }),
  waterfall: chartex('waterfall', 'Waterfall', { requires: 'cx1', series: 1, axes: true }),
  funnel: chartex('funnel', 'Funnel', { requires: 'cx2', series: 1, axes: true }),
  // Native check 2026-09-30: PowerPoint accepts the regionMap part only when the choice requires cx4 (2016/5/10, the
  // region-map extension namespace; cx5 and cx8 fall back), reports ChartType 140, and then draws nothing without a
  // populated cx:geoCache ("There was a problem getting the information for your map chart"), so the map stays on the
  // clustered column fallback in 'auto' mode and is written only with `chartex: 'native'`.
  world: chartex('regionMap', 'Map', { requires: 'cx4', dimension: 'colorVal', series: 1, unconfirmed: true }),
});

function chartex(layoutId, aspose, extra) {
  return { family: 'chartex', layoutId, aspose, dimension: 'val', ...extra };
}

// The classic construct written as the mc:Fallback of every chartex chart, so a
// reader without chartex support shows a clustered column chart of the same
// workbook data.
export const CHARTEX_FALLBACK = CHART_TYPES.column;

// Markup-compatibility namespaces for `requires` (MS-ODRAWXML chartex
// versions). PowerPoint 2016 and later understand all of them.
export const CHARTEX_NAMESPACES = Object.freeze({
  cx: 'http://schemas.microsoft.com/office/drawing/2014/chartex',
  cx1: 'http://schemas.microsoft.com/office/drawing/2015/9/8/chartex',
  cx2: 'http://schemas.microsoft.com/office/drawing/2015/10/21/chartex',
  cx3: 'http://schemas.microsoft.com/office/drawing/2016/5/9/chartex',
  cx4: 'http://schemas.microsoft.com/office/drawing/2016/5/10/chartex',
  cx5: 'http://schemas.microsoft.com/office/drawing/2016/5/11/chartex',
});

// cx:series layoutIds of a chartex part (an owned paretoLine marks the Office
// Pareto chart) -> kept OPF id, for import; null for sunburst and unknown layouts.
export function chartTypeFromChartex(layoutIds) {
  const ids = new Set(layoutIds);
  if (ids.has('paretoLine')) return 'pareto';
  for (const [id, spec] of Object.entries(CHART_TYPES)) if (spec.family === 'chartex' && ids.has(spec.layoutId)) return id;
  return null;
}

const variants = (base, target) => Object.fromEntries([base, `${base}-2x`, `${base}-3x`].map((id) => [id, target]));

// Deprecated core ids (opf 0.12.0 removes them) -> replacement id.
export const DEPRECATED_CHART_TYPES = Object.freeze({
  ...variants('100pct-bullet-bar', '100pct-stacked-bar-3x'),
  '100pct-progress-bar': '100pct-stacked-bar-3x',
  '100pct-stacked-bar-2x': '100pct-stacked-bar-3x',
  ...variants('100pct-bullet-column', '100pct-stacked-column-3x'),
  '100pct-stacked-column-2x': '100pct-stacked-column-3x',
  '100pct-stacked-area-2x': '100pct-stacked-area-3x',
  australia: 'world',
  canada: 'world',
  'united-kingdom': 'world',
  'united-states': 'world',
  'box-and-whisker-2x': 'box-and-whisker',
  'box-and-whisker-3x': 'box-and-whisker',
  ...variants('bullet-bar', 'bar'),
  'clustered-bar-2x': 'bar',
  ...variants('bullet-column', 'column'),
  'clustered-column': 'column',
  ...Object.fromEntries(['', '-2x', '-3x', '-4x', '-5x', '-6x'].map((suffix) => [`dot-plot${suffix}`, 'scatter'])),
  dumbbell: 'scatter',
  'line-2x': 'line',
  'line-3x': 'line',
  'line-with-high-low': 'line',
  ...Object.fromEntries(['', '-2x', '-3x', '-4x', '-5x', '-6x'].map((suffix) => [`sparkline${suffix}`, 'line'])),
  'line-with-high-low-and-markers': 'line-with-markers',
  'line-with-markers-2x': 'line-with-markers',
  'line-with-markers-3x': 'line-with-markers',
  'stacked-area-2x': 'stacked-area-3x',
  'stacked-bar-2x': 'stacked-bar-3x',
  'stacked-column-2x': 'stacked-column-3x',
  'stacked-line-2x': 'stacked-line-3x',
  'stacked-line-with-markers-2x': 'stacked-line-with-markers-3x',
  'treemap-2x': 'treemap',
  'treemap-3x': 'treemap',
});

const ALIASES = Object.freeze({ donut: 'doughnut' });

// Resolve an OPF chart type id to {id, spec}. Kept and deprecated ids resolve
// to a kept id; anything else returns the legacy heuristic with id: null.
export function resolveChartType(type) {
  const raw = String(type ?? '').trim().toLowerCase();
  const id = ALIASES[raw] ?? DEPRECATED_CHART_TYPES[raw] ?? raw;
  if (Object.hasOwn(CHART_TYPES, id)) return { id, spec: CHART_TYPES[id] };
  return { id: null, spec: legacyChartType(raw) };
}

// The pre-FF-22 heuristic for ids outside the core catalog.
function legacyChartType(normalized) {
  if (normalized.includes('pie')) return CHART_TYPES.pie;
  if (normalized.includes('doughnut') || normalized.includes('donut')) return CHART_TYPES.doughnut;
  if (normalized.includes('area')) return { ...CHART_TYPES.area, legacy: true };
  if (normalized.includes('line')) return { ...CHART_TYPES['line-with-markers'], legacy: true };
  if (normalized.includes('scatter')) return CHART_TYPES.scatter;
  if (normalized.includes('radar')) return { ...CHART_TYPES.radar, legacy: true };
  const grouping = normalized.includes('stacked') ? 'stacked' : 'clustered';
  return category('bar', { barDir: normalized.includes('bar') ? 'bar' : 'col', grouping, legacy: true });
}

// Native construct -> kept OPF id, for import. `node` is the parsed chart-type
// element (fast-xml-parser, attributes as plain keys).
export function chartTypeFromNative(element, node) {
  const attr = (name) => node?.[`c:${name}`]?.val;
  const series = asArray(node?.['c:ser']);
  const markers = !series.length || series.some((ser) => ser?.['c:marker']?.['c:symbol']?.val !== 'none');
  const grouping = attr('grouping') ?? 'standard';
  const stacked = grouping === 'stacked' || grouping === 'percentStacked';
  const percent = grouping === 'percentStacked';
  switch (element) {
    case 'barChart':
    case 'bar3DChart': {
      const direction = attr('barDir') === 'bar' ? 'bar' : 'column';
      if (percent) return `100pct-stacked-${direction}-3x`;
      if (stacked) return `stacked-${direction}-3x`;
      return direction;
    }
    case 'lineChart':
    case 'line3DChart':
      if (stacked) return markers ? 'stacked-line-with-markers-3x' : 'stacked-line-3x';
      return markers ? 'line-with-markers' : 'line';
    case 'areaChart':
    case 'area3DChart':
      return percent ? '100pct-stacked-area-3x' : stacked ? 'stacked-area-3x' : 'area';
    case 'pieChart':
    case 'pie3DChart':
    case 'ofPieChart':
      return 'pie';
    case 'doughnutChart':
      return 'doughnut';
    case 'scatterChart':
      return 'scatter';
    case 'radarChart': {
      const style = attr('radarStyle');
      if (style === 'filled') return 'filled-radar';
      if (style === 'marker' && markers) return 'radar-with-markers';
      return 'radar';
    }
    default:
      return null;
  }
}

export const NATIVE_CHART_ELEMENTS = Object.freeze([
  'barChart', 'bar3DChart', 'lineChart', 'line3DChart', 'pieChart', 'pie3DChart', 'ofPieChart',
  'doughnutChart', 'areaChart', 'area3DChart', 'scatterChart', 'radarChart',
]);

function asArray(value) {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

// PptxGenJS omits or cannot express parts of these constructs. Rewrite only
// the generated chart-type element so the part states the exact grouping.
export function applyChartConstruct(xml, spec) {
  // ScatterWithMarkers: the core catalog records scatterStyle "marker" (markers, no connecting line). PptxGenJS writes lineMarker and relies on the series line being noFill.
  if (spec?.family === 'xy') return xml.replace(/<c:scatterStyle val="[^"]*"\/>/, '<c:scatterStyle val="marker"/>');
  if (!spec || spec.family !== 'category') return xml;
  const element = { bar: 'barChart', line: 'lineChart', area: 'areaChart', radar: 'radarChart' }[spec.pptx];
  if (!element || element === 'radarChart') return xml;
  const open = `<c:${element}>`;
  const start = xml.indexOf(open);
  if (start < 0) return xml;
  const end = xml.indexOf(`</c:${element}>`, start);
  let body = xml.slice(start + open.length, end);
  const grouping = `<c:grouping val="${spec.grouping}"/>`;
  if (element === 'barChart') {
    body = body.replace(/<c:grouping val="[^"]*"\/>/, grouping);
  } else {
    body = grouping + body.replace(/<c:grouping val="[^"]*"\/>/g, '');
    // CT_LineSer/CT_AreaSer have no invertIfNegative (bar series only).
    body = body.replace(/<c:invertIfNegative val="[^"]*"\/>/g, '');
  }
  if (spec.grouping === 'stacked' || spec.grouping === 'percentStacked') {
    body = body.replace(/<c:overlap val="[^"]*"\/>/, '<c:overlap val="100"/>');
  }
  return xml.slice(0, start) + open + body + xml.slice(end);
}
