import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fix, format, validate } from '../dist/index.js';
import { gallery } from '@openpresentation/gallery';
import {
  cellMatchesType, datasetColumnDeclaration, declareColumns, inferColumnDeclaration, inlineChartData, inlineDatasets, resolveChartData, resolveTableData, storeCell,
} from '../dist/data.js';
import { chartCategoriesInTime, isTimeLabel } from '../dist/composition.js';
import { smallChart } from '../dist/composition.js';
import { schemas } from '../dist/schemas.js';
import { fromMarkdown, toMarkdown } from '../dist/markdown.js';
import { fromYaml, toYaml } from '../dist/yaml.js';
import { applyPatch } from '../dist/patch.js';

// FR-05: typed dataset columns. A dataset column and an inline chart data column may declare what its cells hold (type), what it is for (role) and a
// unit label. Nothing is drawn differently; a cell of another kind is a data-cell-type warning with a safe fix.

const typed = [
  { name: 'Month', type: 'date', role: 'dimension' },
  { name: 'Region', type: 'text', role: 'dimension' },
  { name: 'Revenue', format: '$#,##0', type: 'number', role: 'measure', unit: 'USD' },
  { name: 'On plan', type: 'boolean', role: 'dimension' },
];
const rows = [['2026-09', 'EMEA', 11500, true], ['2026-10', 'EMEA', 12100, true], ['2026-11', 'EMEA', null, false]];
const deck = (extra = {}, slide = {}) => ({
  name: 'Typed columns',
  language: 'en-US',
  datasets: { revenue: { columns: typed, rows } },
  slides: [{ title: 'EMEA revenue', chart: { type: 'line', alt: 'Revenue by month', data: { dataset: 'revenue', fields: ['Month', 'Revenue'] } }, ...slide }],
  ...extra,
});
const run = (document, options = {}) => validate(document, { catalogs: [gallery], only: ['format', 'references', 'content'], ...options });
const cellFindings = (report) => report.findings.filter((finding) => finding.ruleId === 'opf/data-cell-type');

describe('the schema', () => {
  test('a dataset and inline chart data take typed columns, and a string column stays a string', () => {
    const report = run(deck({ datasets: { revenue: { columns: ['Note', ...typed], rows: rows.map((row) => ['n', ...row]) } } }, {}));
    assert.equal(report.valid, true, JSON.stringify(report.findings));
    const inline = run(deck({}, { chart: { type: 'column', alt: 'Revenue', data: { columns: [typed[1], typed[2]], rows: [['EMEA', 1], ['APAC', 2]] } } }));
    assert.equal(inline.valid, true, JSON.stringify(inline.findings));
    assert.deepEqual(cellFindings(inline), []);
  });

  test('type, role and unit stand alone', () => {
    for (const column of [{ name: 'A', type: 'number' }, { name: 'A', role: 'measure' }, { name: 'A', unit: 'ms' }, { name: 'A', role: 'dimension', unit: 'people' }]) {
      const report = run(deck({ datasets: { d: { columns: [column], rows: [[1]] } } }, { chart: undefined, text: 'x' }));
      assert.equal(report.valid, true, JSON.stringify(column));
    }
  });

  test('an unknown type or role, an empty unit and a table header with a type are errors', () => {
    const bad = [
      { columns: ['Month', { name: 'Revenue', type: 'currency' }], path: '/datasets/revenue/columns/1/type' },
      { columns: ['Month', { name: 'Revenue', role: 'temporal' }], path: '/datasets/revenue/columns/1/role' },
      { columns: ['Month', { name: 'Revenue', unit: '' }], path: '/datasets/revenue/columns/1/unit' },
    ];
    for (const { columns, path } of bad) {
      const report = run(deck({ datasets: { revenue: { columns, rows: [['2026-09', 11500]] } } }));
      assert.equal(report.valid, false, path);
      assert.ok(report.findings.some((finding) => finding.severity === 'error' && finding.path === path), `${path}: ${JSON.stringify(report.findings.map((finding) => [finding.path, finding.message]))}`);
    }
    const table = run(deck({}, { chart: undefined, table: { columns: [{ name: 'Revenue', type: 'number' }], rows: [[1]] } }));
    assert.equal(table.valid, false);
    assert.ok(table.findings.some((finding) => finding.severity === 'error' && finding.path === '/slides/0/table/columns/0/type'), JSON.stringify(table.findings.map((finding) => finding.path)));
  });

  test('DatasetColumn repeats the name and format of DataColumn exactly', () => {
    const defs = schemas.presentation.$defs;
    assert.deepEqual(defs.DatasetColumn.properties.name, { ...defs.DataColumn.properties.name, description: defs.DatasetColumn.properties.name.description, examples: defs.DatasetColumn.properties.name.examples });
    assert.deepEqual(defs.DatasetColumn.properties.format, defs.DataColumn.properties.format);
    assert.equal(defs.DatasetColumn.additionalProperties, false);
    assert.deepEqual(defs.DatasetColumn.required, ['name']);
    assert.deepEqual(defs.DatasetColumn.properties.type.enum, ['text', 'number', 'date', 'boolean']);
    assert.deepEqual(defs.DatasetColumn.properties.role.enum, ['dimension', 'measure']);
    assert.deepEqual(defs.Dataset.properties.columns.items.oneOf, [{ type: 'string' }, { $ref: '#/$defs/DatasetColumn' }]);
    assert.deepEqual(defs.ChartData.properties.columns.items.oneOf, [{ type: 'string' }, { $ref: '#/$defs/DatasetColumn' }]);
  });
});

describe('what a cell may hold', () => {
  test('each type accepts its cells, null is a gap in any type, and a numeric string is not a number', () => {
    assert.equal(cellMatchesType('EMEA', 'text'), true);
    assert.equal(cellMatchesType(12, 'text'), false);
    assert.equal(cellMatchesType(12, 'number'), true);
    assert.equal(cellMatchesType(1.5e6, 'number'), true);
    assert.equal(cellMatchesType('12', 'number'), false);
    assert.equal(cellMatchesType(Number.NaN, 'number'), false);
    assert.equal(cellMatchesType(true, 'boolean'), true);
    assert.equal(cellMatchesType('true', 'boolean'), false);
    for (const type of ['text', 'number', 'date', 'boolean']) {
      assert.equal(cellMatchesType(null, type), true, type);
      assert.equal(cellMatchesType(undefined, type), true, type);
    }
  });

  test('a date is any time label the time-order rule reads, an ISO date-time and an integer year', () => {
    for (const cell of ['2026-03', 'Q1 2026', 'FY26', 'Jan', '2026-03-15', '2026-03-15T09:30:00Z', '2026-03-15T09:30', '2026-03-15T09:30:00.250+05:30', 'Week 3', 'March 2026', 2026]) {
      assert.equal(cellMatchesType(cell, 'date'), true, String(cell));
    }
    for (const cell of ['hello', '12', 12, 1.5, true, '2026-13-01T00:00', '2026-03-15T25:00', '']) {
      assert.equal(cellMatchesType(cell, 'date'), false, String(cell));
    }
    assert.equal(isTimeLabel('2026-03-15T09:30:00Z'), true);
    assert.equal(isTimeLabel(12), false);
  });

  test('date-times key by their instant, so a run forward in UTC is in time and a run backward is not', () => {
    assert.equal(chartCategoriesInTime(['2026-03-15T09:30:00Z', '2026-03-15T10:00:00Z', '2026-03-16T00:00:00Z']), true);
    assert.equal(chartCategoriesInTime(['2026-03-15T10:00:00Z', '2026-03-15T09:30:00Z']), false);
    // 09:30 at +05:30 is 04:00 UTC, before 09:00 UTC.
    assert.equal(chartCategoriesInTime(['2026-03-15T09:00:00Z', '2026-03-15T09:30:00+05:30']), false);
    assert.equal(chartCategoriesInTime(['2026-03-15T09:30:00+05:30', '2026-03-15T09:00:00Z']), true);
  });
});

describe('data-cell-type', () => {
  test('a typed column of matching cells and gaps has no finding, in a dataset nothing uses too', () => {
    assert.deepEqual(cellFindings(run(deck())), []);
    const unused = run(deck({}, { chart: undefined, text: 'No chart.' }));
    assert.deepEqual(cellFindings(unused), []);
  });

  test('a mismatched cell is one warning at the cell, never an error, and the deck stays valid', () => {
    const document = deck({ datasets: { revenue: { columns: [{ name: 'Month', type: 'date' }, { name: 'Revenue', type: 'number' }], rows: [['2026-09', 11500], ['2026-10', '12100']] } } }, { chart: undefined, text: 'x' });
    const report = run(document);
    assert.equal(report.valid, true);
    const found = cellFindings(report);
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'warning');
    assert.equal(found[0].path, '/datasets/revenue/rows/1/1');
    assert.equal(found[0].message, 'Row 2 of dataset "revenue" holds "12100" in column "Revenue", which is typed number.');
  });

  test('inline chart data is checked at its own path with its own wording', () => {
    const report = run(deck({}, { chart: { type: 'column', alt: 'Revenue', data: { columns: ['Region', { name: 'Revenue', type: 'number' }], rows: [['EMEA', 1], ['APAC', 'two']] } } }));
    const found = cellFindings(report);
    assert.equal(found.length, 1);
    assert.equal(found[0].path, '/slides/0/chart/data/rows/1/1');
    assert.equal(found[0].message, 'Row 2 of this chart\'s data holds "two" in column "Revenue", which is typed number.');
  });

  test('text, boolean and date columns each report a cell of another kind', () => {
    const columns = [{ name: 'T', type: 'text' }, { name: 'B', type: 'boolean' }, { name: 'D', type: 'date' }];
    const report = run(deck({ datasets: { d: { columns, rows: [['a', true, '2026-01'], [7, 'yes', 'soon']] } } }, { chart: undefined, text: 'x' }));
    assert.deepEqual(cellFindings(report).map((finding) => finding.path).sort(), ['/datasets/d/rows/1/0', '/datasets/d/rows/1/1', '/datasets/d/rows/1/2']);
  });

  test('more than five mismatches in a column are one finding of the column, at its first cell', () => {
    const many = Array.from({ length: 8 }, (_, index) => [`Q${(index % 4) + 1}`, `${index + 1}%`]);
    const report = run(deck({ datasets: { d: { columns: ['Quarter', { name: 'Value', type: 'number' }], rows: many } } }, { chart: undefined, text: 'x' }));
    const found = cellFindings(report);
    assert.equal(found.length, 1);
    assert.equal(found[0].path, '/datasets/d/rows/0/1');
    assert.equal(found[0].message, '8 cells of column "Value" of dataset "d" do not match its type number; first at row 1, which holds "1%".');
    const five = run(deck({ datasets: { d: { columns: ['Quarter', { name: 'Value', type: 'number' }], rows: many.slice(0, 5) } } }, { chart: undefined, text: 'x' }));
    assert.equal(cellFindings(five).length, 5);
  });

  test('the rule is listed with its metadata', () => {
    const report = run(deck({ datasets: { d: { columns: [{ name: 'V', type: 'number' }], rows: [['x']] } } }, { chart: undefined, text: 'x' }));
    const [found] = cellFindings(report);
    assert.equal(found.category, 'content');
    assert.ok(found.help.length > 0);
  });
});

describe('the safe fix', () => {
  const broken = () => deck({ datasets: { d: { columns: [{ name: 'Month', type: 'date' }, { name: 'Revenue', type: 'number' }, { name: 'Code', type: 'text' }], rows: [['2026-09', 11500, 'A'], ['2026-10', '12100', 7], ['2026-11', '12%', 'C']] } } }, { chart: undefined, text: 'x' });

  test('a strict decimal string in a number column and a number in a text column are the fix, and nothing else is', () => {
    const report = run(broken());
    const found = cellFindings(report);
    assert.equal(found.length, 3);
    const byPath = Object.fromEntries(found.map((finding) => [finding.path, finding]));
    const number = byPath['/datasets/d/rows/1/1'].fixes;
    assert.equal(number.length, 1);
    assert.equal(number[0].safe, true);
    assert.deepEqual(number[0].patch, [{ op: 'replace', path: '/datasets/d/rows/1/1', value: 12100 }]);
    assert.deepEqual(byPath['/datasets/d/rows/1/2'].fixes[0].patch, [{ op: 'replace', path: '/datasets/d/rows/1/2', value: '7' }]);
    assert.equal(byPath['/datasets/d/rows/2/1'].fixes, undefined, '"12%" has no fix');
  });

  test('fix with audits applies it, keeps the column types and leaves the unfixable cell with its warning', () => {
    const result = fix(broken(), { catalogs: [gallery], audits: true });
    assert.deepEqual(result.document.datasets.d.rows, [['2026-09', 11500, 'A'], ['2026-10', 12100, '7'], ['2026-11', '12%', 'C']]);
    assert.deepEqual(result.document.datasets.d.columns, broken().datasets.d.columns);
    assert.equal(result.applied.every((applied) => applied.ruleId === 'opf/data-cell-type'), true);
    assert.equal(result.applied.every((applied) => applied.changesDrawing === false), true);
    assert.deepEqual(cellFindings({ findings: result.findings }).map((finding) => finding.path), ['/datasets/d/rows/2/1']);
    // A repair-only run never restyles content.
    assert.deepEqual(fix(broken(), { catalogs: [gallery] }).document, broken());
  });

  test('the finding of a whole column carries one fix for every cell it can convert', () => {
    const rows = Array.from({ length: 8 }, (_, index) => [`Q${(index % 4) + 1}`, index === 3 ? '4%' : `${index + 1}`]);
    const report = run(deck({ datasets: { d: { columns: ['Quarter', { name: 'Value', type: 'number' }], rows } } }, { chart: undefined, text: 'x' }));
    const [found] = cellFindings(report);
    assert.equal(found.fixes[0].patch.length, 7);
    const fixed = applyPatch(structuredClone(deck({ datasets: { d: { columns: ['Quarter', { name: 'Value', type: 'number' }], rows } } }, { chart: undefined, text: 'x' })), found.fixes[0].patch);
    assert.deepEqual(fixed.datasets.d.rows.map((row) => row[1]), [1, 2, 3, '4%', 5, 6, 7, 8]);
  });

  test('inline chart data is fixed too', () => {
    const document = deck({}, { chart: { type: 'column', alt: 'Revenue', data: { columns: ['Region', { name: 'Revenue', type: 'number' }], rows: [['EMEA', 1], ['APAC', '2.5']] } } });
    const result = fix(document, { catalogs: [gallery], audits: true });
    assert.deepEqual(result.document.slides[0].chart.data.rows, [['EMEA', 1], ['APAC', 2.5]]);
  });
});

describe('what engines do with the keys', () => {
  test('a column that declares a type draws and resolves as the same column without it', () => {
    const plain = { columns: ['Month', 'Revenue'], rows: [['2026-09', 1], ['2026-10', 2]] };
    const declared = { columns: [{ name: 'Month', type: 'date', role: 'dimension' }, { name: 'Revenue', type: 'number', role: 'measure', unit: 'USD' }], rows: plain.rows };
    const a = resolveChartData({ type: 'line', data: plain }), b = resolveChartData({ type: 'line', data: declared });
    assert.equal(a.ok && b.ok, true);
    assert.deepEqual({ ...b, types: a.types }, a);
    assert.deepEqual(b.types, ['date', 'number']);
    assert.deepEqual(a.types, [undefined, undefined]);
  });

  test('fields keep the types of the selected columns, in the selected order', () => {
    const resolved = resolveChartData(deck().slides[0].chart, deck());
    assert.equal(resolved.ok, true);
    assert.deepEqual(resolved.columns, ['Month', 'Revenue']);
    assert.deepEqual(resolved.types, ['date', 'number']);
    const reordered = resolveChartData({ type: 'line', data: { dataset: 'revenue', fields: ['Revenue', 'Month'] } }, deck());
    assert.deepEqual(reordered.types, ['number', 'date']);
  });

  test('an inline copy of a dataset keeps the declarations for a chart and leaves a table header a DataColumn', () => {
    const document = deck({}, { chart: undefined, table: { dataset: 'revenue', fields: ['Month', 'Revenue'] } });
    const inlined = inlineDatasets(document);
    assert.deepEqual(inlined.slides[0].table.columns, ['Month', { name: 'Revenue', format: '$#,##0' }]);
    assert.equal(run(inlined).valid, true);
    const chart = inlineChartData(deck().slides[0].chart, deck());
    assert.deepEqual(chart.data.columns, [{ name: 'Month', type: 'date', role: 'dimension' }, { name: 'Revenue', format: '$#,##0', type: 'number', role: 'measure', unit: 'USD' }]);
    assert.equal(run(deck({}, { chart })).valid, true);
    assert.deepEqual(resolveTableData(document.slides[0].table, document).formats, [undefined, '$#,##0']);
  });

  test('datasetColumnDeclaration reads a column by dataset and field name', () => {
    assert.deepEqual(datasetColumnDeclaration(deck(), 'revenue', 'Revenue'), { type: 'number', role: 'measure', unit: 'USD' });
    assert.deepEqual(datasetColumnDeclaration(deck(), 'revenue', 'Region'), { type: 'text', role: 'dimension' });
    assert.deepEqual(datasetColumnDeclaration({ datasets: { d: { columns: ['Plain'], rows: [] } } }, 'd', 'Plain'), {});
    assert.equal(datasetColumnDeclaration(deck(), 'revenue', 'Nope'), undefined);
    assert.equal(datasetColumnDeclaration(deck(), 'nope', 'Revenue'), undefined);
    assert.equal(datasetColumnDeclaration(undefined, 'revenue', 'Revenue'), undefined);
  });
});

describe('time order reads the declared type first', () => {
  const small = (columns, rows, extra = {}) => {
    const chart = { type: 'column', data: { columns, rows }, ...extra };
    const data = resolveChartData(chart);
    assert.equal(data.ok, true);
    return smallChart(chart, data, { box: { x: 0, y: 0, width: 800, height: 420 }, scale: 1, measure: (text, size) => String(text).length * size * 0.55 });
  };
  const inTime = (columns, rows, extra) => small(columns, rows, extra)?.emphasis !== undefined;
  const nominal = [['Lead', 1], ['Qualified', 2], ['Won', 3]];
  const forward = [['Q1', 1], ['Q2', 2], ['Q3', 3]];

  test('an undeclared column takes exactly today\'s path', () => {
    assert.equal(chartCategoriesInTime(['Q1', 'Q2', 'Q3']), true);
    assert.equal(chartCategoriesInTime(['Lead', 'Qualified', 'Won']), false);
    assert.equal(chartCategoriesInTime(['Baseline', 'Pilot', 'Rollout'], { title: 'Period' }), true);
    assert.equal(inTime(['Quarter', 'Revenue'], forward), true);
    assert.equal(inTime(['Stage', 'Count'], nominal), false);
    assert.equal(inTime(['Period', 'Count'], [['Baseline', 1], ['Pilot', 2], ['Rollout', 3]]), true);
    assert.equal(chartCategoriesInTime(['Q1', 'Q2', 'Q3'], { type: undefined }), true);
    assert.equal(chartCategoriesInTime(['Q1', 'Q2', 'Q3'], { type: 'number' }), true);
  });

  test('date skips the title fallback and still needs labels that run forward', () => {
    assert.equal(chartCategoriesInTime(['Baseline', 'Pilot', 'Rollout'], { title: 'Period', type: 'date' }), false);
    assert.equal(inTime([{ name: 'Period', type: 'date' }, 'Count'], [['Baseline', 1], ['Pilot', 2], ['Rollout', 3]]), false);
    assert.equal(chartCategoriesInTime(['Q1', 'Q2', 'Q3'], { type: 'date' }), true);
    assert.equal(inTime([{ name: 'Quarter', type: 'date' }, 'Revenue'], forward), true);
    assert.equal(chartCategoriesInTime(['2026', '2025', '2024'], { type: 'date' }), false);
  });

  test('text and boolean are never time ordered, whatever the labels look like', () => {
    assert.equal(chartCategoriesInTime(['Q1', 'Q2', 'Q3'], { type: 'text' }), false);
    assert.equal(chartCategoriesInTime(['2024', '2025'], { type: 'text' }), false);
    assert.equal(chartCategoriesInTime([false, true], { type: 'boolean' }), false);
    assert.equal(inTime([{ name: 'Quarter', type: 'text' }, 'Revenue'], forward), false);
    assert.equal(inTime([{ name: 'Quarter', type: 'boolean' }, 'Revenue'], forward), false);
  });
});

describe('what ingest declares', () => {
  test('a column says what it holds from its cells', () => {
    assert.deepEqual(inferColumnDeclaration([1, 2.5, null], {}), { type: 'number', role: 'measure' });
    assert.deepEqual(inferColumnDeclaration(['12', '-3.5', ''], {}), { type: 'number', role: 'measure' });
    assert.deepEqual(inferColumnDeclaration([1, 2], { first: true }), { type: 'number', role: 'dimension' });
    assert.deepEqual(inferColumnDeclaration([2019, 2020, 2021], {}), { type: 'number', role: 'dimension' }, 'years are time labels, not measures');
    assert.deepEqual(inferColumnDeclaration(['2026-03', '2026-04'], {}), { type: 'date', role: 'dimension' });
    assert.deepEqual(inferColumnDeclaration(['Q1', 'Q2'], {}), { type: 'date', role: 'dimension' });
    assert.deepEqual(inferColumnDeclaration(['true', 'false', ''], {}), { type: 'boolean', role: 'dimension' });
    assert.deepEqual(inferColumnDeclaration(['EMEA', 'APAC'], {}), { type: 'text', role: 'dimension' });
  });

  test('a column whose type cannot be told stays undeclared', () => {
    assert.equal(inferColumnDeclaration([], {}), undefined);
    assert.equal(inferColumnDeclaration([null, '', '  '], {}), undefined);
    assert.equal(inferColumnDeclaration([1, 'EMEA'], {}), undefined);
    assert.equal(inferColumnDeclaration(['12.50', '3.10'], {}), undefined, 'storing 12.50 as 12.5 would change what it shows');
    assert.equal(inferColumnDeclaration(['1e6'], {}), undefined);
    assert.equal(inferColumnDeclaration([true, 'x'], {}), undefined);
  });

  test('declared columns hold their cells as the type, so a typed number column never warns', () => {
    const data = { columns: ['Month', 'Region', 'Revenue', 'Notes'], rows: [['2026-09', 'EMEA', '11500', ''], ['2026-10', 'APAC', '', '']] };
    const result = declareColumns(data);
    assert.deepEqual(result.columns, [{ name: 'Month', type: 'date', role: 'dimension' }, { name: 'Region', type: 'text', role: 'dimension' }, { name: 'Revenue', type: 'number', role: 'measure' }, 'Notes']);
    assert.deepEqual(result.rows, [['2026-09', 'EMEA', 11500, ''], ['2026-10', 'APAC', null, '']]);
    assert.deepEqual(data.rows[0], ['2026-09', 'EMEA', '11500', ''], 'the input is not changed');
    const report = run(deck({ datasets: { d: result } }, { chart: undefined, text: 'x' }));
    assert.equal(report.valid, true);
    assert.deepEqual(cellFindings(report), []);
  });

  test('a column the previous dataset names keeps its declaration, and a plain string stays a plain string', () => {
    const data = { columns: ['Month', 'Revenue', 'Region'], rows: [['2026-09', '11500', 'EMEA']] };
    const previous = ['Month', { name: 'Revenue', format: '$#,##0', type: 'number', unit: 'USD' }];
    const result = declareColumns(data, previous);
    assert.deepEqual(result.columns, ['Month', { name: 'Revenue', format: '$#,##0', type: 'number', unit: 'USD' }, { name: 'Region', type: 'text', role: 'dimension' }]);
    assert.deepEqual(result.rows, [['2026-09', 11500, 'EMEA']]);
    assert.equal(storeCell('12', 'number'), 12);
    assert.equal(storeCell('12.50', 'number'), '12.50');
    assert.equal(storeCell('true', 'boolean'), true);
    assert.equal(storeCell('', 'date'), null);
    assert.equal(storeCell('', 'text'), '');
  });
});

describe('Markdown, YAML and format', () => {
  const document = deck({ datasets: { revenue: { columns: ['Note', ...typed], rows: rows.map((row) => ['n', ...row]) } } });

  test('typed columns round-trip through YAML beside a string column, which is not rewritten as an object', () => {
    const { yaml } = toYaml(document);
    const back = fromYaml(yaml);
    assert.equal(back.valid, true, JSON.stringify(back.diagnostics));
    assert.deepEqual(back.presentation, document);
    assert.equal(typeof back.presentation.datasets.revenue.columns[0], 'string');
    assert.equal(toYaml(back.presentation).yaml, yaml);
  });

  test('typed columns round-trip through Markdown losslessly', () => {
    const { markdown, report } = toMarkdown(document);
    assert.equal(report.lossless, true, JSON.stringify(report));
    const back = fromMarkdown(markdown);
    assert.equal(back.valid, true, JSON.stringify(back.diagnostics));
    assert.deepEqual(back.presentation, document);
  });

  test('format writes the keys of a column in the schema order', () => {
    const shuffled = { slides: [{ title: 'T' }], datasets: { d: { rows: [[1]], columns: [{ unit: 'USD', role: 'measure', type: 'number', format: '$#,##0', name: 'Revenue' }] } } };
    const parsed = JSON.parse(format(JSON.stringify(shuffled)));
    assert.deepEqual(Object.keys(parsed.datasets.d.columns[0]), ['name', 'format', 'type', 'role', 'unit']);
  });
});
