/**
 * Timeline event status (FA-11): how a `done`, `current` or `planned` event looks in the SVG
 * preview and in the PPTX export. Core's timeline layout places the markers and the text and
 * records each event's status on them (see `TimelineLayout.markers` and `TimelineTextPart.status`).
 * This derives, from that geometry and the deck's colors, the shapes and text colors to draw, so
 * both engines draw the same marker in the same place and colors.
 *
 * - no status, `done`: a filled marker in the primary color, normal text (today's marker).
 * - `current` ("we are here"): the same filled marker inside a ring, and the label is bold
 *   (layout sets the weight, so the measured line breaks already include it).
 * - `planned`: a hollow marker (primary-color outline over the slide background) and muted text.
 *
 * Text colors are kept at 4.5:1 against the slide background, outlines and rings at 3:1.
 */
import type { TimelineLayout, TimelineTextPart } from './composition.js';
import { legible, normalize } from './legible-color.js';

export const TIMELINE_STATUSES = Object.freeze(['done', 'current', 'planned'] as const);
export const TIMELINE_TEXT_MIN_CONTRAST = 4.5;
export const TIMELINE_OUTLINE_MIN_CONTRAST = 3;

export interface TimelineStatusColors {
  /** The slide background the timeline sits on. */
  background: string;
  /** The marker color (the deck's primary color). */
  primary: string;
  /** The color of normal timeline text. */
  text: string;
  /** The muted color of planned events' text (the deck's secondary text). */
  mutedText: string;
}

export interface TimelineMarkerShape {
  /** `marker` is the event's dot (or hollow circle), `ring` the circle around a current event's dot. */
  role: 'marker' | 'ring';
  /** DrawingML preset name for native export. */
  shape: 'ellipse';
  cx: number;
  cy: number;
  /** Radius of the drawn ellipse (the marker's `radius`, or the ring's `ring.radius`, 1.6 times it). An outline is centered on the edge, so it reaches half its width beyond. */
  radius: number;
  /** Fill color; undefined means no fill (nothing draws inside the shape). */
  fill?: string;
  /** Outline; undefined means no outline. */
  stroke?: { color: string; width: number };
}

/** The shapes of one marker from `layout.markers`, back to front: the ring (current only), then the marker. */
export function timelineMarkerShapes(marker: TimelineLayout['markers'][number], colors: TimelineStatusColors): TimelineMarkerShape[] {
  const background = normalize(colors.background) ?? '#FFFFFF';
  const primary = normalize(colors.primary), outline = primary ? legible(primary, background, TIMELINE_OUTLINE_MIN_CONTRAST) : colors.primary;
  const shapes: TimelineMarkerShape[] = [];
  const width = marker.strokeWidth ?? 0;
  // The ring and the hollow marker are filled with the slide background so the connector does not show through them.
  if (marker.status === 'current' && marker.ring) {
    shapes.push({ role: 'ring', shape: 'ellipse', cx: marker.x, cy: marker.y, radius: marker.ring.radius, fill: colors.background, stroke: { color: outline, width } });
  }
  if (marker.status === 'planned') {
    shapes.push({ role: 'marker', shape: 'ellipse', cx: marker.x, cy: marker.y, radius: marker.radius, fill: colors.background, stroke: { color: outline, width } });
  } else {
    shapes.push({ role: 'marker', shape: 'ellipse', cx: marker.x, cy: marker.y, radius: marker.radius, fill: colors.primary });
  }
  return shapes;
}

/** The color of one timeline text part: muted for a planned event, the normal text color otherwise, kept at >= 4.5:1. */
export function timelineTextColor(part: Pick<TimelineTextPart, 'status'>, colors: TimelineStatusColors): string {
  if (part.status !== 'planned') return colors.text;
  const background = normalize(colors.background) ?? '#FFFFFF', muted = normalize(colors.mutedText);
  return muted ? legible(muted, background, TIMELINE_TEXT_MIN_CONTRAST) : colors.mutedText;
}
