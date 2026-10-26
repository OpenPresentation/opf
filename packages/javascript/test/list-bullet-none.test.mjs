import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, fitList} from '../dist/composition.js';
import {validate} from '../dist/index.js';

// design.listBullet: "none" draws no marker and no hanging indent. A label and its description keep their two roles
// (a 32 px label and a smaller muted description), and a numbered list keeps its numbers.
const LABELLED = [
  {text: 'Clear scope', description: 'Two teams and one workflow keep the pilot focused.'},
  {text: 'Consistent measures', description: 'Track completion and task time against a baseline.'},
];
const layout = design => ({id: 'labels', design, regions: [{name: 'title'}, {name: 'body', accepts: ['list'], flow: 'none'}]});
const listOf = composed => composed.items.find(item => item.field === 'items');

test('none draws no marker geometry and no indent; labels and descriptions keep their roles', () => {
  const plain = listOf(composeSlide({title: 'T', items: LABELLED}));
  const none = listOf(composeSlide({title: 'T', items: LABELLED, design: {listBullet: 'none'}}));
  for (const entry of plain.text.listEntries) assert.equal(entry.marker.none, undefined);
  assert.deepEqual(plain.text.listEntries.map(entry => entry.marker.text), ['•', '•']);
  for (const entry of none.text.listEntries) {
    assert.equal(entry.marker.none, true);
    assert.equal(entry.marker.text, '');
    assert.equal(entry.marker.indent, 0);
    // No hanging indent: the text and its description start at the list box's left edge.
    assert.equal(entry.textBox.x, none.box.x);
    assert.equal(entry.descriptionBox.x, none.box.x);
    assert.equal(entry.bulletImage, undefined);
  }
  // Same two roles as with bullets: a label above a smaller description, one size across the list.
  assert.deepEqual(none.text.listEntries.map(entry => entry.text.fontSize), plain.text.listEntries.map(entry => entry.text.fontSize));
  for (const entry of none.text.listEntries) assert.ok(entry.description.fontSize < entry.text.fontSize);
  // The bullet list is indented by one marker width (1.1 em); the unmarked list is not.
  const [bulleted] = plain.text.listEntries, [bare] = none.text.listEntries;
  assert.ok(Math.abs(bulleted.textBox.x - plain.box.x - bulleted.text.fontSize * 1.1) < 1e-6);
  assert.equal(bare.textBox.x, none.box.x);
  assert.ok(bare.textBox.width > bulleted.textBox.width);
});

test('none comes from the layout, the deck or the slide, in that order of precedence', () => {
  const slide = {title: 'T', items: LABELLED, layout: 'labels'};
  const markers = (composed) => listOf(composed).text.listEntries.map(entry => entry.marker.none === true);
  assert.deepEqual(markers(composeSlide(slide, {layout: layout({listBullet: 'none'})})), [true, true]);
  assert.deepEqual(markers(composeSlide(slide, {layout: layout({listBullet: 'none'}), presentation: {design: {listBullet: 'character'}}})), [false, false]);
  assert.deepEqual(markers(composeSlide({...slide, design: {listBullet: 'none'}}, {layout: layout({}), presentation: {design: {listBullet: 'character'}}})), [true, true]);
  assert.deepEqual(markers(composeSlide(slide, {layout: layout({}), presentation: {design: {listBullet: 'none'}}})), [true, true]);
});

test('none keeps nested levels indented and a numbered list keeps its numbers', () => {
  const nested = listOf(composeSlide({title: 'T', items: ['One', {text: 'Child', level: 1}], design: {listBullet: 'none'}})).text.listEntries;
  assert.equal(nested[0].textBox.x < nested[1].textBox.x, true);
  assert.ok(Math.abs(nested[1].textBox.x - nested[0].textBox.x - nested[1].text.fontSize * 1.1) < 1e-6);
  const numbered = listOf(composeSlide({title: 'T', items: LABELLED, numbering: 'arabic', design: {listBullet: 'none'}})).text.listEntries;
  assert.deepEqual(numbered.map(entry => entry.marker.text), ['1.', '2.']);
  assert.equal(numbered[0].marker.none, undefined);
  assert.ok(numbered[0].marker.indent > 0);
});

test('none never draws a picture bullet, and needs no logo', () => {
  const composed = composeSlide({title: 'T', items: LABELLED, design: {listBullet: 'none'}}, {presentation: {design: {listBullet: 'none'}, organization: {id: 'acme', name: 'Acme', logo: {icon: 'data:image/png;base64,AAAA'}}}});
  assert.equal(listOf(composed).bulletImage, undefined);
  assert.deepEqual(composed.diagnostics, []);
});

test('fitList option bullet none is the same list without markers', () => {
  const box = {x: 10, y: 20, width: 600, height: 400};
  const fit = fitList(LABELLED, box, 32, 16, {style: {fontFamily: 'sans-serif', fontWeight: 400}, bullet: 'none'});
  assert.equal(fit.overflow, false);
  assert.ok(fit.listEntries.every(entry => entry.marker.none && entry.textBox.x === 10));
});

test('validation: listBullet none is a schema value on the deck and the slide', () => {
  const deck = {design: {listBullet: 'none'}, slides: [{title: 'T', items: ['a'], design: {listBullet: 'none'}}]};
  assert.equal(validate(deck).valid, true, JSON.stringify(validate(deck)));
  const bad = {design: {listBullet: 'hidden'}, slides: [{title: 'T', items: ['a']}]};
  assert.equal(validate(bad).valid, false);
});
