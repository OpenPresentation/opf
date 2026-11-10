import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chartDrawDiagnostics, chartDrawPlan, resolveChartData } from '../dist/composition.js';
import { validate } from '../dist/index.js';

// Exact chart data of immutable genuine-0.33 E1 batch-02/s36. Both numeric series belong to the authored chart.
const data = { columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 26, 23], ['Q2', 30, 25], ['Q3', 33, 27], ['Q4', 37, 29]] };
const chart = { type: 'pareto', data };
const mappings = async value => (await validate({ slides: [{ id: 's36', chart: { alt: 'Current and baseline by quarter', ...value } }] })).findings.filter(f => f.ruleId === 'opf/chart-mapping-adapted');

test('multi-series Pareto reports its unsupported cumulative representation without changing or losing data', async () => {
  const before = structuredClone(chart);
  const resolved = resolveChartData(chart);
  assert.equal(resolved.ok, true);
  const plan = chartDrawPlan(chart, resolved);
  assert.equal(plan.type, 'column');
  assert.deepEqual(plan.columns, data.columns);
  assert.deepEqual(plan.rows, data.rows);
  assert.deepEqual(plan.dropped, []);
  const found = await mappings(chart);
  assert.equal(found.length, 1, 'public validation must expose the drawn type adaptation even when all series are retained');
  assert.equal(found[0].severity, 'warning');
  assert.equal(found[0].path, '/slides/0/chart/type');
  assert.match(found[0].help, /compatible chart type or mapping/, 'repair advice must not ask to delete retained data or an absent mapping entry');
  assert.match(found[0].message, /Pareto.*one numeric series/i);
  assert.match(found[0].message, /clustered columns.*data order.*every series/i);
  assert.deepEqual(chart, before);
});

test('a single numeric Pareto series and an ordinary multi-series column do not receive this adaptation', async () => {
  const single = { type: 'pareto', data: { columns: data.columns.slice(0, 2), rows: data.rows.map(r => r.slice(0, 2)) } };
  const resolved = resolveChartData(single);
  assert.equal(resolved.ok, true);
  assert.equal(chartDrawPlan(single, resolved).type, 'pareto');
  assert.deepEqual(await mappings(single), []);
  assert.deepEqual(await mappings({ type: 'column', data }), []);
});

test('the adaptation follows numeric series, not merely the number of labeled columns', () => {
  const notes = { type: 'pareto', data: { columns: ['Quarter', 'Current', 'Note'], rows: [['Q1', 26, 'first'], ['Q2', 30, 'second']] } };
  const resolved = resolveChartData(notes);
  assert.equal(resolved.ok, true);
  const found = chartDrawDiagnostics(notes, resolved, '/chart');
  assert.equal(found.some(f => f.code === 'chart-mapping-adapted'), false);
  assert.equal(found.some(f => f.code === 'chart-series-dropped'), true, 'existing dropped-note warning remains distinct');
});
