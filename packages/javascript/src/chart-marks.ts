// LH-107 to LH-110: the chart follow-ups from the Claude Design chart comparison (layout harvest chart corpus s09, s13, s14, s16, s17,
// s18, s24). Composition decides them with the rest of the chart layer (chart-layer.ts), so the preview (opf-render) and the PPTX export
// (opf-pptx) draw the same chart:
//
//   waterfall roles (LH-107)   a waterfall's bars by role: the totals (the last bar when it is the sum before it, and the first bar it
//                              starts from) in the strong colour, the gains in the accent, the losses in the context gray, each bar
//                              with its signed value (+9.3, −7.4; a total unsigned) and the value axis dropped; dashed connectors.
//   value list (LH-108)        a pie or one-series doughnut of two to eight categories in a box wide enough draws a value list beside it
//                              (swatch, category, value right-aligned, the focused rows bold) instead of slice labels or a legend.
//   stacked values (LH-109)    a stacked column or area chart draws each segment's value inside it when it fits, and names its series
//                              beside the last column or band (swatch and name) instead of a legend.
//   title references (LH-110)  a column, line or area chart whose title compares with a number the data does not hold ("stayed above
//                              92%") draws a dashed reference line at that value, labeled as the title writes it; a line or area chart
//                              in time whose title names one period ("overtook on-premises in 2023") shades that period's band.
//
// An explicit option wins: `dataLabels` and `legend` keep the chart as authored (no default labels, no list, no names), `colors` keeps
// a waterfall's palette positions. PPTX import does not write these defaults back as options.
import {chartTextSize, stackCategoryValues, waterfallSteps, type ChartValueAxis} from './chart-axis.js';
import {chartNumber, resolveChartData, type ResolvedChartData} from './chart-data.js';
import {titleNumbers, words, type ChartLayerFocus} from './chart-focus.js';
import {valueLabel, type ChartLayer, type ChartLayerGeometry, type ChartLayerHeader, type ChartLayerSlices} from './chart-layer.js';
import {chartPlotInset, type ChartPlotGeometry} from './chart-plot.js';
import {chartCategoriesInTime, monthOf} from './chart-time-order.js';

interface Box { x: number; y: number; width: number; height: number }

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const label = (value: unknown): string => value === null || value === undefined ? '' : String(value).replace(/[\r\n]+/g, ' ').trim();
const nonBlank = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const typeOf = (chart: unknown): string => record(chart) && typeof chart.type === 'string' ? chart.type.trim().toLowerCase() : '';
const usable = (box: Box, scale: number) => [box.x, box.y, box.width, box.height, scale].every(Number.isFinite) && box.width > 0 && box.height > 0 && scale > 0;

/** The lengths the preview draws chart text with, for a chart box. */
function metrics(box: Box, scale: number, minFontSize: number | undefined) {
  const fontPx = chartTextSize({width: box.width, height: box.height, scale, minFontSize}) * scale;
  return {fontPx, pad: 10 * scale, lineHeight: fontPx * 1.5, textHeight: fontPx * 1.22};
}

/** A caption-only header row (LH-81's metrics): the caption bold at the start of one row above the plot. */
function captionHeader(text: string, geometry: ChartLayerGeometry): ChartLayerHeader {
  const {box, scale} = geometry, {fontPx, pad, lineHeight} = metrics(box, scale, geometry.minFontSize);
  const width = Math.min(Math.max(1, box.width - 2 * pad), geometry.measure(text, fontPx, 700));
  const x = geometry.direction === 'rtl' ? box.x + box.width - pad - width : box.x + pad;
  return {caption: {text, box: {x, y: box.y + pad, width, height: lineHeight}}, height: pad + lineHeight};
}

// ---------------------------------------------------------------------------------------------------------------------------------
// LH-107: waterfall roles

/** LH-107: the role of a waterfall bar. */
export type WaterfallRole = 'total' | 'increase' | 'decrease';

/** LH-107: how a waterfall is drawn. */
export interface ChartLayerWaterfall {
  /** The role of each row's bar; null for a row without a value. */
  roles: (WaterfallRole | null)[];
  /** True when every bar carries its signed value by default (the chart has no `dataLabels`, and the labels fit). */
  labels: boolean;
  /** False when the value axis is dropped: the labels carry the values (the chart has no value axis title). */
  valueAxis: boolean;
  /** True when the bars take the role colours (core `chartWaterfallColors`); a chart with `colors` keeps its palette positions. */
  colors: boolean;
}

/**
 * LH-107: the role of each bar of a waterfall's values (core `waterfallSteps`): a total (LH-59: the last value when it equals the sum
 * before it), an increase or a decrease. When the last bar is a total, the first bar is the opening total it runs from (a bar from zero,
 * "2024 profit"), and takes the total's role too.
 */
export function waterfallRoles(values: readonly (number | null)[]): (WaterfallRole | null)[] {
  const roles: (WaterfallRole | null)[] = values.map(() => null);
  let steps: ReturnType<typeof waterfallSteps>;
  try { steps = waterfallSteps(values); } catch { return roles; }
  for (const step of steps) roles[step.index] = step.total ? 'total' : step.value < 0 ? 'decrease' : 'increase';
  if (steps.length > 2 && steps.at(-1)!.total) roles[steps[0]!.index] = 'total';
  return roles;
}

/** LH-107: a waterfall bar's default label: a total as its value, a step signed (+9.3, −7.4 with U+2212), in the column's format. */
export function waterfallLabelText(value: number, format: string | undefined, role: WaterfallRole | null): string {
  if (role === 'total' || value === 0) return valueLabel(value, format);
  return `${value > 0 ? '+' : '−'}${valueLabel(Math.abs(value), format)}`;
}

/**
 * LH-107: the number format a native waterfall label shows a step with: the column's format (its first section; General without one)
 * after a `+` for a gain and a U+2212 minus for a loss, as `waterfallLabelText` prints it. A total keeps the column's own format.
 */
export function waterfallSignedFormat(format: string | undefined): string {
  const first = (format && format.trim() ? format : 'General').split(';')[0]!;
  return `"+"${first};"−"${first};${first}`;
}

/**
 * LH-107: the waterfall treatment of a chart (`chart` the drawn chart, `data` its resolved data: categories and one value column, or a lone value column), with the caption
 * header the dropped value axis leaves: the column's name (or the value axis title) above the plot. The labels are the default unless
 * `dataLabels` is set, and are kept only when the widest fits its category band (the bars stand 1.5 bands apart); the value axis goes
 * with default labels unless it has a title.
 */
export function chartWaterfall(chart: unknown, data: ResolvedChartData, geometry: ChartLayerGeometry): {waterfall: ChartLayerWaterfall; header?: ChartLayerHeader} | undefined {
  if (!record(chart) || !data.ok || typeOf(chart) !== 'waterfall' || data.columns.length > 2 || !data.rows.length) return undefined;
  // A lone value column has no categories (the rows are numbered); otherwise the categories come first.
  const column = data.columns.length === 1 ? 0 : 1;
  const values = data.rows.map(row => chartNumber(row[column]));
  const roles = waterfallRoles(values);
  if (!roles.some(Boolean)) return undefined;
  const {box, scale} = geometry;
  const format = typeof data.formats[column] === 'string' && data.formats[column] !== '' ? data.formats[column] : undefined;
  let labels = chart.dataLabels === undefined;
  if (labels && usable(box, scale)) {
    const {fontPx, pad} = metrics(box, scale, geometry.minFontSize);
    const band = Math.max(1, box.width - 2 * pad) / data.rows.length;
    const widest = Math.max(0, ...values.map((value, index) => value === null ? 0 : geometry.measure(waterfallLabelText(value, format, roles[index]!), fontPx, roles[index] === 'total' ? 700 : 400)));
    if (widest + fontPx * 0.25 > band) labels = false;
  }
  const titled = record(chart.axisTitles) && nonBlank(chart.axisTitles.value) !== undefined;
  const valueAxis = !labels || titled;
  const waterfall: ChartLayerWaterfall = {roles, labels, valueAxis, colors: chart.colors === undefined};
  const caption = valueAxis || geometry.captioned || !usable(box, scale) ? undefined : (record(chart.axisTitles) ? nonBlank(chart.axisTitles.value) : undefined) ?? (label(data.columns[column]) || undefined);
  return {waterfall, ...(caption ? {header: captionHeader(caption, geometry)} : {})};
}

// ---------------------------------------------------------------------------------------------------------------------------------
// LH-108: the value list beside a pie

/** LH-108: a pie or doughnut draws a value list of at most this many categories. */
export const CHART_VALUE_LIST_MAX_ROWS = 8;
/** LH-108: a slice under this share of the total cannot hold its name; the list may then take the pie down to 80% of its radius. */
export const CHART_VALUE_LIST_SMALL_SLICE = 0.1;

/** LH-108: one row of the value list: its category, the value as the column's format prints it, and the row's box (slide pixels). */
export interface ChartValueListRow { row: number; name: string; value: string; bold?: boolean; box: Box }

/** LH-108: the value list beside a pie or one-series doughnut. Boxes are slide pixels. */
export interface ChartLayerValueList {
  /** The square the pie (or doughnut) fills. */
  pie: Box;
  /** The values' unit above the value column (the value column's name or the value axis title), at the end of the list's first line. */
  header?: {text: string; box: Box};
  rows: ChartValueListRow[];
  /** The swatch side and the space after it. */
  swatch: number;
  gap: number;
}

/**
 * LH-108: the value list of a pie or one-series doughnut (the drawn type) without `legend` or `dataLabels`, or undefined when its slice
 * labels (LH-105) or legend read better. The list is one row per category with a value (two to eight): a swatch in the slice's colour,
 * the category, and its value right-aligned in the column's number format; the rows the title names (`focus`, LH-105) are bold. It takes
 * the end of the chart box (the start right to left), 45% of it or what its text needs, the pie the rest, two text sizes apart; the rows
 * are up to 2.4 lines apart and at least 1.25. It is drawn only when the pie keeps the radius it has alone in the box (90% of half the
 * shorter side), or 80% of it when a slice is under 10% of the total or the slice names do not all sit inside their slices (`slices`):
 * then the names would sit outside the pie or in a legend anyway.
 */
export function chartValueList(chart: unknown, data: ResolvedChartData, geometry: ChartLayerGeometry, options: {focus?: ChartLayerFocus; slices?: ChartLayerSlices} = {}): ChartLayerValueList | undefined {
  if (!record(chart) || !data.ok || data.columns.length !== 2) return undefined;
  const type = typeOf(chart);
  if ((type !== 'pie' && type !== 'doughnut') || chart.legend !== undefined || chart.dataLabels !== undefined) return undefined;
  const {box, scale} = geometry;
  if (!usable(box, scale)) return undefined;
  const values = data.rows.map(row => chartNumber(row[1]));
  const shown = values.flatMap((value, row) => value !== null && value > 0 ? [{row, value}] : []);
  if (shown.length < 2 || shown.length > CHART_VALUE_LIST_MAX_ROWS) return undefined;
  const total = shown.reduce((sum, entry) => sum + entry.value, 0);
  if (!(total > 0) || !Number.isFinite(total)) return undefined;
  const {fontPx, pad, lineHeight} = metrics(box, scale, geometry.minFontSize);
  const format = typeof data.formats[1] === 'string' && data.formats[1] !== '' ? data.formats[1] : undefined;
  const bold = new Set(options.focus?.categories ?? []);
  const entries = shown.map(({row, value}) => ({row, name: label(data.rows[row]![0]), value: valueLabel(value, format), bold: bold.has(row)}));
  const width = (text: string, heavy: boolean) => geometry.measure(text, fontPx, heavy ? 700 : 400);
  const swatch = Math.round(fontPx * 0.75 * 100) / 100, gap = fontPx * 0.5;
  const needed = swatch + gap + Math.max(...entries.map(entry => width(entry.name, entry.bold))) + 2 * fontPx + Math.max(...entries.map(entry => width(entry.value, entry.bold)));
  const area = {x: box.x + pad, y: box.y + pad, width: Math.max(1, box.width - 2 * pad), height: Math.max(1, box.height - 2 * pad)};
  const listWidth = Math.max(needed, Math.min(area.width * 0.45, needed * 1.5)), between = 2 * fontPx;
  const pieWidth = area.width - listWidth - between;
  if (pieWidth <= 0) return undefined;
  const header = (record(chart.axisTitles) ? nonBlank(chart.axisTitles.value) : undefined) ?? (label(data.columns[1]) || undefined);
  const headerHeight = header ? lineHeight : 0;
  const pitch = Math.min(lineHeight * 2.4, (area.height - headerHeight) / entries.length);
  if (pitch < lineHeight * 1.25) return undefined;
  // The pie keeps its radius beside the list; a slice too small for its name (or names that leave the pie) allows 80% of it.
  const alone = Math.min(area.width, area.height) / 2 * 0.9, radius = Math.min(pieWidth, area.height) / 2 * 0.9;
  const crowded = shown.some(entry => entry.value / total < CHART_VALUE_LIST_SMALL_SLICE) || !options.slices || options.slices.labels.some(entry => entry.position === 'outside');
  if (radius < alone * (crowded ? 0.8 : 1) - 0.5) return undefined;
  const rtl = geometry.direction === 'rtl';
  const mirror = (part: Box): Box => rtl ? {...part, x: box.x + box.width - (part.x - box.x) - part.width} : part;
  const pie = mirror({x: area.x + pieWidth / 2 - radius, y: area.y + area.height / 2 - radius, width: 2 * radius, height: 2 * radius});
  const listX = area.x + pieWidth + between, listHeight = headerHeight + entries.length * pitch, top = area.y + (area.height - listHeight) / 2;
  return {
    pie,
    ...(header ? {header: {text: header, box: mirror({x: listX, y: top, width: listWidth, height: lineHeight})}} : {}),
    rows: entries.map((entry, index) => ({row: entry.row, name: entry.name, value: entry.value, ...(entry.bold ? {bold: true} : {}),
      box: mirror({x: listX, y: top + headerHeight + index * pitch, width: listWidth, height: pitch})})),
    swatch, gap,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// LH-109: values inside stacked segments, names beside the last column

const STACKED: Readonly<Record<string, 'bar' | 'area'>> = {'stacked-column': 'bar', '100pct-stacked-column': 'bar', 'stacked-area': 'area', '100pct-stacked-area': 'area'};

/** LH-109: one series name beside the last column or band: its swatch and name in `box`, centred on its segment's middle when it can be. */
export interface ChartStackName { series: number; name: string; bold?: boolean; box: Box }

/** LH-109: how a stacked column or area chart labels itself. */
export interface ChartLayerStack {
  /** `values[series][row]`: true when that segment's value is drawn inside it (its text fits the segment). */
  values: boolean[][];
  /** The series names beside the last column or band, and the gutter the plot leaves for them at its end; absent when the legend stays. */
  names?: {gutter: number; swatch: number; entries: ChartStackName[]};
}

/** True for a stacked column or area chart (not horizontal) of two to six series without `dataLabels` or `legend`. */
function stackCandidate(chart: unknown, data: ResolvedChartData): chart is Record<string, unknown> {
  if (!record(chart) || !data.ok || data.combo || !Object.hasOwn(STACKED, typeOf(chart))) return false;
  const series = data.columns.length - 1;
  return series >= 2 && series <= 6 && data.rows.length >= 1 && chart.dataLabels === undefined && chart.legend === undefined;
}

const entryCount = (data: ResolvedChartData): number => data.ok ? data.rows.length : 0;

/** The plot box of an inset. */
const plotOf = (box: Box, inset: {left: number; top: number; right: number; bottom: number}): Box => ({x: box.x + inset.left, y: box.y + inset.top, width: box.width - inset.left - inset.right, height: box.height - inset.top - inset.bottom});

/** The stacked segments of a chart as the preview draws them, with the plot's value-to-y mapping. */
function segments(chart: Record<string, unknown>, data: ResolvedChartData, axis: ChartValueAxis, plot: Box) {
  if (!data.ok) return undefined;
  const kind = STACKED[typeOf(chart)]!, percent = typeOf(chart).startsWith('100pct');
  const series = data.columns.slice(1).map((_, j) => ({values: data.rows.map(row => chartNumber(row[j + 1]))}));
  let stacks: ReturnType<typeof stackCategoryValues>;
  try { stacks = stackCategoryValues(series, data.rows.length, kind, percent ? 'percentStacked' : 'stacked'); } catch { return undefined; }
  const at = (value: number) => plot.y + (axis.max - Math.min(axis.max, Math.max(axis.min, value))) / (axis.max - axis.min) * plot.height;
  return {kind, series, stacks, at, band: plot.width / data.rows.length};
}

/**
 * LH-109: which segment values fit inside their segments (none on a 100% stacked chart, whose axis reads shares): the value's text (the column's format) plus a quarter text size within the
 * column's width (a band over 1.5, the preview's stacked bar) or, on an area, 90% of the category band, and a text line within the segment's
 * height.
 */
function stackValueFits(chart: Record<string, unknown>, data: ResolvedChartData, axis: ChartValueAxis, plot: Box, geometry: Omit<ChartPlotGeometry, 'box'> & {box: Box}): boolean[][] | undefined {
  const shape = segments(chart, data, axis, plot);
  if (!shape || !data.ok) return undefined;
  const {fontPx, textHeight} = metrics(geometry.box, geometry.scale, geometry.minFontSize);
  const room = shape.kind === 'bar' ? shape.band / 1.5 : shape.band * 0.9, last = entryCount(data) - 1;
  // A 100% stacked chart reads shares on its axis; the raw values (which a native label shows) would contradict it.
  const percent = typeOf(chart).startsWith('100pct');
  return shape.series.map((entry, j) => entry.values.map((value, i) => {
    const point = shape.stacks[j]![i];
    if (percent || value === null || !point || value === 0) return false;
    // An area starts and ends at its first and last points: a value centred there would hang half outside the band.
    if (shape.kind === 'area' && (i === 0 || i === last)) return false;
    const format = typeof data.formats[j + 1] === 'string' && data.formats[j + 1] !== '' ? data.formats[j + 1] : undefined;
    const height = Math.abs(shape.at(point.to) - shape.at(point.from));
    return geometry.measure(valueLabel(value, format), fontPx) + fontPx * 0.25 <= room && textHeight <= height;
  }));
}

/**
 * LH-109: the series names beside the last column (or band) of a stacked chart for a plot, or undefined when they cannot be placed: each
 * name (a swatch 0.6 text sizes square, 0.4 of space and the name) centred on its segment's middle in the last category, a quarter text
 * size past the column's edge (the band's end on an area); then moved apart in segment order so no two are closer than a text line,
 * within the plot. `relaxed` places them however far they move (after a shared plot moved them); otherwise a name moved more than a
 * line from its segment fails, and the chart keeps its legend.
 */
export function placeStackNames(chart: unknown, data: ResolvedChartData, axis: ChartValueAxis, box: Box, plotInset: {left: number; top: number; right: number; bottom: number}, geometry: Omit<ChartPlotGeometry, 'box'> & {bold?: (text: string, size: number) => number}, relaxed = false, focus?: readonly number[]): ChartStackName[] | undefined {
  if (!stackCandidate(chart, data) || !data.ok || !(axis.max > axis.min)) return undefined;
  const plot = plotOf(box, plotInset);
  if (!(plot.width > 1 && plot.height > 1)) return undefined;
  const shape = segments(chart, data, axis, plot);
  if (!shape) return undefined;
  const {fontPx, textHeight, lineHeight} = metrics(box, geometry.scale, geometry.minFontSize);
  const rtl = geometry.direction === 'rtl', last = data.rows.length - 1;
  // The last category is the rightmost (the leftmost right to left); the names start past the column's edge or the band's end.
  const centre = plot.x + ((rtl ? 0 : last) + 0.5) * shape.band, reach = shape.kind === 'bar' ? shape.band / 3 : 0;
  const edge = rtl ? centre - reach - fontPx * 0.25 : centre + reach + fontPx * 0.25;
  const swatch = fontPx * 0.6;
  const placed = shape.series.map((_, j) => {
    const point = shape.stacks[j]![last], name = label(data.columns[j + 1]), bold = focus?.includes(j) === true;
    const y = point ? shape.at((point.from + point.to) / 2) : shape.at(0);
    const width = swatch + fontPx * 0.4 + (bold && geometry.bold ? geometry.bold(name, fontPx) : geometry.measure(name, fontPx)) + fontPx * 0.25;
    return {j, name, bold, y, width};
  });
  const order = [...placed].sort((a, b) => a.y - b.y || b.j - a.j);
  const centres = order.map(entry => entry.y);
  const top = plot.y + textHeight / 2, bottom = plot.y + plot.height - textHeight / 2;
  if ((order.length - 1) * textHeight > bottom - top + 1e-6) return undefined;
  for (let index = 0; index < centres.length; index++) centres[index] = Math.max(centres[index]!, index ? centres[index - 1]! + textHeight : top);
  for (let index = centres.length - 1; index >= 0; index--) centres[index] = Math.min(centres[index]!, index === centres.length - 1 ? bottom : centres[index + 1]! - textHeight);
  for (let index = 0; index < centres.length; index++) centres[index] = Math.max(centres[index]!, index ? centres[index - 1]! + textHeight : top);
  if (!relaxed && order.some((entry, index) => Math.abs(centres[index]! - entry.y) > textHeight + 1e-6)) return undefined;
  const entries = order.map((entry, index): ChartStackName => ({series: entry.j, name: entry.name, ...(entry.bold ? {bold: true} : {}),
    box: {x: rtl ? edge - entry.width : edge, y: centres[index]! - lineHeight / 2, width: entry.width, height: lineHeight}}));
  // The names must stay inside the chart box.
  if (!relaxed && entries.some(entry => entry.box.x < box.x - 0.5 || entry.box.x + entry.box.width > box.x + box.width + 0.5)) return undefined;
  return entries.sort((a, b) => a.series - b.series);
}

/**
 * LH-109: the stacked-chart layer and value axis, or undefined for another chart. The header row is laid out again with its caption only
 * and the plot with a gutter at its end as wide as the widest name (LH-105's end-label layout); when the names cannot be placed the chart
 * keeps its header legend and the plot is laid out under it. Either way the plot is pinned (`layer.plot`, which the PPTX export writes as the
 * plot area's inner layout), and the values that fit their segments are recorded.
 */
export function chartStack(chart: unknown, data: ResolvedChartData, layer: ChartLayer | undefined, geometry: ChartLayerGeometry, axisFor: (headerHeight: number) => ChartValueAxis | undefined, header: (legend: boolean) => ChartLayerHeader | undefined): {layer: ChartLayer; valueAxis: ChartValueAxis} | undefined {
  if (!stackCandidate(chart, data) || !data.ok) return undefined;
  const {box, scale} = geometry;
  if (!usable(box, scale)) return undefined;
  const {fontPx} = metrics(box, scale, geometry.minFontSize);
  const measure = (text: string, size: number) => geometry.measure(text, size, 400), bold = (text: string, size: number) => geometry.measure(text, size, 700);
  const plotGeometry = {scale, minFontSize: geometry.minFontSize, measure, direction: geometry.direction, language: geometry.language};
  const focus = layer?.focus?.series;
  const swatch = fontPx * 0.6;
  // With names: the caption alone above the plot, and a gutter for the widest name past the last column.
  const named = (() => {
    const captionOnly = header(false);
    const valueAxis = axisFor(captionOnly?.height ?? 0);
    if (!valueAxis) return undefined;
    const {header: _header, ...rest} = layer ?? {};
    const base: ChartLayer = {...rest, ...(captionOnly ? {header: captionOnly} : {})};
    const gutter = fontPx * 0.25 + Math.max(...data.columns.slice(1).map((name, j) => swatch + fontPx * 0.4 + (focus?.includes(j) ? bold : measure)(label(name), fontPx) + fontPx * 0.25));
    const plot = chartPlotInset(chart, data, {valueAxis, layer: {...base, stack: {values: [], names: {gutter, swatch, entries: []}}}}, {...plotGeometry, box});
    if (!plot) return undefined;
    const entries = placeStackNames(chart, data, valueAxis, box, plot, {...plotGeometry, bold}, false, focus);
    return entries ? {layer: {...base, plot, stack: {values: [], names: {gutter, swatch, entries}}}, valueAxis} : undefined;
  })();
  const result = named ?? (() => {
    const valueAxis = axisFor(layer?.header?.height ?? 0);
    const plot = valueAxis ? chartPlotInset(chart, data, {valueAxis, layer}, {...plotGeometry, box}) : undefined;
    return valueAxis && plot ? {layer: {...layer, plot, stack: {values: []}} as ChartLayer, valueAxis} : undefined;
  })();
  if (!result) return undefined;
  const values = stackValueFits(chart, data, result.valueAxis, plotOf(box, result.layer.plot!), {...plotGeometry, box});
  if (!values) return undefined;
  result.layer.stack = {...result.layer.stack!, values};
  return result;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// LH-110: reference lines and bands the title names

/** LH-110: a dashed reference line at a value the title names, with its label (the number as the title writes it). Slide pixels. */
export interface ChartReferenceLine { value: number; text: string; y: number; x1: number; x2: number; label: Box }
/** LH-110: the shaded band of the period (category) the title names. Slide pixels. */
export interface ChartReferenceBand { row: number; box: Box }
/** LH-110: the reference marks of a chart. */
export interface ChartLayerReferences { lines: ChartReferenceLine[]; bands: ChartReferenceBand[] }

const LINE_TYPES = new Set(['column', 'line', 'line-with-markers', 'area']);
const BAND_TYPES = new Set(['line', 'line-with-markers', 'stacked-line', 'stacked-line-with-markers', 'area', 'stacked-area', '100pct-stacked-area']);
// English comparisons that name a threshold, right before the number (articles and "of" may stand between): "stayed above 92%",
// "beat the target of 30", "at least 1,000". Conservative on purpose: a number after any other word is a data value or not a reference.
const COMPARISON = /\b(?:above|below|over|under|exceed(?:s|ed|ing)?|surpass(?:es|ed|ing)?|beat(?:s|ing)?|top(?:s|ped)?|cross(?:es|ed|ing)?|reach(?:es|ed|ing)?|at least|at most|more than|less than|fewer than|within|beyond|target|goal|threshold|limit|cap|benchmark)(?:\s+(?:the|a|an|its|our|their|of|target|goal|threshold|limit|benchmark))*\s+$/i;
const PERIOD_PREPOSITIONS = new Set(['in', 'since', 'during', 'after', 'from', 'until', 'before', 'by', 'around']);

/**
 * LH-110: what the slide title (and subtitle) `text` names for reference marks, or undefined: `lines`, the numbers it compares the data
 * with (an English comparison right before the number, as `COMPARISON` lists) that no plotted value equals at the precision written, of
 * the value axis' kind (a percent only on a percent column) and within the data's range widened by its span on each side; `rows`, the one
 * category it names after a time preposition ("in 2023", "since March") on a line or area chart whose categories run in time. Column,
 * line and area charts (not stacked) take lines; line and area charts take bands. English titles only; `highlight` keeps the chart as
 * authored.
 */
export function chartTitleReferences(chart: unknown, data: ResolvedChartData, options: {text?: string; language?: string} = {}): {lines: {value: number; text: string}[]; rows: number[]} | undefined {
  if (!record(chart) || !data.ok || data.combo || chart.highlight !== undefined || !options.text?.trim()) return undefined;
  const language = options.language || 'en';
  if (!/^en(?:-|$)/i.test(language)) return undefined;
  const type = typeOf(chart);
  if (!LINE_TYPES.has(type) && !BAND_TYPES.has(type)) return undefined;
  if (data.columns.length < 2 || !data.rows.length) return undefined;
  const lines: {value: number; text: string}[] = [];
  if (LINE_TYPES.has(type)) {
    const format = typeof data.formats[1] === 'string' ? data.formats[1] : '';
    const values = data.rows.flatMap(row => row.slice(1).map(chartNumber)).filter((value): value is number => value !== null);
    if (values.length) {
      const lo = Math.min(...values), hi = Math.max(...values), span = Math.max(hi - lo, Math.abs(hi) * 0.05);
      for (const number of titleNumbers(options.text)) {
        if (!COMPARISON.test(number.before) || number.percent !== format.includes('%')) continue;
        const target = number.percent ? number.value / 100 : number.value, decimals = number.percent ? number.decimals + 2 : number.decimals;
        if (values.some(value => Math.abs(Number(value.toFixed(decimals)) - target) < 10 ** -(decimals + 6))) continue;
        if (target < lo - span || target > hi + span || lines.some(line => line.value === target)) continue;
        lines.push({value: target, text: number.text});
      }
    }
  }
  const rows: number[] = [];
  const categories = data.rows.map(row => label(row[0]));
  if (BAND_TYPES.has(type) && chartCategoriesInTime(data.rows.map(row => row[0]), {title: label(data.columns[0]), language})) {
    const title = words(options.text, language);
    const after = (at: number) => at > 0 && PERIOD_PREPOSITIONS.has(title[at - 1]!);
    categories.forEach((category, row) => {
      const tokens = words(category, language);
      if (!tokens.length) return;
      for (let at = 0; at + tokens.length <= title.length; at++) {
        if (tokens.every((token, index) => token === title[at + index]) && after(at)) { rows.push(row); return; }
      }
      const month = monthOf(category, language);
      if (month !== undefined && title.some((word, at) => monthOf(word, language) === month && after(at))) rows.push(row);
    });
  }
  const band = rows.length === 1 ? rows : [];
  return lines.length || band.length ? {lines: lines.slice(0, 2), rows: band} : undefined;
}

/**
 * LH-110: the reference marks for a plot: each line across the plot at its value, its label bold at the plot's start (the right end right to
 * left), under the line when the first point lies above it and the label fits under it, else over it; each band 60% of its category's
 * width over the plot's height. The value axis must hold every line's value (composition widens it).
 */
export function placeReferences(refs: {lines: readonly {value: number; text: string}[]; rows: readonly number[]}, data: ResolvedChartData, axis: ChartValueAxis, box: Box, plotInset: {left: number; top: number; right: number; bottom: number}, geometry: Omit<ChartPlotGeometry, 'box'> & {bold?: (text: string, size: number) => number}): ChartLayerReferences | undefined {
  if (!data.ok || !(axis.max > axis.min)) return undefined;
  const plot = plotOf(box, plotInset);
  if (!(plot.width > 1 && plot.height > 1)) return undefined;
  const {fontPx, lineHeight} = metrics(box, geometry.scale, geometry.minFontSize);
  const rtl = geometry.direction === 'rtl', count = data.rows.length, band = plot.width / count;
  const at = (value: number) => plot.y + (axis.max - value) / (axis.max - axis.min) * plot.height;
  const first = data.rows.map(row => chartNumber(row[1])).find((value): value is number => value !== null);
  const lines = refs.lines.filter(line => line.value >= axis.min && line.value <= axis.max).map((line): ChartReferenceLine => {
    const y = at(line.value), width = (geometry.bold ?? geometry.measure)(line.text, fontPx) + fontPx * 0.5;
    const below = first !== undefined && first > line.value && y + fontPx * 0.1 + lineHeight <= plot.y + plot.height + 0.5;
    const x = rtl ? plot.x + plot.width - width : plot.x;
    return {value: line.value, text: line.text, y, x1: plot.x, x2: plot.x + plot.width, label: {x, y: below ? y + fontPx * 0.1 : y - fontPx * 0.1 - lineHeight, width, height: lineHeight}};
  });
  const bands = refs.rows.filter(row => row >= 0 && row < count).map((row): ChartReferenceBand => {
    const slot = rtl ? count - 1 - row : row;
    return {row, box: {x: plot.x + (slot + 0.2) * band, y: plot.y, width: band * 0.6, height: plot.height}};
  });
  return lines.length || bands.length ? {lines, bands} : undefined;
}

/** A composed chart item, as composition hands it to {@link refreshChartMarks}. */
interface ComposedChartItem { value: unknown; box: Box; chart?: {valueAxis?: ChartValueAxis; layer?: ChartLayer} }

/**
 * LH-109, LH-110 with LH-93: after sibling charts share one plot height, the names beside a stacked chart's last column and the reference
 * marks are placed again against the chart's new plot.
 */
export function refreshChartMarks(items: readonly ComposedChartItem[], geometryFor: (item: ComposedChartItem) => Omit<ChartPlotGeometry, 'box'> & {bold?: (text: string, size: number) => number}, document?: unknown): void {
  for (const item of items) {
    const layer = item.chart?.layer, axis = item.chart?.valueAxis;
    if (!layer?.plot || !axis || (!layer.stack?.names && !layer.references)) continue;
    const data = resolveChartData(item.value, document), geometry = geometryFor(item);
    let next: ChartLayer = layer;
    if (layer.stack?.names) {
      const entries = placeStackNames(item.value, data, axis, item.box, layer.plot, geometry, true, layer.focus?.series);
      if (entries) next = {...next, stack: {...layer.stack, names: {...layer.stack.names, entries}}};
    }
    if (layer.references) {
      const references = placeReferences({lines: layer.references.lines, rows: layer.references.bands.map(band => band.row)}, data, axis, item.box, layer.plot, geometry);
      if (references) next = {...next, references};
    }
    item.chart!.layer = next;
  }
}
