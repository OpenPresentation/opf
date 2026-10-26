// WI-3 (P11, P12, P13): the generic column layouts take every content kind in every column, show pictures whole by default,
// and let an explicit fit win. two-column gains the timeline and the contained-fit default; three-column is new.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, REGION_KINDS } from '@openpresentation/opf/composition';
import { validate } from '@openpresentation/opf';
import { gallery } from '../dist/index.js';
import { sampleBlock } from '../../../scripts/gallery-stability-fixtures.mjs';

const COLUMNS = { 'two-column': ['first', 'second'], 'three-column': ['first', 'second', 'third'] };
const picture = (index) => sampleBlock('image', index).image;

for (const [id, names] of Object.entries(COLUMNS)) {
  const record = gallery.layouts[id];

  test(`${id}: every region accepts every content kind, the timeline included`, () => {
    assert.ok(record, `${id} is in the gallery`);
    const body = record.regions.flatMap((entry) => entry.regions ?? []);
    assert.deepEqual(body.map((entry) => entry.name), names);
    for (const entry of body) assert.deepEqual([...entry.accepts].sort(), [...REGION_KINDS].sort(), `${id}/${entry.name}`);
    assert.ok(REGION_KINDS.includes('timeline') && REGION_KINDS.includes('video') && REGION_KINDS.includes('group'));
  });

  for (const kind of [...REGION_KINDS]) {
    test(`${id}: ${kind} in every column binds one block per column and composes with no diagnostics`, () => {
      const blocks = names.map((_, index) => sampleBlock(kind, index));
      const slide = { layout: id, title: `Peer columns of ${kind}`, blocks };
      const deck = { name: 't', slides: [slide] };
      const checked = validate(deck, { catalogs: [gallery] });
      assert.equal(checked.counts.error, 0, JSON.stringify(checked.findings.filter((finding) => finding.severity === 'error')));
      assert.ok(!checked.findings.some((finding) => finding.ruleId === 'opf/layout-failed' || finding.ruleId === 'opf/layout-unplaced'), JSON.stringify(checked.findings));
      const composed = composeSlide(slide, { layout: record });
      assert.deepEqual(composed.diagnostics, [], `${id}/${kind}: ${JSON.stringify(composed.diagnostics)}`);
      assert.deepEqual(composed.regions.filter((region) => names.includes(region.name)).map((region) => region.content.length), names.map(() => 1));
      const field = kind === 'group' ? undefined : kind === 'list' ? 'items' : kind;
      if (field) assert.equal(composed.items.filter((item) => item.field === field).length, names.length, 'one drawn payload per column');
    });
  }

  test(`${id}: a picture is shown whole by default, and an explicit fit wins`, () => {
    assert.equal(record.design.imageFit, 'contain');
    const image = (extra) => ({ image: picture(0), ...extra });
    const composed = composeSlide({ title: 'Pictures', blocks: [image(), image({ fit: 'cover' }), ...(names.length > 2 ? [image({ fit: 'stretch' })] : [])] }, { layout: record });
    const fits = composed.items.filter((item) => item.field === 'image').map((item) => item.image.fit);
    assert.deepEqual(fits, names.length > 2 ? ['contain', 'cover', 'stretch'] : ['contain', 'cover']);
  });
}

test('three-column is the generic column layout of the Text group, after two-column', () => {
  const ids = Object.keys(gallery.layouts);
  assert.equal(ids.indexOf('three-column'), ids.indexOf('two-column') + 1);
  assert.equal(gallery.layouts['three-column'].tags[0], 'Text');
  assert.match(gallery.layouts['three-column'].description, /fewer columns when content needs more width/);
});

test('a timeline in either column of two-column is placed in its column (it was drawn below the grid)', () => {
  const timeline = (index) => sampleBlock('timeline', index);
  const composed = composeSlide({ title: 'Plans', blocks: [timeline(0), timeline(1)] }, { layout: gallery.layouts['two-column'] });
  assert.deepEqual(composed.diagnostics, []);
  const [first, second] = composed.items.filter((item) => item.field === 'timeline');
  assert.equal(first.region, 'first');
  assert.equal(second.region, 'second');
  assert.ok(first.box.x + first.box.width <= second.box.x + 0.01, 'the columns sit side by side');
});

test('media regions that were centered keep their look: image-beside and logos anchor in the middle', () => {
  for (const [id, name] of [['image-beside', 'media'], ['logos', 'logos']]) {
    const region = id === 'logos' ? gallery.layouts[id].regions[1] : gallery.layouts[id].regions[1].regions.find((entry) => entry.name === name);
    assert.equal(region.name, name);
    assert.equal(region.anchor, 'middle', id);
  }
});
