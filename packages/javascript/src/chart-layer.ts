// LH-03 and LH-81: the chart layer, the defaults that make a plain chart read like a designed one.
//
// Composition decides them once per chart item (ComposedChart.layer), from the chart, its resolved data and its box, so the preview
// (opf-render) and the PPTX export (opf-pptx) draw the same chart:
//
//   small chart (LH-03)   a clustered column, bar or line chart of one or two series whose value labels fit beside each other (LH-111:
//                         up to sixteen points) labels every mark with its value and drops the value axis, its gridlines and the grey chart panel; a one-series column or bar chart
//                         draws its last point in a stronger shade of the series colour and the others in the series colour (LH-95).
//   header row (LH-81)    a column, bar, line, area or combo chart without its own caption draws a caption when it adds to the
//                         legend ("Revenue by quarter")
//                         at the start of a row above the plot and its series legend (two to four swatches) in that row or the next,
//                         instead of a legend at the side, so the plot keeps the chart's whole width.
//
// An explicit option always wins: `dataLabels: false` keeps the value axis and no labels, a value axis title keeps the value axis,
// `legend` keeps the chart's own legend and draws no header row, `highlight` and `colors` keep their colours, and a payload `caption` replaces the
// header caption. PPTX import does not write these defaults back as options (src/chart-options.js in opf-pptx).
import {chartOptionTarget, chartLabelText, formatChartLabelNumber} from './chart-options.js';
import {chartTextSize} from './chart-axis.js';
import {chartNumber, formatDataNumber, type ResolvedChartData} from './chart-data.js';
import {chartCategoriesInTime} from './chart-time-order.js';
import type {ChartLayerFocus} from './chart-focus.js';
import type {ChartLayerRows} from './chart-rows.js';

/** A small chart has at most this many series (LH-03). */
export const SMALL_CHART_MAX_SERIES = 2;
/**
 * A small chart has at most this many points per series (LH-03). LH-111: within it the labels decide: a chart is small when its value
 * labels fit beside each other at the chart text size (smallChart), so twelve monthly columns are labeled when their labels fit (it was 8).
 */
export const SMALL_CHART_MAX_POINTS = 16;
/** The header row shows at most this many legend swatches; a chart with more series keeps its side legend (LH-81). */
export const CHART_HEADER_MAX_LEGEND = 4;

interface Box { x: number; y: number; width: number; height: number }

/** LH-03: how a small chart is drawn. */
export interface ChartLayerSmall {
  /** True when the value labels are the default (the chart has no `dataLabels`); an explicit `dataLabels` draws as written. */
  labels: boolean;
  /** False when the value axis is dropped: no tick labels, no gridlines, no value axis line (the labels carry the values). */
  valueAxis: boolean;
  /** Row index of the mark drawn in the stronger shade; every other mark keeps the series colour (`chartEmphasisColors`). One-series column and bar charts only. */
  emphasis?: number;
}

/** One legend entry of the header row: its series, its name and the box of its key and name (slide pixels). */
export interface ChartHeaderLegendEntry {
  /** Index of the series among the plotted series. */
  series: number;
  name: string;
  /** `line`: a line key (with a marker on a line chart with markers and on a combo line series); otherwise a square swatch. */
  key?: 'line';
  box: Box;
}

/** LH-81: the header row above the plot. Boxes are slide pixels. */
export interface ChartLayerHeader {
  /** The caption and its box (one line, at the start of the first row); absent when the payload has its own caption. */
  caption?: {text: string; box: Box};
  /** The legend in the header row; absent for one series, for more than four, or when the entries do not fit one row. */
  legend?: {box: Box; entries: ChartHeaderLegendEntry[]};
  /** The band the header takes from the top of the chart box: the padding and one or two rows. The plot is laid out below it. */
  height: number;
}

/** LH-92: one ring of a doughnut of nested rings and the slice that carries its series name. */
export interface ChartLayerRing {
  /** Index of the series among the plotted series (0 is the innermost ring). */
  series: number;
  name: string;
  /** Row index of the slice whose label names the ring: its largest. */
  row: number;
  /**
   * The label's rotation in degrees (clockwise, -90 to 90): along the ring at the slice's middle, so a ring thinner than the name is long
   * still holds it, and never upside down.
   */
  rotation: number;
}

/** LH-93: the inner plot area (the plot without its tick and category labels) as an inset from each edge of the chart box, slide pixels. */
export interface ChartPlotInset { left: number; top: number; right: number; bottom: number }

/** What composition decides for a chart beyond its value axis (LH-03, LH-81, LH-92, LH-93). */
export interface ChartLayer {
  small?: ChartLayerSmall;
  header?: ChartLayerHeader;
  /** LH-92: a doughnut of two or more rings names each ring on one of its slices. */
  rings?: ChartLayerRing[];
  /**
   * LH-93: the plot of a chart that shares its value axis with siblings, of one height across them (chart-plot.ts `shareSiblingPlots`).
   * LH-105: also the plot of a line chart whose series are named at their line ends, which keeps a gutter for the names.
   */
  plot?: ChartPlotInset;
  /** LH-105: a line chart of two to four series names each series at the end of its line instead of drawing a legend (chart-direct-labels.ts). */
  endLabels?: ChartLayerEndLabels;
  /** LH-105: a pie or one-series doughnut names its categories on its slices instead of drawing a legend (chart-direct-labels.ts). */
  slices?: ChartLayerSlices;
  /**
   * LH-105: the series or categories the slide title names (chart-focus.ts): drawn in their full-strength colour, every other mark in the
   * context neutral. A focus replaces the small chart's last-point emphasis.
   */
  focus?: ChartLayerFocus;
  /**
   * LH-115: a horizontal bar chart beside a table of the same keys in the same order draws each category on its table row (chart-rows.ts
   * `alignBarRows`).
   */
  rows?: ChartLayerRows;
}

/** LH-105: one series name at the end of its line. Lengths are slide pixels. */
export interface ChartEndLabel {
  /** Index of the series among the plotted series. */
  series: number;
  name: string;
  /** Row index of the series' last point (the last row: every series has a value there). */
  row: number;
  /** The last point, where the line ends. */
  point: {x: number; y: number};
  /** The label: the last value as the series' data labels print it, then the series name ("61 Enterprise NPS"). */
  text: string;
  /** True for a series the title names (ChartLayer.focus): its label is bold. */
  bold?: boolean;
  /** The label's box: beside the point (after it, before it right to left), moved up or down only to keep clear of the other names. */
  box: Box;
}

/** LH-105: the names at the line ends and the gutter the plot leaves for them at its end (slide pixels). */
export interface ChartLayerEndLabels { gutter: number; entries: ChartEndLabel[] }

/** LH-105: one slice's category label: inside the slice when it fits there, else outside its end (a pie only). */
export interface ChartSliceLabel { row: number; position: 'inside' | 'outside' }

/** LH-105: the category labels of a pie or one-series doughnut; every slice with a value has one. */
export interface ChartLayerSlices { labels: ChartSliceLabel[] }

/** The geometry and text a chart layer is decided with. Lengths are slide pixels. */
export interface ChartLayerGeometry {
  box: Box;
  /** `min(slide width, slide height) / 720`. */
  scale: number;
  minFontSize?: number;
  /** The width of `text` at `size` px in the deck's body font, at weight 400 or (the caption) 700. */
  measure: (text: string, size: number, weight: 400 | 700) => number;
  direction?: 'ltr' | 'rtl';
  /** The deck language tag: the caption joins its parts with "by" in English (and when the language is unknown) only. */
  language?: string;
  /** The payload carries a `caption` of its own: the header draws no caption. */
  captioned?: boolean;
}

type CategorySpec = {kind: 'bar' | 'line' | 'area' | 'combo'; horizontal?: boolean; clustered: boolean; markers?: boolean};
const CATEGORY_SPECS: Readonly<Record<string, CategorySpec>> = {
  column: {kind: 'bar', clustered: true},
  'stacked-column': {kind: 'bar', clustered: false},
  '100pct-stacked-column': {kind: 'bar', clustered: false},
  bar: {kind: 'bar', horizontal: true, clustered: true},
  'stacked-bar': {kind: 'bar', horizontal: true, clustered: false},
  '100pct-stacked-bar': {kind: 'bar', horizontal: true, clustered: false},
  line: {kind: 'line', clustered: true, markers: false},
  'line-with-markers': {kind: 'line', clustered: true, markers: true},
  'stacked-line': {kind: 'line', clustered: false, markers: false},
  'stacked-line-with-markers': {kind: 'line', clustered: false, markers: true},
  area: {kind: 'area', clustered: true},
  'stacked-area': {kind: 'area', clustered: false},
  '100pct-stacked-area': {kind: 'area', clustered: false},
  combo: {kind: 'combo', clustered: true},
};

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const nonBlank = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const label = (value: unknown): string => value === null || value === undefined ? '' : String(value).replace(/[\r\n]+/g, ' ').trim();

/** The chart's category spec for the layer (column, bar, line, area and combo charts), or undefined. */
function categorySpec(chart: Record<string, unknown>): CategorySpec | undefined {
  const id = typeof chart.type === 'string' ? chart.type.trim().toLowerCase() : '';
  return Object.hasOwn(CATEGORY_SPECS, id) && chartOptionTarget(id) ? CATEGORY_SPECS[id] : undefined;
}

/**
 * The category part of a caption in sentence case: a plain word (a capital followed only by lower-case letters, "Quarter", "Stage") is
 * lower-cased; an acronym or a proper-looking token (all capitals, an internal capital or a digit: "Q1", "ARR", "FY27", "iPhone") is
 * kept as written. Only letters with case change, so a script without case is untouched.
 */
export function sentenceCaseCategory(text: string): string {
  return text.split(/(\s+)/).map(token => /^\p{Lu}\p{Ll}+$/u.test(token) ? token.toLocaleLowerCase() : token).join('');
}

/**
 * The header caption, generated only when it says something the legend does not. One series: "<series> by <category>", the series
 * part being the value axis title or the series name. Two or more series: the legend already names them, so a caption is generated only
 * from a value axis title, "<value axis title> by <category>". The category part is the category axis title, else the category
 * column's name, in sentence case ({@link sentenceCaseCategory}). Outside English the parts are not joined with a word: the caption is
 * the series part alone.
 */
export function chartHeaderCaption(chart: unknown, columns: readonly string[], language?: string): string | undefined {
  if (!record(chart)) return undefined;
  const titles = record(chart.axisTitles) ? chart.axisTitles : {};
  const names = columns.slice(1).map(label).filter(Boolean);
  const series = nonBlank(titles.value) ?? (names.length === 1 ? names[0] : undefined);
  if (!series) return undefined;
  const english = language === undefined || /^en(?:-|$)/i.test(language);
  const category = nonBlank(titles.category) ?? (label(columns[0]) || undefined);
  return english && category ? `${series} by ${sentenceCaseCategory(category)}` : series;
}

/** The label text of a value as the engines draw a default value label: the column's number format, else the General form. */
export function valueLabel(value: number, format: string | undefined): string {
  return chartLabelText({value: format !== undefined ? formatDataNumber(value, format) : formatChartLabelNumber(value)}, ['value']);
}

/**
 * LH-03: the small-chart treatment of a chart, or undefined. A clustered column, bar or line chart (with or without markers) of one or
 * two series, each of at most SMALL_CHART_MAX_POINTS (16) points, whose `dataLabels` is not `false`. With a geometry, the value labels must also fit beside
 * each other: a column or line label no wider than the room between neighbouring marks, a bar label no taller than its bar's slot.
 */
export function smallChart(chart: unknown, data: ResolvedChartData, geometry?: ChartLayerGeometry): ChartLayerSmall | undefined {
  if (!record(chart) || !data.ok || data.combo) return undefined;
  const spec = categorySpec(chart);
  if (!spec?.clustered || spec.kind === 'area' || spec.kind === 'combo') return undefined;
  const seriesCount = data.columns.length - 1, count = data.rows.length;
  if (seriesCount < 1 || seriesCount > SMALL_CHART_MAX_SERIES || count < 1 || count > SMALL_CHART_MAX_POINTS) return undefined;
  if (chart.dataLabels === false) return undefined;
  const values = data.rows.map(row => row.slice(1).map(chartNumber));
  if (!values.some(row => row.some(value => value !== null))) return undefined;
  const explicit = chart.dataLabels !== undefined;
  // An explicit label that does not show the value keeps the value axis, and so does a value axis title.
  const showsValue = !explicit || chart.dataLabels === true || (record(chart.dataLabels) && (!Array.isArray(chart.dataLabels.content) || chart.dataLabels.content.includes('value')));
  const titled = record(chart.axisTitles) && nonBlank(chart.axisTitles.value) !== undefined;
  if (geometry && !explicit) {
    const {box, scale} = geometry;
    const fontPx = chartTextSize({width: box.width, height: box.height, scale, minFontSize: geometry.minFontSize}) * scale;
    const pad = 10 * scale;
    const widest = Math.max(0, ...values.flatMap(row => row.flatMap((value, j) => value === null ? [] : [geometry.measure(valueLabel(value, data.formats[j + 1]), fontPx, 400)])));
    if (spec.horizontal) {
      // A bar's label sits past its end, one line tall: two series' labels sit a bar apart (the clustered slot, PptxGenJS gap width
      // 150%), one series' a category apart.
      const band = Math.max(1, box.height - 2 * pad - fontPx * 1.5) / count;
      if (fontPx * 1.22 > (seriesCount > 1 ? band / 2.5 / seriesCount : band)) return undefined;
    } else {
      // A column label is centred on its column: two series' labels sit a column apart, one series' a category apart.
      const band = Math.max(1, box.width - 2 * pad) / count;
      const room = seriesCount > 1 && spec.kind === 'bar' ? band / 2.5 / seriesCount : band;
      if (widest + fontPx * 0.1 > room) return undefined;
    }
  }
  const out: ChartLayerSmall = {labels: !explicit, valueAxis: !showsValue || titled};
  // The accent goes to the last point that has a value; a highlight or authored colours keep their own colours. LH-105: only when the
  // categories run forward in time, where the last point is the latest one (chart-time-order.ts); the last of nominal categories (stages,
  // regions, products) is only the last one written, and emphasising it would invent a message.
  const titles = record(chart.axisTitles) ? chart.axisTitles : {};
  const inTime = () => chartCategoriesInTime(data.rows.map(row => row[0]), {title: nonBlank(titles.category) ?? label(data.columns[0]), language: geometry?.language});
  if (spec.kind === 'bar' && seriesCount === 1 && chart.highlight === undefined && chart.colors === undefined && inTime()) {
    const last = values.map(row => row[0] !== null).lastIndexOf(true);
    if (last >= 0 && count > 1) out.emphasis = last;
  }
  return out;
}

/**
 * LH-81: the header row of a column, bar, line, area or combo chart: its caption and its series legend, laid out from the chart box. A
 * chart with a `legend` option has none: the author chose its legend, and the chart keeps the arrangement it had.
 *
 * The row starts `pad` below the box top and is one line (1.5 chart text sizes) tall. The caption (bold, chart text size) sits at the
 * start of the row (the right edge right to left). The legend (two to four series) follows at the end of the same
 * row when caption and legend fit with two text sizes between them, else at the start of a second row; a legend wider than the
 * chart is not moved into the header (the side legend stays). Each entry is its key (a swatch 0.6 text sizes square, or a line key
 * 1.4 wide), 0.4 text sizes of space and its name, entries 0.8 text sizes apart, the metrics of the preview's legends.
 */
export function chartHeader(chart: unknown, data: ResolvedChartData, geometry: ChartLayerGeometry, options: {legend?: boolean} = {}): ChartLayerHeader | undefined {
  if (!record(chart) || !data.ok) return undefined;
  const spec = categorySpec(chart);
  if (!spec || chart.legend !== undefined) return undefined;
  const {box, scale} = geometry;
  if (![box.width, box.height, scale].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || scale <= 0) return undefined;
  const fontPx = chartTextSize({width: box.width, height: box.height, scale, minFontSize: geometry.minFontSize}) * scale;
  const pad = 10 * scale, lineHeight = fontPx * 1.5, rtl = geometry.direction === 'rtl';
  const left = box.x + pad, available = Math.max(1, box.width - 2 * pad);
  const text = geometry.captioned ? undefined : chartHeaderCaption(chart, data.columns, geometry.language);
  const captionWidth = text ? Math.min(available, geometry.measure(text, fontPx, 700)) : 0;
  const names = data.columns.slice(1).map(label);
  let legend: ChartLayerHeader['legend'];
  let rows = text ? 1 : 0;
  // LH-105: `legend: false` lays out the caption alone, for a chart that names its series at their line ends.
  if (options.legend !== false && names.length >= 2 && names.length <= CHART_HEADER_MAX_LEGEND) {
    const lineKey = (index: number) => spec.kind === 'line' || (spec.kind === 'combo' && data.combo?.[index]?.role === 'line');
    const spacing = fontPx * 0.8;
    const sized = names.map((name, series) => ({series, name, key: lineKey(series) ? 'line' as const : undefined,
      width: (lineKey(series) ? fontPx * 1.4 : fontPx * 0.6) + fontPx * 0.4 + geometry.measure(name, fontPx, 400)}));
    const legendWidth = sized.reduce((sum, entry) => sum + entry.width, 0) + spacing * (sized.length - 1);
    if (legendWidth <= available + 0.01) {
      const sameRow = text !== undefined && captionWidth + 2 * fontPx + legendWidth <= available + 0.01;
      const row = sameRow || !text ? 0 : 1;
      rows = Math.max(rows, row + 1);
      const y = box.y + pad + row * lineHeight;
      // On the caption's row the legend ends the row; on its own row it starts it.
      const start = sameRow ? left + available - legendWidth : left;
      let x = start;
      const entries: ChartHeaderLegendEntry[] = [];
      for (const entry of sized) {
        entries.push({series: entry.series, name: entry.name, ...(entry.key ? {key: entry.key} : {}), box: {x, y, width: entry.width, height: lineHeight}});
        x += entry.width + spacing;
      }
      legend = {box: {x: start, y, width: legendWidth, height: lineHeight}, entries};
    }
  }
  if (!rows) return undefined;
  const caption = text ? {text, box: {x: left, y: box.y + pad, width: captionWidth, height: lineHeight}} : undefined;
  // Right to left, every part mirrors inside the chart box.
  const mirror = (part: Box): Box => rtl ? {...part, x: box.x + box.width - (part.x - box.x) - part.width} : part;
  return {
    ...(caption ? {caption: {text: caption.text, box: mirror(caption.box)}} : {}),
    ...(legend ? {legend: {box: mirror(legend.box), entries: legend.entries.map(entry => ({...entry, box: mirror(entry.box)}))}} : {}),
    height: pad + rows * lineHeight,
  };
}

/** The chart layer of a chart item: its small-chart treatment and its header row, or undefined when it has neither. */
export function chartLayer(chart: unknown, data: ResolvedChartData, geometry: ChartLayerGeometry): ChartLayer | undefined {
  const header = chartHeader(chart, data, geometry);
  const small = smallChart(chart, data, header ? {...geometry, box: {...geometry.box, y: geometry.box.y + header.height, height: Math.max(1, geometry.box.height - header.height)}} : geometry);
  const rings = chartRingLabels(chart, data);
  return small || header || rings ? {...(small ? {small} : {}), ...(header ? {header} : {}), ...(rings ? {rings} : {})} : undefined;
}

/**
 * LH-92: the ring names of a doughnut of two or more rings (LH-60's nested rings, the first series innermost, every ring coloured by
 * category). The side legend names the categories only, so each ring's series name is written inside the ring, on its largest slice
 * (the one with the most room; the first of equals), as that slice's label: the name alone, or before the slice's own label text with
 * the labels' separator, as PowerPoint orders a label's parts (series name first). The label runs along the ring (`rotation`), so a
 * ring as thin as one line of text holds a name longer than the ring is thick. `chart` is the drawn chart (core `chartDrawPlan`'s
 * type), so a pie of several series is a doughnut here. A ring without a positive value has no slice and no name.
 */
export function chartRingLabels(chart: unknown, data: ResolvedChartData): ChartLayerRing[] | undefined {
  if (!record(chart) || !data.ok || typeof chart.type !== 'string' || chart.type.trim().toLowerCase() !== 'doughnut' || data.columns.length < 3) return undefined;
  const rings: ChartLayerRing[] = [];
  data.columns.slice(1).forEach((name, series) => {
    const values = data.rows.map(row => Math.abs(chartNumber(row[series + 1]) ?? 0));
    const largest = Math.max(0, ...values), total = values.reduce((sum, value) => sum + value, 0);
    if (!(largest > 0) || !Number.isFinite(total)) return;
    const row = values.indexOf(largest);
    // Slices run clockwise from 12 o'clock; the text runs along the ring at the slice's middle (the tangent), turned the right way up.
    const middle = -90 + 360 * (values.slice(0, row).reduce((sum, value) => sum + value, 0) + largest / 2) / total;
    let rotation = ((middle + 90) % 180 + 180) % 180;
    if (rotation > 90) rotation -= 180;
    rings.push({series, name: label(name), row, rotation: Math.round(rotation * 100) / 100});
  });
  return rings.length >= 2 ? rings : undefined;
}

/**
 * The data labels a chart draws with its layer: its own (`resolveChartOptions(...).dataLabels`), else the small-chart default, the value
 * at the type's default position (outside the end of a column or bar, above a line point).
 */
export function chartLayerDataLabels<T extends {dataLabels?: unknown}>(resolved: T, layer: ChartLayer | undefined, kind: 'bar' | 'line' | string): T {
  if (resolved.dataLabels !== undefined || !layer?.small?.labels) return resolved;
  return {...resolved, active: true, dataLabels: {content: ['value'], position: kind === 'line' ? 'above' : 'outside-end', separator: ', '}};
}
