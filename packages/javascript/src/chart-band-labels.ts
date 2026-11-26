// FR-07 (owner, 2026-11-25, "1B"): a labeled band names itself inside the band, in the secondary text color at the chart text size, on top of the
// data; the legend holds only the data series. Composition places every label once, on the plot it pins for the chart, so the preview draws it
// and the PowerPoint export writes it as a data label of the band's series at the same box.
//
// - A horizontal stripe (column, line and area charts and their stacked forms): the top corner at the stripe's END (right; left right to left);
//   when that box meets a data mark or a data label, the top corner at its start.
// - A vertical strip (bar charts and the bullet chart): the top of the strip at its START side (left; right in a right-to-left bullet chart); when
//   that box meets a mark or a label, the bottom of the strip.
// - When any label of a chart does not fit its band (with the padding) or meets a mark at both places, every band label of the chart goes to the
//   legend instead, the bands first, then the data series, and composition reports `chart-band-labels-in-legend`. Nothing is shrunk or cut.
import { chartAxisFraction, chartTextSize, stackCategoryValues, type ChartValueAxis } from './chart-axis.js';
import { chartBandRanges, chartBands } from './chart-bands.js';
import { colorContrast } from './color.js';
import { chartNumber, type ResolvedChartData } from './chart-data.js';
import type { ChartPlotInset } from './chart-layer.js';
import { chartBarGeometry, chartBarSeriesOffset } from './chart-layer.js';

interface Box { x: number; y: number; width: number; height: number }

/** One band label as composition placed it: the band's index in `chart.bands`, its text and its box (slide pixels), and the end it took. */
export interface ChartBandLabel {
  index: number;
  text: string;
  box: Box;
  /** `end`/`start` of a stripe, `top`/`bottom` of a strip (the place a PowerPoint data label sits at: its point's category). */
  place: 'end' | 'start' | 'top' | 'bottom';
  /** The category (0-based, in data order) whose point carries the label in PowerPoint. */
  category: number;
  /** The label's text alignment in its box. */
  align: 'left' | 'right';
}
export interface ChartLayerBandLabels {
  /** The labels drawn inside their bands; empty when `legend` is true. */
  labels: ChartBandLabel[];
  /** True when the labels go to the legend instead (a label does not fit its band, or meets a mark at both places). */
  legend?: true;
  /** Why the labels went to the legend. */
  reason?: 'too-large' | 'collision';
}

/** The padding of a band label inside its band, in reference pixels: 8 along the band's edge, 4 from its top (or bottom). */
export const BAND_LABEL_PADDING = Object.freeze({ along: 8, across: 4 });

const BAR_TYPES: Readonly<Record<string, { horizontal: boolean; stacked: boolean }>> = {
  column: { horizontal: false, stacked: false }, 'stacked-column': { horizontal: false, stacked: true }, '100pct-stacked-column': { horizontal: false, stacked: true },
  bar: { horizontal: true, stacked: false }, 'stacked-bar': { horizontal: true, stacked: true }, '100pct-stacked-bar': { horizontal: true, stacked: true },
};
const LINE_TYPES = new Set(['line', 'line-with-markers', 'stacked-line', 'stacked-line-with-markers']);
const AREA_TYPES = new Set(['area', 'stacked-area', '100pct-stacked-area']);
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

/**
 * The boxes a band label must not sit on (slide pixels): every bar, every line segment's and area's extent between neighboring points, every
 * point with its label room, a bullet's bars and ticks. `labeled` adds the room a data label takes beside its mark (a line above a point or a
 * column, the text's width beyond a bar). Approximate where a mark is not a rectangle (a sloped line segment counts as its bounding box).
 */
function dataMarks(type: string, data: Extract<ResolvedChartData, { ok: true }>, axis: { min: number; max: number }, plot: Box, options: { rtl: boolean; labeled: boolean; fontPx: number; target?: (number | null)[] }): Box[] {
  const lineHeight = options.fontPx * 1.5, count = data.rows.length;
  const series = data.columns.slice(1, type === 'bullet' ? 2 : undefined).map((_, j) => ({ values: data.rows.map(row => chartNumber(row[j + 1])) }));
  const marks: Box[] = [];
  const clamp = (value: number) => Math.min(axis.max, Math.max(axis.min, value));
  const vertical = (value: number) => plot.y + chartAxisFraction(clamp(value), axis, true) * plot.height;
  const across = (value: number) => options.rtl && type === 'bullet' ? plot.x + plot.width - chartAxisFraction(clamp(value), axis) * plot.width : plot.x + chartAxisFraction(clamp(value), axis) * plot.width;
  const slot = (i: number) => (options.rtl ? count - 1 - i : i);
  if (type === 'bullet') {
    const row = plot.height / count;
    series[0]?.values.forEach((value, i) => {
      if (value === null) return;
      const a = across(0), b = across(value), top = plot.y + i * row + row / 3;
      marks.push({ x: Math.min(a, b), y: top, width: Math.abs(b - a) + (options.labeled ? options.fontPx * 4 : 0) * (options.rtl ? 0 : 1), height: row / 3 });
      if (options.labeled && options.rtl) marks.push({ x: Math.min(a, b) - options.fontPx * 4, y: top, width: options.fontPx * 4, height: row / 3 });
    });
    (options.target ?? []).forEach((value, i) => { if (value !== null) marks.push({ x: across(value) - 2, y: plot.y + i * row + row / 6, width: 4, height: (2 * row) / 3 }); });
    return marks;
  }
  const bar = BAR_TYPES[type];
  if (bar) {
    const grouping = bar.stacked ? 'stacked' : 'clustered';
    const stacks = stackCategoryValues(series, count, 'bar', type.startsWith('100pct') ? 'percentStacked' : grouping);
    const band = (bar.horizontal ? plot.height : plot.width) / count, geometry = chartBarGeometry(band, bar.stacked ? 1 : series.length, grouping);
    stacks.forEach((points, j) => { points.forEach((point, i) => {
      if (!point) return;
      const offset = geometry.offset + (bar.stacked ? 0 : chartBarSeriesOffset(geometry, j, series.length, !bar.horizontal && options.rtl));
      if (bar.horizontal) {
        const a = across(point.from), b = across(point.to);
        marks.push({ x: Math.min(a, b), y: plot.y + i * band + offset, width: Math.abs(b - a) + (options.labeled ? options.fontPx * 4 : 0), height: geometry.width });
      } else {
        const a = vertical(point.from), b = vertical(point.to);
        const room = options.labeled ? lineHeight : 0;
        marks.push({ x: plot.x + slot(i) * band + offset, y: Math.min(a, b) - room, width: geometry.width, height: Math.abs(b - a) + room });
      }
    }); });
    return marks;
  }
  if (LINE_TYPES.has(type) || AREA_TYPES.has(type)) {
    const area = AREA_TYPES.has(type), stacked = type.includes('stacked');
    const stacks = stackCategoryValues(series, count, area ? 'area' : 'line', type.startsWith('100pct') ? 'percentStacked' : stacked ? 'stacked' : 'standard');
    const band = plot.width / count, x = (i: number) => plot.x + (slot(i) + 0.5) * band;
    const base = vertical(Math.min(axis.max, Math.max(axis.min, 0)));
    for (const points of stacks) {
      for (let i = 0; i < count; i++) {
        const point = points[i];
        if (!point) continue;
        const y = vertical(point.to);
        // The point and its label room (a value label above it).
        marks.push({ x: x(i) - options.fontPx * 1.5, y: y - (options.labeled ? lineHeight : options.fontPx * 0.3), width: options.fontPx * 3, height: (options.labeled ? lineHeight : 0) + options.fontPx * 0.6 });
        const next = points[i + 1];
        if (next) {
          const y2 = vertical(next.to), left = Math.min(x(i), x(i + 1));
          marks.push(area ? { x: left, y: Math.min(y, y2), width: band, height: Math.max(base, y, y2) - Math.min(y, y2) } : { x: left, y: Math.min(y, y2) - 2, width: band, height: Math.abs(y2 - y) + 4 });
        }
      }
    }
  }
  return marks;
}

/**
 * Place the labels of a chart's labeled bands inside their bands (see the module comment). `plot` is the chart's pinned plot as an inset from
 * `box`; `axis` its value axis. Undefined when the chart has no labeled band. `labeled` says the chart's marks carry data labels.
 */
export function placeBandLabels(chart: unknown, data: ResolvedChartData, axis: ChartValueAxis | undefined, box: Box, inset: ChartPlotInset, geometry: { scale: number; minFontSize?: number; measure: (text: string, size: number) => number; direction?: 'ltr' | 'rtl'; labeled?: boolean; avoid?: readonly Box[] }): ChartLayerBandLabels | undefined {
  if (!data.ok || !axis || !(axis.max > axis.min) || typeof chart !== 'object' || chart === null) return undefined;
  const type = String((chart as { type?: unknown }).type ?? '').trim().toLowerCase();
  const ranges = chartBandRanges(chartBands(chart), axis).filter(band => band.label !== undefined);
  if (!ranges.length) return undefined;
  const plot = { x: box.x + inset.left, y: box.y + inset.top, width: box.width - inset.left - inset.right, height: box.height - inset.top - inset.bottom };
  if (!(plot.width > 1 && plot.height > 1)) return { labels: [], legend: true, reason: 'too-large' };
  const { scale } = geometry, fontPx = chartTextSize({ width: box.width, height: box.height, scale, minFontSize: geometry.minFontSize }) * scale;
  const textHeight = fontPx * 1.22, padAlong = BAND_LABEL_PADDING.along * scale, padAcross = BAND_LABEL_PADDING.across * scale;
  const strip = type === 'bullet' || BAR_TYPES[type]?.horizontal === true, rtl = geometry.direction === 'rtl', count = data.rows.length;
  // Right to left, a column, line or area chart's categories run from the right and a bullet chart's values from the right; a bar chart keeps its
  // left-to-right value axis.
  const mirrored = rtl && (type === 'bullet' || !strip);
  const target = type === 'bullet' ? data.target?.values : undefined;
  // The data marks and labels, and what else composition placed in the plot (reference lines and their labels, the names at the line ends).
  const marks = [...dataMarks(type, data, axis, plot, { rtl: mirrored, labeled: geometry.labeled === true, fontPx, ...(target ? { target } : {}) }), ...(geometry.avoid ?? [])];
  const at = (value: number) => strip
    ? (mirrored ? plot.x + plot.width - chartAxisFraction(value, axis) * plot.width : plot.x + chartAxisFraction(value, axis) * plot.width)
    : plot.y + chartAxisFraction(value, axis, true) * plot.height;
  // A line or area chart's stripes run from the first to the last category center, as they are drawn.
  const inset2 = !strip && (LINE_TYPES.has(type) || AREA_TYPES.has(type)) && count >= 2 ? plot.width / count / 2 : 0;
  const labels: ChartBandLabel[] = [];
  for (const band of ranges) {
    const text = String(band.label).replace(/[\r\n]+/g, ' ');
    const width = geometry.measure(text, fontPx), height = textHeight;
    const a = at(band.from), b = at(band.to);
    const extent = strip ? { x: Math.min(a, b), y: plot.y, width: Math.abs(b - a), height: plot.height } : { x: plot.x + inset2, y: Math.min(a, b), width: plot.width - 2 * inset2, height: Math.abs(b - a) };
    if (width + 2 * padAlong > (strip ? extent.width : extent.width) + 0.01 || height + 2 * padAcross > (strip ? extent.height : extent.height) + 0.01) return { labels: [], legend: true, reason: 'too-large' };
    // The two places, the normal one first. A stripe's end is its right (left right to left); a strip's start is its left (right right to left).
    const startX = mirrored ? extent.x + extent.width - padAlong - width : extent.x + padAlong;
    const endX = mirrored ? extent.x + padAlong : extent.x + extent.width - padAlong - width;
    // The stripe's end is its last category's side whichever way the categories run; its start the first category's.
    const lastCategory = count - 1, firstCategory = 0;
    const places: ChartBandLabel[] = strip
      ? [
        { index: band.index, text, place: 'top', category: 0, align: mirrored ? 'right' : 'left', box: { x: startX, y: extent.y + padAcross, width, height } },
        { index: band.index, text, place: 'bottom', category: count - 1, align: mirrored ? 'right' : 'left', box: { x: startX, y: extent.y + extent.height - padAcross - height, width, height } },
      ]
      : [
        { index: band.index, text, place: 'end', category: lastCategory, align: mirrored ? 'left' : 'right', box: { x: endX, y: extent.y + padAcross, width, height } },
        { index: band.index, text, place: 'start', category: firstCategory, align: mirrored ? 'right' : 'left', box: { x: startX, y: extent.y + padAcross, width, height } },
      ];
    const chosen = places.find(place => !marks.some(mark => overlap(place.box, mark)));
    if (!chosen) return { labels: [], legend: true, reason: 'collision' };
    labels.push(chosen);
  }
  return { labels };
}

/** The contrast every band label keeps against its band. */
export const BAND_LABEL_MIN_CONTRAST = 4.5;

/**
 * The one color of all band labels of a chart: the secondary text color (`secondary`, the axis-label color) when it reaches 4.5:1 on every labeled
 * band's fill, otherwise the primary text color (`primary`). `failing` lists the positions (in `fills`) where even the primary color stays below
 * 4.5:1 (an author's own dark band): the label is still drawn there, and the engines report it.
 */
export function bandLabelColor(fills: readonly string[], secondary: string, primary: string): { color: string; failing: number[] } {
  const reads = (color: string) => fills.map((fill, at) => [at, colorContrast(color, fill) ?? 0] as const);
  if (reads(secondary).every(([, ratio]) => ratio >= BAND_LABEL_MIN_CONTRAST)) return { color: secondary, failing: [] };
  return { color: primary, failing: reads(primary).flatMap(([at, ratio]) => ratio < BAND_LABEL_MIN_CONTRAST ? [at] : []) };
}
