/**
 * Metric trend mark (RR-07): the arrow and colour that show `metric.trend` in the SVG preview
 * and the PPTX export. Core's metric layout places the trend word (up, down, flat) as ordinary
 * text; this derives, from that accepted line geometry, one arrow beside it so both engines draw
 * the same shape in the same place and colour. The word stays the text alternative: the arrow
 * adds a visual cue and an `ariaLabel`, never rewritten source text.
 */
import type { MetricLayout } from './composition.js';
import { legible, luminance, normalize } from './legible-color.js';

export type MetricTrend = 'up' | 'down' | 'flat';
/** The DrawingML preset geometry that draws each trend (`a:prstGeom prst`). */
export const METRIC_TREND_SHAPES: Readonly<Record<MetricTrend, 'upArrow' | 'downArrow' | 'rightArrow'>> = Object.freeze({ up: 'upArrow', down: 'downArrow', flat: 'rightArrow' });
export const METRIC_TREND_MIN_CONTRAST = 4.5;

export interface MetricTrendColorOptions {
  /** The slide background the metric text sits on. */
  background: string;
  /** Neutral colour for a flat trend (the deck's muted text). */
  neutral?: string;
}

// Green and red follow the usual rising/falling convention; flat is neutral. The colour is not
// a verdict (a falling latency is good news), so the arrow and the word carry the direction.
const SEMANTIC = {
  up: { light: '#15803D', dark: '#4ADE80' },
  down: { light: '#B91C1C', dark: '#F87171' },
} as const;

/** The colour of a trend, kept at >= 4.5:1 against the slide background. */
export function metricTrendColor(trend: MetricTrend, options: MetricTrendColorOptions): string {
  const background = normalize(options.background) ?? '#FFFFFF';
  if (trend === 'flat') return legible(normalize(options.neutral) ?? (luminance(background) < .5 ? '#CBD5E1' : '#475569'), background, METRIC_TREND_MIN_CONTRAST);
  const pair = SEMANTIC[trend];
  return legible(luminance(background) < .5 ? pair.dark : pair.light, background, METRIC_TREND_MIN_CONTRAST);
}

export interface MetricTrendMark {
  trend: MetricTrend;
  /** DrawingML preset name for native export. */
  shape: 'upArrow' | 'downArrow' | 'rightArrow';
  /** Arrow bounding box in layout pixels (96 per inch). */
  box: { x: number; y: number; width: number; height: number };
  /** The arrow outline as polygon points in layout pixels: the preset geometry at default adjustments. */
  points: [number, number][];
  color: string;
  /** Text alternative for the arrow. */
  ariaLabel: string;
  /** Path of the trend field the mark belongs to. */
  path: string;
}

/** Outline of the DrawingML upArrow, downArrow or rightArrow preset (adj1 = adj2 = 50000) in `box`. */
export function metricTrendPoints(shape: MetricTrendMark['shape'], box: MetricTrendMark['box']): [number, number][] {
  const { x: l, y: t, width: w, height: h } = box, r = l + w, b = t + h, hc = l + w / 2, vc = t + h / 2, ss = Math.min(w, h);
  if (shape === 'rightArrow') {
    const x1 = r - ss * .5, y1 = vc - h * .25, y2 = vc + h * .25;
    return [[l, y1], [x1, y1], [x1, t], [r, vc], [x1, b], [x1, y2], [l, y2]];
  }
  const dy = ss * .5, x1 = hc - w * .25, x2 = hc + w * .25;
  if (shape === 'upArrow') {
    const y2 = t + dy;
    return [[l, y2], [hc, t], [r, y2], [x2, y2], [x2, b], [x1, b], [x1, y2]];
  }
  const y2 = b - dy;
  return [[l, y2], [x1, y2], [x1, t], [x2, t], [x2, y2], [r, y2], [hc, b]];
}

/**
 * The arrow for a laid-out metric, or undefined when the metric has no (visible) trend or the
 * arrow has no room. It is square, as tall as the trend word's capitals, on the baseline, and
 * sits after the word for left-aligned metrics and before it for centred or right-aligned ones,
 * so it grows away from the alignment edge. It never leaves the trend field's box.
 */
export function metricTrendMark(layout: MetricLayout, options: MetricTrendColorOptions): MetricTrendMark | undefined {
  const part = layout.parts.find(candidate => candidate.role === 'trend');
  if (!part || !part.visible || !part.fit || part.fit.sourceLines.length === 0) return undefined;
  const trend = part.text.trim() as MetricTrend;
  if (!Object.hasOwn(METRIC_TREND_SHAPES, trend)) return undefined;
  const line = part.fit.sourceLines[0]!, origin = part.linePositions[0];
  if (!origin || line.width <= 0) return undefined;
  const size = part.fit.fontSize * .72, gap = part.fit.fontSize * .3, left = part.box.x, right = part.box.x + part.box.width;
  const after = origin.x + line.width + gap, before = origin.x - gap - size;
  const fitsAfter = after + size <= right + .01, fitsBefore = before >= left - .01;
  const x = layout.alignment === 'left' ? (fitsAfter ? after : fitsBefore ? before : undefined) : (fitsBefore ? before : fitsAfter ? after : undefined);
  if (x === undefined) return undefined;
  const shape = METRIC_TREND_SHAPES[trend], box = { x, y: origin.baseline - size, width: size, height: size };
  return { trend, shape, box, points: metricTrendPoints(shape, box), color: metricTrendColor(trend, options), ariaLabel: `Trend: ${trend}`, path: part.path };
}

