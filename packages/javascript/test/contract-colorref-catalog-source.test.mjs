// Contract the engines implement (opf-render and opf-pptx, 2026-09-30): background colors are ColorRefs and
// a catalog group names its catalog by one `source` string (OPF 0.15: no search paths). The docs
// (design-resolution.md, how-opf-works.md, default-catalog.md) state what engines do with them.
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

test('a catalog group names one source: an HTTPS URL or a pkg: reference, never a search path', () => {
  for (const source of ['https://acme.example/catalog', 'pkg:@acme/opf-catalog']) {
    const result = check({name: 'Deck', catalogs: {acme: {source}}, slides: [slide]});
    assert.equal(result.valid, true, JSON.stringify(source));
  }
  for (const source of [['https://acme.example/a'], '', 'http://acme.example', 'acme'])
    assert.equal(check({name: 'Deck', catalogs: {acme: {source}}, slides: [slide]}).valid, false, JSON.stringify(source));
});
