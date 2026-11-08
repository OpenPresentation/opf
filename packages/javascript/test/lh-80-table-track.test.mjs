// LH-80 with LH-75's allowance: a table beside a picture track keeps every cell on one line where a track allows it; when no track does,
// a cell may wrap onto two lines with its words whole, so the picture still takes its track (m17 with estimated widths).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, layoutTable } from '../dist/composition.js';

const svg = (width, height) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#ccc"/></svg>`).toString('base64')}`;
const stores = { columns: ['Store', 'City', 'Opening', 'Square feet'], rows: [['Harbor Point', 'Baltimore', 'Feb', '14,500'], ['Lakeshore', 'Chicago', 'Mar', '18,200'], ['Old Mill', 'Providence', 'Apr', '11,800'], ['Sunset Plaza', 'San Diego', 'May', '16,400'], ['Riverside', 'Sacramento', 'Jul', '13,900'], ['Peachtree', 'Atlanta', 'Aug', '17,300'], ['Bayou', 'New Orleans', 'Oct', '12,600'], ['Summit', 'Denver', 'Nov', '15,100']] };
const field = (result, name) => result.items.find((item) => item.field === name);
const cellLines = (item) => Math.max(...layoutTable(item.value, item.box, { scale: 1, minFontSize: item.composition.minFontSize, ...(item.tableGrowth ? { growth: item.tableGrowth } : {}) }).rows.flatMap((row) => row.cells.map((cell) => cell.fit.lines.length)));
const sizes = (item) => layoutTable(item.value, item.box, { scale: 1, minFontSize: item.composition.minFontSize, ...(item.tableGrowth ? { growth: item.tableGrowth } : {}) }).rows.flatMap((row) => row.cells.map((cell) => cell.fit.fontSize));

for (const direction of ['ltr', 'rtl']) {
  test(`LH-80 (${direction}): a table beside a 16:10 picture keeps its size and the picture takes its track, a cell wrapping onto two lines at most`, () => {
    const slide = { title: 'Store openings planned for 2027', blocks: [{ table: stores }, { image: svg(1600, 1000) }] };
    const result = composeSlide(slide, { direction });
    assert.equal(result.track?.kind, 'picture', 'the picture takes a track');
    const table = field(result, 'table');
    assert.ok(cellLines(table) <= 2, `cells on at most two lines (${cellLines(table)})`);
    assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'text-overflow' || entry.code === 'small-cell'), []);
    // The table reads as large as on the slide with the picture kept whole beside it (no track).
    const whole = composeSlide({ ...slide, blocks: [{ table: stores }, { image: svg(1600, 1000), fit: 'contain' }] }, { direction });
    assert.equal(whole.track, undefined);
    assert.ok(Math.min(...sizes(table)) >= Math.min(...sizes(field(whole, 'table'))) - 1e-6, 'the table is never smaller');
  });
}

test('LH-80: a table whose cells fit on one line beside a track keeps them on one line', () => {
  const short = { columns: ['Store', 'Opening'], rows: [['Harbor', 'Feb'], ['Lake', 'Mar'], ['Mill', 'Apr']] };
  const result = composeSlide({ title: 'Openings', blocks: [{ table: short }, { image: svg(1600, 1000) }] });
  assert.equal(result.track?.kind, 'picture');
  assert.equal(cellLines(field(result, 'table')), 1);
});
