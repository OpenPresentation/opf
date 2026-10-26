import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';

// design.listBullet: none exports no bullet (a:buNone) and no margin or hanging indent, and the list reads back as the same
// list: the recorded line roles say which line starts an entry, because no bullet does.
const decoder = new TextDecoder();
const EMU = 9525;
const ITEMS = [
  {text: 'Clear scope', description: 'Two teams and one workflow keep the pilot focused.'},
  {text: 'Consistent measures', description: 'Track completion and task time against a baseline.'},
  'A plain entry',
];
const slideXml = async (deck, options = {}) => decoder.decode(unzipSync(await toPptx(deck, {seed: 1, ...options}))['ppt/slides/slide1.xml']);
const listShapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape).filter(shape => /name="OPF list /.test(shape));
const listItems = result => (result.slides[0].blocks ?? [result.slides[0]]).find(block => block.items ?? block.type === 'list')?.items ?? result.slides[0].items;
const plainText = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(run => run.text ?? run).join('') : value;

const none = {design: {listBullet: 'none'}, slides: [{title: 'Pillars', items: ITEMS}]};
const bulleted = {slides: [{title: 'Pillars', items: ITEMS}]};

// Export: every line is a:buNone, with no character bullet, no auto-number, no picture bullet and no margin or hanging indent.
{
  const shapes = listShapes(await slideXml(none));
  assert.equal(shapes.length, 5, 'two entries with a description (4 lines) and one plain entry (1 line)');
  for (const shape of shapes) {
    assert.match(shape, /<a:buNone\/>/);
    assert.doesNotMatch(shape, /<a:bu(Char|AutoNum|Blip)\b/);
    const properties = shape.match(/<a:pPr\b([^>]*)>/)[1];
    assert.equal(+(properties.match(/\bmarL="(-?\d+)"/)?.[1] ?? 0), 0, 'no left margin');
    assert.equal(+(properties.match(/\bindent="(-?\d+)"/)?.[1] ?? 0), 0, 'no hanging indent');
  }
  // The text starts at the same left edge on the label and on its description.
  const lefts = shapes.map(shape => +shape.match(/<a:off x="(-?\d+)"/)[1] / EMU);
  assert.equal(new Set(lefts.map(left => left.toFixed(3))).size, 1, `one left edge: ${lefts}`);
  // The bulleted list of the same words has the glyph on its first line and its text further right.
  const reference = listShapes(await slideXml(bulleted));
  assert.match(reference[0], /<a:buChar\b/);
  assert.ok(+reference[0].match(/<a:pPr\b[^>]*\bmarL="(\d+)"/)[1] > 0);
}

// Export: numbering still draws native numbers under listBullet none.
{
  const numbered = {design: {listBullet: 'none'}, slides: [{title: 'Steps', items: ['One', 'Two'], numbering: 'arabic'}]};
  const shapes = listShapes(await slideXml(numbered));
  assert.ok(shapes.every(shape => /<a:buAutoNum type="arabicPeriod"/.test(shape)));
}

// Round trip: the list comes back as one list of the same entries, with listBullet none.
{
  const back = await fromPptx(await toPptx(none, {seed: 1}), {});
  assert.equal(back.design?.listBullet, 'none');
  const items = listItems(back);
  assert.equal(items.length, 3);
  assert.deepEqual(items.map(item => plainText(typeof item === 'object' && !Array.isArray(item) ? item.text : item)), ['Clear scope', 'Consistent measures', 'A plain entry']);
  assert.deepEqual(items.slice(0, 2).map(item => plainText(item.description)), [ITEMS[0].description, ITEMS[1].description]);
  assert.equal(items[2].description, undefined);
}

// Round trip with the hint on the slide only, and with the list's lines edited away: the shapes are not guessed into a list.
{
  const slideOnly = {slides: [{title: 'Pillars', items: ITEMS, design: {listBullet: 'none'}}]};
  const back = await fromPptx(await toPptx(slideOnly, {seed: 1}), {});
  assert.equal(listItems(back).length, 3);
  assert.equal(back.slides[0].design?.listBullet, 'none');
  const diagnostics = [];
  const xml = await slideXml(none);
  assert.ok(xml.includes('OPF list'));
  // Without provenance there is no record of the roles: unbulleted lines are text, never a guessed list.
  const plain = await fromPptx(await toPptx(none, {seed: 1, provenance: false}), {onDiagnostic: item => diagnostics.push(item)});
  assert.equal(JSON.stringify(plain).includes('"items"'), false, 'no list is read from unbulleted lines');
}
console.log('listBullet none: a:buNone export without indent, numbering kept, round trip through the line roles.');
