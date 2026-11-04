/**
 * Metric trend mark (RR-07, FA-06, LH-53): the arrow and color that show `metric.trend` and
 * `metric.sentiment` in the SVG preview and the PPTX export. Core's metric layout places the arrow
 * (`trendBox`: before the delta, else the label or description, on its line) and draws no
 * trend word; this gives the arrow its shape and color so both engines draw it alike. The word
 * stays the text alternative (`ariaLabel`), never rewritten source text. The arrow always points the
 * way the trend does; its color (and the delta text color) follows the sentiment, which defaults
 * to the conventional reading of the trend (up positive, down negative, flat neutral).
 */
import type { MetricLayout } from './composition.js';
import { isDarkColor, surfaceAltColor } from './color.js';
import { contrast, legible, luminance, normalize } from './legible-color.js';

export type MetricTrend = 'up' | 'down' | 'flat';
/** Whether a change is good news: the colour of the trend mark. */
export type MetricSentiment = 'positive' | 'negative' | 'neutral';
/** The sentiment a trend has when the metric names none: up is positive, down negative, flat neutral. */
const METRIC_DEFAULT_SENTIMENT: Readonly<Record<MetricTrend, MetricSentiment>> = Object.freeze({ up: 'positive', down: 'negative', flat: 'neutral' });
/** The sentiment that colours a trend: the stated one, else the default for the trend. */
function metricEffectiveSentiment(trend: MetricTrend, sentiment?: MetricSentiment): MetricSentiment {
  return sentiment ?? METRIC_DEFAULT_SENTIMENT[trend];
}
/** The DrawingML preset geometry that draws each trend (`a:prstGeom prst`). */
export const METRIC_TREND_SHAPES: Readonly<Record<MetricTrend, 'upArrow' | 'downArrow' | 'rightArrow'>> = Object.freeze({ up: 'upArrow', down: 'downArrow', flat: 'rightArrow' });
export const METRIC_TREND_MIN_CONTRAST = 4.5;
/** LH-53: the arrow is this share of its line's font size square, and this share of it apart from the delta it precedes. */
export const METRIC_TREND_ARROW_SIZE = .72, METRIC_TREND_ARROW_GAP = .3;
/** WI-5 (P18, decision D3): the contrast a metric value keeps on a dark surface when it takes its colour from the scheme. */
export const METRIC_VALUE_MIN_CONTRAST = 4.5;

/**
 * The color a metric value draws in: `color` (the scheme's primary) unless the background is dark ({@link isDarkColor}) and the color
 * falls short of {@link METRIC_VALUE_MIN_CONTRAST} (4.5:1) against it. Then (LH-57) the value takes `text`, the light text color of the dark
 * slide or card, so the number stays the strongest element instead of a lightened accent (Claude Design draws such values in the text
 * color); without `text` the color is lifted with {@link legible} as before. `text` is lifted to 4.5:1 too if it falls short. A light
 * surface and a color that already reaches 4.5:1 return `color` unchanged, and so does a value that is not an opaque hex. A metric value
 * never has an explicit color of its own, so the preview and the PPTX export both call this for every value, with the same inputs.
 */
export function metricValueColor(color: string, background: string, text?: string): string {
  const foreground = normalize(color), surface = normalize(background);
  if (!foreground || !surface || !isDarkColor(surface)) return color;
  if (contrast(foreground, surface) >= METRIC_VALUE_MIN_CONTRAST) return color;
  const light = text === undefined ? undefined : normalize(text);
  return legible(light ?? foreground, surface, METRIC_VALUE_MIN_CONTRAST);
}

export interface MetricTrendColorOptions {
  /** The slide background the metric text sits on. */
  background: string;
  /** Neutral colour for a neutral sentiment (the deck's muted text). */
  neutral?: string;
  /** Whether the change is good news; absent, the trend's default (up positive, down negative, flat neutral). */
  sentiment?: MetricSentiment;
}

// Positive is green, negative red, neutral the muted text colour. Which one a trend gets is the
// sentiment's call (a falling latency is good news), not the arrow's: the arrow and the word carry
// the direction, the colour carries the verdict.
const SEMANTIC = {
  positive: { light: '#15803D', dark: '#4ADE80' },
  negative: { light: '#B91C1C', dark: '#F87171' },
} as const;

/** The colour of a trend (or, with `options.sentiment`, of its sentiment), kept at >= 4.5:1 against the slide background. */
export function metricTrendColor(trend: MetricTrend, options: MetricTrendColorOptions): string {
  const background = normalize(options.background) ?? '#FFFFFF';
  const sentiment = metricEffectiveSentiment(trend, options.sentiment);
  if (sentiment === 'neutral') return legible(normalize(options.neutral) ?? (luminance(background) < .5 ? '#CBD5E1' : '#475569'), background, METRIC_TREND_MIN_CONTRAST);
  const pair = SEMANTIC[sentiment];
  return legible(luminance(background) < .5 ? pair.dark : pair.light, background, METRIC_TREND_MIN_CONTRAST);
}

export interface MetricTrendMark {
  trend: MetricTrend;
  /** The sentiment the colour follows: the metric's own, else the default for the trend. */
  sentiment: MetricSentiment;
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
 * The arrow for a laid-out metric, or undefined when the metric has no trend or core placed no arrow. LH-53: core's metric layout places
 * it (`layout.trendBox`: square, METRIC_TREND_ARROW_SIZE of its line's size, on the baseline before the delta, else before the label or
 * the description); the trend word is not drawn and is the arrow's text alternative. The color follows `options.sentiment`, else the
 * layout's own (`metric.sentiment`), else the trend's default.
 */
export function metricTrendMark(layout: MetricLayout, options: MetricTrendColorOptions): MetricTrendMark | undefined {
  const part = layout.parts.find(candidate => candidate.role === 'trend');
  if (!part || !layout.trendBox) return undefined;
  const trend = part.text.trim() as MetricTrend;
  if (!Object.hasOwn(METRIC_TREND_SHAPES, trend)) return undefined;
  const shape = METRIC_TREND_SHAPES[trend], box = { ...layout.trendBox };
  const sentiment = metricEffectiveSentiment(trend, options.sentiment ?? layout.sentiment);
  return { trend, sentiment, shape, box, points: metricTrendPoints(shape, box), color: metricTrendColor(trend, { ...options, sentiment }), ariaLabel: `Trend: ${trend}`, path: part.path };
}


/**
 * LH-137: the fill of a metric's delta pill (`MetricLayout.deltaPill`) on `backdrop` (the slide, card or emphasis surface under the metric):
 * the backdrop moved toward the text color, as a table's banded row is (core surfaceAltColor), so the pill reads as a step off its backdrop
 * and the text keeps 4.5:1 on it. Engines color the delta and its trend arrow against this fill (metricTrendMark's `background`).
 */
export function metricPillFill(backdrop: string, text: string): string {
  return surfaceAltColor(backdrop, text);
}
