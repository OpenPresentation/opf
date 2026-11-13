import assert from 'node:assert/strict';
import test from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext, validate } from '../dist/index.js';

// RR-105 (coverage finding 24): design.chartPrimary and design.contentDirection stay the author's on a slide of a chart and a short text.
// The automatic note band no longer takes the text out of a chartPrimary split, LH-49's chart track no longer turns a vertical body into a
// row, and a chartPrimary that cannot be drawn (the slide's own composition.mode) is reported instead of dropped silently.

const chart = { chart: { type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', 12], ['Q2', 18], ['Q3', 22], ['Q4', 26]] } } };
const deck = (design, blocks = [chart, { text: 'Revenue doubled from the first quarter to the last.' }], extra = {}) => ({ $schema: 'https://openpresentation.org/schema/opf/v1', language: 'en-US', design: { background: 'light1' }, slides: [{ title: 'Revenue', design, blocks, ...extra }] });
const boxes = (document) => {
  const context = resolveSlideContext(document, 0), result = composeSlide(context.slide, context.options);
  const of = (field) => result.items.find((item) => item.field === field);
  return { chart: of('chart').box, text: of('text').box, result };
};

test('each chartPrimary side places the chart at that side of the text', () => {
  const start = boxes(deck({ chartPrimary: 'start' })), end = boxes(deck({ chartPrimary: 'end' }));
  assert.ok(start.chart.x + start.chart.width <= start.text.x + 0.01, 'start: chart first');
  assert.ok(end.text.x + end.text.width <= end.chart.x + 0.01, 'end: chart last');
  assert.ok(start.chart.width > start.text.width, 'the chart takes the larger track');
  const top = boxes(deck({ chartPrimary: 'top' })), bottom = boxes(deck({ chartPrimary: 'bottom' }));
  assert.ok(top.chart.y + top.chart.height <= top.text.y + 0.01, 'top: chart above');
  assert.ok(bottom.text.y + bottom.text.height <= bottom.chart.y + 0.01, 'bottom: chart below');
  for (const { result } of [start, end, top, bottom]) assert.equal(result.emphasis, undefined, 'no note band takes the text');
  // The text sits in the middle of its track, level with the chart.
  assert.ok(Math.abs(start.text.y + start.text.height - (start.chart.y + start.chart.height)) < 1 && start.text.y > start.chart.y + 50);
});

test('chartPrimary none keeps the automatic body, with its note band', () => {
  assert.ok(boxes(deck({ chartPrimary: 'none' })).result.emphasis);
  assert.ok(boxes(deck({})).result.emphasis);
});

test('contentDirection vertical stacks the text over the chart; horizontal sets them side by side', () => {
  const blocks = [{ text: 'Revenue grew every quarter.' }, chart];
  const vertical = boxes(deck({ contentDirection: 'vertical' }, blocks));
  assert.ok(vertical.text.y + vertical.text.height <= vertical.chart.y + 0.01);
  assert.ok(Math.abs(vertical.chart.width - vertical.text.width) < 0.01, 'one column');
  const horizontal = boxes(deck({ contentDirection: 'horizontal' }, blocks));
  assert.ok(horizontal.text.x + horizontal.text.width <= horizontal.chart.x + 0.01);
});

test('a chartPrimary the slide cannot draw is reported', () => {
  const findings = validate(deck({ chartPrimary: 'start' }, undefined, { composition: { mode: 'column' } })).findings.filter((finding) => finding.ruleId === 'opf/arrangement-adapted');
  assert.deepEqual(findings.map((finding) => finding.path), ['/slides/0/design/chartPrimary']);
  assert.deepEqual(validate(deck({ chartPrimary: 'start' })).findings.filter((finding) => finding.ruleId === 'opf/arrangement-adapted'), []);
});
