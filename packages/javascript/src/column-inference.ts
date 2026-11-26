// FR-05: what a column of imported data holds and what it is for, told from its cells. Ingest (opf ingest, the editor's paste) uses it to
// fill `type` and `role` for columns that declare nothing yet. It is a starting point for ingest, not a rule of the format: a host that reads a
// typed source (a database column, a spreadsheet's cell types) writes its own declarations.
//
// Browser-safe and synchronous: no file access, no network, no system clock.
import { chartNumber, type DataCellValue, type DatasetColumn, type DataColumnRole, type DataColumnType } from './chart-data.js';
import { isTimeLabel } from './chart-time-order.js';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const blank = (cell: unknown): boolean => cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '');

/** A number a string writes in strict decimal syntax and that prints back as the same text (`"12"`, `"-3.5"`; not `"12.50"`, `"1e6"` or `"012"`), or undefined. */
function losslessNumber(text: string): number | undefined {
  const trimmed = text.trim();
  const number = chartNumber(trimmed);
  return number !== null && String(number) === trimmed ? number : undefined;
}
/** A strict decimal string whose number prints differently (`"12.50"`): number-like, but storing it as a number would change what it shows. */
const numberLike = (cell: unknown): boolean => typeof cell === 'string' && chartNumber(cell) !== null && losslessNumber(cell) === undefined;

const isNumberCell = (cell: unknown): boolean => (typeof cell === 'number' && Number.isFinite(cell)) || (typeof cell === 'string' && losslessNumber(cell) !== undefined);
const isBooleanCell = (cell: unknown): boolean => typeof cell === 'boolean' || cell === 'true' || cell === 'false';

/**
 * What the cells of one column say about it, or undefined when they cannot say (no filled cell, a mix of kinds, or numbers written in a form
 * storing them as numbers would change). Every filled cell a number (a finite number, or a decimal string that prints back unchanged) is `number`;
 * every one true or false is `boolean`; every one a time label (a year, period, month, week or date) is `date`; every one a string is `text`.
 * The role is `measure` for a `number` column that is not the first column and not a time label (a year), and `dimension` otherwise.
 */
export function inferColumnDeclaration(cells: readonly unknown[], options: { first?: boolean; language?: string } = {}): { type: DataColumnType; role: DataColumnRole } | undefined {
  const filled = cells.filter(cell => !blank(cell));
  if (!filled.length) return undefined;
  if (filled.every(isNumberCell)) {
    const time = filled.every(cell => isTimeLabel(cell, options.language));
    return { type: 'number', role: options.first || time ? 'dimension' : 'measure' };
  }
  if (filled.some(numberLike)) return undefined;
  if (filled.every(isBooleanCell) && filled.some(cell => typeof cell === 'boolean' || cell === 'true' || cell === 'false')) return { type: 'boolean', role: 'dimension' };
  if (filled.every(cell => typeof cell === 'string' && isTimeLabel(cell, options.language))) return { type: 'date', role: 'dimension' };
  if (filled.every(cell => typeof cell === 'string')) return { type: 'text', role: 'dimension' };
  return undefined;
}

/** A cell stored in the type its column declares, when that changes nothing it shows: a decimal string that prints back unchanged becomes a number, "true" and "false" become booleans, and an empty cell of a non-text column becomes null. Anything else is returned as it is. */
export function storeCell(cell: DataCellValue, type: DataColumnType | undefined): DataCellValue {
  if (type === undefined || type === 'text') return cell;
  if (blank(cell)) return null;
  if (type === 'number' && typeof cell === 'string') return losslessNumber(cell) ?? cell;
  if (type === 'boolean' && (cell === 'true' || cell === 'false')) return cell === 'true';
  return cell;
}

/**
 * Declare the columns of imported data (`columns` and `rows`, as ingest returns them). A column the `previous` columns already name keeps that
 * declaration, plain string or object, and only its cells are stored in its declared type; a new column gets the `type` and `role` its cells
 * say (inferColumnDeclaration) and its cells are stored as that type, so a column typed number holds numbers and never warns. A column whose
 * type cannot be told stays a plain string. Returns the declared columns and rows; the input is not changed.
 */
export function declareColumns(data: { columns: readonly string[]; rows: readonly (readonly DataCellValue[])[] }, previous: readonly unknown[] = [], options: { language?: string } = {}): { columns: (string | DatasetColumn)[]; rows: DataCellValue[][] } {
  const known = new Map<string, unknown>();
  for (const column of previous) {
    if (typeof column === 'string') known.set(column, column);
    else if (record(column) && typeof column.name === 'string') known.set(column.name, column);
  }
  const columns: (string | DatasetColumn)[] = [];
  const types: (DataColumnType | undefined)[] = [];
  data.columns.forEach((name, index) => {
    const before = known.get(name);
    if (before !== undefined) {
      columns.push(structuredClone(before) as string | DatasetColumn);
      const type = record(before) && typeof before.type === 'string' ? (before.type as DataColumnType) : undefined;
      types.push(type);
      return;
    }
    const inferred = inferColumnDeclaration(data.rows.map(row => row[index]), { first: index === 0, language: options.language });
    columns.push(inferred ? { name, type: inferred.type, role: inferred.role } : name);
    types.push(inferred?.type);
  });
  return { columns, rows: data.rows.map(row => row.map((cell, index) => storeCell(cell, types[index]))) };
}
