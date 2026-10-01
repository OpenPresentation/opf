// Controls for reading picture bullets. Run: node --test picture-bullets.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {withoutBulletBlips, bulletBlipRids, isPreviewBullet} from './picture-bullets.mjs';

const bullet = rid => `<a:buBlip><a:blip r:embed="${rid}"/></a:buBlip>`;
const list = `<p:txBody><a:p><a:pPr>${bullet('rId2')}</a:pPr><a:r><a:t>One</a:t></a:r></a:p><a:p><a:pPr>${bullet('rId3')}</a:pPr><a:r><a:t>Two</a:t></a:r></a:p></p:txBody>`;

test('a text shape with picture bullets has no picture of its own', () => {
  assert.equal(/<a:blip\b/.test(withoutBulletBlips(list)), false);
});
test('the bullets are listed in paragraph order', () => {
  assert.deepEqual(bulletBlipRids(list), ['rId2', 'rId3']);
});
test('a real picture fill is kept', () => {
  const pic = '<p:blipFill><a:blip r:embed="rId9"/></p:blipFill>' + list;
  assert.match(withoutBulletBlips(pic), /<a:blip r:embed="rId9"\/>/);
  assert.deepEqual(bulletBlipRids(pic), ['rId2', 'rId3']);
});
test('only hidden images inside a list are preview bullets', () => {
  assert.equal(isPreviewBullet({'aria-hidden': 'true'}, 'slides.0.items'), true);
  assert.equal(isPreviewBullet({'aria-hidden': 'true'}, 'slides.0.blocks.1.bullets'), true);
  assert.equal(isPreviewBullet({}, 'slides.0.items'), false);
  assert.equal(isPreviewBullet({'aria-hidden': 'true'}, 'slides.0.image'), false);
  assert.equal(isPreviewBullet({'aria-hidden': 'true'}, null), false);
});
