import assert from 'node:assert/strict';
import {unzipSync, zipSync, strFromU8} from 'fflate';
import {toPptx, fromPptx} from './helpers/default-catalog.mjs';
const data = {columns: ['Category', 'First', 'Second', 'Third'], rows: [['A', 10, 2, 3], ['B', 20, null, 6]]};
const deck = {slides: [{title: 'All authored series', chart: {type: 'pareto', data}}]};
for (const mode of ['auto', 'fallback']) {
  for (const provenance of ['full', false]) {
    const diagnostics = [];
    const bytes = await toPptx(deck, {chartex: mode, provenance, onDiagnostic: d => diagnostics.push(d)});
    const parts = unzipSync(bytes);
    assert.equal(Object.keys(parts).filter(p => /^ppt\/charts\/chartEx/.test(p)).length, 0);
    const chart = strFromU8(parts['ppt/charts/chart1.xml']);
    assert.equal([...chart.matchAll(/<c:ser>/g)].length, 3);
    for (const name of data.columns.slice(1)) assert.ok(chart.includes(`<c:v>${name}</c:v>`));
    const workbook = unzipSync(parts[Object.keys(parts).find(p => /^ppt\/embeddings\/.*\.xlsx$/.test(p))]);
    const sheet = strFromU8(workbook['xl/worksheets/sheet1.xml']);
    for (const coordinate of ['A1', 'B1', 'C1', 'D1', 'A2', 'B2', 'C2', 'D2', 'A3', 'B3', 'D3']) assert.ok(sheet.includes(`r="${coordinate}"`), coordinate);
    const values = Object.fromEntries([...sheet.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(([, attributes, body]) => [attributes.match(/r="([^"]+)"/)[1], body?.match(/<v>([^<]*)<\/v>/)?.[1]]));
    for (const [cell, expected] of Object.entries({B2: '10', C2: '2', D2: '3', B3: '20', D3: '6'})) assert.equal(values[cell], expected, `workbook ${cell}`);
    assert.ok(values.C3 === undefined || values.C3 === '', 'null stays a workbook gap');
    const strings = strFromU8(workbook['xl/sharedStrings.xml']);
    for (const text of [...data.columns, 'A', 'B']) assert.ok((strings + sheet).includes(`>${text}<`), `workbook text ${text}`);
    // Strip all OPF tags: the plotted native data must stand on its own.
    for (const file of Object.keys(parts)) if (file.startsWith('ppt/tags/')) delete parts[file];
    const imported = await fromPptx(zipSync(parts));
    const actual = imported.slides[0].chart ?? imported.slides[0].blocks?.find(b => b.chart)?.chart;
    assert.deepEqual(actual.data, data);
    assert.notEqual(actual.type, 'pareto', 'fallback imports as the actual native column construct');
    assert.ok(diagnostics.some(d => d.code === 'chart-data-adapted' && d.adaptation === 'chartex-fallback'));
    assert.ok(!diagnostics.some(d => d.adaptation === 'series-dropped'));
  }
}
await assert.rejects(toPptx(deck, {chartex: 'native'}), e => e.code === 'unsupported-chart-data' && e.details.path.includes('chart') && e.details.series.length === 3);
const single = {slides: [{chart: {type: 'pareto', data: {columns: ['Category', 'Only'], rows: [['A', 10], ['B', 20]]}}}]};
const auto = await toPptx(single), native = await toPptx(single, {chartex: 'native'});
assert.deepEqual(auto, native);
assert.ok(Object.keys(unzipSync(native)).some(p => /^ppt\/charts\/chartEx/.test(p)));
const formattedData = {columns: ['Category', {name: 'First', format: '0.0'}, 'Second', 'Third'], rows: data.rows};
const formattedBytes = await toPptx({slides: [{chart: {type: 'pareto', data: formattedData}}]}, {provenance: false});
const formattedSlide = (await fromPptx(formattedBytes)).slides[0];
assert.deepEqual((formattedSlide.chart ?? formattedSlide.blocks?.find(b => b.chart)?.chart).data, formattedData, 'series formats and gaps survive without provenance');
const mapped = {datasets: {values: data}, slides: [{chart: {type: 'pareto', data: {dataset: 'values'}, mapping: {category: 'Category', series: ['Third', 'First', 'Second']}}}]};
const mappedBytes = await toPptx(mapped, {provenance: false});
const mappedSlide = (await fromPptx(mappedBytes)).slides[0];
const mappedChart = mappedSlide.chart ?? mappedSlide.blocks?.find(b => b.chart)?.chart;
assert.deepEqual(mappedChart.data, {columns: ['Category', 'Third', 'First', 'Second'], rows: [['A', 3, 10, 2], ['B', 6, 20, null]]});
await assert.rejects(toPptx(mapped, {chartex: 'native'}), e => e.code === 'unsupported-chart-data');
const selected = structuredClone(mapped);
selected.slides[0].chart.mapping.series = ['Second'];
assert.ok(Object.keys(unzipSync(await toPptx(selected, {chartex: 'native'}))).some(p => /^ppt\/charts\/chartEx/.test(p)), 'single resolved series is supported despite unused authored columns');
console.log('Pareto: all three series survive editable fallback without provenance; explicit native rejects; single-series unchanged.');
