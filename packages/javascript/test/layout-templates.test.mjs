import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { validate } from '../dist/index.js';
import { OPFLayoutTemplateError, composeSlide, isLayoutTemplate, layoutContent, layoutStructure, layoutTemplate, layoutTemplateIssues } from '../dist/composition.js';

// A layout is one ordered list of regions (FA-33), nested for two dimensions. The 28 built-in layouts come from
// @openpresentation/gallery.
const fixture = gallery;
const { layouts } = fixture;
const deckWith = (record, slide = { layout: 'probe', title: 'Probe' }) => ({ slides: [slide], catalogs: { custom: { layouts: { probe: record } } } });
const rulesOf = (report) => report.findings.map((entry) => entry.ruleId);
const issues = (record) => layoutTemplateIssues(record).map((issue) => `${issue.code} ${issue.path}`);
const base = { name: 'Probe', regions: [{ name: 'title' }, { name: 'body', accepts: ['text'] }] };
const two = { name: 'Two', regions: [{ name: 'title' }, { direction: 'row', regions: [{ name: 'a', accepts: ['text'], flow: 'none' }, { name: 'b', accepts: ['text'] }] }] };
const regionsOf = (...regions) => ({ ...base, regions });

describe('the 28 built-in templates (design section 6)', () => {
  test('there are 28, in six groups, and every one has a title area', () => {
    assert.equal(Object.keys(layouts).length, 28);
    assert.deepEqual([...new Set(Object.values(layouts).map((record) => record.tags[0]))], ['Openers and closers', 'Text', 'Groups of items', 'Numbers', 'Visuals', 'Mixed']);
    for (const [id, record] of Object.entries(layouts)) assert.ok(JSON.stringify(record.regions).includes('"title"'), id);
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
  test('a valid template has no issue; a record without regions is not a template', () => {
    assert.deepEqual(issues(base), []);
    assert.deepEqual(issues(two), []);
    assert.equal(isLayoutTemplate({ placeholders: [{ type: 'title' }] }), false);
    assert.deepEqual(layoutTemplateIssues({ placeholders: [{ type: 'title' }] }), []);
  });

  test('the list: 1 to 12 entries, a direction, a size, auto only in a column', () => {
    assert.deepEqual(issues({ ...base, regions: [] }), ['layout-template /regions']);
    const thirteen = Array.from({ length: 13 }, (_, index) => ({ name: `r${index}`, accepts: ['text'] }));
    assert.deepEqual(issues({ ...base, regions: thirteen }), ['layout-template /regions']);
    assert.deepEqual(issues({ ...base, regions: [{ name: 'a', accepts: ['text'] }, { direction: 'row', regions: [] }] }), ['layout-template /regions/1/regions']);
    assert.deepEqual(issues({ ...base, direction: 'diagonal' }), ['layout-template /direction']);
    assert.deepEqual(issues({ ...base, regions: [{ name: 'a', size: 0 }] }), ['layout-template /regions/0/size']);
    assert.deepEqual(issues({ ...base, regions: [{ name: 'a', size: 101 }] }), ['layout-template /regions/0/size']);
    assert.deepEqual(issues({ ...base, regions: [{ name: 'a', size: 'wide' }] }), ['layout-template /regions/0/size']);
    assert.deepEqual(issues({ ...base, regions: ['body'] }), ['layout-template /regions/0']);
    assert.deepEqual(issues({ ...base, regions: [{ size: 1 }] }), ['layout-template /regions/0']);
    assert.deepEqual(issues({ ...base, regions: [{ name: 'a', size: 'auto' }, { name: 'b' }] }), []);
    // auto in a row, at the top or inside a split
    assert.deepEqual(issues({ ...base, direction: 'row', regions: [{ name: 'a', size: 'auto' }, { name: 'b' }] }), ['layout-template /regions/0/size']);
    assert.deepEqual(issues({ ...base, regions: [{ direction: 'row', regions: [{ name: 'a', size: 'auto' }, { name: 'b' }] }] }), ['layout-template /regions/0/regions/0/size']);
    assert.deepEqual(issues({ ...base, direction: 'row', regions: [{ direction: 'column', regions: [{ name: 'a', size: 'auto' }, { name: 'b' }] }, { name: 'c' }] }), []);
  });

  test('splits nest three levels at most, and the grid they compile to has at most 12 rows and columns', () => {
    const split = (direction, ...regions) => ({ direction, regions });
    const level3 = split('row', { name: 'a', accepts: ['text'] }, split('column', { name: 'b', accepts: ['text'] }, { name: 'c', accepts: ['text'] }));
    assert.deepEqual(issues({ ...base, regions: [{ name: 'title' }, level3] }), []);
    const level4 = split('row', { name: 'a', accepts: ['text'] }, split('column', { name: 'b', accepts: ['text'] }, split('row', { name: 'c', accepts: ['text'] }, { name: 'd', accepts: ['text'] })));
    assert.deepEqual(issues({ ...base, regions: [{ name: 'title' }, level4] }), ['layout-template /regions/1/regions/1/regions/1/regions']);
    const names = (count, prefix) => Array.from({ length: count }, (_, index) => ({ name: `${prefix}${index}`, accepts: ['text'] }));
    assert.deepEqual(issues({ ...base, direction: 'row', regions: names(12, 'c') }), []);
    // 12 rows, each with its own cut in the other axis: 12 x 12 is allowed, 13 columns are not.
    const grid = (columns, rows) => ({ ...base, regions: Array.from({ length: rows }, (_, row) => split('row', ...names(columns, `r${row}c`))) });
    assert.deepEqual(issues(grid(12, 12)), []);
    assert.deepEqual(issues({ ...base, direction: 'row', regions: [split('column', ...names(6, 'a')), split('column', ...names(7, 'b'))] }), []);
    const staggered = { ...base, regions: [split('row', { name: 'a', size: 1, accepts: ['text'] }, { name: 'b', size: 2, accepts: ['text'] }, { name: 'c', size: 3, accepts: ['text'] }), split('row', { name: 'd', size: 5, accepts: ['text'] }, { name: 'e', size: 7, accepts: ['text'] }, { name: 'f', size: 11, accepts: ['text'] })] };
    assert.ok(layoutTemplate(staggered).columns.length > 3, 'cuts of different rows align into one grid');
  });

  test('the names: unique across the tree, not reserved, headings take only a size', () => {
    assert.deepEqual(issues(regionsOf({ name: 'title' }, { name: 'a', accepts: ['text'] }, { direction: 'row', regions: [{ name: 'a', accepts: ['text'] }, { name: 'b', accepts: ['text'] }] })), ['layout-region /regions/2/regions/0/name']);
    assert.deepEqual(issues(regionsOf({ name: 'title' }, { name: 'title' })), ['layout-region /regions/1/name']);
    for (const word of ['left', 'center', 'right', 'top', 'middle', 'bottom', 'tag', 'auto']) {
      assert.ok(issues(regionsOf({ name: 'title' }, { name: word, accepts: ['text'] })).includes('layout-region /regions/1/name'), word);
    }
    assert.deepEqual(issues(regionsOf({ name: 'Body', accepts: ['text'] })), ['layout-region /regions/0/name']);
    assert.deepEqual(issues(regionsOf({ name: 'title', accepts: ['text'] }, { name: 'body', accepts: ['text'] })), ['layout-region /regions/0/accepts']);
    assert.deepEqual(issues(regionsOf({ name: 'subtitle' }, { name: 'body', accepts: ['text'] })), ['layout-region /regions']);
    assert.deepEqual(issues(regionsOf({ name: 'title' }, { name: 'subtitle' }, { name: 'body', accepts: ['text'] })), []);
  });

  test('the rules: flow none holds one block, a region accepts something, an overflow region exists, anchors are anchors', () => {
    assert.deepEqual(issues(regionsOf({ name: 'body', accepts: ['text'], flow: 'none', max: 2 })), ['layout-region /regions/0/max']);
    assert.deepEqual(issues(regionsOf({ name: 'body', accepts: [] })), ['layout-region /regions/0/accepts']);
    assert.deepEqual(issues({ ...base, overflowRegion: 'notes' }), ['layout-region /overflowRegion']);
    assert.deepEqual(issues({ ...base, overflowRegion: 'title' }), ['layout-region /overflowRegion']);
    assert.deepEqual(issues({ ...base, anchor: 'centre' }), ['layout-template /anchor']);
    assert.deepEqual(issues({ ...base, regions: [{ direction: 'row', anchor: 'sideways', regions: [{ name: 'a', accepts: ['text'] }] }] }), ['layout-template /regions/0/anchor']);
  });

  test('validate reports them on embedded records, and the schema checks types, kinds and unknown keys', () => {
    const repeated = validate(deckWith(regionsOf({ name: 'a' }, { name: 'a' })), { only: ['format', 'references'] });
    assert.ok(rulesOf(repeated).includes('opf/layout-region'));
    const reserved = validate(deckWith(regionsOf({ name: 'title' }, { name: 'left', accepts: ['text'] })), { only: ['format', 'references'] });
    assert.ok(rulesOf(reserved).includes('opf/layout-region') || rulesOf(reserved).includes('opf/catalog-record'));
    const tooDeep = validate(deckWith({ ...base, regions: [{ direction: 'row', regions: [{ direction: 'column', regions: [{ direction: 'row', regions: [{ direction: 'column', regions: [{ name: 'a' }] }] }] }] }] }), { only: ['format', 'references'] });
    assert.ok(rulesOf(tooDeep).includes('opf/layout-template'));
    const rowAuto = validate(deckWith({ ...base, direction: 'row', regions: [{ name: 'a', size: 'auto' }] }), { only: ['format', 'references'] });
    assert.ok(rulesOf(rowAuto).includes('opf/layout-template'));
    const kind = validate(deckWith(regionsOf({ name: 'body', accepts: ['diagram'] })), { only: ['format', 'references'] });
    assert.ok(rulesOf(kind).includes('opf/catalog-record'));
    const legacyMode = validate(deckWith({ ...base, composition: { mode: 'row' } }), { only: ['format', 'references'] });
    assert.ok(rulesOf(legacyMode).includes('opf/catalog-record'), 'a template has no composition.mode');
    const heading = validate(deckWith(regionsOf({ name: 'title', flow: 'column' })), { only: ['format', 'references'] });
    assert.ok(rulesOf(heading).includes('opf/catalog-record'), 'a heading region takes only a size');
  });

  test('the former grid keys are not part of the format: a record with areas, columns, rows or a regions map is invalid', () => {
    for (const key of ['areas', 'columns', 'rows']) {
      const report = validate(deckWith({ ...base, [key]: key === 'areas' ? [['title'], ['body']] : [1, 1] }), { only: ['format', 'references'] });
      assert.ok(rulesOf(report).includes('opf/catalog-record'), key);
    }
    const map = validate(deckWith({ name: 'Map', regions: { body: { accepts: ['text'] } } }), { only: ['format', 'references'] });
    assert.ok(rulesOf(map).includes('opf/catalog-record'));
    // A record with only the old keys has no regions list: automatic composition, and the schema says so.
    assert.equal(isLayoutTemplate({ name: 'Old', areas: [['title']] }), false);
  });

  test("'auto' is reserved: no catalog may define a layout of that id", () => {
    const report = validate({ slides: [{ title: 'x' }], catalogs: { custom: { layouts: { auto: base } } } }, { only: ['format', 'references'] });
    assert.ok(report.findings.some((entry) => entry.ruleId === 'opf/catalog-record' && entry.path.startsWith('/catalogs/custom/layouts/auto')));
  });

  test('composeSlide refuses a template with either finding', () => {
    assert.throws(() => composeSlide({ title: 'x' }, { layout: { ...base, regions: [] } }), OPFLayoutTemplateError);
    assert.throws(() => layoutTemplate(regionsOf({ name: 'a' }, { name: 'a' })), (error) => error instanceof RangeError && error.issues[0].code === 'layout-region');
    assert.throws(() => layoutTemplate({ ...base, direction: 'row', regions: [{ name: 'a', size: 'auto' }] }), (error) => error instanceof RangeError && error.issues[0].code === 'layout-template');
  });

  test('defaults: accepts every kind, role primary, flow auto, max 1 for none and 6 otherwise, collapse, top, one list column', () => {
    const template = layoutTemplate({ name: 'x', regions: [{ name: 'title' }, { direction: 'row', regions: [{ name: 'a', accepts: ['text'], flow: 'none' }, { name: 'b' }] }] });
    assert.deepEqual(template.regions.map((region) => [region.name, region.role, region.flow, region.max, region.empty, region.anchor, region.listColumns, region.bleed]), [
      ['a', 'primary', 'none', 1, 'collapse', 'top', 1, false],
      ['b', 'primary', 'auto', 6, 'collapse', 'top', 1, false],
    ]);
    assert.deepEqual(template.regions[1].accepts, ['text', 'list', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline', 'group']);
    // overflowRegion: the first primary region whose flow is not none.
    assert.equal(template.overflowRegion, 'b');
  });

  test('anchor is inherited from the record and from a split by body regions only, and a region keeps its own', () => {
    const template = layoutTemplate({
      name: 'x',
      anchor: 'middle',
      regions: [
        { name: 'title' },
        { name: 'a', accepts: ['text'] },
        { direction: 'row', anchor: 'bottom', regions: [{ name: 'b', accepts: ['text'] }, { name: 'c', accepts: ['text'], anchor: 'top' }] },
      ],
    });
    assert.deepEqual(template.regions.map((region) => [region.name, region.anchor]), [['a', 'middle'], ['b', 'bottom'], ['c', 'top']]);
    assert.equal('anchor' in template.areas[0], false, 'a heading region has no anchor');
    assert.deepEqual(layoutStructure({ name: 'x', anchor: 'middle', regions: [{ name: 'title' }, { name: 'a', accepts: ['text'] }] }), 'title, a (auto: text)');
  });

  test('the sizes: siblings share their parent in proportion, the cuts of different rows align, auto stays auto', () => {
    const template = layoutTemplate({ name: 'x', regions: [{ name: 'title' }, { name: 'a', size: 2, accepts: ['text'] }, { name: 'b', accepts: ['text'] }, { name: 'z', size: 'auto', accepts: ['text'] }] });
    assert.deepEqual(template.rows, ['auto', 2, 1, 'auto']);
    assert.deepEqual(template.columns, [1]);
    const nested = layoutTemplate({
      name: 'y',
      regions: [
        { direction: 'row', regions: [{ name: 'a', size: 1, accepts: ['text'] }, { name: 'b', size: 1, accepts: ['text'] }] },
        { direction: 'row', regions: [{ name: 'c', size: 1, accepts: ['text'] }, { name: 'd', size: 2, accepts: ['text'] }] },
      ],
    });
    assert.deepEqual(nested.columns, [2, 1, 3]); // cuts at 1/3 and 1/2: sixths 2, 1, 3
  });

  test('reading order is the order of the list, depth first', () => {
    const template = layoutTemplate(layouts.hero);
    assert.deepEqual(template.areas.map((area) => area.name), ['title', 'lead', 'media', 'support']);
    const custom = layoutTemplate({
      name: 'x',
      regions: [{ name: 'title' }, { direction: 'row', regions: [{ name: 'timeline', size: 2, accepts: ['timeline'], flow: 'none' }, { direction: 'column', regions: [{ name: 'notes', accepts: ['text'] }, { name: 'metrics', accepts: ['metric', 'text'], flow: 'grid' }] }] }],
    });
    assert.deepEqual(custom.regions.map((region) => region.name), ['timeline', 'notes', 'metrics']);
    assert.deepEqual(custom.grid, [['title', 'title'], ['timeline', 'notes'], ['timeline', 'metrics']]);
    assert.deepEqual(custom.columns, [2, 1]);
    assert.deepEqual(custom.rows, ['auto', 1, 1]);
  });
});

describe('no migration path from the 0.18 ids (owner decision, 2026-10-10)', () => {
  // The 0.19 catalog: the 28 templates under the default catalog's source, so a removed 0.18 id resolves nowhere.
  const gallery2 = { source: 'https://www.pptx.gallery', layouts };

  test('a former id such as list-2x is an unknown layout: opf/unresolved-reference, automatic composition', async () => {
    const { findValidationRule, resolveSlideContext } = await import('../dist/index.js');
    const deck = { slides: [{ layout: 'list-2x', title: 'Points', items: ['a', 'b'] }] };
    const report = validate(deck, { catalogs: [gallery2] });
    const found = report.findings.filter((entry) => entry.path === '/slides/0/layout');
    assert.deepEqual(found.map((entry) => [entry.ruleId, entry.severity]), [['opf/unresolved-reference', 'warning']]);
    assert.equal(findValidationRule('layout-removed'), undefined, 'no removed-layout rule');
    const context = resolveSlideContext(deck, 0, { catalogs: [gallery2] });
    assert.equal(context.options.layout, undefined);
    assert.deepEqual(context.diagnostics.map((entry) => entry.code), ['unresolved-reference']);
    assert.throws(() => resolveSlideContext(deck, 0, { catalogs: [gallery2], strictReferences: true }), /resolves nowhere/);
  });

  test('the six reused ids resolve to the 0.19 built-ins', async () => {
    const { resolveSlideContext } = await import('../dist/index.js');
    for (const id of ['agenda', 'comparison', 'dashboard', 'faq', 'timeline', 'two-column']) {
      const deck = { slides: [{ layout: id, title: 'x' }] };
      assert.deepEqual(validate(deck, { catalogs: [gallery2] }).findings.filter((entry) => entry.path === '/slides/0/layout'), [], id);
      assert.ok(isLayoutTemplate(resolveSlideContext(deck, 0, { catalogs: [gallery2] }).options.layout), id);
    }
  });
});
