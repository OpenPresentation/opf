// RR-54: chart and table data. One strict number rule, one number format language (the NumberVariable syntax) with its
// Excel code conversion, shared top-level datasets and series mapping by column name. The preview (opf-render), the
// PPTX exporter and importer (opf-pptx), the editor and the validator all resolve chart and table data here, so a
// value is a number (or a gap) in exactly the same cases everywhere. See docs/chart-table-data.md.
//
// Browser-safe and synchronous: no file access, no network, no fonts or DOM.
import { chartOptionTarget } from './chart-options.js';
import { formatVariableNumber } from './variables.js';

/** A scalar data cell (chart data, dataset rows). */
export type DataCellValue = string | number | boolean | null;
/** A named column with an optional number format. The string column form is `{ name }` with no format. */
export interface DataColumn { name: string; format?: string }
/** Provenance of inline data or a dataset. Engines never read, fetch or refresh it. */
export interface DataSourceRef { src: string; sheet?: string; range?: string; fields?: string[]; retrieved?: string; description?: string }
/** One shared data table in the top-level `datasets` map. */
export interface Dataset { title?: string; description?: string; columns: (string | DataColumn)[]; rows: DataCellValue[][]; source?: DataSourceRef }
/** Chart data (or, as `{ dataset, fields }`, a table) taken from a top-level dataset. */
export interface DatasetRef { dataset: string; fields?: string[] }
/** `chart.mapping`: the category, X and series columns by name (after any `fields` selection). */
export interface ChartMapping { category?: string; x?: string; series?: string[] }

/** A text run as table cells and headers hold them (see the schema `TextRun`). */
export type DataTextRun = string | { text: string; [key: string]: unknown };
/** A table cell's value: a scalar or rich runs. */
export type DataTableValue = string | number | boolean | null | DataTextRun[];
/** A styled or spanning table cell, optionally with a number format. */
export interface DataStyledCell { value: DataTableValue; style?: Record<string, unknown>; colSpan?: number; rowSpan?: number; format?: string }
/** A table body cell. */
export type DataTableCell = DataTableValue | DataStyledCell;
/** A table column header: a cell, or a DataColumn. */
export type DataTableHeader = DataTableCell | DataColumn;

export type DataDiagnosticCode =
  | 'chart-value-not-numeric'
  | 'chart-data-source-unresolved'
  | 'dataset-unknown'
  | 'dataset-field-unknown'
  | 'data-column-duplicate'
  | 'chart-mapping-unknown-column'
  | 'chart-mapping-adapted'
  | 'number-format-invalid';

export interface DataDiagnostic {
  code: DataDiagnosticCode;
  severity: 'error' | 'warning';
  /** JSON Pointer of the offending value: below the `path` option for the chart or table, or into `/datasets/<id>`. */
  path: string;
  message: string;
}

export interface DataResolveOptions {
  /** JSON Pointer of the chart or table object, used as the base of diagnostic paths. Default: "" (paths start at `/data` or `/rows`). */
  path?: string;
}

export type ResolvedChartData =
  | {
      ok: true;
      /** Column names in canonical order: category, then (scatter only) X, then every series. */
      columns: string[];
      /** The number format of each column (from its DataColumn), aligned with `columns`. */
      formats: (string | undefined)[];
      /** Category cells as authored; X and series cells passed through `chartNumber` (null is a gap). */
      rows: DataCellValue[][];
      source?: DataSourceRef;
      /** The dataset id when the chart references one. */
      dataset?: string;
      diagnostics: DataDiagnostic[];
    }
  | {
      ok: false;
      reason: 'data-not-inline' | 'dataset-unknown' | 'no-rows' | 'no-columns';
      message: string;
      diagnostics: DataDiagnostic[];
    };

export interface ResolvedTableData {
  /** Headers as authored (dataset tables: the dataset's columns after `fields`), or undefined for a table without headers. */
  columns?: DataTableHeader[];
  rows: DataTableCell[][];
  /** The column number formats (DataColumn or header StyledTableCell `format`), by column index. */
  formats: (string | undefined)[];
  /** The dataset id when the table references one. */
  dataset?: string;
  diagnostics: DataDiagnostic[];
}

const record = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null && !Array.isArray(value);
const own = (value: object, key: string): boolean => Object.hasOwn(value, key);
const segment = (key: string | number): string => String(key).replaceAll('~', '~0').replaceAll('/', '~1');
const at = (base: string, ...keys: (string | number)[]): string => `${base}${keys.map(key => `/${segment(key)}`).join('')}`;

// ---------------------------------------------------------------------------------------------------------------
// Numbers

/** Strict decimal syntax: an optional minus, no leading zeros, optional decimals and exponent. No grouping, currency or percent. */
const STRICT_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

/**
 * Strict chart number: finite numbers, and strings in strict decimal syntax (trimmed). Everything else is null (a gap):
 * `"12%"`, `"$5"`, `"(5)"`, `"1,234"`, `"1.234,5"`, `"Q1"`, `""`, booleans and null. An integer string beyond the safe
 * integer range is a gap too, as in data import.
 */
export function chartNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!STRICT_DECIMAL.test(text)) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number))) return null;
  return number;
}

/** Why a NumberFormat is invalid, or undefined for a valid one. An absent format is valid (General). */
export function numberFormatError(format: unknown): string | undefined {
  if (format === undefined) return undefined;
  if (typeof format !== 'string' || format === '') return 'A number format is a non-empty pattern such as "#,##0" or "0.0%".';
  const result = formatVariableNumber(0, format);
  return 'error' in result ? result.error : undefined;
}

/** Format a number with a NumberFormat; an absent or invalid format prints the General form (String(value)). */
export function formatDataNumber(value: number, format?: string): string {
  if (format === undefined || format === '' || !Number.isFinite(value)) return String(value);
  const result = formatVariableNumber(value, format);
  return 'text' in result ? result.text : String(value);
}

// ---------------------------------------------------------------------------------------------------------------
// Excel number format codes

interface FormatParts { prefix: string; integer: string; decimals: string; suffix: string }

/** Split a NumberFormat exactly as formatVariableNumber reads it. */
function formatParts(format: string): FormatParts | undefined {
  const match = /^([^#0,.]*)((?:[#0,]*)(?:\.[#0]+)?)([\s\S]*)$/.exec(format);
  const numeric = match?.[2] ?? '';
  if (!match || !/[#0]/.test(numeric)) return undefined;
  const [integer = '', decimals = ''] = numeric.split('.');
  return { prefix: match[1] ?? '', integer, decimals, suffix: match[3] ?? '' };
}

// Characters Excel displays as themselves without quotes. Everything else in literal text is quoted.
const EXCEL_SAFE = new Set([...'$-+/():!^&\'~{}<>= ']);

function excelLiteral(text: string, percent: { used: boolean }): string {
  let out = '';
  let quoted = '';
  const flush = () => { if (quoted) { out += `"${quoted}"`; quoted = ''; } };
  for (const char of text) {
    if (char === '%' && !percent.used) { flush(); out += '%'; percent.used = true; continue; }
    if (char === '"') { flush(); out += '\\"'; continue; }
    if (EXCEL_SAFE.has(char)) { flush(); out += char; continue; }
    quoted += char;
  }
  flush();
  return out;
}

/** The integer placeholders in Excel form: commas only between placeholders (Excel reads a trailing comma as a scale). */
function excelInteger(integer: string): string {
  const grouping = integer.includes(',');
  const digits = integer.replaceAll(',', '');
  if (!grouping) return digits;
  // Canonical grouping: at least four placeholders so one comma sits between them, zeros on the right.
  const zeros = [...digits].filter(char => char === '0').length;
  const width = Math.max(4, digits.length);
  const placeholders = '#'.repeat(width - zeros) + '0'.repeat(zeros);
  return placeholders.replace(/\B(?=(.{3})+$)/g, ',');
}

/** NumberFormat -> Excel format code ("General" when absent or invalid). Literal prefix/suffix text is quoted or escaped. */
export function excelNumberFormat(format?: string): string {
  if (format === undefined || format === '') return 'General';
  const parts = formatParts(format);
  if (!parts) return 'General';
  const percent = { used: false };
  const minDecimals = [...parts.decimals].filter(char => char === '0').length;
  const decimals = parts.decimals ? `.${'0'.repeat(minDecimals)}${'#'.repeat(parts.decimals.length - minDecimals)}` : '';
  const prefix = excelLiteral(parts.prefix, percent);
  const body = `${excelInteger(parts.integer)}${decimals}`;
  return `${prefix}${body}${excelLiteral(parts.suffix, percent)}`;
}

type ExcelToken = { kind: 'literal'; text: string; quoted: boolean } | { kind: 'percent' } | { kind: 'placeholder'; text: string };

function excelTokens(code: string): ExcelToken[] | undefined {
  const tokens: ExcelToken[] = [];
  for (let i = 0; i < code.length; i++) {
    const char = code[i]!;
    if (char === '"') {
      const end = code.indexOf('"', i + 1);
      if (end < 0) return undefined;
      tokens.push({ kind: 'literal', text: code.slice(i + 1, end), quoted: true });
      i = end;
    } else if (char === '\\') {
      if (i + 1 >= code.length) return undefined;
      tokens.push({ kind: 'literal', text: code[i + 1]!, quoted: true });
      i++;
    } else if (char === '[') {
      const end = code.indexOf(']', i + 1);
      if (end < 0) return undefined;
      // Only a locale currency block ([$€-407], [$$-409]) has an exact equivalent: its symbol as literal text.
      const currency = /^\$([^-\]]*)(?:-[0-9A-Fa-f]+)?$/.exec(code.slice(i + 1, end));
      if (!currency) return undefined;
      tokens.push({ kind: 'literal', text: currency[1] ?? '', quoted: true });
      i = end;
    } else if (char === '%') tokens.push({ kind: 'percent' });
    else if ('#0,.'.includes(char)) tokens.push({ kind: 'placeholder', text: char });
    else if (EXCEL_SAFE.has(char)) tokens.push({ kind: 'literal', text: char, quoted: false });
    // ';' (sections), '?', '@', '*', '_', 'E', digits 1-9 and letters (dates, General) have no exact NumberFormat form.
    else return undefined;
  }
  return tokens;
}

/** Excel format code -> NumberFormat, or undefined when the code has no exact NumberFormat equivalent (General -> undefined). */
export function numberFormatFromExcel(code: string): string | undefined {
  if (typeof code !== 'string') return undefined;
  const trimmed = code.trim();
  if (trimmed === '' || /^general$/i.test(trimmed)) return undefined;
  const tokens = excelTokens(code);
  if (!tokens) return undefined;
  const first = tokens.findIndex(token => token.kind === 'placeholder');
  if (first < 0) return undefined;
  let last = first;
  while (last + 1 < tokens.length && tokens[last + 1]!.kind === 'placeholder') last++;
  if (tokens.slice(last + 1).some(token => token.kind === 'placeholder')) return undefined;
  const numeric = tokens.slice(first, last + 1).map(token => (token as { text: string }).text).join('');
  // One run of placeholders: integer part, optional decimals. A comma must sit between integer placeholders (a trailing
  // comma scales by 1000 in Excel, which NumberFormat cannot say).
  const match = /^([#0,]*)(?:\.([#0]+))?$/.exec(numeric);
  if (!match || !/[#0]/.test(numeric)) return undefined;
  const integer = match[1] ?? '';
  if (/^,|,$/.test(integer) || integer.includes(',,')) return undefined;
  if (/,/.test(integer) && !/[#0]/.test(integer)) return undefined;
  const percentTokens = tokens.filter(token => token.kind === 'percent').length;
  const literalText = (list: ExcelToken[]) => list.map(token => token.kind === 'percent' ? '%' : token.kind === 'literal' ? token.text : '').join('');
  const quotedPercent = tokens.some(token => token.kind === 'literal' && token.quoted && token.text.includes('%'));
  // NumberFormat scales by 100 once when any '%' appears; Excel once per unquoted '%'.
  if (percentTokens > 1 || (percentTokens === 0 && quotedPercent)) return undefined;
  const prefix = literalText(tokens.slice(0, first));
  const suffix = literalText(tokens.slice(last + 1));
  const format = `${prefix}${numeric}${suffix}`;
  // The NumberFormat must read back as the same three parts (a prefix may not hold '#', '0', ',' or '.').
  const parts = formatParts(format);
  if (!parts || parts.prefix !== prefix || parts.suffix !== suffix) return undefined;
  return format;
}

// ---------------------------------------------------------------------------------------------------------------
// Columns and datasets

function columnName(column: unknown): string | undefined {
  if (typeof column === 'string') return column;
  if (record(column) && typeof column.name === 'string') return column.name;
  return undefined;
}
function columnFormat(column: unknown): string | undefined {
  return record(column) && typeof column.format === 'string' ? column.format : undefined;
}

function datasetsOf(document: unknown): Record<string, unknown> {
  return record(document) && record(document.datasets) ? document.datasets : {};
}

/** True when the value is a dataset reference (`{ dataset: "<id>" }`). */
export function isDatasetRef(value: unknown): value is DatasetRef {
  return record(value) && typeof value.dataset === 'string';
}

interface Selection { names: string[]; formats: (string | undefined)[]; columns: unknown[]; indices: number[] }

/** Select (and order) columns by `fields`; report unknown and ambiguous names. */
function selectFields(columns: unknown[], fields: unknown, fieldsPath: string, columnsPath: string, diagnostics: DataDiagnostic[]): Selection {
  const names = columns.map(column => columnName(column) ?? '');
  if (!Array.isArray(fields)) return { names, formats: columns.map(columnFormat), columns, indices: names.map((_, index) => index) };
  duplicateColumns(names, columnsPath, diagnostics);
  const indices: number[] = [];
  fields.forEach((field, index) => {
    const found = typeof field === 'string' ? names.indexOf(field) : -1;
    if (found < 0) diagnostics.push({ code: 'dataset-field-unknown', severity: 'error', path: at(fieldsPath, index), message: `field ${JSON.stringify(field)} is not a column of the dataset; use one of ${names.map(name => JSON.stringify(name)).join(', ')}` });
    else indices.push(found);
  });
  return { names: indices.map(index => names[index]!), formats: indices.map(index => columnFormat(columns[index])), columns: indices.map(index => columns[index]), indices };
}

function duplicateColumns(names: string[], columnsPath: string, diagnostics: DataDiagnostic[]): void {
  const seen = new Set<string>();
  names.forEach((name, index) => {
    if (seen.has(name)) diagnostics.push({ code: 'data-column-duplicate', severity: 'error', path: at(columnsPath, index), message: `column name ${JSON.stringify(name)} is used by an earlier column; column names must be unique where fields or a chart mapping address them` });
    seen.add(name);
  });
}

function formatDiagnostics(columns: unknown[], columnsPath: string, diagnostics: DataDiagnostic[]): void {
  columns.forEach((column, index) => {
    if (!record(column) || column.format === undefined) return;
    const error = numberFormatError(column.format);
    if (error) diagnostics.push({ code: 'number-format-invalid', severity: 'error', path: at(columnsPath, index, 'format'), message: error });
  });
}

/** Diagnostics of the top-level datasets themselves: duplicate column names and invalid column formats. */
export function datasetDiagnostics(document: unknown): DataDiagnostic[] {
  const diagnostics: DataDiagnostic[] = [];
  for (const [id, dataset] of Object.entries(datasetsOf(document))) {
    if (!record(dataset) || !Array.isArray(dataset.columns)) continue;
    const columnsPath = at('/datasets', id, 'columns');
    duplicateColumns(dataset.columns.map(column => columnName(column) ?? ''), columnsPath, diagnostics);
    formatDiagnostics(dataset.columns, columnsPath, diagnostics);
  }
  return diagnostics;
}

function inlineColumn(column: unknown): string | DataColumn {
  const name = columnName(column) ?? '';
  const format = columnFormat(column);
  return format === undefined ? name : { name, format };
}

/** The inline copy of a dataset reference, or undefined when the id or a field is unknown. */
function inlinedData(ref: DatasetRef | Record<string, unknown>, datasets: Record<string, unknown>): { columns: (string | DataColumn)[]; rows: DataCellValue[][]; source?: DataSourceRef } | undefined {
  const id = ref.dataset as string;
  const dataset = own(datasets, id) ? datasets[id] : undefined;
  if (!record(dataset) || !Array.isArray(dataset.columns) || !Array.isArray(dataset.rows)) return undefined;
  const diagnostics: DataDiagnostic[] = [];
  const selection = selectFields(dataset.columns, ref.fields, '', '', diagnostics);
  if (diagnostics.some(entry => entry.code === 'dataset-field-unknown')) return undefined;
  const rows = dataset.rows.map((row: unknown) => selection.indices.map(index => (Array.isArray(row) && index < row.length ? structuredClone(row[index]) : null) as DataCellValue));
  return { columns: selection.columns.map(inlineColumn), rows, ...(record(dataset.source) ? { source: structuredClone(dataset.source) as DataSourceRef } : {}) };
}

/**
 * Pure: a copy of the document where every chart and table DatasetRef is replaced by inline data (columns as
 * DataColumn when a format applies, rows copied; a chart also takes the dataset's `source`). `datasets` stays in
 * place. Unknown ids (and references naming an unknown field) are left as they are.
 */
export function inlineDatasets<T>(document: T): T {
  if (!record(document)) return document;
  const copy = structuredClone(document) as Record<string, any>;
  const datasets = datasetsOf(copy);
  if (!Object.keys(datasets).length) return copy as T;
  visitDataPayloads(copy, payload => {
    if (record(payload.chart) && isDatasetRef(payload.chart.data)) {
      const inline = inlinedData(payload.chart.data, datasets);
      if (inline) payload.chart.data = inline;
    }
    if (record(payload.table) && isDatasetRef(payload.table)) payload.table = inlineTable(payload.table, datasets) ?? payload.table;
  });
  return copy as T;
}

/** The inline form of a dataset-backed table (`{ columns, rows }`), or undefined when the id or a field is unknown. */
function inlineTable(table: Record<string, any>, datasets: Record<string, unknown>): Record<string, unknown> | undefined {
  const inline = inlinedData(table, datasets);
  if (!inline) return undefined;
  const { dataset: _dataset, fields: _fields, ...rest } = table;
  return { ...rest, columns: inline.columns, rows: inline.rows };
}

/** A table in inline form: a dataset-backed table is copied from the document's dataset; anything else is returned as is. */
export function inlineTableData<T>(table: T, document?: unknown): T {
  if (!record(table) || !isDatasetRef(table)) return table;
  return (inlineTable(table, datasetsOf(document)) ?? table) as T;
}

/** A chart in inline form: a dataset reference in `data` is copied from the document's dataset; anything else is returned as is. */
export function inlineChartData<T>(chart: T, document?: unknown): T {
  if (!record(chart) || !isDatasetRef(chart.data)) return chart;
  const inline = inlinedData(chart.data, datasetsOf(document));
  return (inline ? { ...chart, data: inline } : chart) as T;
}

/** Visit every chart and table payload of every slide (root, nested blocks, promoted regions). */
function visitDataPayloads(document: Record<string, any>, visit: (payload: Record<string, any>) => void): void {
  if (!Array.isArray(document.slides)) return;
  const walk = (payload: Record<string, any>, depth: number, ancestors: unknown[]): void => {
    visit(payload);
    if (depth >= 32 || ancestors.includes(payload) || !Array.isArray(payload.blocks)) return;
    const nested = [...ancestors, payload];
    for (const block of payload.blocks) if (record(block)) walk(block, depth + 1, nested);
  };
  for (const slide of document.slides) {
    if (!record(slide)) continue;
    walk(slide, 0, []);
    for (const [key, value] of Object.entries(slide)) if (record(value) && /^(top|middle|bottom|left|center|right)([+:]|$)/.test(key)) walk(value, 1, [slide]);
  }
}

/** The ids of top-level datasets that no chart or table references, in declaration order. */
export function unusedDatasets(document: unknown): string[] {
  const datasets = datasetsOf(document);
  const ids = Object.keys(datasets);
  if (!ids.length || !record(document)) return [];
  const used = new Set<string>();
  visitDataPayloads(document, payload => {
    if (record(payload.chart) && isDatasetRef(payload.chart.data)) used.add(payload.chart.data.dataset);
    if (record(payload.table) && isDatasetRef(payload.table)) used.add(payload.table.dataset);
  });
  return ids.filter(id => !used.has(id));
}

// ---------------------------------------------------------------------------------------------------------------
// Charts

/** True for a chart type with an X value axis (scatter; deprecated ids resolve through their replacement first). */
export function isXYChartType(type: unknown): boolean {
  return chartOptionTarget(type)?.kind === 'scatter';
}

const VARIABLE_REFERENCE = /^var:([a-z][a-z0-9-]*)$/;

function numberVariable(document: unknown, cell: unknown): boolean {
  if (typeof cell !== 'string') return false;
  const id = VARIABLE_REFERENCE.exec(cell)?.[1];
  if (!id || !record(document) || !record(document.variables)) return false;
  const variable = document.variables[id];
  return record(variable) && variable.type === 'number';
}

/**
 * Resolve a chart's data to the canonical positional table: [category, (x,) ...series].
 * Category cells are kept as authored; X and series cells pass through chartNumber.
 * Inline ChartData, a DatasetRef (needs the document) and mapping are resolved here.
 */
export function resolveChartData(chart: unknown, document?: unknown, options: DataResolveOptions = {}): ResolvedChartData {
  const base = options.path ?? '';
  const diagnostics: DataDiagnostic[] = [];
  const fail = (reason: 'data-not-inline' | 'dataset-unknown' | 'no-rows' | 'no-columns', message: string): ResolvedChartData => ({ ok: false, reason, message, diagnostics });
  const data = record(chart) ? chart.data : undefined;
  if (!record(data)) return fail('no-columns', 'The chart has no data.');
  let columns: unknown[];
  let rows: unknown[];
  let columnsPath: string;
  let rowsPath: string;
  let source: DataSourceRef | undefined;
  let datasetId: string | undefined;
  let selected: number[] | undefined;
  if (isDatasetRef(data)) {
    datasetId = data.dataset;
    const datasets = datasetsOf(document);
    const dataset = own(datasets, datasetId) ? datasets[datasetId] : undefined;
    if (!record(dataset) || !Array.isArray(dataset.columns) || !Array.isArray(dataset.rows)) {
      diagnostics.push({ code: 'dataset-unknown', severity: 'error', path: at(base, 'data', 'dataset'), message: `unknown dataset '${datasetId}'; add it to the top-level datasets map` });
      return fail('dataset-unknown', `The chart references dataset '${datasetId}', which the document does not hold.`);
    }
    columnsPath = at('/datasets', datasetId, 'columns');
    rowsPath = at('/datasets', datasetId, 'rows');
    formatDiagnostics(dataset.columns, columnsPath, diagnostics);
    const selection = selectFields(dataset.columns, data.fields, at(base, 'data', 'fields'), columnsPath, diagnostics);
    columns = selection.columns;
    selected = selection.indices;
    rows = dataset.rows;
    if (record(dataset.source)) source = dataset.source as DataSourceRef;
  } else if (typeof data.src === 'string') {
    diagnostics.push({ code: 'chart-data-source-unresolved', severity: 'warning', path: at(base, 'data', 'src'), message: `chart data source '${data.src}' is not loaded by any engine; the preview and export draw a placeholder. Import the data inline (columns and rows, with a 'source' for provenance) or reference a dataset` });
    return fail('data-not-inline', 'The chart reads an external data source, which no engine resolves.');
  } else {
    if (!Array.isArray(data.columns)) return fail('no-columns', 'The chart data has no columns.');
    columns = data.columns;
    rows = Array.isArray(data.rows) ? data.rows : [];
    columnsPath = at(base, 'data', 'columns');
    rowsPath = at(base, 'data', 'rows');
    formatDiagnostics(columns, columnsPath, diagnostics);
    if (record(data.source)) source = data.source as DataSourceRef;
  }
  if (!columns.length) return fail('no-columns', 'The chart data has no columns.');
  const names = columns.map(column => columnName(column) ?? '');
  const formats = columns.map(columnFormat);
  const mapping = record(chart) && record(chart.mapping) ? chart.mapping : undefined;
  if (mapping && !selected) duplicateColumns(names, columnsPath, diagnostics);
  const mappingPath = at(base, 'mapping');
  const xy = isXYChartType(record(chart) ? chart.type : undefined);
  const known = (name: unknown, path: string): number | undefined => {
    if (name === undefined) return undefined;
    const index = typeof name === 'string' ? names.indexOf(name) : -1;
    if (index < 0) {
      diagnostics.push({ code: 'chart-mapping-unknown-column', severity: 'error', path, message: `mapping names column ${JSON.stringify(name)}, which the chart data does not have; use one of ${names.map(entry => JSON.stringify(entry)).join(', ')}` });
      return undefined;
    }
    return index;
  };
  const category = known(mapping?.category, at(mappingPath, 'category')) ?? 0;
  let x: number | undefined;
  if (xy) {
    let mapped = known(mapping?.x, at(mappingPath, 'x'));
    if (mapped === category) {
      diagnostics.push({ code: 'chart-mapping-adapted', severity: 'warning', path: at(mappingPath, 'x'), message: `the X column ${JSON.stringify(names[category])} is also the category column; the default X column is used` });
      mapped = undefined;
    }
    x = mapped ?? (category === 1 ? 0 : 1);
    if (x >= names.length || x === category) x = undefined;
  } else if (mapping?.x !== undefined) {
    diagnostics.push({ code: 'chart-mapping-adapted', severity: 'warning', path: at(mappingPath, 'x'), message: `a '${String(record(chart) ? chart.type : '')}' chart has no X value axis; mapping.x is ignored` });
  }
  let series: number[];
  if (Array.isArray(mapping?.series)) {
    series = [];
    mapping.series.forEach((name: unknown, index: number) => {
      const path = at(mappingPath, 'series', index);
      const found = known(name, path);
      if (found === undefined) return;
      if (found === category || found === x) {
        diagnostics.push({ code: 'chart-mapping-adapted', severity: 'warning', path, message: `series ${JSON.stringify(name)} is the ${found === category ? 'category' : 'X'} column; it is not plotted as a series` });
        return;
      }
      if (series.includes(found)) {
        diagnostics.push({ code: 'chart-mapping-adapted', severity: 'warning', path, message: `series ${JSON.stringify(name)} is listed twice; it is plotted once` });
        return;
      }
      series.push(found);
    });
  } else series = names.map((_, index) => index).filter(index => index !== category && index !== x);
  const order = [category, ...(x === undefined ? [] : [x]), ...series];
  if (!rows.length) return fail('no-rows', 'The chart data has no rows.');
  const out: DataCellValue[][] = rows.map((row, rowIndex) => order.map((column, position) => {
    const sourceIndex = selected ? selected[column]! : column;
    const cell = Array.isArray(row) && sourceIndex < row.length ? row[sourceIndex] : null;
    if (position === 0) return (cell === undefined ? null : cell) as DataCellValue;
    const number = chartNumber(cell);
    if (number === null && cell !== null && cell !== undefined && cell !== '' && !numberVariable(document, cell)) {
      diagnostics.push({ code: 'chart-value-not-numeric', severity: 'warning', path: at(rowsPath, rowIndex, sourceIndex), message: `chart value ${JSON.stringify(cell)} is not a number; it is plotted as a gap. Write numbers as plain decimals (12, -3.5, 1e6) and put units, currency and percent in the column format` });
    }
    return number;
  }));
  return {
    ok: true,
    columns: order.map(index => names[index]!),
    formats: order.map(index => formats[index]),
    rows: out,
    ...(source ? { source } : {}),
    ...(datasetId !== undefined ? { dataset: datasetId } : {}),
    diagnostics,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Tables

function cellFormat(cell: unknown): string | undefined {
  return record(cell) && own(cell, 'value') && typeof cell.format === 'string' ? cell.format : undefined;
}

/** Resolve a table (inline or dataset-backed) to headers, rows and per-column formats. */
export function resolveTableData(table: unknown, document?: unknown, options: DataResolveOptions = {}): ResolvedTableData {
  const base = options.path ?? '';
  const diagnostics: DataDiagnostic[] = [];
  if (!record(table)) return { rows: [], formats: [], diagnostics };
  if (isDatasetRef(table)) {
    const id = table.dataset;
    const datasets = datasetsOf(document);
    const dataset = own(datasets, id) ? datasets[id] : undefined;
    if (!record(dataset) || !Array.isArray(dataset.columns) || !Array.isArray(dataset.rows)) {
      diagnostics.push({ code: 'dataset-unknown', severity: 'error', path: at(base, 'dataset'), message: `unknown dataset '${id}'; add it to the top-level datasets map` });
      return { rows: [], formats: [], dataset: id, diagnostics };
    }
    const columnsPath = at('/datasets', id, 'columns');
    formatDiagnostics(dataset.columns, columnsPath, diagnostics);
    const selection = selectFields(dataset.columns, table.fields, at(base, 'fields'), columnsPath, diagnostics);
    const rows = dataset.rows.map((row: unknown) => selection.indices.map(index => (Array.isArray(row) && index < row.length ? row[index] : null) as DataTableCell));
    return { columns: selection.columns as DataTableHeader[], rows, formats: selection.formats, dataset: id, diagnostics };
  }
  const columns = Array.isArray(table.columns) ? (table.columns as DataTableHeader[]) : undefined;
  const rows = Array.isArray(table.rows) ? (table.rows.filter(Array.isArray) as DataTableCell[][]) : [];
  const width = Math.max(columns?.length ?? 0, ...rows.map(row => row.length), 0);
  const formats: (string | undefined)[] = Array.from({ length: width }, (_, index) => {
    const header = columns?.[index];
    return columnFormat(header) ?? cellFormat(header);
  });
  const check = (cell: unknown, path: string) => {
    if (!record(cell) || cell.format === undefined) return;
    const error = numberFormatError(cell.format);
    if (error) diagnostics.push({ code: 'number-format-invalid', severity: 'error', path: at(path, 'format'), message: error });
  };
  columns?.forEach((header, index) => { check(header, at(base, 'columns', index)); });
  if (Array.isArray(table.rows)) table.rows.forEach((row: unknown, rowIndex: number) => {
    if (Array.isArray(row)) row.forEach((cell, index) => { check(cell, at(base, 'rows', rowIndex, index)); });
  });
  return { ...(columns ? { columns } : {}), rows, formats, diagnostics };
}

/** Display value of a table cell: a number with a format (cell, else column) becomes formatted text; anything else is returned unchanged. */
export function tableCellDisplayValue(cell: DataTableCell, columnFormat?: string): DataTableCell {
  if (record(cell) && own(cell, 'value')) {
    const styled = cell as DataStyledCell;
    const format = typeof styled.format === 'string' ? styled.format : columnFormat;
    if (typeof styled.value !== 'number' || format === undefined || numberFormatError(format)) return cell;
    return { ...styled, value: formatDataNumber(styled.value, format) };
  }
  if (typeof cell !== 'number' || columnFormat === undefined || numberFormatError(columnFormat)) return cell;
  return formatDataNumber(cell, columnFormat);
}
