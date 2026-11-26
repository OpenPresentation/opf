// FR-07 (CR 5): bands, ranges of a chart's value axis shaded behind the data, and the bullet chart's target. Core decides which bands a
// chart draws, in which order, over which range of its axis and in which colors, so the preview (opf-render), the PPTX export (opf-pptx)
// and the editor draw the same bands. The gauge (FR-07, part 3) reuses the sorted and clamped list and the band colors on an arc.
//
// Browser-safe and synchronous: no fonts, DOM or network. Colors are mixed in OKLab (oklab.ts, the table color scale's mixer).
import { colorContrast } from './color.js';
import { mixOklab } from './oklab.js';
import { SCHEME_COLOR_NAMES, type SchemeColorName } from './table-color-scale-range.js';

/** The chart types that draw bands: bar, column, line and area charts (and their stacked forms) and the bullet chart. */
export const CHART_BAND_TYPES: ReadonlySet<string> = new Set([
  'column', 'stacked-column', '100pct-stacked-column', 'bar', 'stacked-bar', '100pct-stacked-bar',
  'line', 'line-with-markers', 'stacked-line', 'stacked-line-with-markers', 'area', 'stacked-area', '100pct-stacked-area', 'bullet',
]);

/**
 * The neutral bands' contrast ratio against the chart's surface, lowest band first (the darkest on a light surface, the lightest on a dark one):
 * 1.75, 1.45 and 1.25, then again from the first for a fourth to sixth band (so neighbors always differ). Each neutral is the scheme's `text`
 * mixed into the `surface` in OKLab until it reaches its ratio, so the bands read alike on a light and a dark variant (a fixed share of the text
 * color drew #121212 on black). A band that names a color is that color at {@link CHART_BAND_COLOR_SHARE} over the surface.
 */
export const CHART_BAND_NEUTRAL_CONTRASTS: readonly number[] = Object.freeze([1.75, 1.45, 1.25]);
/** The share of a band's own scheme color over the surface (a light tint). */
export const CHART_BAND_COLOR_SHARE = 0.25;

/** One authored band as engines read it: its upper end, its optional label and scheme color, and its index in `chart.bands`. */
export interface ChartBandSpec {
  /** The band's position in `chart.bands` as authored (its document path is `bands.<index>`). */
  index: number;
  to: number;
  label?: string;
  color?: SchemeColorName;
}

/** A band over an axis: its lower and upper value, clamped to the axis, in increasing order. */
export interface ChartBandRange extends ChartBandSpec {
  from: number;
  /** The band's place among the bands without a color of their own (0 for the first): the neutral it is drawn in. Absent for a colored band. */
  neutral?: number;
}

/** The colors bands are mixed from: the chart's surface (the card or slide background it stands on), the scheme's text color, and a resolver for scheme names. */
export interface ChartBandColors {
  surface: string;
  text: string;
  /** A scheme color name (slot or role) as `#RRGGBB`. */
  resolve: (name: SchemeColorName) => string;
}

export interface ChartBandDiagnostic { code: 'chart-bands-order' | 'chart-bands-unsupported'; severity: 'warning'; path: string; message: string }

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const typeOf = (chart: unknown): string => record(chart) && typeof chart.type === 'string' ? chart.type.trim().toLowerCase() : '';
const NAMES: ReadonlySet<string> = new Set(SCHEME_COLOR_NAMES);

/** The authored bands of a chart, as authored (unsorted), or an empty list; entries without a finite `to` are skipped. */
function authoredBands(chart: unknown): ChartBandSpec[] {
  if (!record(chart) || !Array.isArray(chart.bands)) return [];
  return chart.bands.flatMap((entry, index): ChartBandSpec[] => {
    if (!record(entry) || typeof entry.to !== 'number' || !Number.isFinite(entry.to)) return [];
    const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label : undefined;
    const color = typeof entry.color === 'string' && NAMES.has(entry.color) ? entry.color as SchemeColorName : undefined;
    return [{ index, to: entry.to, ...(label !== undefined ? { label } : {}), ...(color !== undefined ? { color } : {}) }];
  });
}

/**
 * The bands a chart draws, sorted by `to` (equal ends keep their authored order): empty for a chart type that does not draw bands
 * ({@link CHART_BAND_TYPES}). Engines sort unordered bands rather than refuse them (the `chart-bands-order` warning names them).
 */
export function chartBands(chart: unknown): ChartBandSpec[] {
  if (!CHART_BAND_TYPES.has(typeOf(chart))) return [];
  return authoredBands(chart).sort((a, b) => a.to - b.to || a.index - b.index);
}

/** The largest band end of a chart that draws bands: the value its automatic axis extends to, as a reference line's value does. */
export function chartBandMaximum(chart: unknown): number | undefined {
  const bands = chartBands(chart);
  return bands.length ? bands[bands.length - 1]!.to : undefined;
}

/**
 * The sorted bands over an axis: each runs from the previous band's `to` (the first from the axis minimum) to its own `to`, clamped to
 * the axis. A band whose range lies wholly below the axis minimum or above its maximum, or is empty, is not drawn (and has no place in the
 * list); no finding names it. `neutral` counts the drawn bands without a color of their own, so the darkest neutral is the lowest one.
 */
export function chartBandRanges(bands: readonly ChartBandSpec[], axis: { min: number; max: number }): ChartBandRange[] {
  if (!(axis.max > axis.min)) return [];
  const sorted = [...bands].sort((a, b) => a.to - b.to || a.index - b.index);
  const out: ChartBandRange[] = [];
  let previous = axis.min, neutral = 0;
  for (const band of sorted) {
    const from = Math.max(axis.min, Math.min(axis.max, previous)), to = Math.max(axis.min, Math.min(axis.max, band.to));
    previous = Math.max(previous, band.to);
    if (!(to > from)) continue;
    out.push({ ...band, from, to, ...(band.color === undefined ? { neutral: neutral++ } : {}) });
  }
  return out;
}

/**
 * The fill of a band: a neutral (the scheme's text mixed into the surface to {@link CHART_BAND_NEUTRAL_CONTRASTS}, the first neutral band the
 * strongest), or the band's own scheme color at {@link CHART_BAND_COLOR_SHARE} over the surface. Uppercase `#RRGGBB`.
 */
export function chartBandFill(band: Pick<ChartBandRange, 'color' | 'neutral'>, colors: ChartBandColors): string {
  if (band.color !== undefined) return mixOklab(colors.surface, colors.resolve(band.color), CHART_BAND_COLOR_SHARE);
  const targets = CHART_BAND_NEUTRAL_CONTRASTS, target = targets[Math.max(0, band.neutral ?? 0) % targets.length]!;
  return neutralFill(colors.surface, colors.text, target);
}

/** The mix of `text` into `surface` (OKLab) whose contrast against the surface is `ratio` (the text itself when it has less). */
export function neutralFill(surface: string, text: string, ratio: number): string {
  const contrast = (t: number) => colorContrast(mixOklab(surface, text, t), surface) ?? 1;
  if (contrast(1) <= ratio) return mixOklab(surface, text, 1);
  let low = 0, high = 1;
  for (let step = 0; step < 40; step++) { const middle = (low + high) / 2; if (contrast(middle) < ratio) low = middle; else high = middle; }
  return mixOklab(surface, text, high);
}

/** The contrast the muted marks of a highlighted chart keep against the chart's strongest band. */
export const CHART_BAND_MUTED_CONTRAST = 1.5;

/**
 * FR-07 (supervisor, 2026-11-26): the muted color of a highlighted (or focused) chart that has bands, so its context marks do not vanish into
 * the bands: the scheme's text mixed into the surface (OKLab) to 1.5:1 from the strongest band (the fill with the most contrast against the
 * surface), on the side away from the surface. The text itself when even it stays nearer. Both engines call it with the same inputs.
 */
export function chartBandMutedColor(fills: readonly string[], surface: string, text: string): string | undefined {
  const against = (color: string) => colorContrast(color, surface) ?? 1;
  const strongest = fills.reduce<string | undefined>((best, fill) => best === undefined || against(fill) > against(best) ? fill : best, undefined);
  if (strongest === undefined) return undefined;
  const at = (t: number) => mixOklab(surface, text, t);
  const beyond = (t: number) => against(at(t)) > against(strongest) && (colorContrast(at(t), strongest) ?? 1) >= CHART_BAND_MUTED_CONTRAST;
  if (!beyond(1)) return mixOklab(surface, text, 1);
  let low = 0, high = 1;
  for (let step = 0; step < 40; step++) { const middle = (low + high) / 2; if (beyond(middle)) high = middle; else low = middle; }
  return at(high);
}

/** The fills of a list of band ranges, in order ({@link chartBandFill}). */
export function chartBandFills(bands: readonly Pick<ChartBandRange, 'color' | 'neutral'>[], colors: ChartBandColors): string[] {
  return bands.map(band => chartBandFill(band, colors));
}

/**
 * The band warnings of a chart (`base` is the chart's JSON Pointer): `chart-bands-unsupported` when its type does not draw bands, and
 * `chart-bands-order` when the `to` values are not strictly increasing (the engines draw them sorted).
 */
export function chartBandDiagnostics(chart: unknown, base = ''): ChartBandDiagnostic[] {
  if (!record(chart) || !Array.isArray(chart.bands) || !chart.bands.length) return [];
  const path = `${base}/bands`;
  if (!CHART_BAND_TYPES.has(typeOf(chart))) return [{ code: 'chart-bands-unsupported', severity: 'warning', path, message: `This chart type does not draw bands; they are ignored. Bands are drawn by bar, column, line and area charts (and their stacked forms) and by bullet charts, not by a '${typeOf(chart)}' chart.` }];
  const ends = authoredBands(chart).map(band => band.to);
  return ends.some((to, index) => index > 0 && !(to > ends[index - 1]!)) ? [{ code: 'chart-bands-order', severity: 'warning', path, message: 'The bands are not in increasing order; they are drawn sorted. Write each band\'s "to" above the previous one.' }] : [];
}

/** The bullet chart type id. */
export const BULLET_CHART_TYPE = 'bullet';
/** A bullet chart: the measure bar is a third of its row, the target tick two thirds, 2 reference pixels wide. */
export const BULLET_BAR_SHARE = 1 / 3;
export const BULLET_TARGET_SHARE = 2 / 3;
export const BULLET_TARGET_WIDTH_PX = 2;
/** The bullet's measure bar as PowerPoint's gap width (`c:gapWidth`): 200% of a bar's width between bars, so a bar is a third of its row. */
export const BULLET_GAP_WIDTH = 200;
