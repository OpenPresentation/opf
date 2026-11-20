/**
 * LH-158: where a heading group goes on a picture background.
 *
 * Without computer vision core cannot know where a picture's subject is, but a host that measured the picture (`pictureLuminance`, a
 * luminance grid, optionally with a vision model's `busy` and `salient` weights) tells it how busy each part of the picture is and how
 * well the text color reads there. A cover's or section's heading group then has a few good places: the top, the middle or the bottom
 * of its area, aligned to the start side or centered, each scored on the cells under its text without a scrim; as fallbacks the
 * automatic scrim (LH-02) at the place that needs the least of it, or a solid panel in the slide's background color, a start-side column
 * about 40% of the slide wide with the picture bleeding on the rest (LH-23's hero). Core picks one and reports every candidate with its
 * score (`SlideComposition.pictureText`), so an editor or a host with its own vision can offer the others, and an author's
 * `textPlacement` on the background picks one outright.
 */
import {sampledGrays, sampledWeight, scrimOpacity, SCRIM_TARGET_CONTRAST, type PictureLuminance, type ScrimBox, type ScrimEdge} from './picture-scrim.js';

/** Where in its area the heading group sits. */
export type PictureTextAnchor = 'top' | 'middle' | 'bottom';
/** How the heading group is aligned: `start`, the layout's side alignment (left, mirrored in a right-to-left deck), or `center`. */
export type PictureTextAlignment = 'start' | 'center';
/** A placement of the heading group on a picture background: an anchor and an alignment, or `panel`. */
export type PictureTextPlacement = `${PictureTextAnchor}-${PictureTextAlignment}` | 'panel';
/** Every placement, in the order an editor lists them. */
export const PICTURE_TEXT_PLACEMENTS: readonly PictureTextPlacement[] = ['top-start', 'top-center', 'middle-start', 'middle-center', 'bottom-start', 'bottom-center', 'panel'];

/**
 * The widest range of grays (0 to 255, through the author's overlay) a measured picture may show under the text of a placement for it to
 * read without a scrim (wave 6's calm band); a wider band is busy. A host's `busy` weight counts against CALM_PICTURE_SPREAD / 255.
 */
export const CALM_PICTURE_SPREAD = 48;
/** A placement whose text covers a cell of at least this `salient` weight (a face, the subject) does not read. */
export const SALIENT_LIMIT = 0.5;
/** The automatic scrim carries a placement that does not read while it needs at most this opacity; above it, the panel reads better. */
export const PANEL_SCRIM_LIMIT = 0.5;
/** The shares of the slide width of the narrower columns a placement may set the group in (at the start side, or centered), padding included. */
export const PICTURE_TEXT_COLUMNS = [0.6, 0.7] as const;
/** The panel's share of the slide width, and the wider share it takes when the heading group would be set smaller in the first. */
export const PICTURE_PANEL_SHARES = [0.4, 0.5] as const;

/** One candidate placement of the heading group on the picture, scored on the measured grid. */
export interface PictureTextCandidate {
  placement: PictureTextPlacement;
  anchor: PictureTextAnchor;
  alignment: PictureTextAlignment;
  /** The text on the picture (the union of the group's ink), or the panel, in canvas pixels. */
  box: ScrimBox;
  /**
   * The width the group is set in, canvas pixels: its area's, or a column of PICTURE_TEXT_COLUMNS of the slide (at the start side, or
   * centered) where that reads better and keeps every size, so a title wraps short of a bright corner; for the panel, its text column.
   */
  measure: number;
  /** The darkest and lightest gray (0 to 255, sRGB) under the text, through the author's overlay. Absent for the panel. */
  grays?: [number, number];
  /** How far apart those grays are (0 to 255): the luminance spread, how busy the picture is there. */
  spread: number;
  /** The contrast the slide's text color reaches over the worst of those grays (over the slide background for the panel). */
  contrast: number;
  /** The host's largest `busy` weight under the text (0 when it gave none). */
  busy: number;
  /** The host's largest `salient` weight under the text, or under the panel (0 when it gave none). */
  salient: number;
  /** Reads on the bare picture: contrast at least 4.5:1, spread at most CALM_PICTURE_SPREAD, no busy or salient cell (the panel: no salient cell). */
  reads: boolean;
  /** The opacity the automatic scrim would need there (0 to 1); absent when the background has an `overlay` key or for the panel. */
  scrim?: number;
  /** Lower is better: busy-ness (spread / 255 or the busy weight) plus the salient weight plus the contrast shortfall below 4.5:1. */
  score: number;
}

/** LH-158: the placement of the heading group on a picture background (SlideComposition.pictureText). */
export interface PictureText {
  /** The placement drawn. */
  placement: PictureTextPlacement;
  /** The anchor and alignment it was drawn at (for the panel, the layout's anchor inside the panel, start-aligned). */
  anchor: PictureTextAnchor;
  alignment: PictureTextAlignment;
  /** `measured`: chosen on the host's grid; `authored`: the background's `textPlacement`. */
  source: 'measured' | 'authored';
  /** The placement does not read on the bare picture and the automatic scrim carries it. */
  scrim?: true;
  /** The panel drawn under the group: the column (canvas pixels) and the slide edge it stands on. */
  panel?: { box: ScrimBox; edge: ScrimEdge };
  /** Every candidate with its score, in PICTURE_TEXT_PLACEMENTS order; empty when the picture was not measured. */
  candidates: PictureTextCandidate[];
}

type Rgb = [number, number, number];
const channels = (hex: string): Rgb => [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16)) as Rgb;
const linear = (c: number) => { const n = c / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; };
const luminanceOf = ([r, g, b]: Rgb) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const contrastOf = (a: Rgb, b: Rgb) => { const x = luminanceOf(a), y = luminanceOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hexOf = (rgb: Rgb) => `#${rgb.map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const r2 = (value: number) => Math.round(value * 100) / 100;
const r3 = (value: number) => Math.round(value * 1000) / 1000;

/** Inputs of the candidates' scores. */
export interface PictureTextInput {
  grid: PictureLuminance;
  /** The picture's rectangle on the slide (its fit placement), canvas pixels. */
  picture: ScrimBox;
  /** The slide's text color, opaque `#RRGGBB`. */
  text: string;
  /** The automatic scrim's color (the slide background), when the background has no `overlay` key; absent, no scrim is scored. */
  scrim?: string;
  /** The author's full-frame overlay (a literal color and its alpha), which every gray is seen through. */
  overlay?: { color: string; alpha: number };
  /** The text of each anchor and alignment (union of ink boxes, canvas pixels). */
  places: readonly { anchor: PictureTextAnchor; alignment: PictureTextAlignment; measure: number; box: ScrimBox }[];
  /** How far around the text the picture is read, canvas pixels (the margin the automatic scrim covers, SCRIM_MARGIN). */
  margin?: number;
  /** The panel and the width of its text column, when the slide can take one. */
  panel?: { box: ScrimBox; measure: number };
}

/**
 * The candidates scored on the grid, one per placement, or undefined when the grid is unusable (then the slide composes as if it were
 * not measured). A placement given at several measures keeps the one that reads, else the one with the lower score, else the first.
 */
export function scorePictureText(input: PictureTextInput): PictureTextCandidate[] | undefined {
  const { grid, picture } = input, text = channels(input.text), alpha = Math.max(0, Math.min(1, input.overlay?.alpha ?? 0)), tint = input.overlay ? channels(input.overlay.color) : [0, 0, 0] as Rgb;
  const seen = (gray: number): Rgb => [0, 1, 2].map(i => Math.round(gray * (1 - alpha) + tint[i]! * alpha)) as Rgb;
  const margin = Math.max(0, input.margin ?? 0);
  const region = (box: ScrimBox, around = margin) => ({ left: (box.x - around - picture.x) / picture.width, top: (box.y - around - picture.y) / picture.height, right: (box.x + box.width + around - picture.x) / picture.width, bottom: (box.y + box.height + around - picture.y) / picture.height });
  const candidates: PictureTextCandidate[] = [];
  for (const place of input.places) {
    const at = region(place.box), grays = sampledGrays(grid, at), busy = sampledWeight(grid.busy, at), salient = sampledWeight(grid.salient, at);
    if (!grays || busy === undefined || salient === undefined) return undefined;
    let contrast = 21;
    for (let gray = grays[0]; gray <= grays[1]; gray++) contrast = Math.min(contrast, contrastOf(text, seen(gray)));
    const spread = Math.abs(grays[1] - grays[0]) * (1 - alpha), busyness = Math.max(spread / 255, busy);
    const reads = contrast >= SCRIM_TARGET_CONTRAST && spread <= CALM_PICTURE_SPREAD && busy <= CALM_PICTURE_SPREAD / 255 && salient < SALIENT_LIMIT;
    const ramp: string[] = [];
    if (input.scrim) for (let gray = grays[0]; gray <= grays[1]; gray++) ramp.push(hexOf(seen(gray)));
    const candidate: PictureTextCandidate = {
      placement: `${place.anchor}-${place.alignment}`, anchor: place.anchor, alignment: place.alignment, box: roundBox(place.box), measure: r2(place.measure), grays, spread: Math.round(spread),
      contrast: r2(contrast), busy: r3(busy), salient: r3(salient), reads,
      ...(input.scrim ? { scrim: scrimOpacity([{ color: input.text, target: SCRIM_TARGET_CONTRAST }], input.scrim, ramp).opacity } : {}),
      score: r3(busyness + salient + Math.max(0, SCRIM_TARGET_CONTRAST - contrast) / SCRIM_TARGET_CONTRAST),
    };
    const same = candidates.findIndex(other => other.placement === candidate.placement), other = candidates[same];
    if (!other) candidates.push(candidate);
    else if ((candidate.reads && !other.reads) || (candidate.reads === other.reads && candidate.score < other.score)) candidates[same] = candidate;
  }
  if (input.panel && input.scrim) {
    const salient = sampledWeight(grid.salient, region(input.panel.box, 0));
    if (salient === undefined) return undefined;
    const contrast = contrastOf(text, channels(input.scrim));
    candidates.push({ placement: 'panel', anchor: 'middle', alignment: 'start', box: roundBox(input.panel.box), measure: r2(input.panel.measure), spread: 0, contrast: r2(contrast), busy: 0, salient: r3(salient), reads: salient < SALIENT_LIMIT, score: r3(salient) });
  }
  return candidates.sort((a, b) => PICTURE_TEXT_PLACEMENTS.indexOf(a.placement) - PICTURE_TEXT_PLACEMENTS.indexOf(b.placement));
}

/**
 * The placement core draws, from scored candidates: the layout's own placement (`preferred`) when it reads; else the reading placement
 * with the lowest score, the layout's alignment first; else, when the background has no `overlay` key, the placement that needs the
 * least automatic scrim (plus its salient weight), unless that scrim is above PANEL_SCRIM_LIMIT and the panel reads, which then wins;
 * else (an overlay of the author's) the placement with the lowest score. Ties keep the order of `order` (the layout's anchor, then the
 * middle, then the others).
 */
export function choosePictureText(candidates: readonly PictureTextCandidate[], preferred: { anchor: PictureTextAnchor; alignment: PictureTextAlignment }, order: readonly PictureTextAnchor[]): { candidate: PictureTextCandidate; scrim: boolean } | undefined {
  const places = candidates.filter(candidate => candidate.placement !== 'panel'), panel = candidates.find(candidate => candidate.placement === 'panel');
  if (!places.length) return undefined;
  const rank = (candidate: PictureTextCandidate) => (candidate.alignment === preferred.alignment ? 0 : order.length) + order.indexOf(candidate.anchor);
  const by = (key: (candidate: PictureTextCandidate) => number) => (a: PictureTextCandidate, b: PictureTextCandidate) => (a.alignment === preferred.alignment ? 0 : 1) - (b.alignment === preferred.alignment ? 0 : 1) || key(a) - key(b) || rank(a) - rank(b);
  const own = places.find(candidate => candidate.anchor === preferred.anchor && candidate.alignment === preferred.alignment);
  if (own?.reads) return { candidate: own, scrim: false };
  const reading = places.filter(candidate => candidate.reads).sort(by(candidate => candidate.score));
  if (reading.length) return { candidate: reading[0]!, scrim: false };
  if (places.every(candidate => candidate.scrim !== undefined)) {
    // The scrim hides the picture under the text, so the place that needs the least of it, and covers the least of the subject, wins.
    const best = [...places].sort((a, b) => (a.scrim! + a.salient) - (b.scrim! + b.salient) || rank(a) - rank(b))[0]!;
    if (panel?.reads && best.scrim! > PANEL_SCRIM_LIMIT) return { candidate: panel, scrim: false };
    return { candidate: best, scrim: best.scrim! > 0 };
  }
  return { candidate: [...places].sort(by(candidate => candidate.score))[0]!, scrim: false };
}

function roundBox(box: ScrimBox): ScrimBox {
  return { x: r2(box.x), y: r2(box.y), width: r2(box.width), height: r2(box.height) };
}
