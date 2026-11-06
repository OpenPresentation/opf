/**
 * SH-09: the pyramid and matrix arrangements of a layout region (`arrangement: "pyramid" | "matrix"` on a layout record's region).
 *
 * A lone list of one level in such a region is drawn as a diagram: a pyramid of stacked levels (the first entry at the apex) or a
 * 2 x 2 matrix of quadrants in a square. The geometry is PowerPoint's own for its Basic Pyramid and Basic Matrix SmartArt layouts,
 * measured through COM (SH-09 spike, 2026-11-06), so the PPTX export can write the arrangement as live SmartArt that PowerPoint lays out
 * exactly as the preview draws it:
 *
 * - pyramid of n levels in a frame W x H: level i (1-based, top to bottom) is H/n tall and W·i/n wide, centered; its sides continue
 *   one slope (each side steps in by W/(2n) from its bottom edge to its top edge), so the apex is a triangle and the others are
 *   trapezoids. PowerPoint's text rectangle is the apex's whole box, and 0.65 of a lower level's width (centered, full height).
 * - matrix: a square of side min(W, H) centered in the frame, a diamond filling it, and four rounded squares (quadrants 1 to 4: top
 *   left, top right, bottom left, bottom right) 0.39 of its side, 0.095 in from its edges and 0.03 apart. A matrix holds at most four
 *   entries; a quadrant without one is still drawn, empty. A quadrant's text rectangle is its rounded rectangle's own (DrawingML
 *   `roundRect` at its default adjustment).
 *
 * Text: one size for every node, the list's fitted size or larger, never smaller. PowerPoint insets each node's text by a share of its
 * font size (ARRANGEMENT_TEXT_MARGIN); lines are centered, the block in the middle of its rectangle.
 *
 * This module is pure geometry and paint: composeSlide places the text (SlideComposition.arrangements) and both engines draw from it.
 */

/** The arrangements a region can ask for. */
export const ARRANGEMENTS = ['pyramid', 'matrix'] as const;
export type Arrangement = typeof ARRANGEMENTS[number];
/** The most entries each arrangement draws; a list with more (or with nested entries, or descriptions) stays a list. */
export const ARRANGEMENT_MAX: Readonly<Record<Arrangement, number>> = Object.freeze({ pyramid: 8, matrix: 4 });
/** PowerPoint's SmartArt layout each arrangement matches (the `loTypeId` of a live SmartArt export). */
export const SMART_ART_LAYOUTS: Readonly<Record<Arrangement, string>> = Object.freeze({
  pyramid: 'urn:microsoft.com/office/officeart/2005/8/layout/pyramid1',
  matrix: 'urn:microsoft.com/office/officeart/2005/8/layout/matrix3',
});
/** A node's text inset on every side, as a share of its font size (PowerPoint's: 0.1 em in a pyramid level, 0.3 em in a quadrant). */
export const ARRANGEMENT_TEXT_MARGIN: Readonly<Record<Arrangement, number>> = Object.freeze({ pyramid: .1, matrix: .3 });
/** A lower pyramid level's text rectangle is this share of its width, centered (the apex's is its whole box). */
export const PYRAMID_TEXT_WIDTH = .65;
/** Matrix proportions, as shares of the square's side: the quadrant's side, its inset from the square's edge and the gap between two. */
export const MATRIX_QUADRANT = .39, MATRIX_INSET = .095, MATRIX_GAP = .03;
/** DrawingML `roundRect`'s default adjustment (16667 of 100000): the corner radius as a share of the smaller side. */
export const ROUND_RECT_ADJUST = 16667;
/** The text rectangle of a `roundRect` is inset by this share of its corner radius (1 - cos 45°, DrawingML's `il = dx1 * 29289 / 100000`). */
const ROUND_RECT_TEXT_INSET = .29289;
/** The text of an arrangement may grow to this many times the list's fitted size, while every node still holds its entry. */
export const ARRANGEMENT_GROWTH = 1.5;
/** The outline of every node, in points (PowerPoint's 1.5 pt line in the slide's background color). */
export const ARRANGEMENT_LINE_POINTS = 1.5;
/** The matrix's diamond is the primary color lightened by this share (DrawingML lumMod 1 - L, lumOff L). */
export const MATRIX_BACKGROUND_LIGHTEN = .8;
/** The widest pyramid frame, as a multiple of its height: a wider region centers a frame of this proportion. */
export const PYRAMID_MAX_ASPECT = 2.5;

interface Box { x: number; y: number; width: number; height: number }

/** One node of an arrangement: its shape's box, its DrawingML preset and adjustment, and the rectangle PowerPoint sets its text in. */
export interface ArrangementNode {
  /** 0-based: the pyramid's level from the top, the matrix's quadrant (top left, top right, bottom left, bottom right). */
  index: number;
  box: Box;
  /** DrawingML preset: `trapezoid` for a pyramid level (the apex too, as PowerPoint writes it), `roundRect` for a quadrant. */
  preset: 'trapezoid' | 'roundRect';
  /** The preset's `adj` (of 100000): a trapezoid's inset over its smaller side, a rounded rectangle's corner. */
  adjust: number;
  /** The outline as a polygon (a pyramid level), in the same units as `box`; absent for a rounded rectangle (`radius`). */
  points?: [number, number][];
  /** A rounded rectangle's corner radius. */
  radius?: number;
  /** PowerPoint's text rectangle for the node (before the text margin). */
  textBox: Box;
}

const round = (value: number) => Math.round(value * 1000) / 1000;
const roundBox = (box: Box): Box => ({ x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) });

/** The frame a pyramid takes in `area`: all of it, or a centered frame PYRAMID_MAX_ASPECT times as wide as tall when the area is wider. */
export function pyramidFrame(area: Box): Box {
  const width = Math.min(area.width, PYRAMID_MAX_ASPECT * area.height);
  return roundBox({ x: area.x + (area.width - width) / 2, y: area.y, width, height: area.height });
}

/** The levels of a pyramid of `count` entries in `frame`, the apex first (PowerPoint's Basic Pyramid). */
export function pyramidNodes(frame: Box, count: number): ArrangementNode[] {
  const n = Math.max(1, Math.floor(count)), height = frame.height / n, step = frame.width / (2 * n);
  return Array.from({ length: n }, (_, index) => {
    const width = frame.width * (index + 1) / n, x = frame.x + (frame.width - width) / 2, y = frame.y + index * height;
    const textWidth = index === 0 ? width : PYRAMID_TEXT_WIDTH * width;
    return {
      index, box: roundBox({ x, y, width, height }), preset: 'trapezoid' as const,
      adjust: Math.round(step / Math.min(width, height) * 100000),
      points: [[x + step, y], [x + width - step, y], [x + width, y + height], [x, y + height]].map(([px, py]) => [round(px!), round(py!)] as [number, number]),
      textBox: roundBox({ x: x + (width - textWidth) / 2, y, width: textWidth, height }),
    };
  });
}

/** The square of a matrix in `frame` (its diamond's box). */
export function matrixSquare(frame: Box): Box {
  const side = Math.min(frame.width, frame.height);
  return roundBox({ x: frame.x + (frame.width - side) / 2, y: frame.y + (frame.height - side) / 2, width: side, height: side });
}

/** The four quadrants of a matrix in `frame` (PowerPoint's Basic Matrix), whatever the number of entries. */
export function matrixNodes(frame: Box): ArrangementNode[] {
  const square = matrixSquare(frame), side = square.width, size = MATRIX_QUADRANT * side, inset = MATRIX_INSET * side, gap = MATRIX_GAP * side;
  const radius = size * ROUND_RECT_ADJUST / 100000, text = ROUND_RECT_TEXT_INSET * radius;
  return [0, 1, 2, 3].map(index => {
    const x = square.x + inset + (index % 2) * (size + gap), y = square.y + inset + Math.floor(index / 2) * (size + gap);
    return { index, box: roundBox({ x, y, width: size, height: size }), preset: 'roundRect' as const, adjust: ROUND_RECT_ADJUST, radius: round(radius),
      textBox: roundBox({ x: x + text, y: y + text, width: size - 2 * text, height: size - 2 * text }) };
  });
}

/**
 * The width of a node's shape across a horizontal line `y` (a pyramid level narrows toward its top edge); a quadrant's full width,
 * less its rounded corners where `y` is within a radius of its top or bottom edge.
 */
export function nodeWidthAt(node: ArrangementNode, y: number): number {
  const { box } = node, t = Math.min(1, Math.max(0, (y - box.y) / box.height));
  if (node.preset === 'trapezoid') {
    const step = node.points ? node.points[0]![0] - box.x : 0;
    return Math.max(0, box.width - 2 * step * (1 - t));
  }
  const radius = node.radius ?? 0, from = Math.min(y - box.y, box.y + box.height - y);
  if (from >= radius) return box.width;
  const dy = radius - Math.max(0, from);
  return Math.max(0, box.width - 2 * (radius - Math.sqrt(Math.max(0, radius * radius - dy * dy))));
}

/** A scheme color slot (as a PPTX theme names it) with the hex it resolves to on the slide and an optional luminance transform. */
export interface ArrangementColor { slot: 'accent1' | 'bg1' | 'tx1'; hex: string; lumMod?: number; lumOff?: number }
/** What an arrangement is painted with: its nodes' fill and outline, their text, and the matrix's diamond. */
export interface ArrangementPaint { fill: ArrangementColor; line: ArrangementColor; text: ArrangementColor; background: ArrangementColor }

/**
 * The paint of an arrangement from the slide's resolved colors: the nodes in the primary color (`accent1`) outlined in the background
 * (`bg1`), their text in whichever of the background and the text color reads better on the primary, and the matrix's diamond the
 * primary lightened by MATRIX_BACKGROUND_LIGHTEN. `lighten(hex, lumMod, lumOff)` is DrawingML's luminance transform (core
 * applyColorTransform), so the preview and PowerPoint compute the same color.
 */
export function arrangementPaint(primary: string, background: string, text: string, contrast: (a: string, b: string) => number | undefined, lighten: (hex: string, transform: { lumMod: number; lumOff: number }) => string): ArrangementPaint {
  const onPrimary = (contrast(background, primary) ?? 0) >= (contrast(text, primary) ?? 0) ? { slot: 'bg1' as const, hex: background } : { slot: 'tx1' as const, hex: text };
  const lumMod = Math.round((1 - MATRIX_BACKGROUND_LIGHTEN) * 100000), lumOff = Math.round(MATRIX_BACKGROUND_LIGHTEN * 100000);
  return { fill: { slot: 'accent1', hex: primary }, line: { slot: 'bg1', hex: background }, text: onPrimary, background: { slot: 'accent1', hex: lighten(primary, { lumMod, lumOff }), lumMod, lumOff } };
}

/**
 * SH-09's safe domain for live SmartArt, from the PowerPoint COM sweep (docs/smartart.md): the instances of an arrangement for which
 * PowerPoint laid out every node within 0.1 pt of core's rectangle, at core's font size, with no visible difference in the shapes, and drew
 * the SmartArt as it draws OPF's native export of the same slide (SH-07's thresholds). An instance outside it is exported as native shapes
 * (`smartArt: "shapes"`) with the reason.
 */
export const SMART_ART_DOMAIN = Object.freeze({
  /** Entries: a pyramid of 1 to 5 levels (6 to 8 never fitted the list's role size in the compared frames), a matrix of 1 to 4 quadrants. */
  count: Object.freeze({ pyramid: 5, matrix: 4 }) as Readonly<Record<Arrangement, number>>,
  /** The frame's width over its height, per arrangement: the range the 16:9, 4:3 and 1:1 slides gave, with a small margin. */
  aspect: Object.freeze({ pyramid: Object.freeze({ min: 1.1, max: 2.3 }), matrix: Object.freeze({ min: .8, max: 1.2 }) }) as Readonly<Record<Arrangement, { min: number; max: number }>>,
  /** The most lines one entry may wrap to in its node, and in all its entries (a line drawn by PowerPoint's wrap can sit up to 1 px from core's). */
  lines: 2,
  totalLines: 6,
  /**
   * The room a line break keeps: an entry's breaks must be the same when its text rectangle is this share narrower or wider (composeSlide
   * fits it at both), so PowerPoint, which measures its own fonts, breaks the same lines.
   */
  slack: .04,
});

/** The facts of one composed arrangement the domain is checked on (ComposedArrangement.smartArt, the frame and the text). */
export interface SmartArtCandidate {
  kind: Arrangement;
  count: number;
  frame: Box;
  /** Per entry: the lines it wraps to, and whether its breaks hold within SMART_ART_DOMAIN.slack of its width. */
  nodes: { lines: number; stable: boolean }[];
  /** A right-to-left deck or entry. */
  rtl: boolean;
  /** Text in a script other than Latin (the comparison found Japanese text placed several pixels off in PowerPoint's SmartArt). */
  script?: 'cjk' | 'other';
}

/**
 * Whether PowerPoint lays an arrangement out as the preview draws it (SMART_ART_DOMAIN): `undefined` when it does, else the reason it
 * falls back to native shapes, for the export's `pptx/smartart-unavailable` finding.
 */
export function smartArtUnavailable(candidate: SmartArtCandidate): string | undefined {
  const { kind, count, frame, nodes } = candidate, domain = SMART_ART_DOMAIN;
  if (count < 1 || count > domain.count[kind]) return `a ${kind} of ${count} entries is outside the compared 1 to ${domain.count[kind]}`;
  const aspect = frame.width / frame.height, range = domain.aspect[kind];
  if (!(aspect >= range.min - 1e-6 && aspect <= range.max + 1e-6)) return `its frame's proportions (${aspect.toFixed(2)} : 1) are outside the compared ${range.min} to ${range.max}`;
  if (candidate.rtl) return "right-to-left text sits off center in PowerPoint's SmartArt";
  if (candidate.script === 'cjk') return "Chinese and Japanese text sits several pixels off in PowerPoint's SmartArt";
  if (candidate.script === 'other') return 'its text uses a script the PowerPoint comparison did not cover';
  for (const [index, node] of nodes.entries()) {
    if (node.lines > domain.lines) return `entry ${index + 1} wraps to ${node.lines} lines (at most ${domain.lines} were compared)`;
    if (!node.stable) return `entry ${index + 1} wraps too close to its node's width for PowerPoint to break the same lines`;
  }
  const total = nodes.reduce((sum, node) => sum + node.lines, 0);
  if (total > domain.totalLines) return `its entries wrap to ${total} lines in all (at most ${domain.totalLines} matched PowerPoint)`;
  return undefined;
}
