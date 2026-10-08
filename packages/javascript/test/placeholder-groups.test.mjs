import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { resolveSlideContext, validate, validateCatalogRecord } from '../dist/index.js';
import { MAX_PLACEHOLDER_GROUP_DEPTH, chartPrimaryLayout, composeSlide, layoutContent, layoutLeaves, layoutSlots } from '../dist/composition.js';
import { paginateSlide } from '../dist/pagination.js';
import { errorsOf } from './support/validation.mjs';

// FA-26: a layout record placeholder may be a group { type: "group", composition, placeholders }. Slide content stays
// flat and fills the leaves in reading order; groups nest at most three levels; design.chartPrimary is sugar for a group.
// docs/fixtures/placeholder-groups.opf.json is the cross-engine fixture (scripts/test-placeholder-groups-ecosystem.mjs).

const fixture = JSON.parse(readFileSync(new URL('../../../docs/fixtures/placeholder-groups.opf.json', import.meta.url), 'utf8'));
const layouts = fixture.catalogs.custom.layouts;
const compose = (slide, layout, extra = {}) => composeSlide(slide, { layout, ...extra });
const body = (result) => result.items.filter((item) => !['tag', 'title', 'subtitle'].includes(item.field));
const boxes = (result) => body(result).map((item) => item.box);
const group = (composition, placeholders) => ({ type: 'group', ...(composition ? { composition } : {}), placeholders });
const record = (placeholders, extra = {}) => ({ $schema: 'https://openpresentation.org/schema/opf-layout/v1', id: 'nested', name: 'Nested', placeholders, ...extra });
const nest = (levels) => (levels === 0 ? { type: 'text' } : group(undefined, [nest(levels - 1)]));
const chart = { type: 'chart', chart: { type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', 4.1], ['Q2', 4.5]] } } };

describe('the nested example (0.15 design, "Arrangement model")', () => {
  const slide = fixture.slides.find((entry) => entry.id === 'nested-example');
  const layout = layouts['stacked-text-chart-right'];

  test('the document validates and composes with no host catalog', () => {
    assert.equal(errorsOf(validate(fixture)).length, 0);
    for (const [index] of fixture.slides.entries()) assert.doesNotThrow(() => composeSlide(fixture.slides[index], resolveSlideContext(fixture, index).options));
  });

  test('the two text blocks fill the group in order, stacked, and the chart fills the right slot', () => {
    const result = compose(slide, layout);
    const [first, second, chartItem] = body(result);
    assert.deepEqual([first.path, second.path, chartItem.path], ['slides.0.blocks.0.text', 'slides.0.blocks.1.text', 'slides.0.blocks.2.chart']);
    const { contentBox } = result, gap = 720 / 30;
    // Root: a row weighted 2:3. The group's column is the left track; the chart the right.
    assert.equal(first.box.x, contentBox.x);
    assert.ok(Math.abs(first.box.width - (contentBox.width - gap) * 2 / 5) < 1e-3);
    assert.ok(Math.abs(chartItem.box.width - (contentBox.width - gap) * 3 / 5) < 1e-3);
    assert.ok(Math.abs(chartItem.box.x + chartItem.box.width - (contentBox.x + contentBox.width)) < 1e-3);
    // Group: a column weighted 1:1, gap a thirtieth of the group's short edge, no padding.
    assert.equal(first.box.x, second.box.x);
    assert.equal(first.box.height, second.box.height);
    assert.ok(Math.abs(second.box.y - (first.box.y + first.box.height) - first.box.width / 30) < 1e-3);
    assert.ok(Math.abs(second.box.y + second.box.height - (chartItem.box.y + chartItem.box.height)) < 1e-3);
    // The group has no slide path: it records no content group, flow or decision of its own.
    assert.deepEqual(result.groups, []);
    assert.deepEqual(result.flows.map((flow) => flow.path), ['slides.0']);
  });

  test('slots name every record placeholder with its cell and the content in it', () => {
    const result = compose(slide, layout);
    assert.deepEqual(result.slots.map(({ path, type, depth, content }) => ({ path, type, depth, content })), [
      { path: 'layout.placeholders.1', type: 'group', depth: 0, content: undefined },
      { path: 'layout.placeholders.1.placeholders.0', type: 'text', depth: 1, content: 'slides.0.blocks.0.text' },
      { path: 'layout.placeholders.1.placeholders.1', type: 'text', depth: 1, content: 'slides.0.blocks.1.text' },
      { path: 'layout.placeholders.2', type: 'chart', depth: 0, content: 'slides.0.blocks.2.chart' },
    ]);
    for (const slot of result.slots.filter((entry) => entry.content)) assert.deepEqual(slot.box, result.items.find((item) => item.path === slot.content).box);
    // A flat record composes exactly as before and carries no slots.
    assert.equal(compose(slide, { name: 'Flat', placeholders: [{ type: 'title' }, { type: 'text' }, { type: 'text' }, { type: 'chart' }] }).slots, undefined);
  });

  test('the same blocks on a flat record keep today’s geometry: groups change only records that have them', () => {
    const flat = { name: 'Flat', placeholders: [{ type: 'title' }, { type: 'text' }, { type: 'text' }, { type: 'chart' }], composition: { mode: 'row', weights: [2, 3] } };
    const result = compose(slide, flat);
    assert.equal(new Set(boxes(result).map((box) => box.y)).size, 1, 'three cells in one row');
  });
});

describe('filling the leaves', () => {
  const layout = layouts['stacked-text-chart-right'];
  const text = (value) => ({ type: 'text', text: value });

  test('content fills the leaves in reading order, whatever the kinds; content beyond the last leaf flows at the root', () => {
    const swapped = compose({ title: 'T', blocks: [chart, text('a'), text('b')] }, layout);
    assert.deepEqual(swapped.slots.filter((slot) => slot.content).map((slot) => [slot.type, slot.content]), [
      ['text', 'slides.0.blocks.0.chart'], ['text', 'slides.0.blocks.1.text'], ['chart', 'slides.0.blocks.2.text'],
    ], 'kinds are what pickers match on; composition fills in order, as on a flat record');
    const more = compose(fixture.slides.find((entry) => entry.id === 'nested-more'), layout);
    const [a, b, c, d] = body(more);
    assert.equal(a.box.x, b.box.x);
    assert.ok(c.box.x > a.box.x && d.box.x > c.box.x, 'the fourth block takes a third root track');
    assert.equal(d.box.y, c.box.y);
  });

  test('an unfilled region keeps its cell only when its container sets no mode, as top-level placeholders do', () => {
    const fewer = compose({ title: 'T', blocks: [text('a')] }, layout);
    // Root row (a mode): the trailing chart region collapses; group column (a mode): the second text region too.
    assert.deepEqual(boxes(fewer), [fewer.contentBox]);
    const auto = { name: 'Auto', placeholders: [{ type: 'title' }, group({}, [{ type: 'text' }, { type: 'text' }]), { type: 'chart' }] };
    const reserved = compose({ title: 'T', blocks: [text('a')] }, auto);
    const groupSlot = reserved.slots.find((slot) => slot.path === 'layout.placeholders.1');
    assert.ok(boxes(reserved)[0].width < groupSlot.box.width || boxes(reserved)[0].height < groupSlot.box.height, 'the empty second region keeps its cell');
    const empty = reserved.slots.filter((slot) => !slot.content && slot.type !== 'group').map((slot) => slot.path);
    assert.deepEqual(empty, ['layout.placeholders.1.placeholders.1', 'layout.placeholders.2'], 'every empty region is listed with its cell');
  });

  test('a slide’s composition overrides the record per key at the root; the groups keep their own', () => {
    const base = compose(fixture.slides[0], layout);
    const override = compose(fixture.slides.find((entry) => entry.id === 'nested-override'), layout);
    const [a, b, c] = body(override);
    assert.ok(Math.abs(a.box.width - c.box.width) < 1e-3, 'weights [1, 1] from the slide');
    assert.equal(a.box.x, b.box.x, 'the group still stacks its regions');
    assert.equal(override.composition.mode, 'row', 'the record’s mode still applies');
    assert.notDeepEqual(boxes(override), boxes(base));
  });

  test('a slide that brings its own content groups keeps its own structure', () => {
    const slide = { title: 'T', blocks: [{ blocks: [text('a'), text('b')] }, chart] };
    const result = compose(slide, layout);
    assert.equal(result.slots, undefined);
    assert.deepEqual(result.groups.map((entry) => entry.path), ['slides.0.blocks.0']);
    assert.deepEqual(boxes(result), boxes(compose(slide, { ...layout, placeholders: [{ type: 'title' }, { type: 'text' }, { type: 'chart' }] })), 'only the root composition and slot count apply');
  });

  test('promoted regions keep their positions', () => {
    const slide = { title: 'T', left: text('a'), right: chart };
    assert.deepEqual(boxes(compose(slide, layout)), boxes(compose(slide)));
  });

  test('three levels: each group arranges its own leaves', () => {
    const slide = fixture.slides.find((entry) => entry.id === 'three-level');
    const result = compose(slide, layouts['three-level']);
    const [partners, value, segments, channels, customers, costs, revenue] = body(result);
    assert.ok(partners.box.y === value.box.y && value.box.y === customers.box.y, 'the top band is one row');
    assert.ok(value.box.width > partners.box.width && Math.abs(partners.box.width - customers.box.width) < 1e-3, 'weighted 1:2:1');
    assert.equal(segments.box.y, channels.box.y, 'the innermost group is a row');
    assert.ok(segments.box.y > value.box.y && segments.box.x === value.box.x, 'below the value proposition, inside its column');
    assert.ok(costs.box.y > partners.box.y + partners.box.height && costs.box.y === revenue.box.y, 'the bottom band');
    assert.deepEqual(result.slots.filter((slot) => slot.type === 'group').map((slot) => [slot.path, slot.depth]), [
      ['layout.placeholders.1', 0], ['layout.placeholders.1.placeholders.1', 1], ['layout.placeholders.1.placeholders.1.placeholders.1', 2], ['layout.placeholders.2', 0],
    ]);
  });

  test('only minFontSize and overflow inherit into a record group', () => {
    const long = Array.from({ length: 200 }, () => 'words that cannot fit').join(' ');
    const strict = { name: 'Strict', placeholders: [{ type: 'title' }, group({ mode: 'column' }, [{ type: 'text' }, { type: 'text' }])], composition: { overflow: 'error', minFontSize: 20, gap: 0.1 } };
    assert.throws(() => compose({ title: 'T', blocks: [text(long), text('b')] }, strict), /exceeds its cell|OPFCompositionError|Text/);
    const result = compose({ title: 'T', blocks: [text('a'), text('b')] }, { ...strict, composition: { minFontSize: 20, gap: 0.1 } });
    const [a, b] = body(result);
    assert.equal(a.composition.minFontSize, 20, 'minFontSize inherits');
    const cell = result.slots.find((slot) => slot.type === 'group').box;
    assert.ok(Math.abs(b.box.y - (a.box.y + a.box.height) - Math.min(cell.width, cell.height) / 30) < 1e-3, 'gap does not: the group uses its own default');
  });

  test('image regions count in reading order for placement, which only a top-level placeholder carries', () => {
    const photo = { type: 'image', image: { src: 'data:image/png;base64,iVBORw0KGgo=', alt: 'Port' } };
    const nestedImage = { name: 'Nested image', placeholders: [{ type: 'title' }, group({}, [{ type: 'image' }, { type: 'text' }]), { type: 'image', placement: { edge: 'right', size: 0.4 } }] };
    const result = compose({ title: 'T', blocks: [photo, text('a'), photo] }, nestedImage);
    const image = (path) => result.items.find((item) => item.path === path).image;
    assert.equal(image('slides.0.blocks.0.image').placement, undefined, 'the first image fills the group region');
    assert.deepEqual(image('slides.0.blocks.2.image').placement, { edge: 'right', size: 0.4, inset: false, path: 'layout.placeholders.2.placement' }, 'the second takes the top-level placeholder\'s placement');
  });
});

describe('design.chartPrimary is sugar for a group', () => {
  const blocks = [chart, { type: 'text', text: 'Enterprise seats up 31%' }, { items: ['Churn down', 'Pipeline up'] }];

  test('chartPrimaryLayout states the record it stands for', () => {
    assert.deepEqual(chartPrimaryLayout('left', ['text', 'list']), {
      composition: { mode: 'row', weights: [3, 2] },
      placeholders: [{ type: 'chart' }, { type: 'group', composition: {}, placeholders: [{ type: 'text' }, { type: 'list' }] }],
    });
    assert.deepEqual(chartPrimaryLayout('bottom', ['text']).placeholders.map((entry) => entry.type), ['group', 'chart']);
    assert.deepEqual(chartPrimaryLayout('bottom', ['text']).composition, { mode: 'column', weights: [2, 3] });
  });

  test('a chartPrimary slide composes exactly as the explicit group record, on every side', () => {
    for (const side of ['left', 'right', 'top', 'bottom']) {
      const hinted = composeSlide({ title: 'C', blocks }, { presentation: { design: { chartPrimary: side } }, explain: true });
      const first = side === 'left' || side === 'top';
      const ordered = first ? blocks : [blocks[1], blocks[2], blocks[0]];
      const explicit = composeSlide({ title: 'C', blocks: ordered }, { layout: chartPrimaryLayout(side, ['text', 'list']) });
      const byPath = (result) => Object.fromEntries(body(result).map((item) => [item.field, item.box]));
      assert.deepEqual(byPath(hinted), byPath(explicit), side);
      // What chartPrimary reports is unchanged: a chart-primary root decision, and no group, flow or decision for the group.
      assert.equal(hinted.explanation.decisions.length, 1);
      assert.equal(hinted.explanation.decisions[0].reason, 'chart-primary');
      assert.deepEqual(hinted.groups, []);
      assert.equal(hinted.slots, undefined, 'the sugar has no record placeholders to report');
    }
  });

  test('chartPrimary replaces a record’s own groups while it applies', () => {
    const slide = { title: 'C', design: { chartPrimary: 'left' }, blocks };
    const withGroups = composeSlide(slide, { layout: layouts['stacked-text-chart-right'] });
    assert.deepEqual(boxes(withGroups), boxes(composeSlide(slide)));
  });

  test('the explicit chart-left-stacked record draws what chartPrimary left drew on the flat chart-3x-left record', () => {
    const before = { name: 'Chart 3x Left (0.15)', design: { chartPrimary: 'left' }, placeholders: [{ type: 'title' }, { type: 'chart' }, { type: 'chart' }, { type: 'chart' }], composition: { mode: 'row', weights: [2, 1, 1] } };
    const after = layouts['chart-left-stacked'];
    // Mixed content: chartPrimary applied, and the explicit group draws the same boxes.
    const mixed = { title: 'Mixed', blocks };
    assert.deepEqual(boxes(compose(mixed, after)), boxes(compose(mixed, before)));
    // Charts only: chartPrimary never applied to a chart-only root, so the flat record drew a 2:1:1 row; the record now
    // states the structure its name promises, the primary chart beside the other two stacked (the reviewed gallery diff).
    const three = fixture.slides.find((entry) => entry.id === 'chart-left-stacked');
    const [primary, second, third] = boxes(compose(three, after));
    assert.equal(new Set(boxes(compose(three, before)).map((box) => box.y)).size, 1);
    assert.ok(second.x === third.x && third.y > second.y && second.x > primary.x + primary.width);
  });
});

describe('records, validation and depth', () => {
  test('layoutContent, layoutLeaves and layoutSlots read through groups', () => {
    const layout = layouts['three-level'];
    assert.deepEqual(layoutContent(layout), { kind: 'text', count: 7, heading: { title: true, subtitle: false, tag: false } });
    assert.deepEqual(layoutLeaves(layout).map((leaf) => [leaf.type, leaf.depth]), [['title', 0], ['text', 1], ['text', 2], ['metric', 3], ['metric', 3], ['text', 1], ['text', 1], ['text', 1]]);
    assert.equal(layoutLeaves(layout)[3].path, 'layout.placeholders.1.placeholders.1.placeholders.1.placeholders.0');
    assert.equal(layoutSlots(layout)[1].children.length, 3);
    assert.equal(layoutContent(layouts['chart-left-stacked']).kind, 'chart');
    assert.equal(layoutContent(layouts['chart-left-stacked']).count, 3);
  });

  test(`groups nest at most ${MAX_PLACEHOLDER_GROUP_DEPTH} levels: the schema and the validator reject a fourth`, () => {
    assert.equal(MAX_PLACEHOLDER_GROUP_DEPTH, 3);
    assert.equal(validateCatalogRecord('layouts', record([{ type: 'title' }, nest(3)])).valid, true);
    const deep = validateCatalogRecord('layouts', record([{ type: 'title' }, nest(4)]));
    assert.equal(deep.valid, false);
    assert.deepEqual(deep.findings.map((entry) => [entry.ruleId, entry.path]), [['opf/layout-placeholder-group', '/placeholders/1/placeholders/0/placeholders/0/placeholders/0']]);
    assert.match(deep.findings[0].message, /nest at most 3 levels/);
    // Composition refuses it too, the way it refuses content groups that nest too deeply.
    assert.throws(() => composeSlide({ title: 'T', text: 'a' }, { layout: { placeholders: [nest(4)] } }), /nest at most 3 levels/);
    assert.doesNotThrow(() => composeSlide({ title: 'T', text: 'a' }, { layout: { placeholders: [nest(3)] } }));
  });

  test('the same rules hold for a record embedded in a document', () => {
    const document = { ...fixture, catalogs: { default: false, custom: { layouts: { deep: { name: 'Deep', placeholders: [{ type: 'title' }, nest(4)] } } } }, slides: [{ layout: 'deep', title: 'T', text: 'a' }] };
    const report = validate(document, { only: ['format', 'references'] });
    assert.ok(errorsOf(report).some((entry) => entry.ruleId === 'opf/catalog-record' && /nest at most 3 levels/.test(entry.message)), JSON.stringify(errorsOf(report)));
  });

  test('a group holds body regions and groups only, with no placement, and at least one placeholder', () => {
    const heading = validateCatalogRecord('layouts', record([group(undefined, [{ type: 'title' }, { type: 'text' }])]));
    assert.deepEqual(heading.findings.map((entry) => [entry.ruleId, entry.path]), [['opf/layout-placeholder-group', '/placeholders/0/placeholders/0/type']]);
    const placed = validateCatalogRecord('layouts', record([group(undefined, [{ type: 'image', placement: { edge: 'left' } }])]));
    assert.deepEqual(placed.findings.map((entry) => [entry.ruleId, entry.path]), [['opf/image-placement-invalid', '/placeholders/0/placeholders/0/placement']]);
    assert.equal(validateCatalogRecord('layouts', record([group(undefined, [])])).valid, false);
    assert.equal(validateCatalogRecord('layouts', record([group({ mode: 'diagonal' }, [{ type: 'text' }])])).valid, false);
    assert.equal(validateCatalogRecord('layouts', record([{ type: 'group', placeholders: [{ type: 'text' }], weights: [1] }])).valid, false, 'a group has no other fields');
    assert.equal(validateCatalogRecord('layouts', record([{ type: 'title' }, { type: 'image', placement: { edge: 'left' } }])).valid, true, 'a top-level placement is unchanged');
    assert.throws(() => composeSlide({ title: 'T', text: 'a' }, { layout: { placeholders: [group(undefined, [{ type: 'subtitle' }])] } }), /body regions only/);
  });
});

describe('pagination keeps working on a record with groups', () => {
  test('an overflowing slide splits into pages that each fill the record’s leaves in order', () => {
    const layout = layouts['stacked-text-chart-right'];
    const items = Array.from({ length: 40 }, (_, index) => `Driver ${index + 1}: a sentence long enough to need its own line`);
    const slide = { layout: 'stacked-text-chart-right', title: 'Drivers', blocks: [{ type: 'list', items }, { type: 'text', text: 'Churn down to 2.1%' }, chart] };
    const result = paginateSlide(slide, { layout, minFontSize: 20 });
    assert.ok(result.slides.length > 1, `${result.slides.length} pages`);
    const seen = result.slides.flatMap((page) => page.blocks.find((block) => Array.isArray(block.items))?.items ?? []);
    assert.deepEqual(seen, items, 'every item lands on exactly one page, in order');
    for (const [index, page] of result.slides.entries()) {
      const geometry = composeSlide(page, { layout, slideIndex: index });
      assert.ok(geometry.slots.length >= 2, 'each page composes through the record’s groups');
      assert.equal(geometry.diagnostics.filter((entry) => entry.code === 'text-overflow').length, 0, `page ${index + 1} fits`);
    }
  });

  test('a record group’s minFontSize and overflow follow the pagination policy', () => {
    const layout = { name: 'Strict group', placeholders: [{ type: 'title' }, group({ mode: 'column', minFontSize: 10, overflow: 'error' }, [{ type: 'list' }, { type: 'text' }])] };
    const items = Array.from({ length: 30 }, (_, index) => `Point ${index + 1} with enough words to wrap`);
    const result = paginateSlide({ title: 'Points', blocks: [{ type: 'list', items }, { type: 'text', text: 'Summary' }] }, { layout, minFontSize: 20 });
    assert.ok(result.slides.length > 1, 'the group overflow measures instead of throwing, and the floor applies');
  });
});
