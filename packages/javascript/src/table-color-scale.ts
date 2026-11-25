/**
 * FR-07: the table color scale (`table.colorScale`). Core computes, for every number cell of the named columns, the fill and the text color;
 * composition (layoutTable) hands them to the preview, the PNG and PDF renderers and the PowerPoint export, so every engine draws the same colors.
 * Only scheme color names are allowed; the ends are resolved through the effective color scheme by the caller. The range, the rules and the pinning
 * are in table-color-scale-range.ts. No renderer, fonts, DOM or network dependencies.
 */
import { colorContrast, textColorForFill } from './color.js';
import { mixOklab } from './oklab.js';
import { tableRows } from './table.js';
import { effectiveRange, scaleColumns, scaleNumbers, tableColorScaleOf, type TableColorScaleCell, type TableColorScaleColors, type TableColorScaleRange, type TableColorScaleResult } from './table-color-scale-range.js';
export { tableColorScaleOf, pinTableColorScale, tableColorScaleDiagnostics, SCHEME_COLOR_NAMES } from './table-color-scale-range.js';
export type { TableColorScaleCell, TableColorScaleColors, TableColorScaleRange, TableColorScaleResult, TableColorScaleSpec, SchemeColorName, TableColorScaleDiagnostic } from './table-color-scale-range.js';

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

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
 * The text color for a cell on `fill`: the scheme's `text` color when it reaches 4.5:1 on the fill, else the scheme's `background` color when it does,
 * else black or white (core `textColorForFill`, the rule every engine already applies to default cell text on a filled cell). A theme color
 * is preferred to black or white so the PowerPoint export can write the text as a theme color.
 */
export function tableColorScaleText(fill: string, colors: Pick<TableColorScaleColors, 'text' | 'background'>): string {
  if ((colorContrast(colors.text, fill) ?? 0) >= 4.5) return colors.text;
  if (colors.background !== undefined && (colorContrast(colors.background, fill) ?? 0) >= 4.5) return colors.background;
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
  const [first = 'surface', second, third] = scale.colors ?? [], diverging = third !== undefined;
  const ends = { from: colors.resolve(first), to: colors.resolve(third ?? second ?? 'primary'), ...(diverging ? { mid: colors.resolve(second!) } : {}) };
  const cells = numbers.filter(entry => !entry.own).map(({ row, column, value }): TableColorScaleCell => {
    const fill = shade(value, range, ends);
    return { row, column, value, fill, text: tableColorScaleText(fill, colors) };
  });
  const byCell = new Map(cells.map(cell => [`${cell.row}:${cell.column}`, cell]));
  return { cells, at: (row, column) => byCell.get(`${row}:${column}`), range };
}

