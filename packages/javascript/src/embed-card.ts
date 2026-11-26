import { fitText, resolveTextStyle, snapFontSizeDown, textWidthMeasurer, type LayoutBox, type TextMeasurement, type TextStyle } from './composition.js';

/**
 * The card an embed is drawn as where it has no `preview` (FR-08): a rounded panel with a link badge, the title in the
 * heading font (up to three lines, then clipped with an ellipsis) and the site name below it in the body font, the whole block centered
 * in the panel both ways and every line centered. The title's size follows the card (a tenth of its shorter side, between 28 and 40 at
 * scale 1); the badge, the gaps and the site name scale with it by fixed ratios. Geometry is shared:
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
  /** Every line is centered on the middle of `box`; `lineWidths` holds each line's measured width. */
  align: 'center';
  lineWidths: number[];
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
/** The title's size at scale 1: today's size is the floor of the growth rule, the ceiling keeps a card's title below the slide title's. */
const TITLE_SIZE = 28, TITLE_CEILING = 40, TITLE_SHARE = 0.1, SITE_SIZE = 18, MAX_TITLE_LINES = 3;

/** The title size a card of this shorter side starts from: a tenth of it, between TITLE_SIZE and TITLE_CEILING (scaled). */
function embedCardTitleSize(short: number, scale: number): number {
  return snapFontSizeDown(Math.min(TITLE_CEILING * scale, Math.max(TITLE_SIZE * scale, TITLE_SHARE * short)));
}

export function embedCardLayout(input: EmbedCardInput): EmbedCardLayout {
  const { frame, scale: s } = input, floor = (input.minFontSizePx ?? 16) * s;
  const short = Math.min(frame.width, frame.height);
  const pad = Math.max(Math.min(6 * s, short / 4), Math.min(24 * s, short * .08));
  const centerX = frame.x + frame.width / 2, centerY = frame.y + frame.height / 2;
  const radius = Math.min(12 * s, short / 6);
  // The badge, the gaps and the site name grow with the title by fixed ratios (1 at today's title size).
  const sizes = (grow: number) => {
    const badge = Math.max(Math.min(short - 2 * pad, 40 * s * grow), Math.min(short / 2, 12 * s));
    return { badge, gap: 10 * s * grow, siteGap: 6 * s * grow, siteSize: Math.max(floor, snapFontSizeDown(SITE_SIZE * s * grow)) };
  };
  const badgeLayout = (size: number, top: number): EmbedCardLayout => {
    const badge: LayoutBox = { x: round(centerX - size / 2), y: round(top), width: round(size), height: round(size) };
    const glyph = size * .56, arrow: LayoutBox = { x: round(centerX - glyph / 2), y: round(top + (size - glyph) / 2), width: round(glyph), height: round(glyph) };
    return { frame, radius, icon: { badge, arrow, points: embedArrowPoints(arrow) } };
  };
  const only = sizes(1).badge;
  const badgeOnly = badgeLayout(only, centerY - only / 2);
  const width = frame.width - 2 * pad, room = frame.height - 2 * pad;
  if (!(width > 0) || !(room > 0)) return badgeOnly;
  const headingStyle = resolveTextStyle({ fontFamily: input.headingFamily, fontWeight: 700 }, input.measurement);
  const bodyStyle = resolveTextStyle({ fontFamily: input.bodyFamily, fontWeight: 400 }, input.measurement);
  const measureTitle = textWidthMeasurer(headingStyle, input.measurement), measureSite = textWidthMeasurer(bodyStyle, input.measurement);
  const left = frame.x + pad;
  const clip = (text: string, size: number, measure: (text: string, size: number) => number): string => {
    if (measure(text, size) <= width) return text;
    let end = text.length;
    while (end > 0 && measure(`${text.slice(0, end).trimEnd()}…`, size) > width) end--;
    return `${text.slice(0, end).trimEnd()}…`;
  };
  const text = (lines: string[], size: number, lineHeight: number, clipped: boolean, style: TextStyle, measure: (text: string, size: number) => number): EmbedCardText =>
    ({ box: { x: left, y: 0, width, height: round(lines.length * lineHeight) }, lines, lineWidths: lines.map((line) => round(measure(line, size))), align: 'center', fontSize: size, lineHeight, clipped, style });
  // The title at `size` in `avail` pixels of height: whole when it is at most three lines and fits, else (at the floor only) clipped.
  const titleAt = (size: number, avail: number): EmbedCardText | undefined => {
    const fit = fitText(input.title, { x: left, y: 0, width, height: 1e6 }, size, size, measureTitle);
    if (fit.lines.length <= MAX_TITLE_LINES && fit.lines.length * fit.lineHeight <= avail + 1e-6) return text(fit.lines, fit.fontSize, fit.lineHeight, false, headingStyle, measureTitle);
    if (size > floor + 1e-9) return undefined;
    const allowed = Math.min(MAX_TITLE_LINES, Math.floor((avail + 1e-6) / fit.lineHeight));
    if (allowed < 1) return undefined;
    const lines = fit.lines.slice(0, allowed);
    lines[allowed - 1] = clip(fit.lines.slice(allowed - 1).join(' '), fit.fontSize, measureTitle);
    return text(lines, fit.fontSize, fit.lineHeight, true, headingStyle, measureTitle);
  };
  // From the card's size down to the floor, the first size at which the block (badge, title, and the site name when asked) fits.
  const nominal = embedCardTitleSize(short, s);
  const block = (withSite: boolean) => {
    for (let size = nominal; ; size = Math.max(floor, snapFontSizeDown(size - s))) {
      const grow = Math.max(1, size / (TITLE_SIZE * s)), p = sizes(grow), siteLine = p.siteSize * 1.3;
      const title = titleAt(size, room - p.badge - p.gap - (withSite ? siteLine + p.siteGap : 0));
      if (title && (!title.clipped || size <= floor + 1e-9)) return { title, p, siteLine, size };
      if (size <= floor + 1e-9) return undefined;
    }
  };
  // An embed with no title is named by its site: the site name is not drawn twice.
  let chosen = input.site === input.title ? undefined : block(true), withSite = true;
  if (!chosen || chosen.title.clipped) { chosen = block(false); withSite = false; }
  if (!chosen) return badgeOnly;
  const { title, p, siteLine } = chosen;
  const height = p.badge + p.gap + title.box.height + (withSite ? p.siteGap + siteLine : 0), top = centerY - height / 2;
  const layout = badgeLayout(p.badge, top);
  title.box.y = round(top + p.badge + p.gap);
  layout.title = title;
  if (withSite) {
    const site = text([clip(input.site, p.siteSize, measureSite)], p.siteSize, siteLine, false, bodyStyle, measureSite);
    site.box.y = round(title.box.y + title.box.height + p.siteGap);
    layout.site = site;
  }
  return layout;
}
