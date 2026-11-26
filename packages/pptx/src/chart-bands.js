// FR-07 (CR 5): bands on value axes and the bullet chart, as native, editable PowerPoint chart parts.
//
// Export. A chart with bands gets one extra chart group, written by the vendored writer as a further chart type (so its series are
// ordinary workbook columns after the data, which Edit Data shows) and then rewritten here:
//   - bar and column charts: a stacked c:barChart (gap width 0, overlap 100, the data's c:barDir); line and area charts: a stacked c:areaChart;
//   - the bands on the PRIMARY axes (the visible ones, with the composed fixed scale) and the data on the SECONDARY axes (deleted, fixed to the
//     same bounds). PowerPoint draws chart types in a fixed order (area, then bar, then line, then scatter) and, within one type, the primary group
//     before the secondary one, whatever the XML order (native check 2026-11-25): bands on the secondary axes covered the columns. So the bands
//     are primary and the data secondary, for every chart type alike;
//   - stacked from 0: on an axis that starts at or above 0 the first band's value is its end (the part below the axis minimum is clipped), the
//     others their heights. On an axis that starts below 0 a bar band is split into its part below 0 and its part above (the parts below 0 come
//     first, highest band first, so each stacks down from 0 in place), and an area band list starts with an unfilled base series at the axis
//     minimum. Those helper parts carry no legend entry;
//   - each band series is filled with its computed color (a:srgbClr), with no line, labels or markers; a band without a label has its legend
//     entry deleted. Each band series carries an `opf:band` extension (its band, end, label, color and part), which the importer reads (never its name).
// A bullet chart's measure is a clustered c:barChart (gap width 200: a third of its row); its target is drawn by src/chart-bands.js too.
//
// Import. readNativeBands strips the owned band group (and the target), points the data back at the visible axes, and returns the ordinary
// chart XML with the bands and the targets it read (the native truth: band labels and ends from the cached values).
import { XMLParser } from 'fast-xml-parser';
import { encodeTextTag, decodeTextTag } from './code-provenance.js';

export const BANDS_URI = 'urn:openpresentation:chart-bands:v1';
/** The vendored writer's axis ids (pptxgen.es.js), and the ids of the bullet target's own axes. */
const AXIS = Object.freeze({ value: '2094734552', valueSecondary: '2094734553', category: '2094734554', categorySecondary: '2094734555', targetX: '2094734560', targetY: '2094734561' });

const hex6 = (color) => String(color).replace(/^#/, '').slice(0, 6).toUpperCase();
const number = (value) => String(Number(Number(value).toPrecision(15)));
const ext = (name, record) => `<c:extLst><c:ext uri="${BANDS_URI}"><opf:${name} xmlns:opf="${BANDS_URI}" data="${encodeTextTag(record)}"/></c:ext></c:extLst>`;

/** Series names: unique (ignoring case, as Excel table columns are) against the data series, the category heading and each other. */
function uniqueNames(names, reserved = []) {
  const taken = new Set(reserved.filter((name) => typeof name === 'string').map((name) => name.toLowerCase()));
  return names.map((wanted) => {
    const base = wanted.replace(/\s+/g, ' ').trim().slice(0, 200);
    let name = base;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} ${n}`;
    taken.add(name.toLowerCase());
    return name;
  });
}

/**
 * The band plan of a chart: core's sorted, clamped band ranges over its value axis (`ranges`, core chartBandRanges), their fills (#RRGGBB)
 * and the native series that draw them (`series`: band, part, value, name, fill, hidden). `axis` is the composed value axis {min, max}.
 */
export function bandPlan(ranges, fills, axis, { reserved = [], kind = 'bar' } = {}) {
  if (!ranges.length || !axis || !(axis.max > axis.min)) return undefined;
  const bands = ranges.map((band, position) => ({ index: band.index, from: band.from, to: band.to, label: band.label, color: band.color, fill: hex6(fills[position]), position }));
  const label = (band) => band.label ?? `Band ${band.position + 1}`;
  const wanted = [];
  if (axis.min >= 0) bands.forEach((band, k) => wanted.push({ band, part: 'pos', value: k === 0 ? band.to : band.to - band.from }));
  else if (kind === 'area') {
    wanted.push({ band: bands[0], part: 'base', value: axis.min, hidden: true, name: 'Band base' });
    for (const band of bands) wanted.push({ band, part: 'pos', value: band.to - band.from });
  } else {
    for (const band of [...bands].reverse()) if (Math.min(band.to, 0) < Math.min(band.from, 0) || band.from < 0) {
      const below = Math.min(band.to, 0) - band.from;
      if (below > 0) wanted.push({ band, part: 'neg', value: -below, hidden: band.to > 0, name: band.to > 0 ? `${label(band)} below zero` : undefined });
    }
    for (const band of bands) { const above = band.to - Math.max(band.from, 0); if (above > 0) wanted.push({ band, part: 'pos', value: above }); }
  }
  const names = uniqueNames(wanted.map((entry) => entry.name ?? label(entry.band)), reserved);
  return {
    axis: { min: axis.min, max: axis.max },
    bands,
    series: wanted.map((entry, position) => ({ ...entry, value: Number(number(entry.value)), name: names[position], fill: entry.part === 'base' ? undefined : entry.band.fill, hidden: entry.hidden === true || (entry.part !== 'base' && entry.band.label === undefined) })),
  };
}

/** The chart type the vendored writer appends for the bands: one series per band part, every category value the part's value. */
export function bandChartType(plan, labels, { kind, barDir }) {
  return {
    type: kind === 'bar' ? 'bar' : 'area',
    data: plan.series.map((entry) => ({ name: entry.name, labels: [...labels], values: labels.map(() => entry.value) })),
    options: { ...(kind === 'bar' ? { barDir, barGrouping: 'stacked' } : { barGrouping: 'stacked' }), secondaryValAxis: true, secondaryCatAxis: true, chartColors: plan.series.map((entry) => entry.fill ?? 'FFFFFF') },
  };
}

/** The vendored writer's axis options for a chart with bands: the second pair deleted, its value axis fixed to the composed bounds. */
export function bandAxisOptions(plan, { catAxisOrientation, valAxisOrientation } = {}) {
  return {
    valAxes: [{}, { valAxisHidden: true, valAxisMinVal: plan.axis.min, valAxisMaxVal: plan.axis.max, valGridLine: { style: 'none' }, showValAxisTitle: false, ...(valAxisOrientation ? { valAxisOrientation } : {}) }],
    catAxes: [{}, { catAxisHidden: true, showCatAxisTitle: false, ...(catAxisOrientation ? { catAxisOrientation } : {}) }],
  };
}

const GROUP = /<c:(barChart|lineChart|areaChart|scatterChart)>[\s\S]*?<\/c:\1>/g;
const axIds = (group) => [...group.matchAll(/<c:axId val="([^"]+)"\s*\/>/g)].map((m) => m[1]);
const SWAP = { [AXIS.value]: AXIS.valueSecondary, [AXIS.valueSecondary]: AXIS.value, [AXIS.category]: AXIS.categorySecondary, [AXIS.categorySecondary]: AXIS.category };
const swapAxes = (group) => group.replace(/<c:axId val="(\d+)"\/>/g, (whole, id) => (SWAP[id] ? `<c:axId val="${SWAP[id]}"/>` : whole));

function setElement(xml, name, value, before) {
  const tag = `<c:${name} val="${value}"/>`;
  if (new RegExp(`<c:${name} val="[^"]*"\\s*/>`).test(xml)) return xml.replace(new RegExp(`<c:${name} val="[^"]*"\\s*/>`), tag);
  const at = before.map((entry) => xml.indexOf(entry)).filter((index) => index >= 0).sort((a, b) => a - b)[0];
  return at === undefined ? xml : xml.slice(0, at) + tag + xml.slice(at);
}

/** One band series: its own fill (none for the base), no line, no labels, points or markers, and the `opf:band` extension. */
function bandSeries(ser, entry) {
  let next = ser
    .replace(/<c:spPr>[\s\S]*?<\/c:spPr>/g, '')
    .replace(/<c:marker>[\s\S]*?<\/c:marker>/g, '')
    .replace(/<c:dLbls>[\s\S]*?<\/c:dLbls>/g, '')
    .replace(/<c:dPt>[\s\S]*?<\/c:dPt>/g, '')
    .replace(/<c:invertIfNegative\b[^>]*\/>/g, '')
    .replace(/<c:smooth\b[^>]*\/>/g, '')
    .replace(/<c:extLst>[\s\S]*?<\/c:extLst>/g, '');
  const paint = `<c:spPr>${entry.fill ? `<a:solidFill><a:srgbClr val="${entry.fill}"/></a:solidFill>` : '<a:noFill/>'}<a:ln><a:noFill/></a:ln></c:spPr>`;
  next = next.replace(/(<\/c:tx>)/, (tx) => tx + paint);
  const { band } = entry;
  const record = { v: 1, index: band.index, to: band.to, part: entry.part, ...(band.label !== undefined ? { label: band.label } : {}), ...(band.color !== undefined ? { color: band.color } : {}) };
  return next.replace(/<\/c:ser>$/, () => `${ext('band', record)}</c:ser>`);
}

/** The composition label of a band series part: on the part above 0 (or the only part of a band below 0), none for a base part. */
function labelFor(info, entry) {
  if (!info.labels || entry.part === 'base') return undefined;
  const label = info.labels.find((candidate) => candidate.index === entry.band.index);
  if (!label) return undefined;
  const parts = info.plan.series.filter((other) => other.band.index === entry.band.index && other.part !== 'base');
  const carrier = parts.find((other) => other.part === 'pos') ?? parts[0];
  return carrier === entry ? label : undefined;
}

/**
 * FR-07 (owner, "1B"): a band's label as a data label of its series, on the point of the category composition chose (the stripe's end or start,
 * the strip's top or bottom row), showing the series name in the chart text size and the secondary text color, at composition's box: a manual
 * layout in edge mode, the box's top left as fractions of the chart frame.
 */
function withBandLabel(ser, label, text) {
  const fraction = (value) => Number(Math.min(1, Math.max(0, value)).toFixed(4));
  const run = `<a:defRPr sz="${Math.round(text.size)}" b="0"><a:solidFill><a:srgbClr val="${hex6(text.color)}"/></a:solidFill><a:latin typeface="${String(text.font).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"/></a:defRPr>`;
  const flags = (series) => `<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="${series ? 1 : 0}"/><c:showPercent val="0"/><c:showBubbleSize val="0"/>`;
  const dLbl = `<c:dLbl><c:idx val="${label.category}"/><c:layout><c:manualLayout><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="${fraction(label.x)}"/><c:y val="${fraction(label.y)}"/></c:manualLayout></c:layout><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"/><a:lstStyle/><a:p><a:pPr algn="${label.align === 'right' ? 'r' : label.align === 'center' ? 'ctr' : 'l'}">${run}</a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>${flags(true)}</c:dLbl>`;
  const labels = `<c:dLbls>${dLbl}${flags(false)}</c:dLbls>`;
  // CT_BarSer / CT_AreaSer: c:dLbls before c:trendline, c:errBars and c:cat.
  return ser.replace(/<c:(?:trendline|errBars|cat)>/, (at) => labels + at);
}

function setScaling(axis, { min, max, orientation }) {
  const current = /<c:orientation val="([^"]+)"/.exec(axis)?.[1] ?? 'minMax';
  return axis.replace(/<c:scaling>[\s\S]*?<\/c:scaling>/, `<c:scaling><c:orientation val="${orientation ?? current}"/><c:max val="${number(max)}"/><c:min val="${number(min)}"/></c:scaling>`);
}
const axisXml = (body, id) => new RegExp(`<c:(?:valAx|catAx)>\\s*<c:axId val="${id}"\\/>[\\s\\S]*?<\\/c:(?:valAx|catAx)>`).exec(body)?.[0];

/**
 * Rewrite the band group the vendored writer appended (on the second axis pair): stacked, gap 0 and overlap 100 for bars, its series painted,
 * moved before the data's groups; then the bands take the first (visible) axis pair and every data group the second, which is deleted and fixed
 * to the visible value axis's bounds and orientation. `info`: {plan, edge, hiddenLegend}.
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
  // Group-level labels do not belong to the bands (the group's own c:dLbls, after its series; a series' are rewritten below).
  const withoutGroupLabels = bandGroup.split(/(<c:ser>[\s\S]*?<\/c:ser>)/).map((part, at) => (at % 2 ? part : part.replace(/<c:dLbls>[\s\S]*?<\/c:dLbls>/g, ''))).join('');
  let next = withoutGroupLabels.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (ser) => {
    const entry = info.plan.series[position++];
    if (!entry) throw Error('Unexpected band series.');
    const label = labelFor(info, entry);
      return label ? withBandLabel(bandSeries(ser, entry), label, info.text) : bandSeries(ser, entry);
  });
  if (position !== info.plan.series.length) throw Error('Missing band series.');
  next = next.replace(/<c:grouping val="[^"]*"\s*\/>/, '<c:grouping val="stacked"/>');
  // CT_AreaChart opens with c:grouping (the writer leaves it out of a multi-type chart's area group); CT_BarChart with c:barDir.
  if (!/<c:grouping /.test(next)) next = element === 'barChart' ? next.replace(/(<c:barDir val="[^"]*"\/>)/, (dir) => `${dir}<c:grouping val="stacked"/>`) : next.replace(`<c:${element}>`, `<c:${element}><c:grouping val="stacked"/>`);
  if (element === 'barChart') {
    next = setElement(next, 'gapWidth', '0', ['<c:overlap', '<c:serLines', '<c:axId']);
    next = setElement(next, 'overlap', '100', ['<c:serLines', '<c:axId']);
  }
  body = body.replace(bandGroup, () => '');
  // The data groups take the second pair, then the bands (on the first pair) are written before them.
  body = body.replace(GROUP, (group) => swapAxes(group));
  next = swapAxes(next);
  const first = new RegExp(GROUP.source).exec(body);
  if (!first) throw Error('Generated band chart has no data group.');
  body = body.slice(0, first.index) + next + body.slice(first.index);
  // The data's axes (the second pair): deleted, fixed to the visible value axis's bounds, oriented as the visible axes.
  const visibleValue = axisXml(body, AXIS.value), visibleCategory = axisXml(body, AXIS.category);
  const orientation = (axis) => (axis ? /<c:orientation val="([^"]+)"/.exec(axis)?.[1] : undefined);
  const crossBetween = `<c:crossBetween val="${info.edge ? 'midCat' : 'between'}"/>`;
  body = body.replace(axisXml(body, AXIS.valueSecondary), (axis) => setScaling(axis, { min: info.plan.axis.min, max: info.plan.axis.max, orientation: orientation(visibleValue) })
    .replace(/<c:delete val="[^"]*"\/>/, '<c:delete val="1"/>')
    .replace(/<c:majorGridlines>[\s\S]*?<\/c:majorGridlines>|<c:majorGridlines\/>/g, '')
    .replace(/<c:crossBetween val="[^"]*"\/>/, crossBetween));
  body = body.replace(axisXml(body, AXIS.categorySecondary), (axis) =>
    axis.replace(/<c:scaling>[\s\S]*?<\/c:scaling>/, `<c:scaling><c:orientation val="${orientation(visibleCategory) ?? 'minMax'}"/></c:scaling>`).replace(/<c:delete val="[^"]*"\/>/, '<c:delete val="1"/>'));
  // The visible value axis keeps the data's crossBetween (the writer chooses midCat for a chart with an area type).
  body = body.replace(axisXml(body, AXIS.value), (axis) => axis.replace(/<c:crossBetween val="[^"]*"\/>/, crossBetween));
  let out = xml.slice(0, plot.index) + body + xml.slice(plot.index + plot[0].length);
  // PowerPoint lists the primary group's series (the bands) first: a band part's legend entry is its position. Hidden parts and bands without a
  // label have none.
  // With the labels inside their bands (FR-07, owner's "1B") no band part has a legend entry.
  const hidden = [...info.plan.series.flatMap((entry, k) => (entry.hidden || info.labels ? [k] : [])), ...(info.hiddenLegend ?? [])];
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
 * The bullet chart's target: the target series the vendored writer wrote as the measure group's second series becomes a c:scatterChart without
 * markers on the MEASURE's axis pair (X its value axis, Y its reversed category axis, where Y = j is category j's center: PowerPoint maps a scatter's
 * Y on a shared category axis after the axis's reversal), whose fixed Y error bars (both directions, a third of a row each, no end caps) are the
 * tick. A row without a target has no point. Native check 2026-11-25: a scatter on a third axis pair (or a third value axis) makes PowerPoint
 * reject the file; on the measure's pair it draws in front of the bars. Run after applyChartBands, so the measure is already on its final pair.
 * `info`: {half, color, widthEmu}. The target's legend entry is deleted: PowerPoint lists it last (after the bands and the measure).
 */
export function applyBulletTarget(xml, info) {
  const plot = /<c:plotArea>[\s\S]*<\/c:plotArea>/.exec(xml);
  if (!plot) throw Error('Generated bullet chart has no plot area.');
  let body = plot[0];
  const measure = [...body.matchAll(GROUP)].map((m) => m[0]).find((group) => group.startsWith('<c:barChart>') && !group.includes('<opf:band '));
  if (!measure) throw Error('Generated bullet chart has no measure group.');
  const series = [...measure.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].map((m) => m[0]);
  if (series.length !== 2) throw Error('Generated bullet chart has no target series.');
  const target = series[1];
  let group = measure.replace(target, () => '');
  group = setElement(group, 'gapWidth', String(info.gapWidth), ['<c:overlap', '<c:serLines', '<c:axId']);
  const [category, value] = axIds(group);
  const head = /^<c:ser>\s*(<c:idx val="\d+"\/>)\s*(<c:order val="\d+"\/>)\s*(<c:tx>[\s\S]*?<\/c:tx>)/.exec(target);
  const values = /<c:val>([\s\S]*?)<\/c:val>/.exec(target)?.[1];
  if (!head || !values) throw Error('Generated bullet target series is malformed.');
  const count = Number(/<c:ptCount val="(\d+)"\/>/.exec(values)?.[1] ?? 0);
  // X: the target cells (the workbook column), Y: each row's category position; a row without a target has neither (no point, no tick).
  const points = [...values.matchAll(/<c:pt idx="(\d+)">\s*<c:v>([^<]*)<\/c:v>\s*<\/c:pt>/g)].map((m) => Number(m[1]));
  const yLit = `<c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="${count}"/>${points.map((row) => `<c:pt idx="${row}"><c:v>${row + 1}</c:v></c:pt>`).join('')}</c:numLit>`;
  const errorBars = `<c:errBars><c:errDir val="y"/><c:errBarType val="both"/><c:errValType val="fixedVal"/><c:noEndCap val="1"/><c:val val="${number(info.half)}"/><c:spPr><a:ln w="${info.widthEmu}" cap="flat"><a:solidFill><a:srgbClr val="${hex6(info.color)}"/></a:solidFill><a:round/></a:ln></c:spPr></c:errBars>`;
  const scatterSeries = `<c:ser>${head[1]}${head[2]}${head[3]}<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>${errorBars}<c:xVal>${values}</c:xVal><c:yVal>${yLit}</c:yVal><c:smooth val="0"/>${ext('target', { v: 1 })}</c:ser>`;
  const scatter = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${scatterSeries}<c:axId val="${value}"/><c:axId val="${category}"/></c:scatterChart>`;
  body = body.replace(measure, () => group + scatter);
  // The category names a third of PowerPoint's default distance from the plot (c:lblOffset 100 put them about 9 px away where the preview has
  // 3, native check 2026-11-25). The value axis has no such attribute (CT_ValAx has no lblOffset), so its labels keep PowerPoint's distance.
  body = body.replace(/<c:catAx>[\s\S]*?<\/c:catAx>/g, (axis) => /<c:delete val="1"\/>/.test(axis) ? axis : axis.replace(/<c:lblOffset val="[^"]*"\/>/, '').replace(/(<c:lblAlgn val="[^"]*"\/>)/, (align) => `${align}<c:lblOffset val="33"/>`));
  let out = xml.slice(0, plot.index) + body + xml.slice(plot.index + plot[0].length);
  // The target has no legend entry (its key would be empty). PowerPoint lists it after every other series.
  const last = (out.match(/<c:ser>/g) ?? []).length - 1;
  if (/<c:legend>/.test(out)) out = out.replace(/(<c:legend>\s*<c:legendPos\b[^>]*\/>)/, (head) => `${head}<c:legendEntry><c:idx val="${last}"/><c:delete val="1"/></c:legendEntry>`);
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
  // The target first: its scatter shares the measure's axes, which stay.
  const targetGroup = groups.find((group) => /^<c:scatterChart>/.test(group) && /<opf:target\b/.test(group));
  if (targetGroup) {
    const node = arr(plotArea['c:scatterChart']).find((entry) => arr(entry['c:ser']).some((ser) => ownRecord(ser, 'target')));
    const ser = arr(node?.['c:ser'])[0];
    const name = cached(ser?.['c:tx'])[0];
    const xs = cached(ser?.['c:xVal']).map((value) => (value === null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null));
    result.target = { name: typeof name === 'string' ? name : 'Target', values: xs, code: ser?.['c:xVal']?.['c:numRef']?.['c:numCache']?.['c:formatCode'] };
    stripped = stripped.replace(targetGroup, () => '');
  }
  let parts = 0;
  if (bandNodes.length === 1) {
    const { node } = bandNodes[0];
    const ids = arr(node['c:axId']).map((entry) => String(entry.val));
    const isCategory = (id) => arr(plotArea['c:catAx']).some((axis) => String(axis?.['c:axId']?.val) === id) || arr(plotArea['c:dateAx']).some((axis) => String(axis?.['c:axId']?.val) === id);
    // Stacked from 0 (or from an unfilled base part): the parts above 0 stack up in order, the parts below 0 down in order (highest band first).
    let up = 0, down = 0;
    const ends = new Map();
    for (const ser of arr(node['c:ser'])) {
      const record = ownRecord(ser, 'band');
      const value = firstNumber(cached(ser['c:val'])) ?? 0;
      parts++;
      if (record.part === 'base') { up = value; continue; }
      const name = cached(ser['c:tx'])[0] ?? ser['c:tx']?.['c:v'];
      const entry = ends.get(record.index) ?? { record, name };
      if (record.part === 'neg') { entry.top ??= down; down += value; }
      else { up += value; entry.top = up; }
      if (record.part !== 'neg' || typeof entry.name !== 'string') entry.name = name;
      ends.set(record.index, entry);
    }
    result.bands = [...ends.values()].map(({ record, name, top }) => ({ to: Number(number(top)), ...(record.label !== undefined && typeof name === 'string' ? { label: name } : {}), ...(record.color !== undefined ? { color: record.color } : {}), record })).sort((a, b) => a.to - b.to);
    const text = groups.find((group) => /<opf:band\b/.test(group));
    if (text) stripped = stripped.replace(text, () => '');
    // The data groups' axes (deleted, fixed to the same bounds) give way to the band group's visible ones, by kind.
    const [category, value] = [ids.find(isCategory), ids.find((id) => !isCategory(id))];
    const others = new Set();
    stripped = stripped.replace(GROUP, (group) => group.replace(/<c:axId val="(\d+)"\s*\/>/g, (whole, id) => {
      if (ids.includes(id)) return whole;
      others.add(id);
      return `<c:axId val="${isCategory(id) ? category : value}"/>`;
    }));
    removeAxes([...others]);
  }
  // The legend entries of the removed series go with them: the band parts were listed first, the target last.
  const remaining = [...stripped.matchAll(/<c:ser>/g)].length;
  stripped = stripped.replace(/<c:legendEntry>\s*<c:idx val="(\d+)"\/>([\s\S]*?)<\/c:legendEntry>/g, (entry, idx, rest) => {
    const at = Number(idx) - parts;
    return at < 0 || at >= remaining ? '' : `<c:legendEntry><c:idx val="${at}"/>${rest}</c:legendEntry>`;
  });
  result.xml = stripped;
  return result;
}
