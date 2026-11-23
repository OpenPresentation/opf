// v0.35: a deck written in Arabic or Hebrew that declares no language is drawn as a deck that declares it: right to left, with
// the script's default fonts. The picture differs from the declared deck's only in the `lang` attributes, which it does not
// claim. A declared language wins, and a slide with a phrase of the script in English text stays left to right.
import assert from 'node:assert/strict';
import {toSvg} from './catalog-harness.mjs';

const ARABIC = 'نراجع اليوم نتائج الربع الثالث وخطة العام المقبل', HEBREW = 'היום נסקור את תוצאות הרבעון השלישי';
const slide = text => ({id: 'a', title: text, text: `${text}. Acme Cloud 2.0`, bullets: [text, text]});
const deck = (text, language) => ({name: 'v0.35', ...(language ? {language} : {}), slides: [slide(text)]});
const unmarked = svg => svg.replace(/ (?:xml:)?lang="[^"]*"/g, '');
const anchors = svg => [...svg.matchAll(/<text\b[^>]*text-anchor="(start|middle|end)"/g)].map(match => match[1]);

for (const [tag, text] of [['ar', ARABIC], ['he', HEBREW]]) {
  const [read] = toSvg(deck(text)), [named] = toSvg(deck(text, tag)), [english] = toSvg(deck(text, 'en-US'));
  assert.doesNotMatch(read, /<svg\b[^>]* lang=/, `${tag}: the picture claims no language the deck did not declare`);
  assert.match(named, new RegExp(`<svg\\b[^>]* lang="${tag}"`), `${tag}: the declared deck says its language`);
  assert.equal(unmarked(read), unmarked(named), `${tag}: drawn as the deck that declares the language`);
  assert.notEqual(unmarked(read), unmarked(english), `${tag}: not drawn as an English deck`);
  // Right to left: the lines of a right-to-left slide are anchored at their end, the right edge.
  assert.ok(anchors(read).includes('end'), `${tag}: lines are anchored at the right edge (${[...new Set(anchors(read))].join(', ')})`);
  assert.ok(!anchors(english).includes('end'), `${tag}: an English deck with the same text keeps the left edge`);
}

// Each slide is read on its own: in an English deck with one Arabic slide, only that slide is right to left.
{
  const mixed = {name: 'Mixed', slides: [{id: 'a', title: 'Quarterly review', text: 'Revenue grew twelve percent.'}, {...slide(ARABIC), id: 'b'}, {id: 'c', title: 'Launch plan', text: ['We call the launch ', {text: 'خطة النمو', bold: true}, ' in the Gulf markets.']}]};
  const svgs = toSvg(mixed);
  assert.deepEqual(svgs.map(svg => anchors(svg).includes('end')), [false, true, false]);
  const [alone] = toSvg({name: 'Mixed', language: 'ar', slides: [{...slide(ARABIC), id: 'b'}]});
  assert.equal(unmarked(svgs[1]).replace(/aria-label="[^"]*"/g, ''), unmarked(alone).replace(/aria-label="[^"]*"/g, ''), 'the Arabic slide is drawn as in an Arabic deck');
}

console.log(JSON.stringify({test: 'language-from-text', passed: true}));
