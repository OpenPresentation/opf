// FR-07 (CR 5): bands on value axes and the bullet chart, as native, editable PowerPoint chart parts.
//
// Export. A chart with bands gets one extra chart group, written by the vendored writer as a further chart type (so its series are
// ordinary workbook columns after the data, which Edit Data shows) and then rewritten here:
//   - bar and column charts: a stacked c:barChart (gap width 0, overlap 100, the data's c:barDir); line and area charts: a stacked c:areaChart;
//   - on a second pair of axes, both deleted, so the bands never stack with stacked data. The band axis runs from 0 to the primary axis's span
//     (its value v is the primary value min + v), so every band height is positive and stacks from the primary axis minimum, negative or not;
//   - drawn first: the group is moved before the data's group in c:plotArea;
//   - each band series is filled with its computed color (a:srgbClr), with no line, labels or markers; a band without a label has its legend
//     entry deleted. Each band series carries an `opf:band` extension, which the importer reads (never its name).
// A bullet chart's measure is a clustered c:barChart (gap width 200: a third of its row) on the primary axes; its target is a c:scatterChart
// series (x the target, y the row center 0.5, 1.5, ... on a deleted 0..n axis running from the top) without markers, whose fixed Y error
// bars draw the tick, on a third pair of deleted axes that share the value axis's bounds.
//
// Import. readNativeBands strips the owned band group, the target scatter group and their axes, and returns the ordinary chart XML with
// the bands and the targets it read (the native truth: band labels and ends from the cached heights; targets from the scatter's X cache).
import { XMLParser } from 'fast-xml-parser';
import { encodeTextTag, decodeTextTag } from './code-provenance.js';

export const BANDS_URI = 'urn:openpresentation:chart-bands:v1';
/** The vendored writer's axis ids (pptxgen.es.js), and the ids of the bullet target's own axes. */
const AXIS = Object.freeze({ value: '2094734552', valueSecondary: '2094734553', category: '2094734554', categorySecondary: '2094734555', targetX: '2094734560', targetY: '2094734561' });

const escape = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hex6 = (color) => String(color).replace(/^#/, '').slice(0, 6).toUpperCase();
const number = (value) => String(Number(Number(value).toPrecision(15)));
const ext = (name, record) => `<c:extLst><c:ext uri="${BANDS_URI}"><opf:${name} xmlns:opf="${BANDS_URI}" data="${encodeTextTag(record)}"/></c:ext></c:extLst>`;

/** Band series names: the label, or "Band n"; unique (ignoring case, as Excel table columns are) against the data series and the category heading. */
export function bandSeriesNames(bands, reserved = []) {
  const taken = new Set(reserved.filter((name) => typeof name === 'string').map((name) => name.toLowerCase()));
  return bands.map((band, position) => {
    const base = (band.label ?? `Band ${position + 1}`).replace(/\s+/g, ' ').trim().slice(0, 200) || `Band ${position + 1}`;
    let name = base;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} ${n}`;
    taken.add(name.toLowerCase());
    return name;
  });
}

/**
 * The band plan of a chart: core's sorted, clamped band ranges over its value axis, with fills, names and heights on the band axis. `ranges`
 * are core's chartBandRanges, `fills` their colors (#RRGGBB), `axis` the primary value axis ({min, max, majorUnit}).
 */
export function bandPlan(ranges, fills, axis, { reserved = [] } = {}) {
  if (!ranges.length || !axis || !(axis.max > axis.min)) return undefined;
  const names = bandSeriesNames(ranges, reserved);
  // The heights stack from the band axis's 0, which is the primary axis minimum; the first band's lower end is that minimum.
  return {
    axis: { min: axis.min, max: axis.max },
    span: axis.max - axis.min,
    bands: ranges.map((band, position) => ({ index: band.index, from: band.from, to: band.to, label: band.label, color: band.color, fill: hex6(fills[position]), name: names[position], height: band.to - band.from, offset: band.from - axis.min })),
  };
}

/** The chart type the vendored writer appends for the bands: one series per band, every category value its height. */
export function bandChartType(plan, labels, { kind, barDir }) {
  // A gap below the first band (a band list whose ends lie above the axis minimum is clamped from the minimum, so the first offset is 0).
  return {
    type: kind === 'bar' ? 'bar' : 'area',
    data: plan.bands.map((band) => ({ name: band.name, labels: [...labels], values: labels.map(() => Number(number(band.height))) })),
    options: { ...(kind === 'bar' ? { barDir, barGrouping: 'stacked' } : { barGrouping: 'stacked' }), secondaryValAxis: true, secondaryCatAxis: true, chartColors: plan.bands.map((band) => band.fill) },
  };
}

/** The vendored writer's axis options for a chart with bands: the band axes deleted, the band value axis from 0 to the primary span. */
export function bandAxisOptions(plan, { catAxisOrientation, valAxisOrientation } = {}) {
  return {
    valAxes: [{}, { valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: Number(number(plan.span)), valGridLine: { style: 'none' }, showValAxisTitle: false, ...(valAxisOrientation ? { valAxisOrientation } : {}) }],
    catAxes: [{}, { catAxisHidden: true, showCatAxisTitle: false, ...(catAxisOrientation ? { catAxisOrientation } : {}) }],
  };
}

const GROUP = /<c:(barChart|lineChart|areaChart|scatterChart)>[\s\S]*?<\/c:\1>/g;
const axIds = (group) => [...group.matchAll(/<c:axId val="([^"]+)"\s*\/>/g)].map((m) => m[1]);

function setElement(xml, name, value, before) {
  const tag = `<c:${name} val="${value}"/>`;
  if (new RegExp(`<c:${name} val="[^"]*"\\s*/>`).test(xml)) return xml.replace(new RegExp(`<c:${name} val="[^"]*"\\s*/>`), tag);
  const at = before.map((entry) => xml.indexOf(entry)).filter((index) => index >= 0).sort((a, b) => a - b)[0];
  return at === undefined ? xml : xml.slice(0, at) + tag + xml.slice(at);
}

/** One band series: its own fill, no line, no labels, points or markers, and the `opf:band` extension. */
function bandSeries(ser, band) {
  let next = ser
    .replace(/<c:spPr>[\s\S]*?<\/c:spPr>/g, '')
    .replace(/<c:marker>[\s\S]*?<\/c:marker>/g, '')
    .replace(/<c:dLbls>[\s\S]*?<\/c:dLbls>/g, '')
    .replace(/<c:dPt>[\s\S]*?<\/c:dPt>/g, '')
    .replace(/<c:invertIfNegative\b[^>]*\/>/g, '')
    .replace(/<c:smooth\b[^>]*\/>/g, '')
    .replace(/<c:extLst>[\s\S]*?<\/c:extLst>/g, '');
  const paint = `<c:spPr><a:solidFill><a:srgbClr val="${band.fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>`;
  next = next.replace(/(<\/c:tx>)/, `$1${paint}`);
  const record = { v: 1, index: band.index, to: band.to, ...(band.label !== undefined ? { label: band.label } : {}), ...(band.color !== undefined ? { color: band.color } : {}) };
  return next.replace(/<\/c:ser>$/, `${ext('band', record)}</c:ser>`);
}

function setScaling(axis, { min, max, orientation }) {
  const current = /<c:orientation val="([^"]+)"/.exec(axis)?.[1] ?? 'minMax';
  return axis.replace(/<c:scaling>[\s\S]*?<\/c:scaling>/, `<c:scaling><c:orientation val="${orientation ?? current}"/><c:max val="${number(max)}"/><c:min val="${number(min)}"/></c:scaling>`);
}

/**
 * Rewrite the band group the vendored writer appended (on the secondary axes): stacked, gap 0 and overlap 100 for bars, its series painted,
 * moved before the data's group, its two axes deleted and fixed to the band span. `info`: {plan, kind, edge, legend: {hidden indexes}}.
 */
export function applyChartBands(xml, info) {
  const plot = /<c:plotArea>[\s\S]*<\/c:plotArea>/.exec(xml);
  if (!plot) throw Error('Generated band chart has no plot area.');
  let body = plot[0];
  const groups = [...body.matchAll(GROUP)].map((m) => m[0]);
  const bandGroup = groups.find((group) => axIds(group).includes(AXIS.valueSecondary));
  if (!bandGroup) throw Error('Generated band chart has no band group.');
  const element = /^<c:(\w+)>/.exec(bandGroup)[1];
  let position = 0;
  let next = bandGroup.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (ser) => {
    const band = info.plan.bands[position++];
    if (!band) throw Error('Unexpected band series.');
    return bandSeries(ser, band);
  });
  if (position !== info.plan.bands.length) throw Error('Missing band series.');
  // Group-level labels and line options do not belong to the bands.
  next = next.replace(/<c:dLbls>[\s\S]*?<\/c:dLbls>/g, '');
  next = next.replace(/<c:grouping val="[^"]*"\s*\/>/, '<c:grouping val="stacked"/>');
  // CT_AreaChart opens with c:grouping (the writer leaves it out of a multi-type chart's area group); CT_BarChart with c:barDir.
  if (!/<c:grouping /.test(next)) next = element === 'barChart' ? next.replace(/(<c:barDir val="[^"]*"\/>)/, '$1<c:grouping val="stacked"/>') : next.replace(`<c:${element}>`, `<c:${element}><c:grouping val="stacked"/>`);
  if (element === 'barChart') {
    next = setElement(next, 'gapWidth', '0', ['<c:overlap', '<c:serLines', '<c:axId']);
    next = setElement(next, 'overlap', '100', ['<c:serLines', '<c:axId']);
  }
  body = body.replace(bandGroup, '');
  // Drawn first: before the first chart group.
  const first = GROUP.exec(body);
  GROUP.lastIndex = 0;
  if (!first) throw Error('Generated band chart has no data group.');
  body = body.slice(0, first.index) + next + body.slice(first.index);
  // The band axes: deleted, the value axis from 0 to the primary span, both oriented as the primary axes.
  const primaryValue = /<c:valAx>\s*<c:axId val="2094734552"\/>[\s\S]*?<\/c:valAx>/.exec(body)?.[0];
  const primaryCategory = /<c:catAx>\s*<c:axId val="2094734554"\/>[\s\S]*?<\/c:catAx>/.exec(body)?.[0];
  const orientation = (axis) => (axis ? /<c:orientation val="([^"]+)"/.exec(axis)?.[1] : undefined);
  body = body.replace(/<c:valAx>\s*<c:axId val="2094734553"\/>[\s\S]*?<\/c:valAx>/, (axis) =>
    setScaling(axis, { min: 0, max: info.plan.span, orientation: orientation(primaryValue) })
      .replace(/<c:delete val="[^"]*"\/>/, '<c:delete val="1"/>')
      .replace(/<c:majorGridlines>[\s\S]*?<\/c:majorGridlines>|<c:majorGridlines\/>/g, '')
      .replace(/<c:crossBetween val="[^"]*"\/>/, `<c:crossBetween val="${info.edge ? 'midCat' : 'between'}"/>`));
  body = body.replace(/<c:catAx>\s*<c:axId val="2094734555"\/>[\s\S]*?<\/c:catAx>/, (axis) =>
    axis.replace(/<c:scaling>[\s\S]*?<\/c:scaling>/, `<c:scaling><c:orientation val="${orientation(primaryCategory) ?? 'minMax'}"/></c:scaling>`).replace(/<c:delete val="[^"]*"\/>/, '<c:delete val="1"/>'));
  // The primary value axis: the data's crossBetween (the writer chooses midCat for a chart with an area type).
  body = body.replace(/<c:valAx>\s*<c:axId val="2094734552"\/>[\s\S]*?<\/c:valAx>/, (axis) => axis.replace(/<c:crossBetween val="[^"]*"\/>/, `<c:crossBetween val="${info.edge ? 'midCat' : 'between'}"/>`));
  let out = xml.slice(0, plot.index) + body + xml.slice(plot.index + plot[0].length);
  // A band without a label has no legend entry. PowerPoint lists the primary groups' series first, then the secondary ones: a band's entry
  // index is the count of primary series before it plus its position.
  const unlabeled = info.plan.bands.flatMap((band, k) => (band.label === undefined ? [info.legendBase + k] : []));
  const hidden = [...(info.hiddenLegend ?? []), ...unlabeled];
  if (hidden.length && /<c:legend>/.test(out)) {
    out = out.replace(/(<c:legend>\s*<c:legendPos\b[^>]*\/>)((?:\s*<c:legendEntry>[\s\S]*?<\/c:legendEntry>)*)/, (_, head, entries) => {
      const existing = new Set([...entries.matchAll(/<c:idx val="(\d+)"\/>/g)].map((m) => Number(m[1])));
      const added = [...new Set(hidden)].filter((idx) => !existing.has(idx)).sort((a, b) => a - b).map((idx) => `<c:legendEntry><c:idx val="${idx}"/><c:delete val="1"/></c:legendEntry>`).join('');
      return head + entries + added;
    });
  }
  return out;
}

/**
 * The bullet chart's target: the target series the vendored writer wrote as the measure group's second series becomes a c:scatterChart
 * without markers whose fixed Y error bars (both directions, a third of a row each, no end caps) are the tick, on its own two deleted value
 * axes: X shares the value axis's bounds and orientation, Y runs from 0 to the row count from the top. `info`: {count, rows (row centers with a
 * target), axis {min, max}, color, widthEmu, rtl}.
 */
export function applyBulletTarget(xml, info) {
  const plot = /<c:plotArea>[\s\S]*<\/c:plotArea>/.exec(xml);
  if (!plot) throw Error('Generated bullet chart has no plot area.');
  let body = plot[0];
  const measure = [...body.matchAll(GROUP)].map((m) => m[0]).find((group) => axIds(group).includes(AXIS.value));
  if (!measure) throw Error('Generated bullet chart has no measure group.');
  const series = [...measure.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].map((m) => m[0]);
  if (series.length !== 2) throw Error('Generated bullet chart has no target series.');
  const target = series[1];
  let group = measure.replace(target, '');
  group = setElement(group, 'gapWidth', String(info.gapWidth), ['<c:overlap', '<c:serLines', '<c:axId']);
  const head = /^<c:ser>\s*(<c:idx val="\d+"\/>)\s*(<c:order val="\d+"\/>)\s*(<c:tx>[\s\S]*?<\/c:tx>)/.exec(target);
  const values = /<c:val>([\s\S]*?)<\/c:val>/.exec(target)?.[1];
  if (!head || !values) throw Error('Generated bullet target series is malformed.');
  // X: the target cells (the workbook column), Y: each row's center; a row without a target has neither (no point, no tick).
  const points = [...values.matchAll(/<c:pt idx="(\d+)">\s*<c:v>([^<]*)<\/c:v>\s*<\/c:pt>/g)].map((m) => Number(m[1]));
  const yLit = `<c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="${info.count}"/>${points.map((row) => `<c:pt idx="${row}"><c:v>${number(row + 0.5)}</c:v></c:pt>`).join('')}</c:numLit>`;
  const errorBars = `<c:errBars><c:errDir val="y"/><c:errBarType val="both"/><c:errValType val="fixedVal"/><c:noEndCap val="1"/><c:val val="${number(info.half)}"/><c:spPr><a:ln w="${info.widthEmu}" cap="flat"><a:solidFill><a:srgbClr val="${hex6(info.color)}"/></a:solidFill><a:round/></a:ln></c:spPr></c:errBars>`;
  const scatterSeries = `<c:ser>${head[1]}${head[2]}${head[3]}<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>${errorBars}<c:xVal>${values}</c:xVal><c:yVal>${yLit}</c:yVal><c:smooth val="0"/>${ext('target', { v: 1 })}</c:ser>`;
  const scatter = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${scatterSeries}<c:axId val="${AXIS.targetX}"/><c:axId val="${AXIS.targetY}"/></c:scatterChart>`;
  body = body.replace(measure, group + scatter);
  const valueAxis = /<c:valAx>\s*<c:axId val="2094734552"\/>[\s\S]*?<\/c:valAx>/.exec(body)?.[0] ?? '';
  const orientation = /<c:orientation val="([^"]+)"/.exec(valueAxis)?.[1] ?? 'minMax';
  const axis = (id, cross, pos, scaling) => `<c:valAx><c:axId val="${id}"/>${scaling}<c:delete val="1"/><c:axPos val="${pos}"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>`;
  const axes = axis(AXIS.targetX, AXIS.targetY, 'b', `<c:scaling><c:orientation val="${orientation}"/><c:max val="${number(info.axis.max)}"/><c:min val="${number(info.axis.min)}"/></c:scaling>`)
    + axis(AXIS.targetY, AXIS.targetX, 'l', `<c:scaling><c:orientation val="maxMin"/><c:max val="${info.count}"/><c:min val="0"/></c:scaling>`);
  // CT_PlotArea: the axes follow every chart group, before c:dTable, c:spPr and c:extLst.
  const lastAxis = Math.max(body.lastIndexOf('</c:valAx>'), body.lastIndexOf('</c:catAx>'));
  if (lastAxis < 0) throw Error('Generated bullet chart has no axes.');
  const at = lastAxis + (body.slice(lastAxis).startsWith('</c:valAx>') ? '</c:valAx>'.length : '</c:catAx>'.length);
  body = body.slice(0, at) + axes + body.slice(at);
  let out = xml.slice(0, plot.index) + body + xml.slice(plot.index + plot[0].length);
  // The target has no legend entry (its key would be empty): it is the primary group's second entry.
  if (/<c:legend>/.test(out)) out = out.replace(/(<c:legend>\s*<c:legendPos\b[^>]*\/>)/, `$1<c:legendEntry><c:idx val="${info.legendIndex}"/><c:delete val="1"/></c:legendEntry>`);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Import

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false });
const arr = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const ownRecord = (ser, name) => {
  const entry = arr(ser?.['c:extLst']?.['c:ext']).find((item) => item?.uri === BANDS_URI && item[`opf:${name}`]);
  if (!entry) return undefined;
  try { const record = decodeTextTag(entry[`opf:${name}`].data); return record?.v === 1 ? record : undefined; } catch { return undefined; }
};
const cached = (node) => {
  const cache = node?.['c:numRef']?.['c:numCache'] ?? node?.['c:numLit'] ?? node?.['c:strRef']?.['c:strCache'] ?? node?.['c:strLit'];
  const count = Number(cache?.['c:ptCount']?.val);
  if (!Number.isSafeInteger(count) || count < 0 || count > 100000) return [];
  const out = Array(count).fill(null);
  for (const point of arr(cache?.['c:pt'])) {
    const index = Number(point?.idx), value = point?.['c:v'];
    if (Number.isSafeInteger(index) && index >= 0 && index < count) out[index] = typeof value === 'string' || typeof value === 'number' ? String(value) : (value?.['#text'] ?? null);
  }
  return out;
};
const firstNumber = (values) => values.map(Number).find((value) => Number.isFinite(value));

/**
 * The owned band group and target of an exported chart part, read from the current XML: `xml` without them (and without their axes),
 * `bands` [{to, label?, color?}] from the band series' current names and cached heights over the band axis (the native truth after an edit),
 * and `target` {name, values} from the scatter's current X cache. A part without owned bands or target comes back unchanged.
 */
export function readNativeBands(xml) {
  if (!String(xml).includes(BANDS_URI)) return { xml };
  const doc = parser.parse(xml);
  const plotArea = doc?.['c:chartSpace']?.['c:chart']?.['c:plotArea'];
  if (!plotArea) return { xml };
  const result = { xml };
  const groups = [...xml.matchAll(GROUP)].map((m) => m[0]);
  // The band group: every series carries `opf:band`.
  const bandNodes = ['barChart', 'areaChart'].flatMap((element) => arr(plotArea[`c:${element}`]).map((node) => ({ element, node }))).filter(({ node }) => arr(node['c:ser']).length && arr(node['c:ser']).every((ser) => ownRecord(ser, 'band')));
  let stripped = xml;
  const removeAxes = (ids) => {
    for (const id of ids) stripped = stripped.replace(new RegExp(`<c:(valAx|catAx)>\\s*<c:axId val="${id}"\\s*/>[\\s\\S]*?</c:\\1>`), '');
  };
  if (bandNodes.length === 1) {
    const { node } = bandNodes[0];
    const ids = arr(node['c:axId']).map((entry) => String(entry.val));
    const bandAxis = arr(plotArea['c:valAx']).find((axis) => ids.includes(String(axis?.['c:axId']?.val)));
    const base = Number(arr(plotArea['c:valAx']).find((axis) => !ids.includes(String(axis?.['c:axId']?.val)))?.['c:scaling']?.['c:min']?.val);
    const bandMin = Number(bandAxis?.['c:scaling']?.['c:min']?.val ?? 0);
    let running = (Number.isFinite(base) ? base : 0) - (Number.isFinite(bandMin) ? bandMin : 0);
    result.bands = arr(node['c:ser']).map((ser) => {
      const record = ownRecord(ser, 'band');
      const name = cached(ser['c:tx'])[0] ?? ser['c:tx']?.['c:v'];
      running += firstNumber(cached(ser['c:val'])) ?? 0;
      return { to: Number(number(running)), ...(record.label !== undefined && typeof name === 'string' ? { label: name } : {}), ...(record.color !== undefined ? { color: record.color } : {}), record };
    });
    const text = groups.find((group) => group.includes(BANDS_URI) && /<opf:band\b/.test(group));
    if (text) stripped = stripped.replace(text, '');
    removeAxes(ids);
    // The band series' legend entries (a deleted entry of an unlabeled band) go with them.
  }
  const targetGroup = groups.find((group) => /^<c:scatterChart>/.test(group) && /<opf:target\b/.test(group));
  if (targetGroup) {
    const node = arr(plotArea['c:scatterChart']).find((entry) => arr(entry['c:ser']).some((ser) => ownRecord(ser, 'target')));
    const ser = arr(node?.['c:ser'])[0];
    const name = cached(ser?.['c:tx'])[0];
    const xs = cached(ser?.['c:xVal']).map((value) => (value === null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null));
    result.target = { name: typeof name === 'string' ? name : 'Target', values: xs, code: ser?.['c:xVal']?.['c:numRef']?.['c:numCache']?.['c:formatCode'] };
    stripped = stripped.replace(targetGroup, '');
    removeAxes(arr(node?.['c:axId']).map((entry) => String(entry.val)));
  }
  // Legend entries past the remaining series refer to the removed parts.
  const remaining = [...stripped.matchAll(/<c:ser>/g)].length;
  stripped = stripped.replace(/<c:legendEntry>\s*<c:idx val="(\d+)"\/>[\s\S]*?<\/c:legendEntry>/g, (entry, idx) => (Number(idx) >= remaining ? '' : entry));
  result.xml = stripped;
  return result;
}
