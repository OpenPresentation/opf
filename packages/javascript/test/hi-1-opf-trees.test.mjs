// HI1, H2: OPF's own tree (opfTreeGeometry) fills the region where PowerPoint's tree, scaled as a whole, leaves most of it empty (a narrow
// three-level org chart) or does not hold the labels (a fourth level, labels of about twenty characters), which fell back to a list.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide, nativeTreeGeometry, opfTreeGeometry } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const compose = (slide) => { const context = resolveSlideContext({ slides: [slide] }, 0, { catalogs: [gallery] }); return composeSlide(context.slide, context.options); };
const findings = (result) => result.diagnostics.filter((entry) => ['text-overflow', 'small-cell', 'layout-unplaced'].includes(entry.code));
const width = (nodes) => Math.max(...nodes.map((node) => (node.background ?? node.box).x + (node.background ?? node.box).width)) - Math.min(...nodes.map((node) => (node.background ?? node.box).x));
const entry = (text, level) => ({ text, level });

test('HI1: a three-level org chart spans its region', () => {
  const items = [entry('Pilot lead', 0), entry('Delivery', 1), entry('Design', 2), entry('Build', 2), entry('Evidence', 1), entry('Survey', 2)];
  const result = compose({ layout: 'org-chart', title: 'Give the pilot a clear reporting structure', blocks: [{ region: 'body', items }] });
  assert.deepEqual(findings(result), []);
  const [arrangement] = result.arrangements;
  assert.equal(arrangement.design, 'opf');
  assert.ok(width(arrangement.nodes) > 0.9 * arrangement.frame.width, `width ${width(arrangement.nodes)} of ${arrangement.frame.width}`);
  assert.equal(arrangement.connectors.length, items.length - 1);
});

test('H2: a fourth level keeps the hierarchy, not a list', () => {
  const deep = [entry('Pilot', 0), entry('Delivery', 1), entry('Design', 2), entry('Build', 2), entry('Test', 3), entry('Evidence', 1), entry('Survey', 2), entry('Report', 2)];
  for (const items of [deep]) {
    const result = compose({ layout: 'hierarchy', title: 'Break the pilot into focused workstreams', blocks: [{ region: 'body', items }] });
    assert.deepEqual(findings(result), []);
    assert.equal(result.arrangements?.length, 1, 'drawn as a tree');
    assert.equal(result.arrangements[0].nodes.length, items.length);
    assert.ok(result.arrangements[0].nodes.every((node) => node.background), 'a hierarchy keeps its rear cards');
  }
});

test('HI1: OPF\'s tree keeps the tidy positions of PowerPoint\'s, scaled across and down on their own', () => {
  const items = [entry('Root', 0), entry('A', 1), entry('B', 1), entry('C', 2)];
  const frame = { x: 0, y: 0, width: 1000, height: 500 };
  for (const kind of ['org-chart', 'hierarchy']) {
    const native = nativeTreeGeometry(kind, frame, items), own = opfTreeGeometry(kind, frame, items);
    assert.ok(native.ok && own.ok);
    // The same order left to right and the same rows.
    const order = (geometry) => [...geometry.nodes].sort((a, b) => a.box.x - b.box.x || a.box.y - b.box.y).map((node) => node.index);
    assert.deepEqual(order(own), order(native), kind);
    const rows = (geometry) => geometry.nodes.map((node) => Math.round(node.box.y * 1000) / 1000);
    assert.deepEqual(new Set(rows(own)).size, new Set(rows(native)).size);
    for (const node of own.nodes) {
      const box = node.background ?? node.box;
      assert.ok(box.x >= -1e-6 && box.x + box.width <= 1000 + 1e-6 && box.y >= -1e-6 && box.y + box.height <= 500 + 1e-6, kind);
    }
  }
});
