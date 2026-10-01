import assert from 'node:assert/strict';
import test from 'node:test';
import {composeSlide, fitList, formatListNumber, listNumbers, resolveNumbering, sliceNumberedItems, MAX_NUMBERING_VALUE} from '../dist/composition.js';
import {paginateSlide} from '../dist/pagination.js';
import {validatePresentation} from '../dist/validator.js';
import * as root from '../dist/index.js';

const measure = {measure: (text, size, style) => Array.from(text).length * size * (style.fontWeight === 700 ? .6 : .5)};
const options = {style: {fontFamily: 'Base', fontWeight: 400, path: 'slides.0.items'}, textMeasurement: measure};
const box = {x: 40, y: 30, width: 600, height: 900};
const doc = slides => ({slides});
const errors = value => validatePresentation(doc([value])).errors;

test('formatListNumber draws every style and suffix as PowerPoint does', () => {
  assert.equal(formatListNumber(7), '7.');
  assert.equal(formatListNumber(7, 'arabic', 'paren'), '7)');
  assert.equal(formatListNumber(7, 'arabic', 'paren-both'), '(7)');
  assert.equal(formatListNumber(4, 'roman-lower'), 'iv.');
  assert.equal(formatListNumber(9, 'roman-upper', 'paren'), 'IX)');
  assert.equal(formatListNumber(1994, 'roman-upper'), 'MCMXCIV.');
  assert.equal(formatListNumber(3999, 'roman-lower'), 'mmmcmxcix.');
  assert.equal(formatListNumber(3, 'alpha-upper'), 'C.');
  assert.equal(formatListNumber(3, 'alpha-lower', 'paren-both'), '(c)');
  // The alphabet repeats its letter rather than carrying: z, aa, bb, ..., zz, aaa.
  assert.deepEqual([25, 26, 27, 28, 52, 53].map(n => formatListNumber(n, 'alpha-lower', 'paren')), ['y)', 'z)', 'aa)', 'bb)', 'zz)', 'aaa)']);
  assert.equal(formatListNumber(4000, 'roman-upper'), '4000.', 'Roman numerals stop at 3999 and fall back to arabic');
  for (const bad of [0, -1, 1.5, Number.NaN]) assert.throws(() => formatListNumber(bad), RangeError);
  assert.throws(() => formatListNumber(1, 'greek'), RangeError);
  assert.throws(() => formatListNumber(1, 'arabic', 'colon'), RangeError);
});

test('resolveNumbering applies defaults and rejects what the schema rejects', () => {
  assert.deepEqual(resolveNumbering('roman-lower'), [{style: 'roman-lower', start: 1, suffix: 'period'}]);
  assert.deepEqual(resolveNumbering({start: 5}), [{style: 'arabic', start: 5, suffix: 'period'}]);
  assert.deepEqual(resolveNumbering(['arabic', {style: 'alpha-lower', suffix: 'paren'}]).map(level => level.style), ['arabic', 'alpha-lower']);
  for (const bad of ['', 'greek', {style: 'greek'}, {start: 0}, {start: 1.5}, {start: MAX_NUMBERING_VALUE + 1}, {suffix: 'colon'}, [], Array(10).fill('arabic'), 7, null])
    assert.throws(() => resolveNumbering(bad), e => e instanceof RangeError || e instanceof TypeError, JSON.stringify(bad));
});

test('listNumbers counts consecutive entries per level and restarts deeper levels', () => {
  const items = ['a', {text: 'b', level: 1}, {text: 'c', level: 1}, {text: 'd', level: 2}, 'e', {text: 'f', level: 1}, {text: 'g', level: 2}, 'h'];
  const numbers = listNumbers(items, ['arabic', 'alpha-lower', 'roman-lower']);
  assert.deepEqual(numbers.map(n => n.text), ['1.', 'a.', 'b.', 'i.', '2.', 'a.', 'i.', '3.']);
  assert.deepEqual(numbers.map(n => n.value), [1, 1, 2, 1, 2, 1, 1, 3]);
  assert.deepEqual(numbers.map(n => n.level), [0, 1, 1, 2, 0, 1, 2, 0]);
  // A deeper entry between two entries of one level does not interrupt that level.
  assert.deepEqual(listNumbers(['a', {text: 'x', level: 1}, 'b'], 'arabic').map(n => n.value), [1, 1, 2]);
  // Starting below the top level counts from that level's start.
  assert.deepEqual(listNumbers([{text: 'x', level: 2}, {text: 'y', level: 2}], {start: 4}).map(n => n.value), [4, 5]);
});

test('listNumbers: the last level entry repeats, per-level start and suffix apply, and an item start restarts the count', () => {
  const items = ['a', {text: 'b', level: 1}, {text: 'c', level: 2}, {text: 'd', level: 3}, {text: 'e', level: 3}];
  assert.deepEqual(listNumbers(items, ['arabic', {style: 'alpha-upper', start: 3, suffix: 'paren'}]).map(n => n.text), ['1.', 'C)', 'C)', 'C)', 'D)']);
  const restart = ['a', 'b', {text: 'c', start: 10}, 'd', {text: 'e', level: 1}, {text: 'f', level: 1, start: 7}, 'g'];
  assert.deepEqual(listNumbers(restart, {style: 'roman-upper', suffix: 'paren-both'}).map(n => n.text), ['(I)', '(II)', '(X)', '(XI)', '(I)', '(VII)', '(XII)']);
  assert.deepEqual(listNumbers([], 'arabic'), []);
  assert.throws(() => listNumbers([{text: 'x', level: -1}], 'arabic'), RangeError);
  assert.throws(() => listNumbers([{text: 'x', start: 0}], 'arabic'), RangeError);
});

test('listNumbers reports Roman numerals past 3999 as an arabic adaptation', () => {
  const [one, over] = listNumbers([{text: 'a'}, {text: 'b', start: 4000}], 'roman-upper');
  assert.equal(one.adapted, undefined);
  assert.deepEqual({text: over.text, style: over.style, adapted: over.adapted, value: over.value}, {text: '4000.', style: 'arabic', adapted: 'roman-range', value: 4000});
});

test('sliceNumberedItems keeps the numbers of the whole list on a continuation', () => {
  const items = ['a', 'b', {text: 'x', level: 1}, {text: 'y', level: 1}, 'c', {text: 'z', level: 1}, 'd'];
  const numbering = ['arabic', 'alpha-lower'];
  const whole = listNumbers(items, numbering).map(n => n.text);
  for (let from = 0; from < items.length; from++) {
    const part = sliceNumberedItems(items, numbering, from, items.length);
    assert.deepEqual(listNumbers(part, numbering).map(n => n.text), whole.slice(from), `slice from ${from}`);
  }
  assert.deepEqual(sliceNumberedItems(items, numbering, 0), items, 'a slice from the start needs no overrides');
  assert.equal(items[2].start, undefined, 'the source list is not modified');
});

test('fitList: a numbered list draws its numbers at the bullet geometry; an unnumbered list does not move', () => {
  const items = ['One', 'Two', 'Three'];
  const bullets = fitList(items, box, 20, 20, options), same = fitList(items, box, 20, 20, {...options, numbering: undefined});
  assert.deepEqual(same, bullets, 'numbering: undefined is the bullet list');
  assert.deepEqual(bullets.listEntries.map(e => e.marker.text), ['•', '•', '•']);
  const numbered = fitList(items, box, 20, 20, {...options, numbering: 'roman-lower'});
  assert.deepEqual(numbered.listEntries.map(e => e.marker.text), ['i.', 'ii.', 'iii.']);
  assert.deepEqual(numbered.listEntries.map(e => e.marker.number.value), [1, 2, 3]);
  for (const [index, entry] of numbered.listEntries.entries()) {
    const bullet = bullets.listEntries[index];
    assert.equal(entry.marker.x, bullet.marker.x, 'the marker starts where the bullet does');
    assert.equal(entry.marker.y, bullet.marker.y, 'on the same baseline');
    assert.equal(entry.marker.fontSize, bullet.marker.fontSize);
  }
  assert.equal(numbered.fontSize, 20);
});

test('fitList: the hanging indent grows with the widest marker so wide markers never reach their text', () => {
  const nine = Array.from({length: 9}, (_, i) => `Item ${i + 1}`), twelve = Array.from({length: 12}, (_, i) => `Item ${i + 1}`);
  const base = fitList(nine, box, 20, 20, options).listEntries[0].marker.indent;
  assert.equal(base, 22);
  const small = fitList(nine, box, 20, 20, {...options, numbering: 'arabic'});
  assert.equal(small.listEntries[0].marker.indent, 2 * 20 * .5 + 20 * .3, 'single-digit markers: the widest marker (9.) plus 0.3 em');
  assert.ok(small.listEntries[0].marker.indent >= base, 'never below the bullet indent');
  const wide = fitList(twelve, box, 20, 20, {...options, numbering: 'arabic'});
  const widest = Math.max(...wide.listEntries.map(e => e.marker.width));
  assert.equal(widest, 3 * 20 * .5, '"10." is three characters');
  for (const entry of wide.listEntries) {
    assert.equal(entry.marker.indent, widest + 20 * .3, 'one indent for the whole list');
    assert.equal(entry.textBox.x, box.x + entry.marker.indent);
    assert.ok(entry.marker.x + entry.marker.width + 20 * .3 <= entry.textBox.x + 1e-9, 'the gap after the widest marker is kept');
  }
  const romans = fitList(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(text => ({text})), box, 20, 20, {...options, numbering: 'roman-lower'});
  assert.equal(romans.listEntries[7].marker.text, 'viii.');
  assert.equal(romans.listEntries[0].marker.indent, 5 * 20 * .5 + 20 * .3, 'the widest marker, viii., sets it for every entry');
  // Nested levels step by the same indent.
  const nested = fitList(['a', {text: 'b', level: 1}], box, 20, 20, {...options, numbering: ['roman-lower', 'alpha-lower']});
  assert.equal(nested.listEntries[1].marker.x, box.x + nested.listEntries[0].marker.indent);
});

test('fitList: the number takes the weight of the first run, as a native auto-number does', () => {
  const entries = fitList([[{text: 'Bold lead', bold: true}, ' and more'], 'Plain'], box, 20, 20, {...options, numbering: 'arabic'}).listEntries;
  assert.equal(entries[0].marker.style.fontWeight, 700);
  assert.equal(entries[1].marker.style.fontWeight, 400);
  assert.equal(entries[0].marker.width, 2 * 20 * .6);
});

test('fitList: numbering beats the picture bullet and rejects invalid values', () => {
  const bulletImage = {source: 'data:image/png;base64,AA==', path: 'design.logo'};
  const numbered = fitList(['a'], box, 20, 20, {...options, numbering: 'arabic', bulletImage}).listEntries[0];
  assert.equal(numbered.bulletImage, undefined);
  assert.equal(fitList(['a'], box, 20, 20, {...options, bulletImage}).listEntries[0].bulletImage, bulletImage);
  assert.throws(() => fitList(['a'], box, 20, 20, {...options, numbering: 'greek'}), RangeError);
});

test('composeSlide numbers items and bullets from the payload field, in every placement', () => {
  const slides = {
    root: {items: ['a', 'b'], numbering: 'alpha-upper'},
    bullets: {bullets: ['a', 'b'], numbering: {style: 'roman-lower', start: 4, suffix: 'paren-both'}},
    block: {blocks: [{items: ['a', 'b'], numbering: 'arabic'}, {items: ['x', 'y']}]},
    region: {left: {items: ['a', 'b'], numbering: ['arabic']}, right: {items: ['x']}},
    sibling: {items: ['a'], bullets: ['b'], numbering: 'arabic'},
  };
  const markers = slide => composeSlide(slide).items.filter(item => item.text?.listEntries).map(item => item.text.listEntries.map(e => e.marker.text));
  assert.deepEqual(markers(slides.root), [['A.', 'B.']]);
  assert.deepEqual(markers(slides.bullets), [['(iv)', '(v)']]);
  assert.deepEqual(markers(slides.block), [['1.', '2.'], ['•', '•']]);
  assert.deepEqual(markers(slides.region), [['1.', '2.'], ['•']]);
  assert.deepEqual(markers(slides.sibling), [['1.'], ['1.']], 'a payload with both fields numbers each list');
  const item = composeSlide(slides.root).items.find(i => i.field === 'items');
  assert.equal(item.payload.numbering, 'alpha-upper');
});

test('composeSlide: a deck without numbering composes exactly as before', () => {
  const slide = {title: 'Plan', items: [{text: 'a', description: 'b'}, {text: 'c', level: 1}], design: {listBullet: 'image'}};
  const withField = composeSlide({...slide, numbering: undefined});
  assert.deepEqual(withField, composeSlide(slide));
  const item = composeSlide(slide).items.find(i => i.field === 'items');
  assert.deepEqual(Object.keys(item.payload), ['type', 'items']);
  assert.ok(item.text.listEntries.every(e => e.marker.number === undefined && e.marker.width === undefined));
  assert.deepEqual(item.text.listEntries.map(e => e.marker.text), ['•', '◦']);
});

test('composeSlide reports Roman numerals past 3999 without failing a strict slide', () => {
  const slide = {items: [{text: 'a', start: 4000}], numbering: 'roman-upper', composition: {overflow: 'error'}};
  const result = composeSlide(slide);
  const diagnostic = result.diagnostics.find(d => d.code === 'numbering-adapted');
  assert.ok(diagnostic);
  assert.equal(diagnostic.path, 'slides.0.items.0.text');
  assert.equal(result.items.find(i => i.field === 'items').text.listEntries[0].marker.text, '4000.');
});

test('validation: numbering forms are accepted and bad ones are rejected', () => {
  for (const numbering of ['arabic', 'roman-upper', 'roman-lower', 'alpha-upper', 'alpha-lower', {}, {style: 'roman-lower'}, {style: 'arabic', start: 32767, suffix: 'paren-both'}, ['arabic', {style: 'alpha-lower', start: 2}], Array(9).fill('arabic')])
    assert.deepEqual(errors({items: ['a'], numbering}), [], JSON.stringify(numbering));
  for (const numbering of ['greek', 3, null, [], Array(10).fill('arabic'), {style: 'greek'}, {start: 0}, {start: 32768}, {start: 1.5}, {suffix: 'colon'}, {extra: 1}, [{start: 0}], [['arabic']]])
    assert.ok(errors({items: ['a'], numbering}).length > 0, JSON.stringify(numbering));
  assert.deepEqual(errors({bullets: ['a'], numbering: 'arabic'}), []);
  assert.deepEqual(errors({blocks: [{items: ['a'], numbering: 'arabic'}]}), []);
  assert.deepEqual(errors({left: {bullets: ['a'], numbering: 'alpha-lower'}}), []);
  assert.deepEqual(errors({items: [{text: 'a', start: 3}, {text: 'b'}], numbering: 'arabic'}), []);
  assert.ok(errors({items: [{text: 'a', start: 0}], numbering: 'arabic'}).length);
});

test('validation: numbering needs a list, and counts stay inside the native range', () => {
  const messages = value => errors(value).map(e => `${e.path}: ${e.message}`);
  assert.deepEqual(messages({text: 'a', numbering: 'arabic'}), ["/slides/0/numbering: numbering applies to 'items' or 'bullets'; this payload has neither"]);
  assert.deepEqual(messages({image: 'a.png', numbering: 'arabic'}).length, 1);
  assert.deepEqual(messages({blocks: [{text: 'a'}], numbering: 'arabic'}).filter(m => m.includes('numbering applies')).length, 1, 'a group cannot be numbered');
  assert.deepEqual(messages({left: {text: 'a', numbering: 'arabic'}}), ["/slides/0/left/numbering: numbering applies to 'items' or 'bullets'; this payload has neither"]);
  const tooFar = messages({items: ['a', 'b', 'c'], numbering: {start: 32766}});
  assert.equal(tooFar.length, 1);
  assert.match(tooFar[0], /\/slides\/0\/items: numbering counts up to 32768, past the native limit of 32767/);
  assert.deepEqual(errors({items: ['a', 'b'], numbering: {start: 32766}}), []);
});

test('validation: an entry start without numbering is a warning', () => {
  const result = validatePresentation(doc([{items: [{text: 'a', start: 2}]}]));
  assert.equal(result.valid, true);
  assert.deepEqual(result.warnings.map(w => w.path), ['/slides/0/items']);
  assert.match(result.warnings[0].message, /no effect without a 'numbering'/);
  assert.deepEqual(validatePresentation(doc([{items: [{text: 'a', start: 2}], numbering: 'arabic'}])).warnings, []);
});

test('pagination keeps the numbers of a numbered list across continuation pages', () => {
  const items = Array.from({length: 40}, (_, i) => ({text: `Entry ${i + 1} with a little more words`, level: i % 7 === 3 ? 1 : 0}));
  const slide = {title: 'Plan', items, numbering: ['arabic', {style: 'alpha-lower', suffix: 'paren'}]};
  const paged = paginateSlide(slide);
  assert.ok(paged.slides.length > 1);
  const whole = listNumbers(items, slide.numbering).map(n => n.text);
  const pageTexts = paged.slides.flatMap(page => listNumbers(page.items, page.numbering).map(n => n.text));
  assert.deepEqual(pageTexts, whole);
  assert.equal(paged.slides[0].items.some(item => item.start !== undefined), false, 'the first page needs no overrides');
  assert.ok(paged.slides.slice(1).every(page => page.numbering === slide.numbering || JSON.stringify(page.numbering) === JSON.stringify(slide.numbering)));
  assert.deepEqual(paged.slides.flatMap(page => page.items.map(item => typeof item === 'string' ? item : item.text)), items.map(item => item.text));
  for (const page of paged.slides) assert.equal(validatePresentation(doc([page])).valid, true);
  // An unnumbered list paginates as before: no field, no overrides.
  const plain = paginateSlide({title: 'Plan', items});
  assert.deepEqual(plain.slides.flatMap(page => page.items), items);
});

test('the package root exports the numbering helpers', () => {
  for (const name of ['formatListNumber', 'listNumbers', 'resolveNumbering', 'numberingAtLevel', 'sliceNumberedItems', 'NUMBERING_STYLES', 'NUMBERING_SUFFIXES', 'MAX_NUMBERING_VALUE', 'MAX_ROMAN_VALUE'])
    assert.notEqual(root[name], undefined, name);
});
