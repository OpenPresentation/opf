import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { composeSlide, majorityKind, repeatedPairs } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

// Layout harvest LH-58, LH-82, LH-73, LH-46, LH-47: blocks are grouped (pairs, kinds, extra blocks of fixed regions) before
// any cell is placed, and grids are balanced. Rules over kinds, counts and measured sizes, never over a slide or layout id.
const note = (index) => ({ text: `Team ${index + 1} should focus the next cycle on the work that matters most to its stakeholders.` });
const metric = (index) => ({ metric: { value: `${40 + index}%`, label: `Signal ${index + 1}` } });
const chart = (index) => ({ chart: { type: 'column', data: { columns: ['Quarter', 'Value'], rows: [['Q1', 3 + index], ['Q2', 5], ['Q3', 4]] } } });
// A 4 x 3 PNG, so composition can read the picture's proportions.
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAAEElEQVR4nGNgGAWjYBQgAQADAAABOMpLzwAAAABJRU5ErkJggg==';
const picture = (index) => ({ image: { src: png, alt: `Picture ${index + 1}` } });
const interleave = (a, b, count) => Array.from({ length: count }, (_, index) => (index % 2 ? b(index >> 1) : a(index >> 1)));
const near = (a, b, tolerance = 0.5) => Math.abs(a - b) <= tolerance;
const inside = (inner, outer) => inner.x >= outer.x - 0.5 && inner.y >= outer.y - 0.5 && inner.x + inner.width <= outer.x + outer.width + 0.5 && inner.y + inner.height <= outer.y + outer.height + 0.5;
const region = (result, name) => result.regions.find((entry) => entry.name === name);
const items = (result, name) => result.items.filter((item) => item.region === name && item.field !== 'title');
const findings = (result) => result.diagnostics.map((entry) => entry.code);

describe('the sequence rules', () => {
  test('repeated pairs: a figure and a text in either order, or a long and a short paragraph, two pairs or more', () => {
    assert.deepEqual(repeatedPairs(['metric', 'text', 'metric', 'text'].map((kind) => ({ kind }))), { count: 2, figure: 0 });
    assert.deepEqual(repeatedPairs(['text', 'chart', 'text', 'chart', 'text', 'chart'].map((kind) => ({ kind }))), { count: 3, figure: 1 });
    assert.deepEqual(repeatedPairs([{ kind: 'text', length: 9 }, { kind: 'text', length: 120 }, { kind: 'text', length: 12 }, { kind: 'text', length: 90 }]), { count: 2, figure: 1 });
    assert.equal(repeatedPairs([{ kind: 'text', length: 9 }, { kind: 'text', length: 120 }, { kind: 'text', length: 120 }, { kind: 'text', length: 9 }]), undefined, 'the long paragraph on one side');
    assert.equal(repeatedPairs(['metric', 'text'].map((kind) => ({ kind }))), undefined, 'one pair is the layout\'s own');
    assert.equal(repeatedPairs(['metric', 'text', 'text', 'metric'].map((kind) => ({ kind }))), undefined);
    assert.equal(repeatedPairs(['metric', 'chart', 'metric', 'chart'].map((kind) => ({ kind }))), undefined, 'two figures are not a pair');
  });

  test('group by kind: interleaved kinds with unequal counts; a grouped sequence stays as written', () => {
    assert.deepEqual(majorityKind(['chart', 'text', 'chart', 'text', 'chart'].map((kind) => ({ kind }))), { kind: 'chart', majority: [0, 2, 4], others: [1, 3] });
    assert.equal(majorityKind(['chart', 'chart', 'chart', 'text'].map((kind) => ({ kind }))), undefined);
    assert.equal(majorityKind(['chart', 'text', 'text', 'chart'].map((kind) => ({ kind }))), undefined, 'equal counts');
  });
});

describe('LH-58: one cell per pair', () => {
  test('four metric + text pairs on a metrics slide are four cells of the grid, each metric with its note', () => {
    const result = composeSlide({ title: 'Pairs', blocks: interleave(metric, note, 8) }, { layout: layouts.metrics });
    assert.deepEqual(findings(result), []);
    assert.equal(region(result, 'metrics').content.length, 8);
    assert.equal(region(result, 'note').content.length, 0);
    const drawn = items(result, 'metrics');
    assert.equal(drawn.length, 8);
    const cells = new Map();
    for (const item of drawn) cells.set(item.path.replace(/\.blocks\.(\d+)\..*$/, (_, index) => `.pair${Number(index) >> 1}`), [...(cells.get(item.path.replace(/\.blocks\.(\d+)\..*$/, (_, index) => `.pair${Number(index) >> 1}`)) ?? []), item.box]);
    assert.equal(cells.size, 4);
    // Every pair sits in one cell: its two blocks are closer to each other than to any other pair's.
    for (const [key, [a, b]] of cells) {
      const gapInside = Math.max(b.x - (a.x + a.width), b.y - (a.y + a.height), 0);
      for (const [other, boxes] of cells) if (other !== key) for (const box of boxes) assert.ok(Math.hypot(box.x - a.x, box.y - a.y) > gapInside, `${key} keeps its note`);
    }
  });

  test('without a layout, pairs compose as one group each', () => {
    const result = composeSlide({ title: 'Charts', blocks: interleave(chart, note, 4) });
    assert.deepEqual(findings(result), []);
    const [chartA, noteA, chartB, noteB] = ['0', '1', '2', '3'].map((index) => result.items.find((item) => item.path.startsWith(`slides.0.blocks.${index}.`)).box);
    assert.ok(noteA.x < chartB.x || noteA.y < chartB.y);
    assert.ok(near(chartA.x, noteA.x) || near(chartA.y, noteA.y), 'a pair is one row or one column');
    assert.ok(near(chartB.x, noteB.x) || near(chartB.y, noteB.y));
  });

  test('a pin keeps the binding as written', () => {
    const blocks = interleave(metric, note, 4);
    blocks[1] = { ...blocks[1], region: 'note' };
    const result = composeSlide({ title: 'Pinned', blocks }, { layout: layouts.metrics });
    assert.deepEqual(region(result, 'note').content, ['slides.0.blocks.1']);
  });
});

describe('LH-82, LH-73: a grid keeps its kind', () => {
  test('3 metrics and 2 notes: the metric grid keeps only metrics and the notes sit in one row under it', () => {
    const result = composeSlide({ title: 'Mostly metrics', blocks: interleave(metric, note, 5) }, { layout: layouts.metrics });
    assert.deepEqual(findings(result), []);
    assert.deepEqual(items(result, 'metrics').map((item) => item.field), ['metric', 'metric', 'metric']);
    const notes = items(result, 'note');
    assert.equal(notes.length, 2);
    assert.equal(region(result, 'note').arrangement, 'row');
    assert.ok(near(notes[0].box.y, notes[1].box.y));
    assert.ok(region(result, 'metrics').box.height > region(result, 'note').box.height, 'the grid keeps most of the body');
  });

  test('3 charts and 2 notes, right to left: the notes row runs from the right', () => {
    const result = composeSlide({ title: 'Charts', blocks: interleave(chart, note, 5) }, { layout: layouts.chart, direction: 'rtl' });
    assert.deepEqual(items(result, 'charts').map((item) => item.field), ['chart', 'chart', 'chart']);
    const [first, second] = items(result, 'note');
    assert.ok(first.box.x > second.box.x);
  });

  test('without a layout, the majority kind is a grid above a row of the others', () => {
    const result = composeSlide({ title: 'Charts', blocks: interleave(chart, note, 5) });
    const charts = result.items.filter((item) => item.field === 'chart'), notes = result.items.filter((item) => item.field === 'text');
    assert.ok(Math.max(...charts.map((item) => item.box.y + item.box.height)) <= Math.min(...notes.map((item) => item.box.y)) + 0.5);
    assert.ok(near(notes[0].box.y, notes[1].box.y));
  });
});

describe('LH-46: extra blocks join a fixed region', () => {
  test('image with 4 pictures: a lead picture beside a mosaic, cover-cropped, no finding', () => {
    const result = composeSlide({ title: 'Pictures', blocks: Array.from({ length: 4 }, (_, index) => picture(index)) }, { layout: layouts.image });
    assert.deepEqual(findings(result), []);
    const drawn = items(result, 'media');
    assert.equal(drawn.length, 4);
    assert.ok(drawn.every((item) => item.image.fit === 'cover'));
    const [lead, ...mosaic] = drawn.map((item) => item.box);
    assert.ok(mosaic.every((box) => box.width * box.height < lead.width * lead.height));
    for (let i = 0; i < drawn.length; i++) for (let j = i + 1; j < drawn.length; j++) {
      const a = drawn[i].box, b = drawn[j].box;
      assert.ok(a.x + a.width <= b.x + 0.5 || b.x + b.width <= a.x + 0.5 || a.y + a.height <= b.y + 0.5 || b.y + b.height <= a.y + 0.5, 'no overlap');
    }
    assert.equal(result.items.some((item) => item.region === undefined && item.field === 'image'), false, 'no strip below the grid');
  });

  test('a block\'s own fit wins over the mosaic\'s cover', () => {
    const blocks = Array.from({ length: 3 }, (_, index) => picture(index));
    blocks[1] = { ...blocks[1], fit: 'contain' };
    const result = composeSlide({ title: 'Pictures', blocks }, { layout: layouts.image });
    assert.deepEqual(items(result, 'media').map((item) => item.image.fit), ['cover', 'contain', 'cover']);
  });

  test('comparison with 4 texts: one region of 4 cells, its sibling and the verdict collapse into it', () => {
    const result = composeSlide({ title: 'Options', blocks: Array.from({ length: 4 }, (_, index) => ({ text: `Option ${index + 1}` })) }, { layout: layouts.comparison });
    assert.deepEqual(findings(result), []);
    assert.equal(region(result, 'first').content.length, 4);
    assert.ok(region(result, 'second').collapsed && region(result, 'verdict').collapsed);
    assert.deepEqual(items(result, 'first').map((item) => item.path), [0, 1, 2, 3].map((index) => `slides.0.blocks.${index}.text`), 'reading order');
  });

  test('statement with 4 texts: a lead across the region over a row of three', () => {
    const result = composeSlide({ title: 'Next steps', blocks: Array.from({ length: 4 }, (_, index) => ({ text: `Step ${index + 1}` })) }, { layout: layouts.statement });
    assert.deepEqual(findings(result), []);
    const [lead, ...cards] = items(result, 'message').map((item) => item.box);
    assert.equal(cards.length, 3);
    assert.ok(cards.every((box) => box.y >= lead.y + lead.height - 0.5 && near(box.y, cards[0].y)));
  });
});

describe('LH-47: balanced grids', () => {
  for (const [id, count, perRow] of [['gallery', 7, [4, 3]], ['gallery', 9, [3, 3, 3]], ['logos', 9, [3, 3, 3]], ['team', 8, [4, 4]]]) {
    test(`${id} with ${count} pictures: rows of ${perRow.join(' + ')}, one cell size, inside the region`, () => {
      const result = composeSlide({ title: id, blocks: Array.from({ length: count }, (_, index) => picture(index)) }, { layout: layouts[id] });
      const name = result.regions.find((entry) => entry.content.length + (entry.overflow?.length ?? 0) > 0).name;
      const cells = items(result, name).map((item) => item.frameBox ?? item.image.region);
      assert.equal(cells.length, count);
      const rows = [...new Set(cells.map((box) => Math.round(box.y)))];
      assert.deepEqual(rows.map((y) => cells.filter((box) => Math.round(box.y) === y).length), perRow);
      assert.ok(cells.every((box) => near(box.width, cells[0].width, 1) && near(box.height, cells[0].height, 1)), 'one aspect');
      assert.ok(cells.every((box) => inside(box, region(result, name).box)));
    });
  }
});
