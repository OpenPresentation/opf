import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { validate } from '../dist/index.js';
import { OPFLayoutTemplateError, composeSlide, isLayoutTemplate, layoutContent, layoutStructure, layoutTemplate, layoutTemplateIssues } from '../dist/composition.js';

// OPF 0.19 (RR-79): a layout is a grid template (areas, columns, rows, regions). The 28 built-in layouts of the design
// doc are a test fixture until @openpresentation/gallery 2.0.0 ships them (RR-80); replace the fixture with the package then.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/layout-templates-0.19.json', import.meta.url), 'utf8'));
const layouts = fixture.layouts;
const deckWith = (record, slide = { layout: 'probe', title: 'Probe' }) => ({ slides: [slide], catalogs: { custom: { layouts: { probe: record } } } });
const rulesOf = (report) => report.findings.map((entry) => entry.ruleId);
const issues = (record) => layoutTemplateIssues(record).map((issue) => `${issue.code} ${issue.path}`);
const base = { name: 'Probe', areas: ['title', 'body'], rows: ['auto', 1], regions: { body: { accepts: ['text'] } } };

describe('the 28 built-in templates (design section 6)', () => {
  test('there are 28, in six groups, and every one has a title area', () => {
    assert.equal(Object.keys(layouts).length, 28);
    assert.deepEqual([...new Set(Object.values(layouts).map((record) => record.tags[0]))], ['Openers and closers', 'Text', 'Groups of items', 'Numbers', 'Visuals', 'Mixed']);
    for (const [id, record] of Object.entries(layouts)) assert.ok(record.areas.some((row) => row.split(/\s+/).includes('title')), id);
  });

  test('every one passes the schema and the template rules, embedded in a deck', () => {
    const deck = { slides: Object.keys(layouts).map((id) => ({ layout: id, title: id })), catalogs: { custom: { layouts } } };
    const report = validate(deck, { only: ['format', 'references'] });
    assert.deepEqual(report.findings.filter((entry) => entry.severity === 'error'), []);
    for (const [id, record] of Object.entries(layouts)) {
      assert.ok(isLayoutTemplate(record), id);
      assert.deepEqual(layoutTemplateIssues(record), [], id);
    }
  });

  test('every body region collapses when empty, so each one composes a title-only slide', () => {
    for (const [id, record] of Object.entries(layouts)) {
      const result = composeSlide({ title: 'Only a title' }, { layout: record });
      assert.ok(result.regions.every((region) => region.collapsed || region.box.height === 0 || !region.content.length), id);
      assert.equal(result.items.filter((item) => item.field === 'title').length, 1, id);
    }
  });

  test('layoutContent and layoutStructure read the regions', () => {
    assert.deepEqual(layoutContent(layouts['chart-beside']), { kind: 'chart', count: 2, heading: { title: true, subtitle: true, tag: true } });
    assert.deepEqual(layoutContent(layouts.section), { kind: 'title', count: 0, heading: { title: true, subtitle: true, tag: true } });
    assert.equal(layoutContent(layouts.gallery).kind, 'image');
    assert.equal(layoutStructure(layouts['chart-beside']), 'title, chart (none: chart), notes (column: text, list, metric, quote, chart)');
  });
});

describe('the template rules (opf/layout-template, opf/layout-region)', () => {
  test('a valid template has no issue; a record without areas is not a template', () => {
    assert.deepEqual(issues(base), []);
    assert.equal(isLayoutTemplate({ placeholders: [] }), false);
    assert.deepEqual(layoutTemplateIssues({ placeholders: [] }), []);
  });

  test('the grid: ragged rows, rectangles, track lengths, size and words', () => {
    assert.deepEqual(issues({ ...base, areas: ['title title', 'body'], rows: ['auto', 1], columns: [1, 1] }), ['layout-template /areas/1']);
    assert.deepEqual(issues({ ...base, areas: ['body title', 'title body'], rows: [1, 1], columns: [1, 1] }), ['layout-template /areas', 'layout-template /areas']);
    assert.deepEqual(issues({ ...base, columns: [1, 2] }), ['layout-template /columns']);
    assert.deepEqual(issues({ ...base, rows: [1] }), ['layout-template /rows']);
    assert.deepEqual(issues({ ...base, areas: ['title', 'Body'] }), ['layout-template /areas/1']);
    const wide = Array.from({ length: 13 }, (_, index) => `c${index}`).join(' ');
    assert.ok(issues({ ...base, areas: [wide], rows: [1], columns: Array(13).fill(1), regions: {} }).includes('layout-template /areas'));
    const tall = Array.from({ length: 13 }, () => 'body');
    assert.ok(issues({ ...base, areas: tall, rows: Array(13).fill(1) }).includes('layout-template /areas'));
    // '.' is an empty cell, never an area.
    assert.deepEqual(issues({ ...base, areas: ['title .', 'body body'], columns: [1, 1] }), []);
  });

  test('the regions: every body area has one, every region an area, no reserved name', () => {
    assert.deepEqual(issues({ ...base, regions: {} }), ['layout-region /regions']);
    assert.deepEqual(issues({ ...base, regions: { body: { accepts: ['text'] }, notes: { accepts: ['text'] } } }), ['layout-region /regions/notes']);
    for (const word of ['left', 'center', 'right', 'top', 'middle', 'bottom', 'tag', 'auto']) {
      const found = issues({ ...base, areas: ['title', word], regions: { [word]: { accepts: ['text'] } } });
      assert.ok(found.includes(`layout-region /regions/${word}`), word);
    }
    assert.deepEqual(issues({ ...base, areas: ['subtitle', 'body'] }), ["layout-region /areas"]);
    assert.deepEqual(issues({ ...base, regions: { body: { accepts: ['text'], flow: 'none', max: 2 } } }), ['layout-region /regions/body/max']);
    assert.deepEqual(issues({ ...base, overflowRegion: 'notes' }), ['layout-region /overflowRegion']);
  });

  test('validate reports them on embedded records, and the schema checks types and kinds', () => {
    const ragged = validate(deckWith({ ...base, areas: ['title title', 'body'], rows: ['auto', 1], columns: [1, 1] }), { only: ['format', 'references'] });
    assert.ok(rulesOf(ragged).includes('opf/layout-template'));
    const reserved = validate(deckWith({ ...base, areas: ['title', 'left'], regions: { left: { accepts: ['text'] } } }), { only: ['format', 'references'] });
    assert.ok(rulesOf(reserved).includes('opf/layout-region'));
    const kind = validate(deckWith({ ...base, regions: { body: { accepts: ['diagram'] } } }), { only: ['format', 'references'] });
    assert.ok(rulesOf(kind).includes('opf/catalog-record'));
    const legacyMode = validate(deckWith({ ...base, composition: { mode: 'row' } }), { only: ['format', 'references'] });
    assert.ok(rulesOf(legacyMode).includes('opf/catalog-record'), 'a template has no composition.mode');
  });

  test("'auto' is reserved: no catalog may define a layout of that id", () => {
    const report = validate({ slides: [{ title: 'x' }], catalogs: { custom: { layouts: { auto: base } } } }, { only: ['format', 'references'] });
    assert.ok(report.findings.some((entry) => entry.ruleId === 'opf/catalog-record' && entry.path.startsWith('/catalogs/custom/layouts/auto')));
  });

  test('composeSlide refuses a template with either finding', () => {
    assert.throws(() => composeSlide({ title: 'x' }, { layout: { ...base, regions: {} } }), OPFLayoutTemplateError);
    assert.throws(() => layoutTemplate({ ...base, columns: [1, 1] }), (error) => error instanceof RangeError && error.issues[0].code === 'layout-template');
  });

  test('defaults: role primary, flow auto, max 1 for none and 6 otherwise, collapse, top, one list column', () => {
    const template = layoutTemplate({ ...base, areas: ['title title', 'a b'], columns: [1, 1], regions: { a: { accepts: ['text'], flow: 'none' }, b: { accepts: ['text'] } } });
    assert.deepEqual(template.regions.map((region) => [region.name, region.role, region.flow, region.max, region.empty, region.anchor, region.listColumns, region.bleed]), [
      ['a', 'primary', 'none', 1, 'collapse', 'top', 1, false],
      ['b', 'primary', 'auto', 6, 'collapse', 'top', 1, false],
    ]);
    // overflowRegion: the first primary region whose flow is not none.
    assert.equal(template.overflowRegion, 'b');
  });

  test('reading order is by top-left cell, row by row', () => {
    const template = layoutTemplate(layouts.hero);
    assert.deepEqual(template.areas.map((area) => area.name), ['title', 'lead', 'media', 'support']);
    const custom = layoutTemplate({ name: 'x', areas: ['title title', 'timeline notes', 'timeline metrics'], columns: [2, 1], rows: ['auto', 1, 1], regions: { timeline: { accepts: ['timeline'], flow: 'none' }, notes: { accepts: ['text'] }, metrics: { accepts: ['metric'] } } });
    assert.deepEqual(custom.regions.map((region) => region.name), ['timeline', 'notes', 'metrics']);
  });
});
