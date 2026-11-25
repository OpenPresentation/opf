// The whitespace that ends a soft-wrapped line hangs at the wrap (core's TextLineSource.hang). PowerPoint counts the whitespace at the end
// of a paragraph in its alignment, so a measured line (one paragraph, no wrap) that keeps its space is written that much further toward
// its end edge (half of it when centered): its glyphs then end on the box edge, as the preview draws them. A heading of fixed lines does
// it with each paragraph's margin. The text of every line is unchanged, and the deck reads back as authored.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {resolvePresentation} from '@openpresentation/opf-render';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';
import {gallery} from '@openpresentation/gallery';

const fonts = await loadFonts();
const base = {seed: 1, timestamp: '2026-11-24T00:00:00Z', zipDate: '2026-11-24T00:00:00Z', fonts};
const heading = 'Scale the pilot to four teams in January.';
const body = 'A paragraph of body text that is long enough to wrap onto a second and a third line inside its text box, so that every wrapped line ends in a space that hangs at the wrap.';
const deck = {design: {fontScheme: 'roboto'}, slides: [
  {layout: 'statement', title: heading, design: {titleAlignment: 'end'}},
  {layout: 'statement', title: heading, design: {titleAlignment: 'center'}},
  {title: 'Right-aligned body', design: {titleAlignment: 'end', contentAlignment: 'end'}, blocks: [{text: body}]},
  {title: 'Centered body', design: {titleAlignment: 'center', contentAlignment: 'center'}, blocks: [{text: body}]},
  {title: 'Start-aligned body', blocks: [{text: body}]},
]};
const EMU = 9525;
const shapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape);
const named = (xml, name) => shapes(xml).find(shape => shape.includes(`name="${name}"`));
const frame = shape => { const [, x, , cx] = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/.exec(shape).map(Number); return {x: x / EMU, width: cx / EMU}; };
const texts = shape => [...shape.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)].map(([p]) => [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join(''));
const margins = (shape, name) => [...shape.matchAll(/<a:pPr\b[^>]*>/g)].map(([pPr]) => Number(new RegExp(`\\b${name}="(-?\\d+)"`).exec(pPr)?.[1] ?? 0) / EMU);
const near = (a, b, message, tolerance = .02) => assert.ok(Math.abs(a - b) <= tolerance, `${message}: ${a} against ${b}`);

await fonts.ensure(deck);
const bound = resolvePresentation(deck, {fonts, catalogs: [gallery]}).slides;
const fit = (slide, path) => bound[slide].geometry.items.find(item => item.path === path);
const bytes = new Uint8Array(await toPptx(deck, base)), entries = unzipSync(bytes);
const slide = index => strFromU8(entries[`ppt/slides/slide${index + 1}.xml`]);
let cases = 0;

// Body text, one line box per line: the box of a line that ends in a hanging space is moved by it (end) or half of it (center).
for (const [index, factor] of [[2, 1], [3, .5], [4, 0]]) {
  const item = fit(index, `slides.${index}.blocks.0.text`), placed = item.text.placement.lines;
  assert.ok(placed.length >= 3);
  assert.ok(placed.slice(0, -1).every(line => line.hang > 0), 'every wrapped line ends in a hanging space');
  for (const [line, place] of placed.entries()) {
    const shape = named(slide(index), `OPF text slides.${index}.blocks.0.text line ${line}`), box = frame(shape);
    assert.equal(texts(shape)[0], item.text.lines[line], 'the line keeps its text, the hanging space included');
    near(box.width, item.box.width, 'the box keeps its width');
    near(box.x + box.width * factor, place.x + place.width * factor, 'the paragraph is anchored where core placed the line with its space');
    // PowerPoint anchors the paragraph with its trailing space; its glyphs then end (or are centered) on the box's own anchor.
    // (A start-aligned line starts where core placed it, its ink inside the box, as before.)
    if (factor) near(box.x + box.width * factor - (place.hang ?? 0) * factor, item.box.x + item.box.width * factor, 'the glyphs are on the edge', .5);
  }
  cases++;
}

// A heading of fixed lines (one Title shape, one paragraph per line): the shape reaches the hang past the edge and every other line's
// paragraph is that much in from it (marR when end-aligned; marL and marR when centered).
for (const [index, factor] of [[0, 1], [1, .5]]) {
  const item = fit(index, `slides.${index}.title`), [first, second] = item.text.placement.lines;
  assert.ok(first.hang > 10 && !second.hang);
  const shape = named(slide(index), `OPF heading slides.${index}.title line 0`), box = frame(shape);
  assert.deepEqual(texts(shape), ['Scale the pilot to four ', 'teams in January.']);
  if (factor === 1) {
    const [end1, end2] = margins(shape, 'marR');
    near(box.x + box.width, first.x + first.width, 'the shape ends where the first line with its space does');
    near(end1, 0, 'the first paragraph has no margin');
    near(box.x + box.width - end2, second.x + second.width, 'the second paragraph ends where its line does');
    near(end2, first.hang, 'by the hang', .5);
  } else {
    const [left1, left2] = margins(shape, 'marL'), [right1, right2] = margins(shape, 'marR');
    near((box.x + left1 + box.x + box.width - right1) / 2, first.x + first.width / 2, 'the first paragraph is centered where its line with its space is');
    near((box.x + left2 + box.x + box.width - right2) / 2, second.x + second.width / 2, 'the second paragraph is centered where its line is');
  }
  cases++;
}

// Round trip: the deck reads back as authored, the hanging spaces included once.
{
  const value = await fromPptx(bytes);
  assert.equal(value.slides[0].title, heading);
  assert.equal(value.slides[1].title, heading);
  for (const index of [2, 3, 4]) assert.equal(value.slides[index].text ?? value.slides[index].blocks?.[0]?.text, body);
  // Exported again, the lines are the same, in the same places.
  const again = unzipSync(new Uint8Array(await toPptx(value, base)));
  for (const index of [0, 2]) {
    const before = shapes(slide(index)).map(shape => [frame(shape), texts(shape)]), after = shapes(strFromU8(again[`ppt/slides/slide${index + 1}.xml`])).map(shape => [frame(shape), texts(shape)]);
    assert.deepEqual(after, before, `slide ${index + 1} exports the same lines again`);
  }
  cases++;
}

// Right to left: the whitespace that hangs at a soft wrap is on the left of the line. A right-aligned paragraph (PowerPoint does not count
// whitespace at the edges of a right-aligned right-to-left line) has its box on the edge, also when the line's space did not fit in the box
// (it was a space short before). A centered or left-aligned one is anchored by its glyphs too, as before: whether PowerPoint counts the
// whitespace at the left end of such a paragraph is not measured.
{
  const hebrew = 'פסקה של טקסט גוף שהיא ארוכה מספיק כדי לגלוש לשורה שנייה ושלישית בתוך תיבת הטקסט שלה, כך שכל שורה עוטפת מסתיימת ברווח.';
  const rtlDeck = {language: 'he', design: {fontScheme: 'roboto'}, slides: [
    {title: 'ימין', blocks: [{text: hebrew}]},
    {title: 'מרכז', design: {contentAlignment: 'center'}, blocks: [{text: hebrew}]},
    {title: 'שמאל', design: {contentAlignment: 'end'}, blocks: [{text: hebrew}]},
  ]};
  await fonts.ensure(rtlDeck);
  const rtlBound = resolvePresentation(rtlDeck, {fonts, catalogs: [gallery]}).slides;
  const rtlBytes = new Uint8Array(await toPptx(rtlDeck, base)), rtlEntries = unzipSync(rtlBytes);
  for (const [index, factor] of [[0, 1], [1, .5], [2, 0]]) {
    const path = `slides.${index}.blocks.0.text`, item = rtlBound[index].geometry.items.find(entry => entry.path === path), placed = item.text.placement.lines;
    if (!index) assert.ok(item.text.sourceLines.some(line => line.hang && line.width < line.advance - .01), 'a line whose space did not fit (RR-17)');
    const xml = strFromU8(rtlEntries[`ppt/slides/slide${index + 1}.xml`]);
    for (const [line, place] of placed.entries()) {
      const shape = named(xml, `OPF text ${path} line ${line}`), box = frame(shape);
      assert.equal(texts(shape)[0], item.text.lines[line], 'the line keeps its text');
      // The glyphs of every line share one anchor, the whitespace hanging on their left, and the paragraph is anchored there.
      const glyphs = place.x + (place.hang ?? 0) + (place.width - (place.hang ?? 0)) * factor;
      near(box.x + box.width * factor, glyphs, 'the paragraph is anchored by its glyphs');
      near(glyphs, placed.at(-1).x + placed.at(-1).width * factor, 'glyphs aligned', .5);
      if (factor === 1) near(box.x + box.width, item.box.x + item.box.width, 'a right-aligned line box ends on the edge', .5);
    }
  }
  const value = await fromPptx(rtlBytes);
  for (const index of [0, 1, 2]) assert.equal(value.slides[index].text ?? value.slides[index].blocks?.[0]?.text, hebrew, 'reads back as authored');
  cases++;
}
console.log(`aligned line hang (pptx): ${cases} cases`);
