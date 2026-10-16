import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fill, validate} from '../dist/index.js';

const template = () => JSON.parse('{"assets":{"constructor":{"src":"https://example.org/one.png","alt":"one"},"toString":{"src":"https://example.org/two.png","alt":"two"},"ordinary":{"src":"https://example.org/three.png","alt":"three"}},"slides":[{"title":"Deck","image":"asset:constructor"},{"title":"Second","image":"asset:toString"}]}');
test('combined fills preserve inherited-name asset IDs and resolve their references without mutating inputs', () => {
  const input = template(), before = structuredClone(input);
  assert.equal(validate(input, {only: ['format', 'references']}).valid, true);
  const result = fill(input, [{}, {}], {combine: true});
  assert.deepEqual(result.presentation.assets, input.assets);
  assert.equal(result.presentation.slides.length, 4);
  assert.deepEqual(input, before);
  assert.equal(validate(result.presentation, {only: ['format', 'references']}).valid, true);
  assert.equal(validate({...result.presentation, assets: {ordinary: input.assets.ordinary}}, {only: ['references']}).findings.filter(f => f.ruleId === 'opf/asset-reference').length, 4, 'negative control detects the actual dangling references');
});
test('ordinary asset collisions retain the existing first-record-wins policy', () => {
  const input = {variables: {photo: {type: 'text', required: true}}, assets: {ordinary: {src: '{{photo}}'}}, slides: [{image: 'asset:ordinary'}]};
  const before = structuredClone(input);
  const result = fill(input, [{photo: 'https://example.org/first.png'}, {photo: 'https://example.org/second.png'}], {combine: true});
  assert.equal(result.presentation.assets.ordinary.src, 'https://example.org/first.png');
  assert.equal(result.decks[1].presentation.assets.ordinary.src, 'https://example.org/second.png');
  assert.deepEqual(input, before);
});
