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
export const ARRANGEMENTS = ['pyramid', 'matrix', 'cycle'] as const;
export type Arrangement = typeof ARRANGEMENTS[number];
/** The most entries each arrangement draws as its own shapes: a pyramid's levels, a matrix's quadrants (other counts draw cards). */
export const ARRANGEMENT_MAX: Readonly<Record<Arrangement, number>> = Object.freeze({ pyramid: 8, matrix: 4, cycle: 8 });
/** A matrix draws its quadrants for exactly this many entries; other counts draw a grid of cards (at most ARRANGEMENT_CARDS_MAX). */
export const MATRIX_ENTRIES = 4, ARRANGEMENT_CARDS_MAX = 8;
/** A card's text inset, as a share of the font size. */
export const CARD_TEXT_MARGIN = .6;
/** PowerPoint's SmartArt layout each arrangement matches (the `loTypeId` of a live SmartArt export). */
export const SMART_ART_LAYOUTS: Readonly<Record<Arrangement, string>> = Object.freeze({
  pyramid: 'urn:microsoft.com/office/officeart/2005/8/layout/pyramid1',
  matrix: 'urn:microsoft.com/office/officeart/2005/8/layout/matrix3',
  cycle: 'urn:microsoft.com/office/officeart/2005/8/layout/cycle2',
});
/** A node's text inset on every side, as a share of its font size (PowerPoint's: 0.1 em in a pyramid level or a cycle's circle, 0.3 em in a quadrant). */
export const ARRANGEMENT_TEXT_MARGIN: Readonly<Record<Arrangement, number>> = Object.freeze({ pyramid: .1, matrix: .3, cycle: .1 });
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
  /** DrawingML preset: `trapezoid` for a pyramid level (the apex too, as PowerPoint writes it), `roundRect` for a quadrant, `ellipse` for a cycle's circle. */
  preset: 'trapezoid' | 'roundRect' | 'ellipse';
  /** The preset's `adj` (of 100000): a trapezoid's inset over its smaller side, a rounded rectangle's corner. */
  adjust: number;
  /** The outline as a polygon (a pyramid level), in the same units as `box`; absent for a rounded rectangle (`radius`). */
  points?: [number, number][];
  /** A rounded rectangle's corner radius. */
  radius?: number;
  /** The rectangle the node's text is set in (before the text margin): PowerPoint's in the SmartArt design. */
  textBox: Box;
  /** OPF's pyramid: the text sits beside its level, outside the shape, so the shape's outline does not bound it. */
  beside?: true;
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

/** A rounded rectangle node of `box` with corner `radius`, its text in the rectangle's own text rectangle (DrawingML roundRect). */
function roundNode(index: number, box: Box, radius: number): ArrangementNode {
  const r = Math.min(radius, Math.min(box.width, box.height) / 2), inset = ROUND_RECT_TEXT_INSET * r;
  return { index, box: roundBox(box), preset: 'roundRect', adjust: Math.round(r / Math.min(box.width, box.height) * 100000), radius: round(r),
    textBox: roundBox({ x: box.x + inset, y: box.y + inset, width: box.width - 2 * inset, height: box.height - 2 * inset }) };
}

/** OPF's pyramid, at its start: the share of the area's width the steps take, at most this many times its height. */
export const PYRAMID_STEPS_SHARE = .4, PYRAMID_STEPS_ASPECT = 1.6;
/**
 * OPF's own pyramid design, drawn where PowerPoint's does not hold the entries at the list's size: the levels as a stepped pyramid of
 * rounded bars at the start of `area` (level i of n is i/n of the steps' width, centered on one axis, `gap` apart), and each entry's
 * text beside its level, in one column across the rest of the area, vertically centered on its level.
 */
export function pyramidSteps(area: Box, count: number, gap: number, radius: number): ArrangementNode[] {
  const n = Math.max(1, Math.floor(count)), width = Math.min(area.width * PYRAMID_STEPS_SHARE, area.height * PYRAMID_STEPS_ASPECT);
  const height = (area.height - (n - 1) * gap) / n, axis = area.x + width / 2, column = area.x + width + 2 * gap;
  return Array.from({ length: n }, (_, index) => {
    const w = width * (index + 1) / n, y = area.y + index * (height + gap);
    return { ...roundNode(index, { x: axis - w / 2, y, width: w, height }, radius), textBox: roundBox({ x: column, y, width: area.x + area.width - column, height }), beside: true as const };
  });
}

/** OPF's own matrix design: four rounded quadrants filling `area` two by two, `gap` apart (rectangular where the area is). */
export function matrixQuadrants(area: Box, gap: number): ArrangementNode[] {
  const width = (area.width - gap) / 2, height = (area.height - gap) / 2;
  return [0, 1, 2, 3].map(index => roundNode(index, { x: area.x + (index % 2) * (width + gap), y: area.y + Math.floor(index / 2) * (height + gap), width, height },
    Math.min(width, height) * ROUND_RECT_ADJUST / 100000));
}

/**
 * The grid of cards a matrix of other than four entries draws: `columns` cards a row (core cardGridColumns), every row full but the
 * last, whose cards keep the others' width and are centered; the cards fill `area`, `gap` apart, with corner `radius`.
 */
export function cardNodes(area: Box, count: number, columns: number, gap: number, radius: number): ArrangementNode[] {
  const rows = Math.ceil(count / columns), width = (area.width - (columns - 1) * gap) / columns, height = (area.height - (rows - 1) * gap) / rows;
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns), inRow = row === rows - 1 ? count - row * columns : columns, column = index - row * columns;
    const start = area.x + (area.width - (inRow * width + (inRow - 1) * gap)) / 2;
    return roundNode(index, { x: start + column * (width + gap), y: area.y + row * (height + gap), width, height }, radius);
  });
}

/**
 * The width of a node's shape across a horizontal line `y` (a pyramid level narrows toward its top edge); a quadrant's full width,
 * less its rounded corners where `y` is within a radius of its top or bottom edge.
 */
export function nodeWidthAt(node: ArrangementNode, y: number): number {
  const { box } = node, t = Math.min(1, Math.max(0, (y - box.y) / box.height));
  if (node.preset === 'ellipse') return ellipseWidthAt(box, y);
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
/** What an arrangement is painted with: its nodes' fill and outline, their text, the matrix's diamond and a cycle's arrows. */
export interface ArrangementPaint { fill: ArrangementColor; line: ArrangementColor; text: ArrangementColor; background: ArrangementColor; arrow: ArrangementColor }

/**
 * The paint of an arrangement from the slide's resolved colors: the nodes in the primary color (`accent1`) outlined in the background
 * (`bg1`), their text in whichever of the background and the text color reads better on the primary, and the matrix's diamond the
 * primary lightened by MATRIX_BACKGROUND_LIGHTEN. `lighten(hex, lumMod, lumOff)` is DrawingML's luminance transform (core
 * applyColorTransform), so the preview and PowerPoint compute the same color.
 */
export function arrangementPaint(primary: string, background: string, text: string, contrast: (a: string, b: string) => number | undefined, lighten: (hex: string, transform: { lumMod: number; lumOff: number }) => string): ArrangementPaint {
  const onPrimary = (contrast(background, primary) ?? 0) >= (contrast(text, primary) ?? 0) ? { slot: 'bg1' as const, hex: background } : { slot: 'tx1' as const, hex: text };
  const lumMod = Math.round((1 - MATRIX_BACKGROUND_LIGHTEN) * 100000), lumOff = Math.round(MATRIX_BACKGROUND_LIGHTEN * 100000);
  return { fill: { slot: 'accent1', hex: primary }, line: { slot: 'bg1', hex: background }, text: onPrimary, background: { slot: 'accent1', hex: lighten(primary, { lumMod, lumOff }), lumMod, lumOff },
    arrow: cycleArrowColor(primary, lighten) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// SH-18: the cycle arrangement (`arrangement: "cycle"`): the entries as the steps of a loop, each one a node on a ring with an arrow to
// the next, and from the last back to the first.
//
// PowerPoint's design is its Basic Cycle SmartArt layout (cycle2), measured through COM (SH-18, 2026-11-06): PowerPoint lays it out from
// the frame alone (never from the text), and the layout is exactly proportional to the frame at a fixed proportion. OPF therefore sets the
// SmartArt frame to one proportion per entry count (cycleAspect: the cycle's own, a little wider so its height decides the size),
// centered in the region, and reproduces PowerPoint's geometry from the frame's width W (to 0.0001 pt in the sweep):
//
// - n circles (DrawingML `ellipse`) of diameter CYCLE_DIAMETER[n]·W (PowerPoint's size search: a ten-bit binary fraction of W);
// - their centers on a ring of radius CYCLE_RADIUS[n]·W, the first at the top and the others clockwise, 360/n degrees apart (two
//   entries: left and right); the ring is centered in the frame, an odd count's ring moved down so the circles' bounds are centered;
// - after each circle an arrow (DrawingML `rightArrow`, adj1 60000, adj2 50000) to the next circle, 0.3375 of a diameter thick: on
//   the line between the two centers, 0.53 of the gap between the circles long, starting 0.22 of the gap after the first circle and
//   turned to point along that line; two entries have two arrows, over and under the gap (CYCLE_TWO);
// - a circle's text rectangle is the ellipse's own (the inscribed square), inset by 0.1 of the font size.
//
// OPF's design (cycleRing), where PowerPoint's circles do not hold the entries at the list's size or the instance lies outside the
// SmartArt domain: rounded rectangles on an ellipse that fills the region, as large as the region lets them be with room for an arrow
// between neighbors, and the same arrows between them.

/** The proportion (width over height) of the frame a cycle of `count` entries takes in its region (PowerPoint's design). */
export function cycleAspect(count: number): number { return count === 2 ? 1.8 : 1.15; }
/** PowerPoint's circle diameter for 1 to 8 entries, as a share of the frame's width (at cycleAspect). */
export const CYCLE_DIAMETER: readonly number[] = Object.freeze([890 / 1024, 818 / 2048, 774 / 2048, 570 / 2048, 538 / 2048, 890 / 4096, 830 / 4096, 723 / 4096]);
/** PowerPoint's ring radius (the circles' centers) for 1 to 8 entries, as a share of the frame's width (at cycleAspect). */
export const CYCLE_RADIUS: readonly number[] = Object.freeze([0, .30020853, .32775022, .29551553, .3352411, .32594411, .35059968, .34594921]);
/** A cycle arrow: its thickness as a share of the circle's diameter; its length and its start as shares of the gap between two circles. */
export const CYCLE_ARROW = Object.freeze({ thickness: .3375, length: .53, start: .22 });
/** Two entries: each arrow's length and its center's distance from the line between the centers (shares of W), and its center's place along that line. */
export const CYCLE_TWO = Object.freeze({ length: .2491013, offset: .18876154, along: .48825813 });
/** DrawingML `rightArrow`'s adjustments in a cycle: the shaft 60% of the arrow's thickness, the head half of its smaller side. */
export const CYCLE_ARROW_ADJUST: readonly [number, number] = Object.freeze([60000, 50000] as const);
/** A cycle's arrows are the primary lightened by this share (DrawingML lumMod 1 - L, lumOff L). */
export const CYCLE_ARROW_LIGHTEN = .4;

/** One arrow of a cycle, after the node `index`: its unrotated box, its clockwise rotation in degrees and its outline as drawn. */
export interface ArrangementArrow {
  index: number;
  box: Box;
  rotation: number;
  /** DrawingML `rightArrow`'s adj1 and adj2. */
  adjust: readonly [number, number];
  /** The outline (seven points), turned about the box's center, in the same units as `box`. */
  points: [number, number][];
}

function cycleArrowColor(primary: string, lighten: (hex: string, transform: { lumMod: number; lumOff: number }) => string): ArrangementColor {
  const lumMod = Math.round((1 - CYCLE_ARROW_LIGHTEN) * 100000), lumOff = Math.round(CYCLE_ARROW_LIGHTEN * 100000);
  return { slot: 'accent1', hex: lighten(primary, { lumMod, lumOff }), lumMod, lumOff };
}

function ellipseWidthAt(box: Box, y: number): number {
  const b = box.height / 2, dy = (y - box.y - b) / b;
  return Math.abs(dy) >= 1 ? 0 : box.width * Math.sqrt(1 - dy * dy);
}

/** DrawingML `rightArrow` in `box` with `adjust`, turned `rotation` degrees clockwise about its center. */
export function rightArrowPoints(box: Box, rotation: number, adjust: readonly [number, number] = CYCLE_ARROW_ADJUST): [number, number][] {
  const { x, y, width: w, height: h } = box, ss = Math.min(w, h), a1 = Math.min(100000, Math.max(0, adjust[0])), a2 = Math.min(100000 * w / ss, Math.max(0, adjust[1]));
  const x1 = x + w - ss * a2 / 100000, dy = h * a1 / 200000, vc = y + h / 2;
  const outline: [number, number][] = [[x, vc - dy], [x1, vc - dy], [x1, y], [x + w, vc], [x1, y + h], [x1, vc + dy], [x, vc + dy]];
  const cx = x + w / 2, angle = rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  return outline.map(([px, py]) => [round(cx + (px - cx) * cos - (py - vc) * sin), round(vc + (px - cx) * sin + (py - vc) * cos)]);
}

function cycleArrow(index: number, cx: number, cy: number, length: number, thickness: number, rotation: number): ArrangementArrow {
  const box = { x: cx - length / 2, y: cy - thickness / 2, width: length, height: thickness }, turn = round(((rotation % 360) + 360) % 360);
  return { index, box: roundBox(box), rotation: turn, adjust: CYCLE_ARROW_ADJUST, points: rightArrowPoints(box, turn) };
}

/** Mirror a cycle about its frame's vertical axis (a right-to-left deck: the steps run counterclockwise). */
function mirrorCycle(frame: Box, nodes: ArrangementNode[], arrows: ArrangementArrow[]): { nodes: ArrangementNode[]; arrows: ArrangementArrow[] } {
  const axis = 2 * frame.x + frame.width, flip = (box: Box): Box => roundBox({ ...box, x: axis - box.x - box.width });
  return {
    nodes: nodes.map(node => ({ ...node, box: flip(node.box), textBox: flip(node.textBox) })),
    arrows: arrows.map(item => {
      const rotation = round(((180 - item.rotation) % 360 + 360) % 360), box = flip(item.box);
      return { ...item, box, rotation, points: rightArrowPoints(box, rotation, item.adjust) };
    }),
  };
}

/** The frame a cycle of `count` entries takes in `area`: the largest of cycleAspect's proportion, centered. */
export function cycleFrame(area: Box, count: number): Box {
  const aspect = cycleAspect(count), width = Math.min(area.width, aspect * area.height), height = width / aspect;
  return roundBox({ x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height });
}

/** The DrawingML ellipse's text rectangle: the square inscribed in the circle (`idx = wd2 · cos 45°`). */
function ellipseText(box: Box): Box {
  const inset = (1 - Math.SQRT1_2) / 2;
  return roundBox({ x: box.x + inset * box.width, y: box.y + inset * box.height, width: Math.SQRT1_2 * box.width, height: Math.SQRT1_2 * box.height });
}

/** PowerPoint's Basic Cycle of `count` entries (1 to 8) in `frame` (cycleFrame): the circles in entry order and the arrow after each. */
export function cycleNodes(frame: Box, count: number, rtl = false): { nodes: ArrangementNode[]; arrows: ArrangementArrow[] } {
  const n = Math.min(CYCLE_DIAMETER.length, Math.max(1, Math.floor(count))), W = frame.width, d = CYCLE_DIAMETER[n - 1]! * W, r = CYCLE_RADIUS[n - 1]! * W;
  const cx = frame.x + W / 2, cy = frame.y + frame.height / 2 + (n % 2 && n > 1 ? r * (1 - Math.cos(Math.PI / n)) / 2 : 0);
  const angle = (k: number) => n === 2 ? (k ? Math.PI / 2 : -Math.PI / 2) : 2 * Math.PI * k / n;
  const centers = Array.from({ length: n }, (_, k): [number, number] => n === 1 ? [cx, cy] : [cx + r * Math.sin(angle(k)), cy - r * Math.cos(angle(k))]);
  const nodes: ArrangementNode[] = centers.map(([x, y], index) => {
    const box = { x: x - d / 2, y: y - d / 2, width: d, height: d };
    return { index, box: roundBox(box), preset: 'ellipse' as const, adjust: 0, textBox: ellipseText(box) };
  });
  const arrows: ArrangementArrow[] = [], thickness = CYCLE_ARROW.thickness * d;
  if (n === 2) {
    const length = CYCLE_TWO.length * W, offset = CYCLE_TWO.offset * W, along = CYCLE_TWO.along * 2 * r, [p, q] = centers as [[number, number], [number, number]];
    arrows.push(cycleArrow(0, p[0] + along, p[1] - offset, length, thickness, 0), cycleArrow(1, q[0] - along, q[1] + offset, length, thickness, 180));
  } else if (n > 2) for (let k = 0; k < n; k++) {
    const [px, py] = centers[k]!, [qx, qy] = centers[(k + 1) % n]!, distance = Math.hypot(qx - px, qy - py), ux = (qx - px) / distance, uy = (qy - py) / distance;
    const gap = distance - d, length = CYCLE_ARROW.length * gap, at = d / 2 + CYCLE_ARROW.start * gap + length / 2;
    arrows.push(cycleArrow(k, px + ux * at, py + uy * at, length, thickness, Math.atan2(uy, ux) * 180 / Math.PI));
  }
  return rtl ? mirrorCycle(frame, nodes, arrows) : { nodes, arrows };
}

/** The text inset of OPF's cycle nodes, as a share of the font size. */
export const CYCLE_RING_MARGIN = .2;
/** OPF's cycle: a node at most this share of the area's width and of its height, and between these proportions (width over height). */
export const CYCLE_RING_NODE = Object.freeze({ width: .46, height: .42, maxAspect: 3, minAspect: 1.15 });

/**
 * OPF's own cycle design, drawn where PowerPoint's circles do not hold the entries: rounded rectangles (DrawingML roundRect at its
 * default corner) on an ellipse that fills `area`, the first at the top and the rest clockwise (two entries: left and right; one: in the
 * middle; two in a tall area: one above the other), each as large as the area lets every node be while neighbors keep room for an arrow between them (2 `gap`), and an arrow
 * from each to the next on the line between their centers, in the middle of the room between them.
 */
export function cycleRing(area: Box, count: number, gap: number, rtl = false): { nodes: ArrangementNode[]; arrows: ArrangementArrow[] } {
  const n = Math.max(1, Math.floor(count)), cx = area.x + area.width / 2, cy = area.y + area.height / 2, room = 2 * gap;
  const angle = (k: number) => n === 2 ? (k ? Math.PI / 2 : -Math.PI / 2) : 2 * Math.PI * k / n;
  const layout = (w: number, h: number) => {
    const a = Math.max(0, (area.width - w) / 2), b = Math.max(0, (area.height - h) / 2);
    return Array.from({ length: n }, (_, k): [number, number] => n === 1 ? [cx, cy] : [cx + a * Math.sin(angle(k)), cy - b * Math.cos(angle(k))]);
  };
  // The room between two node boxes `w` x `h` at these centers: the larger of the horizontal and the vertical room between them.
  const clear = (p: [number, number], q: [number, number], w: number, h: number) => Math.max(Math.abs(q[0] - p[0]) - w, Math.abs(q[1] - p[1]) - h);
  let best: { w: number; h: number } | undefined;
  if (n === 1) {
    const w = Math.min(area.width, 2.4 * area.height) * .8;
    best = { w, h: Math.min(area.height * .7, w / 1.6) };
  } else {
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const h = area.height * CYCLE_RING_NODE.height * (1 - i / steps * .8);
      for (let j = 0; j <= steps; j++) {
        const w = Math.min(area.width * CYCLE_RING_NODE.width * (1 - j / steps * .8), CYCLE_RING_NODE.maxAspect * h);
        if (w < CYCLE_RING_NODE.minAspect * h) break;
        const centers = layout(w, h);
        let fits = true;
        for (let k = 0; k < n && fits; k++) for (let m = k + 1; m < n && fits; m++) {
          const adjacent = m === k + 1 || (k === 0 && m === n - 1);
          if (clear(centers[k]!, centers[m]!, w, h) < (adjacent ? room : gap) - 1e-9) fits = false;
        }
        if (!fits) continue;
        if (!best || w * h > best.w * best.h) best = { w, h };
        break;
      }
    }
    best ??= { w: area.width / (n + 1), h: area.height / (n + 1) };
  }
  const { w, h } = best, centers = layout(w, h);
  const nodes = centers.map(([x, y], index) => roundNode(index, { x: x - w / 2, y: y - h / 2, width: w, height: h }, Math.min(w, h) * ROUND_RECT_ADJUST / 100000));
  const arrows: ArrangementArrow[] = [];
  if (n === 2) {
    // Two nodes side by side: one arrow over the middle of the room between them pointing right, one under it pointing back.
    const space = Math.abs(centers[1]![0] - centers[0]![0]) - w, length = .7 * space, thickness = Math.min(.8 * length, h / 3);
    arrows.push(cycleArrow(0, cx, cy - h / 4, length, thickness, 0), cycleArrow(1, cx, cy + h / 4, length, thickness, 180));
    if (area.height > area.width) return cycleTwoStacked(area, gap, rtl);
  } else if (n > 2) arrows.push(...cycleLinks(nodes));
  return rtl ? mirrorCycle(area, nodes, arrows) : { nodes, arrows };
}

/** Two entries in an area taller than wide: one above the other, an arrow down the right of the room between them and one back up its left. */
function cycleTwoStacked(area: Box, gap: number, rtl: boolean): { nodes: ArrangementNode[]; arrows: ArrangementArrow[] } {
  const room = Math.min(3 * gap, .3 * area.height), h = (area.height - room) / 2, w = Math.min(area.width, 2.4 * h), x = area.x + (area.width - w) / 2;
  const nodes = [0, 1].map(index => roundNode(index, { x, y: area.y + index * (h + room), width: w, height: h }, Math.min(w, h) * ROUND_RECT_ADJUST / 100000));
  const cx = area.x + area.width / 2, cy = area.y + h + room / 2, length = .7 * room, thickness = Math.min(.8 * length, w / 3);
  const arrows = [cycleArrow(0, cx + w / 4, cy, length, thickness, 90), cycleArrow(1, cx - w / 4, cy, length, thickness, 270)];
  return rtl ? mirrorCycle(area, nodes, arrows) : { nodes, arrows };
}

/** The arrows between consecutive nodes (the last to the first): one size, 60% of the least room on the line between two centers, at most a third of a node thick, each in the middle of its room. */
function cycleLinks(nodes: ArrangementNode[]): ArrangementArrow[] {
  const n = nodes.length, center = (node: ArrangementNode): [number, number] => [node.box.x + node.box.width / 2, node.box.y + node.box.height / 2];
  const exit = (node: ArrangementNode, ux: number, uy: number) => Math.min(Math.abs(ux) > 1e-9 ? node.box.width / 2 / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-9 ? node.box.height / 2 / Math.abs(uy) : Infinity);
  const links = nodes.map((node, k) => {
    const [px, py] = center(node), next = nodes[(k + 1) % n]!, [qx, qy] = center(next), distance = Math.hypot(qx - px, qy - py), ux = (qx - px) / distance, uy = (qy - py) / distance;
    const start = exit(node, ux, uy), space = distance - start - exit(next, ux, uy);
    return { px, py, ux, uy, at: start + space / 2, space };
  });
  const side = Math.min(...nodes.map(node => Math.min(node.box.width, node.box.height))), length = .6 * Math.min(...links.map(link => link.space)), thickness = Math.min(.8 * length, side / 3);
  return links.map((link, k) => cycleArrow(k, link.px + link.ux * link.at, link.py + link.uy * link.at, length, thickness, Math.atan2(link.uy, link.ux) * 180 / Math.PI));
}

/**
 * OPF's second cycle design, a loop of `rows` rows (columns in an area taller than wide) with exactly one node on every place of its
 * edge, so no place is left empty: two rows hold ceil(n/2) nodes left to right on top and the rest right to left below; three rows hold a
 * node at each end of the middle row too, the rest shared between the top and the bottom. A row of fewer nodes widens them, so every row
 * spans the area; the rows are one height. Neighbors keep room for an arrow (2 `gap`), and an arrow goes from each node to the next
 * (cycleLinks). In a tall area the loop is turned a quarter clockwise. Composition keeps whichever of the ring and the loops holds the
 * entries larger.
 */
export function cycleLoop(area: Box, count: number, gap: number, rtl = false, rows = 2): { nodes: ArrangementNode[]; arrows: ArrangementArrow[] } | undefined {
  const n = Math.floor(count), r = rows === 3 ? 3 : 2, sides = r === 3 ? 2 : 0;
  const top = Math.ceil((n - sides) / 2), bottom = n - sides - top;
  if (n < 3 || bottom < 1 || (r === 3 && top < 2)) return undefined;
  const tall = area.height > area.width, long = tall ? area.height : area.width, short = tall ? area.width : area.height;
  const room = Math.min(2 * gap, .2 * short / (r - 1)), h = (short - (r - 1) * room) / r;
  const width = (k: number) => (long - (k - 1) * room) / k, wTop = width(top), wBottom = width(bottom);
  if (h <= 0 || wTop <= 0 || wBottom <= 0) return undefined;
  // Clockwise from the top left, in the wide frame: [start along the long side, length, row].
  const cells: [number, number, number][] = [];
  for (let k = 0; k < top; k++) cells.push([k * (wTop + room), wTop, 0]);
  if (r === 3) cells.push([long - wTop, wTop, 1]);
  for (let k = bottom - 1; k >= 0; k--) cells.push([k * (wBottom + room), wBottom, r - 1]);
  if (r === 3) cells.push([0, wTop, 1]);
  const nodes = cells.map(([u, length, row], index) => {
    const v = row * (h + room);
    const box = tall ? { x: area.x + area.width - v - h, y: area.y + u, width: h, height: length } : { x: area.x + u, y: area.y + v, width: length, height: h };
    return roundNode(index, box, Math.min(box.width, box.height) * ROUND_RECT_ADJUST / 100000);
  });
  const arrows = cycleLinks(nodes);
  return rtl ? mirrorCycle(area, nodes, arrows) : { nodes, arrows };
}

/** SH-18: the SmartArt domain's cycle entries and frame proportions (a cycle's frame is always cycleAspect's). */
const CYCLE_DOMAIN_COUNT = 8;
const CYCLE_DOMAIN_ASPECT = Object.freeze({ min: 1.15, max: 1.8 });
/** A cycle's circles each hold their own entry, so the sweep's eight entries of one line and four of two (8 lines) all matched PowerPoint: two lines an entry is the only limit. */
export const CYCLE_DOMAIN_TOTAL_LINES = 16;

/**
 * SH-09's safe domain for live SmartArt, from the PowerPoint COM sweep (docs/smartart.md): the instances of an arrangement for which
 * PowerPoint laid out every node within 0.1 pt of core's rectangle, at core's font size, with no visible difference in the shapes, and drew
 * the SmartArt as it draws OPF's native export of the same slide (SH-07's thresholds). An instance outside it is exported as native shapes
 * (`smartArt: "shapes"`) with the reason.
 */
export const SMART_ART_DOMAIN = Object.freeze({
  /** Entries: a pyramid of 1 to 5 levels (6 to 8 never fitted the list's role size in the compared frames), a matrix of 1 to 4 quadrants. */
  count: Object.freeze({ pyramid: 5, matrix: 4, cycle: CYCLE_DOMAIN_COUNT }) as Readonly<Record<Arrangement, number>>,
  /** The frame's width over its height, per arrangement: the range the 16:9, 4:3 and 1:1 slides gave, with a small margin. */
  aspect: Object.freeze({ pyramid: Object.freeze({ min: 1.1, max: 2.3 }), matrix: Object.freeze({ min: .8, max: 1.2 }), cycle: CYCLE_DOMAIN_ASPECT }) as Readonly<Record<Arrangement, { min: number; max: number }>>,
  /** The most lines one entry may wrap to in its node, and in all its entries (a line drawn by PowerPoint's wrap can sit up to 1 px from core's). */
  lines: 2,
  totalLines: 6,
  /**
   * The room a line break keeps: an entry's breaks must be the same when its text rectangle is this share narrower or wider (composeSlide
   * fits it at both), so PowerPoint, which measures its own fonts, breaks the same lines.
   */
  slack: .04,
});

/**
 * The writing of an arrangement's entries, as the domain reads it: right to left (Arabic, Hebrew and the other right-to-left scripts),
 * Chinese or Japanese (`cjk`), another script than Latin (`other`), or Latin (no `script`).
 */
export function smartArtScript(texts: readonly string[]): { rtl: boolean; script?: 'cjk' | 'other' } {
  const text = texts.join('');
  const rtl = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u.test(text);
  if (/^[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]*$/u.test(text)) return { rtl };
  return { rtl, script: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text) ? 'cjk' : 'other' };
}

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
  // SH-18: PowerPoint's Basic Cycle was fitted at one frame proportion per count.
  if (kind === 'cycle' && Math.abs(aspect - cycleAspect(count)) > .002) return `its frame's proportions (${aspect.toFixed(2)} : 1) are not the ${cycleAspect(count)} : 1 PowerPoint's Basic Cycle was fitted at`;
  if (candidate.rtl) return "right-to-left text sits off center in PowerPoint's SmartArt";
  if (candidate.script === 'cjk') return "Chinese and Japanese text sits several pixels off in PowerPoint's SmartArt";
  if (candidate.script === 'other') return 'its text uses a script the PowerPoint comparison did not cover';
  for (const [index, node] of nodes.entries()) {
    if (node.lines > domain.lines) return `entry ${index + 1} wraps to ${node.lines} lines (at most ${domain.lines} were compared)`;
    if (!node.stable) return `entry ${index + 1} wraps too close to its node's width for PowerPoint to break the same lines`;
  }
  const total = nodes.reduce((sum, node) => sum + node.lines, 0);
  const most = kind === 'cycle' ? CYCLE_DOMAIN_TOTAL_LINES : domain.totalLines;
  if (total > most) return `its entries wrap to ${total} lines in all (at most ${most} matched PowerPoint)`;
  return undefined;
}
