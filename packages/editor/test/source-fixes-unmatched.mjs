// 0.34.1: a quick fix is written only for text that has the finding's place. The source pane once built the fixes of a new deck's findings
// against the text of the deck it still showed: `removeAt` called jsonc-parser's `modify` for /slides/5/body in a text with two slides and
// it threw "Can not delete in empty document", which took the pane down with it. Every builder that edits by path returns null (no fix)
// for a path the text lacks, for text that does not parse and for empty text; the finding is still listed, with no text fix.
import assert from 'node:assert/strict';
import { addItem, addProperty, applySourceEdits, changeValue, fixesForFinding, moveIntoExtensions, removeAt, renameKey, wrapInList } from '../dist/source-fixes.js';
import { textFixesForFinding } from '../dist/source-fixes-text.js';
import { buildProblems } from '../dist/source-problems.js';

const twoSlides = JSON.stringify({ name: 'x', count: 3, slides: [{ title: 'a' }, { title: 'b' }] }, null, 2);
const texts = {
  'a path the text lacks': twoSlides,
  'text that does not parse': '{\n  "name": "x",\n  "slides": [\n    { "title": "a",\n',
  'empty text': '',
  'blank text': '  \n',
};
const missing = ['slides', '5', 'body'];
const builders = {
  changeValue: (text) => changeValue(text, missing, 'center'),
  renameKey: (text) => renameKey(text, missing, 'text'),
  removeAt: (text) => removeAt(text, missing),
  addProperty: (text) => addProperty(text, ['slides', '5'], 'id', 'slide-6'),
  addItem: (text) => addItem(text, ['slides', '5', 'items'], 'x'),
  wrapInList: (text) => wrapInList(text, missing),
  moveIntoExtensions: (text) => moveIntoExtensions(text, missing),
};
for (const [name, build] of Object.entries(builders)) {
  for (const [label, text] of Object.entries(texts)) {
    let made;
    assert.doesNotThrow(() => { made = build(text); }, `${name} does not throw for ${label}`);
    assert.equal(made, null, `${name} writes no fix for ${label}`);
  }
}
// A parent that is there but of the wrong kind: jsonc-parser's `modify` throws for these too.
assert.equal(addProperty(twoSlides, ['count'], 'id', 'x'), null, 'addProperty into a number');
assert.equal(addItem(twoSlides, ['count'], 'x'), null, 'addItem into a number');
assert.equal(addItem(twoSlides, ['slides', '0'], 'x'), null, 'addItem into an object');
assert.equal(removeAt(twoSlides, ['count', 'x']), null, 'removeAt under a number');
assert.equal(removeAt(twoSlides, []), null, 'removeAt of the whole document');
assert.equal(moveIntoExtensions(JSON.stringify({ slides: [{ title: 'a', body: 'b', extensions: 5 }] }), ['slides', '0', 'body']), null, 'moveIntoExtensions into an extensions that is not an object');
console.log('ok - every path builder writes no fix, and throws nothing, for a missing path, unparseable text and empty text');

// The finding from the report: an unknown key on slide 6, against the text of a deck with two slides.
const body = (index) => ({ ruleId: 'opf/schema', severity: 'error', kind: 'schema', message: 'Unknown property', path: `/slides/${index}/body`, validation: { keyword: 'additionalProperties', params: { additionalProperty: 'body' } } });
const context = { unit: '  ', keysOf: () => ['title', 'extensions'] };
for (const [label, text] of Object.entries(texts)) {
  assert.deepEqual(fixesForFinding(body(5), text, context), [], `fixesForFinding gives no fix for ${label}`);
  for (const format of ['yaml', 'md']) assert.deepEqual(textFixesForFinding(format, body(5), text, context), [], `textFixesForFinding (${format}) gives no fix for ${label}`);
}
for (const finding of [
  { ruleId: 'opf/schema', path: '/slides/5/layout', validation: { keyword: 'enum', params: { allowedValues: ['center'] } } },
  { ruleId: 'opf/schema', path: '/slides/5', validation: { keyword: 'required', params: { missingProperty: 'id' } } },
  { ruleId: 'opf/schema', path: '/slides/5/items', validation: { keyword: 'type', params: { type: 'array' } } },
  { ruleId: 'opf/duplicate-key', path: '/slides/5/title' },
]) {
  for (const [label, text] of Object.entries(texts)) assert.deepEqual(fixesForFinding(finding, text, { ...context, starter: () => 'x', replacementValues: () => ['center'] }), [], `${finding.validation?.keyword ?? finding.ruleId} gives no fix for ${label}`);
}
console.log('ok - fixesForFinding and textFixesForFinding give no fix for a finding the text has no place for');

// Text that has the place: the fixes are the same as before.
const withBody = JSON.stringify({ name: 'x', slides: [{ title: 'a' }, { title: 'b', body: 'text' }] }, null, 2);
const offered = fixesForFinding(body(1), withBody, context);
assert.deepEqual(offered.map((fix) => fix.id), ['move-to-extensions', 'remove-property']);
assert.equal(applySourceEdits(withBody, offered.find((fix) => fix.id === 'remove-property').edits), JSON.stringify({ name: 'x', slides: [{ title: 'a' }, { title: 'b' }] }, null, 2));
assert.deepEqual(JSON.parse(applySourceEdits(withBody, offered.find((fix) => fix.id === 'move-to-extensions').edits)).slides[1], { title: 'b', extensions: { body: 'text' } });
console.log('ok - text that has the place still gets Move into extensions and Remove property');

// The problem list: a finding without a fix is still listed, and a fix builder that throws costs that finding its text fixes only.
const rows = buildProblems({ format: 'json', text: twoSlides, findings: [body(5), body(0)], context });
assert.equal(rows.length, 2, 'both findings are listed');
assert.ok(rows.every((row) => row.fixes.length === 0), 'with no text fix');
const throwing = { ...context, keysOf: () => { throw new Error('boom'); } };
const listed = buildProblems({ format: 'json', text: withBody, findings: [body(1)], context: throwing });
assert.equal(listed.length, 1, 'a finding whose fix builder throws is still listed');
assert.deepEqual(listed[0].fixes, [], 'without the fixes that threw');
console.log('ok - buildProblems lists every finding, also when a fix cannot be written or its builder throws');
