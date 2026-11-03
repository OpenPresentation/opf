// RR-92: the value axis of a category chart, computed once in core so the preview and the PPTX export draw and write the same axis.
//
// Before RR-92 the scale (`niceScale`) lived in opf-render only, sized by the plot the renderer laid out, and opf-pptx wrote just
// `c:min 0`, so PowerPoint and Keynote chose their own major unit (the preview showed 0 to 800 in steps of 100, Keynote steps of 200).
// Composition now derives the axis from the chart box and the chart text size, and the exporter writes it as c:max and c:majorUnit.
import { chartOptionTarget, resolveChartOptions } from './chart-options.js';
import { chartNumber, resolveChartData, type ResolvedChartData } from './chart-data.js';
import { chartDrawPlan } from './chart-fallback.js';

/** The ticks of an automatic value axis: `ticks` runs from `min` to `max` in steps of `step`. */
export interface ChartScale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

/**
 * The value axis of a chart: the bounds and the major unit (the distance between gridlines) in data units. A percent-stacked chart's axis
 * is a fraction (`max: 1` is 100%) and has `percent: true`, as PowerPoint stores it.
 */
export interface ChartValueAxis {
  min: number;
  max: number;
  majorUnit: number;
  percent?: true;
}

/**
 * RR-90: the chart text size a roomy chart asks for, in slide pixels at the 1280 x 720 reference (before the slide scale). It was 14,
 * floored to the 16 px (12 pt) minimum, beside 24 pt bullets; 20 px (15 pt) keeps the 4:5 ratio to the 25 px table body.
 */
export const CHART_TEXT_PX = 20;

/** WI-5: the smallest chart text a box that has room for it draws, in slide pixels at the 1280 x 720 reference (it was the 16 px minimum). */
export const CHART_TEXT_FLOOR_PX = 18;
/** WI-5: a box at least this tall (12 lines of {@link CHART_TEXT_FLOOR_PX} text) has room for the 18 px floor, in reference pixels. */
const CHART_FLOOR_MIN_HEIGHT = 12 * CHART_TEXT_FLOOR_PX;
/** WI-5: a box at least this wide (16 ems of {@link CHART_TEXT_FLOOR_PX} text) has room for the 18 px floor, in reference pixels. */
const CHART_FLOOR_MIN_WIDTH = 16 * CHART_TEXT_FLOOR_PX;
/** WI-5: value-axis intervals are at least this far apart (reference pixels), so a short axis shows fewer ticks instead of a crowded scale. */
export const CHART_MIN_TICK_SPACING_PX = 48;
/**
 * WI-5: a value axis has at most this many intervals, however long it is: 0 to 100% in fives is a scale, 0 to 90% in tens is a ruler.
 * LH-105: six (seven labels; it was eight): a few well-rounded ticks, as Few asks of a graph, and the 1, 2 or 5 step of niceScale.
 */
export const CHART_MAX_INTERVALS = 6;

/**
 * RR-90: the unscaled chart text size for a chart box: {@link CHART_TEXT_PX}, shrunk only when the box is small (the text is at most
 * 1/18 of the box height and 1/30 of its width, whole pixels) and never below `minFontSize` (default 16). WI-5: a box with room for it
 * (at least 216 x 288 reference pixels) keeps {@link CHART_TEXT_FLOOR_PX} (18) as its floor, so a three-column or dashboard chart draws 18 px text
 * where it drew 16. `width` and `height` are the box in
 * canvas pixels and `scale` is `min(slide width, slide height) / 720`. The preview and the axis density both call it, so the
 * axis core computes matches the text the preview draws.
 */
export function chartTextSize(geometry: { width: number; height: number; scale: number; minFontSize?: number }): number {
  const { width, height, scale } = geometry;
  const minimum = geometry.minFontSize ?? 16;
  if (![width, height, scale].every(Number.isFinite) || width <= 0 || height <= 0 || scale <= 0) return Math.max(CHART_TEXT_PX, minimum);
  const roomy = Math.floor(Math.min(CHART_TEXT_PX, height / scale / 18, width / scale / 30));
  const roomForFloor = height / scale >= CHART_FLOOR_MIN_HEIGHT && width / scale >= CHART_FLOOR_MIN_WIDTH;
  return Math.max(roomy, minimum, roomForFloor ? CHART_TEXT_FLOOR_PX : 0);
}

function clean(value: number): number {
  const rounded = Number(value.toPrecision(12));
  return Object.is(rounded, -0) ? 0 : rounded;
}

// LH-59: the ticks run from `min` in steps of `step` up to `max`, which a tightened axis need not land on (PowerPoint draws the same
// gridlines for c:min, c:max and c:majorUnit).
function scaleFrom(min: number, max: number, step: number): ChartScale {
  const ticks: number[] = [];
  const count = Math.floor((max - min) / step + 1e-9);
  for (let index = 0; index <= count; index++) ticks.push(clean(min + index * step));
  return { min, max, step, ticks };
}

function pickStep(min: number, max: number, limit: number, steps: readonly number[]): number {
  return steps.find((step) => Math.round((max - min) / step) <= limit) ?? max - min;
}

/** LH-119: a labeled line with a hidden value axis drops zero when its minimum is at least this share of its maximum (5/6 otherwise). */
export const CHART_LABELED_ZERO_SHARE = 0.75;

/** LH-59: an axis ends at most this fraction of the plotted range above the data maximum (1.25 x the maximum on a zero-based axis). */
export const CHART_AXIS_MAX_OVERSHOOT = 0.25;

/**
 * Office-like automatic value axis: include zero unless every value sits in the top sixth of the range, add 5% headroom, then choose
 * the smallest 1/2/5 x 10^k major unit that fits `maxIntervals` (default 10, at least 1). `percent` is the 100% stacked axis: 0 to 1 in
 * steps of 0.1, 0.2, 0.25, 0.5 or 1 (from -1 when a value is negative). Non-finite data bounds fall back to 0 to 1.
 *
 * LH-59: the maximum stays near the data. When the first tick at or above the headroom lies more than
 * {@link CHART_AXIS_MAX_OVERSHOOT} of the plotted range above the data maximum (1.25 x the maximum on a zero-based axis; data peaking
 * at 124 on an axis of 0 to 200), the axis ends at the first multiple of the largest finer 1/2/5 unit within that bound (150). The ticks
 * then keep the major unit when the last one is at most half a unit below the end (0 to 40 in tens, ending at 45: the end is not a tick,
 * as in PowerPoint with a c:max off the major unit). Otherwise the major unit becomes the end divided into as many equal intervals as
 * fit, each a multiple of that unit (0, 400, 800; one interval, 0 and 150, on the shortest axes), keeping zero on a tick. `endOnTick`
 * keeps the untightened axis, for a chart whose outermost gridline is the axis end (the radar's outer ring, the combo chart's gridlines
 * shared by its two axes).
 *
 * LH-119: `labeled` is a line whose every point carries its value label and whose value axis is hidden: nothing reads a length from zero,
 * so zero is dropped once every value sits in the top quarter of the range ({@link CHART_LABELED_ZERO_SHARE}: the minimum at least 0.75 of
 * the maximum), and the line keeps the plot's height for its shape.
 */
export function niceScale(dataMin: number, dataMax: number, maxIntervals = 10, { percent = false, endOnTick = false, labeled = false }: { percent?: boolean; endOnTick?: boolean; labeled?: boolean } = {}): ChartScale {
  const limit = Number.isFinite(maxIntervals) ? Math.max(1, Math.floor(maxIntervals)) : 10;
  if (percent) {
    const min = dataMin < -1e-9 ? -1 : 0;
    const max = dataMax > 1e-9 || min === 0 ? 1 : 0;
    return scaleFrom(min, max, pickStep(min, max, limit, [0.1, 0.2, 0.25, 0.5, 1]));
  }
  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) {
    dataMin = 0;
    dataMax = 1;
  }
  let lo = Math.min(dataMin, 0);
  let hi = Math.max(dataMax, 0);
  if (dataMin > 0 && (labeled ? dataMin >= CHART_LABELED_ZERO_SHARE * dataMax : dataMax - dataMin < dataMax / 6)) lo = dataMin;
  if (dataMax < 0 && (labeled ? dataMax <= CHART_LABELED_ZERO_SHARE * dataMin : dataMax - dataMin < -dataMin / 6)) hi = dataMax;
  if (hi === lo) {
    if (hi === 0) hi = 1;
    else if (hi > 0) lo = 0;
    else hi = 0;
  }
  const span = hi - lo;
  const top = hi > 0 ? hi + span / 20 : hi;
  const bottom = lo < 0 ? lo - span / 20 : lo > 0 ? Math.max(0, lo - span / 20) : lo;
  const raw = (top - bottom) / limit;
  if (!(raw > 0) || !Number.isFinite(raw)) return normalizedScale(dataMin, dataMax, limit);
  let exponent = Math.floor(Math.log10(raw)) - 1;
  for (; exponent <= 308; exponent++) {
    for (const mantissa of [1, 2, 5]) {
      const step = mantissa * 10 ** exponent;
      if (!(step > 0) || !Number.isFinite(step)) continue;
      const min = Math.floor(bottom / step + 1e-9) * step;
      const max = Math.ceil(top / step - 1e-9) * step;
      if (Number.isFinite(min) && Number.isFinite(max) && Math.round((max - min) / step) <= limit) {
        const scale = scaleFrom(clean(min), clean(max), step);
        return endOnTick ? scale : tighten(scale, top, hi + span * CHART_AXIS_MAX_OVERSHOOT, limit, mantissa, exponent);
      }
    }
  }
  return normalizedScale(dataMin, dataMax, limit);
}

// LH-59: end an axis whose top tick lies above `bound` at the first multiple of a finer 1/2/5 unit at or above `top` (the data maximum
// plus its headroom), as {@link niceScale} describes. The units below the major unit (`mantissa` x 10^`exponent`) are tried from the
// largest, so the end is as round as the bound allows; any unit up to the window `bound - top` fits. The ticks start at the minimum, so
// PowerPoint's c:min, c:max and c:majorUnit draw the same gridlines.
function tighten(scale: ChartScale, top: number, bound: number, limit: number, mantissa: number, exponent: number): ChartScale {
  if (!(scale.max > bound) || !(bound > top) || !(top > scale.min)) return scale;
  const units = [5, 2, 1];
  let index = units.indexOf(mantissa);
  for (let guard = 0; guard < 60; guard++) {
    if (++index >= units.length) { index = 0; exponent--; }
    const unit = units[index]! * 10 ** exponent;
    if (!(unit > 0) || !Number.isFinite(unit)) break;
    const end = clean(Math.ceil(top / unit - 1e-9) * unit);
    if (!(end <= bound)) continue;
    const kept = scaleFrom(scale.min, end, scale.step);
    if (kept.ticks.length > 1 && end - kept.ticks.at(-1)! <= scale.step / 2 + 1e-9 * scale.step) return kept;
    const whole = (value: number, of: number) => Math.abs(value / of - Math.round(value / of)) < 1e-9;
    // LH-105: an axis with room for three intervals or more is not cut down to one (0 and 140 where 0, 50, 100 fit); a finer end is tried.
    const fewest = limit >= 3 ? 2 : 1;
    for (let intervals = limit; intervals >= fewest; intervals--) {
      const step = clean((end - scale.min) / intervals);
      if (step > 0 && whole(step, unit) && whole(scale.min, step)) return scaleFrom(scale.min, end, step);
    }
    if (fewest === 1) return kept.ticks.length > 1 ? kept : scale;
  }
  return scale;
}

// Work in representable units when headroom or a tick step exceeds Number's range. Only axis bounds and ticks saturate at the
// representable endpoints; data values keep their actual positions. Subnormal rounding may merge ticks.
function normalizedScale(dataMin: number, dataMax: number, limit: number): ChartScale {
  const magnitude = Math.max(Math.abs(dataMin), Math.abs(dataMax));
  const unit = 10 ** Math.floor(Math.log10(magnitude)) || Number.MIN_VALUE;
  const normalized = niceScale(dataMin / unit, dataMax / unit, limit);
  const restore = (value: number): number => {
    const scaled = value * unit;
    return Number.isFinite(scaled) ? scaled : Math.sign(value) * Number.MAX_VALUE;
  };
  const min = Math.min(restore(normalized.min), dataMin);
  const max = Math.max(restore(normalized.max), dataMax);
  const ticks = [...new Set([min, ...normalized.ticks.map(restore), max])].sort((a, b) => a - b);
  return { min, max, step: restore(normalized.step) || Number.MIN_VALUE, ticks };
}

/** How many intervals a value axis `length` pixels long can carry when each tick label needs `labelExtent` pixels: 1 to {@link CHART_MAX_INTERVALS} (LH-105: it was 10). */
export function maxIntervalsFor(length: number, labelExtent: number): number {
  return Math.max(1, Math.min(CHART_MAX_INTERVALS, Math.floor(length / Math.max(1, labelExtent))));
}

/**
 * WI-5 (P19): how many intervals a chart's value axis `length` pixels long carries: {@link maxIntervalsFor} with a label extent of at least
 * {@link CHART_MIN_TICK_SPACING_PX} at the slide `scale`, and at most {@link CHART_MAX_INTERVALS}. A chart beside a text column
 * or one of three peer columns, whose axis is a few hundred pixels long, then draws 0 to 100% in steps of 20 and not 0 to 90% in steps of 10.
 */
export function chartIntervalsFor(length: number, labelExtent: number, scale: number): number {
  const spacing = CHART_MIN_TICK_SPACING_PX * (Number.isFinite(scale) && scale > 0 ? scale : 1);
  return Math.min(CHART_MAX_INTERVALS, maxIntervalsFor(length, Math.max(labelExtent, spacing)));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Category charts: column, bar, line and area (standard, stacked, 100%)

interface CategoryChartSpec {
  kind: 'bar' | 'line' | 'area';
  /** Bars run horizontally (`bar` types); every other type has a vertical value axis. */
  horizontal: boolean;
  grouping: 'clustered' | 'standard' | 'stacked' | 'percentStacked';
}

const bar = (horizontal: boolean, grouping: CategoryChartSpec['grouping']): CategoryChartSpec => ({ kind: 'bar', horizontal, grouping });
const line = (grouping: CategoryChartSpec['grouping']): CategoryChartSpec => ({ kind: 'line', horizontal: false, grouping });
const area = (grouping: CategoryChartSpec['grouping']): CategoryChartSpec => ({ kind: 'area', horizontal: false, grouping });

/** The chart types with a computed value axis, by their `chart.type` id (core's CHART_TYPES vocabulary). */
const CATEGORY_CHARTS: Readonly<Record<string, CategoryChartSpec>> = {
  column: bar(false, 'clustered'),
  'stacked-column': bar(false, 'stacked'),
  '100pct-stacked-column': bar(false, 'percentStacked'),
  bar: bar(true, 'clustered'),
  'stacked-bar': bar(true, 'stacked'),
  '100pct-stacked-bar': bar(true, 'percentStacked'),
  line: line('standard'),
  'line-with-markers': line('standard'),
  'stacked-line': line('stacked'),
  'stacked-line-with-markers': line('stacked'),
  area: area('standard'),
  'stacked-area': area('stacked'),
  '100pct-stacked-area': area('percentStacked'),
};

/**
 * Plotted extents per series point. Bars stack positive and negative values separately; lines and areas accumulate the signed sum.
 * 100% groupings divide by the category's sum of absolute values first. Throws a RangeError when a total leaves the finite range.
 */
export function stackCategoryValues(
  series: readonly { values: readonly (number | null)[] }[],
  count: number,
  kind: string,
  grouping: string,
  path = 'chart',
): ({ value: number; from: number; to: number } | null)[][] {
  const percent = grouping === 'percentStacked';
  const stacked = grouping === 'stacked' || percent;
  const fail = (aggregate: string) => new RangeError(`Cannot render ${path}: ${aggregate} exceeds the finite numeric range. Rescale the chart values before rendering.`);
  const totals = Array.from({ length: count }, (_, i) => series.reduce((sum, entry) => sum + Math.abs(entry.values[i] ?? 0), 0));
  if (percent && totals.some((total) => !Number.isFinite(total))) throw fail('percentage total');
  const positive = new Array<number>(count).fill(0);
  const negative = new Array<number>(count).fill(0);
  const running = new Array<number>(count).fill(0);
  return series.map((entry) =>
    entry.values.map((raw, i) => {
      if (raw === null && kind !== 'area') return null;
      let value = raw ?? 0;
      if (percent) value = totals[i] ? value / totals[i]! : 0;
      if (!stacked) return { value, from: 0, to: value };
      if (kind === 'bar') {
        const base = value >= 0 ? positive : negative;
        const from = base[i]!;
        base[i]! += value;
        if (!Number.isFinite(base[i]!)) throw fail('stacked total');
        return { value, from, to: base[i]! };
      }
      const from = running[i]!;
      running[i]! += value;
      if (!Number.isFinite(running[i]!)) throw fail('stacked total');
      return { value, from, to: running[i]! };
    }),
  );
}

/** LH-59: one bar of a waterfall: the step's value and the running totals it spans; a total bar spans zero to its value. */
export interface WaterfallStep {
  /** The row the bar plots. */
  index: number;
  value: number;
  from: number;
  to: number;
  total: boolean;
}

/**
 * LH-59: the bars of a waterfall (`values` is the plotted column, null for a row without a value). Each step floats from the running
 * total before it. OPF has no total marker, so a total is inferred: the last value is a total when at least two values precede it and
 * it equals their sum (to twelve significant digits), as in Start 100, +24, -8, End 116. A total bar stands on zero and does not add to
 * the running total, and the PPTX export writes it as a cx:subtotals index, so PowerPoint draws the same bar. Throws a RangeError when
 * the running total leaves the finite range.
 */
export function waterfallSteps(values: readonly (number | null)[], path = 'chart'): WaterfallStep[] {
  const steps: WaterfallStep[] = [];
  let running = 0;
  for (const [index, value] of values.entries()) {
    if (value === null || !Number.isFinite(value)) continue;
    const from = running;
    running += value;
    if (!Number.isFinite(running)) throw new RangeError(`Cannot render ${path}: running total exceeds the finite numeric range. Rescale the chart values before rendering.`);
    steps.push({ index, value, from, to: running, total: false });
  }
  const last = steps.at(-1);
  if (last && steps.length > 2 && clean(last.value) === clean(last.from)) Object.assign(last, { from: 0, to: last.value, total: true });
  return steps;
}

/** The slide geometry the axis density follows. All lengths are slide pixels. */
export interface ChartAxisGeometry {
  /** The chart box (after any caption band). */
  width: number;
  height: number;
  /** `min(slide width, slide height) / 720`. */
  scale: number;
  /** The composition's `minFontSize` (default 16), which the chart text never goes below. */
  minFontSize?: number;
  /** LH-60: the deck language, which names the places a map chart plots (a map over other categories is drawn as columns). */
  language?: string;
  /** LH-119: the chart is a line whose points carry their value labels and whose value axis is hidden (the small chart, LH-03). */
  labeled?: boolean;
  /** LH-110: values the axis must hold besides the data (the reference lines the title names). */
  include?: readonly number[];
}

/**
 * The value axis of a column, bar, line or area chart (`chart` is the chart object, `resolved` its `resolveChartData`), or undefined for any other type (or data with no plotted series).
 *
 * The axis is `niceScale` of the plotted extents (bars and areas include zero) with at most `maxIntervalsFor(length, label)` intervals.
 * `length` is the plot's extent along the value axis, estimated from the box the way the preview lays a chart with one line of
 * horizontal category labels out:
 *
 * - column, line, area: box height - 2 x pad - 1.5 x line height (the top margin plus the category labels), less one line height
 *   for a category axis title and one line height plus a pad for a top or bottom legend (a one-row legend), over intervals
 *   1.2 line heights tall ({@link chartIntervalsFor}: at least 48 reference pixels, at most 8 intervals);
 * - bar: the width left of a category gutter of 30% of the box, minus the padding, over labels `4 x text size` wide.
 *
 * with pad = 10 x scale, text size = {@link chartTextSize} x scale and line height = 1.5 x text size. Rotated or
 * wrapped category labels, a wider tick label and a legend of several rows make the preview's plot shorter than this estimate; for
 * the usual chart (a plot of ten tick labels or more) all of them give the same ten intervals.
 */
export function chartValueAxis(chart: unknown, resolved: ResolvedChartData, geometry: ChartAxisGeometry): ChartValueAxis | undefined {
  const type = typeof chart === 'object' && chart !== null ? (chart as { type?: unknown }).type : undefined;
  const authored = typeof type === 'string' ? type.trim().toLowerCase() : '';
  // LH-60: the drawn construct (a map over categories that are not places is drawn as columns, and takes their axis).
  const id = resolved.ok ? chartDrawPlan(chart, resolved, { language: geometry.language }).type : authored;
  const spec = Object.hasOwn(CATEGORY_CHARTS, id) ? CATEGORY_CHARTS[id] : undefined;
  if (!spec || !resolved.ok || resolved.combo) return undefined;
  const { scale, width, height } = geometry;
  if (![width, height, scale].every(Number.isFinite) || width <= 0 || height <= 0 || scale <= 0) return undefined;
  const series = resolved.columns.slice(1).map((_, offset) => ({ values: resolved.rows.map((row) => chartNumber(row[offset + 1])) }));
  if (!series.length || !resolved.rows.length) return undefined;
  const percent = spec.grouping === 'percentStacked';
  let stacks: ReturnType<typeof stackCategoryValues>;
  try {
    stacks = stackCategoryValues(series, resolved.rows.length, spec.kind, spec.grouping);
  } catch {
    return undefined;
  }
  const stackedGrouping = spec.grouping === 'stacked' || percent;
  const extents = stacks.flat().flatMap((point) => (point === null ? [] : spec.kind === 'line' || !stackedGrouping ? [point.to] : [point.from, point.to]));
  const anchor = spec.kind === 'bar' || spec.kind === 'area' ? [0] : [];
  const include = (geometry.include ?? []).filter(Number.isFinite);
  const dataMin = extents.length ? Math.min(...extents, ...anchor, ...include) : 0;
  const dataMax = extents.length ? Math.max(...extents, ...anchor, ...include) : 1;
  const pad = 10 * scale;
  const fontPx = chartTextSize(geometry) * scale;
  const lineHeight = fontPx * 1.5;
  const options = resolveChartOptions(chart, chartOptionTarget(authored));
  const legendBand = options.legend === 'top' || options.legend === 'bottom' ? lineHeight + pad : 0;
  const titleBand = options.axisTitles.category ? lineHeight : 0;
  const length = spec.horizontal ? width * 0.7 - 2 * pad - fontPx : height - 2 * pad - lineHeight * 1.5 - legendBand - titleBand;
  const fitted = niceScale(dataMin, dataMax, chartIntervalsFor(Math.max(1, length), spec.horizontal ? 4 * fontPx : lineHeight * 1.2, scale), { percent, labeled: geometry.labeled === true && spec.kind === 'line' });
  return { min: fitted.min, max: fitted.max, majorUnit: fitted.step, ...(percent ? { percent: true as const } : {}) };
}

/** LH-33: a chart whose value axis {@link shareSiblingChartAxes} may share: the chart object and the axis composition gave it. */
export interface SiblingChart {
  value: unknown;
  chart?: { valueAxis?: ChartValueAxis };
}

/**
 * LH-33: sibling charts of one unit on one slide share their value axis, so equal values stand equally tall and the charts can be read
 * against each other. Two column, bar, line or area charts of a slide are of one unit when they run the same way (vertical or horizontal),
 * are both 100% stacked or both not, and their first series has the same number format; without a format, when they plot the same series
 * names (Current and Baseline in both). Each set of two or more is given one axis, `niceScale` from the lowest minimum to the highest
 * maximum with the fewest intervals any member had (its plot is the shortest), and both engines draw it (the preview draws `valueAxis`, the
 * PPTX export writes it). `document` resolves dataset references. The axes are changed in place; the sets of two or more are returned
 * (LH-93 gives each one plot height, chart-plot.ts).
 */
export function shareSiblingChartAxes<T extends SiblingChart>(charts: readonly T[], document?: unknown): T[][] {
  const sets = new Map<string, T[]>();
  for (const item of charts) {
    const axis = item.chart?.valueAxis;
    if (!axis) continue;
    const type = typeof item.value === 'object' && item.value !== null ? (item.value as { type?: unknown }).type : undefined;
    const id = typeof type === 'string' ? type.trim().toLowerCase() : '';
    const resolved = resolveChartData(item.value, document);
    if (!resolved.ok) continue;
    const spec = Object.hasOwn(CATEGORY_CHARTS, id) ? CATEGORY_CHARTS[id]! : CATEGORY_CHARTS.column!;
    const format = resolved.formats[1];
    const key = JSON.stringify([spec.horizontal, axis.percent === true, format ?? null, format === undefined ? resolved.columns.slice(1) : null]);
    sets.set(key, [...sets.get(key) ?? [], item]);
  }
  const out: T[][] = [];
  for (const members of sets.values()) {
    if (members.length < 2) continue;
    out.push(members);
    const axes = members.map(item => item.chart!.valueAxis!);
    const min = Math.min(...axes.map(axis => axis.min)), max = Math.max(...axes.map(axis => axis.max));
    if (axes.every(axis => axis.min === min && axis.max === max)) continue;
    const intervals = Math.max(1, Math.min(...axes.map(axis => Math.round((axis.max - axis.min) / axis.majorUnit))));
    const percent = axes[0]!.percent === true;
    const shared = niceScale(min, max, intervals, { percent });
    for (const item of members) item.chart!.valueAxis = { min: shared.min, max: shared.max, majorUnit: shared.step, ...(percent ? { percent: true as const } : {}) };
  }
  return out;
}
