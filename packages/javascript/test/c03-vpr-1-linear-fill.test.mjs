// C03, VPR-1: PowerPoint's fixed-proportion chevron and vertical-process designs give way to OPF's rows and columns where they cover
// under half of their region, so four one-word stages fill the body as they do under a subtitle, and every chevron of a wrapped set is
// one width.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const compose = (slide) => { const context = resolveSlideContext({ slides: [slide] }, 0, { catalogs: [gallery] }); return composeSlide(context.slide, context.options); };
const findings = (result) => result.diagnostics.filter((entry) => ['text-overflow', 'small-cell', 'layout-unplaced'].includes(entry.code));
const extent = (nodes) => {
  const left = Math.min(...nodes.map((node) => node.box.x)), right = Math.max(...nodes.map((node) => node.box.x + node.box.width));
  const top = Math.min(...nodes.map((node) => node.box.y)), bottom = Math.max(...nodes.map((node) => node.box.y + node.box.height));
  return { width: right - left, height: bottom - top };
};
const rows = (nodes) => new Set(nodes.map((node) => Math.round(node.box.y))).size;
const stages = ['Baseline', 'Pilot', 'Review', 'Decide'];

test('C03: four one-word chevrons fill the body, as they do under a subtitle', () => {
  const plain = compose({ layout: 'chevrons', title: 'Four stages of the pilot', blocks: [{ items: stages }] });
  const subtitled = compose({ layout: 'chevrons', title: 'Four stages of the pilot', subtitle: 'Each stage leads into the next', blocks: [{ items: stages }] });
  for (const result of [plain, subtitled]) {
    assert.deepEqual(findings(result), []);
    const [arrangement] = result.arrangements;
    assert.equal(arrangement.design, 'opf');
    assert.ok(extent(arrangement.nodes).height > 0.6 * arrangement.frame.height, `height ${extent(arrangement.nodes).height} of ${arrangement.frame.height}`);
  }
  assert.equal(rows(plain.arrangements[0].nodes), rows(subtitled.arrangements[0].nodes));
  assert.equal(plain.arrangements[0].fontSize, subtitled.arrangements[0].fontSize);
});

test('C03: every chevron of a wrapped set is one width', () => {
  for (const items of [['Scope', 'Baseline', 'Pilot', 'Measure', 'Review', 'Decide', 'Scale'], ['Scope', 'Baseline', 'Recruit', 'Pilot', 'Measure', 'Review', 'Decide', 'Scale']]) {
    const result = compose({ layout: 'chevrons', title: 'Stages', blocks: [{ items }] });
    assert.deepEqual(findings(result), []);
    const { nodes } = result.arrangements[0];
    assert.ok(rows(nodes) > 1);
    for (const node of nodes) assert.ok(Math.abs(node.box.width - nodes[0].box.width) < 0.01, `${node.box.width} vs ${nodes[0].box.width}`);
  }
});

test('VPR-1: three one-word steps of a vertical process span their half of the slide', () => {
  const result = compose({ layout: 'vertical-process', title: 'How a team joins the pilot', blocks: [{ region: 'body', items: ['Nominate', 'Train', 'Start'] }] });
  assert.deepEqual(findings(result), []);
  const [arrangement] = result.arrangements;
  assert.equal(arrangement.design, 'opf');
  assert.ok(extent(arrangement.nodes).width > 0.9 * arrangement.frame.width, `width ${extent(arrangement.nodes).width} of ${arrangement.frame.width}`);
});
