/**
 * Geometry of a text watermark (`design.watermark = { text, opacity }`), shared by the SVG preview and the
 * PPTX export so both draw the same stamp.
 *
 * The stamp is one line of text, centered on the slide and rotated 30 degrees counterclockwise (rising to
 * the right), the usual diagonal DRAFT or CONFIDENTIAL mark. It is sized so the line spans at most 70% of the
 * slide width and its height is at most 30% of the shorter slide edge, which keeps the rotated line inside
 * every preset from 9:16 portrait to 16:9 widescreen.
 */

import { resolveTextStyle, textWidthMeasurer, type TextMeasurement, type TextStyle } from './composition.js';

/** Counterclockwise angle of a text watermark, as a negative clockwise rotation in degrees. */
export const WATERMARK_TEXT_ROTATION = -30;
/** Widest the line may be, as a fraction of the slide width. */
export const WATERMARK_TEXT_MAX_WIDTH = 0.7;
/** Tallest the type may be, as a fraction of the shorter slide edge. */
export const WATERMARK_TEXT_MAX_HEIGHT = 0.3;

export interface WatermarkTextOptions {
  /** The heading family of the design. Defaults to `sans-serif`. */
  fontFamily?: string;
  /** Defaults to 700. */
  fontWeight?: number;
  textMeasurement?: TextMeasurement;
}

export interface WatermarkTextLayout {
  /** The text as drawn: line breaks become spaces and the ends are trimmed. */
  text: string;
  fontFamily: string;
  fontWeight: number;
  /** The resolved text style (the host's font registry may rename the family). */
  style: TextStyle;
  /** In the unit of the size passed in (reference pixels for a composed slide). */
  fontSize: number;
  /** Measured width of the line at `fontSize`. */
  textWidth: number;
  /** The unrotated text box, centered on the slide; PPTX rotates it about its center. */
  box: { x: number; y: number; width: number; height: number };
  /** Rotation about the slide center in degrees, clockwise positive. */
  rotation: number;
}

/** Lay out a text watermark on a slide of `size`; undefined when the text is empty. */
export function layoutWatermark(text: unknown, size: { width: number; height: number }, options: WatermarkTextOptions = {}): WatermarkTextLayout | undefined {
  const value = typeof text === 'string' ? text.replace(/\s*[\r\n]+\s*/g, ' ').trim() : '';
  if (!value) return undefined;
  const { width, height } = size;
  if (![width, height].every((n) => Number.isFinite(n) && n > 0)) throw new RangeError('Watermark slide size must be finite and positive.');
  const fontFamily = options.fontFamily ?? 'sans-serif', fontWeight = options.fontWeight ?? 700;
  const style = resolveTextStyle({ fontFamily, fontWeight, italic: false, path: 'design.watermark' }, options.textMeasurement);
  const measure = textWidthMeasurer(style, options.textMeasurement);
  const reference = 100, unit = measure(value, reference);
  const wanted = unit > 0 ? (WATERMARK_TEXT_MAX_WIDTH * width * reference) / unit : WATERMARK_TEXT_MAX_HEIGHT * Math.min(width, height);
  const fontSize = Math.max(1, Math.min(wanted, WATERMARK_TEXT_MAX_HEIGHT * Math.min(width, height)));
  const textWidth = measure(value, fontSize);
  const boxWidth = textWidth + fontSize * 0.5, boxHeight = fontSize * 1.4;
  return {
    text: value, fontFamily: style.fontFamily, fontWeight, style, fontSize, textWidth,
    box: { x: (width - boxWidth) / 2, y: (height - boxHeight) / 2, width: boxWidth, height: boxHeight },
    rotation: WATERMARK_TEXT_ROTATION,
  };
}
