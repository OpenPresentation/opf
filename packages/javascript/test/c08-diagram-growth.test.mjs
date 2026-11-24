// C08, IM1: a small diagram with room grows its base size past the nominal 32 px (up to 48 px) instead of a small strip in a large body.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide, ensureDiagrams } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const compose = (slide) => { const context = resolveSlideContext({ slides: [slide] }, 0, { catalogs: [gallery] }); return composeSlide(context.slide, context.options); };

test('C08: a three-node flowchart alone in a wide body grows past the nominal size', async () => {
  await ensureDiagrams?.();
  const result = compose({ layout: 'chart', title: 'Review loop', blocks: [{ diagram: { source: 'flowchart LR\n A[Plan] --> B[Pilot] --> C[Review]' } }] });
  const item = result.items.find((entry) => entry.field === 'diagram');
  assert.ok(item?.diagram && !item.diagram.issue, 'drawn');
  assert.ok(item.diagram.fontSize > 32 + 1e-6, `size ${item.diagram.fontSize}`);
  assert.ok(item.diagram.fontSize <= 48 + 1e-6);
});

test('C08: a diagram that fills its block keeps stepping down, never past the cap', async () => {
  await ensureDiagrams?.();
  const source = 'flowchart LR\n' + Array.from({ length: 7 }, (_, index) => ` N${index}[Step number ${index}] --> N${index + 1}[Step number ${index + 1}]`).join('\n');
  const result = compose({ layout: 'chart', title: 'Many steps', blocks: [{ diagram: { source } }] });
  const item = result.items.find((entry) => entry.field === 'diagram');
  assert.ok(item.diagram.fontSize <= 32 + 1e-6, `size ${item.diagram.fontSize}`);
});
