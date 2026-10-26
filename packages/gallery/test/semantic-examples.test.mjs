// P07 to P10 (slide-design WI-6): the editorial examples of pillars, process, team and FAQ give each entry a label and a
// description as two roles of one list entry (`items: [{ text, description }]`) instead of one string with typed newlines
// or a typed "1. ". The words and their order are what the examples always showed; the layouts draw no bullet.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {toSvg} from '@openpresentation/opf-render';
import {readCatalog} from '../scripts/build.mjs';
import {editorialDeck} from '../scripts/editorial-previews.mjs';

const {gallery} = await readCatalog();
const deck = id => editorialDeck(id, gallery.layouts[id]);

// The words of each example as they were drawn before the structure changed: the lines of every block's text.
const BEFORE = {
  pillars: [
    ['Clear scope', 'Two teams and one workflow keep the pilot focused.'],
    ['Consistent measures', 'Track completion and task time against a baseline.'],
    ['An explicit decision', 'Agree the evidence needed before expanding.'],
  ],
  process: [
    ['1. Establish a baseline', 'Measure the current completion rate and task time.'],
    ['2. Run the pilot', 'Test with two teams and review feedback each week.'],
    ['3. Decide what to scale', 'Compare outcomes with the baseline and agree the next step.'],
  ],
  team: [
    ['Ana Ruiz', 'Pilot lead', 'Coordinates the two teams and weekly reviews.'],
    ['Sam Lee', 'Product lead', 'Turns participant feedback into product changes.'],
    ['Kai Moreau', 'Analytics lead', 'Measures completion and task time consistently.'],
  ],
  faq: [
    ['Who takes part?', 'Two field teams, with 52 participants in total.'],
    ['How long does it run?', 'Six weeks, including a baseline measurement.'],
    ['What happens next?', 'Review completion and task time before expanding.'],
  ],
};

// The lines a block shows, in order: each entry's number (a numbered list), its label, then its description's lines.
function lines(block) {
  const numbered = block.numbering !== undefined;
  return block.items.flatMap(item => [
    `${numbered ? `${item.start ?? 1}. ` : ''}${item.text}`,
    ...(item.description === undefined ? [] : item.description.split('\n')),
  ]);
}

for (const id of Object.keys(BEFORE)) {
  test(`${id}: the example keeps its words and order, as label and description`, () => {
    const blocks = deck(id).slides[0].blocks;
    assert.equal(blocks.length, 3);
    assert.deepEqual(blocks.map(lines), BEFORE[id]);
    for (const block of blocks) {
      assert.equal(block.items.length, 1);
      assert.equal(typeof block.items[0].text, 'string');
      assert.ok(block.items[0].description, 'every label has a description');
      assert.equal(block.text, undefined, 'no typed newlines in a text block');
    }
  });
}

const markers = svg => [...svg.matchAll(/<text\b[^>]*\baria-hidden="true"[^>]*>([^<]*)<\/text>/g)].map(match => match[1]);

test('pillars, team and FAQ declare no bullets and draw none; the records say so', () => {
  for (const id of ['pillars', 'team', 'faq']) {
    assert.equal(gallery.layouts[id].design.listBullet, 'none', id);
    assert.deepEqual(markers(toSvg(deck(id), 1, {catalogs: [gallery]})), [], `${id} draws no marker`);
  }
  // Every other layout keeps the default marker.
  for (const [id, record] of Object.entries(gallery.layouts)) if (!['pillars', 'team', 'faq'].includes(id)) assert.notEqual(record.design?.listBullet, 'none', id);
});

test('process numbering appears once: from the list, never typed into the label', () => {
  const slide = deck('process').slides[0];
  assert.deepEqual(slide.blocks.map(block => block.numbering), ['arabic', 'arabic', 'arabic']);
  assert.deepEqual(slide.blocks.map(block => block.items[0].start), [1, 2, 3]);
  assert.ok(slide.blocks.every(block => !/^\d/.test(block.items[0].text)));
  const svg = toSvg(deck('process'), 1, {catalogs: [gallery]});
  assert.deepEqual(markers(svg), ['1.', '2.', '3.'], 'one number per step, and no bullet glyph beside it');
  assert.equal((svg.match(/>\s*\d\.\s/g) ?? []).length, 0, 'no typed number in the label text');
});
