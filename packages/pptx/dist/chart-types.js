// OPF chart type ids -> native PowerPoint chart constructs (FF-22).
//
// The core catalog keeps one chart type per Aspose.Slides ChartType
// (spec/catalogs/chart-types, OpenPresentation/opf#121). The mapping is carried
// here so the exporter stays self-contained. Every id maps to the exact Office construct (OPF 0.15: chart.type is a
// schema enum, so there is no other id).

const category = (pptx, extra = {}) => ({ family: 'category', pptx, ...extra });

export const CHART_TYPES = Object.freeze({
  column: category('bar', { aspose: 'ClusteredColumn', barDir: 'col', grouping: 'clustered' }),
  'stacked-column': category('bar', { aspose: 'StackedColumn', barDir: 'col', grouping: 'stacked' }),
  '100pct-stacked-column': category('bar', { aspose: 'PercentsStackedColumn', barDir: 'col', grouping: 'percentStacked' }),
  bar: category('bar', { aspose: 'ClusteredBar', barDir: 'bar', grouping: 'clustered' }),
  'stacked-bar': category('bar', { aspose: 'StackedBar', barDir: 'bar', grouping: 'stacked' }),
  '100pct-stacked-bar': category('bar', { aspose: 'PercentsStackedBar', barDir: 'bar', grouping: 'percentStacked' }),
  line: category('line', { aspose: 'Line', grouping: 'standard', markers: false }),
  'line-with-markers': category('line', { aspose: 'LineWithMarkers', grouping: 'standard', markers: true }),
  'stacked-line': category('line', { aspose: 'StackedLine', grouping: 'stacked', markers: false }),
  'stacked-line-with-markers': category('line', { aspose: 'StackedLineWithMarkers', grouping: 'stacked', markers: true }),
  area: category('area', { aspose: 'Area', grouping: 'standard' }),
  'stacked-area': category('area', { aspose: 'StackedArea', grouping: 'stacked' }),
  '100pct-stacked-area': category('area', { aspose: 'PercentsStackedArea', grouping: 'percentStacked' }),
  pie: { family: 'circular', pptx: 'pie', aspose: 'Pie' },
  doughnut: { family: 'circular', pptx: 'doughnut', aspose: 'Doughnut' },
  scatter: { family: 'xy', pptx: 'scatter', aspose: 'ScatterWithMarkers' },
  radar: category('radar', { aspose: 'Radar', radarStyle: 'standard', markers: false }),
  'radar-with-markers': category('radar', { aspose: 'RadarWithMarkers', radarStyle: 'marker', markers: true }),
  'filled-radar': category('radar', { aspose: 'FilledRadar', radarStyle: 'filled', markers: false }),
  // FA-15: clustered columns (a c:barChart on the primary axes) with line series with markers (a c:lineChart per value axis;
  // the secondary one crosses at the right on a deleted second c:catAx). Core's resolveChartData says which series is which.
  combo: { family: 'combo', pptx: 'bar', aspose: 'ClusteredColumn', barDir: 'col', grouping: 'clustered', markers: true },
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

// Resolve an OPF chart type id to {id, spec}. `chart.type` is a schema enum in OPF 0.15 (core CHART_TYPES), so every
// validated document names one of these; an id outside the table (a caller that skipped validation) resolves to
// {id: null, spec: undefined}.
export function resolveChartType(type) {
  const id = String(type ?? '').trim();
  return Object.hasOwn(CHART_TYPES, id) ? { id, spec: CHART_TYPES[id] } : { id: null, spec: undefined };
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
      if (percent) return `100pct-stacked-${direction}`;
      if (stacked) return `stacked-${direction}`;
      return direction;
    }
    case 'lineChart':
    case 'line3DChart':
      if (stacked) return markers ? 'stacked-line-with-markers' : 'stacked-line';
      return markers ? 'line-with-markers' : 'line';
    case 'areaChart':
    case 'area3DChart':
      return percent ? '100pct-stacked-area' : stacked ? 'stacked-area' : 'area';
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

/**
 * A combo chart in a parsed c:plotArea: exactly one clustered (or standard) column c:barChart and one or two standard
 * c:lineChart groups, and no other chart group. Returns {bar, lines: [{node, secondary}]} (a line group is secondary when it
 * plots against an axis the column group does not use) or null for any other plot area.
 */
export function comboFromNative(plotArea) {
  if (!plotArea) return null;
  const bars = asArray(plotArea['c:barChart']);
  const lines = asArray(plotArea['c:lineChart']);
  if (bars.length !== 1 || lines.length < 1 || lines.length > 2) return null;
  if (NATIVE_CHART_ELEMENTS.some((element) => element !== 'barChart' && element !== 'lineChart' && plotArea[`c:${element}`] !== undefined)) return null;
  const [bar] = bars;
  if ((bar['c:barDir']?.val ?? 'col') !== 'col' || !['clustered', 'standard'].includes(bar['c:grouping']?.val ?? 'clustered')) return null;
  if (lines.some((line) => !['standard', undefined].includes(line['c:grouping']?.val))) return null;
  const axes = (node) => asArray(node['c:axId']).map((axis) => String(axis?.val));
  const primary = axes(bar);
  return { bar, lines: lines.map((node) => ({ node, secondary: axes(node).some((id) => !primary.includes(id)) })) };
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
  if (spec?.family === 'combo') return applyComboConstruct(xml);
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

// FA-15: PptxGenJS writes each c:lineChart of a multi-type chart without the c:grouping CT_LineChart requires, gives its series
// the bar-only c:invertIfNegative, and writes c:dLbls before c:marker (CT_LineSer orders marker, dPt, dLbls). Rewrite every line
// group of a combo chart into schema order; the c:barChart already states barDir and grouping.
export function applyComboConstruct(xml) {
  return xml.replace(/<c:lineChart>([\s\S]*?)<\/c:lineChart>/g, (_, body) => {
    let next = `<c:grouping val="standard"/>${body.replace(/<c:grouping val="[^"]*"\/>/g, '')}`;
    next = next.replace(/<c:invertIfNegative val="[^"]*"\/>/g, '');
    next = next.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (ser) => {
      const marker = /<c:marker>[\s\S]*?<\/c:marker>/.exec(ser)?.[0];
      const labels = /<c:dLbls>[\s\S]*?<\/c:dLbls>/.exec(ser);
      if (!marker || !labels || ser.indexOf(marker) < labels.index) return ser;
      const without = ser.replace(marker, '');
      return without.replace(/<c:dLbls>/, `${marker}<c:dLbls>`);
    });
    return `<c:lineChart>${next}</c:lineChart>`;
  });
}
