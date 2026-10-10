import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { LAYOUT_MIGRATION, applyPatch, convertLayoutRecord, layoutMigrationRow, migrate, migrateSlide, validate } from '../dist/index.js';
import { bindRegions, composeSlide, layoutTemplateIssues } from '../dist/composition.js';
import { fromMarkdown, toMarkdown } from '../dist/markdown.js';

// OPF 0.19 (RR-79), design section 9: the 278 removed ids, opf/layout-removed and migrate(). The table is data in core
// (spec/reference/layout-migration.json); the design doc's mapping table is generated from it.
const table = JSON.parse(readFileSync(new URL('../../../spec/reference/layout-migration.json', import.meta.url), 'utf8'));
const { layouts: templates } = JSON.parse(readFileSync(new URL('./fixtures/layout-templates-0.19.json', import.meta.url), 'utf8'));
// The 0.19 catalog: the 28 templates under the default catalog's source, so the old ids resolve nowhere.
const gallery2 = { source: 'https://www.pptx.gallery', layouts: templates };

describe('the mapping table', () => {
  test('278 rows, every target one of the 28 or auto, every one of the 28 the target of a row', () => {
    const rows = Object.entries(LAYOUT_MIGRATION);
    assert.equal(rows.length, 278);
    assert.deepEqual(LAYOUT_MIGRATION, table.layouts);
    const targets = new Set(rows.map(([, row]) => row.layout));
    for (const target of targets) assert.ok(target === 'auto' || templates[target], target);
    for (const id of Object.keys(templates)) assert.ok(targets.has(id), id);
  });

  test('the totals of the design doc: 216 rows write settings, 16 groups, 6 placements, 1 dropped layout', () => {
    const rows = Object.values(LAYOUT_MIGRATION);
    assert.equal(rows.filter((row) => row.design).length, 216);
    const counts = {};
    for (const row of rows) for (const [key, value] of Object.entries(row.design ?? {})) counts[`${key}: ${value}`] = (counts[`${key}: ${value}`] ?? 0) + 1;
    assert.deepEqual(counts, { 'contentAlignment: center': 109, 'titleAlignment: center': 89, 'contentBox: true': 77, 'contentDirection: vertical': 72, 'listBullet: image': 23, 'imageFit: contain': 19, 'titleAlignment: left': 5, 'contentBox: false': 2, 'contentAlignment: left': 1 });
    assert.equal(rows.filter((row) => row.content?.groups).length, 16);
    assert.equal(rows.filter((row) => row.content?.placement).length, 6);
    assert.equal(rows.filter((row) => row.content?.dropLayout).length, 1);
  });

  test('a removed id maps whether bare or default:, and nothing else does', () => {
    assert.equal(layoutMigrationRow('text-1x').layout, 'text');
    assert.equal(layoutMigrationRow('default:list-3x-box').layout, 'list');
    assert.equal(layoutMigrationRow('acme:text-1x'), undefined);
    assert.equal(layoutMigrationRow('pillars'), undefined);
  });
});

describe('opf/layout-removed', () => {
  test('a removed id that resolves nowhere is an error with a safe fix that applies its row', () => {
    const deck = { slides: [{ layout: 'list-3x-box-vertical', title: 'Points', blocks: [{ items: ['a'] }, { items: ['b'] }] }] };
    const report = validate(deck, { catalogs: [gallery2] });
    const found = report.findings.find((entry) => entry.ruleId === 'opf/layout-removed');
    assert.equal(found.severity, 'error');
    assert.equal(found.path, '/slides/0/layout');
    assert.match(found.message, /'list'.*contentBox: true, contentDirection: "vertical"/);
    assert.ok(!report.findings.some((entry) => entry.ruleId === 'opf/unresolved-reference'));
    const fix = found.fixes[0];
    assert.equal(fix.safe, true);
    const fixed = applyPatch(deck, fix.patch);
    assert.deepEqual(fixed.slides[0], { layout: 'list', title: 'Points', blocks: deck.slides[0].blocks, design: { contentBox: true, contentDirection: 'vertical' } });
    assert.ok(!validate(fixed, { catalogs: [gallery2] }).findings.some((entry) => entry.severity === 'error'));
  });

  test('an id that still resolves (the 0.18 default catalog during the transition) is not reported', () => {
    const deck = { slides: [{ layout: 'text-1x', title: 'x' }], catalogs: { default: { layouts: { 'text-1x': { name: 'Text', placeholders: [{ type: 'title' }, { type: 'text' }] } } } } };
    assert.ok(!validate(deck).findings.some((entry) => entry.ruleId === 'opf/layout-removed'));
  });

  test('a custom group name is never a removed id', () => {
    const deck = { catalogs: { acme: { source: 'https://acme.example' } }, slides: [{ layout: 'acme:text-1x' }] };
    const ids = validate(deck).findings.map((entry) => entry.ruleId);
    assert.ok(ids.includes('opf/unresolved-reference') && !ids.includes('opf/layout-removed'));
  });
});

describe('migrateSlide', () => {
  test('writes only the settings neither the slide nor the deck sets', () => {
    const row = LAYOUT_MIGRATION['text-1x-center-box-title-center'];
    assert.deepEqual(migrateSlide({ layout: 'text-1x-center-box-title-center', design: { contentBox: false } }, row, { titleAlignment: 'right' }), { layout: 'text', design: { contentBox: false, contentAlignment: 'center' } });
  });

  test('blank drops the layout', () => {
    assert.deepEqual(migrateSlide({ layout: 'blank', title: 'x' }, LAYOUT_MIGRATION.blank), { title: 'x' });
  });

  test('a placement row moves the band onto the matching top-level image, a root image becoming a block', () => {
    const row = LAYOUT_MIGRATION['title-left-image-right'];
    assert.deepEqual(row.content.placement.edge, 'right');
    const out = migrateSlide({ layout: 'title-left-image-right', title: 'x', image: 'https://example.com/a.png' }, row);
    assert.deepEqual(out, { layout: 'cover', title: 'x', design: { titleAlignment: 'left' }, blocks: [{ image: 'https://example.com/a.png', placement: { edge: 'right' } }] });
    const kept = migrateSlide({ layout: 'title-left-image-right', blocks: [{ image: 'x.png', placement: { edge: 'left' } }] }, row);
    assert.deepEqual(kept.blocks[0].placement, { edge: 'left' }, 'a block with its own placement keeps it');
  });

  test('a groups row wraps the slide\'s blocks into content groups the shape of the old record', () => {
    const row = LAYOUT_MIGRATION['chart-2x'];
    assert.ok(row.content.groups.every((entry) => entry.type === 'group'));
    const chart = { chart: { type: 'pie', data: { columns: ['k', 'v'], rows: [['a', 1]] } } };
    const out = migrateSlide({ layout: 'chart-2x', title: 'x', blocks: [chart, { text: 'one' }, chart, { text: 'two' }] }, row);
    assert.equal(out.layout, 'chart');
    assert.equal(out.blocks.length, 2);
    assert.ok(out.blocks.every((block) => Array.isArray(block.blocks) && block.blocks.length === 2));
    // A slide with its own groups keeps its structure.
    const own = { layout: 'chart-2x', blocks: [{ blocks: [chart] }] };
    assert.deepEqual(migrateSlide(own, row).blocks, own.blocks);
  });
});

describe('migrate()', () => {
  test('rewrites every slide that names a removed id, hoists a setting every slide received, and reports the changes', () => {
    const deck = { slides: [{ layout: 'list-2x-box', title: 'a', blocks: [{ items: ['x'] }] }, { layout: 'number-3x-box', title: 'b', blocks: [{ metric: { value: 1 } }] }] };
    const { document, changes } = migrate(deck, { catalogs: [gallery2] });
    assert.deepEqual(document.slides.map((slide) => slide.layout), ['list', 'metrics']);
    assert.deepEqual(document.design, { contentBox: true });
    assert.deepEqual(document.slides[0].design, { contentAlignment: 'center' });
    assert.equal(document.slides[1].design, undefined);
    assert.deepEqual(changes.map((change) => change.code), ['layout-migrated', 'layout-migrated', 'design-hoisted']);
    assert.notEqual(document, deck);
    assert.equal(deck.slides[0].layout, 'list-2x-box', 'the input is never changed');
  });

  test('migrates removed ids even when a 0.18 record still resolves, and drops embedded copies nobody names', () => {
    const deck = { slides: [{ layout: 'text-1x', title: 'x', text: 'y' }], catalogs: { default: { layouts: { 'text-1x': { name: 'Text', placeholders: [{ type: 'title' }, { type: 'text' }] } } } } };
    const { document, changes } = migrate(deck);
    assert.equal(document.slides[0].layout, 'text');
    assert.equal(document.catalogs.default.layouts, undefined);
    assert.ok(changes.some((change) => change.code === 'layout-dropped'));
  });

  test('converts an embedded 0.18 custom record into a template', () => {
    const record = { name: 'Chart left, text right', placeholders: [{ type: 'title' }, { type: 'text' }, { type: 'chart' }], composition: { mode: 'row', weights: [2, 3] } };
    const deck = { catalogs: { custom: { layouts: { split: record } } }, slides: [{ layout: 'split', title: 'x', blocks: [{ text: 'first' }, { text: 'second' }] }] };
    const { document, changes } = migrate(deck);
    const converted = document.catalogs.custom.layouts.split;
    assert.deepEqual(converted.areas, ['title title', 'text chart']);
    assert.deepEqual(converted.columns, [2, 3]);
    assert.deepEqual(converted.rows, ['auto', 1]);
    assert.deepEqual(layoutTemplateIssues(converted), []);
    assert.ok(changes.some((change) => change.code === 'layout-converted'));
    assert.ok(!validate(document).findings.some((entry) => entry.severity === 'error'));
  });

  test('slides on a converted record keep the blocks where 0.18 put them', () => {
    const record = { name: 'x', placeholders: [{ type: 'title' }, { type: 'group', composition: { mode: 'column' }, placeholders: [{ type: 'text' }, { type: 'text' }] }, { type: 'text' }], composition: { mode: 'row' } };
    const deck = { catalogs: { custom: { layouts: { panels: record } } }, slides: [{ layout: 'panels', blocks: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] }] };
    const { document } = migrate(deck);
    const binding = bindRegions(document.slides[0], document.catalogs.custom.layouts.panels);
    assert.deepEqual(binding.regions.map((region) => [region.name, region.blocks.map((block) => block.block)]), [['text', [0, 1]], ['text-2', [2]]]);
  });

  test('a record with no mode becomes one auto region accepting the union of its kinds', () => {
    const { record, leafRegions } = convertLayoutRecord({ name: 'x', placeholders: [{ type: 'title' }, { type: 'text' }, { type: 'list' }, { type: 'text' }] });
    assert.deepEqual(record.areas, ['title', 'text']);
    assert.deepEqual(record.regions, { text: { accepts: ['text', 'list'], role: 'primary', flow: 'auto' } });
    assert.deepEqual(leafRegions, ['text', 'text', 'text']);
  });

  test('a placeholder group becomes one region of its leaf kinds; a placed image a bled region on its edge', () => {
    const grouped = convertLayoutRecord({ name: 'x', placeholders: [{ type: 'title' }, { type: 'chart' }, { type: 'group', composition: { mode: 'column' }, placeholders: [{ type: 'text' }, { type: 'metric' }] }], composition: { mode: 'row' } });
    assert.deepEqual(grouped.record.areas, ['title title', 'chart text']);
    assert.deepEqual(grouped.record.regions.text, { accepts: ['text', 'metric', 'group'], role: 'primary', flow: 'column', max: 2 });
    assert.deepEqual(grouped.leafRegions, ['chart', 'text', 'text']);
    const placed = convertLayoutRecord({ name: 'x', placeholders: [{ type: 'title' }, { type: 'image', placement: { edge: 'left', size: 0.4 } }] });
    assert.deepEqual(placed.record.areas, ['image title']);
    assert.deepEqual(placed.record.regions.image, { accepts: ['image'], role: 'media', flow: 'none', bleed: true });
    assert.deepEqual(layoutTemplateIssues(placed.record), []);
    assert.ok(composeSlide({ title: 'x', blocks: [{ image: 'https://example.com/a.png' }] }, { layout: placed.record }).regions[0].box.x === 0);
  });

  test('migrated slides of the core examples compose on the 28 templates', () => {
    const example = JSON.parse(readFileSync(new URL('../../../examples/gallery/business-functions/renewal-save-plan.opf.json', import.meta.url), 'utf8'));
    const { document } = migrate(example, { catalogs: [gallery2] });
    for (const slide of document.slides) {
      if (slide.layout === undefined) continue;
      assert.ok(templates[slide.layout], slide.layout);
      assert.doesNotThrow(() => composeSlide(slide, { layout: templates[slide.layout] }));
      assert.doesNotThrow(() => bindRegions(slide, templates[slide.layout]));
    }
  });
});

describe('the Markdown dialect', () => {
  test('region=<name> pins a block; region=<promoted key> is still a promoted region; layout=auto is read', () => {
    const source = '<!-- slide: layout=roadmap-split -->\n# Roadmap\n\nFirst\n\n<!-- block: region=metrics -->\nTargets agreed with finance.\n\n---\n\n<!-- slide: layout=auto -->\n# Plain\n\n<!-- block: region=left -->\nLeft side\n';
    const { presentation } = fromMarkdown(source, { validate: false });
    assert.deepEqual(presentation.slides[0].blocks, [{ text: 'First' }, { region: 'metrics', text: 'Targets agreed with finance.' }]);
    assert.equal(presentation.slides[1].layout, 'auto');
    assert.deepEqual(presentation.slides[1].left, { text: 'Left side' });
    const back = fromMarkdown(toMarkdown(presentation).markdown, { validate: false }).presentation;
    assert.deepEqual(back.slides[0].blocks, presentation.slides[0].blocks);
  });

  test('a single pinned block stays a block', () => {
    const { presentation } = fromMarkdown('# x\n\n<!-- block: region=notes -->\nOnly one\n', { validate: false });
    assert.deepEqual(presentation.slides[0].blocks, [{ region: 'notes', text: 'Only one' }]);
  });
});
