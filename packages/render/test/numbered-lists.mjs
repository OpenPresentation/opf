import assert from 'node:assert/strict';
// The decks name the gallery font scheme roboto: render with the host catalog registered.
import {toSvg, resolvePresentation} from './catalog-harness.mjs';

// RR-33: numbered lists. The preview draws the number core composed (marker.text) at core's marker geometry
// (marker.x, marker.y, marker.fontSize) with the weight and slant core measured it at; bullets are untouched.
// This test runs against the coordinated core (CI pins the numbering core), so every list entry carries marker.number.
const lines = ['Define the goal', 'Pick the owner', 'Ship it'];
const deck = {design: {fontScheme: 'roboto'}, slides: [
  {title: 'Styles', blocks: [{items: lines, numbering: 'arabic'}, {items: lines, numbering: 'roman-upper'}, {items: lines, numbering: 'alpha-lower'}]},
  {title: 'Suffix and start', items: ['Review', 'Collect', 'Resolve', 'Publish'], numbering: {style: 'alpha-upper', start: 3, suffix: 'paren'}},
  {title: 'Per level', items: ['Freeze', {text: 'Migrate', level: 1}, {text: 'Verify', level: 1}, {text: 'Sample', level: 2}, 'Switch', {text: 'Watch', level: 1}, 'Retire'],
    numbering: ['arabic', {style: 'alpha-lower', suffix: 'paren'}, {style: 'roman-lower', suffix: 'paren-both'}]},
  {title: 'Wide markers', items: ['Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen'], numbering: {style: 'roman-lower', start: 8, suffix: 'paren-both'}},
  {title: 'Bullets and restart', left: {bullets: ['First', 'Second', {text: 'Resumed', start: 6}, 'Seventh'], numbering: 'arabic'}, right: {items: ['Plain', 'Plain again']}},
  {title: 'Bold lead', items: [[{text: 'Bold', bold: true}, ' lead'], [{text: 'Italic', italic: true}, ' lead'], 'Plain lead'], numbering: 'arabic'},
]};

const attribute = (attrs, name) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
const markers = svg => [...svg.matchAll(/<text\b([^>]*\baria-hidden="true"[^>]*)>([^<]*)<\/text>/g)].map(([, attrs, text]) => ({
  text, x: +attribute(attrs, 'x'), y: +attribute(attrs, 'y'), size: +attribute(attrs, 'font-size'),
  weight: attribute(attrs, 'font-weight'), style: attribute(attrs, 'font-style'), family: attribute(attrs, 'font-family'),
}));

let drawn = 0, numbered = 0;
const resolved = resolvePresentation(deck);
for (const bound of resolved.slides) {
  const svg = toSvg(deck, bound.index + 1);
  const entries = bound.geometry.items.filter(item => item.text?.listEntries).flatMap(item => item.text.listEntries);
  const drawnMarkers = markers(svg);
  assert.equal(drawnMarkers.length, entries.length, `slide ${bound.index}: one marker per list entry`);
  for (const [index, entry] of entries.entries()) {
    const marker = drawnMarkers[index], where = `slide ${bound.index} entry ${index}`;
    assert.equal(marker.text, entry.marker.text, `${where}: the composed marker text`);
    // The SVG writes three decimals.
    assert.ok(Math.abs(marker.x - entry.marker.x) < .001, `${where}: marker x`);
    assert.ok(Math.abs(marker.y - entry.marker.y) < .001, `${where}: marker y (the first line's baseline)`);
    assert.ok(Math.abs(marker.size - entry.marker.fontSize) < .001, `${where}: marker size`);
    if (entry.marker.number) {
      numbered++;
      assert.equal(marker.text, entry.marker.number.text, `${where}: number text`);
      assert.equal(marker.weight === undefined ? 400 : +marker.weight, entry.marker.style.fontWeight, `${where}: weight core measured`);
      assert.equal(marker.style === 'italic', !!entry.marker.style.italic, `${where}: slant core measured`);
    } else {
      assert.equal(marker.text, ['•', '◦', '▪'][entry.level % 3], `${where}: bullet glyph`);
      assert.equal(marker.weight, undefined, `${where}: bullets carry no weight`);
      assert.equal(marker.style, undefined, `${where}: bullets carry no slant`);
    }
    drawn++;
  }
}
assert.equal(numbered, 9 + 4 + 7 + 8 + 4 + 3, 'every numbered entry was drawn');
assert.equal(drawn, numbered + 2);

// The numbers themselves, read from the SVG.
const text = index => markers(toSvg(deck, index + 1)).map(marker => marker.text);
assert.deepEqual(text(0), ['1.', '2.', '3.', 'I.', 'II.', 'III.', 'a.', 'b.', 'c.']);
assert.deepEqual(text(1), ['C)', 'D)', 'E)', 'F)']);
assert.deepEqual(text(2), ['1.', 'a)', 'b)', '(i)', '2.', 'a)', '3.']);
assert.deepEqual(text(3), ['(viii)', '(ix)', '(x)', '(xi)', '(xii)', '(xiii)', '(xiv)', '(xv)']);
assert.deepEqual(text(4), ['1.', '2.', '6.', '7.', '•', '•']);
assert.deepEqual(text(5), ['1.', '2.', '3.']);
const bold = markers(toSvg(deck, 6));
assert.deepEqual(bold.map(marker => [marker.weight, marker.style]), [['700', undefined], [undefined, 'italic'], [undefined, undefined]]);

// Wide markers never touch their text: the text starts after the widest marker plus a gap.
{
  const [wide] = resolved.slides[3].geometry.items.filter(item => item.text?.listEntries);
  const widest = Math.max(...wide.text.listEntries.map(entry => entry.marker.width));
  for (const entry of wide.text.listEntries) assert.ok(entry.marker.x + widest < entry.textBox.x, 'the text starts after the widest marker');
}

// The same deck renders the same through toSvg, and a deck without numbering draws bullets exactly as before.
assert.equal(toSvg(deck)[1], toSvg(deck, 2));
const plain = {design: {fontScheme: 'roboto'}, slides: [{title: 'Plain', items: ['One', {text: 'Two', level: 1}, 'Three']}]};
const withUndefined = {design: {fontScheme: 'roboto'}, slides: [{title: 'Plain', items: ['One', {text: 'Two', level: 1}, 'Three'], numbering: undefined}]};
assert.equal(toSvg(plain, 1), toSvg(withUndefined, 1));
assert.deepEqual(markers(toSvg(plain, 1)).map(marker => marker.text), ['•', '◦', '•']);

console.log(`Numbered lists passed: ${numbered} numbers drawn at core's marker geometry (text, position, size, weight, slant), bullets unchanged.`);
