import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

// WI-1 (P31): a region whose blocks flow in a column stacks them at the heights they need, one gap apart, and its anchor
// places the stack, instead of giving every block an equal share (which left 248 px between a one-line paragraph and its
// long sibling). Groups stack their children the same way, so a group's label sits directly above its list.
const { layouts } = gallery;
const gap = 720 / 30;
const long = 'Exceptions need a brief review of the decision, its reversibility, and the evidence that is still missing. The owner should identify the practical consequence of waiting, the person who can resolve the uncertainty, and the latest useful decision date. A clear exception path protects important decisions while allowing routine work to continue. Record the reason for escalation so the team can improve the checklist when the same uncertainty recurs.';

test('unequal prose: one gap between the paragraphs, not an equal share each', () => {
  const result = composeSlide({ title: 'Learn before scaling', subtitle: 'Illustrative example', blocks: [{ text: 'Routine requests stay with one owner and follow the published checklist.', region: 'body' }, { text: long, region: 'body' }] }, { layout: layouts.text });
  const [short, tall] = result.items.filter((item) => item.region === 'body');
  assert.equal(result.regions.find((region) => region.name === 'body').arrangement, 'column');
  assert.ok(Math.abs(tall.box.y - (short.box.y + short.box.height) - gap) < 0.01, `${tall.box.y - short.box.y - short.box.height}`);
  assert.ok(short.box.height < 60, 'the one-line paragraph is as tall as its line');
  assert.equal(short.text.fontSize, 25);
  assert.equal(tall.text.fontSize, 25);
});

test('blocks that do not fit share the column; none gets less than it needs at the minimum size', () => {
  const blocks = [{ text: 'One line.', region: 'body' }, ...Array.from({ length: 3 }, () => ({ text: long, region: 'body' }))];
  const result = composeSlide({ title: 'Dense', blocks }, { layout: layouts.text });
  const body = result.items.filter((item) => item.region === 'body');
  const region = result.regions.find((entry) => entry.name === 'body').box;
  const bottom = body.at(-1).box.y + body.at(-1).box.height;
  assert.ok(Math.abs(bottom - (region.y + region.height)) < 0.01, 'the stack fills the region');
  assert.deepEqual(result.diagnostics, [], 'nothing overflows while the blocks fit at the minimum size');
  assert.ok(body[0].box.height < body[1].box.height / 2, 'the one-line block is not given an equal share');
});

test('a chart in a column takes what the measured blocks leave', () => {
  const chart = { chart: { type: 'column', data: { columns: ['Q', 'V'], rows: [['Q1', 1], ['Q2', 2]] } } };
  const record = { name: 'Column', direction: 'column', regions: [{ name: 'title' }, { name: 'body', accepts: ['text', 'chart'], role: 'primary', flow: 'column' }] };
  const result = composeSlide({ title: 'T', blocks: [{ text: 'A one-line takeaway.' }, chart] }, { layout: record });
  const [takeaway, drawn] = result.items.filter((item) => item.region === 'body');
  assert.ok(takeaway.box.height < 60);
  assert.ok(drawn.box.height > 300, `${drawn.box.height}`);
});

test('under overflow a chart keeps at least the equal share it had before', () => {
  const chart = { chart: { type: 'column', data: { columns: ['Q', 'V'], rows: [['Q1', 1], ['Q2', 2]] } } };
  const record = { name: 'Column', direction: 'column', regions: [{ name: 'title' }, { name: 'body', accepts: ['text', 'chart'], role: 'primary', flow: 'column' }] };
  const result = composeSlide({ title: 'T', blocks: [{ text: long.repeat(3) }, chart, { text: long.repeat(3) }] }, { layout: record });
  const region = result.regions.find((entry) => entry.name === 'body').box;
  const drawn = result.items.find((item) => item.field === 'chart');
  assert.ok(drawn.box.height >= (region.height - 2 * gap) / 3 - 0.01, `${drawn.box.height}`);
});

test('a group label sits directly above its list', () => {
  // Three peer columns of groups (the audit's homogeneous-group-3col): each group stacks its label over its list.
  const group = (label, items) => ({ blocks: [{ text: label }, { items }] });
  const record = { name: 'Three columns', direction: 'column', regions: [{ name: 'title' }, { direction: 'row', regions: ['first', 'second', 'third'].map((name) => ({ name, accepts: ['text', 'list', 'group'], role: 'primary', flow: 'none' })) }] };
  const items = ['Resolve access blockers.', 'Confirm release scope.', 'Prepare the next pilot build.'];
  const result = composeSlide({ title: 'Owners', blocks: [group('Product team', items), group('Operations team', items), group('Analytics team', items)] }, { layout: record });
  for (const region of ['first', 'second', 'third']) {
    const label = result.items.find((item) => item.region === region && item.field === 'text'), list = result.items.find((item) => item.region === region && item.field === 'items');
    assert.ok(list.box.y > label.box.y, 'the list is below the label');
    const labelBottom = label.box.y + label.text.lines.length * label.text.lineHeight;
    assert.ok(list.box.y - labelBottom < gap + 1, `${list.box.y - labelBottom}`);
  }
});

test('a column with explicit weights keeps its tracks', () => {
  const result = composeSlide({ title: 'T', blocks: [{ composition: { mode: 'column', weights: [1, 1] }, blocks: [{ text: 'A' }, { text: long }] }] });
  const [a, b] = result.items.filter((item) => item.field === 'text');
  assert.ok(Math.abs(a.box.height - b.box.height) < 0.01);
});
