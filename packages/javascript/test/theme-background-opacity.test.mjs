import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate, validateCatalogRecord } from '../dist/index.js';
import { validate as browserValidate } from '../dist/browser.js';

const themeRecord = background => ({
  $schema: 'https://openpresentation.org/schema/opf-theme/v1',
  id: 'opacity-control', name: 'Opacity control', background,
});
const deck = background => ({ slides: [{ design: { background } }] });
const check = (background, expected) => {
  for (const run of [validate, browserValidate]) {
    const actual = run(deck(background), { only: ['format'] });
    assert.equal(actual.schemaValid, expected, JSON.stringify(background));
  }
  const catalog = validateCatalogRecord('themes', themeRecord(background));
  assert.equal(catalog.schemaValid, expected, `catalog ${JSON.stringify(background)}`);
};

test('theme-slot opacity is typed consistently in public Node, browser and theme-catalog validation', () => {
  for (const slot of ['light1', 'light2', 'dark1', 'dark2']) {
    check({ type: 'theme', slot }, true);
    for (const opacity of [0, .25, .5, 1]) check({ type: 'theme', slot, opacity }, true);
  }
});

test('theme-slot opacity rejects values outside 0..1 and non-numbers', () => {
  for (const opacity of [-.01, 1.01, '0.25', null, false, {}, []]) {
    check({ type: 'theme', slot: 'dark1', opacity }, false);
  }
});

test('adding the supported property preserves strict document-background vocabulary', () => {
  for (const extra of [{ opactiy: .25 }, { color: '#123456' }, { unexpected: true }]) {
    for (const run of [validate, browserValidate]) {
      const result = run(deck({ type: 'theme', slot: 'dark1', opacity: .25, ...extra }), { only: ['format'] });
      assert.equal(result.schemaValid, false);
      assert.ok(result.findings.some(finding => finding.ruleId === 'opf/schema' && finding.path.endsWith(`/${Object.keys(extra)[0]}`)));
    }
  }
});
