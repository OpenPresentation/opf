// RR-105: every combination of a deck watermark (text, picture, none) and a slide override (text, picture, false, none)
// on two and three slides exports a package that passes the static integrity check, carries the expected native
// watermark on each slide, and imports each slide's watermark back. A deck-level text watermark with a picture override
// once numbered both kinds' tags parts from 1: two slides shared ppt/tags/opfWatermark1.xml, [Content_Types].xml
// declared it twice, and PowerPoint refused to open the file.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {strFromU8, unzipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';
import {packageIntegrity} from './helpers/package-integrity.mjs';

const image = async name => `data:image/png;base64,${(await readFile(new URL(`fixtures/images/${name}`, import.meta.url))).toString('base64')}`;
const deckMarks = {text: {text: 'DRAFT', opacity: 0.08}, picture: {src: await image('wide.png'), opacity: 0.15}, none: undefined};
const slideMarks = {text: {text: 'COPY', opacity: 0.2}, picture: {src: await image('tall.png'), opacity: 0.3}, false: false, none: undefined};
// Which slides carry the override: the second of two, the middle of three, and the outer two of three.
const patterns = [[2, [1]], [3, [1]], [3, [0, 2]]];
const kindOf = mark => !mark ? 'none' : typeof mark.text === 'string' ? 'text' : 'picture';
const shapesNamed = (xml, element, name) => (xml.match(new RegExp(`<p:${element}>[\\s\\S]*?</p:${element}>`, 'g')) ?? [])
  .filter(shape => shape.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1] === name);

let cases = 0;
for (const [deckKind, deckMark] of Object.entries(deckMarks)) {
  for (const [slideKind, slideMark] of Object.entries(slideMarks)) {
    for (const [count, overridden] of patterns) {
      const label = `deck ${deckKind}, override ${slideKind} on slides ${overridden.map(index => index + 1).join('+')} of ${count}`;
      const slides = Array.from({length: count}, (_, index) => ({
        title: `Slide ${index + 1}`, text: 'Body',
        ...(overridden.includes(index) && slideKind !== 'none' ? {design: {watermark: slideMark}} : {}),
      }));
      const deck = {...(deckMark ? {design: {watermark: deckMark}} : {}), slides};
      const expected = slides.map((_, index) => overridden.includes(index) && slideKind !== 'none' ? slideMark || undefined : deckMark);
      const bytes = await toPptx(deck, {imageFormat: 'preserve', strictAssets: true});
      const entries = unzipSync(bytes);
      assert.deepEqual(packageIntegrity(entries), [], `${label}: package integrity`);

      const tagParts = new Set();
      for (const [index, mark] of expected.entries()) {
        const xml = strFromU8(entries[`ppt/slides/slide${index + 1}.xml`]);
        const texts = shapesNamed(xml, 'sp', 'OPF watermark text'), pictures = shapesNamed(xml, 'pic', 'OPF watermark');
        assert.equal(texts.length, kindOf(mark) === 'text' ? 1 : 0, `${label}: slide ${index + 1} text watermark`);
        assert.equal(pictures.length, kindOf(mark) === 'picture' ? 1 : 0, `${label}: slide ${index + 1} picture watermark`);
        if (kindOf(mark) === 'text') assert.ok(texts[0].includes(`<a:t>${mark.text}</a:t>`), `${label}: slide ${index + 1} text`);
        // Each watermark has its own tags part, related from its own slide.
        for (const shape of [...texts, ...pictures]) {
          const id = shape.match(/<p:tags r:id="([^"]+)"/)?.[1];
          assert.ok(id, `${label}: slide ${index + 1} watermark is tagged`);
          const rels = strFromU8(entries[`ppt/slides/_rels/slide${index + 1}.xml.rels`]);
          const target = rels.match(new RegExp(`<Relationship Id="${id}"[^>]*Target="\\.\\./tags/([^"]+)"`))?.[1];
          assert.ok(target && !tagParts.has(target), `${label}: slide ${index + 1} has its own watermark tags part`);
          tagParts.add(target);
        }
      }

      // Import keeps each slide's effective watermark (the importer writes a shared one on the deck and the others per
      // slide; `false` and none are none).
      const imported = await fromPptx(bytes);
      for (const [index, mark] of expected.entries()) {
        const own = imported.slides[index].design?.watermark;
        const back = own === undefined ? imported.design?.watermark : own || undefined;
        assert.equal(kindOf(back), kindOf(mark), `${label}: slide ${index + 1} imports its watermark kind`);
        if (!mark) continue;
        assert.equal(back.opacity, mark.opacity, `${label}: slide ${index + 1} opacity`);
        if (kindOf(mark) === 'text') assert.equal(back.text, mark.text, `${label}: slide ${index + 1} text`);
        else assert.match(back.src, /^data:image\/png;base64,/, `${label}: slide ${index + 1} picture`);
      }
      cases++;
    }
  }
}
assert.equal(cases, 36);
console.log(`Watermark matrix passed: ${cases} decks pass the package integrity check, carry and import each slide's watermark.`);
