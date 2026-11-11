// A closed comparison view for the sealed native-17 Keynote fixture only.
// Original archive bytes and original whole-model fingerprints remain authority.
import assert from 'node:assert/strict';

export function historicalKeynoteVocabulary(document) {
  const original = JSON.stringify(document), historical = structuredClone(document);
  assert.deepEqual(Object.keys(historical.design.footer).sort(), ['end', 'start']);
  historical.design.footer = Object.fromEntries(Object.entries(historical.design.footer).map(([key, value]) => [key === 'start' ? 'left' : 'right', value]));
  let cells = 0;
  for (const slideIndex of [11, 12]) {
    const table = historical.slides[slideIndex].blocks[0].table;
    assert.equal(table.columns.length, 2);
    assert.equal(table.rows.length, 2);
    for (const row of table.rows) assert.equal(row.length, 2);
    for (const cell of [...table.columns, ...table.rows.flat()]) {
      assert.equal(cell.style.align, 'start');
      cell.style.align = 'left'; cells++;
    }
  }
  assert.equal(cells, 12, 'Only twelve known typed cell alignments change; two footer keys make fourteen slots');
  assert.equal(JSON.stringify(document), original, 'The actual current import remains unchanged');
  return historical;
}
