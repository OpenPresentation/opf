/** Local CSV/TSV/JSON ingestion. No file access or network requests. */
export type DataCell = string | number | boolean | null;
export interface TabularData { columns: string[]; rows: DataCell[][] }
export interface DataImportOptions {
  format?: 'csv' | 'tsv' | 'json';
  delimiter?: string;
  header?: boolean;
  columns?: string[];
}
export interface DataContentOptions extends DataImportOptions {
  as: 'table' | 'chart';
  chartType?: string;
  category?: string;
  series?: string[];
}
export class OPFDataImportError extends Error {
  constructor(message: string) { super(message); this.name = 'OPFDataImportError'; }
}
const fail = (message: string): never => { throw new OPFDataImportError(message); };
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
function cell(value: unknown, location: string): DataCell {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
  return fail(`${location}: expected a string, finite number, boolean, or null. Flatten nested JSON fields first.`);
}
function labels(values: unknown[]): string[] {
  if (!values.length || values.some(value => typeof value !== 'string' || !value.trim())) fail('Column names must be nonempty strings.');
  const names = values as string[];
  if (new Set(names).size !== names.length) fail('Duplicate column names. Rename them before importing.');
  return [...names];
}
function csv(text: string, delimiter: string): string[][] {
  if (delimiter.length !== 1 || /["\r\n]/.test(delimiter)) fail('Delimiter must be one character other than a quote or newline.');
  const rows: string[][] = []; let row: string[] = [], value = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } }
      else value += char;
    } else if (char === delimiter || char === '\r' || char === '\n') {
      row.push(value); value = ''; closed = false;
      if (char !== delimiter) { rows.push(row); row = []; if (char === '\r' && text[i + 1] === '\n') i++; }
    } else if (char === '"' && !value && !closed) quoted = true;
    else { if (closed || char === '"') fail(`Malformed CSV near character ${i + 1}. Check quoted fields.`); value += char; }
  }
  if (quoted) fail('Unclosed quoted CSV field.');
  if (value || row.length || closed) { row.push(value); rows.push(row); }
  return rows;
}
function matrix(input: unknown[], header: boolean): TabularData {
  if (!input.length || !input.every(Array.isArray)) return fail('Expected a nonempty array of rows.');
  const rows = input as unknown[][];
  const columns = header ? labels(rows[0]!) : labels(rows[0]!.map((_, i) => `Column ${i + 1}`));
  return rectangular(columns, header ? rows.slice(1) : rows);
}
function rectangular(columns: string[], input: unknown[]): TabularData {
  return { columns, rows: input.map((row, i) => {
    if (!Array.isArray(row) || row.length !== columns.length) return fail(`Row ${i + 1}: expected ${columns.length} cells; found ${Array.isArray(row) ? row.length : 'a non-array value'}.`);
    return row.map((value, j) => cell(value, `Row ${i + 1}, column ${columns[j]}`));
  }) };
}
export function parseTabularData(input: unknown, options: DataImportOptions = {}): TabularData {
  let value: unknown = input;
  const format = options.format ?? (typeof input === 'string' && !/^[\s\uFEFF]*[\[{]/.test(input) ? 'csv' : 'json');
  if (!['csv','tsv','json'].includes(format)) fail(`Unsupported data format: ${format}`);
  let data: TabularData;
  if (format !== 'json') {
    if (typeof input !== 'string') return fail('CSV and TSV input must be text.');
    data = matrix(csv(input.replace(/^\uFEFF/, ''), options.delimiter ?? (format === 'tsv' ? '\t' : ',')), options.header !== false);
  } else {
    if (typeof value === 'string') { try { value = JSON.parse(value.replace(/^\uFEFF/, '')); } catch { fail('Invalid JSON data.'); } }
    if (Array.isArray(value)) {
      if (!value.length) return fail('Data contains no rows.');
      if (Array.isArray(value[0])) data = matrix(value, options.header !== false);
      else {
        if (!value.every(row => row && typeof row === 'object' && !Array.isArray(row))) return fail('JSON records must all be objects.');
        const columns = labels([...new Set(value.flatMap(row => Object.keys(row)))]);
        data = rectangular(columns, value.map(row => columns.map(key => own(row, key) ? row[key] : null)));
      }
    } else if (value && typeof value === 'object' && 'columns' in value && 'rows' in value && Array.isArray(value.columns) && Array.isArray(value.rows)) {
      data = rectangular(labels(value.columns), value.rows);
    } else return fail('JSON data must be records, a row matrix, or {columns, rows}.');
  }
  if (options.columns) {
    const selected = labels(options.columns), indices = selected.map(name => {
      const index = data.columns.indexOf(name); if (index < 0) fail(`Unknown column: ${name}`); return index;
    });
    data = {columns: selected, rows: data.rows.map(row => indices.map(i => row[i]!))};
  }
  return data;
}
function measure(value: DataCell, location: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  // Strict decimal syntax: no implicit blank/null/boolean zero, currency, grouping, or percentages.
  if (typeof value === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value.trim())) {
    const number = Number(value.trim());
    if (Number.isFinite(number) && (!Number.isInteger(number) || Number.isSafeInteger(number))) return number;
  }
  return fail(`${location}: expected a numeric chart value; found ${JSON.stringify(value)}. Clean the value or select another series.`);
}
export function createDataContent(input: unknown, options: DataContentOptions): { table: TabularData } | { chart: { type: string; data: TabularData } } {
  const data = parseTabularData(input, options);
  if (options.as === 'table') return { table: data };
  if (options.as !== 'chart') return fail('Choose table or chart.');
  const category = options.category ?? data.columns[0]!;
  const series = options.series ?? data.columns.filter(name => name !== category);
  if (!series.length || !data.rows.length) return fail('Charts need at least one category, numeric series, and data row.');
  const names = labels([category, ...series]), indices = names.map(name => {
    const index = data.columns.indexOf(name); if (index < 0) fail(`Unknown column: ${name}`); return index;
  });
  const circular = ['pie','donut','doughnut'].includes(options.chartType ?? 'column');
  if (circular && series.length !== 1) return fail('Pie and donut charts require exactly one numeric series.');
  const rows = data.rows.map((row, i) => indices.map((index, j) => {
    const value = row[index]!;
    if (!j) {
      if (value === null || value === '') fail(`Row ${i + 1}: missing category ${category}.`);
      return value;
    }
    const numeric = measure(value, `Row ${i + 1}, column ${names[j]}`);
    if (circular && numeric < 0) fail(`Row ${i + 1}: pie and donut values cannot be negative.`);
    return numeric;
  }));
  return { chart: { type: options.chartType ?? 'column', data: { columns: names, rows } } };
}
