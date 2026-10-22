// RR-35: chart options (axis titles, legend position, data labels) in the PPTX export and import.
//
// Core owns the normalisation and the per-type support table (`resolveChartOptions`, `chartOptionSupport`); the preview
// (opf-render) reads the same resolved options. This module writes them natively and reads them back:
//
//   classic charts   c:catAx/c:title and c:valAx/c:title (through PptxGenJS options), c:legend/c:legendPos (through PptxGenJS
//                    options), and a c:dLbls block per series and per chart group (post-processed XML, see `applyDataLabels`);
//   chartex charts   cx:axis/cx:title, cx:legend pos and cx:dataLabels pos (see chartex.js, which calls the helpers here).
//
// A chart that carries none of the three fields resolves to `active: false`; nothing below runs and its parts are unchanged.
import {chartOptionSupport, chartOptionTarget, resolveChartOptions, textColorForFill} from '@openpresentation/opf/composition';

const INACTIVE = Object.freeze({active: false, axisTitles: {}, diagnostics: []});

/** The resolved options of a chart. */
export function resolveChartOptionsFor(chart) {
  if (!chart || typeof chart !== 'object') return INACTIVE;
  return resolveChartOptions(chart, chartOptionTarget(chart.type));
}

export function reportChartOptionDiagnostics(resolved, path, onDiagnostic) {
  for (const diagnostic of resolved.diagnostics) onDiagnostic?.({...diagnostic, path: `${path}.${diagnostic.option}`});
}

const LEGEND_POS = Object.freeze({top: 't', bottom: 'b', left: 'l', right: 'r'});
const LEGEND_POS_BACK = Object.freeze({t: 'top', b: 'bottom', l: 'left', r: 'right'});

/** PptxGenJS addChart options for the legend and the axis titles; `{}` for a chart that uses neither. */
export function classicChartOptions(resolved, {labelColor, font, textSize}) {
  const out = {};
  if (resolved.legend === 'none') out.showLegend = false;
  else if (resolved.legend) Object.assign(out, {showLegend: true, legendPos: LEGEND_POS[resolved.legend]});
  const title = (axis, text) => ({
    [`show${axis}AxisTitle`]: true, [`${axis.toLowerCase()}AxisTitle`]: text,
    [`${axis.toLowerCase()}AxisTitleColor`]: labelColor, [`${axis.toLowerCase()}AxisTitleFontFace`]: font, [`${axis.toLowerCase()}AxisTitleFontSize`]: textSize / 100,
  });
  if (resolved.axisTitles.category) Object.assign(out, title('Cat', resolved.axisTitles.category));
  if (resolved.axisTitles.value) Object.assign(out, title('Val', resolved.axisTitles.value));
  return out;
}

// ---------------------------------------------------------------------------
// Classic data labels

const DLBL_POS = Object.freeze({center: 'ctr', 'inside-end': 'inEnd', 'inside-base': 'inBase', 'outside-end': 'outEnd', above: 't', below: 'b', left: 'l', right: 'r'});
const DLBL_POS_BACK = Object.freeze(Object.fromEntries(Object.entries(DLBL_POS).map(([key, value]) => [value, key])));
const INSIDE = new Set(['center', 'inside-end', 'inside-base']);
const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[char]));

function labelText(color, size, font) {
  const face = escapeXml(font);
  return `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="0" i="0" u="none" strike="noStrike"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>` +
    `<a:latin typeface="${face}"/><a:ea typeface="${face}"/><a:cs typeface="${face}"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`;
}

// The flags and position of a label set, in CT_DLbls order after the text properties.
function labelFlags(labels, {leaderLines}) {
  const has = part => labels.content.includes(part) ? 1 : 0;
  return (labels.position === null ? '' : `<c:dLblPos val="${DLBL_POS[labels.position]}"/>`) +
    '<c:showLegendKey val="0"/>' +
    `<c:showVal val="${has('value')}"/><c:showCatName val="${has('category')}"/><c:showSerName val="0"/><c:showPercent val="${has('percent')}"/><c:showBubbleSize val="0"/>` +
    `<c:separator>${escapeXml(labels.separator)}</c:separator>` +
    (leaderLines ? '<c:showLeaderLines val="0"/>' : '');
}

const dLbl = (index, color, labels, {size, font}) =>
  `<c:dLbl><c:idx val="${index}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${labelText(color, size, font)}${labelFlags(labels, {leaderLines: false})}</c:dLbl>`;

/**
 * Rewrite the c:dLbls of a generated classic chart for the resolved data labels. PptxGenJS writes labels per series and per
 * chart group, with a "General" or "#,##0" number format that differs by type and, on pie and doughnut charts, per point
 * overrides that hide every label; this writes one consistent block everywhere:
 *
 *   - the General number format (the preview prints values the same way) and an explicit separator;
 *   - c:dLblPos only where the chart type has a position choice (core's support table; area, doughnut and radar have none);
 *   - the label text colour: the chart text colour outside a mark, the contrasting colour (core's `textColorForFill`, as the
 *     preview) inside one, per series, and per point on pie and doughnut charts.
 *
 * FA-14: with a chart highlight (`info.highlight`, src/chart-highlight.js) `palette` holds the highlight-aware series colours, and a
 * label inside a mark whose colour differs per point (pie and doughnut slices, columns and bars with a category highlight) is written
 * per point with the colour that contrasts with that point's fill.
 *
 * `info`: {resolved, kind, palette (series colours, hex without #), labelColor, font, textSize, pointCount, highlight?}.
 */
export function applyDataLabels(xml, info) {
  // FA-15: a combo chart labels its column group like clustered columns and its line groups like line points (core's
  // `linePosition`); the series colours run on across the groups.
  if (info.kind === 'combo') {
    let offset = 0;
    return xml.replace(/<c:(barChart|lineChart)>[\s\S]*?<\/c:\1>/g, (group, element) => {
      const line = element === 'lineChart';
      const dataLabels = line ? {...info.resolved.dataLabels, position: info.resolved.dataLabels.linePosition ?? 'above'} : info.resolved.dataLabels;
      const palette = info.palette.slice(offset).concat(info.palette.slice(0, offset));
      offset = (offset + (group.match(/<c:ser>/g)?.length ?? 0)) % Math.max(1, info.palette.length);
      return applyDataLabels(group, {...info, kind: line ? 'line' : 'bar', palette, resolved: {...info.resolved, dataLabels}});
    });
  }
  const {resolved, kind, palette, labelColor, font, textSize, pointCount, highlight} = info;
  const labels = resolved.dataLabels;
  // Where the label sits on its mark: a bar or pie label placed inside the mark, and the labels of an area or a doughnut ring,
  // take the colour that contrasts with the mark; every other label keeps the chart text colour (as the preview does).
  const inside = kind === 'area' || kind === 'doughnut' || (['bar', 'pie', 'histogram', 'pareto', 'waterfall'].includes(kind) && INSIDE.has(labels.position));
  const contrast = fill => String(textColorForFill(`#${fill}`, `#${labelColor}`)).replace(/^#/, '').toUpperCase();
  const block = (color, {points = 0, leaderLines = false, fills} = {}) =>
    `<c:dLbls>${Array.from({length: points}, (_, index) => dLbl(index, inside ? contrast(fills?.[index] ?? palette[index % palette.length]) : labelColor, labels, {size: textSize, font})).join('')}` +
    `<c:numFmt formatCode="General" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${labelText(color, textSize, font)}${labelFlags(labels, {leaderLines})}</c:dLbls>`;
  const circular = kind === 'pie' || kind === 'doughnut';
  const replaceBlocks = (text, make) => text.replace(/<c:dLbls>[\s\S]*?<\/c:dLbls>/g, existing => make(existing));
  // Series-level blocks first (the colour follows the series), then the group-level block each chart group carries.
  let seriesIndex = 0;
  const withSeries = xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, ser => {
    const index = seriesIndex++;
    const color = inside && !circular ? contrast(palette[index % palette.length]) : labelColor;
    const fills = highlight?.pointFills(index);
    const points = circular ? pointCount : inside && fills ? fills.length : 0;
    return replaceBlocks(ser, existing => block(color, {points, fills, leaderLines: /<c:showLeaderLines\b/.test(existing)}));
  });
  const outside = withSeries.split(/(<c:ser>[\s\S]*?<\/c:ser>)/);
  const groupLevel = outside.map((part, index) => index % 2 ? part : replaceBlocks(part, existing => block(labelColor, {leaderLines: /<c:showLeaderLines\b/.test(existing)}))).join('');
  // A chart type without a series- or group-level c:dLbls (scatter and radar carry only the group one) is covered above; one with
  // neither is left as written (every generated type has at least one).
  return groupLevel;
}

// ---------------------------------------------------------------------------
// Import (classic)

const asArray = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const text = node => {
  if (node === undefined || node === null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return node['#text'] !== undefined ? String(node['#text']) : '';
};
const flag = node => node !== undefined && node?.val !== '0' && node?.val !== 'false' && node?.val !== 0;

// The rich-text paragraphs of a c:title (or cx:txData), joined into one plain string; undefined when the title carries no text.
function titleString(title) {
  const rich = title?.['c:tx']?.['c:rich'];
  if (!rich) return undefined;
  const value = asArray(rich['a:p']).map(paragraph => asArray(paragraph['a:r']).map(run => text(run['a:t'])).join('')).join(' ').trim();
  return value || undefined;
}

/**
 * The options of a parsed classic chart (fast-xml-parser, prefixes kept, attributes plain): `{axisTitles?, legend?, dataLabels?}`
 * plus `notes` naming what the three fields cannot express. `defaults` is what an export writes without the field:
 * `{legend: 'right' | undefined}` (a legend at the right of multi-series, pie and doughnut charts) and the chart kind.
 */
export function chartOptionsFromClassic(chartSpace, {chartNode, target, seriesCount, circular, scatter, seriesFormats = [], combo}) {
  const chart = chartSpace?.['c:chart'];
  const plotArea = chart?.['c:plotArea'];
  const out = {};
  const notes = [];

  const axisTitles = {};
  if (scatter) {
    const [x, y] = asArray(plotArea?.['c:valAx']);
    const xTitle = titleString(x?.['c:title']), yTitle = titleString(y?.['c:title']);
    if (xTitle) axisTitles.category = xTitle;
    if (yTitle) axisTitles.value = yTitle;
  } else if (!circular) {
    const category = titleString(asArray(plotArea?.['c:catAx'])[0]?.['c:title']), value = titleString(asArray(plotArea?.['c:valAx'])[0]?.['c:title']);
    if (category) axisTitles.category = category;
    if (value) axisTitles.value = value;
    // FA-15: a combo chart's secondary value axis title.
    const secondary = titleString(combo?.secondaryValueAxis?.['c:title']);
    if (secondary) axisTitles.secondary = secondary;
  }
  if (Object.keys(axisTitles).length) out.axisTitles = axisTitles;

  const defaultLegend = circular || seriesCount > 1;
  const legend = chart?.['c:legend'];
  if (legend) {
    const pos = legend['c:legendPos']?.val ?? 'r';
    const mapped = LEGEND_POS_BACK[pos];
    if (!mapped) notes.push({option: 'legend', message: `The legend position '${pos}' (top right) has no OPF equivalent; it imports as 'right'.`});
    const position = mapped ?? 'right';
    if (!(defaultLegend && position === 'right')) out.legend = position;
  } else if (defaultLegend) out.legend = 'none';

  const dataLabels = classicDataLabels(chartNode, target, notes, seriesFormats, combo);
  if (dataLabels !== undefined) out.dataLabels = dataLabels;
  return {options: out, notes};
}

function classicDataLabels(chartNode, target, notes, seriesFormats = [], combo) {
  const series = asArray(chartNode?.['c:ser']);
  // The labels the chart shows: the first series' block when it has one (PptxGenJS writes pie and doughnut visibility as per
  // point overrides), else the chart group's block.
  const serLabels = series.map(entry => entry?.['c:dLbls']).find(block => block !== undefined);
  const block = serLabels ?? chartNode?.['c:dLbls'];
  if (!block) return undefined;
  const points = asArray(block['c:dLbl']);
  const source = points.length ? points.find(point => String(point?.['c:idx']?.val) === '0') ?? points[0] : block;
  const content = [];
  if (flag(source['c:showCatName'])) content.push('category');
  if (flag(source['c:showVal'])) content.push('value');
  if (flag(source['c:showPercent'])) content.push('percent');
  if (!content.length) return undefined;
  for (const hidden of ['c:showSerName', 'c:showLegendKey', 'c:showBubbleSize']) {
    if (flag(source[hidden])) notes.push({option: 'dataLabels', message: `Data labels that show ${hidden.slice(6)} cannot be expressed; only category, value and percent import.`});
  }
  const support = target ? chartOptionSupport(target) : undefined;
  const numberFormat = source['c:numFmt']?.formatCode ?? block['c:numFmt']?.formatCode;
  // RR-54: a label format that is a series' own number format imports with that column's format (or its own note).
  if (numberFormat && numberFormat !== 'General' && numberFormat !== '#,##0' && numberFormat !== '0%' && !seriesFormats.includes(numberFormat)) notes.push({option: 'dataLabels', message: `The label number format '${numberFormat}' cannot be expressed; labels import in the General format.`});
  const out = {};
  let position = DLBL_POS_BACK[source['c:dLblPos']?.val ?? block['c:dLblPos']?.val];
  if (combo) {
    // FA-15: one OPF position covers both parts. A line position the columns cannot take (below, left, right) was asked for the
    // lines; otherwise the column position (center, inside-end, inside-base) is the one, and 'center' is written to both.
    const lineSeries = asArray(combo.lineNode?.['c:ser']).map(entry => entry?.['c:dLbls']).find(entry => entry !== undefined) ?? combo.lineNode?.['c:dLbls'];
    const linePosition = DLBL_POS_BACK[lineSeries?.['c:dLblPos']?.val];
    if (['below', 'left', 'right'].includes(linePosition)) position = linePosition;
  }
  const supported = support?.dataLabels.positions ?? [];
  if (position && position !== support?.dataLabels.defaultPosition) {
    if (!support || supported.includes(position)) out.position = position;
    else notes.push({option: 'dataLabels.position', message: `The label position '${position}' is not available on this chart type; it imports as the default.`});
  }
  const separator = text(source['c:separator'] ?? block['c:separator']);
  if (content.length > 1 && separator && separator !== ', ') out.separator = separator;
  const nonDefaultContent = !(content.length === 1 && content[0] === 'value');
  if (nonDefaultContent) out.content = content;
  return Object.keys(out).length ? out : true;
}

/** The core option target of a chart type id (undefined for an id outside the catalog). */
export function chartTargetFor(typeId) {
  return chartOptionTarget(typeId);
}

// ---------------------------------------------------------------------------
// Import (chartex)

const CX_POSITION_BACK = Object.freeze({ctr: 'center', inEnd: 'inside-end', inBase: 'inside-base', outEnd: 'outside-end'});
const cxFlag = value => value === '1' || value === 'true' || value === true || value === 1;

function axisTitleText(axis) {
  const value = axis?.['cx:title'];
  // Rich text (what PowerPoint writes for a typed title, and what this exporter writes) or cached formula text (cx:txData/cx:v).
  const rich = value?.['cx:tx']?.['cx:rich'];
  if (rich) {
    const typed = asArray(rich['a:p']).map(paragraph => asArray(paragraph['a:r']).map(run => text(run['a:t'])).join('')).join(' ').trim();
    if (typed) return typed;
  }
  const v = value?.['cx:tx']?.['cx:txData']?.['cx:v'];
  return v === undefined ? undefined : (text(v).trim() || undefined);
}

/**
 * The options of a parsed cx:chartSpace: `{axisTitles?, legend?, dataLabels?}` plus `notes`. A chartex export without the option
 * writes the construct's defaults (a right legend on a multi-series box-and-whisker chart; category names on a treemap, values
 * on a funnel), so only what differs from them is returned.
 */
export function chartOptionsFromChartex(space, {type, seriesCount}) {
  const chart = space?.['cx:chart'];
  const out = {};
  const notes = [];
  const axes = asArray(chart?.['cx:plotArea']?.['cx:axis']);
  const axisTitles = {};
  const category = axisTitleText(axes.find(axis => String(axis?.id) === '0')), value = axisTitleText(axes.find(axis => String(axis?.id) === '1'));
  if (category) axisTitles.category = category;
  if (value) axisTitles.value = value;
  if (Object.keys(axisTitles).length) out.axisTitles = axisTitles;

  const boxWhisker = type === 'box-and-whisker';
  const legend = chart?.['cx:legend'];
  if (legend) {
    const mapped = LEGEND_POS_BACK[legend.pos ?? 'r'] ?? 'right';
    if (boxWhisker && !(seriesCount > 1 && mapped === 'right')) out.legend = mapped;
    else if (!boxWhisker) notes.push({option: 'legend', message: `The '${type}' chart's legend has no OPF option; it is not imported.`});
  } else if (boxWhisker && seriesCount > 1) out.legend = 'none';

  const series = asArray(chart?.['cx:plotArea']?.['cx:plotAreaRegion']?.['cx:series']).find(entry => entry?.ownerIdx === undefined);
  const labels = series?.['cx:dataLabels'];
  const defaultContent = type === 'treemap' ? ['category'] : type === 'funnel' ? ['value'] : undefined;
  if (labels) {
    const visibility = labels['cx:visibility'] ?? {};
    const content = [];
    if (cxFlag(visibility.categoryName)) content.push('category');
    if (cxFlag(visibility.value)) content.push('value');
    if (cxFlag(visibility.seriesName)) notes.push({option: 'dataLabels', message: 'Chartex data labels that show the series name cannot be expressed; only category and value import.'});
    const position = CX_POSITION_BACK[labels.pos];
    const support = chartOptionSupport(chartOptionTarget(type) ?? {kind: type});
    const isDefault = defaultContent && content.length === defaultContent.length && content.every((part, index) => part === defaultContent[index]) && (!position || position === 'center');
    const separator = text(labels['cx:separator']);
    const result = {};
    if (!(content.length === 1 && content[0] === 'value')) result.content = content.length ? content : undefined;
    if (position && position !== support?.dataLabels.defaultPosition && (support?.dataLabels.positions ?? [position]).includes(position)) result.position = position;
    if (content.length > 1 && separator && separator !== ', ') result.separator = separator;
    for (const key of Object.keys(result)) if (result[key] === undefined) delete result[key];
    if (content.length && !(isDefault && !result.separator)) out.dataLabels = Object.keys(result).length ? result : true;
    else if (!content.length && defaultContent) out.dataLabels = false;
  } else if (defaultContent) out.dataLabels = false;
  return {options: out, notes};
}
