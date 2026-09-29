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
