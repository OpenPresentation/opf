/**
 * The Chart.js / ECharts chart shape, recognized and explained. A model that has seen those libraries writes
 * `chart: { type, categories, series: [{ name, values }] }` (or `labels` and `datasets`), which OPF does not have: an OPF chart keeps its
 * values in `data: { columns, rows }`. The schema reports that as a missing `data` plus one "additional property" error per foreign key, which
 * says nothing about the fix. This module finds that mistake, converts the author's own values to the OPF shape and words the help; `validate`
 * replaces the missing-`data` finding's help (and drops the redundant additional-property findings it explains), `describeFinding` reads the same
 * text. Pure and browser-safe; nothing is applied to the document.
 */

import type { JsonPatchOperation } from './generated/types/finding.js';

/** The keys of the Chart.js and ECharts shapes that an OPF chart does not have. */
export const FOREIGN_CHART_KEYS: readonly string[] = ['categories', 'series', 'labels', 'datasets'];

/** The Chart definition an agent reads next. */
export const CHART_DEFINITION = 'https://openpresentation.org/schema/opf/v1#/$defs/Chart';

type Rec = Record<string, unknown>;
const isRecord = (value: unknown): value is Rec => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCell = (value: unknown): value is string | number | boolean | null => value === null || ['string', 'number', 'boolean'].includes(typeof value);

/** The foreign keys a chart object carries, in `FOREIGN_CHART_KEYS` order; empty unless the chart has no `data` (this mistake is a missing `data`). */
export function foreignChartKeys(chart: unknown): string[] {
	if (!isRecord(chart) || Object.hasOwn(chart, 'data')) return [];
	return FOREIGN_CHART_KEYS.filter((key) => Object.hasOwn(chart, key));
}

/** The OPF `data` of a Chart.js/ECharts-shaped chart, or `undefined` when the values are not a plain list of categories and named series. */
export function convertChartData(chart: Rec): { columns: string[]; rows: (string | number | boolean | null)[][] } | undefined {
	const labels = chart.categories ?? chart.labels;
	const series = chart.series ?? chart.datasets;
	if (!Array.isArray(labels) || !labels.length || !labels.every(isCell) || !Array.isArray(series) || !series.length) return undefined;
	const columns = ['Category'];
	const values: unknown[][] = [];
	for (const [index, entry] of series.entries()) {
		if (!isRecord(entry)) return undefined;
		const list = entry.values ?? entry.data;
		const name = entry.name ?? entry.label;
		if (!Array.isArray(list) || list.length !== labels.length || !list.every(isCell)) return undefined;
		columns.push(typeof name === 'string' && name ? name : `Series ${index + 1}`);
		values.push(list);
	}
	if (new Set(columns).size !== columns.length) return undefined;
	return { columns, rows: labels.map((label, row) => [label, ...values.map((list) => list[row] as string | number | boolean | null)]) };
}

/** The JSON patch operations that turn the chart at `path` (a JSON Pointer) into the OPF shape; `undefined` when the values cannot be converted. */
export function chartShapePatch(chart: unknown, path: string): JsonPatchOperation[] | undefined {
	if (!isRecord(chart)) return undefined;
	const data = convertChartData(chart);
	const keys = foreignChartKeys(chart);
	if (!data || !keys.length) return undefined;
	return [{ op: 'add', path: `${path}/data`, value: data }, ...keys.map((key) => ({ op: 'remove' as const, path: `${path}/${key}` }))];
}

/** How many rows the help shows before it says "..." (the whole conversion is in the fix). */
const SHOWN_ROWS = 3;

const json = (value: unknown): string => JSON.stringify(value);

/** The converted form of the author's values as one line of JSON, or the generic form when the values cannot be converted. */
function dataExample(chart: Rec): string {
	const data = convertChartData(chart);
	if (!data) return '"data": { "columns": ["Category", "Series name"], "rows": [["Q1", 3], ["Q2", 8]] }';
	const rows = data.rows.slice(0, SHOWN_ROWS).map(json);
	return `"data": { "columns": ${json(data.columns)}, "rows": [${rows.join(',')}${data.rows.length > SHOWN_ROWS ? ',...' : ''}] }`;
}

/** What the author should write instead, naming their own keys; `undefined` when the chart is not of this shape. */
export function chartShapeHelp(chart: unknown): { message: string; next: string; help: string } | undefined {
	const keys = foreignChartKeys(chart);
	if (!keys.length || !isRecord(chart)) return undefined;
	const names = keys.map((key) => `"${key}"`).join(' and ');
	const example = dataExample(chart);
	const next = `replace ${names} with ${example}. The first column holds the category labels and each further column is one series.`;
	return {
		message: `The chart has ${names} (the Chart.js and ECharts shape), but an OPF chart keeps its values in "data": { "columns", "rows" }.`,
		next,
		help: `OPF charts use "data": { "columns", "rows" }, not ${names}. Replace ${names} with ${example}; the first column holds the category labels and each further column is one series. See the Chart definition: ${CHART_DEFINITION} (opf schema presentation '/$defs/Chart').`,
	};
}
