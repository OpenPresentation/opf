// SH-08: overlay shapes that draw a slide's body (a SmartArt drawing imported as overlay shapes) make it a content slide: its title sits on
// top instead of centering over the shapes as a cover's does. A small mark on a cover (a badge) leaves the cover as it was.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OVERLAY_BODY_SHARE, composeSlide, overlaysDrawBody } from '../dist/composition.js';

test('front overlay shapes covering a fifth of the slide are its body', () => {
  assert.equal(OVERLAY_BODY_SHARE, 0.2);
  assert.equal(overlaysDrawBody([{ x: 0.3, y: 0.2, width: 0.4, height: 0.6, shape: 'ellipse' }]), true);
  assert.equal(overlaysDrawBody([{ x: 0.3, y: 0.2, width: 0.1, height: 0.1 }, { x: 0.6, y: 0.6, width: 0.1, height: 0.1 }]), true, 'the bounds of all of them');
  assert.equal(overlaysDrawBody([{ x: 0.8, y: 0.05, width: 0.1, height: 0.1, shape: 'star5' }]), false, 'a badge');
  assert.equal(overlaysDrawBody([{ x: 0, y: 0, width: 1, height: 1, layer: 'back' }]), false, 'the back layer is a backdrop');
  assert.equal(overlaysDrawBody([{ at: { block: 'a' }, shape: 'rect' }, { connector: { from: 'a', to: 'b' } }]), false);
  assert.equal(overlaysDrawBody(undefined), false);
});

test('a title over a drawing of overlay shapes sits on top; a cover with a badge stays centered', () => {
  const title = slide => composeSlide(slide, {}).items.find(item => item.field === 'title').box;
  const drawing = title({ title: 'Basic Venn', shapes: [{ x: 0.3, y: 0.2, width: 0.4, height: 0.6, shape: 'ellipse' }] });
  const cover = title({ title: 'Cover', shapes: [{ x: 0.8, y: 0.05, width: 0.1, height: 0.1, shape: 'star5' }] });
  const plain = title({ title: 'Cover' });
  assert.ok(drawing.y < cover.y / 2, `the title is on top (${drawing.y} against ${cover.y})`);
  assert.deepEqual(cover, plain, 'a badge leaves the cover as it was');
});
