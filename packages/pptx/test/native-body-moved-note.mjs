// opf#1481: with bodyText 'native', a block core moved out of its layout region's box (a note follows its table a gap under the last
// row, LH-48) is written where core drew it (the item's box, anchored at the top), not at the region's box, so the note sits under the
// table as in the preview. A block at its region's top, or centered in it, keeps the region's box; a deck exported without the native
// body is untouched by the option.
import assert from 'node:assert/strict';
import {unzipSync, strFromU8} from 'fflate';
import {resolveSlideContext} from '@openpresentation/opf';
import {composeSlide} from '@openpresentation/opf/composition';
import {toPptx, catalogs} from './helpers/default-catalog.mjs';

const options = {seed: 1481, timestamp: '2026-11-25T00:00:00Z', zipDate: '2026-11-25T00:00:00Z'};
const rows = count => Array.from({length: count}, (_, index) => [String.fromCharCode(65 + index), 20 + index, 0.5 + index / 20, 5 + index]);
const table = count => ({region: 'body', table: {columns: ['Team', {name: 'Participants', format: '0'}, {name: 'Completion', format: '0%'}, {name: 'Median time (min)', format: '0.0'}], rows: rows(count)}});
const note = 'NOTE_UNDER_TABLE test with two teams for six weeks.';
const deckOf = slide => ({name: 'Moved note', language: 'en-US', design: {background: 'light1', fontScheme: 'roboto'}, slides: [slide]});
const EMU = 9525;

// The offset and extent (EMU) of the shape that holds `text` in slide 1.
function shapeBox(entries, text) {
  const xml = strFromU8(entries['ppt/slides/slide1.xml']);
  const shape = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([sp]) => sp).find(sp => sp.includes(text));
  assert.ok(shape, `a shape holds ${text}`);
  const [, x, y, cx, cy] = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(shape).map(Number);
  return {x, y, cx, cy, shape};
}
const compose = source => {
  const context = resolveSlideContext(source, 0, {catalogs});
  const geometry = composeSlide(context.slide, context.options);
  return {geometry, item: geometry.items.find(entry => entry.field === 'text'), region: geometry.regions.find(entry => entry.name === 'aside')};
};
const close = (actual, expected, what) => assert.ok(Math.abs(actual - Math.round(expected * EMU)) <= 1, `${what}: ${actual} EMU against ${expected * EMU}`);

// 1. The note of a table slide at several row counts: the placeholder is at core's box for the note.
for (const count of [1, 3, 6]) {
  const source = deckOf({id: 'sw', title: 'Table', layout: 'table', blocks: [table(count), {region: 'aside', text: note}]});
  const {item, region} = compose(source);
  assert.ok(Math.abs(item.box.y - region.box.y) > 1, `${count} rows: core moved the note out of its region`);
  const native = unzipSync(new Uint8Array(await toPptx(source, {...options, bodyText: 'native'})));
  const placed = shapeBox(native, 'NOTE_UNDER_TABLE');
  close(placed.y, item.box.y, `${count} rows: top`);
  close(placed.cy, item.box.height, `${count} rows: height`);
  assert.match(placed.shape, /<p:ph type="body" idx="300"\/>/, 'the note is still the Body placeholder');
  assert.match(placed.shape, /<a:bodyPr[^>]*anchor="t"/, 'anchored at the top');
  // The measured export (no native body) draws the same note lines at core's box: the lines start at item.box.y.
  const measured = unzipSync(new Uint8Array(await toPptx(source, options)));
  const line = shapeBox(measured, 'NOTE_UNDER_TABLE');
  assert.ok(Math.abs(line.y - Math.round(item.box.y * EMU)) <= Math.round(item.box.height * EMU), `${count} rows: the measured note stays inside core's box`);
  assert.ok(placed.y >= line.y - EMU * 2 && placed.y <= line.y + EMU * 2 + Math.round(item.box.height * EMU), `${count} rows: native and measured notes agree`);
}

// 2. A note at the top of its region (no table to follow: the text layout's body) keeps the region's box.
{
  const source = deckOf({id: 'plain', title: 'Plain', layout: 'text', text: 'PLAIN_BODY text'});
  const {item, geometry} = compose(source);
  const region = geometry.regions.find(entry => entry.name === item.region);
  const native = unzipSync(new Uint8Array(await toPptx(source, {...options, bodyText: 'native'})));
  const placed = shapeBox(native, 'PLAIN_BODY');
  close(placed.y, region.box.y, 'region top');
  close(placed.cy, region.box.height, 'region height');
}

// 3. A note beside its table starts at its region's top: it keeps the region's box.
{
  const source = deckOf({id: 'beside', title: 'Beside', layout: 'table-beside', blocks: [{table: table(2).table}, {region: 'aside', text: note}]});
  const {item, region} = compose(source);
  const native = unzipSync(new Uint8Array(await toPptx(source, {...options, bodyText: 'native'})));
  const placed = shapeBox(native, 'NOTE_UNDER_TABLE');
  close(placed.y, region.box.y, 'region top');
  close(placed.cy, region.box.height, 'region height');
  assert.match(placed.shape, /anchor="t"/); assert.ok(Math.abs(item.box.y - region.box.y) < 1);
  assert.ok(item.box.height <= region.box.height);
}

// 4. The option off: the export of the table deck does not depend on this code (same bytes twice, no placeholder body).
{
  const source = deckOf({id: 'sw', title: 'Table', layout: 'table', blocks: [table(3), {region: 'aside', text: note}]});
  const a = new Uint8Array(await toPptx(source, options)), b = new Uint8Array(await toPptx(source, options));
  assert.deepEqual(a, b);
  assert.ok(!strFromU8(unzipSync(a)['ppt/slides/slide1.xml']).includes('idx="300"'), 'no native body without the option');
}
console.log('native-body-moved-note ok');
