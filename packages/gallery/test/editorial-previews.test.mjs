import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validate} from '@openpresentation/opf';
import {readCatalog} from '../scripts/build.mjs';
import {editorialDeck} from '../scripts/editorial-previews.mjs';
import {templateDeck} from '../scripts/fixtures.mjs';

const {gallery} = await readCatalog();
for (const [id, record] of Object.entries(gallery.layouts)) {
  test(`${id}: authored preview validates and discloses illustrative data`, () => {
    const deck = editorialDeck(id, record);
    const result = validate(deck, {catalogs: [gallery]});
    assert.equal(result.valid, true, JSON.stringify(result));
    assert.match(deck.slides[0].subtitle, /Illustrative/);
    assert.equal(templateDeck(id, record).slides.length, 2, 'stability fixtures remain exhaustive');
  });
}
test('FAQ and process teach their intent; team does not mislabel landscape pictures as portraits', () => {
  const slide = id => editorialDeck(id, gallery.layouts[id]).slides[0];
  assert.ok(slide('faq').blocks.every(block => /\?\n/.test(block.text)));
  assert.ok(slide('process').blocks.every(block => /^\d\. /.test(block.text)));
  assert.ok(slide('team').blocks.every(block => block.text.split('\n').length === 3 && !block.image));
  assert.equal(slide('chart').blocks.filter(block => block.chart).length, 1);
  assert.equal(slide('table').blocks.filter(block => block.table).length, 1);
  const metrics = slide('metrics').blocks.filter(block => block.metric).map(block => block.metric.label);
  assert.equal(new Set(metrics).size, 3);
});
test('only compact presentation intents opt into vertical centering', () => {
  for (const id of ['metrics', 'quote', 'image-beside']) assert.ok(Object.values(gallery.layouts[id].regions).some(region => region.anchor === 'middle'));
  for (const id of ['two-column', 'chart', 'table', 'dashboard', 'list', 'faq']) {
    assert.ok(Object.values(gallery.layouts[id].regions).every(region => !region.anchor || region.anchor === 'top'), id);
  }
});
