// LH-107 to LH-110, LH-125: the chart follow-ups from the Claude Design chart comparison (layout harvest chart corpus s09, s13, s14, s16, s17,
// s18, s24). Composition decides them with the rest of the chart layer (chart-layer.ts), so the preview (opf-render) and the PPTX export
// (opf-pptx) draw the same chart:
//
//   waterfall roles (LH-107)   a waterfall's bars by role: the totals (the last bar when it is the sum before it, and the first bar it
//                              starts from) in the strong color, the gains in the accent, the losses in the context gray, each bar
//                              with its signed value (+9.3, −7.4; a total unsigned) and the value axis dropped; dashed connectors.
//   value list (LH-108)        a pie or one-series doughnut of two to eight categories in a box wide enough draws a value list beside it
//                              (swatch, category, value right-aligned, the focused rows bold) instead of slice labels or a legend.
//   stacked values (LH-109)    a stacked column or area chart draws each segment's value inside it when it fits, and names its series
//                              beside the last column or band (swatch and name) instead of a legend.
//   stacked bars (LH-125)      a horizontal stacked bar chart does the same: values inside its segments, its series named in a row above
//                              the plot, each name where its segment starts in the first bar. A stacked area runs edge to edge, with
//                              its first and last values inside the band at the plot's edges. A doughnut prints the value of the one
//                              slice the title names in its hole.
//   title references (LH-110)  a column, line or area chart whose title compares with a number the data does not hold ("stayed above
//                              92%") draws a dashed reference line at that value, labeled as the title writes it; a line or area chart
//                              in time whose title names one period ("overtook on-premises in 2023") shades that period's band.
//
// An explicit option wins: `dataLabels` and `legend` keep the chart as authored (no default labels, no list, no names), `colors` keeps
// a waterfall's palette positions. PPTX import does not write these defaults back as options.
import {chartTextSize, stackCategoryValues, waterfallSteps, type ChartValueAxis} from './chart-axis.js';
import {chartNumber, numberFormatError, resolveChartData, type ResolvedChartData} from './chart-data.js';
import {titleNumbers, words, type ChartLayerFocus} from './chart-focus.js';
import type {ChartLayerRows} from './chart-rows.js';
import {chartBarGeometry, columnGroups, columnValueLabel, valueLabel, type ChartLayer, type ChartLayerGeometry, type ChartLayerHeader, type ChartLayerSlices, type ChartPlotInset} from './chart-layer.js';
import {chartOptionTarget, resolveChartOptions} from './chart-options.js';
import {BREAKABLE, chartPlotInset, tickLabel, type ChartPlotGeometry} from './chart-plot.js';
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
  /** True when the bars take the role colors (core `chartWaterfallColors`); a chart with `colors` keeps its palette positions. */
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

/**
 * LH-107: a waterfall bar's default label: a total as its value, a step signed (+9.3, −7.4 with U+2212), in the column's format. LH-153: with
 * `group` (the column has no format and groups its thousands, `columnGroups`) a whole number of four digits or more is grouped by the language.
 */
export function waterfallLabelText(value: number, format: string | undefined, role: WaterfallRole | null, group?: {language?: string}): string {
  if (role === 'total' || value === 0) return valueLabel(value, format, group);
  return `${value > 0 ? '+' : '−'}${valueLabel(Math.abs(value), format, group)}`;
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
    const group = columnGroups(data, column) ? {language: geometry.language} : undefined;
    const widest = Math.max(0, ...values.map((value, index) => value === null ? 0 : geometry.measure(waterfallLabelText(value, format, roles[index]!, group), fontPx, roles[index] === 'total' ? 700 : 400)));
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

/**
 * LH-125: a doughnut with one focused slice prints that slice's value in its hole, large and bold in the slice's color, with the slice's
 * category under it in the chart text size (absent when the name does not fit the hole). Boxes are slide pixels, centered in the hole.
 */
export interface ChartValueListHole {
  /** The focused slice's row. */
  row: number;
  value: {text: string; box: Box; /** The text size in slide pixels. */ size: number};
  name?: {text: string; box: Box};
}

/** LH-108: the value list beside a pie or one-series doughnut. Boxes are slide pixels. */
export interface ChartLayerValueList {
  /** The square the pie (or doughnut) fills. */
  pie: Box;
  /** LH-125: the focused slice's value in a doughnut's hole. */
  hole?: ChartValueListHole;
  /** The values' unit above the value column (the value column's name or the value axis title), at the end of the list's first line. */
  header?: {text: string; box: Box};
  rows: ChartValueListRow[];
  /** The swatch side and the space after it. */
  swatch: number;
  gap: number;
}

/**
 * LH-108: the value list of a pie or one-series doughnut (the drawn type) without `legend` or `dataLabels`, or undefined when its slice
 * labels (LH-105) or legend read better. The list is one row per category with a value (two to eight): a swatch in the slice's color,
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
  const bold = new Set(options.focus?.categories ?? []);
  const entries = shown.map(({row, value}) => ({row, name: label(data.rows[row]![0]), value: columnValueLabel(data, 1, value, geometry.language), bold: bold.has(row)}));
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
  const hole = type === 'doughnut' ? doughnutHole(pie, entries, options.focus?.categories ?? [], {fontPx, textHeight: metrics(box, scale, geometry.minFontSize).textHeight, measure: geometry.measure}) : undefined;
  return {
    pie,
    ...(hole ? {hole} : {}),
    ...(header ? {header: {text: header, box: mirror({x: listX, y: top, width: listWidth, height: lineHeight})}} : {}),
    rows: entries.map((entry, index) => ({row: entry.row, name: entry.name, value: entry.value, ...(entry.bold ? {bold: true} : {}),
      box: mirror({x: listX, y: top + headerHeight + index * pitch, width: listWidth, height: pitch})})),
    swatch, gap,
  };
}

/**
 * LH-125: the value of the one slice the title names, in the hole of a doughnut (the hole is half the doughnut's radius, as both engines
 * draw it): twice the chart text size, bold, or smaller until its text fits 84% of the hole's width (a chord at the text's height), but not
 * under 1.25 text sizes (then the hole stays empty); the category under it at the chart text size when it fits the same width and both
 * lines fit the hole's height. Two focused slices or none name no value.
 */
function doughnutHole(pie: Box, entries: readonly {row: number; name: string; value: string}[], focus: readonly number[], m: {fontPx: number; textHeight: number; measure: (text: string, size: number, weight: 400 | 700) => number}): ChartValueListHole | undefined {
  if (focus.length !== 1) return undefined;
  const entry = entries.find(candidate => candidate.row === focus[0]);
  if (!entry) return undefined;
  const radius = pie.width / 2 / 2, usable = 2 * radius * 0.84, cx = pie.x + pie.width / 2, cy = pie.y + pie.height / 2;
  const natural = m.measure(entry.value, m.fontPx, 700);
  const size = Math.min(m.fontPx * 2, natural > 0 ? usable * m.fontPx / natural : m.fontPx * 2);
  if (!(size >= m.fontPx * 1.25) || size * 1.22 > radius * 2 * 0.7) return undefined;
  const valueHeight = size * 1.22, nameWidth = m.measure(entry.name, m.fontPx, 400);
  const withName = nameWidth <= usable && valueHeight + m.textHeight * 1.2 <= radius * 2 * 0.7;
  const total = valueHeight + (withName ? m.textHeight * 1.2 : 0), top = cy - total / 2;
  const valueWidth = Math.min(usable, natural * size / m.fontPx) + size * 0.1;
  return {
    row: entry.row,
    value: {text: entry.value, size, box: {x: cx - valueWidth / 2, y: top, width: valueWidth, height: valueHeight}},
    ...(withName ? {name: {text: entry.name, box: {x: cx - (nameWidth + m.fontPx * 0.2) / 2, y: top + valueHeight, width: nameWidth + m.fontPx * 0.2, height: m.textHeight * 1.2}}} : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// LH-109, LH-125: values inside stacked segments, names beside the last column (above the first bar), the end points of an area

const STACKED: Readonly<Record<string, 'bar' | 'area'>> = {'stacked-column': 'bar', '100pct-stacked-column': 'bar', 'stacked-bar': 'bar', '100pct-stacked-bar': 'bar', 'stacked-area': 'area', '100pct-stacked-area': 'area'};
/** LH-125: a horizontal stacked bar chart: one bar per category from top to bottom, its segments left to right along the value axis. */
const isHorizontal = (chart: unknown): boolean => typeOf(chart).endsWith('-bar');

/** LH-109: one series name beside the last column or band (LH-125: above the first bar): its swatch and name in `box`, centered on its segment's middle when it can be. */
export interface ChartStackName { series: number; name: string; bold?: boolean; box: Box }

/** LH-125: one end point of a stacked area drawn inside the band at the plot's edge: the value as the column's format prints it, `align`ed to that edge. */
export interface ChartStackEnd { series: number; row: number; text: string; align: 'left' | 'right'; box: Box }

/** LH-109: how a stacked column, bar or area chart labels itself. */
export interface ChartLayerStack {
  /** `values[series][row]`: true when that segment's value is drawn inside it (its text fits the segment). */
  values: boolean[][];
  /**
   * The series names beside the last column or band, and the gutter the plot leaves for them at its end; absent when the legend stays.
   * LH-125: on a horizontal bar chart (`above`) the names stand in a row above the plot, each at the start of its segment in the first bar.
   */
  names?: {gutter: number; swatch: number; entries: ChartStackName[]; above?: boolean};
  /** LH-125: a stacked area runs edge to edge: its first and last categories stand on the plot's edges (the category axis crosses on the tick marks). */
  edge?: boolean;
  /** LH-125: the values at the first and last points of an edge-to-edge area, which fit inside the band beside the plot's edge. */
  ends?: ChartStackEnd[];
  /**
   * LH-125: on a horizontal bar chart that names its series above the plot, the header (caption and legend) the chart keeps when its bars
   * align to a table's rows instead (LH-115, `restackForRows`): that plot is the table's, so no names row stands above it.
   */
  legend?: ChartLayerHeader;
  /**
   * LH-142: false on a horizontal stacked bar chart whose every segment carries its value: the value axis, its tick labels and gridlines are
   * dropped (labels or an axis, not both), as a small chart drops them (LH-03). The plot is laid out without the tick row (`horizontalStackPlot`).
   */
  valueAxis?: false;
}

/** LH-142: true when every segment with a value (not null, not zero) has its value drawn inside it, and at least one has. "values" is ChartLayerStack.values. */
function labeledEverySegment(data: ResolvedChartData, values: readonly (readonly boolean[])[]): boolean {
  if (!data.ok) return false;
  let any = false;
  for (let j = 0; j < data.columns.length - 1; j++) for (let i = 0; i < data.rows.length; i++) {
    const value = chartNumber(data.rows[i]![j + 1]);
    if (value === null || value === 0) continue;
    if (!values[j]?.[i]) return false;
    any = true;
  }
  return any;
}

/** True for a stacked column, bar or area chart of two to six series without `dataLabels` or `legend`. */
function stackCandidate(chart: unknown, data: ResolvedChartData): chart is Record<string, unknown> {
  if (!record(chart) || !data.ok || data.combo || !Object.hasOwn(STACKED, typeOf(chart))) return false;
  const series = data.columns.length - 1;
  return series >= 2 && series <= 6 && data.rows.length >= 1 && chart.dataLabels === undefined && chart.legend === undefined;
}

const entryCount = (data: ResolvedChartData): number => data.ok ? data.rows.length : 0;

/** The plot box of an inset. */
const plotOf = (box: Box, inset: {left: number; top: number; right: number; bottom: number}): Box => ({x: box.x + inset.left, y: box.y + inset.top, width: box.width - inset.left - inset.right, height: box.height - inset.top - inset.bottom});

/**
 * The stacked segments of a chart as the preview draws them, with the plot's value mapping (`at`: a value's y on a column or area chart,
 * its x on a horizontal bar chart). `band` is the distance between categories along the category axis (an edge-to-edge area (`edge`): the
 * distance between its points, one band fewer than it has rows) and `pointX(row)` the x of a vertical chart's category.
 */
function segments(chart: Record<string, unknown>, data: ResolvedChartData, axis: ChartValueAxis, plot: Box, edge = false) {
  if (!data.ok) return undefined;
  const kind = STACKED[typeOf(chart)]!, percent = typeOf(chart).startsWith('100pct'), horizontal = isHorizontal(chart), rows = data.rows.length;
  const series = data.columns.slice(1).map((_, j) => ({values: data.rows.map(row => chartNumber(row[j + 1]))}));
  let stacks: ReturnType<typeof stackCategoryValues>;
  try { stacks = stackCategoryValues(series, rows, kind, percent ? 'percentStacked' : 'stacked'); } catch { return undefined; }
  const along = (value: number) => (Math.min(axis.max, Math.max(axis.min, value)) - axis.min) / (axis.max - axis.min);
  const at = horizontal ? (value: number) => plot.x + along(value) * plot.width : (value: number) => plot.y + (1 - along(value)) * plot.height;
  const spaced = kind === 'area' && edge && rows >= 2;
  const band = horizontal ? plot.height / rows : spaced ? plot.width / (rows - 1) : plot.width / rows;
  const pointX = (row: number, rtl: boolean) => { const slot = rtl ? rows - 1 - row : row; return spaced ? plot.x + slot * band : plot.x + (slot + 0.5) * band; };
  return {kind, horizontal, spaced, series, stacks, at, band, pointX};
}

/**
 * LH-125: the value at an end of an edge-to-edge area, inside the band beside the plot's edge: left-aligned at the left edge, right-aligned
 * at the right (the first category stands at the right edge right to left). It fits when its text lies within half a band (the next point's
 * own value, centered on that point, keeps the other half) and the band is a text line tall at both ends of the text; it is centered on the
 * band's middle across its text.
 */
function areaEnd(shape: NonNullable<ReturnType<typeof segments>>, j: number, row: number, text: string, m: {fontPx: number; textHeight: number; lineHeight: number}, geometry: {measure: (text: string, size: number) => number; direction?: 'ltr' | 'rtl'}): ChartStackEnd | undefined {
  const rows = shape.stacks[j]!.length, rtl = geometry.direction === 'rtl', first = row === 0;
  const point = shape.stacks[j]![row], next = shape.stacks[j]![first ? 1 : rows - 2];
  if (!point || !next) return undefined;
  const width = geometry.measure(text, m.fontPx), room = width + m.fontPx * 0.25;
  if (room > shape.band * 0.5) return undefined;
  // The band narrows or widens toward the neighbor: its top and bottom at distance d from the edge.
  const edgeX = shape.pointX(row, rtl), toLeft = (first !== rtl);
  const bounds = (distance: number) => { const t = distance / shape.band; return {top: shape.at(point.to) + (shape.at(next.to) - shape.at(point.to)) * t, bottom: shape.at(point.from) + (shape.at(next.from) - shape.at(point.from)) * t}; };
  const near = bounds(0), far = bounds(room);
  if (Math.abs(near.bottom - near.top) < m.textHeight || Math.abs(far.bottom - far.top) < m.textHeight) return undefined;
  const middle = bounds(room / 2), centre = (middle.top + middle.bottom) / 2;
  const boxWidth = width + m.fontPx * 0.3;
  return {series: j, row, text, align: toLeft ? 'left' : 'right', box: {x: toLeft ? edgeX + m.fontPx * 0.1 : edgeX - m.fontPx * 0.1 - boxWidth, y: centre - m.lineHeight / 2, width: boxWidth, height: m.lineHeight}};
}

/**
 * LH-109, LH-125: which segment values fit inside their segments (none on a 100% stacked chart, whose axis reads shares), and the end
 * points of an edge-to-edge area. A value's text (the column's format) plus a quarter text size must lie within the column's width (a band
 * over 1.5, the preview's stacked column), a horizontal bar segment's length, or, on an area, 90% of the category band, and a text line within
 * the segment's height (a bar's thickness). An area's first and last points hold no centered value; an edge-to-edge area draws them as
 * `ends` when they fit (`areaEnd`).
 */
function stackMarks(chart: Record<string, unknown>, data: ResolvedChartData, axis: ChartValueAxis, plot: Box, geometry: Omit<ChartPlotGeometry, 'box'> & {box: Box}, edge = false): {values: boolean[][]; ends: ChartStackEnd[]} | undefined {
  const shape = segments(chart, data, axis, plot, edge);
  if (!shape || !data.ok) return undefined;
  const m = metrics(geometry.box, geometry.scale, geometry.minFontSize), {fontPx, textHeight} = m;
  const last = entryCount(data) - 1, ends: ChartStackEnd[] = [];
  // A 100% stacked chart reads shares on its axis; the raw values (which a native label shows) would contradict it.
  const percent = typeOf(chart).startsWith('100pct');
  const values = shape.series.map((entry, j) => entry.values.map((value, i) => {
    const point = shape.stacks[j]![i];
    if (percent || value === null || !point || value === 0) return false;
    const text = columnValueLabel(data, j + 1, value, geometry.language), wide = geometry.measure(text, fontPx) + fontPx * 0.25;
    if (shape.horizontal) return wide <= Math.abs(shape.at(point.to) - shape.at(point.from)) && textHeight <= chartBarGeometry(shape.band, 1, 'stacked').width;
    // An area starts and ends at its first and last points: a value centered there would hang half outside the band.
    if (shape.kind === 'area' && (i === 0 || i === last)) {
      const end = shape.spaced ? areaEnd(shape, j, i, text, m, geometry) : undefined;
      if (end) ends.push(end);
      return false;
    }
    const room = shape.kind === 'bar' ? chartBarGeometry(shape.band, 1, 'stacked').width : shape.band * 0.9;
    return wide <= room && textHeight <= Math.abs(shape.at(point.to) - shape.at(point.from));
  }));
  return {values, ends};
}

/**
 * LH-109: the series names beside the last column (or band) of a stacked chart for a plot, or undefined when they cannot be placed: each
 * name (a swatch 0.6 text sizes square, 0.4 of space and the name) centered on its segment's middle in the last category, a quarter text
 * size past the column's edge (the band's end on an area, its edge-to-edge point: `edge`); then moved apart in segment order so no two are
 * closer than a text line, within the plot. `relaxed` places them however far they move (after a shared plot moved them); otherwise a name
 * moved more than a line from its segment fails, and the chart keeps its legend.
 */
export function placeStackNames(chart: unknown, data: ResolvedChartData, axis: ChartValueAxis, box: Box, plotInset: {left: number; top: number; right: number; bottom: number}, geometry: Omit<ChartPlotGeometry, 'box'> & {bold?: (text: string, size: number) => number}, relaxed = false, focus?: readonly number[], edge = false): ChartStackName[] | undefined {
  if (!stackCandidate(chart, data) || !data.ok || isHorizontal(chart) || !(axis.max > axis.min)) return undefined;
  const plot = plotOf(box, plotInset);
  if (!(plot.width > 1 && plot.height > 1)) return undefined;
  const shape = segments(chart, data, axis, plot, edge);
  if (!shape) return undefined;
  const {fontPx, textHeight, lineHeight} = metrics(box, geometry.scale, geometry.minFontSize);
  const rtl = geometry.direction === 'rtl', last = data.rows.length - 1;
  // The last category is the rightmost (the leftmost right to left); the names start past the column's edge or the band's end.
  const centre = shape.pointX(last, rtl), reach = shape.kind === 'bar' ? shape.band / 3 : 0;
  // An edge-to-edge area's end value stands inside its edge: the names keep a text size and a half clear of it.
  const lead = shape.spaced ? fontPx * 0.6 : fontPx * 0.25;
  const start = rtl ? centre - reach - lead : centre + reach + lead;
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
    box: {x: rtl ? start - entry.width : start, y: centres[index]! - lineHeight / 2, width: entry.width, height: lineHeight}}));
  // The names must stay inside the chart box.
  if (!relaxed && entries.some(entry => entry.box.x < box.x - 0.5 || entry.box.x + entry.box.width > box.x + box.width + 0.5)) return undefined;
  return entries.sort((a, b) => a.series - b.series);
}

/**
 * LH-125: the inner plot of a horizontal stacked bar chart as an inset from its chart box, laid out as the preview lays a horizontal bar chart
 * out (opf-render charts.js): the category gutter at the start (its widest label, at most 30% of the chart, 40% for a word that does not
 * break), the plot ending a text size before the chart's padding, the value tick labels under it (a formatted axis keeps its end labels
 * inside the chart); below the header row. With `namesRow` a row of one text line for the series names (`placeBarNames`) lies between the
 * header and the plot, which then starts under it; a side legend takes its width off the plot's end. The preview draws its plot here and the PPTX export pins it (the plot area's inner layout).
 * LH-142: `hidden` (no value axis) leaves no tick row under the plot and no end tick labels inside the chart.
 * LH-154: an axis title is a band the preview carves off the chart's edge (a value axis title under the tick row, a category axis title at
 * the start; one text line each), so the plot leaves both: the title no longer overlaps the tick labels or the row names.
 */
function horizontalStackPlot(chart: Record<string, unknown>, data: ResolvedChartData, axis: ChartValueAxis, box: Box, header: ChartLayerHeader | undefined, namesRow: boolean, geometry: Omit<ChartPlotGeometry, 'box'>, hidden = false): ChartPlotInset | undefined {
  if (!data.ok || !(axis.majorUnit > 0) || !Number.isFinite(axis.max - axis.min) || (axis.max - axis.min) / axis.majorUnit > 1000) return undefined;
  const {fontPx, pad, lineHeight} = metrics(box, geometry.scale, geometry.minFontSize);
  const width = (text: string) => geometry.measure(text, fontPx);
  const categories = data.rows.map(row => label(row[0]));
  const options = resolveChartOptions(chart, chartOptionTarget(typeOf(chart)));
  const titles = options.active ? options.axisTitles : {category: undefined, value: undefined};
  const start = titles.category ? lineHeight : 0, titleBand = titles.value ? lineHeight : 0, span = box.width - start;
  const longestWord = Math.max(0, ...categories.flatMap(name => name.split(BREAKABLE).map(width))) + fontPx * 0.5;
  const gutter = Math.min(Math.max(span * 0.3, Math.min(span * 0.4, longestWord)), Math.max(0, ...categories.map(width)) + fontPx * 0.5);
  // A chart whose legend is neither in the header nor replaced by names keeps the side legend (up to 45% of the chart), which the plot leaves room for.
  const side = namesRow || header?.legend ? 0 : Math.min(span * 0.45, fontPx * 1.0 + Math.max(0, ...data.columns.slice(1).map(name => width(label(name)))) + fontPx * 0.5) + pad;
  let x = box.x + start + pad + gutter + pad / 2, plotWidth = Math.max(1, box.x + box.width - pad - side - x - fontPx);
  const format = typeof data.formats[1] === 'string' && data.formats[1] !== '' && !numberFormatError(data.formats[1]) ? data.formats[1] : undefined;
  if (!hidden && format !== undefined && !typeOf(chart).startsWith('100pct')) {
    const first = width(tickLabel(axis.min, false, format)) / 2, endTick = axis.min + Math.floor((axis.max - axis.min) / axis.majorUnit + 1e-9) * axis.majorUnit;
    const lastHalf = width(tickLabel(endTick, false, format)) / 2, right = box.x + box.width - pad;
    const nextX = Math.max(x, box.x + pad + first);
    plotWidth = Math.max(1, Math.min(x + plotWidth, right - lastHalf) - nextX); x = nextX;
  }
  const below = box.y + (header?.height ?? 0);
  const top = namesRow ? below + (header ? 0 : pad) + lineHeight + fontPx * 0.1 : below + pad + lineHeight / 2, bottom = box.y + box.height - titleBand - pad - (hidden ? 0 : lineHeight);
  if (!(bottom - top > 1)) return undefined;
  return {left: x - box.x, top: top - box.y, right: box.x + box.width - (x + plotWidth), bottom: box.y + box.height - bottom};
}

/**
 * LH-125: the series names of a horizontal stacked bar chart in the row above its plot: each name (a swatch and the name, as the names
 * beside a column) starts where its series' segment starts in the first bar, left to right in that order. Undefined (the chart keeps its
 * header legend) when two names would meet (a text size and a half between them) or the last leaves the chart.
 */
function placeBarNames(chart: unknown, data: ResolvedChartData, axis: ChartValueAxis, box: Box, plotInset: ChartPlotInset, geometry: Omit<ChartPlotGeometry, 'box'> & {bold?: (text: string, size: number) => number}, focus?: readonly number[]): ChartStackName[] | undefined {
  if (!stackCandidate(chart, data) || !data.ok || !isHorizontal(chart) || !(axis.max > axis.min)) return undefined;
  const plot = plotOf(box, plotInset), shape = plot.width > 1 && plot.height > 1 ? segments(chart, data, axis, plot) : undefined;
  if (!shape) return undefined;
  const {fontPx, pad, lineHeight} = metrics(box, geometry.scale, geometry.minFontSize), swatch = fontPx * 0.6, y = plot.y - fontPx * 0.1 - lineHeight;
  const placed = shape.series.map((_, j) => {
    const point = shape.stacks[j]![0], name = label(data.columns[j + 1]), bold = focus?.includes(j) === true;
    const x = point ? Math.min(shape.at(point.from), shape.at(point.to)) : shape.at(0);
    const width = swatch + fontPx * 0.4 + (bold && geometry.bold ? geometry.bold(name, fontPx) : geometry.measure(name, fontPx)) + fontPx * 0.25;
    return {j, name, bold, x, width};
  }).sort((a, b) => a.x - b.x || a.j - b.j);
  const limit = box.x + box.width - pad / 2;
  if (placed.some((entry, index) => entry.x + entry.width > (index + 1 < placed.length ? placed[index + 1]!.x - fontPx * 1.5 : limit) + 1e-6)) return undefined;
  return placed.map((entry): ChartStackName => ({series: entry.j, name: entry.name, ...(entry.bold ? {bold: true} : {}), box: {x: entry.x, y, width: entry.width, height: lineHeight}})).sort((a, b) => a.series - b.series);
}

/**
 * LH-109, LH-125: the stacked-chart layer and value axis, or undefined for another chart.
 *
 * A column or area chart: the header row is laid out again with its caption only and the plot with a gutter at its end as wide as the
 * widest name (LH-105's end-label layout); when the names cannot be placed the chart keeps its header legend and the plot is laid out under
 * it. A stacked area runs edge to edge (`stack.edge`). A horizontal bar chart: the same, with the names in a row above the plot (`placeBarNames`)
 * and the plot laid out by `horizontalStackPlot`. Either way the plot is pinned (`layer.plot`, which the PPTX export writes as the plot
 * area's inner layout), and the values that fit their segments (and an area's end points) are recorded.
 */
export function chartStack(chart: unknown, data: ResolvedChartData, layer: ChartLayer | undefined, geometry: ChartLayerGeometry, axisFor: (headerHeight: number) => ChartValueAxis | undefined, header: (legend: boolean) => ChartLayerHeader | undefined): {layer: ChartLayer; valueAxis: ChartValueAxis} | undefined {
  if (!stackCandidate(chart, data) || !data.ok) return undefined;
  const {box, scale} = geometry;
  if (!usable(box, scale)) return undefined;
  const {fontPx} = metrics(box, scale, geometry.minFontSize);
  const measure = (text: string, size: number) => geometry.measure(text, size, 400), bold = (text: string, size: number) => geometry.measure(text, size, 700);
  const plotGeometry = {scale, minFontSize: geometry.minFontSize, measure, direction: geometry.direction, language: geometry.language};
  const focus = layer?.focus?.series;
  const swatch = fontPx * 0.6, horizontal = isHorizontal(chart);
  const edge = !horizontal && STACKED[typeOf(chart)] === 'area' && data.rows.length >= 2;
  const {header: _header, ...rest} = layer ?? {};
  let result: {layer: ChartLayer; valueAxis: ChartValueAxis} | undefined;
  // With names: the caption alone above a row of names and the plot; without: the header legend and the plot under it. LH-142: "hidden"
  // lays the plot out without a value axis.
  const horizontalResult = (hidden: boolean): typeof result => {
    for (const withNames of [true, false]) {
      const head = withNames ? header(false) : layer?.header;
      const valueAxis = axisFor(head?.height ?? 0);
      const plot = valueAxis ? horizontalStackPlot(chart, data, valueAxis, box, head, withNames, plotGeometry, hidden) : undefined;
      if (!valueAxis || !plot) continue;
      const base: ChartLayer = {...rest, ...(head ? {header: head} : {}), plot};
      const entries = withNames ? placeBarNames(chart, data, valueAxis, box, plot, {...plotGeometry, bold}, focus) : undefined;
      if (withNames && !entries) continue;
      return {layer: {...base, stack: {values: [], ...(hidden ? {valueAxis: false as const} : {}), ...(entries ? {names: {gutter: 0, swatch, entries, above: true}, ...(layer?.header ? {legend: layer.header} : {})} : {})}}, valueAxis};
    }
    return undefined;
  };
  if (horizontal) {
    result = horizontalResult(false);
  } else {
    // With names: the caption alone above the plot, and a gutter for the widest name past the last column.
    const named = (() => {
      const captionOnly = header(false);
      const valueAxis = axisFor(captionOnly?.height ?? 0);
      if (!valueAxis) return undefined;
      const base: ChartLayer = {...rest, ...(captionOnly ? {header: captionOnly} : {})};
      const gutter = (edge ? fontPx * 0.6 : fontPx * 0.25) + Math.max(...data.columns.slice(1).map((name, j) => swatch + fontPx * 0.4 + (focus?.includes(j) ? bold : measure)(label(name), fontPx) + fontPx * 0.25));
      const plot = chartPlotInset(chart, data, {valueAxis, layer: {...base, stack: {values: [], ...(edge ? {edge} : {}), names: {gutter, swatch, entries: []}}}}, {...plotGeometry, box});
      if (!plot) return undefined;
      const entries = placeStackNames(chart, data, valueAxis, box, plot, {...plotGeometry, bold}, false, focus, edge);
      return entries ? {layer: {...base, plot, stack: {values: [], ...(edge ? {edge} : {}), names: {gutter, swatch, entries}}}, valueAxis} : undefined;
    })();
    result = named ?? (() => {
      const valueAxis = axisFor(layer?.header?.height ?? 0);
      const plot = valueAxis ? chartPlotInset(chart, data, {valueAxis, layer: {...layer, stack: {values: [], ...(edge ? {edge} : {})}}}, {...plotGeometry, box}) : undefined;
      return valueAxis && plot ? {layer: {...layer, plot, stack: {values: [], ...(edge ? {edge} : {})}} as ChartLayer, valueAxis} : undefined;
    })();
  }
  if (!result) return undefined;
  const marks = stackMarks(chart, data, result.valueAxis, plotOf(box, result.layer.plot!), {...plotGeometry, box}, edge);
  if (!marks) return undefined;
  result.layer.stack = {...result.layer.stack!, values: marks.values, ...(marks.ends.length ? {ends: marks.ends} : {})};
  // LH-142: a horizontal stacked bar chart whose every segment carries its value drops its value axis and gridlines (labels or an axis, not
  // both), unless the chart titles its value axis (a title keeps the axis, as for a small chart). The plot grows by the tick row, so the
  // segments are measured again against it, and the axis stays when one no longer holds its value.
  if (horizontal && !typeOf(chart).startsWith('100pct') && !(record(chart.axisTitles) && nonBlank(chart.axisTitles.value) !== undefined) && labeledEverySegment(data, marks.values)) {
    const dropped = horizontalResult(true);
    const again = dropped && stackMarks(chart, data, dropped.valueAxis, plotOf(box, dropped.layer.plot!), {...plotGeometry, box});
    if (dropped && again && labeledEverySegment(data, again.values)) {
      dropped.layer.stack = {...dropped.layer.stack!, values: again.values};
      return dropped;
    }
  }
  return result;
}

/**
 * LH-125 with LH-115: a horizontal stacked bar chart beside a table of the same keys draws its bars on the table's rows (`rows`), so the plot
 * is the table's and not the one `chartStack` pinned: the pinned plot and the names row go, the header keeps its legend (`stack.legend`,
 * else the header it had), and the values that fit their segments are decided again against the aligned plot (the rows' span and the
 * gutter and value labels the preview leaves). Any other layer is returned with its `rows`.
 */
export function restackForRows(chart: unknown, data: ResolvedChartData, layer: ChartLayer, rows: ChartLayerRows, box: Box, axis: ChartValueAxis | undefined, geometry: Omit<ChartPlotGeometry, 'box'>): ChartLayer {
  if (!layer.stack || !axis || !stackCandidate(chart, data) || !isHorizontal(chart)) return {...layer, rows};
  const {plot: _plot, header: _header, stack, ...rest} = layer;
  const header = stack.legend ?? layer.header;
  const plot: Box = {x: box.x + rows.left, y: box.y + rows.top, width: box.width - rows.left - rows.right, height: rows.bottom - rows.top};
  const marks = plot.width > 1 && plot.height > 1 ? stackMarks(chart, data, axis, plot, {...geometry, box}) : undefined;
  return {...rest, ...(header ? {header} : {}), rows, stack: {values: marks?.values ?? stack.values.map(row => row.map(() => false))}};
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
 * LH-109, LH-110 with LH-93: after sibling charts share one plot height, the names beside a stacked chart's last column, an area's end
 * values (LH-125) and the reference marks are placed again against the chart's new plot.
 */
export function refreshChartMarks(items: readonly ComposedChartItem[], geometryFor: (item: ComposedChartItem) => Omit<ChartPlotGeometry, 'box'> & {bold?: (text: string, size: number) => number}, document?: unknown): void {
  for (const item of items) {
    const layer = item.chart?.layer, axis = item.chart?.valueAxis;
    if (!layer?.plot || !axis || (!layer.stack?.names && !layer.stack?.ends && !layer.references)) continue;
    const data = resolveChartData(item.value, document), geometry = geometryFor(item);
    let next: ChartLayer = layer;
    // The names above a horizontal bar chart (LH-125) and its plot do not move with a shared plot (only vertical charts share one).
    if (layer.stack?.names && !layer.stack.names.above) {
      const entries = placeStackNames(item.value, data, axis, item.box, layer.plot, geometry, true, layer.focus?.series, layer.stack.edge === true);
      if (entries) next = {...next, stack: {...next.stack!, names: {...layer.stack.names, entries}}};
    }
    // LH-125: and an edge-to-edge area's end values stand on its band in the new plot.
    if (layer.stack?.ends && record(item.value) && stackCandidate(item.value, data)) {
      const marks = stackMarks(item.value, data, axis, plotOf(item.box, layer.plot), {...geometry, box: item.box}, true);
      if (marks) next = {...next, stack: {...next.stack!, ...(marks.ends.length ? {ends: marks.ends} : {ends: undefined})}};
    }
    if (layer.references) {
      const references = placeReferences({lines: layer.references.lines, rows: layer.references.bands.map(band => band.row)}, data, axis, item.box, layer.plot, geometry);
      if (references) next = {...next, references};
    }
    item.chart!.layer = next;
  }
}
