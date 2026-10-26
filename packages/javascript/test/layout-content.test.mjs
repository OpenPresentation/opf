import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery, catalogIndexes } from '@openpresentation/gallery';
import { validateCatalogRecord } from '../dist/index.js';
import { layoutContent, layoutStructure, layoutTemplate } from '../dist/composition.js';

test('layout summaries derive content and headings from template regions', () => {
  assert.deepEqual(layoutContent(gallery.layouts['chart-beside']), { kind: 'chart', count: 2, heading: { title: true, subtitle: true, tag: true } });
  assert.deepEqual(layoutContent({ regions: [{ name: 'title' }] }), { kind: 'title', count: 0, heading: { title: true, subtitle: true, tag: true } });
  assert.deepEqual(layoutContent({}), { kind: 'title', count: 0, heading: { title: false, subtitle: false, tag: false } });
  assert.match(layoutStructure(gallery.layouts['chart-beside']), /chart \(none: chart\)/);
});

test('all 29 gallery layouts validate and report their body region counts', () => {
  assert.equal(Object.keys(gallery.layouts).length, 29);
  assert.equal(catalogIndexes.layouts.records.length, 29);
  for (const [id, record] of Object.entries(gallery.layouts)) {
    assert.equal(validateCatalogRecord('layouts', { ...record, id, $schema: 'https://openpresentation.org/schema/opf-layout/v2' }).valid, true, id);
    assert.equal(layoutContent(record).count, layoutTemplate(record).regions.length, id);
    assert.equal('placeholders' in record, false, id);
  }
});
