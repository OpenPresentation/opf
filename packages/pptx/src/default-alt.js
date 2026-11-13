// RR-105 (#1290, ribbon audit gap 6): the text alternative OPF writes when the author wrote none, so PowerPoint's Accessibility Checker
// does not report "Missing alternative text" on ordinary decks: a chart from its type, series and categories, a table from its column
// names and row count, a logo from its organization's name, and a quote's photo from the attribution. An authored `alt` always wins,
// the empty string included (decorative).
//
// The words around the data are plain English (the document has no words of its own for "chart" or "rows"); the series, category
// and column names are the document's own, in its language.
//
// Import never turns a generated description into an authored `alt`. As SmartArt's fallback description (diagram-provenance.js
// `withAlt`: "unchanged when the description is the one written"), a description that equals the one OPF writes for the imported
// object is not an alt: the import regenerates it from the object it read and leaves `alt` out when they agree. An edited description
// is authored text and imports as `alt`.
import {resolveChartData, resolveTableData} from './chart-data.js';

// The text of a name: a string, TextRun[] (rich), or a column or cell object (`name`, `label`, `value` or `text`).
const plain = value => typeof value === 'string' || typeof value === 'number' ? String(value) : Array.isArray(value) ? value.map(plain).join('')
  : value && typeof value === 'object' ? plain(value.name ?? value.label ?? value.value ?? value.text ?? '') : '';
const clean = value => plain(value).replace(/\s+/g, ' ').trim();
const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "A", "A and B", "A, B and C", "A, B, C and 2 more". */
export function nameList(names, limit = 3) {
  const list = names.map(clean).filter(Boolean);
  if (list.length <= 1) return list[0] ?? '';
  if (list.length > limit) return `${list.slice(0, limit).join(', ')} and ${list.length - limit} more`;
  return `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
}

const CHART_NOUNS = Object.freeze({combo: 'Column and line chart', world: 'Map chart', 'box-and-whisker': 'Box and whisker chart'});
/** The chart type as a noun phrase: "Column chart", "100% stacked bar chart", "Map chart". */
export function chartNoun(type) {
  if (CHART_NOUNS[type]) return CHART_NOUNS[type];
  const words = String(type ?? 'chart').replace(/^100pct-/, '100% ').replace(/-/g, ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} chart`;
}

const SINGLE_SERIES = new Set(['pie', 'doughnut', 'funnel', 'treemap', 'world']);

/**
 * The generated description of a chart, or undefined when its data cannot be resolved. `presentation` supplies `datasets` for a
 * dataset reference. Examples: "Column chart: Sales and Cost by Quarter, 3 categories"; "Histogram chart: Value, 24 values";
 * "Scatter chart: Weight against Height, 12 points" (a label column, then X and Y).
 */
export function chartAlt(chart, presentation = {}) {
  if (!chart || typeof chart !== 'object') return undefined;
  let resolved;
  try { resolved = resolveChartData(chart, {datasets: presentation?.datasets ?? {}}); } catch { return undefined; }
  if (!resolved?.ok || !Array.isArray(resolved.columns) || !Array.isArray(resolved.rows)) return undefined;
  const columns = resolved.columns.map(clean), rows = resolved.rows.length, noun = chartNoun(chart.type);
  if (columns.length === 1) return `${noun}: ${columns[0] || 'values'}, ${count(rows, 'value')}`;
  const [first, ...series] = columns;
  // A scatter chart's first column labels the points; with an X column (core's `hasX`) the second is X and the rest are Y series.
  if (chart.type === 'scatter') return resolved.hasX && columns.length > 2
    ? `${noun}: ${nameList(columns.slice(2))} against ${columns[1] || 'X'}, ${count(rows, 'point')}`
    : `${noun}: ${nameList(series)} by ${first || 'point'}, ${count(rows, 'point')}`;
  const plotted = SINGLE_SERIES.has(chart.type) ? series.slice(0, 1) : series;
  return `${noun}: ${nameList(plotted)} by ${first || 'category'}, ${count(rows, 'category', 'categories')}`;
}

/** The generated description of a table: "Table: Team, People and Open roles; 3 rows". */
export function tableAlt(table, presentation = {}) {
  if (!table || typeof table !== 'object') return undefined;
  let resolved;
  try { resolved = resolveTableData(table, {datasets: presentation?.datasets ?? {}}); } catch { return undefined; }
  if (!Array.isArray(resolved?.columns) || !Array.isArray(resolved.rows)) return undefined;
  const columns = nameList(resolved.columns, 6);
  return `Table${columns ? `: ${columns};` : ':'} ${count(resolved.rows.length, 'row')}`;
}

/** A logo's description from its organization: "Acme Corporation logo", else "Logo". */
export const logoAlt = organizationName => clean(organizationName) ? `${clean(organizationName)} logo` : 'Logo';

/** A quote photo's description from the attribution: "Photo of Edsger Dijkstra", or undefined without one. */
export const photoAlt = attribution => clean(attribution) ? `Photo of ${clean(attribution)}` : undefined;

/**
 * Import: the descriptions export could have generated for an imported chart. Besides the chart as read, a chart whose first column
 * holds the row numbers 1..n is also described without that column: export plots one data column against synthetic row numbers
 * (the row-numbers adaptation), which the chart part keeps as categories, so the authored chart had only the data column.
 */
export function generatedChartAlts(chart, presentation = {}) {
  // A chart read from another branch of its frame (an extended chart's classic fallback, read as columns) keeps the description written
  // for the extended type: the same text after the type noun, for the families that describe their data differently, counts too.
  const alts = [chartAlt(chart, presentation), ...['column', 'pie', 'scatter'].filter(type => type !== chart?.type).map(type => chartAlt({...chart, type}, presentation))]
    .filter(Boolean).map(alt => ({any: alt.slice(alt.indexOf(': '))}));
  alts.unshift(chartAlt(chart, presentation));
  const data = chart?.data;
  if (Array.isArray(data?.columns) && data.columns.length === 2 && Array.isArray(data.rows) && data.rows.length
    && data.rows.every((row, index) => Array.isArray(row) && Number(row[0]) === index + 1))
    alts.push(chartAlt({...chart, data: {...data, columns: data.columns.slice(1), rows: data.rows.map(row => row.slice(1))}}, presentation));
  return alts.filter(Boolean);
}

// A generated chart description: "<type> chart: <the rest>". `{any}` candidates match the rest under any chart type noun.
const generatedChart = /^[^:]* chart: /;

/** Import: the alt to keep, given the description read and the description(s) OPF generates for the imported object. */
export const authoredAlt = (read, generated) => read !== undefined && [generated].flat().some(candidate => typeof candidate === 'string' ? candidate === read
  : typeof candidate?.any === 'string' && generatedChart.test(read) && read.slice(read.indexOf(': ')) === candidate.any) ? undefined : read;
