// FA wave C: engines record where each resolved record came from without resolving it again
// (resolveSlideContext().resolved.provenance, resolveDesignRecords().provenance), and the /catalog export keeps the
// shape hosts rely on (opf-pptx reads catalogDisplay.chartTypes[id].mappings).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as catalogEntry from '../dist/catalog.js';
import { CHART_TYPES, LANGUAGES, SOCIAL_PLATFORMS, resolveDesignRecords, resolveSlideContext } from '../dist/index.js';

const { DEFAULT_CATALOG_SOURCE, catalogDisplay, defaultCatalog } = catalogEntry;
const ACME = 'https://acme.example/catalog';
const acme = { source: ACME, themes: { brand: { name: 'Brand', colorScheme: 'brand-colours' } }, colorSchemes: { 'brand-colours': { name: 'Brand colours', accent1: '#123456' } } };

test('resolveSlideContext reports the group, source and origin of every record it resolved', () => {
  const deck = {
    name: 'Provenance',
    design: { theme: 'acme:brand', fontScheme: 'roboto' },
    catalogs: { acme: { source: ACME }, custom: { layouts: { mine: { name: 'Mine', placeholders: [{ type: 'title' }] } } } },
    slides: [{ layout: 'mine', title: 'One' }, { layout: 'two-column', title: 'Two' }, { layout: 'nowhere', title: 'Three' }],
  };
  const catalogs = [defaultCatalog, acme];
  const first = resolveSlideContext(deck, 0, { catalogs }).resolved.provenance;
  assert.deepEqual(first.layout, { kind: 'layouts', reference: 'mine', id: 'mine', group: 'custom', origin: 'document' });
  assert.deepEqual(first.theme, { kind: 'themes', reference: 'acme:brand', id: 'brand', group: 'acme', source: ACME, origin: 'host' });
  // The theme's own colour scheme resolves in the theme's group.
  assert.deepEqual(first.colorScheme, { kind: 'colorSchemes', reference: 'brand-colours', id: 'brand-colours', group: 'acme', source: ACME, origin: 'host' });
  assert.deepEqual(first.fontScheme, { kind: 'fontSchemes', reference: 'roboto', id: 'roboto', group: 'default', source: DEFAULT_CATALOG_SOURCE, origin: 'host' });
  assert.deepEqual(resolveSlideContext(deck, 1, { catalogs }).resolved.provenance.layout, { kind: 'layouts', reference: 'two-column', id: 'two-column', group: 'default', source: DEFAULT_CATALOG_SOURCE, origin: 'host' });
  // Nothing resolved: no provenance (automatic composition for the layout, the engine default for a scheme).
  const third = resolveSlideContext(deck, 2, { catalogs: [] });
  assert.equal(third.resolved.provenance.layout, undefined);
  assert.equal(third.resolved.provenance.theme, undefined);
  assert.equal(third.resolved.provenance.fontScheme, undefined);
  // The provenance carries no record, and agrees with resolveDesignRecords.
  assert.equal('record' in first.layout, false);
  assert.deepEqual(resolveDesignRecords(deck, 0, { catalogs }).provenance, { theme: first.theme, colorScheme: first.colorScheme, fontScheme: first.fontScheme });
});

test('an embedded record reports origin document and its group source', () => {
  const deck = { name: 'Embedded', design: { colorScheme: 'cool-horizon' }, catalogs: { default: { source: DEFAULT_CATALOG_SOURCE, colorSchemes: { 'cool-horizon': defaultCatalog.colorSchemes['cool-horizon'] } } }, slides: [{ title: 'One' }] };
  assert.deepEqual(resolveSlideContext(deck, 0).resolved.provenance.colorScheme, { kind: 'colorSchemes', reference: 'cool-horizon', id: 'cool-horizon', group: 'default', source: DEFAULT_CATALOG_SOURCE, origin: 'document' });
});

test('the /catalog export shape: content kinds, display kinds and chart-type mappings', () => {
  assert.deepEqual(Object.keys(catalogEntry).sort(), ['DEFAULT_CATALOG_SOURCE', 'catalogDisplay', 'catalogIndexes', 'defaultCatalog', 'getLayoutPreview', 'hasLayoutPreview', 'layoutPreviewIndex', 'layoutPreviewSlugs', 'layoutPreviews']);
  assert.deepEqual(Object.keys(defaultCatalog).sort(), ['audiences', 'colorSchemes', 'fontSchemes', 'layouts', 'narratives', 'purposes', 'source', 'themes', 'tones']);
  assert.equal(defaultCatalog.source, DEFAULT_CATALOG_SOURCE);
  assert.deepEqual(Object.keys(catalogDisplay).sort(), ['chartTypes', 'languages', 'socialPlatforms']);
  // Every engine chart type has a display record, and every display record keeps its exporter mappings (opf-pptx).
  assert.deepEqual(Object.keys(catalogDisplay.chartTypes).sort(), [...CHART_TYPES].sort());
  for (const [id, record] of Object.entries(catalogDisplay.chartTypes)) {
    assert.equal(typeof record.name, 'string', id);
    assert.equal(typeof record.mappings?.openxml?.element, 'string', `${id}: mappings.openxml.element`);
    assert.equal('$schema' in record || 'id' in record, false, `${id}: keyed by id, no $schema or id`);
  }
  assert.deepEqual(catalogDisplay.chartTypes.bar.mappings.openxml, { element: 'barChart', barDir: 'bar', grouping: 'clustered', composition: 'single' });
  for (const platform of Object.keys(SOCIAL_PLATFORMS)) assert.ok(catalogDisplay.socialPlatforms[platform], platform);
  assert.equal(Object.keys(catalogDisplay.languages).length > 0 && Object.keys(LANGUAGES).length > 0, true);
});
