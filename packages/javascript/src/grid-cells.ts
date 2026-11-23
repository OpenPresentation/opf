/**
 * OPF 0.35: the cells of the 3 x 3 grid of a slide without a layout, which a root block names with `region`.
 *
 * Internal module: no dependencies, so the composition engine, the validator and the walkers can share it.
 */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * OPF 0.35: the cells of a slide without a layout, the words a root block names with `region` to place itself on the slide's 3 x 3
 * grid: a column band (`start`, `center+end`), a row band (`top`, `middle+bottom`) or rows, a colon, then columns
 * (`top:start`, `middle+bottom:center+end`). Each half lists adjacent names in reading order. Through 0.34 these were slide keys
 * (the promoted regions); validate reports such a key with the fix that moves it into a block.
 */
export const gridCells = [
  "start",
  "center",
  "end",
  "start+center",
  "center+end",
  "start+center+end",
  "top",
  "middle",
  "bottom",
  "top+middle",
  "middle+bottom",
  "top+middle+bottom",
  "top:start",
  "top:center",
  "top:end",
  "top:start+center",
  "top:center+end",
  "top:start+center+end",
  "middle:start",
  "middle:center",
  "middle:end",
  "middle:start+center",
  "middle:center+end",
  "middle:start+center+end",
  "bottom:start",
  "bottom:center",
  "bottom:end",
  "bottom:start+center",
  "bottom:center+end",
  "bottom:start+center+end",
  "top+middle:start",
  "top+middle:center",
  "top+middle:end",
  "top+middle:start+center",
  "top+middle:center+end",
  "top+middle:start+center+end",
  "middle+bottom:start",
  "middle+bottom:center",
  "middle+bottom:end",
  "middle+bottom:start+center",
  "middle+bottom:center+end",
  "middle+bottom:start+center+end",
  "top+middle+bottom:start",
  "top+middle+bottom:center",
  "top+middle+bottom:end",
  "top+middle+bottom:start+center",
  "top+middle+bottom:center+end",
  "top+middle+bottom:start+center+end",
] as const;

/** A cell word of a slide without a layout (`gridCells`). */
export type GridCell = (typeof gridCells)[number];

const GRID_CELLS: ReadonlySet<string> = new Set<string>(gridCells);
const GRID_ROWS = ["top", "middle", "bottom"], GRID_COLUMNS = ["start", "center", "end"];

/** Whether `value` is a cell word (`start`, `top+middle`, `middle:center+end`, ...). */
export function isGridCell(value: unknown): value is GridCell {
  return typeof value === "string" && GRID_CELLS.has(value);
}

/** The rows and columns (0 to 2, logical: column 0 is the start column) a cell word covers; undefined for any other string. */
export function gridCellSpan(cell: string): { rows: number[]; columns: number[] } | undefined {
  if (!GRID_CELLS.has(cell)) return undefined;
  const indices = (part: string, words: string[]) => part.split("+").map((word) => words.indexOf(word));
  const [first = "", second] = cell.split(":");
  if (second !== undefined) return { rows: indices(first, GRID_ROWS), columns: indices(second, GRID_COLUMNS) };
  return GRID_COLUMNS.includes(first.split("+")[0] ?? "") ? { rows: [0, 1, 2], columns: indices(first, GRID_COLUMNS) } : { rows: indices(first, GRID_ROWS), columns: [0, 1, 2] };
}

/** One root block of a slide that places its blocks in cells (`cellBlocks`). */
export interface CellBlock {
  cell: GridCell;
  /** Its index in the slide's `blocks`. */
  index: number;
  block: Record<string, unknown>;
}

/**
 * OPF 0.35: the root blocks of a slide that places its blocks in the cells of its 3 x 3 grid, in source order; undefined when it does
 * not. A slide does when it has no `layout` and every block of its `blocks` names a cell with `region` (all or none: a slide with a
 * block that names none composes automatically, and validate reports the mix). Blocks that name the same cell stack in it, as a group
 * would. On a slide with a layout a cell word is an ordinary region pin that names no region of the layout (`opf/region-unknown`).
 */
export function cellBlocks(slide: Record<string, unknown>): CellBlock[] | undefined {
  if (slide.layout !== undefined || !Array.isArray(slide.blocks)) return undefined;
  const found: CellBlock[] = [];
  for (const [index, block] of slide.blocks.entries()) {
    if (!isRecord(block)) continue;
    if (!isGridCell(block.region)) return undefined;
    found.push({ cell: block.region, index, block });
  }
  return found.length ? found : undefined;
}

/**
 * The cells of `entries` in reading order: rows from the top, then along the row from the start column (a right-to-left deck reads
 * its start column first too). Each cell once.
 */
export function cellsInReadingOrder(entries: readonly { cell: string }[]): string[] {
  const cells = [...new Set(entries.map((entry) => entry.cell))];
  const at = (cell: string) => gridCellSpan(cell) ?? { rows: [3], columns: [3] };
  return cells.sort((a, b) => Math.min(...at(a).rows) - Math.min(...at(b).rows) || Math.min(...at(a).columns) - Math.min(...at(b).columns));
}

const logicalCell = (name: string): string => name.split(":").map((part) => part.split("+").map((word) => (word === "left" ? "start" : word === "right" ? "end" : word)).join("+")).join(":");

/**
 * A string written like a cell word (`gridCells`) but not one, or an exact one: the cell it most likely means and, when it is not one,
 * what the grammar is. A cell is rows, then a colon, then columns (`top:start`, `middle+bottom:center+end`), or one half alone
 * (`center+end`, `top+middle`). Each half lists adjacent names in reading order, so `bottom+middle` (out of order), `top+bottom`
 * (skips `middle`) and `start:top` (columns first) are not cells; `left` and `right` are `start` and `end` (layout words follow
 * the deck's direction). Undefined when the string is not made of those words.
 */
export function nearestGridCell(typed: string): { cell?: GridCell; help?: string } | undefined {
  if (isGridCell(typed)) return { cell: typed };
  const logical = logicalCell(typed);
  if (isGridCell(logical)) return { cell: logical, help: `Write "${logical}": layout words follow the deck's direction, so the sides are "start" and "end", not "left" and "right".` };
  const halves = logical.split(":");
  if (halves.length > 2 || halves.some((half) => half === "")) return undefined;
  const words = halves.map((half) => half.split("+"));
  if (!words.every((list) => list.every((word) => GRID_ROWS.includes(word) || GRID_COLUMNS.includes(word)))) return undefined;
  const isRows = (list: string[]): boolean => list.every((word) => GRID_ROWS.includes(word)),
    isColumns = (list: string[]): boolean => list.every((word) => GRID_COLUMNS.includes(word));
  if (words.some((list) => !isRows(list) && !isColumns(list))) return { help: 'A cell does not mix rows (top, middle, bottom) and columns (start, center, end) in one half: write rows, a colon, then columns, such as "top:start" or "middle+bottom:center+end".' };
  if (words.length === 2 && isColumns(words[0]!) && isRows(words[1]!)) {
    const swapped = `${halves[1]}:${halves[0]}`;
    return isGridCell(swapped) ? { cell: swapped, help: `Rows come before the colon and columns after it: write "${swapped}".` } : { help: "Rows come before the colon and columns after it, such as \"top:start\" or \"middle+bottom:center+end\"." };
  }
  if (words.length === 2 && (!isRows(words[0]!) || !isColumns(words[1]!))) return { help: 'A cell with a colon names rows before it and columns after it, such as "top:start" or "middle+bottom:center+end".' };
  const order = (list: string[], vocabulary: string[]): number[] => [...new Set(list)].map((word) => vocabulary.indexOf(word)).sort((x, y) => x - y);
  const hasRows = words.length === 2 || isRows(words[0]!), hasColumns = words.length === 2 || isColumns(words[0]!);
  const rows = hasRows ? order(words[0]!, GRID_ROWS) : [], columns = hasColumns ? order(words[words.length - 1]!, GRID_COLUMNS) : [];
  const adjacent = (indexes: number[]): boolean => indexes.every((index, at) => at === 0 || index === indexes[at - 1]! + 1);
  if ((hasRows && !adjacent(rows)) || (hasColumns && !adjacent(columns)))
    return { help: 'A span covers adjacent rows or columns: "top+bottom" and "start+end" skip the middle one. Write "top+middle+bottom" or "start+center+end", or use one cell for each part.' };
  const canonical = (indexes: number[], vocabulary: string[]): string => indexes.map((index) => vocabulary[index]).join("+");
  const cell = words.length === 2 ? `${canonical(rows, GRID_ROWS)}:${canonical(columns, GRID_COLUMNS)}` : hasRows ? canonical(rows, GRID_ROWS) : canonical(columns, GRID_COLUMNS);
  return isGridCell(cell) ? { cell, help: `Write "${cell}": the names of a span go in reading order (top, middle, bottom; start, center, end), rows before the colon and columns after it.` } : undefined;
}
