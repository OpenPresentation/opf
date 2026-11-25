// FR-04 (core docs/data-sources.md): data sources and where a dataset came from travel through the PowerPoint document tags unchanged.
// The root `datasources` map is OPF_DATASOURCES_V1 beside OPF_DATASETS_V1; a dataset's `datasource` id, `query`, `retrieved`, `version`,
// `sha256` and `generator`, and the same keys on inline chart data, travel inside the dataset record and the chart's OPF_DATA_V1 record.
// Nothing about a data source is drawn: the slides' XML does not change when a deck gains data sources.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';

const SHA = '9f2c41b1d1b6e0a8a56e7c3d2f4b8a90c1e3d5f7a9b0c2d4e6f8a0b1c3d5e07a';
const datasources = {
  warehouse: {title: 'Finance warehouse', description: 'Nightly export', connector: 'postgres', src: 'postgres://warehouse.example.com/finance', license: 'Internal use only', refresh: 'P1D', extensions: {'com.example': {pool: 2}}},
  forecast: {connector: 'xlsx', src: 'https://example.com/revenue.xlsx', license: 'CC-BY-4.0'},
  spare: {title: 'Not used by any dataset'},
};
const datasets = {
  revenue: {
    title: 'Revenue', columns: ['Quarter', {name: 'Revenue', format: '$#,##0.0'}], rows: [['Q1', 12.4], ['Q2', 18]],
    datasource: 'warehouse', query: 'SELECT quarter, revenue FROM revenue', retrieved: '2026-11-01T09:30:00Z', version: 'r42', sha256: SHA, generator: {kind: 'model', name: 'metricgen 2.1'},
  },
  costs: {columns: ['Quarter', 'Costs'], rows: [['Q1', 8], ['Q2', 11]], datasource: {src: './costs.csv', connector: 'csv'}, query: "'Q3 plan'!A1:B9", retrieved: '2026-11-01'},
};
const deck = {
  name: 'Data sources',
  datasources,
  datasets,
  slides: [
    {title: 'Dataset chart', chart: {type: 'column', data: {dataset: 'revenue'}}},
    {title: 'Dataset table', table: {dataset: 'costs'}},
    {title: 'Inline chart', chart: {type: 'line', data: {columns: ['Quarter', {name: 'Margin', format: '0%'}], rows: [['Q1', 0.31], ['Q2', 0.34]], datasource: 'forecast', query: 'FY26!A1:B3', retrieved: '2026-11-02', version: 'r1', sha256: SHA, generator: {kind: 'human', name: 'Avery Chen'}}}},
    {title: 'Inline chart with an inline data source', chart: {type: 'column', data: {columns: ['A', 'B'], rows: [['x', 1], ['y', 2]], datasource: {src: './inline.csv'}}}},
  ],
};

const exported = async (source, options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx(structuredClone(source), {...options, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {bytes, parts: unzipSync(bytes), diagnostics};
};
const imported = async (bytes) => {
  const diagnostics = [];
  const result = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {deck: result, diagnostics};
};
const slidePayloads = (document) => document.slides.map(slide => slide.chart ?? slide.table ?? slide.blocks?.[0]?.chart ?? slide.blocks?.[0]?.table);

{
  const {bytes, diagnostics} = await exported(deck);
  assert.deepEqual(diagnostics.filter(entry => /provenance|data-source|datasource/.test(entry.code)), [], 'nothing about data sources is reported');
  const {deck: back, diagnostics: backDiagnostics} = await imported(bytes);
  assert.deepEqual(backDiagnostics.filter(entry => /provenance/.test(entry.code)), [], JSON.stringify(backDiagnostics));
  assert.deepEqual(back.datasources, datasources, 'the data sources map returns whole, the unused data source included');
  assert.deepEqual(back.datasets, datasets, 'every dataset returns with its provenance keys');
  const [datasetChart, datasetTable, inlineChart, inlineSource] = slidePayloads(back);
  assert.deepEqual(datasetChart.data, {dataset: 'revenue'}, 'the dataset reference returns');
  assert.deepEqual(datasetTable, {dataset: 'costs'});
  assert.deepEqual(inlineChart.data, deck.slides[2].chart.data, 'inline chart data returns with its six keys and a data source by id');
  assert.deepEqual(inlineSource.data, deck.slides[3].chart.data, 'inline chart data returns with an inline data source');
}

{
  // A data source is not drawn: the slides and charts are the same bytes with and without them, apart from the customer-data tags that carry the records.
  const plain = structuredClone(deck);
  delete plain.datasources;
  for (const dataset of Object.values(plain.datasets)) for (const key of ['datasource', 'query', 'retrieved', 'version', 'sha256', 'generator']) delete dataset[key];
  for (const slide of plain.slides) if (slide.chart?.data?.columns) for (const key of ['datasource', 'query', 'retrieved', 'version', 'sha256', 'generator']) delete slide.chart.data[key];
  const a = await exported(deck), b = await exported(plain);
  const drawn = parts => Object.keys(parts).filter(name => /^ppt\/(slides|charts)\/[^/]+\.xml$/.test(name)).sort().map(name => [name, strFromU8(parts[name]).replace(/<p:custDataLst>.*?<\/p:custDataLst>/g, '').replace(/ r:id="rIdOpf[A-Za-z]*[0-9]*"/g, '')]);
  assert.deepEqual(drawn(a.parts), drawn(b.parts), 'the drawing parts do not change');
}

{
  // A document without data sources writes no OPF_DATASOURCES_V1 tag.
  const plain = {name: 'Plain', datasets: {revenue: {columns: ['Quarter', 'Revenue'], rows: [['Q1', 12]]}}, slides: [{title: 'Chart', chart: {type: 'column', data: {dataset: 'revenue'}}}]};
  const {parts} = await exported(plain);
  assert.equal(Object.values(parts).some(bytes => strFromU8(bytes).includes('OPF_DATASOURCES_V1')), false);
}

{
  // Only data sources, no datasets: the map still returns.
  const only = {name: 'Only', datasources: {warehouse: {connector: 'postgres'}}, slides: [{title: 'x', text: 'y'}]};
  const {bytes} = await exported(only);
  const {deck: back} = await imported(bytes);
  assert.deepEqual(back.datasources, only.datasources);
}

console.log('FR-04 data sources in PPTX: ok');
