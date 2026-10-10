import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import { validateCatalogRecord } from '../dist/index.js';
import { layouts } from './support/catalog.mjs';
import { catalogIndexes } from '@openpresentation/gallery';
import { layoutContent, layoutLeaves } from '../dist/composition.js';

const HEAD = ['title', 'subtitle', 'tag'];
const KINDS = ['text', 'list', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline'];
const layoutSchema = JSON.parse(readFileSync(new URL('../../../spec/schemas/layout.schema.json', import.meta.url), 'utf8'));

test('layoutContent derives the kind, count and headings from the placeholders', () => {
  assert.deepEqual(layoutContent({placeholders: [{type: 'title'}, {type: 'chart'}, {type: 'text'}]}), {kind: 'chart', count: 2, heading: {title: true, subtitle: false, tag: false}});
  assert.deepEqual(layoutContent({placeholders: [{type: 'tag'}, {type: 'title'}, {type: 'subtitle'}]}), {kind: 'title', count: 0, heading: {title: true, subtitle: true, tag: true}});
  assert.deepEqual(layoutContent({placeholders: []}), {kind: 'title', count: 0, heading: {title: false, subtitle: false, tag: false}});
  assert.deepEqual(layoutContent({}), {kind: 'title', count: 0, heading: {title: false, subtitle: false, tag: false}});
  assert.equal(layoutContent({placeholders: [{type: 'title'}, {type: 'text'}, {type: 'list'}, {type: 'list'}]}).kind, 'list', 'the most frequent kind wins');
  assert.equal(layoutContent({placeholders: [{type: 'quote'}, {type: 'image'}, {type: 'image'}, {type: 'quote'}]}).kind, 'quote', 'a tie goes to the first kind in placeholder order');
});

test('the placeholder kinds are one vocabulary', () => {
  assert.deepEqual(layoutSchema.$defs.Placeholder.properties.type.enum, [...HEAD, ...KINDS]);
});

test('every bundled layout record uses the new shape', () => {
  // The gallery package mirrors pptx.gallery (OPF 0.15, RR-78): every layout it publishes, as many as its index lists.
  assert.equal(layouts.length, catalogIndexes.layouts.records.length);
  assert.ok(layouts.length > 100);
  for (const record of layouts) {
    assert.equal(validateCatalogRecord('layouts', record).valid, true, record.id);
    for (const key of Object.keys(record)) assert.ok(key in layoutSchema.properties, `${record.id}: ${key}`);
    const content = layoutContent(record);
    // FA-26: a placeholder group is not a kind; its leaves are.
    for (const placeholder of layoutLeaves(record)) assert.ok([...HEAD, ...KINDS].includes(placeholder.type), `${record.id}: ${placeholder.type}`);
    assert.equal(content.count, layoutLeaves(record).filter(p => KINDS.includes(p.type)).length, record.id);
    for (const value of Object.values(record.design ?? {})) assert.notEqual(value, 'None');
  }
});
