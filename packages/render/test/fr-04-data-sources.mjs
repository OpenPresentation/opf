import assert from 'node:assert/strict';
// FA-23: the documents name the gallery's `roboto` font scheme, so the host catalog is registered.
import {toSvg} from './catalog-harness.mjs';

// FR-04 (core docs/data-sources.md): data sources and where a dataset came from are never drawn. The preview of a deck that names data
// sources, datasets with provenance keys and inline chart data with them is the same SVG, byte for byte, as the preview of the deck
// without any of them: the keys travel through the document and nothing reads them.
const SHA = '9f2c41b1d1b6e0a8a56e7c3d2f4b8a90c1e3d5f7a9b0c2d4e6f8a0b1c3d5e07a';
const KEYS = ['datasource', 'query', 'retrieved', 'version', 'sha256', 'generator'];
const withSources = {
  design: {fontScheme: 'roboto'},
  datasources: {warehouse: {title: 'Finance warehouse', connector: 'postgres', src: 'postgres://warehouse.example.com/finance', license: 'Internal use only', refreshEvery: 'P1D'}},
  datasets: {
    revenue: {
      columns: ['Quarter', {name: 'Revenue', format: '$#,##0.0'}], rows: [['Q1', 12.4], ['Q2', 18], ['Q3', 24.5]],
      datasource: 'warehouse', query: 'SELECT quarter, revenue FROM revenue', retrieved: '2026-11-01T09:30:00Z', version: 'r42', sha256: SHA, generator: {type: 'model', name: 'metricgen 2.1'},
    },
  },
  slides: [
    {title: 'Dataset chart', chart: {type: 'column', alt: 'Revenue by quarter', data: {dataset: 'revenue'}}},
    {title: 'Dataset table', table: {dataset: 'revenue'}},
    {title: 'Inline chart', chart: {type: 'line', alt: 'Margin', data: {columns: ['Quarter', 'Margin'], rows: [['Q1', 0.31], ['Q2', 0.34]], datasource: 'warehouse', query: 'FY26!A1:B3', retrieved: '2026-11-02', version: 'r1', sha256: SHA, generator: {type: 'human', name: 'Avery Chen'}}}},
    {title: 'Inline data source', chart: {type: 'column', alt: 'Inline', data: {columns: ['A', 'B'], rows: [['x', 1], ['y', 2]], datasource: {src: './inline.csv', connector: 'csv'}}}},
  ],
};
const without = structuredClone(withSources);
delete without.datasources;
for (const dataset of Object.values(without.datasets)) for (const key of KEYS) delete dataset[key];
for (const slide of without.slides) if (slide.chart?.data?.columns) for (const key of KEYS) delete slide.chart.data[key];

const a = toSvg(withSources, {}), b = toSvg(without, {});
assert.equal(a.length, 4, 'four slides');
assert.deepEqual(a, b, 'a deck that names data sources draws exactly as the same deck without them');
for (const svg of a) assert.doesNotMatch(svg, /warehouse|metricgen|r42|SELECT|postgres/, 'no data source key reaches the drawing');

// The deck validates: the preview's own validation accepts the new keys, and an unknown data source is refused like any invalid deck.
assert.throws(() => toSvg({...withSources, datasets: {revenue: {...withSources.datasets.revenue, datasource: 'wharehouse'}}}, {}), error => error.code === 'invalid-opf' && error.details.findings.some(finding => finding.ruleId === 'opf/datasource-unknown'), 'an unknown data source is an invalid deck');

console.log('FR-04 data sources in the preview: ok');
