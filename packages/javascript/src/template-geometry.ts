/**
 * Pure geometry of OPF 0.19 layout templates: the grid sequence of a flowing region, track sizing, the collapse of empty
 * areas and the column breaks of a long list. `composeSlide` measures content and calls these; nothing here measures text.
 */
import type { LayoutBox } from './composition.js';
import { layoutTemplate } from './layout-template.js';

/** How a region's blocks are arranged on one slide. */
export interface FlowShape {
  /** Columns of the full rows. */
  columns: number;
  rows: number;
  /** Blocks in each row, top to bottom; only the last row can be short. */
  perRow: number[];
}

/**
 * The `grid` flow by block count. In a landscape region: 1 fills it; 2 side by side; 3 in a row; 4 as 2 x 2; 5 as 3 + 2;
 * 6 as 3 x 2; 7 to 12 in four columns. In a portrait region (taller than wide) rows and columns swap: 2 and 3 stacked,
 * 4 as 2 x 2, 5 as 2 + 2 + 1, 6 as 2 x 3, 7 to 12 in three rows.
 */
export function gridFlowShape(count: number, landscape: boolean): FlowShape {
  if (!Number.isInteger(count) || count < 1) return { columns: 1, rows: 0, perRow: [] };
  let columns: number;
  if (landscape) columns = count <= 3 ? count : count === 4 ? 2 : count <= 6 ? 3 : 4;
  else columns = count <= 3 ? 1 : count <= 6 ? 2 : Math.ceil(count / 3);
  const rows = Math.ceil(count / columns);
  const perRow = Array.from({ length: rows }, (_, row) => Math.min(columns, count - row * columns));
  return { columns, rows, perRow };
}

/** One row (`row`), one column (`column`) or the grid sequence (`grid`) for `count` blocks. */
export function flowShape(arrangement: 'grid' | 'row' | 'column', count: number, landscape: boolean): FlowShape {
  if (count < 1) return { columns: 1, rows: 0, perRow: [] };
  if (arrangement === 'row') return { columns: count, rows: 1, perRow: [count] };
  if (arrangement === 'column') return { columns: 1, rows: count, perRow: Array.from({ length: count }, () => 1) };
  return gridFlowShape(count, landscape);
}

/**
 * The cells of a flow shape inside `box`, in block order (row by row). Rows have equal heights and full rows equal
 * widths; a short last row keeps the column width of the full rows and is centred. `gap` is clamped so no cell is
 * thinner than the gaps around it.
 */
export function flowCells(shape: FlowShape, box: LayoutBox, requestedGap: number): { cells: LayoutBox[]; gap: number } {
  if (!shape.rows) return { cells: [], gap: requestedGap };
  const gap = Math.max(0, Math.min(requestedGap, box.width / (shape.columns * 2), box.height / (shape.rows * 2)));
  const width = (box.width - gap * (shape.columns - 1)) / shape.columns;
  const height = (box.height - gap * (shape.rows - 1)) / shape.rows;
  const cells: LayoutBox[] = [];
  shape.perRow.forEach((count, row) => {
    const used = count * width + (count - 1) * gap, start = box.x + (box.width - used) / 2;
    for (let column = 0; column < count; column++) cells.push({ x: count === shape.columns ? box.x + column * (width + gap) : start + column * (width + gap), y: box.y + row * (height + gap), width, height });
  });
  return { cells, gap };
}

/**
 * Row heights: `auto` rows take the height they need (`needs`, capped at half of `total`; 0 for a row whose areas are
 * all empty), and the numeric rows share the rest in proportion. Gaps separate the rows that have height.
 */
export function rowHeights(sizes: readonly (number | 'auto')[], needs: readonly number[], total: number, gap: number): number[] {
  const auto = sizes.map((size, index) => size === 'auto' ? Math.max(0, Math.min(needs[index] ?? 0, total / 2)) : 0);
  const visible = sizes.filter((size, index) => size !== 'auto' || auto[index]! > 0).length;
  const numeric = sizes.reduce<number>((sum, size) => sum + (size === 'auto' ? 0 : size), 0);
  const rest = Math.max(0, total - auto.reduce((a, b) => a + b, 0) - Math.max(0, visible - 1) * gap);
  return sizes.map((size, index) => size === 'auto' ? auto[index]! : numeric > 0 ? rest * size / numeric : 0);
}

/** Column widths: the columns share `total` minus the gaps in proportion. */
export function columnWidths(sizes: readonly number[], total: number, gap: number): number[] {
  const sum = sizes.reduce((a, b) => a + b, 0);
  const rest = Math.max(0, total - Math.max(0, sizes.length - 1) * gap);
  return sizes.map(size => sum > 0 ? rest * size / sum : 0);
}

/** A rectangle of cells. */
export interface CellRect { row: number; column: number; rowSpan: number; columnSpan: number }

/**
 * Collapse empty areas into neighbours (design section 3). `grid[row][column]` is an area name or `.`; `empty` names the
 * areas with nothing to show; `heading` tells heading areas apart. Each empty area joins a neighbour that shares the full
 * length of one of its edges and is not itself empty, trying the start side, the end side, below and above, a body area
 * before a heading area. `absorbs` can rule an area out as a target. Returns the new owner grid and, for each collapsed area, the area it joined. Never changes `grid`.
 */
export function collapseAreas(grid: readonly (readonly string[])[], empty: ReadonlySet<string>, heading: (name: string) => boolean, absorbs: (name: string) => boolean = () => true): { grid: string[][]; joined: Map<string, string> } {
  const owner = grid.map(row => [...row]);
  const joined = new Map<string, string>();
  const rect = (name: string): CellRect | undefined => {
    let top = Infinity, left = Infinity, bottom = -1, right = -1;
    owner.forEach((row, r) => { row.forEach((cell, c) => { if (cell === name) { top = Math.min(top, r); left = Math.min(left, c); bottom = Math.max(bottom, r); right = Math.max(right, c); } }); });
    return bottom < 0 ? undefined : { row: top, column: left, rowSpan: bottom - top + 1, columnSpan: right - left + 1 };
  };
  const order: string[] = [];
  for (const row of owner) for (const cell of row) if (cell !== '.' && !order.includes(cell)) order.push(cell);
  const pending = order.filter(name => empty.has(name));
  let changed = true;
  while (changed) {
    changed = false;
    for (const name of pending) {
      if (joined.has(name)) continue;
      const own = rect(name);
      if (!own) continue;
      const neighbour = (side: 'start' | 'end' | 'below' | 'above'): string | undefined => {
        const cells: string[] = [];
        if (side === 'start' || side === 'end') {
          const column = side === 'start' ? own.column - 1 : own.column + own.columnSpan;
          if (column < 0 || column >= (owner[0]?.length ?? 0)) return undefined;
          for (let r = own.row; r < own.row + own.rowSpan; r++) cells.push(owner[r]![column]!);
        } else {
          const row = side === 'above' ? own.row - 1 : own.row + own.rowSpan;
          if (row < 0 || row >= owner.length) return undefined;
          for (let c = own.column; c < own.column + own.columnSpan; c++) cells.push(owner[row]![c]!);
        }
        const candidate = cells[0];
        if (candidate === undefined || candidate === '.' || candidate === name || cells.some(cell => cell !== candidate)) return undefined;
        if (empty.has(candidate) || !absorbs(candidate)) return undefined;
        const other = rect(candidate)!;
        const fits = side === 'start' || side === 'end' ? other.row === own.row && other.rowSpan === own.rowSpan : other.column === own.column && other.columnSpan === own.columnSpan;
        return fits ? candidate : undefined;
      };
      const sides = ['start', 'end', 'below', 'above'] as const;
      let target: string | undefined;
      for (const body of [true, false]) {
        for (const side of sides) {
          const candidate = neighbour(side);
          if (candidate !== undefined && heading(candidate) !== body) { target = candidate; break; }
        }
        if (target !== undefined) break;
      }
      if (target === undefined) continue;
      for (const row of owner) row.forEach((cell, c) => { if (cell === name) row[c] = target!; });
      joined.set(name, target);
      changed = true;
    }
  }
  return { grid: owner, joined };
}

/** The cell rectangle of every area in an owner grid. */
export function areaRects(grid: readonly (readonly string[])[]): Map<string, CellRect> {
  const rects = new Map<string, CellRect>();
  grid.forEach((row, r) => { row.forEach((name, c) => {
    if (name === '.') return;
    const found = rects.get(name);
    if (!found) rects.set(name, { row: r, column: c, rowSpan: 1, columnSpan: 1 });
    else { found.rowSpan = Math.max(found.rowSpan, r - found.row + 1); found.columnSpan = Math.max(found.columnSpan, c - found.column + 1); }
  }); });
  return rects;
}

/**
 * Column breaks of a list laid out in `count` columns: indexes where a column starts after the first, chosen between
 * items (never inside one, and never before a nested item, which stays with its parent) so the tallest column is as short
 * as possible. `heights` are the items' heights in one column; `levels` their nesting levels.
 */
export function listColumnBreaks(heights: readonly number[], levels: readonly number[], count: number): number[] {
  const n = heights.length;
  if (count <= 1 || n < 2) return [];
  const allowed = Array.from({ length: n }, (_, index) => index > 0 && (levels[index] ?? 0) === 0);
  const prefix = [0];
  for (const height of heights) prefix.push(prefix.at(-1)! + height);
  const span = (from: number, to: number) => prefix[to]! - prefix[from]!;
  // best[k][i]: the smallest tallest column for items i.. in k columns, with the break that achieves it.
  const memo = new Map<string, { cost: number; breaks: number[] }>();
  const solve = (start: number, columns: number): { cost: number; breaks: number[] } => {
    const key = `${start}:${columns}`;
    const found = memo.get(key);
    if (found) return found;
    let best = { cost: span(start, n), breaks: [] as number[] };
    if (columns > 1) for (let next = start + 1; next < n; next++) {
      if (!allowed[next]) continue;
      const rest = solve(next, columns - 1);
      const cost = Math.max(span(start, next), rest.cost);
      if (cost < best.cost - 1e-9) best = { cost, breaks: [next, ...rest.breaks] };
    }
    memo.set(key, best);
    return best;
  };
  return solve(0, count).breaks;
}

/** Options of `composeLayoutAreas`. */
export interface LayoutAreasOptions {
  /** Canvas size in reference pixels. Default 1280 x 720. */
  width?: number;
  height?: number;
  /** The record's or the deck's composition padding and gap (fractions of the short edge). Defaults: the record's, else 0.08 and 1/30. */
  padding?: number;
  gap?: number;
  /** Draw the template mirrored (design.mirror). */
  mirror?: boolean;
  /** A right-to-left deck mirrors the drawing (on top of `mirror`). */
  direction?: 'ltr' | 'rtl';
}
/** One area of a template as a layout master places it. */
export interface ComposedLayoutArea {
  name: string;
  /** `title` or `subtitle`. */
  heading: boolean;
  box: LayoutBox;
}

/**
 * The areas of a template composed for an empty slide at the canvas size, with nothing collapsed: the geometry of a
 * layout's placeholders on a PowerPoint slide layout (design section 8). The content box is the canvas minus the padding;
 * an `auto` row is as tall as one line of title (the `title` row, plus a subtitle line when the template has no
 * `subtitle` area), one line of subtitle (a `subtitle` row) or two lines of body text (any other row). Slides compose
 * their own geometry with `composeSlide`; this is the empty layout only.
 */
export function composeLayoutAreas(layout: unknown, options: LayoutAreasOptions = {}): { contentBox: LayoutBox; areas: ComposedLayoutArea[] } {
  const template = layoutTemplate(layout);
  const width = options.width ?? 1280, height = options.height ?? 720;
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new RangeError('Canvas dimensions must be finite and positive.');
  const short = Math.min(width, height), scale = short / 720;
  const composition = (layout !== null && typeof layout === 'object' ? (layout as { composition?: { padding?: number; gap?: number } }).composition : undefined) ?? {};
  const padding = (options.padding ?? composition.padding ?? 0.08) * short, gap = (options.gap ?? composition.gap ?? 1 / 30) * short;
  const frame: LayoutBox = { x: padding, y: padding, width: width - 2 * padding, height: height - 2 * padding };
  const rects = areaRects(template.grid);
  const needs = template.rows.map((size, row) => {
    if (size !== 'auto') return 0;
    let need = 0;
    for (const [name, rect] of rects) {
      if (rect.row !== row || rect.rowSpan !== 1) continue;
      need = Math.max(need, name === 'title' ? (54 + (template.subtitle ? 0 : 25)) * 1.22 * scale : name === 'subtitle' ? 25 * 1.22 * scale : 2 * 25 * 1.22 * scale);
    }
    return need;
  });
  const heights = rowHeights(template.rows, needs, frame.height, gap), widths = columnWidths(template.columns, frame.width, gap);
  const rowY: number[] = [], columnX: number[] = [];
  heights.reduce((y, size, row) => { rowY.push(size > 0 || !heights.slice(0, row).some(above => above > 0) ? y : y - gap); return size > 0 ? y + size + gap : y; }, 0);
  widths.reduce((x, size) => { columnX.push(x); return x + size + gap; }, 0);
  const flip = (options.mirror === true) !== (options.direction === 'rtl');
  const areas = template.areas.map(area => {
    const last = area.row + area.rowSpan - 1, y = frame.y + rowY[area.row]!;
    const boxWidth = widths.slice(area.column, area.column + area.columnSpan).reduce((a, b) => a + b, 0) + gap * (area.columnSpan - 1);
    const x = frame.x + columnX[area.column]!;
    const box = { x: flip ? frame.x + frame.width - (x - frame.x) - boxWidth : x, y, width: boxWidth, height: Math.max(0, frame.y + rowY[last]! + heights[last]! - y) };
    return { name: area.name, heading: area.heading, box };
  });
  return { contentBox: frame, areas };
}
