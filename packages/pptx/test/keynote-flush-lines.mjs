// Keynote review of 0.36 (opf#1493): each wrapped line of a text block, a heading or a caption is its own text box. 0.36.0 kept the
// whitespace that hangs at the soft wrap in the line's run and shifted the line's box by the width of that whitespace, because PowerPoint
// counts a trailing space when it aligns a paragraph. Keynote does not count it, so right-aligned and centered lines overhang by a space
// there. A left-to-right line is now written without the whitespace (it belongs to the line break, not to the line), in the unshifted box;
// PowerPoint measured the same ink edges (2026-11-25). The tag of the line keeps the whitespace as its soft boundary's separator, so import
// joins the lines as they were authored. Every right-to-left line, every line with any right-to-left run and every line of a right-to-left
// deck is exported exactly as before (pinned below by hashes of the 0.36.0 export of the same deck).
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {unzipSync, strFromU8} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';

const decoder = new TextDecoder();
const TEXT = 'The northern hubs cut the average wait at the gates from 31 to 24 minutes in the pilot, and the same scheduling rules can be rolled out to the four remaining terminals before the January peak without new hardware.';
const TITLE = 'Every line of this long title ends flush on the right edge, whichever way the title is aligned on its slide';
const HYPHENS = 'A state-of-the-art, long-term, cross-border, well-known, ever-changing, high-level, so-called, first-class, three-quarter, up-to-date, one-on-one, run-of-the-mill and made-to-order plan for the north-east terminals.';
const NO_BREAK = 'The gate\u00a0staff read the forecast at five and again at nine in the pilot, and the same scheduling rules can be rolled out to the four remaining terminals before\u00a0the January peak without\u00a0new hardware.';
const slide = (title, text, alignment, extra = {}) => ({title, blocks: [{text}], design: {titleAlignment: alignment, contentAlignment: alignment}, ...extra});
const deck = {language: 'en-US', slides: [
  slide('Left-aligned body', TEXT, 'start'),
  slide('Right-aligned body', TEXT, 'end'),
  slide('Centered body', TEXT, 'center'),
  slide(TITLE, TEXT, 'end'),
  slide(TITLE, TEXT, 'center'),
  slide('A hard line break', `${TEXT}\n${TEXT.split(' ').reverse().join(' ')}`, 'end'),
  slide('Lines that end at a hyphen', HYPHENS, 'end'),
  slide('Lines with no-break spaces', NO_BREAK, 'center'),
  {title: 'A bulleted list', blocks: [{items: [TEXT, 'A second entry that is long enough to wrap onto a second line of its own in the list']}], design: {contentAlignment: 'end'}},
  {title: 'A caption under a picture', image: {src: './assets/terminal.png', alt: 'Drawing of a container terminal'}, caption: {text: 'The North terminal at dusk in the sixth pilot week: the orange gate building on the left is where the dock scheduler forecast is shown to the gate staff, and the gray warehouse on the right holds the handheld screens.', position: 'below', align: 'center'}},
  {title: 'Emphasis across a wrap', blocks: [{text: [{text: 'The northern hubs cut the average wait '}, {text: 'at the gates from 31 to 24 minutes in the pilot, and the same scheduling rules', bold: true}, {text: ' can be rolled out to the four remaining terminals before the January peak without new hardware.'}]}], design: {contentAlignment: 'end'}},
]};
const diagnostics = [];
const bytes = await toPptx(deck, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
const parts = unzipSync(bytes);
assert.deepEqual(diagnostics.filter(diagnostic => /native-latin-slot-unavailable|provenance/.test(diagnostic.code)), [], 'no line loses its font slots or its provenance');

// The native lines of slide n, by shape name: their text, box and alignment.
function lines(n) {
  const xml = strFromU8(parts[`ppt/slides/slide${n}.xml`]);
  return [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => ({
    name: /name="([^"]*)"/.exec(shape)?.[1] ?? '', text: [...shape.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join(''),
    off: /<a:off x="(-?\d+)" y="(-?\d+)"\/>/.exec(shape)?.slice(1).map(Number), ext: /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(shape)?.slice(1).map(Number),
    align: /<a:pPr[^>]* algn="(\w+)"/.exec(shape)?.[1] ?? 'l'})).filter(shape => /^OPF (text|heading|caption) .* line \d+$/.test(shape.name));
}
const groups = n => Object.groupBy(lines(n), shape => shape.name.replace(/ line \d+$/, ''));

// 1. No wrapped line of a text block, a heading or a caption ends in whitespace, and the lines of a group share one box (none is shifted).
const wrapped = [1, 2, 3, 4, 5, 6, 7, 8, 10];
let checked = 0;
for (const n of wrapped) {
  for (const [group, members] of Object.entries(groups(n))) {
    if (members.length < 2) continue;
    for (const [index, line] of members.entries()) {
      assert.ok(!/\s$/u.test(line.text.replace(/&#160;|&nbsp;| /g, 'x')), `slide ${n}, ${group} line ${index}: written without its trailing whitespace ("${line.text.slice(-12)}")`);
      assert.deepEqual([line.off[0], line.ext], [members[0].off[0], members[0].ext], `slide ${n}, ${group} line ${index}: the box is not shifted`);
      checked++;
    }
  }
}
assert.ok(checked >= 40, `the deck wraps many lines (${checked})`);
// The right-aligned body, the centered body and the left-aligned body keep one x for every line (the unshifted box).
for (const n of [1, 2, 3]) assert.equal(new Set(lines(n).filter(line => /text/.test(line.name)).map(line => line.off[0])).size, 1, `slide ${n}: one left edge`);

// 2. The tags keep the whitespace: a soft boundary's separator is the whitespace the line was written without.
const tagsOf = () => Object.entries(parts).filter(([name]) => name.startsWith('ppt/tags/')).flatMap(([, bytes]) => [...strFromU8(bytes).matchAll(/<p:tag name="OPF_(?:TEXT|HEADING|CAPTION)_V1" val="([0-9A-F]+)"/g)]
  .map(match => JSON.parse(decoder.decode(Uint8Array.from(match[1].match(/../g).map(pair => parseInt(pair, 16)))))));
const tags = tagsOf();
const soft = tags.filter(tag => tag.boundary === 'soft');
assert.ok(soft.length >= 30, `soft boundaries are tagged (${soft.length})`);
assert.ok(soft.every(tag => /^[ ]+$/.test(tag.separator)), 'a soft boundary of a line written without its whitespace records it (a space)');
assert.ok(tags.filter(tag => tag.boundary === 'end').every(tag => (tag.separator ?? '') === ''), 'the last line of a paragraph has no separator');

// 3. Import joins the lines again: every authored text comes back exactly, whatever the alignment.
const importDiagnostics = [];
const imported = await fromPptx(bytes, {onDiagnostic: diagnostic => importDiagnostics.push(diagnostic)});
assert.deepEqual(importDiagnostics.filter(diagnostic => /reflow|invalid-.*provenance/.test(diagnostic.code)), [], 'every line group is read as an unchanged export');
const textOf = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(run => typeof run === 'string' ? run : run.text).join('') : value;
assert.equal(imported.slides.length, deck.slides.length);
deck.slides.forEach((authored, index) => {
  const back = imported.slides[index];
  assert.equal(textOf(back.title), authored.title, `slide ${index + 1}: the title is rejoined with a single space between lines`);
  if (authored.blocks?.[0]?.text !== undefined) assert.equal(textOf(back.blocks?.[0]?.text), textOf(authored.blocks[0].text), `slide ${index + 1} (${authored.title}): the paragraph is exactly the authored text`);
  if (authored.caption) assert.equal(textOf(back.caption?.text), authored.caption.text, 'the caption is exactly the authored text');
});
// A list keeps its own form (its lines are not written without their whitespace) and round-trips.
assert.deepEqual(imported.slides[8].blocks[0].items.map(textOf), deck.slides[8].blocks[0].items);
// The emphasis that crosses a wrap is one run again, not split at the whitespace.
assert.deepEqual(imported.slides[10].blocks[0].text, deck.slides[10].blocks[0].text, 'the bold run is one run with its whitespace');
// The hyphen case wraps (more than one line) and imports exactly; no line is left with trailing whitespace.
assert.ok(lines(7).length >= 3, 'the hyphenated paragraph wraps');
assert.ok(lines(7).every(line => !/\s$/.test(line.text)));

// 4. Right-to-left lines, lines with any right-to-left run and the lines of a mixed paragraph are exported exactly as 0.36.0 exported them
// (hashes of every slide part and of all the tag parts of the 0.36.0 export of this deck: Arabic and Hebrew paragraphs, headings and a
// caption, start-aligned, centered and end-aligned, and a left-to-right paragraph that holds Hebrew and Arabic phrases).
const rtlDeck = JSON.parse(fs.readFileSync(new URL('./fixtures/flush-lines-rtl.opf.json', import.meta.url), 'utf8'));
const rtlParts = unzipSync(await toPptx(rtlDeck));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);
const SLIDES = ['a451d568521a595c', '351397259ab050d3', '3f991780fe4afd07', '3853969e9b0a8189', 'd28ac0d10e60a270', '4db7a770f9fa700a', '74125080c3a96c5c'];
SLIDES.forEach((expected, index) => assert.equal(hash(rtlParts[`ppt/slides/slide${index + 1}.xml`]), expected, `slide ${index + 1} of the right-to-left deck is unchanged from 0.36.0`));
const tagNames = Object.keys(rtlParts).filter(name => name.startsWith('ppt/tags/')).sort();
const all = crypto.createHash('sha256');
for (const name of tagNames) { all.update(name); all.update(rtlParts[name]); }
assert.equal(tagNames.length, 40);
assert.equal(all.digest('hex').slice(0, 16), 'c62f594defa21495', 'the tags of the right-to-left deck are unchanged from 0.36.0');
// Their import is unchanged as well: the lines rejoin with their whitespace in the runs.
const rtlBack = await fromPptx(await toPptx(rtlDeck));
rtlDeck.slides.forEach((authored, index) => { if (authored.blocks?.[0]?.text) assert.equal(textOf(rtlBack.slides[index].blocks[0].text), authored.blocks[0].text, `right-to-left slide ${index + 1} imports as authored`); });
console.log(`Keynote flush lines: ${checked} left-to-right lines written without their trailing whitespace in unshifted boxes; ${soft.length} soft boundaries keep it in their tags; every paragraph imports as authored; the right-to-left deck's ${SLIDES.length} slides and tags are unchanged from 0.36.0.`);
