/**
 * SH-17: the linear arrangements of a layout region (`arrangement: "chevrons" | "flow" | "vertical-flow"`), next to SH-09's pyramid and
 * matrix (arrangements.ts).
 *
 * A lone list of one level in such a region is drawn as a process diagram: a row of chevrons, a row of boxes with arrows between them,
 * or a column of boxes with arrows between them. The first design is PowerPoint's own geometry for its Basic Chevron Process (`chevron1`),
 * Basic Process (`process1`) and Vertical Process (`process2`) SmartArt layouts, measured through COM (SH-17 sweep, 2026-11-06), so the
 * PPTX export can write the arrangement as live SmartArt that PowerPoint lays out exactly as the preview draws it. PowerPoint fits these
 * layouts with a binary search on one scale, so a node's size is not the closed form W / (0.9 n + 0.1) but the search's last fitting
 * step: a share of the frame that depends only on the node count (SMART_ART_SCALES, the same for every frame the sweep measured, to
 * 0.0001 pt).
 *
 * - chevrons (Basic Chevron Process): n chevrons of width w = s(n) W, height min(0.4 w, H), each 0.9 w after the last (the point of one
 *   in the notch of the next), centered in the frame. The chevron is DrawingML's `chevron` at its default adjustment (its point 0.5 of
 *   its height deep); PowerPoint sets the text in the chevron's own text rectangle (between the notch and the point) with a margin of
 *   0.315 em at the start and 0.105 em on the other sides. With one chevron in a frame less than 0.4 times as tall as wide, w is
 *   1023/1024 W and the height is the frame's.
 * - flow (Basic Process): n rounded rectangles of width w = s(n) W, height min(0.6 w, H), each 1.4 w after the last, centered, with a
 *   right arrow between two (0.212 w long, 0.248 w tall, 0.1 w after the box before it, on the frame's middle). A box is DrawingML's
 *   `roundRect` at adjustment 10000; its text is set in the rounded rectangle's own text rectangle with a margin of 0.3 em. One box in a
 *   frame less than 0.6 times as tall as wide is 1023/1024 W wide and as tall as the frame.
 * - vertical-flow (Vertical Process): n rounded rectangles of height h = s(n) H, width min(1.8 h, W), each 1.5 h below the last,
 *   centered, with a down arrow between two (a right arrow turned 90 degrees, 0.45 h wide and 0.375 h long, in the middle of the gap).
 *   One box in a frame less than 1.8 times as wide as tall is 1023/1024 H tall and as wide as the frame.
 *
 * Every arrow is DrawingML's `rightArrow` (stem 0.6 of its height, head at its default length), turned by `rotation` about its center.
 *
 * Where PowerPoint's design does not hold the entries at the list's size, or the instance lies outside the SmartArt domain, OPF draws its
 * own design of the arrangement (chevronRow, flowRow, flowColumn), filling the region; a right-to-left deck mirrors both.
 */
import type {ArrangementNode} from './arrangements.js';

interface Box { x: number; y: number; width: number; height: number }

/** SH-17's arrangements. */
export const LINEAR_ARRANGEMENTS = ['chevrons', 'flow', 'vertical-flow'] as const;
export type LinearArrangement = typeof LINEAR_ARRANGEMENTS[number];
export const isLinearArrangement = (kind: string): kind is LinearArrangement => (LINEAR_ARRANGEMENTS as readonly string[]).includes(kind);

/**
 * PowerPoint's scale for n nodes (index n - 1): a node's width over the frame's width (chevrons, flow) or its height over the frame's
 * height (vertical-flow), as PowerPoint's binary search leaves it (multiples of 1/8192). Measured for 1 to 10 nodes in 20 frames each.
 */
export const SMART_ART_SCALES: Readonly<Record<LinearArrangement, readonly number[]>> = Object.freeze({
  chevrons: Object.freeze([1024, 538, 365.5, 276.5, 222.5, 186, 160, 140.25, 124.875, 112.5].map(value => value / 1024)),
  flow: Object.freeze([1024, 426.5, 269, 196.75, 155, 128, 108.875, 94.75, 83.875, 75.25].map(value => value / 1024)),
  'vertical-flow': Object.freeze([1024, 409.5, 256, 186, 146.25, 120.375, 102.375, 89, 78.75, 70.5].map(value => value / 1024)),
});
/** One node squeezed by the frame's other side is this share of the frame (PowerPoint's search stops a step short of 1). */
const SQUEEZED = 1023 / 1024;
/** PowerPoint's proportions: a chevron's height over its width and its step, a box's height over its width and its step, a vertical box's. */
export const CHEVRON_HEIGHT = .4, CHEVRON_STEP = .9, FLOW_HEIGHT = .6, FLOW_STEP = 1.4, VERTICAL_FLOW_WIDTH = 1.8, VERTICAL_FLOW_STEP = 1.5;
/** DrawingML's chevron default adjustment (the point's depth over the smaller side) and a process box's rounded corner. */
export const CHEVRON_ADJUST = 50000, FLOW_ROUND_ADJUST = 10000;
/** A rightArrow's stem (adj1) and head (adj2) adjustments, PowerPoint's for both process layouts. */
export const ARROW_ADJUST: readonly [number, number] = Object.freeze([60000, 50000] as const);
/**
 * The text margins of a node (left, top, right, bottom), as shares of its font size: a chevron's 0.315 em at its start and 0.105 em
 * elsewhere, a process box's 0.3 em on every side.
 */
export const LINEAR_TEXT_MARGINS: Readonly<Record<LinearArrangement, readonly [number, number, number, number]>> = Object.freeze({
  chevrons: Object.freeze([.315, .105, .105, .105] as const),
  flow: Object.freeze([.3, .3, .3, .3] as const),
  'vertical-flow': Object.freeze([.3, .3, .3, .3] as const),
});
/** The most nodes PowerPoint's scale is known for. */
export const LINEAR_SCALE_MAX = 10;

/** An arrow between two nodes: a DrawingML rightArrow of `box` (before rotation), turned `rotation` degrees about its center. */
export interface ArrangementArrow {
  /** 0-based: the arrow after node `index`. */
  index: number;
  box: Box;
  /** Degrees clockwise: 0 points right, 90 down, 180 left. */
  rotation: number;
  /** The rightArrow's adj1 (stem) and adj2 (head) of 100000. */
  adjust: readonly [number, number];
  /** Its outline, turned, in the units of `box`. */
  points: [number, number][];
}

const round = (value: number) => Math.round(value * 1000) / 1000;
const roundBox = (box: Box): Box => ({x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height)});
const roundPoints = (points: [number, number][]) => points.map(([x, y]) => [round(x), round(y)] as [number, number]);
/** DrawingML roundRect's text rectangle is inset by this share of its corner radius (1 - cos 45°). */
const ROUND_RECT_TEXT_INSET = .29289;

/** PowerPoint's scale for `count` nodes; beyond the measured table, the closed form (no instance there is live SmartArt). */
function scaleOf(kind: LinearArrangement, count: number, squeezed: boolean): number {
  if (count === 1 && squeezed) return SQUEEZED;
  const table = SMART_ART_SCALES[kind];
  if (count <= table.length) return table[count - 1]!;
  return kind === 'chevrons' ? 1 / (CHEVRON_STEP * count + 1 - CHEVRON_STEP) : kind === 'flow' ? 1 / (FLOW_STEP * count + 1 - FLOW_STEP) : 1 / (VERTICAL_FLOW_STEP * count + 1 - VERTICAL_FLOW_STEP);
}

/** A chevron node of `box` whose point is `depth` deep (DrawingML chevron), pointing right, or left when `flip`. */
function chevronNode(index: number, box: Box, depth: number, flip: boolean): ArrangementNode {
  const {x, y, width: w, height: h} = box, d = Math.min(depth, w / 2, Math.min(w, h)), ss = Math.min(w, h);
  const right: [number, number][] = [[x, y], [x + w - d, y], [x + w, y + h / 2], [x + w - d, y + h], [x, y + h], [x + d, y + h / 2]];
  const points = flip ? right.map(([px, py]) => [2 * x + w - px, py] as [number, number]) : right;
  return {index, box: roundBox(box), preset: 'chevron', adjust: Math.round(d / ss * 100000), points: roundPoints(points),
    textBox: roundBox({x: x + d, y, width: w - 2 * d, height: h}), ...(flip ? {flip: true as const} : {})};
}

/** A rounded rectangle node of `box` with the corner `adjust` of 100000 of its smaller side; its text in its own text rectangle. */
function boxNode(index: number, box: Box, adjust: number): ArrangementNode {
  const radius = Math.min(box.width, box.height) * adjust / 100000, inset = ROUND_RECT_TEXT_INSET * radius;
  return {index, box: roundBox(box), preset: 'roundRect', adjust, radius: round(radius),
    textBox: roundBox({x: box.x + inset, y: box.y + inset, width: box.width - 2 * inset, height: box.height - 2 * inset})};
}

/** The outline of a DrawingML rightArrow of `box` turned `rotation` degrees about its center (adj1 the stem, adj2 the head). */
export function rightArrowPoints(box: Box, rotation: number, [adj1, adj2]: readonly [number, number]): [number, number][] {
  const {x, y, width: w, height: h} = box, ss = Math.min(w, h), a1 = Math.min(Math.max(adj1, 0), 100000), a2 = Math.min(Math.max(adj2, 0), 100000 * w / ss);
  const head = x + w - ss * a2 / 100000, half = h * a1 / 200000, middle = y + h / 2;
  const points: [number, number][] = [[x, middle - half], [head, middle - half], [head, y], [x + w, middle], [head, y + h], [head, middle + half], [x, middle + half]];
  const angle = rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle), cx = x + w / 2, cy = y + h / 2;
  return roundPoints(points.map(([px, py]) => [cx + (px - cx) * cos - (py - cy) * sin, cy + (px - cx) * sin + (py - cy) * cos]));
}

function arrow(index: number, box: Box, rotation: number): ArrangementArrow {
  return {index, box: roundBox(box), rotation, adjust: ARROW_ADJUST, points: rightArrowPoints(box, rotation, ARROW_ADJUST)};
}

/** A node or arrow mirrored across the frame's vertical axis (a right-to-left deck): chevrons point left, arrows turn to 180 degrees. */
function mirrorBox(box: Box, frame: Box): Box { return {...box, x: 2 * frame.x + frame.width - box.x - box.width}; }

/** The geometry of one linear arrangement: its nodes and the arrows between them. */
export interface LinearGeometry { nodes: ArrangementNode[]; arrows: ArrangementArrow[] }

/** PowerPoint's Basic Chevron Process of `count` chevrons in `frame` (mirrored, pointing left, when `rtl`). */
export function chevronNodes(frame: Box, count: number, rtl = false): LinearGeometry {
  const n = Math.max(1, Math.floor(count)), w = scaleOf('chevrons', n, CHEVRON_HEIGHT * frame.width > frame.height) * frame.width;
  const h = Math.min(CHEVRON_HEIGHT * w, frame.height), x0 = frame.x + (frame.width - w * (CHEVRON_STEP * n + 1 - CHEVRON_STEP)) / 2, y = frame.y + (frame.height - h) / 2;
  const nodes = Array.from({length: n}, (_, index) => {
    const box = {x: x0 + CHEVRON_STEP * w * index, y, width: w, height: h};
    return chevronNode(index, rtl ? mirrorBox(box, frame) : box, CHEVRON_ADJUST / 100000 * Math.min(w, h), rtl);
  });
  return {nodes, arrows: []};
}

/** PowerPoint's Basic Process of `count` boxes in `frame`, with an arrow between two (mirrored when `rtl`). */
export function flowNodes(frame: Box, count: number, rtl = false): LinearGeometry {
  const n = Math.max(1, Math.floor(count)), w = scaleOf('flow', n, FLOW_HEIGHT * frame.width > frame.height) * frame.width;
  const h = Math.min(FLOW_HEIGHT * w, frame.height), x0 = frame.x + (frame.width - w * (FLOW_STEP * n + 1 - FLOW_STEP)) / 2, y = frame.y + (frame.height - h) / 2;
  const place = (box: Box) => rtl ? mirrorBox(box, frame) : box;
  const nodes = Array.from({length: n}, (_, index) => boxNode(index, place({x: x0 + FLOW_STEP * w * index, y, width: w, height: h}), FLOW_ROUND_ADJUST));
  const arrows = Array.from({length: n - 1}, (_, index) => arrow(index, place({x: x0 + FLOW_STEP * w * index + 1.1 * w, y: frame.y + frame.height / 2 - .124 * w, width: .212 * w, height: .248 * w}), rtl ? 180 : 0));
  return {nodes, arrows};
}

/** PowerPoint's Vertical Process of `count` boxes in `frame`, with a down arrow between two. */
export function verticalFlowNodes(frame: Box, count: number): LinearGeometry {
  const n = Math.max(1, Math.floor(count)), h = scaleOf('vertical-flow', n, VERTICAL_FLOW_WIDTH * frame.height > frame.width) * frame.height;
  const w = Math.min(VERTICAL_FLOW_WIDTH * h, frame.width), y0 = frame.y + (frame.height - h * (VERTICAL_FLOW_STEP * n + 1 - VERTICAL_FLOW_STEP)) / 2, x = frame.x + (frame.width - w) / 2;
  const nodes = Array.from({length: n}, (_, index) => boxNode(index, {x, y: y0 + VERTICAL_FLOW_STEP * h * index, width: w, height: h}, FLOW_ROUND_ADJUST));
  const arrows = Array.from({length: n - 1}, (_, index) => arrow(index, {x: frame.x + frame.width / 2 - .1875 * h, y: y0 + VERTICAL_FLOW_STEP * h * index + 1.025 * h, width: .375 * h, height: .45 * h}, 90));
  return {nodes, arrows};
}

/** PowerPoint's geometry of a linear arrangement in its SmartArt frame. */
export function linearNodes(kind: LinearArrangement, frame: Box, count: number, rtl = false): LinearGeometry {
  return kind === 'chevrons' ? chevronNodes(frame, count, rtl) : kind === 'flow' ? flowNodes(frame, count, rtl) : verticalFlowNodes(frame, count);
}

/** The most rows (chevrons, flow) or columns (vertical flow) OPF's own design wraps its entries into. */
export const OPF_LINES_MAX = 4;
/** OPF's flows: an arrow is PowerPoint's (0.212 of a box's width long, 0.248 thick), in a room of 0.4 of a box's width between two. */
export const OPF_ARROW_LENGTH = .212, OPF_ARROW_THICKNESS = .248, OPF_ARROW_ROOM = .4;
/** OPF's vertical flow: PowerPoint's proportions too, an arrow 0.375 of a box's height long and 0.45 wide, in a room of 0.5 of its height. */
export const OPF_COLUMN_ARROW_LENGTH = .375, OPF_COLUMN_ARROW_THICKNESS = .45, OPF_COLUMN_ROOM = .5;
/** OPF's chevrons: a chevron's point at most 0.2 of its width deep (half its height, as PowerPoint's, when shorter), each 0.9 widths after the last. */
export const OPF_CHEVRON_DEPTH = .2;
/**
 * The height OPF gives a node: at least PowerPoint's proportion (a chevron 0.4 of its width, a box 0.6, a vertical box 1/1.8 of its
 * width) and the text it holds with its margins, at most the room: a chevron 0.6 of its width, a box as tall as wide, a vertical box 0.6.
 */
const OPF_LEAST = Object.freeze({ chevrons: .4, flow: .6, 'vertical-flow': 1 / 1.8 }), OPF_MOST = Object.freeze({ chevrons: .6, flow: 1, 'vertical-flow': .6 });
/** DrawingML roundRect at FLOW_ROUND_ADJUST insets its text by this share of its smaller side on every side. */
const BOX_TEXT_INSET = ROUND_RECT_TEXT_INSET * FLOW_ROUND_ADJUST / 100000;

/** Entries split into `lines` lines in reading order, as evenly as possible, the longer lines first. */
function split(count: number, lines: number): number[] {
  return Array.from({ length: lines }, (_, line) => Math.floor(count / lines) + (line < count % lines ? 1 : 0));
}

/**
 * OPF's own design of a linear arrangement in `area`, drawn where PowerPoint's does not hold the entries (or lies outside the SmartArt
 * domain), in the deck's paint and PowerPoint's proportions, so the two read as one family. The entries go into `lines` rows (chevrons,
 * flow) or columns (vertical flow), as evenly as possible; every line spans the area (a line of fewer entries widens them, a column of
 * fewer lengthens them), and the block is centered in the area.
 *
 * - chevrons: each row a run of chevrons left to right, 0.9 widths apart, the point at most 0.2 of a width deep; a row breaks after a
 *   chevron's point and the next row starts again at the left.
 * - flow: boxes 0.4 of a width apart with PowerPoint's arrow in each room; the rows snake: the second runs right to left under the first,
 *   joined by a down arrow at the end where the first stops, and so on.
 * - vertical flow: boxes half a height apart with a down arrow in each room; the columns snake the same way (the second runs bottom to
 *   top, joined by a right arrow at the bottom).
 *
 * `need` is the height the fullest node's text takes with its margins, once composition has sized the text in the tallest geometry
 * (`need` absent): each node is then that tall, or PowerPoint's proportion when that is taller, at most the room. A right-to-left deck
 * mirrors the design. Undefined when the area cannot hold it.
 */
export function linearDesign(kind: LinearArrangement, area: Box, count: number, gap: number, rtl = false, lines = 1, need?: number): LinearGeometry | undefined {
  const n = Math.max(1, Math.floor(count)), wrap = Math.max(1, Math.min(Math.floor(lines), n)), counts = split(n, wrap), most = counts[0]!;
  const nodes: ArrangementNode[] = [], arrows: ArrangementArrow[] = [];
  const place = (box: Box) => rtl ? mirrorBox(box, area) : box, turn = (rotation: number) => rtl ? (rotation === 0 ? 180 : rotation === 180 ? 0 : rotation) : rotation;
  if (kind === 'vertical-flow') {
    // Columns two gaps apart, which hold the right arrow from one column to the next; each box half its height from the next.
    const between = 2 * gap, width = (area.width - (wrap - 1) * between) / wrap;
    if (width <= 0) return undefined;
    const tallest = Math.min(area.height / (most + OPF_COLUMN_ROOM * (most - 1)), OPF_MOST['vertical-flow'] * width), least = Math.min(tallest, OPF_LEAST['vertical-flow'] * width);
    const h = need === undefined ? tallest : Math.min(tallest, Math.max(least, need / (1 - 2 * BOX_TEXT_INSET))), room = OPF_COLUMN_ROOM * h;
    const span = most * h + (most - 1) * room, y0 = area.y + (area.height - span) / 2, length = OPF_COLUMN_ARROW_LENGTH * h, thick = OPF_COLUMN_ARROW_THICKNESS * h;
    let entry = 0;
    counts.forEach((k, column) => {
      const own = (span - (k - 1) * room) / k, x = area.x + column * (width + between), up = column % 2 === 1;
      for (let j = 0; j < k; j++) {
        const slot = up ? k - 1 - j : j, y = y0 + slot * (own + room);
        nodes.push(boxNode(entry + j, place({ x, y, width, height: own }), FLOW_ROUND_ADJUST));
        if (j < k - 1) {
          // The arrow in the room after this box, pointing down (up in a column that runs bottom to top).
          const cy = up ? y - room / 2 : y + own + room / 2;
          arrows.push(arrow(entry + j, place({ x: x + width / 2 - length / 2, y: cy - thick / 2, width: length, height: thick }), up ? 270 : 90));
        }
      }
      if (column < wrap - 1) {
        // A right arrow from this column's last box to the next column's first, at the end where this column stops.
        const next = counts[column + 1]!, end = Math.min(own, (span - (next - 1) * room) / next);
        const cy = up ? y0 + end / 2 : y0 + span - end / 2, across = Math.min(length, .8 * between), cx = x + width + between / 2;
        arrows.push(arrow(entry + k - 1, place({ x: cx - across / 2, y: cy - thick / 2, width: across, height: thick }), turn(0)));
      }
      entry += k;
    });
    return { nodes, arrows };
  }
  // Rows: chevrons 0.9 widths apart, boxes 0.4 widths apart; the width of a full row's node sets the arrows and the rooms of every row.
  const chevrons = kind === 'chevrons', full = chevrons ? area.width / (CHEVRON_STEP * most + 1 - CHEVRON_STEP) : area.width / (most + OPF_ARROW_ROOM * (most - 1));
  const room = OPF_ARROW_ROOM * full, rowGap = chevrons ? gap : room;
  const band = (area.height - (wrap - 1) * rowGap) / wrap, tallest = Math.min(band, OPF_MOST[kind] * full), least = Math.min(tallest, OPF_LEAST[kind] * full);
  if (tallest <= 0) return undefined;
  const h = need === undefined ? tallest : Math.min(tallest, Math.max(least, chevrons ? need : need / (1 - 2 * BOX_TEXT_INSET)));
  const y0 = area.y + (area.height - wrap * h - (wrap - 1) * rowGap) / 2, length = OPF_ARROW_LENGTH * full, thick = OPF_ARROW_THICKNESS * full;
  let entry = 0;
  counts.forEach((k, row) => {
    const y = y0 + row * (h + rowGap), back = !chevrons && row % 2 === 1;
    const w = chevrons ? area.width / (CHEVRON_STEP * k + 1 - CHEVRON_STEP) : (area.width - (k - 1) * room) / k;
    const left = (slot: number) => area.x + slot * (chevrons ? CHEVRON_STEP * w : w + room);
    for (let j = 0; j < k; j++) {
      const slot = back ? k - 1 - j : j, box = { x: left(slot), y, width: w, height: h };
      nodes.push(chevrons ? chevronNode(entry + j, place(box), Math.min(h / 2, OPF_CHEVRON_DEPTH * w), rtl) : boxNode(entry + j, place(box), FLOW_ROUND_ADJUST));
      if (!chevrons && j < k - 1) {
        // The arrow in the room between this box and the next, pointing the way the row runs.
        const x = (back ? left(slot - 1) : left(slot)) + w + (room - length) / 2;
        arrows.push(arrow(entry + j, place({ x, y: y + h / 2 - thick / 2, width: length, height: thick }), turn(back ? 180 : 0)));
      }
    }
    if (!chevrons && row < wrap - 1) {
      // A down arrow from this row's last box to the next row's first, at the end where this row stops (the next row runs back).
      const next = counts[row + 1]!, end = Math.min(w, (area.width - (next - 1) * room) / next);
      const cx = back ? area.x + end / 2 : area.x + area.width - end / 2, cy = y + h + rowGap / 2, down = Math.min(length, .8 * rowGap);
      arrows.push(arrow(entry + k - 1, place({ x: cx - down / 2, y: cy - thick / 2, width: down, height: thick }), 90));
    }
    entry += k;
  });
  return { nodes, arrows };
}

/** A node's text margins (left, top, right, bottom) as shares of its size: a chevron's larger margin is at its start (the right when `rtl`). */
export function linearMargins(kind: LinearArrangement, rtl: boolean): [number, number, number, number] {
  const [left, top, right, bottom] = LINEAR_TEXT_MARGINS[kind];
  return rtl ? [right, top, left, bottom] : [left, top, right, bottom];
}
