import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// FA-23: the documents name gallery records, so they render with the gallery snapshot registered, as a host does. Core's
// packed-ecosystem checks copy this file and rewrite its relative imports, so it registers the catalog itself.
import {defaultCatalog} from '@openpresentation/opf/catalog';
import {toSvg as toSvgUnregistered} from '../dist/index.js';
const catalogs = [defaultCatalog];
const toSvg = (deck, index, options = {}) => toSvgUnregistered(deck, index, {catalogs, ...options});

const fixture = JSON.parse(
  readFileSync(new URL('fixtures/color-references.opf.json', import.meta.url), 'utf8'),
);
const forest = defaultCatalog.colorSchemes['forest-green'];
assert.ok(forest, 'forest-green color scheme');

const svgDeck = fixture.slides.slice(0, 3).map((_, index) =>
  toSvg(fixture, index + 1),
);

const [namedRuns, variableRuns, styledCells] = svgDeck;

assert.match(namedRuns, new RegExp(`fill="${forest.accent2.toUpperCase()}"`, 'i'));
assert.match(namedRuns, new RegExp(`fill="${forest.dark2.toUpperCase()}"`, 'i'));

const risk = fixture.variables.risk.value.toUpperCase();
const highlight = fixture.variables.highlight.toUpperCase();
assert.match(variableRuns, new RegExp(`fill="${risk}"`));
assert.match(variableRuns, new RegExp(`fill="${highlight}"`));
assert.match(variableRuns, /fill="#0F172A"/);

const authoredHex = toSvg({
  design: { theme: 'classic', colorScheme: 'cool-horizon' },
  slides: [{
    text: [{ text: 'Toolbar', color: '#2563eb' }],
  }],
}, 1);
assert.ok(/<tspan(?=[^>]*fill="#2563eb")[^>]*>Toolbar<\/tspan>/.test(authoredHex));
assert.doesNotMatch(authoredHex, /fill="#2563EB"/);

assert.match(styledCells, new RegExp(`fill="${forest.light2.toUpperCase()}"`, 'i'));
assert.match(styledCells, new RegExp(`fill="${risk}"`));
assert.match(styledCells, new RegExp(`stroke="${forest.accent1.toUpperCase()}"`, 'i'));
assert.match(styledCells, new RegExp(`fill="${forest.accent3.toUpperCase()}"`, 'i'));

const invalidFallback = toSvg({
  design: { theme: 'classic', colorScheme: 'cool-horizon' },
  slides: [{
    table: {
      rows: [[[
        { text: 'Fallback', color: 'invalid' },
      ]]],
    },
  }],
}, 1);
const themeText = invalidFallback.match(/fill="([^"]+)"/)?.[1];
assert.ok(themeText);
assert.doesNotMatch(invalidFallback, /fill="invalid"/i);

console.log('Color reference renderer passed: scheme slots, roles, variables, hex, and invalid run fallback.');
