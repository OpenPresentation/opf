// VEN-1: four sets whose labels the Basic Venn circles do not hold draw as circles with their labels outside (as five to seven sets do),
// before cards and the list, rather than falling back to a bullet list.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const compose = (slide) => { const context = resolveSlideContext({ slides: [slide] }, 0, { catalogs: [gallery] }); return composeSlide(context.slide, context.options); };

test('VEN-1: four sets with an eight-letter label are a Venn, not a list', () => {
  const result = compose({ layout: 'venn', title: 'Overlap', blocks: [{ region: 'body', items: ['Scope', 'Evidence', 'Goal', 'Owner'] }] });
  assert.equal(result.diagnostics.filter((entry) => entry.code === 'text-overflow').length, 0);
  const [arrangement] = result.arrangements ?? [];
  assert.ok(arrangement, 'drawn as an arrangement');
  assert.ok(['smartart', 'opf'].includes(arrangement.design), arrangement.design);
  assert.equal(arrangement.nodes.filter((node) => node.preset === 'ellipse').length, 4);
});

test('VEN-1: outside labels sit beside their circles', () => {
  const result = compose({ layout: 'venn', title: 'Overlap', blocks: [{ region: 'body', items: ['Scope', 'Evidence', 'Goal', 'Owner'] }] });
  const [arrangement] = result.arrangements;
  if (arrangement.design === 'opf') assert.ok(arrangement.nodes.every((node) => node.beside));
});

test('VEN-1: four long labels keep the list (which paginates), not outside labels', () => {
  const long = 'Planning and operational support for participants across several teams';
  const result = compose({ layout: 'venn', title: 'Overlap', blocks: [{ region: 'body', items: [long, long, long, long] }] });
  assert.ok(!(result.arrangements ?? []).some((arrangement) => arrangement.design === 'opf'));
});
