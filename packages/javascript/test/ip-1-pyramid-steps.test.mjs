// IP1, PY1: OPF's stepped pyramid (pyramidSteps) and its labels sit in the middle of the region as one group, and one or two levels are
// bars of a capped height in the middle of the region's height, not a block filling it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { PYRAMID_STEP_HEIGHT, composeSlide, opfLayoutGeometry, pyramidSteps } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const compose = (slide) => { const context = resolveSlideContext({ slides: [slide] }, 0, { catalogs: [gallery] }); return composeSlide(context.slide, context.options); };
const findings = (result) => result.diagnostics.filter((entry) => ['text-overflow', 'small-cell', 'layout-unplaced'].includes(entry.code));

test('IP1: the inverted pyramid and its labels are centered in the region', () => {
  const result = compose({ layout: 'inverted-pyramid', title: 'From possibilities to a decision', blocks: [{ region: 'body', items: ['Possibilities', 'Qualified options', 'Shortlist', 'Decision'] }] });
  assert.deepEqual(findings(result), []);
  const [arrangement] = result.arrangements, list = result.items.find((item) => item.field === 'items');
  assert.equal(arrangement.design, 'opf');
  const left = Math.min(...arrangement.nodes.map((node) => node.box.x)) - arrangement.frame.x;
  const right = arrangement.frame.x + arrangement.frame.width - Math.max(...list.listColumns.map((column) => column.box.x + Math.max(...column.text.listEntries[0].text.richLines.map((line) => line.width))));
  assert.ok(left > 40, `left ${left}`);
  assert.ok(Math.abs(left - right) < 2, `left ${left}, right ${right}`);
  assert.ok(arrangement.layout.inset > 0);
});

test('IP1: one level is a bar in the middle of the region, not a block', () => {
  const area = { x: 0, y: 0, width: 1000, height: 500 };
  const [node] = pyramidSteps(area, 1, 12, 8);
  assert.ok(node.box.height <= PYRAMID_STEP_HEIGHT * node.box.width + 1e-6);
  assert.ok(Math.abs(node.box.y + node.box.height / 2 - 250) < 0.01);
  // Four levels in that area keep their full share of the height (under the cap).
  const four = pyramidSteps(area, 4, 12, 8);
  assert.ok(Math.abs(four.at(-1).box.y + four.at(-1).box.height - 500) < 0.01);
});

test('IP1: the export\'s layout definition draws the inset design', () => {
  const area = { x: 10, y: 20, width: 1000, height: 500 }, recipe = { design: 'pyramid-steps', area, gap: 6, radius: 8, inset: 120 };
  const nodes = opfLayoutGeometry(recipe, 3).nodes, plain = pyramidSteps(area, 3, 6, 8);
  for (const [index, node] of nodes.entries()) assert.ok(Math.abs(node.box.x - plain[index].box.x - 120) < 0.01);
});
