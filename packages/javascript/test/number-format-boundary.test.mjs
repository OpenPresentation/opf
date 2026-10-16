import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDataNumber, formatVariableNumber, numberFormatError, resolveVariables, validate } from '../dist/index.js';

const tooPrecise = '0.' + '0'.repeat(101);

test('formatter returns explicit precision and scaling errors while normal rounding is unchanged', () => {
  assert.match(formatVariableNumber(1, tooPrecise).error, /100 decimal places/);
  for (const value of [1e308, -1e308]) assert.match(formatVariableNumber(value, '0%').error, /finite number range/);
  assert.equal(formatVariableNumber(1, '0.' + '0'.repeat(100)).text, '1.' + '0'.repeat(100));
  assert.equal(formatVariableNumber(1.005, '0.00').text, '1.01');
  assert.equal(formatVariableNumber(-1234.567, '$#,##0.0').text, '-$1,234.6');
  assert.equal(formatVariableNumber(0.256, '0%').text, '26%');
  assert.equal(formatVariableNumber(1e21, '#,##0').text, '1,000,000,000,000,000,000,000');
});

for (const [value, format] of [[1e308, '0%'], [1, tooPrecise]]) test(`variable formatting reports the boundary for ${format.length}-character pattern`, () => {
  const input = { variables: { amount: { type: 'number', value, format } }, slides: [{ title: 'Value {{amount}}' }] };
  const before = structuredClone(input);
  const resolved = resolveVariables(input);
  assert.equal(resolved.presentation.slides[0].title, `Value ${value}`);
  assert.equal(resolved.diagnostics.filter(entry => entry.code === 'variable-format' && entry.severity === 'error' && entry.path === '/slides/0/title').length, 1);
  const report = validate(input, { only: ['format'] });
  assert.equal(report.valid, false);
  assert.equal(report.findings.filter(entry => entry.ruleId === 'opf/variable-format' && entry.severity === 'error' && entry.path === '/slides/0/title').length, 1);
  assert.deepEqual(input, before);
});

test('chart and table invalid precision retain precise format findings and safe display fallback', () => {
  assert.match(numberFormatError(tooPrecise), /100 decimal places/);
  const input = { slides: [
    { chart: { type: 'column', data: { columns: ['Q', { name: 'Revenue', format: tooPrecise }], rows: [['Q1', 1]] } } },
    { table: { columns: [{ name: 'Revenue', format: tooPrecise }], rows: [[{ value: 1, format: tooPrecise }]] } },
  ] };
  const report = validate(input, { only: ['format'] });
  assert.equal(report.valid, false);
  assert.deepEqual(report.findings.filter(entry => entry.ruleId === 'opf/number-format-invalid').map(entry => entry.path), [
    '/slides/0/chart/data/columns/1/format', '/slides/1/table/columns/0/format', '/slides/1/table/rows/0/0/format',
  ]);
  assert.equal(formatDataNumber(1, tooPrecise), '1');
  assert.equal(formatDataNumber(1e308, '0%'), '1e+308');
});
