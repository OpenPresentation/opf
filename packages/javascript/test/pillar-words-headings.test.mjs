// P3: LH-136's display words. A set of one-word pillars draws each word at display size over an accent rule, with or without a
// description under it, so three one-word headings no longer draw as thin pills in an empty body beside words with a short line.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const record = { id: 'pillars', name: 'Pillars', design: { contentBox: true, listBullet: 'none' }, direction: 'column', anchor: 'middle', regions: [{ name: 'title' }, { name: 'body', accepts: ['text', 'list', 'metric', 'image', 'group'], flow: 'grid' }] };
const compose = (entries) => composeSlide({ title: 'Three conditions', blocks: entries.map((entry) => ({ items: [entry] })) }, { width: 1280, height: 720, layout: record });

test('P3: one-word headings without descriptions are display words, as one-word headings with descriptions are', () => {
  const words = compose([{ text: 'Scope' }, { text: 'Measures' }, { text: 'Decision' }]);
  const described = compose([{ text: 'Scope', description: 'Two teams.' }, { text: 'Measures', description: 'Weekly.' }, { text: 'Decision', description: 'One.' }]);
  for (const result of [words, described]) {
    const lists = result.items.filter((item) => item.field === 'items');
    assert.equal(lists.length, 3);
    for (const item of lists) {
      assert.equal(item.frameBox, undefined, `${item.path}: no card`);
      assert.ok(item.text.rules?.some((rule) => rule.accent), `${item.path}: an accent rule over the word`);
    }
  }
  const size = (result) => result.items.find((item) => item.field === 'items').text.listEntries[0].text.fontSize;
  assert.ok(size(words) >= 48, `the word is at display size (${size(words)})`);
});
