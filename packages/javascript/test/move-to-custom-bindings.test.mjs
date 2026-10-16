import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyPatch, moveToCustom, resolveDesignRecords, resolveReference, validate } from '../dist/index.js';

const scheme = accent1 => ({ name: 'Brand', accent1 });
const theme = { name: 'House', dimensions: 'widescreen', colorScheme: 'brand' };
const deck = (group, customScheme, relative = 'brand') => ({
  catalogs: {
    [group]: { source: 'https://brand.example', themes: { house: { ...theme, colorScheme: relative } }, colorSchemes: { brand: scheme('#111111') } },
    custom: { themes: { house: { ...theme, colorScheme: relative } }, ...(customScheme ? { colorSchemes: { brand: scheme(customScheme) } } : {}) },
  },
  slides: [{ title: 'A', design: { theme: `${group}:house` } }, { title: 'Keep custom', design: { theme: 'custom:house' } }],
});

for (const group of ['default', 'brand']) test(`moving ${group} theme does not reuse raw-equal custom with different bindings`, () => {
  const input = deck(group, '#FF0000');
  const before = structuredClone(input);
  assert.equal(validate(input, { only: ['format'] }).valid, true);
  const original = resolveDesignRecords(input, 0).colorScheme;
  const result = moveToCustom(input, { kind: 'themes', reference: `${group}:house` });
  assert.equal(result.to.id, 'house-2');
  assert.deepEqual(result.renamed, { from: 'house', to: 'house-2' });
  assert.equal(result.document.catalogs.custom.themes['house-2'].colorScheme, `${group}:brand`);
  assert.deepEqual(resolveDesignRecords(result.document, 0).colorScheme, original);
  assert.equal(resolveDesignRecords(result.document, 1).colorScheme.accent1, '#FF0000');
  assert.deepEqual(result.document.catalogs.custom.themes.house, input.catalogs.custom.themes.house);
  assert.deepEqual(result.document.catalogs.custom.colorSchemes, input.catalogs.custom.colorSchemes);
  assert.deepEqual(applyPatch(input, result.patch), result.document);
  assert.deepEqual(input, before);
});

test('equal raw themes with the same resolved dependency reuse the existing custom record', () => {
  const input = deck('brand', '#FF0000', 'brand:brand');
  const before = structuredClone(input);
  const result = moveToCustom(input, { kind: 'themes', reference: 'brand:house' });
  assert.equal(result.to.id, 'house');
  assert.equal(result.renamed, undefined);
  assert.deepEqual(resolveDesignRecords(result.document, 0).colorScheme, resolveDesignRecords(input, 0).colorScheme);
  assert.deepEqual(applyPatch(input, result.patch), result.document);
  assert.deepEqual(input, before);
});

test('default fallback from custom can reuse an identical theme when no shadow exists', () => {
  const input = deck('default');
  const result = moveToCustom(input, { kind: 'themes', reference: 'default:house' });
  assert.equal(result.to.id, 'house');
  assert.equal(result.renamed, undefined);
  assert.equal(resolveReference(result.document, 'colorSchemes', 'brand', { group: 'custom' }).group, 'default');
  assert.equal(resolveDesignRecords(result.document, 0).colorScheme.accent1, '#111111');
  assert.deepEqual(applyPatch(input, result.patch), result.document);
});
