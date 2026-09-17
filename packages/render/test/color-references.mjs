import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { colorSchemes } from '@openpresentation/opf';
import { renderSvg } from '../dist/index.js';

const fixture = JSON.parse(
  readFileSync(new URL('fixtures/color-references.opf.json', import.meta.url), 'utf8'),
);
const forest = colorSchemes.find((scheme) => scheme.id === 'forest-green');
assert.ok(forest, 'forest-green color scheme');

// Reference-layer fields are schema-valid only after core 0.11; skip boundary
// validation for the vendored OPF fixture until the coordinated pin lands.
const renderOptions = { validate: false };
const svgDeck = fixture.slides.slice(0, 3).map((_, index) =>
  renderSvg(fixture, { slideIndex: index, ...renderOptions }),
);

const [namedRuns, variableRuns, styledCells] = svgDeck;

assert.match(namedRuns, new RegExp(`fill="${forest.accent2.toUpperCase()}"`, 'i'));
assert.match(namedRuns, new RegExp(`fill="${forest.dark2.toUpperCase()}"`, 'i'));

const risk = fixture.variables.risk.value.toUpperCase();
const highlight = fixture.variables.highlight.toUpperCase();
assert.match(variableRuns, new RegExp(`fill="${risk}"`));
assert.match(variableRuns, new RegExp(`fill="${highlight}"`));
assert.match(variableRuns, /fill="#0F172A"/);

assert.match(styledCells, new RegExp(`fill="${forest.light2.toUpperCase()}"`, 'i'));
assert.match(styledCells, new RegExp(`fill="${risk}"`));
assert.match(styledCells, new RegExp(`stroke="${forest.accent1.toUpperCase()}"`, 'i'));
assert.match(styledCells, new RegExp(`fill="${forest.accent3.toUpperCase()}"`, 'i'));

const invalidFallback = renderSvg({
  design: { theme: 'classic', colorScheme: 'cool-horizon' },
  slides: [{
    table: {
      rows: [[[
        { text: 'Fallback', color: 'invalid' },
      ]]],
    },
  }],
});
const themeText = invalidFallback.match(/fill="([^"]+)"/)?.[1];
assert.ok(themeText);
assert.doesNotMatch(invalidFallback, /fill="invalid"/i);

console.log('Color reference renderer passed: scheme slots, roles, variables, hex, and invalid run fallback.');
