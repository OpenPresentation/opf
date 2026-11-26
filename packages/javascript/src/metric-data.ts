// FR-06: a metric computed from data. `metric.data` links a metric to rows of a dataset of the same deck: core computes the value and,
// optionally, the change from them, and the arrow and its color follow. `metric.format` says how a number value is written; `metric.better`
// says which direction of change is good. One function, `resolveMetric`, returns the metric to draw (the 0.36 form of what is shown: plain
// `value`, `delta`, `trend` and `sentiment`), the record of the 0.37 part for a PowerPoint tag, and the diagnostics. Composition calls it
// before measuring, so layout measures the text that is drawn and every engine draws its result; no engine computes on its own.
//
// Browser-safe and synchronous: no file access, no network, no clock.
import { chartNumber, datasetColumnDeclaration, formatDataNumber, numberFormatError, type DataDiagnostic } from './chart-data.js';
import { timeOrderKey } from './chart-time-order.js';
import { metricGaugeDiagnostics } from './metric-gauge.js';

export type DataConditionOperator = '=' | '!=' | '<' | '<=' | '>' | '>=' | 'in';
export type DataConditionValue = string | number | boolean | null;
/** One condition on a row: the row's cell in `field` compared with `value` (a list for `in`). */
export interface DataCondition { field: string; op: DataConditionOperator; value: DataConditionValue | DataConditionValue[] }
/** Conditions a row must all meet (AND). */
export type DataFilter = DataCondition[];
export type DataAggregate = 'sum' | 'mean' | 'min' | 'max' | 'count' | 'first' | 'last';
/** A number computed from a dataset of the deck: `aggregate` over the cells of `field` in the rows that meet `filter`. */
export interface DataLink { dataset: string; field: string; aggregate: DataAggregate; filter?: DataFilter }
/** How a metric's change is computed: against the previous row, a baseline, a fixed number, or read from a column. Exactly one of `compare` and `field`. */
export interface MetricDelta {
  compare?: 'previous' | { filter: DataFilter } | { value: number };
  field?: string;
  as?: 'difference' | 'percent';
  format?: string;
}
/** A DataLink for a metric, with an optional change. */
export interface MetricData extends DataLink { delta?: MetricDelta }

/** The keys of a drawn metric that were computed (or derived) rather than written. */
export type MetricDerivedKey = 'value' | 'delta' | 'trend' | 'sentiment';
/**
 * The 0.37 part of a metric, which a PowerPoint export keeps beside the 0.36 form of what it draws (the `link` key of the metric's tag):
 * the link, the direction that is good, the number format, which keys of the drawn metric were derived, and the numbers whose drawn text
 * the 0.36 form holds.
 */
export interface MetricRecord {
  data?: MetricData;
  better?: 'up' | 'down';
  format?: string;
  /** The keys of the drawn metric that came from the link (or from `better`) and are not typed. */
  derived?: MetricDerivedKey[];
  /** The numbers behind the text the drawn `value` and `delta` hold, when a number format made them text. */
  numbers?: { value?: number; delta?: number };
}

/** A finding of the metric's link; `fix` is the safe patch of a `metric-data-stale` warning. */
export interface MetricDataDiagnostic extends DataDiagnostic {
  fix?: { title: string; patch: { op: 'add' | 'replace'; path: string; value: string | number }[] };
}

/**
 * What a metric's value is drawn as, for an engine that draws it differently (a gauge's arc and its end labels): `text` is what the
 * metric shows, `number` the number behind it (absent when the value is a string that is not computed from a number), `format` the pattern that
 * wrote it (absent for the General form and for a string), `computed` whether it came from the link.
 */
export interface ResolvedMetricValue { text: string; number?: number; format?: string; isNumber: boolean; computed: boolean }

export interface ResolvedMetric {
  /** The metric to draw: the 0.36 form (`data`, `better` and `format` removed; `value`, `delta`, `trend` and `sentiment` as drawn). The same object when the metric has none of the three. */
  metric: unknown;
  /** Whether the link resolved (the computed numbers are drawn). False without a link. */
  resolved: boolean;
  /** The value as drawn. Absent for a metric that is not an object. */
  value?: ResolvedMetricValue;
  /** The change as drawn, when there is one. */
  delta?: { text: string; number?: number; computed: boolean };
  /** The 0.37 part, absent when the metric has no `data`, `better` or `format`. */
  record?: MetricRecord;
  diagnostics: MetricDataDiagnostic[];
}

export interface ResolveMetricOptions {
  /** JSON Pointer of the metric object, the base of diagnostic paths. Default: "" (paths start at `/data`). */
  path?: string;
  /** The deck language: the digits and separators of a formatted number. */
  language?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const segment = (key: string | number): string => String(key).replaceAll('~', '~0').replaceAll('/', '~1');
const at = (base: string, ...keys: (string | number)[]): string => `${base}${keys.map(key => `/${segment(key)}`).join('')}`;
const AGGREGATES: readonly string[] = ['sum', 'mean', 'min', 'max', 'count', 'first', 'last'];
const OPERATORS: readonly string[] = ['=', '!=', '<', '<=', '>', '>=', 'in'];
const round = (value: number): number => Number(value.toPrecision(12));

const columnName = (column: unknown): string => typeof column === 'string' ? column : isRecord(column) && typeof column.name === 'string' ? column.name : '';
const columnFormat = (column: unknown): string | undefined => isRecord(column) && typeof column.format === 'string' ? column.format : undefined;

function asCondition(value: unknown): DataCondition | undefined {
  if (!isRecord(value) || typeof value.field !== 'string' || typeof value.op !== 'string' || !OPERATORS.includes(value.op) || !('value' in value)) return undefined;
  const scalar = (entry: unknown): boolean => entry === null || ['string', 'number', 'boolean'].includes(typeof entry);
  if (!scalar(value.value) && !(Array.isArray(value.value) && value.value.length > 0 && value.value.every(scalar))) return undefined;
  return value as unknown as DataCondition;
}
function asFilter(value: unknown): DataFilter | undefined | false {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) return false;
  const conditions = value.map(asCondition);
  return conditions.every(Boolean) ? conditions as DataFilter : false;
}
/** The link as written when it has the schema's shape, else undefined (a malformed link is the validator's to report; engines draw the literal). */
function asMetricData(value: unknown): MetricData | undefined {
  if (!isRecord(value) || typeof value.dataset !== 'string' || typeof value.field !== 'string' || typeof value.aggregate !== 'string' || !AGGREGATES.includes(value.aggregate)) return undefined;
  if (asFilter(value.filter) === false) return undefined;
  if (value.delta !== undefined) {
    const delta = value.delta;
    if (!isRecord(delta)) return undefined;
    const compare = delta.compare;
    if ((compare === undefined) === (delta.field === undefined)) return undefined;
    if (delta.field !== undefined && typeof delta.field !== 'string') return undefined;
    if (compare !== undefined && compare !== 'previous') {
      if (!isRecord(compare)) return undefined;
      if ('filter' in compare ? asFilter(compare.filter) === false || compare.filter === undefined : !(typeof compare.value === 'number' && Number.isFinite(compare.value))) return undefined;
    }
    if (delta.as !== undefined && delta.as !== 'difference' && delta.as !== 'percent') return undefined;
    if (delta.format !== undefined && typeof delta.format !== 'string') return undefined;
  }
  return value as unknown as MetricData;
}

// ---------------------------------------------------------------------------------------------------------------
// Rows

interface Column { name: string; index: number; type?: 'number' | 'text' | 'date' | 'boolean'; format?: string }
type Cell = unknown;

const sameValue = (a: Cell, b: unknown): boolean => a === b;
const byCodePoint = (a: string, b: string): number => {
  const left = [...a], right = [...b];
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const difference = left[index]!.codePointAt(0)! - right[index]!.codePointAt(0)!;
    if (difference) return difference;
  }
  return left.length - right.length;
};

/** Whether a row's cell meets a condition (see the schema's DataCondition). */
function meets(cell: Cell, condition: DataCondition, column: Column, language: string | undefined): boolean {
  const target = condition.value;
  switch (condition.op) {
    case '=': return !Array.isArray(target) && sameValue(cell, target);
    case '!=': return Array.isArray(target) || !sameValue(cell, target);
    case 'in': return Array.isArray(target) ? target.some(entry => sameValue(cell, entry)) : sameValue(cell, target);
    default: {
      let order: number | undefined;
      if (typeof cell === 'number' && typeof target === 'number') order = cell - target;
      else if (typeof cell === 'string' && typeof target === 'string') {
        const left = column.type === 'date' ? timeOrderKey(cell, language) : undefined, right = column.type === 'date' ? timeOrderKey(target, language) : undefined;
        order = left && right && left.family === right.family ? left.key - right.key : byCodePoint(cell, target);
      }
      if (order === undefined || Number.isNaN(order)) return false;
      return condition.op === '<' ? order < 0 : condition.op === '<=' ? order <= 0 : condition.op === '>' ? order > 0 : order >= 0;
    }
  }
}

type Aggregated = { kind: 'number'; value: number } | { kind: 'cell'; cell: string | boolean | number } | { kind: 'empty' };

/** The aggregate over the cells of one column in `rows`, or `empty` when no cell is usable. */
function aggregate(rows: readonly (readonly Cell[])[], column: Column, kind: DataAggregate, language: string | undefined): Aggregated {
  const cells = rows.map(row => row[column.index]);
  if (kind === 'count') return { kind: 'number', value: rows.length };
  if (kind === 'first' || kind === 'last') {
    const usable = cells.filter(cell => cell !== null && cell !== undefined);
    const cell = kind === 'first' ? usable[0] : usable[usable.length - 1];
    if (cell === undefined) return { kind: 'empty' };
    // A number cell is a number (the column's format writes it); a string or boolean cell is drawn as written.
    if (typeof cell === 'number') return Number.isFinite(cell) ? { kind: 'number', value: cell } : { kind: 'empty' };
    return typeof cell === 'string' || typeof cell === 'boolean' ? { kind: 'cell', cell } : { kind: 'empty' };
  }
  // A declared number column reads numbers only; an undeclared one also reads strings in strict decimal syntax, as chart values do.
  const numbers = cells.flatMap(cell => column.type === undefined ? [chartNumber(cell)] : typeof cell === 'number' ? [cell] : []).filter((value): value is number => value !== null && Number.isFinite(value));
  if ((kind === 'min' || kind === 'max') && column.type === 'date') {
    const keyed = cells.flatMap(cell => { const key = typeof cell === 'string' || typeof cell === 'number' ? timeOrderKey(cell, language) : undefined; return key ? [{ cell: cell as string | number, ...key }] : []; });
    if (!keyed.length) return { kind: 'empty' };
    const family = keyed[0]!.family;
    const same = keyed.filter(entry => entry.family === family);
    const best = same.reduce((left, right) => (kind === 'min' ? right.key < left.key : right.key > left.key) ? right : left);
    return { kind: 'cell', cell: best.cell };
  }
  if (!numbers.length) return { kind: 'empty' };
  if (kind === 'sum') return { kind: 'number', value: round(numbers.reduce((sum, value) => sum + value, 0)) };
  if (kind === 'mean') return { kind: 'number', value: round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length) };
  return { kind: 'number', value: kind === 'min' ? Math.min(...numbers) : Math.max(...numbers) };
}

// ---------------------------------------------------------------------------------------------------------------
// Formats

/** A pattern's one section with its sign: `F` is `+F;-F;F`; a pattern that already has sections is kept. */
function withSigns(format: string): string {
  return format.includes(';') ? format : `+${format};-${format};${format}`;
}
const DEFAULT_DIFFERENCE_FORMAT = '+#,##0.##;-#,##0.##;0';
const DEFAULT_PERCENT_FORMAT = '+0%;-0%;0%';

/** The literal text before and after a pattern's numeric part (first section). */
function printedAround(format: string): string[] {
  const match = /^([^#0,.]*)((?:[#0,]*)(?:\.[#0]+)?)([\s\S]*)$/.exec(format.split(';')[0] ?? '');
  return match && /[#0]/.test(match[2] ?? '') ? [match[1] ?? '', match[3] ?? ''].map(text => text.trim()).filter(Boolean) : [];
}

const textOf = (number: number, format: string | undefined, language: string | undefined): string => formatDataNumber(number, format, language);

// ---------------------------------------------------------------------------------------------------------------
// resolveMetric

/**
 * Resolve a metric against the deck's datasets. `datasets` is the top-level `datasets` map (or the document: its `datasets` key is read).
 * A metric without `data`, `better` and `format` comes back as the same object. A metric whose link does not resolve (an error, an
 * aggregate its column refuses, no usable cell) draws its written `value` and `delta`, as before.
 */
export function resolveMetric(metric: unknown, datasets: unknown, options: ResolveMetricOptions = {}): ResolvedMetric {
  const result = resolveMetricData(metric, datasets, options);
  // FR-07, part 3: a gauge's warnings (metric-gauge-range, metric-gauge-value, chart-bands-order) are the metric's own.
  const gauge = metricGaugeDiagnostics(metric, result, options.path ?? '');
  return gauge.length ? { ...result, diagnostics: [...result.diagnostics, ...gauge] } : result;
}

function resolveMetricData(metric: unknown, datasets: unknown, options: ResolveMetricOptions): ResolvedMetric {
  if (!isRecord(metric) || (metric.data === undefined && metric.better === undefined && metric.format === undefined)) {
    const plain = isRecord(metric) ? metric : undefined;
    return { metric, resolved: false, diagnostics: [], ...(plain && plain.value !== undefined ? { value: shownValue(plain.value, false) } : typeof metric === 'string' || typeof metric === 'number' ? { value: shownValue(metric, false) } : {}) };
  }
  const base = options.path ?? '', language = options.language;
  const diagnostics: MetricDataDiagnostic[] = [];
  const sets = isRecord(datasets) && isRecord(datasets.datasets) ? datasets.datasets : isRecord(datasets) ? datasets : {};
  const better = metric.better === 'up' || metric.better === 'down' ? metric.better : undefined;
  let format = typeof metric.format === 'string' && metric.format !== '' ? metric.format : undefined;
  if (metric.format !== undefined) {
    const error = numberFormatError(metric.format);
    if (error) { diagnostics.push({ code: 'number-format-invalid', severity: 'error', path: at(base, 'format'), message: error }); format = undefined; }
  }
  const link = asMetricData(metric.data);
  let resolved = false;
  let computedValue: Aggregated | undefined;
  let computedDelta: { number: number; text: string; format: string } | undefined;
  let valueFormat = format;

  if (link) {
    const dataset = Object.hasOwn(sets, link.dataset) ? sets[link.dataset] : undefined;
    if (!isRecord(dataset) || !Array.isArray(dataset.columns) || !Array.isArray(dataset.rows)) {
      diagnostics.push({ code: 'dataset-unknown', severity: 'error', path: at(base, 'data', 'dataset'), message: `unknown dataset '${link.dataset}'; add it to the top-level datasets map` });
    } else {
      // FR-05: a column's declared type, by the one reader core exports.
      const declaredOf = (name: string) => datasetColumnDeclaration({ datasets: sets }, link.dataset, name)?.type;
      const columns: Column[] = dataset.columns.map((column, index) => ({ name: columnName(column), index, ...(declaredOf(columnName(column)) ? { type: declaredOf(columnName(column))! } : {}), ...(columnFormat(column) ? { format: columnFormat(column)! } : {}) }));
      const names = columns.map(column => column.name);
      const known = (name: string, path: string): Column | undefined => {
        const found = columns.find(column => column.name === name);
        if (!found) diagnostics.push({ code: 'dataset-field-unknown', severity: 'error', path, message: `field ${JSON.stringify(name)} is not a column of the dataset; use one of ${names.map(entry => JSON.stringify(entry)).join(', ')}` });
        return found;
      };
      const checkFilter = (filter: DataFilter | undefined, path: string): Column[] | undefined => {
        if (!filter) return [];
        const found = filter.map((condition, index) => known(condition.field, at(path, index, 'field')));
        return found.every(Boolean) ? found as Column[] : undefined;
      };
      const field = known(link.field, at(base, 'data', 'field'));
      const filterColumns = checkFilter(link.filter, at(base, 'data', 'filter'));
      const delta = link.delta;
      const deltaField = delta?.field !== undefined ? known(delta.field, at(base, 'data', 'delta', 'field')) : undefined;
      const baseline = delta && delta.compare !== undefined && delta.compare !== 'previous' && 'filter' in delta.compare ? delta.compare.filter : undefined;
      const baselineColumns = baseline ? checkFilter(baseline, at(base, 'data', 'delta', 'compare', 'filter')) : [];
      if (delta?.format !== undefined) {
        const error = numberFormatError(delta.format);
        if (error) diagnostics.push({ code: 'number-format-invalid', severity: 'error', path: at(base, 'data', 'delta', 'format'), message: error });
      }
      if (field) valueFormat = format ?? field.format;
      const rows = dataset.rows.filter((row): row is Cell[] => Array.isArray(row));
      const failed = diagnostics.some(entry => entry.severity === 'error' && entry.code !== 'number-format-invalid');
      if (field && filterColumns && baselineColumns && !failed) {
        const filterRows = (filter: DataFilter | undefined, columnsOf: Column[]): Cell[][] => filter ? rows.filter(row => filter.every((condition, index) => meets(row[columnsOf[index]!.index], condition, columnsOf[index]!, language))) : rows;
        const kept = filterRows(link.filter, filterColumns);
        const refused = ['sum', 'mean', 'min', 'max'].includes(link.aggregate) && (field.type === 'text' || field.type === 'boolean');
        if (refused) {
          diagnostics.push({ code: 'metric-data-aggregate', severity: 'warning', path: at(base, 'data', 'aggregate'), message: `"${link.aggregate}" needs numbers, and column "${field.name}" is typed ${field.type}. The written value is shown.` });
        } else {
          const result = kept.length ? aggregate(kept, field, link.aggregate, language) : { kind: 'empty' } as Aggregated;
          if (result.kind === 'empty') diagnostics.push({ code: 'metric-data-empty', severity: 'warning', path: at(base, 'data'), message: `No row of "${link.dataset}" gives a value for this metric. The written value is shown.` });
          else {
            resolved = true;
            computedValue = result;
            if (delta) {
              const fail = (reason: string) => diagnostics.push({ code: 'metric-data-delta', severity: 'warning', path: at(base, 'data', 'delta'), message: `The change cannot be computed: ${reason}. No change is shown.` });
              const as = delta.as ?? 'difference';
              let change: number | undefined;
              if (result.kind !== 'number') fail('the value is not a number');
              else if (delta.field !== undefined && deltaField) {
                const part = aggregate(kept, deltaField, link.aggregate, language);
                if (part.kind === 'number') change = part.value; else fail(`column "${deltaField.name}" gives no number`);
              } else if (delta.compare !== undefined) {
                let comparison: number | undefined;
                if (delta.compare === 'previous') {
                  if (kept.length < 2) fail('fewer than two rows are kept to compare');
                  else { const before = aggregate(kept.slice(0, -1), field, link.aggregate, language); if (before.kind === 'number') comparison = before.value; else fail('the previous rows give no number'); }
                } else if ('value' in delta.compare) comparison = delta.compare.value;
                else {
                  const baseRows = filterRows(delta.compare.filter, baselineColumns);
                  const before = baseRows.length ? aggregate(baseRows, field, link.aggregate, language) : { kind: 'empty' } as Aggregated;
                  if (before.kind === 'number') comparison = before.value; else fail('no row meets the baseline filter, or none gives a number');
                }
                if (comparison !== undefined) {
                  if (as === 'percent') { if (comparison === 0) fail('the comparison value is 0, so a percent change is undefined'); else change = (result.value - comparison) / Math.abs(comparison); }
                  else change = result.value - comparison;
                }
              }
              if (change !== undefined && Number.isFinite(change)) {
                const number = round(change);
                const own = delta.format;
                const fromColumn = delta.field !== undefined && deltaField?.format !== undefined ? withSigns(deltaField.format) : undefined;
                const fallback = as === 'percent' ? DEFAULT_PERCENT_FORMAT : field.format ? withSigns(field.format) : DEFAULT_DIFFERENCE_FORMAT;
                const pattern = own && !numberFormatError(own) ? own : fromColumn ?? fallback;
                computedDelta = { number, text: textOf(number, pattern, language), format: pattern };
              }
            }
          }
        }
      }
    }
  }

  const valueNumber = computedValue?.kind === 'number' ? computedValue.value : undefined;
  const shown: ResolvedMetricValue = (() => {
    if (resolved && computedValue) {
      if (computedValue.kind === 'number') return valueFormat ? { text: textOf(computedValue.value, valueFormat, language), number: computedValue.value, format: valueFormat, isNumber: true, computed: true } : { text: textOf(computedValue.value, undefined, language), number: computedValue.value, isNumber: true, computed: true };
      return { text: String('cell' in computedValue ? computedValue.cell : ''), isNumber: false, computed: true };
    }
    return shownValue(metric.value, false, format, language);
  })();

  // The metric to draw: the 0.36 form.
  const drawn: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(metric)) if (key !== 'data' && key !== 'better' && key !== 'format') drawn[key] = entry;
  const derived: MetricDerivedKey[] = [];
  const numbers: { value?: number; delta?: number } = {};
  if (resolved && computedValue) {
    drawn.value = computedValue.kind === 'number' ? (valueFormat ? shown.text : computedValue.value) : String('cell' in computedValue ? computedValue.cell : '');
    derived.push('value');
    if (computedValue.kind === 'number' && valueFormat) numbers.value = computedValue.value;
  } else if (format !== undefined && typeof metric.value === 'number' && Number.isFinite(metric.value)) {
    drawn.value = shown.text;
    numbers.value = metric.value;
  }
  let deltaShown: ResolvedMetric['delta'];
  if (computedDelta) {
    drawn.delta = computedDelta.text;
    numbers.delta = computedDelta.number;
    derived.push('delta');
    deltaShown = { text: computedDelta.text, number: computedDelta.number, computed: true };
  } else if (typeof metric.delta === 'number' && Number.isFinite(metric.delta) && format !== undefined) {
    const text = textOf(metric.delta, withSigns(format), language);
    drawn.delta = text;
    numbers.delta = metric.delta;
    deltaShown = { text, number: metric.delta, computed: false };
  } else if (metric.delta !== undefined && (typeof metric.delta === 'number' || typeof metric.delta === 'string')) {
    deltaShown = { text: String(metric.delta), ...(typeof metric.delta === 'number' ? { number: metric.delta } : {}), computed: false };
  }
  if (computedDelta && drawn.trend === undefined) {
    drawn.trend = computedDelta.number > 0 ? 'up' : computedDelta.number < 0 ? 'down' : 'flat';
    derived.push('trend');
  }
  if (better === 'down' && drawn.sentiment === undefined && typeof drawn.trend === 'string') {
    drawn.sentiment = drawn.trend === 'up' ? 'negative' : drawn.trend === 'down' ? 'positive' : 'neutral';
    derived.push('sentiment');
  }

  // The unit the number format already prints (or the linked column's).
  if (typeof metric.unit === 'string' && metric.unit.trim() !== '' && valueFormat !== undefined && !numberFormatError(valueFormat)) {
    const unit = metric.unit.trim();
    if (printedAround(valueFormat).includes(unit)) diagnostics.push({ code: 'metric-unit-repeated', severity: 'warning', path: at(base, 'unit'), message: `The metric's unit "${metric.unit}" is already printed by its number format "${valueFormat}", so it is drawn twice.` });
  }
  // The written value or change that differs from the computed one (a reader that does not compute shows the written one).
  if (resolved && computedValue) {
    const literalText = (literal: unknown, pattern: string | undefined): string | undefined => typeof literal === 'number' ? textOf(literal, pattern, undefined) : typeof literal === 'string' ? literal : undefined;
    const computedText = (pattern: string | undefined, text: string, number: number | undefined): string => number === undefined ? text : textOf(number, pattern, undefined);
    const writtenValue = literalText(metric.value, valueFormat);
    const wantedValue = computedText(valueFormat, shown.text, valueNumber);
    if (writtenValue !== wantedValue) {
      const written = typeof metric.value === 'number' || typeof metric.value === 'string' ? String(metric.value) : 'missing';
      diagnostics.push({
        code: 'metric-data-stale', severity: 'warning', path: at(base, 'value'),
        message: `The metric shows ${shown.text} from "${link!.dataset}", but its value is written as ${written}. Readers that do not compute show the written value.`,
        fix: { title: `Write the computed value ${valueNumber ?? shown.text} as the metric's value`, patch: [{ op: 'replace', path: at(base, 'value'), value: valueNumber ?? shown.text }] },
      });
    }
    if (computedDelta) {
      const writtenDelta = metric.delta === undefined ? undefined : typeof metric.delta === 'number' ? textOf(metric.delta, computedDelta.format, undefined) : typeof metric.delta === 'string' ? metric.delta : undefined;
      if (writtenDelta !== textOf(computedDelta.number, computedDelta.format, undefined)) {
        diagnostics.push({
          code: 'metric-data-stale', severity: 'warning', path: at(base, 'delta'),
          message: `The metric shows ${computedDelta.text} from "${link!.dataset}", but its change is written as ${metric.delta === undefined ? 'missing' : String(metric.delta)}. Readers that do not compute show the written change.`,
          fix: { title: `Write the computed change ${computedDelta.number} as the metric's delta`, patch: [{ op: metric.delta === undefined ? 'add' : 'replace', path: at(base, 'delta'), value: computedDelta.number }] },
        });
      }
    }
  }

  const record: MetricRecord = {
    ...(link ? { data: link } : {}), ...(better ? { better } : {}), ...(format !== undefined ? { format } : {}),
    ...(derived.length ? { derived } : {}), ...(numbers.value !== undefined || numbers.delta !== undefined ? { numbers } : {}),
  };
  return { metric: drawn, resolved, value: shown, ...(deltaShown ? { delta: deltaShown } : {}), ...(Object.keys(record).length ? { record } : {}), diagnostics };
}


function shownValue(value: unknown, computed: boolean, format?: string, language?: string): ResolvedMetricValue {
  if (typeof value === 'number' && Number.isFinite(value)) return format ? { text: textOf(value, format, language), number: value, format, isNumber: true, computed } : { text: String(value), number: value, isNumber: true, computed };
  return { text: typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value), isNumber: false, computed };
}
