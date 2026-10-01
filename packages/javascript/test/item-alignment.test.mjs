import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide} from '../dist/composition.js';

// Renderer and PPTX anchor native and preview text to item.alignment, so the
// value must follow the same resolution that core uses for placement.
const slide = {title: 'Quarterly review', subtitle: 'Supporting context', blocks: [{text: 'Body copy'}, {metric: {value: 42, label: 'Accounts'}}, {items: ['First', 'Second']}]};
const alignments = composition => composition.items.map(item => [item.field, item.alignment]);

test('composed items default to left alignment', () => {
  assert.deepEqual(alignments(composeSlide(slide)), [['title', 'left'], ['subtitle', 'left'], ['text', 'left'], ['metric', 'left'], ['items', 'left']]);
});

test('title follows titleAlignment and every other item follows contentAlignment', () => {
  const composed = composeSlide(slide, {titleAlignment: 'center', contentAlignment: 'right'});
  assert.deepEqual(alignments(composed), [['title', 'center'], ['subtitle', 'right'], ['text', 'right'], ['metric', 'right'], ['items', 'right']]);
  assert.equal(composed.items[3].metricLayout.alignment, 'right');
  // The title never inherits content alignment.
  assert.equal(composeSlide(slide, {contentAlignment: 'center'}).items[0].alignment, 'left');
});

test('slide design overrides host alignment options', () => {
  const composed = composeSlide({...slide, design: {titleAlignment: 'right', contentAlignment: 'center'}}, {titleAlignment: 'center', contentAlignment: 'right'});
  assert.deepEqual(alignments(composed), [['title', 'right'], ['subtitle', 'center'], ['text', 'center'], ['metric', 'center'], ['items', 'center']]);
});

test('accepted outline placement uses the item alignment', () => {
  const textMeasurement = {measure: (text, size) => text.length * size * .5, outlineBounds: (text, size) => text.trim() ? {x: 0, y: -size * .8, width: text.length * size * .5, height: size} : null};
  const composed = composeSlide(slide, {titleAlignment: 'center', contentAlignment: 'right', textMeasurement});
  for (const item of composed.items) if (item.text?.placement) assert.equal(item.text.placement.alignment, item.alignment, item.path);
  assert.ok(composed.items.filter(item => item.text?.placement).length >= 3);
});

// A cover has no content region: tag, title and subtitle are one heading group, so a deck that
// aligns its title and its content differently must not split the group.
const cover = {tag: 'Compliance', title: 'Compliance Readiness Review', subtitle: 'Tandem BioSystems Compliance'};
const titleSubtitle = {id: 'title-subtitle', placeholders: [{type: 'title'}, {type: 'subtitle'}]};

test('cover tag, title and subtitle share titleAlignment', () => {
  for (const layout of [titleSubtitle, undefined]) {
    assert.deepEqual(alignments(composeSlide(cover, {layout, titleAlignment: 'left', contentAlignment: 'center'})), [['tag', 'left'], ['title', 'left'], ['subtitle', 'left']]);
    assert.deepEqual(alignments(composeSlide(cover, {layout, titleAlignment: 'right', contentAlignment: 'left'})), [['tag', 'right'], ['title', 'right'], ['subtitle', 'right']]);
  }
  // Unset titleAlignment is left, as for the title itself; a host contentAlignment alone does not move the group.
  assert.deepEqual(alignments(composeSlide(cover, {contentAlignment: 'center'})), [['tag', 'left'], ['title', 'left'], ['subtitle', 'left']]);
  const composed = composeSlide({title: 'Cover'}, {titleAlignment: 'center', contentAlignment: 'right'});
  assert.deepEqual(alignments(composed), [['title', 'center']]);
});

test('cover slide design contentAlignment still sets tag and subtitle explicitly', () => {
  const composed = composeSlide({...cover, design: {titleAlignment: 'left', contentAlignment: 'center'}}, {titleAlignment: 'right', contentAlignment: 'right'});
  assert.deepEqual(alignments(composed), [['tag', 'center'], ['title', 'left'], ['subtitle', 'center']]);
  // Slide titleAlignment alone moves the whole group.
  assert.deepEqual(alignments(composeSlide({...cover, design: {titleAlignment: 'center'}}, {contentAlignment: 'right'})), [['tag', 'center'], ['title', 'center'], ['subtitle', 'center']]);
});

test('slides with body content keep contentAlignment for tag and subtitle', () => {
  const composed = composeSlide({...cover, text: 'Body copy'}, {titleAlignment: 'left', contentAlignment: 'center'});
  assert.deepEqual(alignments(composed), [['tag', 'center'], ['title', 'left'], ['subtitle', 'center'], ['text', 'center']]);
});

test('cover accepted outline placement follows the shared alignment', () => {
  const textMeasurement = {measure: (text, size) => text.length * size * .5, outlineBounds: (text, size) => text.trim() ? {x: 0, y: -size * .8, width: text.length * size * .5, height: size} : null};
  const composed = composeSlide(cover, {titleAlignment: 'right', contentAlignment: 'left', textMeasurement});
  for (const item of composed.items) assert.equal(item.text.placement.alignment, 'right', item.path);
});
