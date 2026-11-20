// LH-185: a diagram that does not fit at the readability floor turns to the other main direction before it is scaled.
import test from 'node:test';
import assert from 'node:assert/strict';
import {composeSlide} from '../dist/composition.js';

const compose = diagram => {
  const result = composeSlide({title: 'Diagram', diagram});
  return {item: result.items.find(item => item.field === 'diagram').diagram, diagnostics: result.diagnostics};
};
const fan = (count, direction) => `flowchart ${direction}\n${Array.from({length: count}, (_, i) => `  A[Root] --> B${i}[Region ${i}]`).join('\n')}`;
const chain = (count, direction, label = 'Step') => `flowchart ${direction}\n${Array.from({length: count - 1}, (_, i) => `  n${i}[${label} ${i}] --> n${i + 1}`).join('\n')}`;

test('a flowchart written left to right that does not fit is drawn top to bottom, with an info finding', () => {
  const {item, diagnostics} = compose(fan(8, 'LR'));
  assert.deepEqual(item.direction, {from: 'LR', to: 'TB', turned: true});
  assert.ok(!item.overflow);
  assert.ok(item.fontSize >= 16, `labels are ${item.fontSize}`);
  assert.deepEqual(diagnostics.map(d => d.code), ['arrangement-adapted']);
  assert.match(diagnostics[0].message, /drawn top to bottom because left to right does not fit at the readability floor/);
  // The turned drawing is the item's own svg: engines paint it without laying the source out again.
  assert.ok(item.svg.includes('<svg'));
});

test('a flowchart written top to bottom turns left to right, and TD counts as TB', () => {
  for (const header of ['TB', 'TD']) {
    const {item, diagnostics} = compose(chain(7, header, 'Step growth'));
    assert.equal(item.direction?.to, 'LR');
    assert.equal(item.direction?.turned, true);
    assert.ok(item.fontSize >= 16);
    assert.deepEqual(diagnostics.map(d => d.code), ['arrangement-adapted']);
  }
});

test('a diagram that fits in the written direction keeps it and has no finding', () => {
  for (const source of [chain(4, 'LR'), chain(4, 'TB'), fan(4, 'LR')]) {
    const {item, diagnostics} = compose(source);
    assert.equal(item.direction, undefined);
    assert.ok(!item.overflow);
    assert.deepEqual(diagnostics, []);
  }
});

test('labels never grow past the nominal size when a diagram turns', () => {
  assert.ok(compose(fan(8, 'LR')).item.fontSize <= 32);
});

test('a flowchart that fits neither way is scaled as written, with the finding naming both directions', () => {
  const {item, diagnostics} = compose(fan(14, 'LR'));
  assert.equal(item.overflow, true);
  assert.deepEqual(item.direction, {from: 'LR', to: 'TB', turned: false});
  assert.ok(item.fontSize < 16);
  assert.deepEqual(diagnostics.map(d => d.code), ['text-overflow']);
  assert.match(diagnostics[0].message, /left to right and top to bottom were tried/);
});

test('a state diagram turns by its direction line, which is added when it has none', () => {
  const states = Array.from({length: 8}, (_, i) => `  S${i} --> S${i + 1}`).join('\n');
  const implicit = compose(`stateDiagram-v2\n${states}`);
  assert.deepEqual(implicit.item.direction, {from: 'TB', to: 'LR', turned: true});
  assert.match(implicit.diagnostics[0].message, /state diagram is drawn left to right/);
  const written = compose(`stateDiagram-v2\n  direction LR\n${states}`);
  assert.equal(written.item.direction, undefined, 'a state diagram that fits as written is not turned');
});

test('a diagram type without a direction is scaled as before', () => {
  const rows = Array.from({length: 40}, (_, i) => `  Client${i}->>Server: request ${i}`).join('\n');
  const {item, diagnostics} = compose(`sequenceDiagram\n${rows}`);
  assert.equal(item.direction, undefined);
  assert.equal(item.overflow, true);
  assert.match(diagnostics.find(d => d.code === 'text-overflow').message, /draw it the other way/);
});
