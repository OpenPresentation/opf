// FR-07, part 3 (CR 5): the gauge, a way to draw a metric. `metric.gauge` draws the metric's number on a half-circle arc from `min` (left)
// to `max` (right), over the gauge's bands (part 2's ChartBand: the same sorting, clamping and colors as a chart's bands), with an optional
// target tick, and the metric's text under the arc (the value inside the arc's bowl when it fits there at its fitted size).
//
// Core decides everything both engines draw: which number, which bands and fills, the arc's center, radius and thickness, the ends' labels
// and where they stand (composition's layoutMetric places them, as MetricLayout.gauge), and the drawing plan (`metricGaugeDrawing`): each
// arc as PowerPoint's own `blockArc` preset with its square frame and its three adjustments, which the preview draws from the same preset
// definition (shape-geometry.ts) and the PowerPoint export writes as native shapes. No engine computes a gauge on its own.
//
// Browser-safe and synchronous: no fonts, DOM or network.
import { chartBandFill, chartBandRanges, chartBandOrderDiagnostic, readChartBands, type ChartBandColors, type ChartBandRange, type ChartBandSpec } from './chart-bands.js';
import { formatDataNumber } from './chart-data.js';
import type { LayoutBox, TextStyle } from './composition.js';
import type { MetricDataDiagnostic, ResolvedMetric } from './metric-data.js';
import { NUMBER_GROUPING_MIN } from './number-grouping.js';
import { formatNumber } from './numerals.js';
import { mixOklab } from './oklab.js';
import { presetGeometry } from './shape-geometry.js';
import { SCHEME_COLOR_NAMES, type SchemeColorName } from './table-color-scale-range.js';

/** The track's (and each band's) thickness as a share of the arc's outer radius. */
export const METRIC_GAUGE_THICKNESS = 0.18;
/** The value arc's thickness as a share of the track's, centered in it, so the bands stay visible around it. */
export const METRIC_GAUGE_VALUE_SHARE = 0.6;
/** The target tick's length as a multiple of the track's thickness, centered on the track. */
export const METRIC_GAUGE_TARGET_LENGTH = 1.4;
/** The target tick's width, in reference pixels. */
export const METRIC_GAUGE_TARGET_WIDTH_PX = 2;
/** The track's neutral: the scheme's text mixed into the surface (OKLab) at this share. */
export const METRIC_GAUGE_TRACK_SHARE = 0.12;
/** The narrowest arc drawn, in reference pixels (its outer width); a region that cannot hold it draws the metric without its gauge. */
export const METRIC_GAUGE_MIN_WIDTH_PX = 96;
/** The widest arc drawn, in reference pixels (twice its outer radius). */
export const METRIC_GAUGE_MAX_WIDTH_PX = 640;

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const NAMES: ReadonlySet<string> = new Set(SCHEME_COLOR_NAMES);

/** What layout needs to draw a gauge: the range, the number drawn, the sorted bands, the target and the ends' labels. */
export interface MetricGaugeInput {
  min: number;
  max: number;
  /** The number the metric shows (its computed or written value). */
  value: number;
  bands: ChartBandSpec[];
  target?: number;
  /** The labels under the arc's ends: `min` and `max` written as the value is (its number format, else the metric's number rules). */
  ends: [string, string];
}

/** The authored gauge of a metric, read leniently (as engines draw it): undefined when the metric has none or it has no finite `max`. */
export function metricGaugeSpec(metric: unknown): { min: number; max: number; bands: ChartBandSpec[]; target?: number } | undefined {
  if (!record(metric) || !record(metric.gauge)) return undefined;
  const gauge = metric.gauge;
  if (!finite(gauge.max)) return undefined;
  const min = finite(gauge.min) ? gauge.min : 0;
  return { min, max: gauge.max, bands: readChartBands(gauge.bands), ...(finite(gauge.target) ? { target: gauge.target } : {}) };
}

/** A number written as a metric's value is: with the value's number format when it has one, else the metric's number rules (grouped by the deck language). */
export function metricGaugeNumber(value: number, format: string | undefined, language: string | undefined): string {
  return format !== undefined ? formatDataNumber(value, format, language) : formatNumber(value, language, { group: Math.abs(value) >= NUMBER_GROUPING_MIN });
}

/**
 * The gauge a metric draws (`resolved` is core resolveMetric's result for it), or undefined when it draws none: no gauge, `max` not above
 * `min` (metric-gauge-range), or a value that is not a number (metric-gauge-value).
 */
export function metricGaugeInput(metric: unknown, resolved: Pick<ResolvedMetric, 'value'>, language?: string): MetricGaugeInput | undefined {
  const spec = metricGaugeSpec(metric);
  const number = resolved.value?.isNumber ? resolved.value.number : undefined;
  if (!spec || !(spec.max > spec.min) || number === undefined || !Number.isFinite(number)) return undefined;
  const format = resolved.value?.format;
  return { min: spec.min, max: spec.max, value: number, bands: spec.bands, ...(spec.target !== undefined ? { target: spec.target } : {}), ends: [metricGaugeNumber(spec.min, format, language), metricGaugeNumber(spec.max, format, language)] };
}

/**
 * The gauge's warnings (`base` is the metric's JSON Pointer): `metric-gauge-range` for `max` not above `min`, and for a value, target or band
 * end outside the range; `metric-gauge-value` for a value that is not a number; `chart-bands-order` for bands not in increasing order.
 */
export function metricGaugeDiagnostics(metric: unknown, resolved: Pick<ResolvedMetric, 'value'>, base = ''): MetricDataDiagnostic[] {
  if (!record(metric) || !record(metric.gauge)) return [];
  const gauge = metric.gauge, path = `${base}/gauge`, out: MetricDataDiagnostic[] = [];
  const min = finite(gauge.min) ? gauge.min : 0, max = finite(gauge.max) ? gauge.max : undefined;
  if (!resolved.value?.isNumber || resolved.value.number === undefined) {
    out.push({ code: 'metric-gauge-value', severity: 'warning', path: `${base}/value`, message: 'A gauge needs a number; this metric is drawn without its gauge.' });
  }
  if (max === undefined) return out;
  const range = `(${min} to ${max})`;
  if (!(max > min)) {
    out.push({ code: 'metric-gauge-range', severity: 'warning', path, message: `The gauge's maximum is not above its minimum ${range}, so no gauge is drawn.` });
    return out;
  }
  const outside = (value: number) => value < min || value > max;
  const value = resolved.value?.isNumber ? resolved.value.number : undefined;
  // One warning per gauge (a finding is one per rule and path), naming every part outside the range and what each then draws.
  const parts: string[] = [];
  if (value !== undefined && outside(value)) parts.push('value (its arc stops at the end; the real number is printed)');
  if (finite(gauge.target) && outside(gauge.target)) parts.push('target (it is not drawn)');
  if (Array.isArray(gauge.bands)) gauge.bands.forEach((band, index) => {
    if (record(band) && finite(band.to) && outside(band.to)) parts.push(`band ${index + 1} (it is drawn to the end of the scale)`);
  });
  if (parts.length) out.push({ code: 'metric-gauge-range', severity: 'warning', path, message: `The gauge's ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]} ${parts.length > 1 ? 'are' : 'is'} outside its scale ${range}.` });
  const order = chartBandOrderDiagnostic(gauge.bands, path);
  if (order) out.push(order);
  return out;
}

/** A band of a gauge: core chartBandRanges over the gauge's range, with its share of the arc (`start`, `end`: 0 at `min`, 1 at `max`). */
export interface MetricGaugeBand extends ChartBandRange { start: number; end: number }

/** One label under an end of the arc: its text, the center of its line, its baseline and size, and its line box. */
export interface MetricGaugeEnd { text: string; x: number; baseline: number; fontSize: number; width: number; box: LayoutBox }

/**
 * A laid-out gauge (MetricLayout.gauge): the arc's center and outer radius (its frame is the square around that circle, of which only the
 * upper half is drawn), its thickness, the bands, the share of the arc the value fills (`fill`: the value clamped to the range, 0 at `min`),
 * the target's share (absent when it has none or it lies outside the range), the ends' labels and their style, and whether the value stands
 * in the arc's bowl.
 */
export interface MetricGaugeLayout {
  min: number;
  max: number;
  value: number;
  fill: number;
  center: { x: number; y: number };
  radius: number;
  thickness: number;
  /** The target tick's width (METRIC_GAUGE_TARGET_WIDTH_PX at the layout's scale). */
  targetWidth: number;
  bands: MetricGaugeBand[];
  /** The authored index of the band the value falls in, when it falls in one. */
  valueBand?: number;
  target?: { value: number; share: number };
  ends: [MetricGaugeEnd, MetricGaugeEnd];
  endStyle: TextStyle;
  /** The value (and a unit beside it) stands inside the arc's bowl. */
  inBowl: boolean;
  /** The gauge's own box: the upper half of the arc's frame and the ends' labels. */
  box: LayoutBox;
}

/** The share of the arc a value fills, clamped to [0, 1]. */
export const metricGaugeShare = (value: number, min: number, max: number): number => Math.max(0, Math.min(1, (value - min) / (max - min)));

/** The geometry of a gauge of outer radius `radius` centered at `center` (the ends' labels are placed by the caller). */
export function metricGaugeGeometry(input: MetricGaugeInput, center: { x: number; y: number }, radius: number, scale = 1): Pick<MetricGaugeLayout, 'min' | 'max' | 'value' | 'fill' | 'center' | 'radius' | 'thickness' | 'targetWidth' | 'bands' | 'valueBand' | 'target'> {
  const { min, max, value } = input, share = (v: number) => metricGaugeShare(v, min, max);
  const bands = chartBandRanges(input.bands, { min, max }).map((band) => ({ ...band, start: share(band.from), end: share(band.to) }));
  const clamped = Math.max(min, Math.min(max, value));
  const containing = bands.find((band, position) => clamped >= band.from && (clamped < band.to || position === bands.length - 1 && clamped <= band.to)) ?? bands.find((band) => clamped >= band.from && clamped <= band.to);
  const target = input.target !== undefined && input.target >= min && input.target <= max ? { value: input.target, share: share(input.target) } : undefined;
  return { min, max, value, fill: share(value), center, radius, thickness: radius * METRIC_GAUGE_THICKNESS, targetWidth: METRIC_GAUGE_TARGET_WIDTH_PX * scale, bands, ...(containing ? { valueBand: containing.index } : {}), ...(target ? { target } : {}) };
}

/** A point on the gauge's circle at `share` of the arc (0 at the left end, 1 at the right end, through the top), at `radius` from the center. */
export function metricGaugePoint(center: { x: number; y: number }, radius: number, share: number): { x: number; y: number } {
  const angle = Math.PI * (1 + share);
  return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
}

/** The colors a gauge is drawn in: the surface it stands on, the scheme's text and secondary text, its primary, and a resolver for scheme names. */
export interface MetricGaugeColors extends ChartBandColors {
  primary: string;
  /** The secondary text color, for the ends' labels. */
  muted: string;
}

/** One arc of a gauge as PowerPoint's `blockArc` preset: its part name, its square frame, its adjustments (OPF units: degrees, and a fraction of the frame), its fill. */
export interface MetricGaugeArc {
  part: string;
  role: 'track' | 'band' | 'value';
  /** The authored band index of a band segment. */
  band?: number;
  frame: LayoutBox;
  /** `adj1` the start angle and `adj2` the end angle (degrees clockwise from east, as DrawingML), `adj3` the thickness as a share of the frame. */
  adjust: { adj1: number; adj2: number; adj3: number };
  fill: string;
  /** The preset's outline at that frame and those adjustments (core presetGeometry), as SVG path data relative to the frame's top left. */
  d: string;
}

/** Everything a gauge draws, in drawing order: the arcs (track, bands, value), the target tick, and the ends' labels with their color. */
export interface MetricGaugeDrawing {
  arcs: MetricGaugeArc[];
  target?: { part: string; x1: number; y1: number; x2: number; y2: number; width: number; color: string };
  ends: { part: string; color: string; end: MetricGaugeEnd }[];
}

const round = (value: number) => Math.round(value * 1e6) / 1e6;
/** The DrawingML angle (degrees clockwise from east) of a share of the arc: 180 at the left end, 270 at the top, 0 at the right end. */
export const metricGaugeAngle = (share: number): number => round((180 + share * 180) % 360);

/** The fill of the gauge's track (the arc where no band is): the scheme's text mixed into the surface at METRIC_GAUGE_TRACK_SHARE. */
export function metricGaugeTrackFill(colors: Pick<MetricGaugeColors, 'surface' | 'text'>): string {
  return mixOklab(colors.surface, colors.text, METRIC_GAUGE_TRACK_SHARE);
}

/** The value arc's color: the full scheme color of the band the value falls in when that band names one, else the primary. */
export function metricGaugeValueFill(gauge: Pick<MetricGaugeLayout, 'bands' | 'valueBand'>, colors: Pick<MetricGaugeColors, 'primary' | 'resolve'>): string {
  const band = gauge.valueBand === undefined ? undefined : gauge.bands.find((entry) => entry.index === gauge.valueBand);
  return (band?.color !== undefined && NAMES.has(band.color) ? colors.resolve(band.color as SchemeColorName) : colors.primary).slice(0, 7).toUpperCase();
}

/**
 * The drawing plan of a laid-out gauge, which both engines draw: the bands as arc segments (and the track where no band is, or the whole
 * track without bands), the value arc over them at METRIC_GAUGE_VALUE_SHARE of their thickness (none for a value at or below `min`), the
 * target tick across the arc, and the ends' labels in the secondary text color. Part names are stable: `gauge track`, `gauge band <n>` (n the
 * band's position in drawing order, from 1), `gauge value`, `gauge target`, `gauge min`, `gauge max`.
 */
export function metricGaugeDrawing(gauge: MetricGaugeLayout, colors: MetricGaugeColors): MetricGaugeDrawing {
  const { center, radius: r, thickness: t } = gauge;
  const frame = (radius: number): LayoutBox => ({ x: center.x - radius, y: center.y - radius, width: 2 * radius, height: 2 * radius });
  const segment = (start: number, end: number, radius: number, thickness: number) => ({ adj1: metricGaugeAngle(start), adj2: metricGaugeAngle(end), adj3: round(thickness / (2 * radius)) });
  const arcs: Omit<MetricGaugeArc, 'd'>[] = [];
  // The bands run from `min` (chartBandRanges starts the first drawn band there) to their last end; the track draws the rest of the arc.
  const last = gauge.bands.length ? gauge.bands[gauge.bands.length - 1]!.end : 0;
  gauge.bands.forEach((band, position) => arcs.push({ part: `gauge band ${position + 1}`, role: 'band', band: band.index, frame: frame(r), adjust: segment(band.start, band.end, r, t), fill: chartBandFill(band, colors).toUpperCase() }));
  if (last < 1) arcs.push({ part: 'gauge track', role: 'track', frame: frame(r), adjust: segment(last, 1, r, t), fill: metricGaugeTrackFill(colors).toUpperCase() });
  if (gauge.fill > 0) {
    const inner = t * METRIC_GAUGE_VALUE_SHARE, radius = r - (t - inner) / 2;
    arcs.push({ part: 'gauge value', role: 'value', frame: frame(radius), adjust: segment(0, gauge.fill, radius, inner), fill: metricGaugeValueFill(gauge, colors) });
  }
  const middle = r - t / 2, half = t * METRIC_GAUGE_TARGET_LENGTH / 2;
  const target = gauge.target ? (() => {
    const a = metricGaugePoint(center, middle - half, gauge.target!.share), b = metricGaugePoint(center, middle + half, gauge.target!.share);
    return { part: 'gauge target', x1: round(a.x), y1: round(a.y), x2: round(b.x), y2: round(b.y), width: gauge.targetWidth, color: colors.text.slice(0, 7).toUpperCase() };
  })() : undefined;
  const muted = colors.muted.slice(0, 7).toUpperCase();
  const outlined = arcs.map((arc): MetricGaugeArc => ({ ...arc, d: presetGeometry('blockArc', arc.frame.width, arc.frame.height, arc.adjust).paths.map((path) => path.d).join(' ') }));
  return { arcs: outlined, ...(target ? { target } : {}), ends: [{ part: 'gauge min', color: muted, end: gauge.ends[0] }, { part: 'gauge max', color: muted, end: gauge.ends[1] }] };
}
