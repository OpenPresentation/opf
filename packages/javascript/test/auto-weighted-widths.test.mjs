import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

// WI-3 (P29): in automatic composition two prose blocks whose measured demand differs by 2.5x or more split their row in
// favor of the longer one, but only when that shortens it and adds the shorter at most one line. Peers and explicit weights keep
// equal widths.
const short = 'Routine requests stay with one owner and follow the published checklist.';
const long = 'Exceptions need a brief review of the decision, its reversibility, and the evidence that is still missing. The owner should identify the practical consequence of waiting, the person who can resolve the uncertainty, and the latest useful decision date. A clear exception path protects important decisions while allowing routine work to continue. Record the reason for escalation so the team can improve the checklist when the same uncertainty recurs.';
const prose = (result) => result.items.filter((item) => item.field === 'text' && item.text.fontSize < 54);
const near = (a, b) => assert.ok(Math.abs(a - b) <= 0.51, `${a} vs ${b}`);

test('a two-line note beside a nine-line explanation: the explanation gets the wider column', () => {
  const before = prose(composeSlide({ title: 'The exception path needs the explanation', composition: { weights: [1, 1] }, blocks: [{ text: short }, { text: long }] }));
  const result = composeSlide({ title: 'The exception path needs the explanation', blocks: [{ text: short }, { text: long }] });
  const [note, explanation] = prose(result);
  assert.ok(explanation.box.width >= note.box.width * 1.49, `${explanation.box.width} vs ${note.box.width}`);
  assert.ok(explanation.text.lines.length < before[1].text.lines.length, 'the explanation is shorter');
  assert.ok(note.text.lines.length <= before[0].text.lines.length + 1, 'the note adds at most one line');
  assert.equal(note.text.fontSize, 28);
  assert.equal(explanation.text.fontSize, 28);
  assert.deepEqual(result.diagnostics, []);
});

test('the longer block keeps the wider column wherever it is', () => {
  const [explanation, note] = prose(composeSlide({ title: 'T', blocks: [{ text: long }, { text: short }] }));
  assert.ok(explanation.box.width >= note.box.width * 1.49);
});

test('peers of similar demand keep equal widths', () => {
  const [a, b] = prose(composeSlide({ title: 'T', blocks: [{ text: long }, { text: long.replace('Exceptions', 'Requests') }] }));
  near(a.box.width, b.box.width);
  const [c, d] = prose(composeSlide({ title: 'T', blocks: [{ text: short }, { text: short.replace('Routine', 'Standard') }] }));
  near(c.box.width, d.box.width);
});

test('explicit weights and a three-block row are never reweighted', () => {
  const [a, b] = prose(composeSlide({ title: 'T', composition: { mode: 'row', weights: [1, 1] }, blocks: [{ text: short }, { text: long }] }));
  near(a.box.width, b.box.width);
  const widths = prose(composeSlide({ title: 'T', blocks: [{ text: short }, { text: short }, { text: long }] })).map((item) => item.box.width);
  near(widths[0], widths[2]);
});
