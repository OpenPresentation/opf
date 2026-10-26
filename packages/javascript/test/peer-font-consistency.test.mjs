import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

// WI-1 (N1): blocks side by side as peers (regions of one role in the same rows, or one row of a flow) share one fitted
// size per kind, so a three-column list reads as one design instead of 32/30/27 px.
const { layouts } = gallery;
const columns = { name: 'Three columns', direction: 'column', regions: [{ name: 'title' }, { direction: 'row', regions: ['first', 'second', 'third'].map((name) => ({ name, accepts: ['text', 'list', 'metric', 'group'], role: 'primary', flow: 'none' })) }] };
const entry = (text, description) => ({ text, description });
const lists = [
  [entry('Name the decision owner', 'Make accountability visible from intake through closure.'), entry('Publish the checklist', 'Keep the entry criteria available to every participant.'), entry('Record the outcome', 'Explain the next step and who will take it.')],
  [entry('Measure the starting point', 'Track review time, escalation rate, and task completion.'), entry('Review feedback weekly', 'Separate one-off requests from repeated workflow problems.'), entry('Close access blockers', 'Give each dependency an owner and useful decision date.'), entry('Protect support capacity', 'Expand only when the team can maintain its response targets.')],
  [entry('Keep one workflow in scope', 'Use the same decision criteria across the pilot.'), entry('Retain the baseline', 'Compare changes against the original measures.'), entry('Rehearse exceptions', 'Test the route before additional teams join.'), entry('Confirm the support rotation', 'Make ownership clear outside normal hours.'), entry('Choose the next rollout', 'Use the evidence to set a sustainable pace.'), entry('Share the decision', 'Tell every team what changes next and when.')],
];

test('three peer lists share one size', () => {
  const result = composeSlide({ title: 'Three peer columns of lists', blocks: lists.map((items) => ({ items })) }, { layout: columns });
  const sizes = result.items.filter((item) => item.field === 'items').map((item) => item.text.fontSize);
  assert.equal(sizes.length, 3);
  assert.equal(new Set(sizes).size, 1, sizes.join('/'));
  assert.ok(sizes[0] < 32, 'the densest column set the size');
  assert.deepEqual(result.diagnostics, []);
});

test('dense comparison options share one size; the verdict below keeps its own', () => {
  const option = (name, repeat) => `${name}\n${'Each team must complete training, collect baseline evidence, assign an accountable owner and confirm support capacity before this option can proceed. '.repeat(repeat)}`;
  const result = composeSlide({ title: 'Choose the smallest useful test', blocks: [{ region: 'first', text: option('Option A', 4) }, { region: 'second', text: option('Option B', 6) }, { region: 'verdict', text: 'Start with Option A.' }] }, { layout: layouts.comparison });
  const [first, second, verdict] = ['first', 'second', 'verdict'].map((name) => result.items.find((item) => item.region === name));
  assert.equal(first.text.fontSize, second.text.fontSize);
  assert.equal(verdict.text.fontSize, 25);
});

test('peers in one row of a grid flow share one size; text and lists keep their own sizes', () => {
  const record = { name: 'Grid', direction: 'column', regions: [{ name: 'title' }, { name: 'body', accepts: ['text', 'list'], role: 'primary', flow: 'grid' }] };
  const result = composeSlide({ title: 'Grid', blocks: [{ text: 'Short.' }, { text: 'A much longer paragraph that has to wrap over several lines in its narrow cell, and then some more words so that it shrinks before it fits. '.repeat(6) }, { items: ['One', 'Two'] }] }, { layout: record });
  const texts = result.items.filter((item) => item.field === 'text').map((item) => item.text.fontSize);
  assert.equal(new Set(texts).size, 1, texts.join('/'));
  assert.equal(result.items.find((item) => item.field === 'items').text.fontSize, 32);
});

test('regions of different roles side by side are not peers', () => {
  const record = { name: 'Beside', direction: 'row', regions: [{ name: 'main', accepts: ['text'], role: 'primary', flow: 'none', size: 2 }, { name: 'aside', accepts: ['text'], role: 'supporting', flow: 'none' }] };
  const result = composeSlide({ blocks: [{ region: 'main', text: 'Short.' }, { region: 'aside', text: 'A long aside that has to shrink to fit its narrow column, with enough words to need several lines at the starting size and then some more. '.repeat(4) }] }, { layout: record });
  assert.equal(result.items.find((item) => item.region === 'main').text.fontSize, 25);
});
