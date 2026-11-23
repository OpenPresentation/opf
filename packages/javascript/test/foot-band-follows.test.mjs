// C14: LH-06's foot band under a short body (a one-line snippet) stands one gap under the body's lowest content, so the snippet and its
// takeaway are one centered group instead of a snippet in the middle and a band at the foot with a quarter of the body between them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

test('C14: a foot band follows a short snippet, one gap under it, and the group is centered', () => {
  const result = composeSlide({ title: 'Sum the items', blocks: [{ code: { language: 'javascript', source: 'sum(items);' } }, { text: 'One call.' }] }, { width: 1280, height: 720 });
  assert.equal(result.emphasis?.source, 'foot-band');
  const code = result.items.find((item) => item.field === 'code');
  const gap = result.emphasis.box.y - (code.box.y + code.box.height);
  assert.ok(gap > 0 && gap < 40, `the band follows the snippet (${gap} px between them)`);
  const top = code.box.y - result.contentBox.y, bottom = result.contentBox.y + result.contentBox.height - (result.emphasis.box.y + result.emphasis.box.height);
  assert.ok(bottom > 40, 'the band no longer sits at the foot of the body');
  assert.ok(top > 0, 'the snippet keeps its place under the title');
});
