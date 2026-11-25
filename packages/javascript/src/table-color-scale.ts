/**
 * FR-07: the table color scale (`table.colorScale`). Core computes, for every number cell of the named columns, the fill and the text
 * color; composition (layoutTable) hands them to the preview, the PNG and PDF renderers and the PowerPoint export, so every engine
 * draws the same colors. Only scheme color names are allowed; the ends are resolved through the effective color scheme by the caller.
 * No renderer, fonts, DOM or network dependencies.
 */
import { textColorForFill } from './color.js';
import { mixOklab } from './oklab.js';
import { tableRows } from './table.js';

/** The color-scheme names a scale may use: the slots and roles of ColorRef, without the hyperlink colors (schema `SchemeColorName`). */
export const SCHEME_COLOR_NAMES = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'dark1', 'dark2', 'light1', 'light2', 'primary', 'secondary', 'accent', 'background', 'surface', 'surfaceAlt', 'text', 'textSecondary'] as const;
export type SchemeColorName = typeof SCHEME_COLOR_NAMES[number];

/** The authored scale (schema `TableColorScale`). */
export interface TableColorScaleSpec {
  columns: string[];
  from?: SchemeColorName; to?: SchemeColorName; mid?: SchemeColorName;
  center?: number; min?: number; max?: number;
}

/** What the caller supplies: how a scheme name resolves in the effective color scheme, and the scheme's text color. */
export interface TableColorScaleColors {
  /** The color of a scheme name as `#RRGGBB`. */
  resolve: (name: SchemeColorName) => string;
  /** The scheme's `text` color: the cell text on a fill it reads on (4.5:1); on any other fill black or white. */
  text: string;
}

/** One shaded cell: the fill (`#RRGGBB`) and the text color that reads on it. `row` is the body row (0-based, after the header). */
export interface TableColorScaleCell { row: number; column: number; value: number; fill: string; text: string }

/** The values a scale was computed over: `center` only for a diverging scale. */
export interface TableColorScaleRange { min: number; max: number; center?: number }

export interface TableColorScaleResult {
  cells: TableColorScaleCell[];
  /** The cell at (body row, column), when it is shaded. */
  at: (row: number, column: number) => TableColorScaleCell | undefined;
  /** The effective range, absent when no named column has a number. */
  range?: TableColorScaleRange;
}

/** A diagnostic the validator reports (`table-color-scale-*`). */
export interface TableColorScaleDiagnostic { code: 'table-color-scale-unknown-column' | 'table-color-scale-no-data' | 'table-color-scale-range'; severity: 'error' | 'warning'; path: string; message: string }

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The plain text of a header or cell: a string, a number, rich runs, or a styled cell's value. */
function plainText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(plainText).join('');
  if (isRecord(value)) return plainText('value' in value ? value.value : value.name ?? value.text);
  return '';
}
const headerName = (header: unknown): string => plainText(header).replace(/\s+/g, ' ').trim();

/** The number a cell holds (a bare number or a styled cell's number), when it is finite. */
function cellNumber(cell: unknown): number | undefined {
  const value = isRecord(cell) && 'value' in cell ? cell.value : cell;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
const cellFill = (cell: unknown): boolean => isRecord(cell) && 'value' in cell && isRecord(cell.style) && cell.style.fill !== undefined && cell.style.fill !== null;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** The scale of a table, when it is an object with a non-empty `columns` list of strings; anything else is not a scale. */
export function tableColorScaleOf(table: unknown): TableColorScaleSpec | undefined {
  const scale = isRecord(table) ? table.colorScale : undefined;
  return isRecord(scale) && Array.isArray(scale.columns) && scale.columns.length > 0 && scale.columns.every(name => typeof name === 'string') ? scale as unknown as TableColorScaleSpec : undefined;
}

/** The column positions the scale's names match: every column whose header text equals a name (two columns with one header are both shaded). */
function scaleColumns(scale: TableColorScaleSpec, headers: readonly unknown[]): Set<number> {
  const names = new Set(scale.columns), matched = new Set<number>();
  headers.forEach((header, index) => { if (names.has(headerName(header))) matched.add(index); });
  return matched;
}

interface Numbers { column: number; row: number; value: number; own: boolean }

function scaleNumbers(columns: Set<number>, rows: readonly (readonly unknown[])[]): Numbers[] {
  const numbers: Numbers[] = [];
  rows.forEach((cells, row) => cells.forEach((cell, column) => {
    if (!columns.has(column)) return;
    const value = cellNumber(cell);
    if (value !== undefined) numbers.push({ column, row, value, own: cellFill(cell) });
  }));
  return numbers;
}

/** The effective range of a scale over `values`: the authored `min`, `max` and `center` where given, else the data's (see the schema). */
function effectiveRange(scale: TableColorScaleSpec, values: readonly number[]): TableColorScaleRange | undefined {
  if (!values.length) return undefined;
  const min = finite(scale.min) ? scale.min : Math.min(...values), max = finite(scale.max) ? scale.max : Math.max(...values);
  if (scale.mid === undefined) return { min, max };
  return { min, max, center: finite(scale.center) ? scale.center : min < 0 && max > 0 ? 0 : (min + max) / 2 };
}

/** The position and colors of one value on a scale: the color between the resolved ends, mixed in OKLab. */
function shade(value: number, range: TableColorScaleRange, ends: { from: string; to: string; mid?: string }): string {
  const { min, max, center } = range;
  if (center === undefined || ends.mid === undefined) {
    const t = max > min ? (value - min) / (max - min) : 1;
    return mixOklab(ends.from, ends.to, t);
  }
  if (value === center) return ends.mid;
  if (value < center) {
    // Below the center: from -> mid over min..center; with the whole range at or above the center only the upper side is drawn.
    const t = center > min ? (value - min) / (center - min) : 0;
    return mixOklab(ends.from, ends.mid, t);
  }
  const t = max > center ? (value - center) / (max - center) : 1;
  return mixOklab(ends.mid, ends.to, t);
}

/**
 * The text color for a cell on `fill`: the scheme's `text` color when it reaches 4.5:1 on the fill, else black or white (core `textColorForFill`,
 * the rule every engine already applies to default cell text on a filled cell).
 */
export function tableColorScaleText(fill: string, colors: Pick<TableColorScaleColors, 'text'>): string {
  return textColorForFill(fill, colors.text);
}

/**
 * Computes a table's color scale. `headers` are the column labels (as authored: strings, rich runs, styled cells, DataColumns) and `rows`
 * the body rows' cells, by position. A cell takes part when its value is a finite number; a cell with a `style.fill` of its own counts
 * towards the range and keeps its fill (it is not in the result). A table without a scale, or with no number in the named columns, has no cells.
 */
export function resolveTableColorScale(table: unknown, colors: TableColorScaleColors): TableColorScaleResult {
  const none: TableColorScaleResult = { cells: [], at: () => undefined };
  const scale = tableColorScaleOf(table);
  if (!scale || !isRecord(table) || !Array.isArray(table.columns)) return none;
  const rows = tableRows(table).map(row => row.cells);
  const numbers = scaleNumbers(scaleColumns(scale, table.columns), rows);
  const range = effectiveRange(scale, numbers.map(entry => entry.value));
  if (!range) return none;
  const ends = { from: colors.resolve(scale.from ?? 'surface'), to: colors.resolve(scale.to ?? 'primary'), ...(scale.mid !== undefined ? { mid: colors.resolve(scale.mid) } : {}) };
  const cells = numbers.filter(entry => !entry.own).map(({ row, column, value }): TableColorScaleCell => {
    const fill = shade(value, range, ends);
    return { row, column, value, fill, text: tableColorScaleText(fill, colors) };
  });
  const byCell = new Map(cells.map(cell => [`${cell.row}:${cell.column}`, cell]));
  return { cells, at: (row, column) => byCell.get(`${row}:${column}`), range };
}

/**
 * The same table with its scale's range written out (`min`, `max` and, for a diverging scale, `center`), computed over the whole table.
 * Pagination uses it so every page of a split table is shaded on one range: a value has the same color on every page.
 * A table without a scale, or whose named columns hold no numbers, is returned as is.
 */
export function pinTableColorScale<T>(table: T): T {
  const scale = tableColorScaleOf(table);
  if (!scale || !isRecord(table) || !Array.isArray(table.columns)) return table;
  const numbers = scaleNumbers(scaleColumns(scale, table.columns), tableRows(table).map(row => row.cells));
  const range = effectiveRange(scale, numbers.map(entry => entry.value));
  if (!range) return table;
  const pinned: TableColorScaleSpec = { ...scale, min: range.min, max: range.max, ...(range.center !== undefined ? { center: range.center } : {}) };
  return { ...table, colorScale: pinned } as T;
}

const at = (base: string, ...segments: (string | number)[]): string => `${base}/${segments.map(segment => String(segment).replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`;

/**
 * The validator's findings for a table's color scale. `headers` and `rows` are the table's resolved columns and body rows (a dataset-backed
 * table after `fields`); `base` is the JSON Pointer of the table. An unknown column is an error; a scale with no numbers, an empty range or a
 * center outside the range is a warning (a refresh of a dataset must not make a deck invalid).
 */
export function tableColorScaleDiagnostics(table: unknown, headers: readonly unknown[] | undefined, rows: readonly (readonly unknown[])[], base: string): TableColorScaleDiagnostic[] {
  const scale = isRecord(table) && isRecord(table.colorScale) ? table.colorScale : undefined;
  if (!scale || !Array.isArray(scale.columns)) return [];
  const diagnostics: TableColorScaleDiagnostic[] = [];
  const names = (headers ?? []).map(headerName), known = new Set(names);
  const list = names.map(name => JSON.stringify(name)).join(', ');
  scale.columns.forEach((name: unknown, index: number) => {
    if (typeof name === 'string' && known.has(name)) return;
    diagnostics.push({ code: 'table-color-scale-unknown-column', severity: 'error', path: at(base, 'colorScale', 'columns', index), message: `The color scale names ${JSON.stringify(name)}, which is no column of this table. Columns: ${list || 'none'}.` });
  });
  const spec = scale as unknown as TableColorScaleSpec;
  const numbers = scaleNumbers(scaleColumns(spec, headers ?? []), rows);
  if (!numbers.length) {
    // Without a numeric column an unknown name is already reported; the empty scale is reported only when every name is a column.
    if (!diagnostics.length) diagnostics.push({ code: 'table-color-scale-no-data', severity: 'warning', path: at(base, 'colorScale'), message: "The color scale's columns hold no numbers, so no cell is shaded." });
    return diagnostics;
  }
  const range = effectiveRange(spec, numbers.map(entry => entry.value))!;
  const pinned = finite(spec.min) || finite(spec.max);
  const emptyRange = pinned && !(range.min < range.max);
  const centerOutside = finite(spec.center) && spec.mid !== undefined && (spec.center < range.min || spec.center > range.max);
  if (emptyRange || centerOutside) diagnostics.push({ code: 'table-color-scale-range', severity: 'warning', path: at(base, 'colorScale'), message: "The color scale's range is empty or its center is outside it." });
  return diagnostics;
}

