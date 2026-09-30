import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { format, summarize, topReasons } from './works-percent.mjs';

const fixture = {
  items: [
    { dimension: 'layouts', status: 'works', reasons: [] },
    { dimension: 'layouts', status: 'partial', reasons: ['export shape placement ignores layout that changes preview (3 shapes)'] },
    { dimension: 'layouts', status: 'gallery-only', reasons: ['export shape placement ignores layout that changes preview (5 shapes)', 'legacy gallery slug'] },
    { dimension: 'themes', status: 'works', reasons: [] },
  ],
};

test('counts works overall and per dimension', () => {
  const s = summarize(fixture);
  assert.equal(s.total, 4);
  assert.equal(s.works, 2);
  assert.equal(s.percent, 50);
  assert.deepEqual(s.byStatus, { works: 2, partial: 1, 'gallery-only': 1 });
  assert.deepEqual(s.dimensions.find((d) => d.dimension === 'layouts'), { dimension: 'layouts', total: 3, works: 1, byStatus: { works: 1, partial: 1, 'gallery-only': 1 } });
});

test('groups reasons with digits and parentheticals collapsed', () => {
  assert.deepEqual(topReasons(fixture, 'layouts'), [['export shape placement ignores layout that changes preview ()', 2], ['legacy gallery slug', 1]]);
});

test('rejects items without a dimension or status', () => {
  assert.throws(() => summarize({ items: [{ status: 'works' }] }), /without dimension/);
});

test('the committed support-status.json summarizes and formats', async () => {
  const status = JSON.parse(await readFile(fileURLToPath(new URL('./support-status.json', import.meta.url)), 'utf8'));
  const s = summarize(status);
  assert.equal(s.total, status.items.length);
  assert.equal(Object.values(s.byStatus).reduce((a, b) => a + b, 0), s.total);
  assert.match(format(s, status), new RegExp(`^works: ${s.works} of ${s.total} gallery configs`));
});
