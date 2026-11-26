import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fix, format, stats, validate } from '../dist/index.js';
import { describeFinding } from '../dist/source.js';
import { dataProvenance, dataSourcesOf, inlineDatasets, resolveChartData, resolveDataSource } from '../dist/data.js';
import { credentialInSrc } from '../dist/index.js';
import { gallery } from '@openpresentation/gallery';
import { schemas } from '../dist/schemas.js';
import { fromMarkdown, toMarkdown } from '../dist/markdown.js';
import { fromYaml, toYaml } from '../dist/yaml.js';
import { diff } from '../dist/diff.js';
import { applyPatch } from '../dist/patch.js';

// FR-04: data sources and a flat dataset. A root `datasources` map describes each place data lives once; a dataset or inline chart data
// names one with `datasource` and records `query`, `retrieved`, `version`, `sha256` and `generator` itself. The nested `source` object is gone.

const SHA = '9f2c41b1d1b6e0a8a56e7c3d2f4b8a90c1e3d5f7a9b0c2d4e6f8a0b1c3d5e07a';
const dataset = (extra = {}) => ({ columns: ['Quarter', 'Revenue'], rows: [['Q1', 12], ['Q2', 18]], ...extra });
const deck = (extra = {}, slide = {}) => ({ name: 'FR-04', language: 'en-US', datasets: { revenue: dataset() }, slides: [{ title: 'Revenue', chart: { type: 'column', alt: 'Revenue by quarter', data: { dataset: 'revenue' } }, ...slide }], ...extra });
const run = (document, options = {}) => validate(document, { catalogs: [gallery], only: ['format', 'references', 'content'], ...options });
const rules = (report, id) => report.findings.filter((finding) => finding.ruleId === id);

describe('the schema', () => {
  test('a dataset takes the six provenance keys and a data source by id', () => {
    const document = deck({
      datasources: { warehouse: { title: 'Finance warehouse', description: 'Nightly export', connector: 'postgres', src: 'postgres://warehouse.example.com/finance', license: 'CC-BY-4.0', refreshEvery: 'P1D', extensions: { 'com.example': { pool: 2 } } } },
      datasets: { revenue: dataset({ title: 'Revenue', description: 'By quarter', datasource: 'warehouse', query: 'SELECT quarter, revenue FROM revenue', retrieved: '2026-11-01T09:30:00Z', version: 'r42', sha256: SHA, generator: { type: 'model', name: 'metricgen 2.1' } }) },
    });
    const report = run(document);
    assert.equal(report.valid, true, JSON.stringify(report.findings));
    assert.deepEqual(report.findings.filter((finding) => finding.severity === 'error'), []);
  });

  test('a dataset takes an inline data source, and retrieved takes a date or a date-time', () => {
    for (const retrieved of ['2026-11-01', '2026-11-01T09:30:00Z']) {
      const report = run(deck({ datasets: { revenue: dataset({ datasource: { src: './revenue.csv', connector: 'csv' }, retrieved, query: "'Q3 plan'!A1:B9" }) } }));
      assert.equal(report.valid, true, JSON.stringify(report.findings));
    }
  });

  test('inline chart data takes the same six keys', () => {
    const data = { ...dataset(), datasource: { src: './revenue.csv' }, query: 'FY26!A1:C13', retrieved: '2026-11-01', version: 'r1', sha256: SHA, generator: { type: 'human', name: 'Avery Chen' } };
    const report = run(deck({}, { chart: { type: 'column', alt: 'Revenue', data } }));
    assert.equal(report.valid, true, JSON.stringify(report.findings));
  });

  test('the nested source object is gone, from a dataset and from inline chart data', () => {
    const before = run(deck({ datasets: { revenue: dataset({ source: { src: './revenue.csv', retrieved: '2026-11-01' } }) } }));
    assert.equal(before.valid, false);
    assert.ok(before.findings.some((finding) => finding.path === '/datasets/revenue/source'), JSON.stringify(before.findings.map((finding) => finding.path)));
    const inline = run(deck({}, { chart: { type: 'column', alt: 'Revenue', data: { ...dataset(), source: { src: './revenue.csv' } } } }));
    assert.equal(inline.valid, false);
    assert.ok(inline.findings.some((finding) => finding.path.endsWith('/data/source')), JSON.stringify(inline.findings.map((finding) => finding.path)));
  });

  test('a string data source is an id, never a path or a URL', () => {
    for (const bad of ['./revenue.csv', 'https://example.com/revenue.csv', 'has space']) {
      assert.equal(run(deck({ datasets: { revenue: dataset({ datasource: bad }) } })).valid, false, bad);
    }
  });

  test('values the schema rejects', () => {
    const bad = {
      sha256: [SHA.toUpperCase(), 'abc', 12],
      refreshEvery: ['daily', '1D', 'P', 'PT', 'P1Y2M3DT'],
      retrieved: ['yesterday', '2026-13-01'],
      generator: [{ type: 'robot', name: 'x' }, { type: 'model' }, 'model'],
      version: [''],
      query: [''],
    };
    for (const [key, values] of Object.entries(bad)) {
      for (const value of values) {
        const document = key === 'refreshEvery'
          ? deck({ datasources: { warehouse: { refreshEvery: value } } })
          : deck({ datasets: { revenue: dataset({ [key]: value }) } });
        assert.equal(run(document).valid, false, `${key}: ${JSON.stringify(value)}`);
      }
    }
    for (const refresh of ['P1D', 'P1W', 'P3M', 'PT6H', 'P1Y2M3DT4H5M6S', 'PT0.5S']) assert.equal(run(deck({ datasources: { warehouse: { refreshEvery: refresh } } })).valid, true, refresh);
  });

  test('a data source has no unknown keys; connector settings go in extensions', () => {
    assert.equal(run(deck({ datasources: { warehouse: { password: 'x' } } })).valid, false);
    assert.equal(run(deck({ datasources: { warehouse: { extensions: { 'com.example': { pool: 2 } } } } })).valid, true);
    assert.equal(run(deck({ datasources: { 'not an id': {} } })).valid, false);
  });

  test('every new def is in the schema and DataSourceRef is gone', () => {
    const defs = schemas.presentation.$defs;
    for (const name of ['DataSource', 'DataSources', 'DataSourceId', 'DataSourceChoice', 'DataQuery', 'DataRetrieved', 'DataVersion', 'DataSha256', 'DataGenerator']) assert.ok(defs[name], name);
    assert.equal(defs.DataSourceRef, undefined);
    assert.ok(schemas.presentation.properties.datasources);
    for (const key of ['datasource', 'query', 'retrieved', 'version', 'sha256', 'generator']) {
      assert.ok(defs.Dataset.properties[key], `Dataset.${key}`);
      assert.ok(defs.ChartData.properties[key], `ChartData.${key}`);
    }
    assert.equal(defs.Dataset.properties.source, undefined);
    assert.equal(defs.ChartData.properties.source, undefined);
  });
});

describe('opf/datasource-unknown', () => {
  test('a dataset naming a data source that does not exist is an error at the key', () => {
    const report = run(deck({ datasources: { warehouse: {} }, datasets: { revenue: dataset({ datasource: 'wharehouse' }) } }));
    const found = rules(report, 'opf/datasource-unknown');
    assert.equal(found.length, 1, JSON.stringify(report.findings));
    assert.equal(found[0].severity, 'error');
    assert.equal(found[0].path, '/datasets/revenue/datasource');
    assert.equal(report.valid, false);
  });

  test('inline chart data naming a data source that does not exist is an error at the key', () => {
    const report = run(deck({}, { chart: { type: 'column', alt: 'Revenue', data: { ...dataset(), datasource: 'nowhere' } } }));
    const found = rules(report, 'opf/datasource-unknown');
    assert.equal(found.length, 1, JSON.stringify(report.findings));
    assert.equal(found[0].path, '/slides/0/chart/data/datasource');
  });

  test('a known id and an inline data source are not reported', () => {
    const report = run(deck({ datasources: { warehouse: {} }, datasets: { revenue: dataset({ datasource: 'warehouse' }) } }));
    assert.equal(rules(report, 'opf/datasource-unknown').length, 0);
  });

  test('the finding names the data sources the deck has', () => {
    const report = run(deck({ datasources: { warehouse: {} }, datasets: { revenue: dataset({ datasource: 'wharehouse' }) } }));
    const [found] = rules(report, 'opf/datasource-unknown');
    assert.match(describeFinding(found, { document: deck({ datasources: { warehouse: {} }, datasets: { revenue: dataset({ datasource: 'wharehouse' }) } }) }).message, /warehouse/);
  });
});

describe('opf/datasource-credentials', () => {
  test('a src with a user and password, or a key or token in its query, is a warning', () => {
    const urls = [
      'https://analyst:secret@data.example.com/export.csv',
      'https://data.example.com/export.csv?api_key=abc',
      'https://data.example.com/export.csv?format=csv&access_token=abc',
      'https://data.example.com/export.csv?apiKey=abc',
      'https://data.example.com/export.csv?X-Amz-Signature=abc',
      'postgres://user:pw@warehouse.example.com/finance',
    ];
    for (const src of urls) {
      const report = run(deck({ datasources: { warehouse: { src } }, datasets: { revenue: dataset({ datasource: 'warehouse' }) } }));
      const found = rules(report, 'opf/datasource-credentials');
      assert.equal(found.length, 1, src);
      assert.equal(found[0].severity, 'warning');
      assert.equal(found[0].path, '/datasources/warehouse/src');
      assert.equal(report.valid, true, 'a warning never makes a deck invalid');
      assert.doesNotMatch(JSON.stringify(found[0]), /analyst|:secret|abc|pw@/, 'the finding never repeats the secret');
    }
  });

  test('an inline data source is checked too', () => {
    const report = run(deck({ datasets: { revenue: dataset({ datasource: { src: 'https://u:p@example.com/a.csv' } }) } }));
    assert.deepEqual(rules(report, 'opf/datasource-credentials').map((finding) => finding.path), ['/datasets/revenue/datasource/src']);
    const inlineChart = run(deck({}, { chart: { type: 'column', alt: 'Revenue', data: { ...dataset(), datasource: { src: 'https://example.com/a.csv?token=x' } } } }));
    assert.deepEqual(rules(inlineChart, 'opf/datasource-credentials').map((finding) => finding.path), ['/slides/0/chart/data/datasource/src']);
  });

  test('paths, assets, plain URLs and ordinary query parameters are not credentials', () => {
    for (const src of ['./data/revenue.csv', 'asset:revenue', 'https://data.example.com/export.csv', 'https://data.example.com/export.csv?sheet=FY26&monkey=1&keyword=a', 'https://user@example.com/a.csv']) {
      assert.equal(credentialInSrc(src), undefined, src);
    }
    assert.equal(credentialInSrc('https://a:b@example.com/x'), 'a user and password');
    assert.equal(credentialInSrc('https://example.com/x?password=1'), 'a query parameter named "password"');
  });
});

describe('opf/dataset-stale', () => {
  const stale = (retrieved, refresh, options) => run(deck({ datasources: { warehouse: { refreshEvery: refresh } }, datasets: { revenue: dataset({ datasource: 'warehouse', retrieved }) } }), options);

  test('is reported only when the caller passes a date: core has no clock', () => {
    assert.equal(rules(stale('2026-01-01', 'P1D'), 'opf/dataset-stale').length, 0);
    const report = stale('2026-01-01', 'P1D', { asOf: '2026-11-25' });
    const found = rules(report, 'opf/dataset-stale');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'warning');
    assert.equal(found[0].path, '/datasets/revenue/retrieved');
    assert.equal(report.valid, true);
  });

  test('compares retrieved plus refreshEvery with the date, in the calendar', () => {
    const count = (retrieved, refresh, asOf) => rules(stale(retrieved, refresh, { asOf }), 'opf/dataset-stale').length;
    assert.equal(count('2026-11-24', 'P1D', '2026-11-25'), 0, 'due exactly on the date');
    assert.equal(count('2026-11-24', 'P1D', '2026-11-26'), 1);
    assert.equal(count('2026-08-31', 'P3M', '2026-11-30'), 0, 'a quarter after Aug 31 is Nov 30');
    assert.equal(count('2026-08-31', 'P3M', '2026-12-01'), 1);
    assert.equal(count('2026-11-25T09:00:00Z', 'PT6H', '2026-11-25T14:59:59Z'), 0);
    assert.equal(count('2026-11-25T09:00:00Z', 'PT6H', '2026-11-25T15:00:01Z'), 1);
    assert.equal(count('2026-11-01', 'P1W', '2026-11-08'), 0);
    assert.equal(count('2026-11-01', 'P1W', '2026-11-09'), 1);
    assert.equal(count('2025-11-01', 'P1Y', '2026-11-02'), 1);
  });

  test('needs a retrieved date and a refreshEvery to compare; an inline data source counts', () => {
    const none = run(deck({ datasets: { revenue: dataset({ datasource: { src: './a.csv' }, retrieved: '2020-01-01' }) } }), { asOf: '2026-11-25' });
    assert.equal(rules(none, 'opf/dataset-stale').length, 0);
    const inline = run(deck({ datasets: { revenue: dataset({ datasource: { src: './a.csv', refreshEvery: 'P1D' }, retrieved: '2020-01-01' }) } }), { asOf: '2026-11-25' });
    assert.equal(rules(inline, 'opf/dataset-stale').length, 1);
    const chart = run(deck({}, { chart: { type: 'column', alt: 'Revenue', data: { ...dataset(), datasource: { src: './a.csv', refreshEvery: 'P1D' }, retrieved: '2020-01-01' } } }), { asOf: '2026-11-25' });
    assert.deepEqual(rules(chart, 'opf/dataset-stale').map((finding) => finding.path), ['/slides/0/chart/data/retrieved']);
  });

  test('asOf must be an ISO 8601 date or date-time', () => {
    assert.throws(() => validate(deck(), { asOf: 'yesterday' }), /asOf/);
    assert.throws(() => validate(deck(), { asOf: '2026-02-30' }), /asOf/);
  });
});

describe('what the engines read', () => {
  const document = deck({
    datasources: { warehouse: { src: 'https://example.com/finance.csv', license: 'CC-BY-4.0' } },
    datasets: { revenue: dataset({ datasource: 'warehouse', query: 'FY26!A1:B3', retrieved: '2026-11-01', version: 'r1', sha256: SHA, generator: { type: 'human', name: 'Avery' } }) },
  });

  test('a chart that references a dataset reports the dataset\'s provenance; inline data reports its own', () => {
    const referenced = resolveChartData(document.slides[0].chart, document);
    assert.equal(referenced.ok, true);
    assert.deepEqual(referenced.provenance, { datasource: 'warehouse', query: 'FY26!A1:B3', retrieved: '2026-11-01', version: 'r1', sha256: SHA, generator: { type: 'human', name: 'Avery' } });
    const own = resolveChartData({ type: 'column', data: { ...dataset(), datasource: { src: './a.csv' }, retrieved: '2026-11-02' } }, document);
    assert.deepEqual(own.provenance, { datasource: { src: './a.csv' }, retrieved: '2026-11-02' });
    assert.equal(resolveChartData({ type: 'column', data: dataset() }, document).provenance, undefined);
  });

  test('inlining a dataset keeps its provenance on the chart data and leaves the data sources in place', () => {
    const inlined = inlineDatasets(document);
    assert.deepEqual(dataProvenance(inlined.slides[0].chart.data), dataProvenance(document.datasets.revenue));
    assert.deepEqual(inlined.datasources, document.datasources);
  });

  test('helpers', () => {
    assert.deepEqual(Object.keys(dataSourcesOf(document)), ['warehouse']);
    assert.equal(resolveDataSource('warehouse', document).license, 'CC-BY-4.0');
    assert.equal(resolveDataSource('missing', document), undefined);
    assert.deepEqual(resolveDataSource({ src: './a.csv' }, document), { src: './a.csv' });
  });

  test('stats counts the data sources the datasets and charts name', () => {
    const result = stats(document);
    assert.equal(result.datasets.withDatasource, 1);
    assert.equal(result.datasets.items[0].datasource, 'warehouse');
    const inline = stats(deck({ datasets: { revenue: dataset({ datasource: { src: './a.csv' } }) } }, { chart: { type: 'column', alt: 'r', data: { ...dataset(), datasource: { src: './b.csv' } } } }));
    assert.equal(inline.datasets.items[0].datasource, './a.csv');
    assert.deepEqual(inline.charts.data, { inline: 1, dataset: 0, withDatasource: 1 });
  });

  test('the keys travel through the formatter unchanged', () => {
    const text = format(JSON.stringify(document));
    assert.deepEqual(JSON.parse(text).datasets.revenue.generator, { type: 'human', name: 'Avery' });
    assert.deepEqual(JSON.parse(text).datasources, document.datasources);
  });
});

describe('opf fix rewrites a 0.36 source', () => {
  const old = (source) => deck({ datasets: { revenue: dataset({ source }) } });

  test('src, retrieved, sheet, range and description move to the new keys; fields is dropped and the fix says so', () => {
    const result = fix(old({ src: './data/revenue.csv', retrieved: '2026-10-05', sheet: 'FY26', range: 'A1:C13', description: 'Finance export', fields: ['Quarter', 'Revenue'] }), { catalogs: [gallery] });
    assert.deepEqual(result.document.datasets.revenue.datasource, { src: './data/revenue.csv', description: 'Finance export' });
    assert.equal(result.document.datasets.revenue.query, 'FY26!A1:C13');
    assert.equal(result.document.datasets.revenue.retrieved, '2026-10-05');
    assert.equal(result.document.datasets.revenue.source, undefined);
    assert.equal(result.document.datasets.revenue.fields, undefined);
    assert.equal(result.stopped, 'stable');
    const applied = result.applied.find((entry) => entry.path === '/datasets/revenue/source');
    assert.ok(applied, JSON.stringify(result.applied));
    assert.match(applied.title, /fields is dropped/);
    assert.equal(applied.changesDrawing, false);
    assert.equal(validate(result.document, { catalogs: [gallery] }).valid, true);
  });

  test('a sheet name with a space is quoted as spreadsheets do, and a sheet alone is the query', () => {
    const quoted = fix(old({ src: './a.xlsx', sheet: 'Q3 plan', range: 'A1:B9' }), { catalogs: [gallery] });
    assert.equal(quoted.document.datasets.revenue.query, "'Q3 plan'!A1:B9");
    const apostrophe = fix(old({ src: './a.xlsx', sheet: "Bob's", range: 'A1:B9' }), { catalogs: [gallery] });
    assert.equal(apostrophe.document.datasets.revenue.query, "'Bob''s'!A1:B9");
    const sheetOnly = fix(old({ src: './a.xlsx', sheet: 'Summary' }), { catalogs: [gallery] });
    assert.equal(sheetOnly.document.datasets.revenue.query, 'Summary');
    const rangeOnly = fix(old({ src: './a.xlsx', range: 'A1:B9' }), { catalogs: [gallery] });
    assert.equal(rangeOnly.document.datasets.revenue.query, 'A1:B9');
  });

  test('a source of inline chart data is rewritten the same way', () => {
    const document = deck({}, { chart: { type: 'column', alt: 'Revenue', data: { ...dataset(), source: { src: 'asset:adoption-csv', retrieved: '2026-10-05T09:30:00Z' } } } });
    const result = fix(document, { catalogs: [gallery] });
    const data = result.document.slides[0].chart.data;
    assert.deepEqual(data.datasource, { src: 'asset:adoption-csv' });
    assert.equal(data.retrieved, '2026-10-05T09:30:00Z');
    assert.equal(data.source, undefined);
  });

  test('the keys keep their order and nothing else changes', () => {
    const document = old({ src: './r.csv' });
    const result = fix(document, { catalogs: [gallery] });
    assert.deepEqual(result.document.datasets.revenue.columns, document.datasets.revenue.columns);
    assert.deepEqual(result.document.datasets.revenue.rows, document.datasets.revenue.rows);
    assert.equal(validate(document, { catalogs: [gallery] }).valid, false, 'the input is never changed');
  });

  test('a bare string that is a path or a URL gets one finding, with the inline form as an unsafe fix', () => {
    for (const value of ['./revenue.csv', 'https://example.com/revenue.csv']) {
      const document = deck({ datasets: { revenue: dataset({ datasource: value }) } });
      const report = run(document);
      assert.equal(rules(report, 'opf/datasource-unknown').length, 0, 'a string that is no id is the schema\'s finding, not an unknown id');
      const found = report.findings.filter((finding) => finding.path === '/datasets/revenue/datasource');
      assert.equal(found.length, 1, JSON.stringify(found));
      assert.match(found[0].help, /only ever the id/);
      const [repair] = found[0].fixes;
      assert.equal(repair.id, 'datasource-to-src');
      assert.equal(repair.safe, false);
      const fixed = applyPatch(document, repair.patch);
      assert.deepEqual(fixed.datasets.revenue.datasource, { src: value });
      assert.equal(run(fixed).valid, true);
    }
  });

  test('a valid deck without source is left alone', () => {
    const result = fix(deck({ datasets: { revenue: dataset({ datasource: { src: './r.csv' } }) } }), { catalogs: [gallery] });
    assert.deepEqual(result.applied, []);
  });
});

describe('Markdown and YAML round trip', () => {
  const full = {
    name: 'Round trip',
    language: 'en-US',
    datasources: {
      warehouse: { title: 'Finance warehouse', connector: 'postgres', src: 'postgres://warehouse.example.com/finance', license: 'Internal use only', refreshEvery: 'P1D', extensions: { 'com.example': { pool: 2 } } },
      forecast: { connector: 'xlsx', src: 'https://example.com/revenue.xlsx' },
    },
    datasets: {
      revenue: dataset({ title: 'Revenue', datasource: 'warehouse', query: "SELECT quarter, revenue FROM revenue WHERE note = 'a b'", retrieved: '2026-11-01T09:30:00Z', version: 'r42', sha256: SHA, generator: { type: 'model', name: 'metricgen 2.1' } }),
      costs: dataset({ datasource: { src: './costs.csv', connector: 'csv' }, query: "'Q3 plan'!A1:B9", retrieved: '2026-11-01' }),
    },
    slides: [
      { title: 'Chart', chart: { type: 'column', alt: 'Revenue by quarter', data: { dataset: 'revenue' } } },
      { title: 'Table', table: { dataset: 'costs' } },
      { title: 'Inline', chart: { type: 'line', alt: 'Revenue', data: { ...dataset(), datasource: 'forecast', query: 'FY26!A1:C13', retrieved: '2026-11-02', version: 'r1', sha256: SHA, generator: { type: 'human', name: 'Avery Chen' } } } },
    ],
  };

  test('the document is valid', () => {
    const report = run(full);
    assert.equal(report.valid, true, JSON.stringify(report.findings));
  });

  test('YAML keeps every key, in the schema\'s order, and reads back to the same document', () => {
    const { yaml } = toYaml(full);
    assert.ok(yaml.indexOf('datasources:') > yaml.indexOf('datasets:'), yaml);
    const back = fromYaml(yaml);
    assert.equal(back.valid, true, JSON.stringify(back.diagnostics));
    assert.deepEqual(back.presentation, full);
    assert.equal(toYaml(back.presentation).yaml, yaml, 'the output converts back to itself byte for byte');
    const keys = Object.keys(back.presentation.datasets.revenue);
    assert.deepEqual(keys, ['title', 'columns', 'rows', 'datasource', 'query', 'retrieved', 'version', 'sha256', 'generator'], 'a dataset writes its keys in the schema order');
  });

  test('Markdown keeps every key and reads back to the same document, losslessly', () => {
    const { markdown, report } = toMarkdown(full);
    assert.equal(report.lossless, true, JSON.stringify(report));
    const back = fromMarkdown(markdown);
    assert.equal(back.valid, true, JSON.stringify(back.diagnostics));
    assert.deepEqual(back.presentation, full);
  });

  test('format puts datasources after datasets and the dataset keys in the schema order', () => {
    const shuffled = { slides: full.slides, datasources: full.datasources, datasets: { revenue: { generator: full.datasets.revenue.generator, sha256: SHA, rows: [['Q1', 1]], retrieved: '2026-11-01', columns: ['Q', 'V'], datasource: 'warehouse' } }, name: 'x' };
    const parsed = JSON.parse(format(JSON.stringify(shuffled)));
    assert.deepEqual(Object.keys(parsed), ['name', 'slides', 'datasets', 'datasources']);
    assert.deepEqual(Object.keys(parsed.datasets.revenue), ['columns', 'rows', 'datasource', 'retrieved', 'sha256', 'generator']);
  });

  test('a patch changes one key; diff names what changed', () => {
    const after = applyPatch(full, [{ op: 'replace', path: '/datasets/revenue/version', value: 'r43' }, { op: 'add', path: '/datasources/warehouse/refreshEvery', value: 'PT6H' }]);
    assert.equal(after.datasets.revenue.version, 'r43');
    assert.equal(after.datasources.warehouse.refreshEvery, 'PT6H');
    const changes = diff(full, after);
    assert.ok(JSON.stringify(changes).includes('version'), JSON.stringify(changes).slice(0, 400));
    assert.equal(run(after).valid, true);
  });
});
