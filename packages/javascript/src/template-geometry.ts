/**
 * Pure geometry of OPF 0.19 layout templates: the grid sequence of a flowing region, track sizing, the collapse of empty
 * areas and the column breaks of a long list. `composeSlide` measures content and calls these; nothing here measures text.
 */
import type { LayoutBox } from './composition.js';

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

/** What a row of a slide's grid holds, for `allocateRows`. */
export interface RowDemand {
  size: number | 'auto';
  /** The height the row's content needs at the starting size (0 for an empty row). */
  need: number;
  /** `heading`: an auto row sized by a heading area; `below`: the implicit row of content no region took; `body`: anything else. */
  kind: 'heading' | 'body' | 'below';
}

/**
 * Row heights of a slide's template grid, so that no row with content is squeezed to nothing (RR-79, RR-81 review):
 * 1. A heading `auto` row takes what its headings need, at most half the content box.
 * 2. The numeric rows keep at least what their content needs, up to half of the space under the headings.
 * 3. The other `auto` rows take what they need (at most half the content box each; the implicit row below the grid has no
 *    such cap) from what is left; when that is not enough they shrink together, in proportion to their needs.
 * 4. The numeric rows share the rest in proportion to their sizes. An `auto` row with nothing in it has no height and no gap.
 */
export function allocateRows(rows: readonly RowDemand[], total: number, gap: number): number[] {
  const auto = rows.map(row => row.size === 'auto' ? Math.max(0, Math.min(row.need, row.kind === 'below' ? total : total / 2)) : 0);
  const visible = rows.filter((row, index) => row.size !== 'auto' || auto[index]! > 0).length;
  const headings = rows.reduce((sum, row, index) => sum + (row.kind === 'heading' ? auto[index]! : 0), 0);
  const space = Math.max(0, total - headings - Math.max(0, visible - 1) * gap);
  const numeric = rows.reduce<number>((sum, row) => sum + (row.size === 'auto' ? 0 : row.size), 0);
  const numericNeed = rows.reduce((sum, row) => sum + (row.size === 'auto' ? 0 : Math.max(0, row.need)), 0);
  const reserve = numeric > 0 ? Math.min(numericNeed, space / 2) : 0;
  const body = rows.reduce((sum, row, index) => sum + (row.size === 'auto' && row.kind !== 'heading' ? auto[index]! : 0), 0);
  const factor = body > space - reserve && body > 0 ? Math.max(0, space - reserve) / body : 1;
  const heights = rows.map((row, index) => row.size === 'auto' ? (row.kind === 'heading' ? auto[index]! : auto[index]! * factor) : 0);
  const rest = Math.max(0, space - heights.reduce((sum, height, index) => sum + (rows[index]!.kind === 'heading' ? 0 : height), 0));
  return rows.map((row, index) => row.size === 'auto' ? heights[index]! : numeric > 0 ? rest * row.size / numeric : 0);
}
