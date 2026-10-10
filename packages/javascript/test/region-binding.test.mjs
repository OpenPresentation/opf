import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { validate } from '../dist/index.js';
import { bindRegions, composeSlide, regionRoleRank } from '../dist/composition.js';

// OPF 0.19 (RR-79), design section 3: slide content stays flat and binds to the layout's regions: pins, then role rank by
// kind, then reading order; content no region takes goes to the overflow region, never dropped.
const { layouts } = JSON.parse(readFileSync(new URL('./fixtures/layout-templates-0.19.json', import.meta.url), 'utf8'));
const roadmap = {
  name: 'Roadmap split',
  areas: ['title title', 'timeline notes', 'timeline metrics'],
  columns: [2, 1],
  rows: ['auto', 1, 1],
  regions: {
    timeline: { accepts: ['timeline'], role: 'primary', flow: 'none' },
    notes: { accepts: ['text', 'list'], role: 'secondary', flow: 'column' },
    metrics: { accepts: ['metric', 'text'], role: 'supporting', flow: 'grid' },
  },
};
const timeline = { timeline: { events: [{ when: 'Q1', what: 'Pilot' }, { when: 'Q2', what: 'Launch' }] } };
const bound = (result) => Object.fromEntries(result.regions.map((region) => [region.name, region.blocks.map((block) => block.path.replace(/^slides\.0\./, ''))]));
const text = (value) => ({ text: value });
const image = { image: 'https://example.com/a.png' };

describe('the worked example (design section 7, roadmap-split)', () => {
  const slide = { layout: 'roadmap-split', title: '2027 roadmap', blocks: [timeline, { metric: { value: 12, label: 'Pilot customers' } }, { metric: { value: '94%', label: 'Retention' } }, { items: ['Hiring two engineers', 'Security review in Q1'] }, { region: 'metrics', text: 'Targets agreed with finance.' }] };

  test('the pin, then the timeline, the metrics and the list each go to the one region that accepts them', () => {
    const result = bindRegions(slide, roadmap);
    assert.deepEqual(bound(result), { timeline: ['blocks.0'], notes: ['blocks.3'], metrics: ['blocks.1', 'blocks.2', 'blocks.4'] });
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.regions.find((region) => region.name === 'metrics').blocks.find((block) => block.block === 4).pinned, true);
  });

  test('without its pin the text goes to notes: secondary ranks before supporting', () => {
    const blocks = slide.blocks.map((block) => { const { region: _region, ...rest } = block; return rest; });
    assert.deepEqual(bound(bindRegions({ ...slide, blocks }, roadmap)), { timeline: ['blocks.0'], notes: ['blocks.3', 'blocks.4'], metrics: ['blocks.1', 'blocks.2'] });
  });

  test('the deck in the three forms validates, and composes with metrics holding three blocks in a row', () => {
    const deck = { name: 'Roadmap review', catalogs: { custom: { layouts: { 'roadmap-split': roadmap } } }, slides: [slide] };
    assert.deepEqual(validate(deck, { only: ['format', 'references'] }).findings.filter((entry) => entry.severity === 'error'), []);
    const result = composeSlide(slide, { layout: roadmap });
    const metrics = result.regions.find((region) => region.name === 'metrics');
    assert.equal(metrics.arrangement, 'grid');
    const cells = result.items.filter((item) => item.region === 'metrics');
    assert.equal(cells.length, 3);
    assert.ok(cells.every((item) => Math.abs(item.box.y - cells[0].box.y) < 1e-6), 'one row');
  });

  test('with no notes at all, notes collapses into metrics below it', () => {
    const result = composeSlide({ title: 'x', blocks: [timeline, { metric: { value: 1, label: 'a' } }] }, { layout: roadmap });
    const notes = result.regions.find((region) => region.name === 'notes'), metrics = result.regions.find((region) => region.name === 'metrics');
    assert.equal(notes.collapsed, true);
    const timelineBox = result.regions.find((region) => region.name === 'timeline').box;
    assert.ok(Math.abs(metrics.box.y - timelineBox.y) < 1e-6 && Math.abs(metrics.box.height - timelineBox.height) < 1e-6, 'metrics fills the right column');
  });
});

describe('step 1: pins', () => {
  test('an unknown region, a kind the region does not accept and a full region are warnings; the block joins step 2', () => {
    const slide = { blocks: [{ region: 'nowhere', text: 'a' }, { region: 'timeline', text: 'b' }, timeline, { region: 'timeline', timeline: { events: [{ what: 'x' }] } }] };
    const result = bindRegions(slide, roadmap);
    assert.deepEqual(result.diagnostics.map((entry) => [entry.code, entry.path]), [
      ['region-unknown', 'slides.0.blocks.0.region'],
      ['region-kind', 'slides.0.blocks.1.region'],
      ['layout-unplaced', 'slides.0.blocks.2'],
    ]);
    // Block 3's pin to timeline is honoured first (pins come before step 2); block 2 then has no room and, as the layout
    // has no flowing primary region, is drawn below the grid.
    assert.deepEqual(bound(result).timeline, ['blocks.3']);
    assert.deepEqual(bound(result).notes, ['blocks.0', 'blocks.1']);
    const full = bindRegions({ blocks: [{ region: 'timeline', ...timeline }, { region: 'timeline', ...timeline }] }, roadmap);
    assert.deepEqual(full.diagnostics.map((entry) => entry.code), ['region-full', 'layout-unplaced']);
  });

  test('composition reports the pin warnings as validate findings', () => {
    const deck = { catalogs: { custom: { layouts: { r: roadmap } } }, slides: [{ layout: 'r', blocks: [{ region: 'nowhere', text: 'a' }, { region: 'timeline', text: 'b' }] }] };
    const ids = validate(deck).findings.map((entry) => entry.ruleId);
    assert.ok(ids.includes('opf/region-unknown'));
    assert.ok(ids.includes('opf/region-kind'));
  });
});

describe('step 2: role rank by kind, then reading order', () => {
  test('pictures prefer media regions; everything else primary, then secondary, supporting, media', () => {
    assert.deepEqual(['media', 'primary', 'secondary', 'supporting'].map((role) => regionRoleRank(role, 'image')), [0, 1, 2, 3]);
    assert.deepEqual(['primary', 'secondary', 'supporting', 'media'].map((role) => regionRoleRank(role, 'text')), [0, 1, 2, 3]);
    assert.deepEqual(['primary', 'secondary', 'supporting', 'media'].map((role) => regionRoleRank(role, 'group')), [0, 1, 2, 3]);
  });

  test('hero: the picture goes to media, the lead text to lead, further text to support', () => {
    const result = bindRegions({ blocks: [image, text('Lead'), text('Point'), text('Point 2')] }, layouts.hero);
    assert.deepEqual(bound(result), { lead: ['blocks.1'], media: ['blocks.0'], support: ['blocks.2', 'blocks.3'] });
  });

  test('two equal regions fill in reading order', () => {
    assert.deepEqual(bound(bindRegions({ blocks: [text('a'), text('b')] }, layouts['two-column'])), { first: ['blocks.0'], second: ['blocks.1'] });
  });

  test('a supporting region takes content only when no primary or secondary region has room', () => {
    // chart-beside: a second chart goes to the supporting notes once the chart region is full.
    const chart = { chart: { type: 'column', data: { columns: ['Q', 'V'], rows: [['Q1', 1]] } } };
    assert.deepEqual(bound(bindRegions({ blocks: [chart, chart, text('takeaway')] }, layouts['chart-beside'])), { chart: ['blocks.0'], notes: ['blocks.1', 'blocks.2'] });
  });

  test('a group is accepted where every one of its leaf kinds is, or where group is', () => {
    const person = { blocks: [image, text('Name')] };
    assert.deepEqual(bound(bindRegions({ blocks: [person] }, layouts.team)), { people: ['blocks.0'] });
    const custom = { name: 'x', areas: ['a b'], columns: [1, 1], rows: [1], regions: { a: { accepts: ['chart'] }, b: { accepts: ['text', 'image'], role: 'secondary' } } };
    assert.deepEqual(bound(bindRegions({ blocks: [person] }, custom)), { a: [], b: ['blocks.0'] });
  });

  test('within a region blocks keep source order, pinned or not', () => {
    const result = bindRegions({ blocks: [text('a'), { region: 'body', text: 'b' }, text('c')] }, layouts.text);
    assert.deepEqual(bound(result).body, ['blocks.0', 'blocks.1', 'blocks.2']);
  });
});

describe('step 3: content no region takes', () => {
  test('a block with no candidate goes to the overflow region whatever its accepts, while it has room', () => {
    const result = bindRegions({ blocks: [{ code: 'x = 1' }] }, layouts.pillars);
    assert.deepEqual(bound(result).pillars, ['blocks.0']);
    assert.deepEqual(result.diagnostics, []);
  });

  test('beyond max it is drawn in the overflow region anyway, one layout-unplaced warning each', () => {
    const result = bindRegions({ blocks: Array.from({ length: 8 }, (_, index) => text(`P${index}`)) }, layouts.pillars);
    const pillars = result.regions[0];
    assert.equal(pillars.blocks.length, 6);
    assert.deepEqual(pillars.overflow.map((block) => block.path), ['slides.0.blocks.6', 'slides.0.blocks.7']);
    assert.deepEqual(result.diagnostics.map((entry) => [entry.code, entry.path, entry.region]), [['layout-unplaced', 'slides.0.blocks.6', 'pillars'], ['layout-unplaced', 'slides.0.blocks.7', 'pillars']]);
  });

  test('overflowRegion names where it goes', () => {
    const record = { ...roadmap, overflowRegion: 'metrics' };
    assert.deepEqual(bound(bindRegions({ blocks: [{ code: 'x' }] }, record)).metrics, ['blocks.0']);
  });

  test('a layout with no flowing primary region and no overflowRegion draws it below the grid', () => {
    const result = bindRegions({ blocks: [text('a')] }, layouts.timeline);
    // timeline has a supporting notes region that takes text: no overflow needed.
    assert.deepEqual(bound(result).notes, ['blocks.0']);
    const below = bindRegions({ blocks: [{ code: 'x' }] }, layouts.timeline);
    assert.equal(below.below.length, 1);
    assert.deepEqual(below.diagnostics.map((entry) => entry.code), ['layout-unplaced']);
    const composed = composeSlide({ title: 't', blocks: [{ code: 'x = 1' }] }, { layout: layouts.timeline });
    const code = composed.items.find((item) => item.field === 'code');
    assert.ok(code && code.region === undefined, 'drawn, in the implicit row');
  });
});

describe('inputs', () => {
  test('a placed image takes its band and never occupies a region', () => {
    const result = bindRegions({ blocks: [{ ...image, placement: { edge: 'left' } }, text('a')] }, layouts['image-beside']);
    assert.deepEqual(bound(result), { media: [], body: ['blocks.1'] });
  });

  test('a root payload is bound like blocks; bullets stay with their text', () => {
    const result = bindRegions({ text: 'Intro', bullets: ['a', 'b'], chart: { type: 'pie', data: { columns: ['k', 'v'], rows: [['a', 1]] } } }, layouts['chart-beside']);
    assert.deepEqual(bound(result), { chart: ['chart'], notes: ['text'] });
    assert.deepEqual(result.regions[1].blocks[0].fields, ['text', 'bullets']);
  });

  test('a slide with promoted regions binds nothing', () => {
    const result = bindRegions({ left: text('a'), right: text('b') }, layouts['two-column']);
    assert.deepEqual(bound(result), { first: [], second: [] });
  });
});
