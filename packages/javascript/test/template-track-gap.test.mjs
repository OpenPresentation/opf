import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../dist/index.js';
import { composeSlide } from '../dist/composition.js';

const overlaps = (a, b) => a.x < b.x + b.width - 0.001 && a.x + a.width > b.x + 0.001 && a.y < b.y + b.height - 0.001 && a.y + a.height > b.y + 0.001;
const inside = (a, b) => a.x >= b.x - 0.001 && a.y >= b.y - 0.001 && a.x + a.width <= b.x + b.width + 0.001 && a.y + a.height <= b.y + b.height + 0.001;

for (const [name, width, height, columns, rows] of [
  ['twelve rows', 1280, 720, 1, 12],
  ['twelve portrait columns', 720, 1280, 12, 1],
  ['twelve by twelve', 1280, 720, 12, 12],
  ['twelve by twelve portrait', 720, 1280, 12, 12],
]) {
  test(`maximum template gap preserves positive disjoint tracks: ${name}`, () => {
    const names = Array.from({ length: columns * rows }, (_, index) => `r${index}`);
    const kind = columns === 1 ? 'text' : 'image';
    const layout = {
      direction: rows === 1 && columns > 1 ? 'row' : 'column',
      regions: columns === 1 || rows === 1
        ? names.map(region => ({ name: region, accepts: [kind], flow: 'none', empty: 'keep' }))
        : Array.from({ length: rows }, (_, row) => ({ direction: 'row', regions: names.slice(row * columns, (row + 1) * columns).map(region => ({ name: region, accepts: [kind], flow: 'none', empty: 'keep' })) })),
    };
    const slide = { layout: 'custom:tracks', composition: { gap: 0.1 }, blocks: names.map((region, index) => ({ region, [kind]: kind === 'text' ? `Row ${index}` : `https://example.invalid/${index}.png` })) };
    assert.equal(validate({ catalogs: { custom: { layouts: { tracks: layout } } }, slides: [slide] }, { only: ['format'] }).valid, true);
    const result = composeSlide(slide, { layout, width, height });
    assert.equal(result.items.length, names.length, 'every source payload is drawn');
    assert.deepEqual(result.items.map(item => item.value), slide.blocks.map(block => block[kind]));
    for (const [index, region] of result.regions.entries()) {
      assert.ok(region.box.width > 0 && region.box.height > 0, `${region.name} has positive geometry`);
      assert.ok(inside(region.box, result.contentBox), `${region.name} stays within the available frame`);
      const item = result.items.find(candidate => candidate.region === region.name);
      assert.ok(inside(item.box, region.box), `${region.name}'s content stays inside its region`);
      for (const other of result.regions.slice(index + 1)) assert.ok(!overlaps(region.box, other.box), `${region.name} overlaps ${other.name}`);
    }
  });
}
