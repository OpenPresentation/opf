import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fix, validate, fill } from '../dist/index.js';
import { resolveMetric, updateMetricLiterals } from '../dist/data.js';
import { composeSlide } from '../dist/composition.js';
import { gallery } from '@openpresentation/gallery';
import { schemas } from '../dist/schemas.js';
import { fromMarkdown, toMarkdown } from '../dist/markdown.js';
import { fromYaml, toYaml } from '../dist/yaml.js';

// FR-06: a metric computed from data. `metric.data` links a metric to rows of a dataset of the deck; core computes the value and,
// optionally, the change, and the arrow and its color follow. `metric.format` writes a number value; `metric.better` says which direction
// of change is good.

const ARR = {
  columns: [
    { name: 'Month', type: 'date', role: 'dimension' },
    { name: 'Region', type: 'text', role: 'dimension' },
    { name: 'ARR', format: '$#,##0.0M', type: 'number', role: 'measure', unit: 'USD' },
    { name: 'Churn', format: '0.0%', type: 'number', role: 'measure' },
    { name: 'ARR change', format: '+$#,##0.0M;-$#,##0.0M;$0', type: 'number', role: 'measure', unit: 'USD' },
  ],
  rows: [
    ['2026-09', 'EMEA', 3.9, 0.041, null],
    ['2026-10', 'EMEA', 4.2, 0.036, 0.3],
    ['2026-11', 'EMEA', 4.4, 0.044, 0.2],
  ],
};
const decks = (metric, datasets = { arr: ARR }) => ({ name: 'FR-06', language: 'en-US', datasets, slides: [{ title: 'Metric', metric }] });
const link = (extra = {}) => ({ dataset: 'arr', field: 'ARR', aggregate: 'last', ...extra });
const run = (document, options = {}) => validate(document, { catalogs: [gallery], only: ['format', 'content'], ...options });
const rules = (report, id) => report.findings.filter((finding) => finding.ruleId === id);
const resolve = (metric, datasets = { arr: ARR }) => resolveMetric(metric, { datasets }, { path: '/slides/0/metric' });
const drawn = (metric, datasets) => resolve(metric, datasets).metric;

describe('the schema', () => {
  test('the link and its change are in the schema, with the new keys on the metric', () => {
    const defs = schemas.presentation.$defs;
    for (const name of ['DataCondition', 'DataFilter', 'DataLink', 'MetricData', 'MetricDelta']) assert.ok(defs[name], name);
    for (const key of ['data', 'better', 'format']) assert.ok(defs.Metric.properties[key], key);
    assert.deepEqual(defs.Metric.required, ['value']);
  });

  test('MetricData minus its change is exactly DataLink', () => {
    const { delta, ...rest } = schemas.presentation.$defs.MetricData.properties;
    assert.deepEqual(Object.keys(rest), Object.keys(schemas.presentation.$defs.DataLink.properties));
    assert.deepEqual(schemas.presentation.$defs.MetricData.required, schemas.presentation.$defs.DataLink.required);
    for (const key of Object.keys(rest)) assert.deepEqual(rest[key].$ref ?? rest[key].enum ?? rest[key].type, schemas.presentation.$defs.DataLink.properties[key].$ref ?? schemas.presentation.$defs.DataLink.properties[key].enum ?? schemas.presentation.$defs.DataLink.properties[key].type, key);
  });

  test('every kind of link is valid, and a metric without one is as it was', () => {
    const cases = [
      { value: 4.4, data: link() },
      { value: 4.4, data: link({ filter: [{ field: 'Region', op: '=', value: 'EMEA' }, { field: 'Month', op: 'in', value: ['2026-10', '2026-11'] }] }) },
      { value: 4.4, delta: 0.2, data: link({ delta: { compare: 'previous' } }) },
      { value: 4.4, delta: 0.5, data: link({ delta: { compare: { filter: [{ field: 'Month', op: '=', value: '2026-09' }] }, as: 'percent', format: '+0.0%;-0.0%;0%' } }) },
      { value: 4.4, delta: 0.4, data: link({ delta: { compare: { value: 4 } } }) },
      { value: 4.4, delta: 0.2, data: link({ delta: { field: 'ARR change' } }) },
      { value: 0.044, better: 'down', trend: 'up' },
      { value: 4.4, format: '$#,##0.0M' },
      'plain string',
    ];
    for (const metric of cases) {
      const report = run(decks(metric));
      assert.deepEqual(report.findings.filter((finding) => finding.severity === 'error'), [], JSON.stringify(metric));
    }
  });

  test('a link needs dataset, field and aggregate; a change takes exactly one of compare and field; the keys are closed', () => {
    const invalid = [
      { value: 1, data: { field: 'ARR', aggregate: 'last' } },
      { value: 1, data: { dataset: 'arr', field: 'ARR', aggregate: 'median' } },
      { value: 1, data: link({ filter: [] }) },
      { value: 1, data: link({ filter: [{ field: 'Region', op: 'like', value: 'E' }] }) },
      { value: 1, data: link({ delta: {} }) },
      { value: 1, data: link({ delta: { compare: 'previous', field: 'ARR change' } }) },
      { value: 1, data: link({ delta: { compare: { value: 'x' } } }) },
      { value: 1, data: link({ delta: { compare: 'previous', as: 'ratio' } }) },
      { value: 1, data: link({ expression: 'sum(ARR)' }) },
      { value: 1, better: 'sideways' },
    ];
    for (const metric of invalid) assert.equal(run(decks(metric)).valid, false, JSON.stringify(metric));
  });
});

describe('computing the value', () => {
  test('last, with a filter and a change against the previous row', () => {
    const result = resolve({ value: 4.4, delta: 0.2, data: link({ filter: [{ field: 'Region', op: '=', value: 'EMEA' }], delta: { compare: 'previous' } }) });
    assert.equal(result.resolved, true);
    assert.deepEqual(result.metric, { value: '$4.4M', delta: '+$0.2M', trend: 'up' });
    assert.deepEqual(result.record.derived, ['value', 'delta', 'trend']);
    assert.deepEqual(result.record.numbers, { value: 4.4, delta: 0.2 });
    assert.equal(result.value.text, '$4.4M');
    assert.equal(result.value.number, 4.4);
    assert.equal(result.value.format, '$#,##0.0M');
    assert.equal(result.value.isNumber, true);
    assert.deepEqual(result.diagnostics, []);
  });

  test('a percent change; better "down" turns a rising churn red', () => {
    const result = resolve({ value: 0.044, delta: 0.2222222222222222, better: 'down', data: link({ field: 'Churn', delta: { compare: 'previous', as: 'percent' } }) });
    assert.deepEqual(result.metric, { value: '4.4%', delta: '+22%', trend: 'up', sentiment: 'negative' });
    assert.deepEqual(result.record.derived, ['value', 'delta', 'trend', 'sentiment']);
    assert.deepEqual(result.diagnostics, []);
  });

  test('a change against a baseline filter replaces the main filter instead of adding to it', () => {
    const result = resolve({ value: 4.4, delta: 0.5, data: link({ filter: [{ field: 'Region', op: '=', value: 'APAC' }], delta: { compare: { filter: [{ field: 'Month', op: '=', value: '2026-09' }] } } }) });
    // The metric's own filter keeps no row (no APAC), so the link does not resolve; the baseline is checked on its own below.
    assert.equal(result.resolved, false);
    const ok = resolve({ value: 4.4, delta: 0.5, data: link({ delta: { compare: { filter: [{ field: 'Month', op: '=', value: '2026-09' }] } } }) });
    assert.equal(ok.metric.delta, '+$0.5M');
    assert.equal(ok.metric.trend, 'up');
  });

  test('a fixed value to compare with, as a difference and as a percent', () => {
    assert.equal(drawn({ value: 4.4, data: link({ delta: { compare: { value: 5 } } }) }).delta, '-$0.6M');
    assert.equal(drawn({ value: 4.4, data: link({ delta: { compare: { value: 5 } } }) }).trend, 'down');
    assert.equal(drawn({ value: 4.4, data: link({ delta: { compare: { value: 4 }, as: 'percent' } }) }).delta, '+10%');
    assert.equal(drawn({ value: 4.4, data: link({ delta: { compare: { value: 4.4 } } }) }).trend, 'flat');
  });

  test('a change read from a column that already holds it, in the column\'s own format', () => {
    const result = resolve({ value: 4.4, delta: 0.2, data: link({ delta: { field: 'ARR change' } }) });
    assert.deepEqual(result.metric, { value: '$4.4M', delta: '+$0.2M', trend: 'up' });
  });

  test('a typed trend and a typed sentiment win over the computed ones', () => {
    const result = resolve({ value: 4.4, delta: 0.2, trend: 'down', sentiment: 'neutral', better: 'down', data: link({ delta: { compare: 'previous' } }) });
    assert.equal(result.metric.trend, 'down');
    assert.equal(result.metric.sentiment, 'neutral');
    assert.deepEqual(result.record.derived, ['value', 'delta']);
  });

  test('better also colors a typed trend of a metric without a link', () => {
    const result = resolve({ value: 0.044, trend: 'up', better: 'down' });
    assert.deepEqual(result.metric, { value: 0.044, trend: 'up', sentiment: 'negative' });
    assert.equal(resolve({ value: 0.03, trend: 'down', better: 'down' }).metric.sentiment, 'positive');
    assert.equal(resolve({ value: 0.03, trend: 'flat', better: 'down' }).metric.sentiment, 'neutral');
    assert.equal(resolve({ value: 1, trend: 'up', better: 'up' }).metric.sentiment, undefined);
    assert.equal(resolve({ value: 1, better: 'down' }).metric.sentiment, undefined);
  });

  test('the aggregates', () => {
    const numbers = { n: { columns: ['K', 'V'], rows: [['a', 1], ['b', 2], ['c', 6], ['d', null]] } };
    const value = (aggregate, field = 'V') => drawn({ value: 0, data: { dataset: 'n', field, aggregate } }, numbers).value;
    assert.equal(value('sum'), 9);
    assert.equal(value('mean'), 3);
    assert.equal(value('min'), 1);
    assert.equal(value('max'), 6);
    assert.equal(value('count'), 4);
    assert.equal(value('first'), 1);
    assert.equal(value('last'), 6);
    assert.equal(value('first', 'K'), 'a');
    assert.equal(value('last', 'K'), 'd');
  });

  test('count counts rows, not cells; first and last skip a null cell', () => {
    const sets = { n: { columns: ['K', 'V'], rows: [['a', 1], ['b', null], ['c', null]] } };
    assert.equal(drawn({ value: 0, data: { dataset: 'n', field: 'V', aggregate: 'count' } }, sets).value, 3);
    assert.equal(drawn({ value: 0, data: { dataset: 'n', field: 'V', aggregate: 'last' } }, sets).value, 1);
    assert.equal(drawn({ value: 0, data: { dataset: 'n', field: 'V', aggregate: 'count', filter: [{ field: 'V', op: '!=', value: null }] } }, sets).value, 1);
  });

  test('an undeclared column also reads strict decimal strings, a declared number column does not', () => {
    const undeclared = { n: { columns: ['V'], rows: [['1.5'], [2], ['x'], ['$3']] } };
    assert.equal(drawn({ value: 0, data: { dataset: 'n', field: 'V', aggregate: 'sum' } }, undeclared).value, 3.5);
    const declared = { n: { columns: [{ name: 'V', type: 'number' }], rows: [['1.5'], [2]] } };
    assert.equal(drawn({ value: 0, data: { dataset: 'n', field: 'V', aggregate: 'sum' } }, declared).value, 2);
  });

  test('min and max of a date column go by time order, and return the cell as written', () => {
    const sets = { q: { columns: [{ name: 'Quarter', type: 'date' }, 'V'], rows: [['Q3 2026', 1], ['Q1 2026', 2], ['Q4 2025', 3]] } };
    assert.equal(drawn({ value: '', data: { dataset: 'q', field: 'Quarter', aggregate: 'min' } }, sets).value, 'Q4 2025');
    assert.equal(drawn({ value: '', data: { dataset: 'q', field: 'Quarter', aggregate: 'max' } }, sets).value, 'Q3 2026');
  });

  test('the comparison operators: numbers as numbers, dates by time order, else by code point; no other pair meets one', () => {
    const sets = { m: { columns: [{ name: 'Month', type: 'date' }, 'V', 'Name'], rows: [['2026-03', 1, 'b'], ['2026-11', 2, 'a'], ['2026-09', 3, 'c']] } };
    const sum = (filter) => drawn({ value: 0, data: { dataset: 'm', field: 'V', aggregate: 'sum', filter } }, sets).value;
    assert.equal(sum([{ field: 'Month', op: '<', value: '2026-09' }]), 1);
    assert.equal(sum([{ field: 'Month', op: '>=', value: '2026-09' }]), 5);
    assert.equal(sum([{ field: 'V', op: '>', value: 1 }]), 5);
    assert.equal(sum([{ field: 'Name', op: '<', value: 'c' }]), 3);
    assert.equal(sum([{ field: 'V', op: '=', value: '1' }]), 0);
    assert.equal(sum([{ field: 'V', op: '<', value: 'a' }]), 0);
    assert.equal(sum([{ field: 'V', op: 'in', value: [1, 3] }]), 4);
    assert.equal(sum([{ field: 'V', op: 'in', value: 2 }]), 2);
    assert.equal(sum([{ field: 'V', op: '>=', value: 1 }, { field: 'V', op: '<=', value: 2 }]), 3);
  });
});

describe('what is drawn when the link does not resolve', () => {
  test('an unknown dataset or field is an error and the written value is drawn', () => {
    const result = resolve({ value: 4.4, delta: '+5%', data: link({ dataset: 'revenue' }) });
    assert.equal(result.resolved, false);
    assert.deepEqual(result.metric, { value: 4.4, delta: '+5%' });
    assert.deepEqual(result.diagnostics.map((entry) => [entry.code, entry.severity, entry.path]), [['dataset-unknown', 'error', '/slides/0/metric/data/dataset']]);
    const field = resolve({ value: 1, data: link({ filter: [{ field: 'Regoin', op: '=', value: 'EMEA' }], delta: { field: 'Nope' } }) });
    assert.deepEqual(field.diagnostics.map((entry) => entry.path), ['/slides/0/metric/data/filter/0/field', '/slides/0/metric/data/delta/field']);
  });

  test('a text or boolean column refuses sum, mean, min and max with a warning', () => {
    const result = resolve({ value: 1, data: link({ field: 'Region', aggregate: 'sum' }) });
    assert.equal(result.resolved, false);
    assert.equal(result.metric.value, 1);
    assert.deepEqual(result.diagnostics.map((entry) => [entry.code, entry.severity, entry.path]), [['metric-data-aggregate', 'warning', '/slides/0/metric/data/aggregate']]);
    assert.equal(result.diagnostics[0].message, '"sum" needs numbers, and column "Region" is typed text. The written value is shown.');
    assert.equal(resolve({ value: 1, data: link({ field: 'Region', aggregate: 'count' }) }).resolved, true);
  });

  test('no row kept, or no usable cell, is an empty warning', () => {
    const none = resolve({ value: 3.1, data: link({ filter: [{ field: 'Region', op: '=', value: 'APAC' }] }) });
    assert.equal(none.resolved, false);
    assert.equal(none.metric.value, 3.1);
    assert.deepEqual(none.diagnostics.map((entry) => entry.code), ['metric-data-empty']);
    assert.equal(none.diagnostics[0].message, 'No row of "arr" gives a value for this metric. The written value is shown.');
    const nulls = resolve({ value: 1, data: { dataset: 'n', field: 'V', aggregate: 'sum' } }, { n: { columns: ['V'], rows: [[null], ['x']] } });
    assert.deepEqual(nulls.diagnostics.map((entry) => entry.code), ['metric-data-empty']);
  });

  test('a change that cannot be computed is a warning and no change is drawn; the value is still drawn', () => {
    const one = resolve({ value: 4.4, delta: '+9%', data: link({ filter: [{ field: 'Month', op: '=', value: '2026-11' }], delta: { compare: 'previous' } }) });
    assert.equal(one.metric.value, '$4.4M');
    assert.equal(one.metric.delta, '+9%');
    assert.equal(one.metric.trend, undefined);
    assert.deepEqual(one.diagnostics.map((entry) => [entry.code, entry.path]), [['metric-data-delta', '/slides/0/metric/data/delta']]);
    assert.match(one.diagnostics[0].message, /^The change cannot be computed: .*\. No change is shown\.$/);
    const zero = resolve({ value: 4.4, data: link({ delta: { compare: { value: 0 }, as: 'percent' } }) });
    assert.deepEqual(zero.diagnostics.map((entry) => entry.code), ['metric-data-delta']);
    const text = resolve({ value: 'x', data: link({ field: 'Region', aggregate: 'last', delta: { compare: 'previous' } }) });
    assert.match(text.diagnostics[0].message, /the value is not a number/);
    const baseline = resolve({ value: 4.4, data: link({ delta: { compare: { filter: [{ field: 'Month', op: '=', value: '2025-01' }] } } }) });
    assert.deepEqual(baseline.diagnostics.map((entry) => entry.code), ['metric-data-delta']);
  });

  test('a metric without data, better and format is returned as it is', () => {
    const plain = { value: 42, label: 'Users', delta: 3 };
    assert.equal(resolveMetric(plain, { datasets: { arr: ARR } }).metric, plain);
    assert.equal(resolveMetric('$4.2M', {}).metric, '$4.2M');
    assert.equal(resolveMetric(42, undefined).metric, 42);
  });
});

describe('the number format', () => {
  test('a number value is written with the metric format; a percent multiplies by 100', () => {
    assert.equal(drawn({ value: 0.044, format: '0.0%' }).value, '4.4%');
    assert.equal(drawn({ value: 4.4, format: '$#,##0.0M' }).value, '$4.4M');
    assert.equal(drawn({ value: '$4.4M', format: '0.0%' }).value, '$4.4M');
  });

  test('the metric format wins over the column format, which wins over the number rules', () => {
    assert.equal(drawn({ value: 0, data: link({ field: 'Churn' }) }).value, '4.4%');
    assert.equal(drawn({ value: 0, format: '0.00', data: link({ field: 'Churn' }) }).value, '0.04');
    assert.equal(drawn({ value: 0, data: link({ field: 'Churn', aggregate: 'count' }) }).value, '300.0%');
    const bare = { n: { columns: ['V'], rows: [[1234.5]] } };
    assert.equal(drawn({ value: 0, data: { dataset: 'n', field: 'V', aggregate: 'last' } }, bare).value, 1234.5);
  });

  test('a typed numeric change of a metric with a format gets sign sections built from it', () => {
    const result = resolve({ value: 4.4, delta: 0.2, format: '$#,##0.0M', trend: 'up' });
    assert.deepEqual(result.metric, { value: '$4.4M', delta: '+$0.2M', trend: 'up' });
    assert.deepEqual(result.record, { format: '$#,##0.0M', numbers: { value: 4.4, delta: 0.2 } });
  });

  test('a unit the format already prints is a warning, for the metric\'s format and for the column\'s', () => {
    const own = resolve({ value: 4.4, unit: 'M', format: '#,##0.0M' });
    assert.deepEqual(own.diagnostics.map((entry) => [entry.code, entry.path]), [['metric-unit-repeated', '/slides/0/metric/unit']]);
    assert.equal(own.diagnostics[0].message, 'The metric\'s unit "M" is already printed by its number format "#,##0.0M", so it is drawn twice.');
    assert.equal(resolve({ value: 0.044, unit: '%', data: link({ field: 'Churn' }) }).diagnostics.some((entry) => entry.code === 'metric-unit-repeated'), true);
    assert.deepEqual(resolve({ value: 4.4, unit: 'USD', format: '$#,##0.0M' }).diagnostics, []);
  });

  test('an invalid format is an error', () => {
    const result = resolve({ value: 4.4, format: 'abc' });
    assert.deepEqual(result.diagnostics.map((entry) => [entry.code, entry.severity, entry.path]), [['number-format-invalid', 'error', '/slides/0/metric/format']]);
    assert.equal(result.metric.value, 4.4);
  });
});

describe('validation', () => {
  test('an unknown dataset and an unknown field are errors at the key', () => {
    const dataset = run(decks({ value: 4.4, data: link({ dataset: 'revenue' }) }));
    const found = rules(dataset, 'opf/dataset-unknown');
    assert.equal(found.length, 1);
    assert.equal(found[0].path, '/slides/0/metric/data/dataset');
    assert.equal(found[0].severity, 'error');
    const field = run(decks({ value: 4.4, data: link({ filter: [{ field: 'Regoin', op: '=', value: 'EMEA' }] }) }));
    assert.deepEqual(rules(field, 'opf/dataset-field-unknown').map((entry) => entry.path), ['/slides/0/metric/data/filter/0/field']);
    assert.equal(dataset.valid, false);
  });

  test('the same errors are found on a metric in a block', () => {
    const document = { name: 'x', language: 'en-US', datasets: { arr: ARR }, slides: [{ title: 'T', blocks: [{ metric: { value: 1, data: link({ field: 'Nope' }) } }] }] };
    assert.deepEqual(rules(run(document), 'opf/dataset-field-unknown').map((entry) => entry.path), ['/slides/0/blocks/0/metric/data/field']);
  });

  test('a written value that differs from the computed one is a warning with a safe fix; the fix writes the number', () => {
    const document = decks({ value: '$4.2M', data: link() }, { arr: { columns: ['Month', 'ARR'], rows: [['2026-10', 4.2], ['2026-11', 4.4]] } });
    const report = run(document);
    const [stale] = rules(report, 'opf/metric-data-stale');
    assert.equal(stale.severity, 'warning');
    assert.equal(stale.path, '/slides/0/metric/value');
    assert.equal(stale.message, 'The metric shows 4.4 from "arr", but its value is written as $4.2M. Readers that do not compute show the written value.');
    assert.deepEqual(stale.fixes.map((entry) => [entry.safe, entry.patch]), [[true, [{ op: 'replace', path: '/slides/0/metric/value', value: 4.4 }]]]);
    // A content check is an audit: `fix` applies its safe fixes with `audits`.
    const fixed = fix(document, { catalogs: [gallery], audits: true });
    assert.equal(fixed.document.slides[0].metric.value, 4.4);
    assert.equal(rules(run(fixed.document), 'opf/metric-data-stale').length, 0);
  });

  test('a written change that differs is a warning too; an equal one, written as a number or as the drawn text, is not', () => {
    const base = { value: 4.4, data: link({ delta: { compare: 'previous' } }) };
    const stale = rules(run(decks({ ...base, delta: 0.5 })), 'opf/metric-data-stale');
    assert.deepEqual(stale.map((entry) => entry.path), ['/slides/0/metric/delta']);
    assert.deepEqual(stale[0].fixes[0].patch, [{ op: 'replace', path: '/slides/0/metric/delta', value: 0.2 }]);
    assert.equal(rules(run(decks({ ...base, delta: 0.2 })), 'opf/metric-data-stale').length, 0);
    assert.equal(rules(run(decks({ ...base, value: '$4.4M', delta: '+$0.2M' })), 'opf/metric-data-stale').length, 0);
    const missing = rules(run(decks({ value: 4.4, data: link({ delta: { compare: 'previous' } }) })), 'opf/metric-data-stale');
    assert.deepEqual(missing[0].fixes[0].patch, [{ op: 'add', path: '/slides/0/metric/delta', value: 0.2 }]);
  });

  test('a typed change beside a link without a change is drawn as written and is never stale', () => {
    const report = run(decks({ value: 4.4, delta: '+12%', data: link() }));
    assert.equal(rules(report, 'opf/metric-data-stale').length, 0);
    assert.equal(drawn({ value: 4.4, delta: '+12%', data: link() }).delta, '+12%');
  });

  test('the warnings of the unresolved link and of the unit are findings of their rules', () => {
    // A column's declared type (FR-05) is what refuses the aggregate.
    assert.equal(rules(run(decks({ value: 1, data: link({ field: 'Region', aggregate: 'sum' }) })), 'opf/metric-data-aggregate').length, 1);
    assert.equal(rules(run(decks({ value: 1, data: link({ filter: [{ field: 'Region', op: '=', value: 'APAC' }] }) })), 'opf/metric-data-empty').length, 1);
    assert.equal(rules(run(decks({ value: 1, data: link({ filter: [{ field: 'Month', op: '=', value: '2026-11' }], delta: { compare: 'previous' } }) })), 'opf/metric-data-delta').length, 1);
    assert.equal(rules(run(decks({ value: 4.4, unit: 'M', format: '#,##0.0M' })), 'opf/metric-unit-repeated').length, 1);
  });
});

describe('composition draws what the link computes', () => {
  const compose = (metric, datasets = { arr: ARR }) => {
    const slide = { title: 'Metric', metric };
    const result = composeSlide(slide, { presentation: { language: 'en-US', datasets, slides: [slide] }, slideIndex: 0 });
    const item = result.items.find((entry) => entry.field === 'metric');
    return { item, text: Object.fromEntries(item.metricLayout.parts.map((part) => [part.role, part.text])) };
  };

  test('the value, the change and the arrow are the computed ones, and the record rides with the item', () => {
    const { item, text } = compose({ label: 'EMEA ARR', value: 1, delta: 'old', data: link({ delta: { compare: 'previous' } }) });
    assert.equal(text.value, '$4.4M');
    assert.equal(text.delta, '+$0.2M');
    assert.equal(text.trend, 'up');
    assert.equal(item.value.value, '$4.4M');
    assert.deepEqual(item.metricRecord.derived, ['value', 'delta', 'trend']);
  });

  test('a link that does not resolve draws the written value', () => {
    const { text, item } = compose({ value: '3.1', data: link({ dataset: 'missing' }) });
    assert.equal(text.value, '3.1');
    assert.equal(item.metricRecord.data.dataset, 'missing');
  });

  test('a metric without the new keys is composed exactly as before', () => {
    const slide = { title: 'Metric', metric: { value: 1234.5, label: 'Users', delta: '+3%', trend: 'up' } };
    const result = composeSlide(slide, { presentation: { language: 'en-US', slides: [slide] }, slideIndex: 0 });
    const item = result.items.find((entry) => entry.field === 'metric');
    assert.equal(item.value, slide.metric);
    assert.equal(item.metricRecord, undefined);
  });
});

describe('a deck written as text', () => {
  const document = () => ({
    name: 'FR-06', language: 'en-US',
    datasets: { arr: ARR },
    slides: [
      { title: 'Plain', metric: '$4.2M' },
      { title: 'Value', metric: { value: 4.4, label: 'ARR', data: link({ filter: [{ field: 'Region', op: '=', value: 'EMEA' }] }) } },
      { title: 'Previous', metric: { value: 4.4, delta: 0.2, data: link({ delta: { compare: 'previous' } }) } },
      { title: 'Baseline', metric: { value: 4.4, delta: 0.5, data: link({ delta: { compare: { filter: [{ field: 'Month', op: '=', value: '2026-09' }] }, as: 'difference', format: '+$0.0M;-$0.0M;$0' } }) } },
      { title: 'Fixed', metric: { value: 4.4, delta: 0.4, data: link({ delta: { compare: { value: 4 } } }) } },
      { title: 'Column', metric: { value: 4.4, delta: 0.2, data: link({ delta: { field: 'ARR change' } }) } },
      { title: 'Better', metric: { value: 0.044, delta: 0.2222222222222222, better: 'down', format: '0.0%', data: link({ field: 'Churn', delta: { compare: 'previous', as: 'percent' } }) } },
    ],
  });

  test('YAML round-trips the link, the filter, each kind of change, better and format, and a plain string metric stays a string', () => {
    const result = fromYaml(toYaml(document()).yaml);
    assert.equal(result.valid, true, JSON.stringify(result.findings));
    const back = result.presentation;
    assert.deepEqual(back, document());
    assert.equal(back.slides[0].metric, '$4.2M');
  });

  test('Markdown round-trips them too', () => {
    const result = fromMarkdown(toMarkdown(document()).markdown);
    assert.equal(result.valid, true, JSON.stringify(result.findings));
    const back = result.presentation;
    for (const [index, slide] of document().slides.entries()) assert.deepEqual(back.slides[index].metric, slide.metric, `slide ${index}`);
    assert.deepEqual(back.datasets, document().datasets);
    assert.equal(back.slides[0].metric, '$4.2M');
  });
});

describe('fill', () => {
  test('a filled deck shows the numbers of its data as its written value and change', () => {
    const template = {
      name: 'FR-06', language: 'en-US', template: true,
      variables: { who: { type: 'text', value: 'x' } },
      datasets: { arr: { columns: ['Month', 'ARR'], rows: [['2026-10', 4.2], ['2026-11', 4.4]] } },
      slides: [{ title: '{{who}}', metric: { value: 1, delta: 'old', data: link({ delta: { compare: 'previous' } }) } }],
    };
    const result = fill(template, { who: 'Avery' });
    assert.equal(result.decks[0].presentation.slides[0].metric.value, 4.4);
    assert.equal(result.decks[0].presentation.slides[0].metric.delta, 0.2);
    assert.equal(updateMetricLiterals(result.decks[0].presentation), result.decks[0].presentation);
  });
});
