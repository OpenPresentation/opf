// FR-05 (core docs/chart-table-data.md, "Typed columns"): the type, role and unit of a dataset column and of an inline chart data column travel
// through the PowerPoint document tags unchanged. They are written inline in OPF_DATASETS_V1 (the datasets map) and OPF_DATA_V1 (a chart's authored
// data); there is no tag of their own. Nothing about a declaration is drawn: the slides' and charts' XML do not change when a deck gains them.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';

const typed = [
  {name: 'Month', type: 'date', role: 'dimension'},
  {name: 'Region', type: 'text', role: 'dimension'},
  {name: 'Revenue', format: '$#,##0', type: 'number', role: 'measure', unit: 'USD'},
  {name: 'On plan', type: 'boolean', role: 'dimension'},
];
const rows = [['2026-09', 'EMEA', 11500, true], ['2026-10', 'EMEA', 12100, true], ['2026-11', 'EMEA', null, false]];
const datasets = {
  revenue: {title: 'Revenue', columns: typed, rows},
  plain: {columns: ['Quarter', 'Costs'], rows: [['Q1', 8], ['Q2', 11]]},
};
const inlineData = {columns: [{name: 'Month', type: 'date', role: 'dimension'}, {name: 'Margin', format: '0%', type: 'number', role: 'measure', unit: 'ratio'}], rows: [['2026-09', 0.31], ['2026-10', 0.34]]};
const deck = {
  name: 'Typed columns',
  datasets,
  slides: [
    {title: 'Dataset chart', chart: {type: 'line', data: {dataset: 'revenue', fields: ['Month', 'Revenue']}}},
    {title: 'Dataset table', table: {dataset: 'revenue'}},
    {title: 'Inline chart', chart: {type: 'column', data: inlineData}},
    {title: 'Plain dataset', chart: {type: 'column', data: {dataset: 'plain'}}},
  ],
};
const withoutDeclarations = source => {
  const copy = structuredClone(source);
  const strip = columns => columns.map(column => typeof column === 'object' ? (({type, role, unit, ...rest}) => Object.keys(rest).length === 1 ? rest.name : rest)(column) : column);
  for (const dataset of Object.values(copy.datasets)) dataset.columns = strip(dataset.columns);
  for (const slide of copy.slides) if (slide.chart?.data?.columns) slide.chart.data.columns = strip(slide.chart.data.columns);
  return copy;
};

const exported = async (source, options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx(structuredClone(source), {...options, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {bytes, parts: unzipSync(bytes), diagnostics};
};
const imported = async bytes => {
  const diagnostics = [];
  const result = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {deck: result, diagnostics};
};
const tags = parts => Object.entries(parts).filter(([name]) => /^ppt\/tags\//.test(name)).flatMap(([, bytes]) => [...strFromU8(bytes).matchAll(/<p:tag name="([^"]+)" val="([0-9A-F]*)"\/>/g)].map(([, name, hex]) => [name, JSON.parse(Buffer.from(hex, 'hex').toString('utf8'))]));

{
  // Every key returns, beside a string column and a dataset that declares nothing.
  const {bytes, diagnostics} = await exported(deck);
  assert.deepEqual(diagnostics.filter(entry => /provenance|column|type/.test(entry.code)), [], JSON.stringify(diagnostics));
  const {deck: back, diagnostics: backDiagnostics} = await imported(bytes);
  assert.deepEqual(backDiagnostics.filter(entry => /provenance/.test(entry.code)), [], JSON.stringify(backDiagnostics));
  assert.deepEqual(back.datasets, datasets, 'the datasets return with the type, role and unit of every column');
  assert.equal(typeof back.datasets.plain.columns[0], 'string', 'a string column is not rewritten as an object');
  const [datasetChart, datasetTable, inlineChart] = back.slides.map(slide => slide.chart ?? slide.table);
  assert.deepEqual(datasetChart.data, {dataset: 'revenue', fields: ['Month', 'Revenue']});
  assert.deepEqual(datasetTable, {dataset: 'revenue'});
  assert.deepEqual(inlineChart.data, inlineData, 'inline chart data returns with its declared columns');
}

{
  // A declaration is not drawn: the slides and charts are the same bytes with and without it, apart from the tags that carry the records.
  const a = await exported(deck), b = await exported(withoutDeclarations(deck));
  const drawn = parts => Object.keys(parts).filter(name => /^ppt\/(slides|charts)\/[^/]+\.xml$/.test(name)).sort().map(name => [name, strFromU8(parts[name]).replace(/<p:custDataLst>.*?<\/p:custDataLst>/g, '').replace(/ r:id="rIdOpf[A-Za-z]*[0-9]*"/g, '')]);
  assert.deepEqual(drawn(a.parts), drawn(b.parts), 'the drawing parts do not change');
}

{
  // What a 0.36.0 importer does with these files (document-roundtrip.md, "Decks written by a newer OPF"): its closed DataColumn takes only name and
  // format, so the dataset record and an inline chart-data record that carry a declaration do not validate there (invalid-data-provenance); no
  // dataset is restored, and the charts and tables import the values they show. This pins the premise: the keys are written inside those two records
  // and nowhere else, and a deck without declarations writes records a 0.36.0 importer accepts.
  const OLD_COLUMN_KEYS = new Set(['name', 'format']);
  const {parts} = await exported(deck);
  const stored = Object.fromEntries(tags(parts));
  const outside = Object.values(stored.OPF_DATASETS_V1).flatMap(dataset => dataset.columns.filter(column => typeof column === 'object').flatMap(column => Object.keys(column).filter(key => !OLD_COLUMN_KEYS.has(key))));
  assert.ok(outside.includes('type') && outside.includes('role') && outside.includes('unit'), 'a 0.36 importer sees keys its DataColumn does not allow, so it rejects the record');
  assert.equal(tags(parts).some(([name]) => /COLUMN|TYPES/.test(name)), false, 'there is no tag of its own for declarations');
  const dataRecords = tags(parts).filter(([name]) => name === 'OPF_DATA_V1').map(([, record]) => record);
  assert.ok(dataRecords.some(record => record.kind === 'chart' && record.data?.columns?.some(column => column?.type === 'date')), 'inline chart data keeps its declared columns in the chart-data record');
  const {parts: plainParts} = await exported(withoutDeclarations(deck));
  const plain = Object.fromEntries(tags(plainParts));
  const plainOutside = Object.values(plain.OPF_DATASETS_V1).flatMap(dataset => dataset.columns.filter(column => typeof column === 'object').flatMap(column => Object.keys(column).filter(key => !OLD_COLUMN_KEYS.has(key))));
  assert.deepEqual(plainOutside, [], 'a deck without declarations writes only keys a 0.36 importer accepts');
}

console.log('FR-05 typed columns in PPTX: ok');
