import assert from 'node:assert/strict';
import test from 'node:test';
import { FIGURE_CEILING, LONE_DISPLAY_SIZES, MIN_MEASURE_CHARS, composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

// RR-105 (coverage finding 30): a short body grows and sits in the middle of the body on every slide size, as on a 16:9 slide. A lone
// short message on a narrow slide (portrait, square) grows to the largest display step whose lines keep the minimum measure, where the
// guard used to throw it back to its plain size; lists, tables and metrics reach their display sizes (LONE_DISPLAY_SIZES) on every size.

const SIZES = ['16:9', '4:3', '1:1', '4:5', '9:16', 'a4', 'letter'];
const slides = [
  { title: 'One short paragraph', text: 'Cranes at the north berth cut waiting time by a third this year.' },
  { title: 'Three changes made the difference', items: ['Two new cranes at the north berth', 'Night shifts on weekends', 'One booking system for every carrier'] },
  { title: 'Volume by terminal', table: { columns: ['Terminal', 'Q1', 'Q2'], rows: [['North', '210', '236'], ['South', '180', '201'], ['East', '95', '120']] } },
  { title: 'Waiting time', metric: { value: '-34%', label: 'Average wait at the north berth' } },
];
const compose = (dimensions, index) => {
  const deck = { $schema: 'https://openpresentation.org/schema/opf/v1', language: 'en-US', design: { dimensions }, slides };
  const context = resolveSlideContext(deck, index);
  const result = composeSlide(context.slide, context.options);
  return { result, scale: Math.min(result.width, result.height) / 720, body: result.items.find((item) => !['title', 'subtitle', 'tag'].includes(item.field)) };
};
const centered = ({ result, body }) => {
  const box = result.contentBox, inkBottom = body.box.y + (body.text?.placement?.height ?? body.box.height);
  return Math.abs(body.box.y - box.y - (box.y + box.height - inkBottom)) < 0.2 * box.height;
};

for (const dimensions of SIZES) {
  test(`${dimensions}: a short body grows and sits in the middle`, () => {
    const message = compose(dimensions, 0);
    assert.ok(message.body.text.fontSize > LONE_DISPLAY_SIZES.text * message.scale + 1e-6, `the message grows past a paragraph's display size: ${message.body.text.fontSize / message.scale}`);
    // Its lines keep the minimum measure, or it is on three lines or fewer.
    assert.ok(message.body.text.lines.length <= 3 || message.body.box.width >= MIN_MEASURE_CHARS * 0.5 * message.body.text.fontSize);
    const list = compose(dimensions, 1);
    assert.ok(Math.abs(list.body.text.fontSize / list.scale - LONE_DISPLAY_SIZES.list) < 0.05, `the list at its display size: ${list.body.text.fontSize / list.scale}`);
    const table = compose(dimensions, 2);
    assert.ok(table.body.tableGrowth > 1.9, `the table grows: ${table.body.tableGrowth}`);
    const metric = compose(dimensions, 3);
    // LH-188: under its label title the metric is a one-message slide's figure of at most six characters: FIGURE_CEILING.size, not LONE_DISPLAY_SIZES.value.
    assert.ok(Math.abs(metric.body.metricLayout.parts.find((part) => part.role === 'value').fit.fontSize - FIGURE_CEILING.size * metric.scale) < 0.5);
    for (const composed of [message, list, table]) assert.ok(centered(composed), `${composed.body.field} in the middle`);
  });
}
