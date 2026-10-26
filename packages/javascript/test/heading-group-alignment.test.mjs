import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide} from '../dist/composition.js';

// WI-2 (P35): the heading group (tag, title, subtitle) shares one alignment axis. The subtitle follows titleAlignment
// whenever it sits in the title area; a layout's own 'subtitle' region and the slide's own design.contentAlignment keep
// the content alignment, as before.
const slide = {tag: 'Quarterly', title: 'Operating metrics', subtitle: 'Six numbers that matter', blocks: [{metric: {value: 42, label: 'Accounts'}}, {metric: {value: 7, label: 'Regions'}}]};
const metrics = {id: 'metrics', design: {contentAlignment: 'center'}, regions: [{name: 'title'}, {name: 'main', accepts: ['metric'], flow: 'grid'}]};
const separate = {id: 'separate-subtitle', design: {contentAlignment: 'center'}, regions: [{name: 'title', size: 'auto'}, {name: 'subtitle', size: 'auto'}, {name: 'main', accepts: ['metric'], flow: 'grid'}]};
const alignOf = (result, field) => result.items.find(item => item.field === field).alignment;

test('a left title keeps its tag and subtitle left over centred content', () => {
  const result = composeSlide(slide, {layout: metrics, titleAlignment: 'left'});
  assert.deepEqual(['tag', 'title', 'subtitle'].map(field => alignOf(result, field)), ['left', 'left', 'left']);
  assert.equal(alignOf(result, 'metric'), 'center');
});

test('a centred title brings its subtitle with it, on a template and without a layout', () => {
  for (const layout of [metrics, undefined]) {
    const result = composeSlide(slide, {layout, titleAlignment: 'center', contentAlignment: 'left'});
    assert.deepEqual(['tag', 'title', 'subtitle'].map(field => alignOf(result, field)), ['center', 'center', 'center']);
  }
});

test('a layout design.titleAlignment moves the whole heading group', () => {
  const layout = {...metrics, design: {titleAlignment: 'right', contentAlignment: 'left'}};
  const result = composeSlide(slide, {layout});
  assert.deepEqual(['tag', 'title', 'subtitle'].map(field => alignOf(result, field)), ['right', 'right', 'right']);
});

test('a layout with its own subtitle region keeps the subtitle on contentAlignment', () => {
  const result = composeSlide(slide, {layout: separate, titleAlignment: 'left'});
  assert.equal(alignOf(result, 'title'), 'left');
  assert.equal(alignOf(result, 'subtitle'), 'center');
});

test("the slide's own design.contentAlignment keeps the subtitle (and tag) on the content", () => {
  const result = composeSlide({...slide, design: {contentAlignment: 'right'}}, {layout: metrics, titleAlignment: 'left'});
  assert.deepEqual(['tag', 'title', 'subtitle'].map(field => alignOf(result, field)), ['right', 'left', 'right']);
});
