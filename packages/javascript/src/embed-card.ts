import { fitText, resolveTextStyle, snapFontSizeDown, textWidthMeasurer, type LayoutBox, type TextMeasurement, type TextStyle } from './composition.js';

/**
 * The card an embed is drawn as where it has no `preview` (FR-08): a rounded panel with a link badge at the top left, the title in the
 * heading font (up to three lines, then clipped with an ellipsis) and the site name below it in the body font. Geometry is shared:
 * the preview, the PDF and the PowerPoint export draw exactly these boxes and lines.
 *
 * The card draws at any frame size. Text is never smaller than the readability floor: a title that does not fit at the floor in the
 * room the frame has is clipped, the site name is left out when the title would have to be clipped to make room for it, and a frame
 * too small for one line of the title keeps only the badge.
 */
export interface EmbedCardInput {
  /** The frame the card fills, in reference pixels. */
  frame: LayoutBox;
  /** The title (or the site name when the embed has none). */
  title: string;
  /** The site name, drawn below the title. */
  site: string;
  headingFamily: string;
  bodyFamily: string;
  /** The deck's scale: min(width, height) / 720. */
  scale: number;
  /** The readability floor in pixels at scale 1 (default 16). */
  minFontSizePx?: number;
  measurement?: TextMeasurement;
}

export interface EmbedCardText {
  box: LayoutBox;
  /** The lines as drawn; the last one ends with an ellipsis when `clipped`. */
  lines: string[];
  fontSize: number;
  lineHeight: number;
  clipped: boolean;
  style: TextStyle;
}

export interface EmbedCardLayout {
  frame: LayoutBox;
  /** Corner radius of the panel. */
  radius: number;
  /** The link badge: a circle (`badge`) with an arrow glyph (`arrow`, its square box, turned a quarter and a half... see `arrowPoints`). */
  icon: { badge: LayoutBox; arrow: LayoutBox; points: [number, number][] };
  title?: EmbedCardText;
  site?: EmbedCardText;
}

/** The arrow of the badge: PowerPoint's right arrow preset (adj1 = adj2 = 50000) in `box`, turned 45 degrees to point up and right. */
export function embedArrowPoints(box: LayoutBox): [number, number][] {
  const size = Math.min(box.width, box.height), left = box.x + (box.width - size) / 2, top = box.y + (box.height - size) / 2;
  const local: [number, number][] = [[0, .25], [.5, .25], [.5, 0], [1, .5], [.5, 1], [.5, .75], [0, .75]];
  const cx = left + size / 2, cy = top + size / 2, cos = Math.SQRT1_2, sin = -Math.SQRT1_2;
  return local.map(([u, v]) => {
    const dx = left + u * size - cx, dy = top + v * size - cy;
    return [round(cx + dx * cos - dy * sin), round(cy + dx * sin + dy * cos)] as [number, number];
  });
}

const round = (value: number): number => Math.round(value * 1e3) / 1e3;
const TITLE_SIZE = 28, SITE_SIZE = 18, MAX_TITLE_LINES = 3;

export function embedCardLayout(input: EmbedCardInput): EmbedCardLayout {
  const { frame, scale: s } = input, floor = (input.minFontSizePx ?? 16) * s;
  const short = Math.min(frame.width, frame.height);
  const pad = Math.max(Math.min(6 * s, short / 4), Math.min(24 * s, short * .08));
  const badgeSize = Math.max(Math.min(short - 2 * pad, 40 * s), Math.min(short / 2, 12 * s));
  const badge: LayoutBox = { x: frame.x + pad, y: frame.y + pad, width: badgeSize, height: badgeSize };
  const glyph = badgeSize * .56, arrow: LayoutBox = { x: badge.x + (badgeSize - glyph) / 2, y: badge.y + (badgeSize - glyph) / 2, width: glyph, height: glyph };
  const layout: EmbedCardLayout = { frame, radius: Math.min(12 * s, short / 6), icon: { badge, arrow, points: embedArrowPoints(arrow) } };
  const headingStyle = resolveTextStyle({ fontFamily: input.headingFamily, fontWeight: 700 }, input.measurement);
  const bodyStyle = resolveTextStyle({ fontFamily: input.bodyFamily, fontWeight: 400 }, input.measurement);
  const gap = 10 * s, left = frame.x + pad, width = frame.width - 2 * pad, top = badge.y + badge.height + gap, bottom = frame.y + frame.height - pad;
  if (!(width > 0) || !(bottom - top > 0)) return layout;
  const measureTitle = textWidthMeasurer(headingStyle, input.measurement), measureSite = textWidthMeasurer(bodyStyle, input.measurement);
  const clip = (text: string, size: number, measure: (text: string, size: number) => number): string => {
    if (measure(text, size) <= width) return text;
    let end = text.length;
    while (end > 0 && measure(`${text.slice(0, end).trimEnd()}…`, size) > width) end--;
    return `${text.slice(0, end).trimEnd()}…`;
  };
  const wrap = (size: number) => fitText(input.title, { x: left, y: top, width, height: 1e6 }, size, size, measureTitle);
  const siteSize = Math.max(floor, snapFontSizeDown(SITE_SIZE * s)), siteLine = siteSize * 1.3, siteGap = 6 * s;
  const titleText = (room: number): EmbedCardText | undefined => {
    // The largest size from the nominal down to the floor at which the whole title is at most three lines in the room it has.
    let size = Math.max(floor, snapFontSizeDown(TITLE_SIZE * s));
    for (;;) {
      const fit = wrap(size);
      if (fit.lines.length <= MAX_TITLE_LINES && fit.lines.length * fit.lineHeight <= room + 1e-6)
        return { box: { x: left, y: top, width, height: round(fit.lines.length * fit.lineHeight) }, lines: fit.lines, fontSize: fit.fontSize, lineHeight: fit.lineHeight, clipped: false, style: headingStyle };
      if (size <= floor + 1e-9) {
        const allowed = Math.min(MAX_TITLE_LINES, Math.floor((room + 1e-6) / fit.lineHeight));
        if (allowed < 1) return undefined;
        const lines = fit.lines.slice(0, allowed), rest = fit.lines.slice(allowed - 1).join(' ');
        lines[allowed - 1] = clip(rest, fit.fontSize, measureTitle);
        return { box: { x: left, y: top, width, height: round(allowed * fit.lineHeight) }, lines, fontSize: fit.fontSize, lineHeight: fit.lineHeight, clipped: true, style: headingStyle };
      }
      size = Math.max(floor, snapFontSizeDown(size - s));
    }
  };
  // An embed with no title is named by its site: the site name is not drawn twice.
  const withSite = input.site === input.title ? undefined : titleText(bottom - top - siteLine - siteGap);
  if (withSite && !withSite.clipped) {
    const y = top + withSite.box.height + siteGap;
    layout.title = withSite;
    layout.site = { box: { x: left, y, width, height: round(siteLine) }, lines: [clip(input.site, siteSize, measureSite)], fontSize: siteSize, lineHeight: siteLine, clipped: false, style: bodyStyle };
    return layout;
  }
  const alone = titleText(bottom - top);
  if (alone) layout.title = alone;
  return layout;
}
