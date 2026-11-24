// OPF 0.35.1: the rows and columns of a slide's 3 x 3 cell grid that no block names.
// - A row (a column) in which no block begins or ends, with a block wholly on each side of it, takes no space: `top:...` and `bottom:...`
//   blocks split the body into two rows with no empty band between them, `start` and `end` into two columns; a span through it keeps
//   the full height.
// - When the middle row gives its space away, a bottom-row block with no top-row block above it sits at the foot of its cell; one under a
//   top-row block keeps the top of its cell.
// - An unnamed row or column at the edge keeps its third: a lone `bottom:end` block, a `top` row alone, `middle+bottom` under an empty
//   top, and a row with nothing wholly on one side of it (`start` beside `top:center+end` alone).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const chart = { type: 'column', data: { columns: ['Quarter', 'A', 'B'], rows: [['Q1', 12, 8], ['Q2', 19, 14], ['Q3', 11, 16], ['Q4', 24, 10]] } };
const table = { columns: ['KPI', 'Q1', 'Q2'], rows: [['ARR', '$1.2M', '$2.4M'], ['NRR', '118%', '121%'], ['Burn', '$400K', '$320K']] };
const items = ['Retries fell by a third after the move', 'On-call pages halved within two weeks', 'The edge queue ships in March'];
const paragraph = 'Retries fell by a third after the queue moved to the edge, and the on-call load followed within two weeks.';
const item = (result, index, field) => result.items.find((entry) => entry.path.startsWith(`slides.0.blocks.${index}.`) && (!field || entry.field === field));
const bottom = (box) => box.y + box.height;
const third = (result) => (result.contentBox.height - 2 * gapOf(result)) / 3;
const gapOf = (result) => Math.min(result.width, result.height) / 30;

test('top and bottom rows share the body: no empty middle band, the chart grows', () => {
  const mosaic = { title: 'Blocks in cells', blocks: [{ region: 'top:start', text: 'Runs and colors' }, { region: 'top:center', chart }, { region: 'top:end', table }, { region: 'bottom:start', text: paragraph }, { region: 'bottom:center+end', items }] };
  const result = composeSlide(mosaic);
  const top = [0, 1, 2].map((index) => item(result, index).box), lower = [3, 4].map((index) => item(result, index).box);
  const band = Math.min(...lower.map((box) => box.y)) - Math.max(...top.map(bottom));
  assert.ok(band < 3 * gapOf(result), `the rows meet: ${band} px between them`);
  assert.ok(item(result, 1, 'chart').box.height > third(result) + gapOf(result), 'the chart takes more than a third of the body');
  assert.ok(Math.abs(bottom(item(result, 4).box) - bottom(result.contentBox)) < 2, 'the bottom row reaches the foot of the body');
});

for (const direction of ['ltr', 'rtl']) {
  test(`a diagonal keeps its corners (${direction}): the bottom text sits at the foot, in the end half`, () => {
    const result = composeSlide({ title: 'Diagonal', blocks: [{ region: 'top:start', text: paragraph }, { region: 'bottom:end', text: 'Ship it in March.' }] }, { direction });
    const body = result.contentBox, first = item(result, 0).box, last = item(result, 1).box;
    assert.ok(Math.abs(first.y - body.y) < 1, 'the top text sits at the top of the body');
    assert.ok(Math.abs(bottom(last) - bottom(body)) < 2, 'the bottom text sits at the foot of the body');
    const half = (body.width - gapOf(result)) / 2;
    assert.ok(Math.abs(first.width - half) < 1 && Math.abs(last.width - half) < 1, 'the empty center column gives its width to the two halves');
    if (direction === 'ltr') assert.ok(last.x > first.x + half, 'the end half is on the right');
    else assert.ok(last.x + last.width < first.x, 'the end half is on the left in a right-to-left deck');
  });
}

test('start and end columns split the width when the center is empty', () => {
  const result = composeSlide({ title: 'Columns', blocks: [{ region: 'start', text: paragraph }, { region: 'end', chart }] });
  const body = result.contentBox, half = (body.width - gapOf(result)) / 2;
  assert.ok(Math.abs(item(result, 0).box.width - half) < 1);
  assert.ok(item(result, 1, 'chart').box.width > half - 1, 'the chart takes the end half');
});

test('unnamed rows and columns at the edge keep their third', () => {
  const corner = composeSlide({ title: 'Corner', blocks: [{ region: 'bottom:end', text: 'Ship it in March.' }] });
  const body = corner.contentBox, box = item(corner, 0).box;
  assert.ok(box.y >= body.y + 2 * (third(corner) + gapOf(corner)) - 1, 'a lone bottom:end block stays in the bottom row');
  assert.ok(box.x >= body.x + 2 * ((body.width - 2 * gapOf(corner)) / 3 + gapOf(corner)) - 1, 'and in the end column');
  const row = composeSlide({ title: 'Top row', blocks: [{ region: 'top:start', text: 'Runs and colors' }, { region: 'top:center', chart }, { region: 'top:end', table }] });
  assert.ok(item(row, 1, 'chart').box.height > third(row) + gapOf(row), 'a full top row alone takes the whole body (opf#1412 A1 alternative)');
  const lower = composeSlide({ title: 'Lower rows', blocks: [{ region: 'middle:start', text: paragraph }, { region: 'bottom:start', table }] });
  assert.ok(item(lower, 0).box.y >= lower.contentBox.y + third(lower) + gapOf(lower) - 1, 'an empty top row keeps its third');
});

test('a row only a spanning cell runs through gives its space away, the span keeps the full height', () => {
  const result = composeSlide({ title: 'Span', blocks: [{ region: 'start', chart }, { region: 'top:center+end', text: paragraph }, { region: 'bottom:center+end', table }] });
  const body = result.contentBox, half = (body.height - gapOf(result)) / 2;
  assert.ok(Math.abs(item(result, 2).box.y - (body.y + half + gapOf(result))) < 1, 'the bottom row starts half way down');
  assert.ok(bottom(item(result, 0, 'chart').box) <= bottom(body) + 1, 'the spanning chart stays in the body');
  // Nothing wholly below the middle row but the span itself: the rows keep their thirds.
  const band = composeSlide({ title: 'Band', blocks: [{ region: 'start', chart }, { region: 'top:center+end', text: paragraph }] });
  assert.ok(item(band, 1).box.height <= third(band) + 1, 'a top band beside a sidebar keeps its third');
});

test('the editor\'s region layouts fill the body: side by side, stacked, one on top and two below, two by two', () => {
  const text = (region) => ({ region, text: paragraph });
  const sides = composeSlide({ title: 'Sides', blocks: [text('start'), text('end')] }), stacked = composeSlide({ title: 'Stacked', blocks: [text('top'), text('bottom')] });
  const halfWidth = (sides.contentBox.width - gapOf(sides)) / 2, halfHeight = (stacked.contentBox.height - gapOf(stacked)) / 2;
  assert.ok(Math.abs(item(sides, 1).box.x - (sides.contentBox.x + halfWidth + gapOf(sides))) < 1, 'side by side: two halves');
  assert.ok(Math.abs(item(stacked, 1).box.y - (stacked.contentBox.y + halfHeight + gapOf(stacked))) < 1, 'stacked: two halves');
  const grid = composeSlide({ title: 'Grid', blocks: [text('top:start'), text('top:end'), text('bottom:start'), text('bottom:end')] });
  const quarter = (grid.contentBox.width - gapOf(grid)) / 2;
  for (const index of [0, 1, 2, 3]) assert.ok(Math.abs(item(grid, index).box.width - quarter) < 1, 'two by two: four quarters');
  const below = composeSlide({ title: 'Below', blocks: [text('top'), text('bottom:start'), text('bottom:end')] });
  assert.ok(Math.abs(item(below, 0).box.width - below.contentBox.width) < 1 && Math.abs(item(below, 2).box.width - quarter) < 1, 'one on top across, two halves below');
});

// opf#1412 (A1): two or more cells whose rows are all full take the whole body; a lone block keeps its edge (0.35.1).
test('a full row of two or more cells takes the whole body; a lone edge block stays at its edge', () => {
  for (const region of ['top', 'bottom']) {
    const row = composeSlide({ title: 'Row', blocks: [{ region: `${region}:start`, text: 'Runs and colors' }, { region: `${region}:center`, chart }, { region: `${region}:end`, table }] });
    const drawn = item(row, 1, 'chart').box, body = row.contentBox;
    assert.ok(drawn.height > third(row) + gapOf(row), `a full ${region} row takes more than its third`);
    assert.ok(Math.abs(drawn.y + drawn.height / 2 - (body.y + body.height / 2)) < body.height / 10, 'its blocks sit in the middle of the body');
  }
  const quarters = composeSlide({ title: 'Two quarters', blocks: [{ region: 'top:start', text: paragraph }, { region: 'top:end', items }] });
  assert.ok(item(quarters, 0).box.y > quarters.contentBox.y + 1, 'top:start and top:end around an empty center take the body');
  for (const [region, edge] of [['bottom:end', 'bottom'], ['top:start', 'top'], ['top', 'top'], ['bottom', 'bottom']]) {
    const lone = composeSlide({ title: 'Lone', blocks: [{ region, text: 'Ship it in March.' }] });
    const box = item(lone, 0).box, body = lone.contentBox;
    if (edge === 'top') assert.ok(box.y + box.height <= body.y + third(lone) + 1, `a lone ${region} block stays in the top third`);
    else assert.ok(box.y >= body.y + 2 * (third(lone) + gapOf(lone)) - 1, `a lone ${region} block stays in the bottom third`);
  }
  const partial = composeSlide({ title: 'Not full', blocks: [{ region: 'top:start', text: 'Runs and colors' }, { region: 'top:center', table }] });
  assert.ok(item(partial, 1).box.y + item(partial, 1).box.height <= partial.contentBox.y + third(partial) + 1, 'a row that is not full keeps its third');
});

test('a full row over a background picture keeps its third: its cells may sit on panels the picture draws', () => {
  const svg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9" viewBox="0 0 16 9"><rect width="16" height="9" fill="#ccc"/></svg>').toString('base64')}`;
  const row = composeSlide({ title: 'Row', design: { background: { type: 'image', src: svg, fit: 'cover' } }, blocks: [{ region: 'bottom:start', text: 'Runs and colors' }, { region: 'bottom:center', chart }, { region: 'bottom:end', table }] });
  assert.ok(item(row, 1, 'chart').box.height <= third(row) + 1);
});
