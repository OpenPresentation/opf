// RR-92: the value axis of a category chart, computed once in core so the preview and the PPTX export draw and write the same axis.
//
// Before RR-92 the scale (`niceScale`) lived in opf-render only, sized by the plot the renderer laid out, and opf-pptx wrote just
// `c:min 0`, so PowerPoint and Keynote chose their own major unit (the preview showed 0 to 800 in steps of 100, Keynote steps of 200).
// Composition now derives the axis from the chart box and the chart text size, and the exporter writes it as c:max and c:majorUnit.
import { chartOptionTarget, resolveChartOptions } from './chart-options.js';
import { chartNumber, type ResolvedChartData } from './chart-data.js';

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

/**
 * RR-90: the unscaled chart text size for a chart box: {@link CHART_TEXT_PX}, shrunk only when the box is small (the text is at most
 * 1/18 of the box height and 1/30 of its width, whole pixels) and never below `minFontSize` (default 16). `width` and `height` are the box in
 * canvas pixels and `scale` is `min(slide width, slide height) / 720`. The preview and the axis density both call it, so the
 * axis core computes matches the text the preview draws.
 */
export function chartTextSize(geometry: { width: number; height: number; scale: number; minFontSize?: number }): number {
  const { width, height, scale } = geometry;
  const minimum = geometry.minFontSize ?? 16;
  if (![width, height, scale].every(Number.isFinite) || width <= 0 || height <= 0 || scale <= 0) return Math.max(CHART_TEXT_PX, minimum);
  return Math.max(Math.floor(Math.min(CHART_TEXT_PX, height / scale / 18, width / scale / 30)), minimum);
}

function clean(value: number): number {
  const rounded = Number(value.toPrecision(12));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function scaleFrom(min: number, max: number, step: number): ChartScale {
  const ticks: number[] = [];
  const count = Math.round((max - min) / step);
  for (let index = 0; index <= count; index++) ticks.push(clean(min + index * step));
  return { min, max, step, ticks };
}

function pickStep(min: number, max: number, limit: number, steps: readonly number[]): number {
  return steps.find((step) => Math.round((max - min) / step) <= limit) ?? max - min;
}

/**
 * Office-like automatic value axis: include zero unless every value sits in the top sixth of the range, add 5% headroom, then choose
 * the smallest 1/2/5 x 10^k major unit that fits `maxIntervals` (default 10, at least 1). `percent` is the 100% stacked axis: 0 to 1 in
 * steps of 0.1, 0.2, 0.25, 0.5 or 1 (from -1 when a value is negative). Non-finite data bounds fall back to 0 to 1.
 */
export function niceScale(dataMin: number, dataMax: number, maxIntervals = 10, { percent = false }: { percent?: boolean } = {}): ChartScale {
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
  if (dataMin > 0 && dataMax - dataMin < dataMax / 6) lo = dataMin;
  if (dataMax < 0 && dataMax - dataMin < -dataMin / 6) hi = dataMax;
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
      if (Number.isFinite(min) && Number.isFinite(max) && Math.round((max - min) / step) <= limit) return scaleFrom(clean(min), clean(max), step);
    }
  }
  return normalizedScale(dataMin, dataMax, limit);
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

/** How many intervals a value axis `length` pixels long can carry when each tick label needs `labelExtent` pixels: 1 to 10. */
export function maxIntervalsFor(length: number, labelExtent: number): number {
  return Math.max(1, Math.min(10, Math.floor(length / Math.max(1, labelExtent))));
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

/** The slide geometry the axis density follows. All lengths are slide pixels. */
export interface ChartAxisGeometry {
  /** The chart box (after any caption band). */
  width: number;
  height: number;
  /** `min(slide width, slide height) / 720`. */
  scale: number;
  /** The composition's `minFontSize` (default 16), which the chart text never goes below. */
  minFontSize?: number;
}

/**
 * The value axis of a column, bar, line or area chart (`chart` is the chart object, `resolved` its `resolveChartData`), or undefined for any other type (or data with no plotted series).
 *
 * The axis is `niceScale` of the plotted extents (bars and areas include zero) with at most `maxIntervalsFor(length, label)` intervals.
 * `length` is the plot's extent along the value axis, estimated from the box the way the preview lays a chart with one line of
 * horizontal category labels out:
 *
 * - column, line, area: box height - 2 x pad - 1.5 x line height (the top margin plus the category labels), less one line height
 *   for a category axis title and one line height plus a pad for a top or bottom legend (a one-row legend), over labels 1.2 line
 *   heights tall;
 * - bar: the width left of a category gutter of 30% of the box, minus the padding, over labels `4 x text size` wide.
 *
 * with pad = 10 x scale, text size = {@link chartTextSize} x scale and line height = 1.5 x text size. Rotated or
 * wrapped category labels, a wider tick label and a legend of several rows make the preview's plot shorter than this estimate; for
 * the usual chart (a plot of ten tick labels or more) all of them give the same ten intervals.
 */
export function chartValueAxis(chart: unknown, resolved: ResolvedChartData, geometry: ChartAxisGeometry): ChartValueAxis | undefined {
  const type = typeof chart === 'object' && chart !== null ? (chart as { type?: unknown }).type : undefined;
  const id = typeof type === 'string' ? type.trim().toLowerCase() : '';
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
  const dataMin = extents.length ? Math.min(...extents, ...anchor) : 0;
  const dataMax = extents.length ? Math.max(...extents, ...anchor) : 1;
  const pad = 10 * scale;
  const fontPx = chartTextSize(geometry) * scale;
  const lineHeight = fontPx * 1.5;
  const options = resolveChartOptions(chart, chartOptionTarget(id));
  const legendBand = options.legend === 'top' || options.legend === 'bottom' ? lineHeight + pad : 0;
  const titleBand = options.axisTitles.category ? lineHeight : 0;
  const length = spec.horizontal ? width * 0.7 - 2 * pad - fontPx : height - 2 * pad - lineHeight * 1.5 - legendBand - titleBand;
  const fitted = niceScale(dataMin, dataMax, maxIntervalsFor(Math.max(1, length), spec.horizontal ? 4 * fontPx : lineHeight * 1.2), { percent });
  return { min: fitted.min, max: fitted.max, majorUnit: fitted.step, ...(percent ? { percent: true as const } : {}) };
}
