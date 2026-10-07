// Contract the engines implement (opf-render and opf-pptx, 2026-09-30): background colors are ColorRefs and
// `catalogs.<kind>.source` may be an ordered search path. The schema keeps both as plain strings / string arrays, so
// these documents validate; the docs (design-resolution.md, how-opf-works.md) state what engines do with them.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import { check } from './support/validation.mjs';


const slide = {title: 'T'};

test('solid, gradient and pattern background colors accept ColorRef forms', () => {
  for (const background of [
    {type: 'solid', color: 'var:brand'},
    {type: 'solid', color: 'accent2'},
    {type: 'solid', color: 'primary', opacity: 0.5},
    {type: 'gradient', gradient: {angle: 90, stops: [{color: 'accent1', position: 0}, {color: 'var:brand', position: 1}]}},
    {type: 'pattern', pattern: {preset: 'pct5', foregroundColor: 'text', backgroundColor: 'var:brand'}},
  ]) {
    const result = check({name: 'Deck', variables: {brand: '#B42318'}, design: {background}, slides: [slide]});
    assert.equal(result.valid, true, JSON.stringify(background));
  }
});

test('catalogs.<kind>.source accepts a string or a non-empty ordered array', () => {
  for (const source of ['https://acme.example/narratives', ['https://acme.example/a', 'pkg:@acme/decks/narratives']]) {
    const result = check({name: 'Deck', catalogs: {narratives: {source}}, slides: [slide]});
    assert.equal(result.valid, true, JSON.stringify(source));
  }
  assert.equal(check({name: 'Deck', catalogs: {narratives: {source: []}}, slides: [slide]}).valid, false, 'an empty search path is invalid');
});
