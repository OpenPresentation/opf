import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { XMLValidator } from 'fast-xml-parser';
import { toPptx, fromPptx } from '../dist/index.js';

// Tables on later slides use a different PptxGenJS ID formula than text and
// pictures. Mix them in different orders and positions to expose collisions.
const png = new Uint8Array(await readFile(new URL('./fixtures/images/wide.png', import.meta.url)));
const blocks = [
  { table: { columns: ['Name', 'Value'], rows: [['Alpha', '1']] } },
  { text: 'Editable text' },
  { image: 'https://example.invalid/test.png' },
  { chart: { type: 'column', data: { columns: ['Q', 'Value'], rows: [['Q1', 12]] } } },
  { table: { rows: [['Headerless', 'data']] } },
  { items: ['First', 'Second'] },
];
const deck = { slides: Array.from({length: 8}, (_, index) => ({
  title: `Mixed objects ${index + 1}`,
  composition: { mode: 'column' },
  blocks: [...blocks.slice(index % blocks.length), ...blocks.slice(0, index % blocks.length)],
})) };
const options = { imageResolver: async () => png };
const bytes = await toPptx(deck, options);
const entries = unzipSync(bytes);
for (const [name, data] of Object.entries(entries)) {
  if (!/^ppt\/slides\/slide\d+\.xml$/.test(name)) continue;
  const xml = new TextDecoder().decode(data);
  assert.equal(XMLValidator.validate(xml), true, name);
  const ids = [...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${name}: every native object needs a unique ID`);
  assert.ok(ids.every(id => Number(id) > 0));
  assert.equal((xml.match(/<a:tbl>/g) || []).length, 2, 'Both tables remain native');
  assert.equal((xml.match(/<p:pic>/g) || []).length, 1, 'The image remains native');
  assert.equal((xml.match(/<c:chart\b/g) || []).length, 1, 'The chart remains native');
}
assert.deepEqual(await toPptx(deck, options), bytes, 'ID repair must preserve deterministic export');
const imported = await fromPptx(bytes);
assert.equal(imported.slides.length, 8);
for (const slide of imported.slides) {
  assert.equal(slide.blocks.filter(block => block.table).length, 2);
  assert.equal(slide.blocks.filter(block => block.image).length, 1);
  assert.equal(slide.blocks.filter(block => block.chart).length, 1);
}
console.log('Object IDs passed: eight slides mixing tables, text, pictures, charts and lists, deterministic bytes and native import.');
