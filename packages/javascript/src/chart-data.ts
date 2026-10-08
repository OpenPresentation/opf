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
/** One series of a combo chart: drawn as a clustered column or as a line with markers, against the primary (left) or secondary (right) value axis. */
export interface ChartComboSeries { role: 'bar' | 'line'; axis: 'primary' | 'secondary' }

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
  | 'dataset-unknown'
  | 'dataset-field-unknown'
  | 'data-column-duplicate'
  | 'chart-mapping-unknown-column'
  | 'chart-mapping-adapted'
  | 'chart-highlight-unknown-name'
  | 'chart-highlight-adapted'
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
      /**
       * True when `columns[1]` is the X column: an XY chart with three or more resolved columns. An XY chart with two
       * columns has no X column; its second column is the one series, plotted against row numbers (the legacy rule).
       */
      hasX: boolean;
      /** The number format of each column (from its DataColumn), aligned with `columns`. */
      formats: (string | undefined)[];
      /** Category cells as authored; X and series cells (and a lone column, which has no category) passed through `chartNumber` (null is a gap). */
      rows: DataCellValue[][];
      source?: DataSourceRef;
      /** The dataset id when the chart references one. */
      dataset?: string;
      /**
       * Combo charts only (FA-15): how each series is drawn, aligned with the series columns (`columns.slice(1)`). The series
       * are ordered column series first, then the line series on the primary axis, then those on the secondary axis, each in
       * plotted order, so every engine draws, exports and lists them in the legend alike.
       */
      combo?: ChartComboSeries[];
      diagnostics: DataDiagnostic[];
    }
  | {
      ok: false;
      reason: 'dataset-unknown' | 'no-rows' | 'no-columns';
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
 * `"12%"`, `"$5"`, `"(5)"`, `"1,234"`, `"1.234,5"`, `"Q1"`, `""`, booleans and null. A plain digit string beyond the safe
 * integer range is a gap too, as in data import (it is usually an identifier that would lose digits); a decimal or exponent
 * form such as `"1e20"` is a number.
 */
export function chartNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!STRICT_DECIMAL.test(text)) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || (/^-?\d+$/.test(text) && !Number.isSafeInteger(number))) return null;
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

// Characters Excel displays as themselves without quotes. Everything else in literal text is quoted. '/' is not one of
// them: unquoted it is Excel's fraction bar, and PowerPoint drops a code such as `0.0 "m"/"s"` to General on load (native
// check opf#387). Excel's other special characters ('E+', '@', '*', '_', '?', '\', letters) are quoted too.
const EXCEL_SAFE = new Set([...'$-+():!^&\'~{}<>= ']);

function excelLiteral(text: string, percent: { used: boolean }): string {
  let out = '';
  let quoted = '';
  const flush = () => { if (quoted) { out += `"${quoted}"`; quoted = ''; } };
  for (const char of text) {
    if (char === '%' && !percent.used) { flush(); out += '%'; percent.used = true; continue; }
    if (char === '"') { flush(); out += '\\"'; continue; }
    // Once literal text is quoted, the run stays in one quoted string ("m/s", "items/day", "km/h "), so a safe character
    // between letters never splits it; a safe character before any quoted text stays bare ("$", " ").
    if (EXCEL_SAFE.has(char) && quoted === '') { out += char; continue; }
    quoted += char;
  }
  flush();
  return out;
}

/**
 * The integer placeholders in Excel form: '#' before '0' (NumberFormat counts the zeros; Excel reads placeholders by
 * position, so `0#` would pad to two digits there), and commas only between placeholders (Excel reads a trailing comma
 * as a scale).
 */
function excelInteger(integer: string): string {
  const grouping = integer.includes(',');
  const digits = integer.replaceAll(',', '');
  if (!grouping) {
    const zeros = [...digits].filter(char => char === '0').length;
    return '#'.repeat(digits.length - zeros) + '0'.repeat(zeros);
  }
  // Canonical grouping: at least four placeholders so one comma sits between them, zeros on the right.
  const zeros = [...digits].filter(char => char === '0').length;
  const width = Math.max(4, digits.length);
  const placeholders = '#'.repeat(width - zeros) + '0'.repeat(zeros);
  return placeholders.replace(/\B(?=(.{3})+$)/g, ',');
}

/** NumberFormat -> Excel format code ("General" when absent or invalid). Literal prefix/suffix text is quoted or escaped; placeholders are written '#' before '0' ("0#" -> "#0"). */
export function toExcelNumberFormat(format?: string): string {
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

/** Excel format code -> NumberFormat, or undefined when the code has no exact NumberFormat equivalent (General, sections, scaling commas, and placeholder orders Excel reads by position such as "0#" or "0.#0"). */
export function fromExcelNumberFormat(code: string): string | undefined {
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
  // Excel reads placeholders by position and NumberFormat counts zeros: they agree only when every '#' precedes every
  // '0' in the integer part and every '0' precedes every '#' in the decimals. Other orders ('0#', '0.#0') are not mapped.
  if (/0[#,]*#/.test(integer) || /#0/.test(match[2] ?? '')) return undefined;
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

/** True for a chart type with an X value axis (scatter). */
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
  const fail = (reason: 'dataset-unknown' | 'no-rows' | 'no-columns', message: string): ResolvedChartData => ({ ok: false, reason, message, diagnostics });
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
    // The default X column needs three or more columns (the legacy rule of both engines): with two, the second column
    // is the one series, plotted against row numbers. An X that leaves no series is adapted below.
    x = mapped ?? (names.length > 2 ? (category === 1 ? 0 : 1) : undefined);
    if (x !== undefined && (x >= names.length || x === category)) x = undefined;
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
  // An X column needs at least one series beside it; otherwise it is plotted as the series against row numbers.
  if (x !== undefined && !series.length) {
    diagnostics.push({ code: 'chart-mapping-adapted', severity: 'warning', path: at(mappingPath, mapping?.x !== undefined ? 'x' : 'series'), message: `no series is left beside the X column ${JSON.stringify(names[x])}; it is plotted as the series against row numbers` });
    series = [x];
    x = undefined;
  }
  // FA-15: a combo chart draws its series as clustered columns, except the ones `line` names (default: the last series),
  // which are lines with markers; `secondaryAxis` moves line series to a secondary value axis. Column series come first, then
  // the primary-axis lines, then the secondary-axis lines (one native chart group each, so the PPTX series order is this order).
  let combo: ChartComboSeries[] | undefined;
  if (record(chart) && chartOptionTarget(chart.type)?.kind === 'combo') {
    const listed = (option: 'line' | 'secondaryAxis', problem: (column: number) => string | undefined): Set<number> => {
      const found = new Set<number>();
      const value = chart[option];
      if (!Array.isArray(value)) return found;
      value.forEach((name: unknown, index: number) => {
        const path = at(base, option, index);
        const column = known(name, path);
        if (column === undefined) return;
        const reason = problem(column);
        if (reason) diagnostics.push({ code: 'chart-mapping-adapted', severity: 'warning', path, message: `${JSON.stringify(name)} ${reason}` });
        else found.add(column);
      });
      return found;
    };
    const notPlotted = 'is not a plotted series of the chart';
    const lines = listed('line', column => series.includes(column) ? undefined : `${notPlotted}; it is not drawn as a line`);
    if (chart.line === undefined && series.length >= 2) lines.add(series[series.length - 1]!);
    if (series.length && series.every(column => lines.has(column))) {
      lines.delete(series[0]!);
      diagnostics.push({ code: 'chart-mapping-adapted', severity: 'warning', path: at(base, chart.line === undefined ? 'type' : 'line'), message: series.length === 1
        ? `a combo chart needs at least two series, one drawn as columns and one as a line; its one series ${JSON.stringify(names[series[0]!])} is drawn as columns`
        : `a combo chart keeps at least one column series; ${JSON.stringify(names[series[0]!])} is drawn as columns, not as a line` });
    } else if (series.length === 1) {
      diagnostics.push({ code: 'chart-mapping-adapted', severity: 'warning', path: at(base, 'type'), message: `a combo chart needs at least two series, one drawn as columns and one as a line; its one series ${JSON.stringify(names[series[0]!])} is drawn as columns` });
    }
    const secondary = listed('secondaryAxis', column => !series.includes(column)
      ? `${notPlotted}; it has no axis to move to`
      : !lines.has(column) ? 'is drawn as columns; only a line series can use the secondary axis, so it stays on the primary axis' : undefined);
    const bars = series.filter(column => !lines.has(column));
    const primaryLines = series.filter(column => lines.has(column) && !secondary.has(column));
    const secondaryLines = series.filter(column => lines.has(column) && secondary.has(column));
    series = [...bars, ...primaryLines, ...secondaryLines];
    combo = [
      ...bars.map(() => ({ role: 'bar' as const, axis: 'primary' as const })),
      ...primaryLines.map(() => ({ role: 'line' as const, axis: 'primary' as const })),
      ...secondaryLines.map(() => ({ role: 'line' as const, axis: 'secondary' as const })),
    ];
  }
  const order = [category, ...(x === undefined ? [] : [x]), ...series];
  if (!rows.length) return fail('no-rows', 'The chart data has no rows.');
  // A lone column (no category column) is the chart's values, plotted against row numbers or binned: it is read as numbers too.
  const lone = names.length === 1 && !diagnostics.some(entry => entry.code === 'dataset-field-unknown');
  const out: DataCellValue[][] = rows.map((row, rowIndex) => order.map((column, position) => {
    const sourceIndex = selected ? selected[column]! : column;
    const cell = Array.isArray(row) && sourceIndex < row.length ? row[sourceIndex] : null;
    if (position === 0 && !lone) return (cell === undefined ? null : cell) as DataCellValue;
    const number = chartNumber(cell);
    if (number === null && cell !== null && cell !== undefined && cell !== '' && !numberVariable(document, cell)) {
      diagnostics.push({ code: 'chart-value-not-numeric', severity: 'warning', path: at(rowsPath, rowIndex, sourceIndex), message: `chart value ${JSON.stringify(cell)} is not a number; it is plotted as a gap. Write numbers as plain decimals (12, -3.5, 1e6) and put units, currency and percent in the column format` });
    }
    return number;
  }));
  // FA-14: chart.highlight names plotted series (columns) and category labels (row label values).
  const highlight = record(chart) && record(chart.highlight) ? chart.highlight : undefined;
  if (highlight) {
    const plotted = order.slice(order.length - series.length).map(index => names[index]!);
    const labels = lone ? undefined : new Set(out.map(row => (row[0] === null || row[0] === undefined ? '' : String(row[0]))));
    const listed = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
    const highlightPath = at(base, 'highlight');
    listed(highlight.series).forEach((name, index) => {
      const path = at(highlightPath, 'series', index);
      if (typeof name !== 'string' || !names.includes(name)) {
        diagnostics.push({ code: 'chart-highlight-unknown-name', severity: 'error', path, message: `highlight names series ${JSON.stringify(name)}, which the chart data does not have as a column; use one of ${names.map(entry => JSON.stringify(entry)).join(', ')}` });
      } else if (!plotted.includes(name)) {
        diagnostics.push({ code: 'chart-highlight-adapted', severity: 'warning', path, message: `highlight names column ${JSON.stringify(name)}, which is not plotted as a series (it is the category or X column, or the mapping leaves it out); it highlights nothing` });
      }
    });
    listed(highlight.categories).forEach((name, index) => {
      if (typeof name === 'string' && labels?.has(name)) return;
      const shown = labels ? [...labels].slice(0, 12).map(entry => JSON.stringify(entry)).join(', ') : '';
      diagnostics.push({ code: 'chart-highlight-unknown-name', severity: 'error', path: at(highlightPath, 'categories', index), message: `highlight names category ${JSON.stringify(name)}, which no row of the chart data has as its label${shown ? `; the labels are ${shown}${labels!.size > 12 ? ', ...' : ''}` : ''}` });
    });
  }
  return {
    ok: true,
    columns: order.map(index => names[index]!),
    hasX: x !== undefined,
    formats: order.map(index => formats[index]),
    rows: out,
    ...(source ? { source } : {}),
    ...(datasetId !== undefined ? { dataset: datasetId } : {}),
    ...(combo ? { combo } : {}),
    diagnostics,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Migration help for the strict number rule

/** One JSON Patch `replace` operation of a ChartNumberFix. */
export interface ChartNumberFixOperation { op: 'replace'; path: string; value: unknown }

/** A fix for a chart value column whose text cells all share one display style (`"12%"`, `"$1,234"`, `"1,234.5"`). */
export interface ChartNumberFix {
  /**
   * JSON Patch: one `replace` per text cell (with its number), then one for the column (a DataColumn with `format`).
   * Paths are those of the `chart-value-not-numeric` diagnostics: below `options.path` for inline data, or into
   * `/datasets/<id>` for a dataset (which every chart and table that uses it shares; their text is unchanged).
   */
  patches: ChartNumberFixOperation[];
  /** Index of the column in the authored columns (`chart.data.columns`, or the dataset's columns). */
  column: number;
  /** The column name. */
  name: string;
  /** The NumberFormat that displays every number of the column exactly as its text was written. */
  format: string;
}

export interface ChartNumberFixOptions extends DataResolveOptions {
  /** The column to fix, by authored index or name. Default: the first value column that has a fix. */
  column?: number | string;
}

// One display style: an optional minus, an optional currency symbol, digits (grouped in threes or plain), optional
// decimals and an optional percent sign. '(5)', '$-5', '1.234,5', '.5', '007', '12 %' and units are not matched.
const DISPLAY_NUMBER = /^(-?)([$€£¥]?)((?:[1-9]\d{0,2}(?:,\d{3})+)|0|[1-9]\d*)(?:\.(\d+))?(%?)$/;

/** The column fix for every value column with a consistent display style, by authored column index. */
function chartNumberFixes(chart: unknown, document: unknown, options: DataResolveOptions): Map<number, ChartNumberFix> {
  const fixes = new Map<number, ChartNumberFix>();
  const resolved = resolveChartData(chart, document, options);
  if (!resolved.ok) return fixes;
  const candidates = new Set<number>();
  for (const diagnostic of resolved.diagnostics) {
    if (diagnostic.code !== 'chart-value-not-numeric') continue;
    candidates.add(Number(diagnostic.path.slice(diagnostic.path.lastIndexOf('/') + 1)));
  }
  if (!candidates.size) return fixes;
  const data = (chart as Record<string, any>).data as Record<string, any>;
  let columns: unknown[];
  let rows: unknown[];
  let columnsPath: string;
  let rowsPath: string;
  if (isDatasetRef(data)) {
    const dataset = datasetsOf(document)[data.dataset] as Record<string, any>;
    columns = dataset.columns;
    rows = dataset.rows;
    columnsPath = at('/datasets', data.dataset, 'columns');
    rowsPath = at('/datasets', data.dataset, 'rows');
  } else {
    columns = data.columns;
    rows = data.rows;
    columnsPath = at(options.path ?? '', 'data', 'columns');
    rowsPath = at(options.path ?? '', 'data', 'rows');
  }
  for (const column of [...candidates].sort((a, b) => a - b)) {
    const header = columns[column];
    const name = columnName(header);
    if (name === undefined || columnFormat(header) !== undefined) continue;
    const fix = columnFix(rows, column, rowsPath);
    if (!fix) continue;
    fixes.set(column, {
      patches: [...fix.patches, { op: 'replace', path: at(columnsPath, column), value: record(header) ? { ...header, format: fix.format } : { name, format: fix.format } }],
      column,
      name,
      format: fix.format,
    });
  }
  return fixes;
}

function columnFix(rows: unknown[], column: number, rowsPath: string): { format: string; patches: ChartNumberFixOperation[] } | undefined {
  const cells: { row: number; text: string; value: number; patch: boolean }[] = [];
  let prefix: string | undefined;
  let suffix: string | undefined;
  let grouping = false;
  let wide = false;
  const decimals: string[] = [];
  for (const [index, row] of rows.entries()) {
    const cell = Array.isArray(row) && column < row.length ? row[column] : null;
    if (cell === null || cell === undefined || cell === '') continue;
    const patch = chartNumber(cell) === null;
    if (typeof cell !== 'number' && typeof cell !== 'string') return undefined;
    const text = typeof cell === 'number' ? String(cell) : cell.trim();
    const match = DISPLAY_NUMBER.exec(text);
    if (!match) return undefined;
    const [, minus = '', currency = '', integer = '', fraction = '', percent = ''] = match;
    if ((prefix ?? currency) !== currency || (suffix ?? percent) !== percent) return undefined;
    prefix = currency;
    suffix = percent;
    if (integer.includes(',')) grouping = true;
    else if (integer.length > 3) wide = true;
    decimals.push(fraction);
    const digits = `${minus}${integer.replaceAll(',', '')}${fraction ? `.${fraction}` : ''}`;
    cells.push({ row: index, text, value: Number(percent ? `${digits}e-2` : digits), patch });
  }
  // Mixed grouping ('1,234' beside '5678') has no single format.
  if (!cells.some(cell => cell.patch) || (grouping && wide)) return undefined;
  // Decimals: the fewest written are required; every cell that shows more must not end in a zero.
  const fewest = Math.min(...decimals.map(fraction => fraction.length));
  const most = Math.max(...decimals.map(fraction => fraction.length));
  if (decimals.some(fraction => fraction.length > fewest && fraction.endsWith('0'))) return undefined;
  const format = `${prefix ?? ''}${grouping ? '#,##0' : '0'}${most ? `.${'0'.repeat(fewest)}${'#'.repeat(most - fewest)}` : ''}${suffix ?? ''}`;
  // Never guess: every value must display exactly as its text was written.
  if (cells.some(cell => !Number.isFinite(cell.value) || formatDataNumber(cell.value, format) !== cell.text)) return undefined;
  return { format, patches: cells.filter(cell => cell.patch).map(cell => ({ op: 'replace', path: at(rowsPath, cell.row, column), value: cell.value })) };
}

/**
 * Migration help for the strict number rule: when every text cell of a chart value column is written in one display
 * style that a NumberFormat reproduces exactly (`"12%"`/`"8.5%"` -> 0.12/0.085 with `0.#%`; `"$1,234"` -> 1234 with
 * `$#,##0`; `"1,234"` -> 1234 with `#,##0`), the patch that stores the numbers and gives the column that format.
 * Undefined when there is nothing to fix or no exact fix: mixed styles, accounting negatives `(5)`, `1.234,5`, units,
 * a column that already has a format, or any value the format would display differently (number cells included).
 */
export function suggestChartNumberFix(chart: unknown, document?: unknown, options: ChartNumberFixOptions = {}): ChartNumberFix | undefined {
  const fixes = chartNumberFixes(chart, document, options);
  if (options.column === undefined) return fixes.values().next().value;
  for (const fix of fixes.values()) if (fix.column === options.column || fix.name === options.column) return fix;
  return undefined;
}

/** Every column fix of one chart, by the path of each text cell it rewrites (for the migration fix of opf/chart-value-not-numeric). */
export function chartNumberFixesByCell(chart: unknown, document: unknown, options: DataResolveOptions): Map<string, ChartNumberFix> {
  const byCell = new Map<string, ChartNumberFix>();
  for (const fix of chartNumberFixes(chart, document, options).values()) for (const patch of fix.patches.slice(0, -1)) byCell.set(patch.path, fix);
  return byCell;
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
