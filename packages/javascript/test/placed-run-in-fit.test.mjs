// opf#1469: a text drawn with core's run-in heading runs (item.runs) always has a fit laid out from them (richLines). Placed tiles, text
// tiles and a layout's regions re-fit a text after it was composed; each of them used to refit the authored string and left the runs on a
// plain fit, which stopped the preview, validate and the PowerPoint export with "Cannot read properties of undefined (reading 'some')".
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const TEXTS = ['a: b', 'Term: definition here', 'Label:\nbody text of it', 'Reduce retries: now', 'c'];
const PLACED = ['top:start', 'top:center', 'top:end', 'middle:center', 'bottom:start', 'bottom:end', 'top', 'bottom', 'start', 'end', 'top+middle:start', 'bottom:center'];
const problems = (name, slide, options = {}) => composeSlide(slide, options).items
  .filter((item) => item.runs && !(item.text && 'richLines' in item.text))
  .map((item) => `${name}: ${item.path} has runs and a plain fit`);

test('placed blocks (promoted regions, one tile each), blocks in a split and plain blocks keep a rich fit with their runs', () => {
  const found = [];
  for (const text of TEXTS) {
    for (const a of PLACED) for (const b of PLACED) {
      if (a !== b) found.push(...problems(`placed ${a} ${b} ${JSON.stringify(text)}`, { blocks: [{ region: a, text }, { region: b, text: 'c' }] }));
    }
    found.push(...problems(`placed three ${JSON.stringify(text)}`, { title: 'X', blocks: [{ region: 'top:start', text }, { region: 'top:end', text }, { text: 'Term: y' }] }));
    for (const count of [2, 3, 4, 5, 6]) found.push(...problems(`plain ${count} ${JSON.stringify(text)}`, { title: 'X', blocks: Array.from({ length: count }, (_, index) => ({ text: index % 2 ? text : `Alpha: ${'word '.repeat(index + 1)}` })) }));
    found.push(...problems(`one ${JSON.stringify(text)}`, { title: 'X', blocks: [{ text }] }));
    found.push(...problems(`band ${JSON.stringify(text)}`, { title: 'X', blocks: [{ text: 'Body text here for the slide that runs on. '.repeat(3) }, { text, emphasis: true }] }));
  }
  assert.deepEqual(found, []);
});

test('the blocks of every built-in layout, bound by kind and placed in each region, keep a rich fit with their runs', () => {
  const found = [];
  for (const [id, layout] of Object.entries(gallery.layouts)) {
    const regions = Object.keys(layout.regions ?? {});
    for (const text of TEXTS) {
      found.push(...problems(`layout ${id} ${JSON.stringify(text)}`, { layout: id, title: 'X', blocks: regions.map((_, index) => ({ text: index % 2 ? text : `Lead: ${'x '.repeat(5)}` })) }, { catalogs: [gallery] }));
      found.push(...problems(`layout ${id} placed ${JSON.stringify(text)}`, { layout: id, title: 'X', blocks: regions.map((region) => ({ region, text })) }, { catalogs: [gallery] }));
    }
  }
  assert.deepEqual(found, []);
});

test('the report\'s deck keeps the run-in heading as runs on a rich fit', () => {
  const result = composeSlide({ blocks: [{ region: 'top:start', text: 'a: b' }, { region: 'bottom:end', text: 'c' }] });
  const first = result.items.find((item) => item.path === 'slides.0.blocks.0.text');
  assert.deepEqual(first.runs, [{ text: 'a:', bold: true }, ' b']);
  assert.ok('richLines' in first.text);
  assert.equal('richLines' in result.items.find((item) => item.path === 'slides.0.blocks.1.text').text, false);
});
