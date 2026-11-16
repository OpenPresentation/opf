import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../dist/index.js';
import { nearIconNames } from '../dist/index.js';

// Defects five sample-deck authors hit with OPF 0.34.1: a required id with no hint, a region key whose span is in the wrong
// order, a region written as a bare string, a false opf/reading-order beside a full-height list, and icon-name suggestions.
const deck = (slide, rest = {}) => ({ name: 'T', language: 'en-US', slides: [slide], ...rest });
const schemaFindings = (document) => validate(document).findings.filter((finding) => finding.ruleId === 'opf/schema');

test('an organization without an id says why the id is needed and how to write it', () => {
  const [found, ...others] = schemaFindings(deck({ title: 'x' }, { organization: { name: 'X' } }));
  assert.equal(others.length, 0);
  assert.equal(found.path, '/organization');
  assert.match(found.message, /required property 'id'/);
  assert.match(found.help, /"id": "acme"/);
  assert.match(found.help, /speaker\.organizationId/);
  const speaker = schemaFindings(deck({ title: 'x' }, { speaker: [{ name: 'S' }] }))[0];
  assert.match(speaker.help, /"id"/);
  assert.match(speaker.path, /^\/speaker\/0$/);
});

test('a region key with its span in the wrong order or skipping a row names the key to write', () => {
  const wrong = schemaFindings(deck({ title: 'x', 'bottom+middle:start+center+end': { text: 'a' } }))[0];
  assert.match(wrong.help, /Write "middle\+bottom:start\+center\+end"/);
  assert.equal(wrong.suggestions[0].value, 'middle+bottom:start+center+end');
  const skipped = schemaFindings(deck({ title: 'x', 'top+bottom:start': { text: 'a' } }))[0];
  assert.match(skipped.help, /adjacent rows or columns/);
  const swapped = schemaFindings(deck({ title: 'x', 'start:top': { text: 'a' } }))[0];
  assert.match(swapped.help, /write "top:start"/);
  const other = schemaFindings(deck({ title: 'x', colour: 'red' }))[0];
  assert.doesNotMatch(other.help, /region/i);
});

test('a bare string as a region value is one finding that shows the object form', () => {
  const found = schemaFindings(deck({ title: 'x', 'top:start': 'hello' }));
  assert.equal(found.length, 1);
  assert.equal(found[0].path, '/slides/0/top:start');
  assert.match(found[0].message, /content payload \(an object\), not a bare string/);
  assert.match(found[0].help, /\{ "text": "hello" \}/);
  assert.deepEqual(found[0].fixes[0].patch, [{ op: 'replace', path: '/slides/0/top:start', value: { text: 'hello' } }]);
  const list = schemaFindings(deck({ title: 'x', end: ['a', 'b'] }));
  assert.equal(list.length, 1);
  assert.match(list[0].help, /"items"/);
  assert.deepEqual(schemaFindings(deck({ title: 'x', 'top:start': { text: 'ok' } })), []);
});

test('tiles beside a full-height list read row by row, then the list: no opf/reading-order finding', () => {
  const slide = { title: 'x', 'top:start': { text: 'A' }, 'top:center': { text: 'B' }, 'bottom:start': { text: 'C' }, 'top+middle+bottom:end': { items: ['one', 'two', 'three'] } };
  assert.deepEqual(validate(deck(slide)).findings.filter((finding) => finding.ruleId === 'opf/reading-order'), []);
});

test('icon suggestions read names word by word and do not offer a name inside a longer word', () => {
  const names = ['triangle', 'triangle-right', 'triangle-dashed', 'triangle-exclamation-point', 'circle-alert', 'angle', 'flag-triangle-left', 'warning'];
  assert.ok(!nearIconNames('triangle-alert', ['triangle', 'angle']).includes('angle'));
  const tags = { 'triangle-exclamation-point': ['alert', 'warning', 'danger'] };
  assert.equal(nearIconNames('triangle-alert', names, 5, tags)[0], 'triangle-exclamation-point');
  assert.equal(nearIconNames('alert-triangle', names, 5, tags)[0], 'triangle-exclamation-point');
  assert.equal(nearIconNames('trianlge', names)[0], 'triangle');
  assert.ok(nearIconNames('tri', names).every((name) => name.includes('tri')));
});
