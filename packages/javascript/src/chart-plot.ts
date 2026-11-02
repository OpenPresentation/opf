// LH-93: sibling charts that share one value axis (LH-33) also share one plot height.
//
// A shared axis only lets charts be read against each other when equal values also stand equally tall, so the plots of the charts must
// be of one height too. Each engine lays a chart's plot out from its own header row, legend, axis titles, tick labels and category
// labels, so a legend or an axis title on one sibling made its plot shorter. Composition now computes the inner plot box of each column,
// line or area chart of a shared set the way the preview lays it out (chartPlotInset), and gives the set one plot height: siblings side
// by side keep one baseline and one top, and siblings in different rows take the shortest plot's height on their own baseline. The plot
// is stored as an inset from the chart box (ChartLayer.plot); the preview draws its plot there and the PPTX export writes it as the
// plot area's manual layout (c:plotArea c:manualLayout, layoutTarget inner), so PowerPoint draws the same plot.
import {chartTextSize, type ChartValueAxis} from './chart-axis.js';
import {formatDataNumber, numberFormatError, resolveChartData, type ResolvedChartData} from './chart-data.js';
import {chartDrawPlan} from './chart-fallback.js';
import type {ChartLayer, ChartPlotInset} from './chart-layer.js';
import {chartOptionTarget, resolveChartOptions} from './chart-options.js';

interface Box { x: number; y: number; width: number; height: number }

/** The geometry a chart's plot is laid out with. Lengths are slide pixels. */
export interface ChartPlotGeometry {
  box: Box;
  /** `min(slide width, slide height) / 720`. */
  scale: number;
  minFontSize?: number;
  /** The width of `text` at `size` px in the deck's body font at weight 400. */
  measure: (text: string, size: number) => number;
  direction?: 'ltr' | 'rtl';
  language?: string;
}

/** The vertical category charts (column, line, area) whose plot the preview lays out under a horizontal category axis. */
const VERTICAL: Readonly<Record<string, {key?: 'line'; percent?: boolean}>> = {
  column: {}, 'stacked-column': {}, '100pct-stacked-column': {percent: true},
  line: {key: 'line'}, 'line-with-markers': {key: 'line'}, 'stacked-line': {key: 'line'}, 'stacked-line-with-markers': {key: 'line'},
  area: {}, 'stacked-area': {}, '100pct-stacked-area': {percent: true},
};

// Whitespace that may split a category label; no-break spaces stay inside their word (the preview's rule).
const BREAKABLE = /[^\S  ﻿]+/u;
const ELLIPSIS = '…';
const clean = (value: number): number => { const rounded = Number(value.toPrecision(12)); return Object.is(rounded, -0) ? 0 : rounded; };
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A value axis tick as the preview labels it: a percentage on a 100% chart, else the first series' number format, else General. */
function tickLabel(value: number, percent: boolean, format: string | undefined): string {
  if (percent) return `${clean(value * 100)}%`;
  return format === undefined ? String(clean(value)) : formatDataNumber(clean(value), format);
}

/**
 * The room the category labels take under a plot (the preview's planBottomLabels): one line, or two when a label with spaces only fits
 * its band on two; else labels turned 45 or 90 degrees, as long as they fit `cap`; else every n-th label on one line.
 */
function categoryLabelReserve(labels: readonly string[], plot: {x: number; width: number}, cap: number, leftLimit: number, m: {width: (text: string) => number; fontPx: number; lineHeight: number}): number {
  const count = labels.length;
  if (!count) return m.lineHeight;
  const band = plot.width / count, gap = m.fontPx * 0.1, lineH = m.fontPx * 1.22;
  const minX = plot.x - m.fontPx * 0.5, maxX = plot.x + plot.width + m.fontPx * 0.5, limit = Math.max(1, maxX - minX);
  const allowTwo = cap >= m.lineHeight + lineH - 0.01;
  const widths = labels.map(text => text ? m.width(text) : 0);
  const two = (text: string): number | undefined => {
    const words = text.split(BREAKABLE).filter(Boolean);
    let best: number | undefined;
    for (let split = 1; split < words.length; split++) {
      const width = Math.max(m.width(words.slice(0, split).join(' ')), m.width(words.slice(split).join(' ')));
      if (best === undefined || width < best - 1e-9) best = width;
    }
    return best;
  };
  const ellipsized = (text: string): number => {
    const chars = Array.from(text);
    const fits = (length: number) => m.width(chars.slice(0, length).join('').trimEnd() + ELLIPSIS) <= limit;
    let low = 0, high = chars.length;
    while (low < high) { const middle = Math.ceil((low + high) / 2); if (fits(middle)) low = middle; else high = middle - 1; }
    return m.width(chars.slice(0, low).join('').trimEnd() + ELLIPSIS);
  };
  type Option = {n: number; reserve: number};
  const horizontal = (n: number): Option | undefined => {
    const slot = n * band - gap;
    let prevRight = -Infinity, rows = 1;
    for (let i = 0; i < count; i += n) {
      let width = widths[i]!, lines = 1;
      if (width > slot && allowTwo) { const split = two(labels[i]!); if (split !== undefined && split <= slot) { width = split; lines = 2; } }
      if (width > limit) { width = ellipsized(labels[i]!); lines = 1; }
      const cx = plot.x + (i + 0.5) * band;
      const left = Math.min(Math.max(cx - width / 2, minX), maxX - width);
      if (left < prevRight + gap - 1e-6) return undefined;
      prevRight = left + width;
      rows = Math.max(rows, lines);
    }
    return {n, reserve: m.lineHeight + (rows - 1) * lineH};
  };
  let plain: Option | undefined;
  for (let n = 1; n <= count && !plain; n++) plain = horizontal(n);
  plain ??= {n: count, reserve: m.lineHeight};
  const rotated = (angle: 45 | 90): Option | undefined => {
    const sin = angle === 90 ? 1 : Math.SQRT1_2, cos = angle === 90 ? 0 : Math.SQRT1_2;
    const n = Math.max(1, Math.ceil(lineH / sin / band - 1e-9));
    let extent = 0;
    for (let i = 0; i < count; i += n) {
      const cx = plot.x + (i + 0.5) * band;
      if (cx - widths[i]! * cos - lineH * sin / 2 < leftLimit - 1e-6) return undefined;
      extent = Math.max(extent, widths[i]! * sin + lineH * cos);
    }
    const reserve = Math.max(m.lineHeight, m.fontPx * 0.25 + extent);
    return reserve > cap + 1e-6 ? undefined : {n, reserve};
  };
  const options = [plain, rotated(45), rotated(90)].filter((option): option is Option => option !== undefined);
  return (options.find(option => option.n === 1) ?? options.reduce((best, option) => option.n < best.n ? option : best)).reserve;
}

/**
 * LH-93: the inner plot box of a column, line or area chart (not a horizontal bar or combo chart) as an inset from its chart box, laid
 * out the way the preview lays it out (opf-render charts.js): below the header row (LH-81) or a top legend, above a bottom legend, the
 * category axis title and the category labels (one line, two, or turned: core reproduces the preview's choice), right of the value
 * axis title and the value tick labels (the composed axis's ticks in the first series' format; half a text size when a small chart drops
 * its value axis), left of a side legend. `composed` is the chart's composed value axis and layer; without a usable axis (none, or one of
 * more than 1000 intervals) there is no inset.
 */
export function chartPlotInset(chart: unknown, resolved: ResolvedChartData, composed: {valueAxis?: ChartValueAxis; layer?: ChartLayer}, geometry: ChartPlotGeometry): ChartPlotInset | undefined {
  if (!record(chart) || !resolved.ok || resolved.combo) return undefined;
  const axis = composed.valueAxis, layer = composed.layer;
  if (!axis || !(axis.majorUnit > 0) || !Number.isFinite(axis.max - axis.min) || (axis.max - axis.min) / axis.majorUnit > 1000) return undefined;
  const authored = typeof chart.type === 'string' ? chart.type.trim().toLowerCase() : '';
  const plan = chartDrawPlan(chart, resolved, {language: geometry.language});
  const spec = Object.hasOwn(VERTICAL, plan.type) ? VERTICAL[plan.type]! : undefined;
  if (!spec || plan.columns.length < 2 || !plan.rows.length) return undefined;
  const {box, scale} = geometry;
  if (![box.width, box.height, scale].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || scale <= 0) return undefined;
  const fontPx = chartTextSize({width: box.width, height: box.height, scale, minFontSize: geometry.minFontSize}) * scale;
  const pad = 10 * scale, lineHeight = fontPx * 1.5, rtl = geometry.direction === 'rtl';
  const width = (text: string) => geometry.measure(text, fontPx);
  const names = plan.columns.slice(1).map(name => name === null || name === undefined ? '' : String(name));
  // The box the plot is laid out in, carved as the preview carves it: the header row, then an explicit legend, then the axis titles.
  let inner = {...box};
  const cut = (side: 'top' | 'bottom' | 'left' | 'right', size: number) => {
    if (side === 'top') inner = {...inner, y: inner.y + size, height: Math.max(1, inner.height - size)};
    else if (side === 'bottom') inner = {...inner, height: Math.max(1, inner.height - size)};
    else if (side === 'left') inner = {...inner, x: inner.x + size, width: Math.max(1, inner.width - size)};
    else inner = {...inner, width: Math.max(1, inner.width - size)};
  };
  if (layer?.header) cut('top', layer.header.height);
  const options = resolveChartOptions(chart, chartOptionTarget(authored));
  const keyWidth = spec.key === 'line' ? fontPx * 1.4 : fontPx * 0.6, keyGap = fontPx * 0.4;
  const legendWidth = (within: number) => Math.min(within * 0.45, keyWidth + keyGap + Math.max(0, ...names.map(width)) + fontPx * 0.5);
  let legendManaged = Boolean(layer?.header?.legend);
  if (options.active && options.legend !== undefined) {
    legendManaged = true;
    if (options.legend === 'left' || options.legend === 'right') cut(options.legend, legendWidth(inner.width) + pad);
    else if (options.legend === 'top' || options.legend === 'bottom') {
      // Entries flow in rows across the chart width, as the preview's top and bottom legends do.
      const available = Math.max(1, inner.width - 2 * pad), spacing = fontPx * 0.8;
      let rows = 0, used = Infinity;
      for (const name of names) {
        const entry = Math.min(available, keyWidth + keyGap + width(name) + spacing);
        if (used + entry <= available + 0.01) used += entry; else { rows++; used = entry; }
      }
      if (rows) cut(options.legend, rows * lineHeight + pad);
    }
  }
  if (options.active) {
    if (options.axisTitles.value) cut('left', lineHeight);
    if (options.axisTitles.category) cut('bottom', lineHeight);
  }
  const hidden = layer?.small?.valueAxis === false;
  const side = names.length > 1 && !legendManaged ? legendWidth(inner.width) + pad : 0;
  const right = inner.x + inner.width - pad - side;
  // A small chart without its value axis keeps a line above the tallest mark for its value label.
  const top = inner.y + pad + (hidden ? lineHeight : lineHeight / 2);
  const format = typeof plan.formats[1] === 'string' && plan.formats[1] !== '' && !numberFormatError(plan.formats[1]) ? plan.formats[1] : undefined;
  const percent = spec.percent === true;
  const ticks: number[] = [];
  for (let index = 0, count = Math.floor((axis.max - axis.min) / axis.majorUnit + 1e-9); index <= count; index++) ticks.push(clean(axis.min + index * axis.majorUnit));
  const tickWidth = hidden ? fontPx / 2 : Math.max(...ticks.map(tick => width(tickLabel(tick, percent, format)))) + fontPx * 0.5;
  const x = rtl ? inner.x + pad + fontPx / 2 : inner.x + pad + tickWidth;
  const plotWidth = Math.max(1, rtl ? right - tickWidth - x : right - x - fontPx / 2);
  const labels = plan.rows.map(row => row[0] === null || row[0] === undefined ? '' : String(row[0]).replace(/[\r\n]+/g, ' '));
  if (rtl) labels.reverse();
  const cap = Math.max(lineHeight + fontPx * 1.22, inner.height * 0.4);
  const reserve = categoryLabelReserve(labels, {x, width: plotWidth}, cap, inner.x + pad, {width, fontPx, lineHeight});
  const bottom = inner.y + inner.height - pad - reserve;
  if (!(bottom - top > 1)) return undefined;
  return {left: x - box.x, top: top - box.y, right: box.x + box.width - (x + plotWidth), bottom: box.y + box.height - bottom};
}

/** LH-93: a chart of a shared set: its object, its box and what composition gave it. */
export interface SiblingPlotChart {
  value: unknown;
  box: Box;
  chart?: {valueAxis?: ChartValueAxis; layer?: ChartLayer};
}

/**
 * LH-93: the charts of each shared set (`shareSiblingChartAxes`) get one plot height. Every member's plot is laid out on its own
 * (chartPlotInset); members whose boxes overlap vertically stand side by side and share their plots' lowest top and highest bottom, and
 * the set takes the shortest such plot height, each member's plot ending at its row's baseline. The result is written to the member's
 * layer as `plot`. A set with a member that has no inset (a horizontal bar chart, a chart without a usable axis) is left as it was.
 * `geometryFor` gives a member's scale, text floor, measure, direction and language; `document` resolves dataset references.
 */
export function shareSiblingPlots(sets: readonly (readonly SiblingPlotChart[])[], geometryFor: (item: SiblingPlotChart) => Omit<ChartPlotGeometry, 'box'>, document?: unknown): void {
  for (const members of sets) {
    if (members.length < 2) continue;
    const plots = members.map(item => {
      const resolved = resolveChartData(item.value, document);
      const inset = item.chart ? chartPlotInset(item.value, resolved, item.chart, {...geometryFor(item), box: item.box}) : undefined;
      return inset ? {item, inset, top: item.box.y + inset.top, bottom: item.box.y + item.box.height - inset.bottom} : undefined;
    });
    if (plots.some(plot => plot === undefined)) continue;
    const placed = plots as NonNullable<(typeof plots)[number]>[];
    // Rows: members whose boxes overlap by at least half the shorter box's height stand side by side.
    const rows: (typeof placed)[] = [];
    for (const plot of [...placed].sort((a, b) => a.item.box.y - b.item.box.y)) {
      const overlaps = (other: typeof plot) => Math.min(plot.item.box.y + plot.item.box.height, other.item.box.y + other.item.box.height) - Math.max(plot.item.box.y, other.item.box.y) >= Math.min(plot.item.box.height, other.item.box.height) / 2;
      const row = rows.find(entry => entry.some(overlaps));
      if (row) row.push(plot); else rows.push([plot]);
    }
    const spans = rows.map(row => ({row, top: Math.max(...row.map(plot => plot.top)), bottom: Math.min(...row.map(plot => plot.bottom))}));
    const height = Math.min(...spans.map(span => span.bottom - span.top));
    if (!(height > 1)) continue;
    for (const {row, bottom} of spans) {
      for (const {item, inset} of row) {
        const plot: ChartPlotInset = {left: inset.left, right: inset.right, top: bottom - height - item.box.y, bottom: item.box.y + item.box.height - bottom};
        item.chart!.layer = {...item.chart!.layer, plot};
      }
    }
  }
}

