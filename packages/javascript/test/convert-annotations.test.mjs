import assert from 'node:assert/strict';
import {test} from 'node:test';
import {convertContent} from '../dist/convert.js';
import {validate} from '../dist/index.js';

const references = [{id: 'source', text: 'Original evidence'}];
for (const [name, annotation] of [['citation', {cite: 'source'}], ['footnote', {footnote: [{text: 'Original note', italic: true}]}]]) {
  test(`${name} survives a run-capable list conversion with exact input bytes and references`, () => {
    const input = {text: [{text: 'Claim', ...annotation}]}, before = structuredClone(input);
    const result = convertContent(input, 'list', {presentation: {references}});
    assert.deepEqual(result.payload.items, [[{text: 'Claim', ...annotation}]]);
    assert.equal(result.lossless, true);
    assert.deepEqual(result.loss, []);
    assert.deepEqual(input, before);
    assert.equal(validate({references, slides: [{blocks: [result.payload]}]}, {only: ['format', 'references']}).valid, true);
    assert.deepEqual(convertContent(result.payload, 'text', {presentation: {references}}).payload, input);
  });
  for (const to of ['quote', 'code']) test(`${name} loss is explicit for the existing plain ${to} target`, () => {
    const input = {text: [{text: 'Claim', ...annotation}]}, before = structuredClone(input);
    const result = convertContent(input, to, {presentation: {references}});
    assert.equal(result.lossless, false);
    assert.ok(result.loss.includes('text formatting'));
    assert.equal(to === 'quote' ? result.payload.quote.text : result.payload.code.source, 'Claim');
    assert.deepEqual(input, before);
  });
}
test('isolated citation context is deferred, while explicit empty or wrong references are rejected', () => {
  const input = {text: [{text: 'Claim', cite: 'source'}]};
  assert.equal(convertContent(input, 'list').lossless, true);
  for (const refs of [[], [{id: 'other', text: 'Different evidence'}]]) {
    assert.throws(() => convertContent(input, 'list', {presentation: {references: refs}}), error => error.code === 'invalid-output' && error.details.issues.some(f => f.ruleId === 'opf/cite-unknown-reference'));
  }
  const inherited = Object.create({references: []});
  assert.equal(convertContent(input, 'list', {presentation: inherited}).lossless, true, 'prototype entries are not document context');
});
test('malformed and unsupported annotations are not suppressed', () => {
  assert.throws(() => convertContent({text: [{text: 'Claim', cite: []}]}, 'list'), error => error.code === 'invalid-output');
  assert.throws(() => convertContent({text: [{text: 'Claim', footnote: [{text: 'Nested', cite: 'source'}]}]}, 'list'), error => error.code === 'invalid-output' && error.details.issues.some(f => f.ruleId === 'opf/cite-unsupported-location'));
});
test('ordinary bold controls retain their established rich/plain conversion semantics', () => {
  const input = {text: [{text: 'Claim', bold: true}]};
  assert.deepEqual(convertContent(input, 'list').payload.items, [input.text]);
  assert.equal(convertContent(input, 'quote').lossless, false);
  assert.equal(convertContent({text: 'Plain claim'}, 'list').lossless, true);
});
test('Markdown keeps annotations in its existing lossless embedded form', async () => {
  const {toMarkdown, fromMarkdown} = await import('../dist/markdown.js');
  const input = {references, slides: [{text: [{text: 'Claim', cite: 'source', footnote: 'Original note'}]}]};
  const result = toMarkdown(input);
  assert.equal(result.report.lossless, true);
  assert.equal(result.report.native, false, 'annotations have no native Markdown run syntax');
  assert.deepEqual(fromMarkdown(result.markdown).presentation, input);
});
