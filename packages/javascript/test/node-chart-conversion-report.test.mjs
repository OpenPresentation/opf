import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { convert } from '../dist/index.js';
const source = JSON.parse(fs.readFileSync(new URL('./fixtures/chart-report-boundaries.opf.json', import.meta.url)));
const semantic = result => result.findings.filter(f => ['opf/chart-mapping-adapted', 'opf/chart-series-dropped'].includes(f.ruleId));
const expected = [
  ['opf/chart-series-dropped', '/slides/0/blocks/1/chart/type'],
  ['opf/chart-series-dropped', '/slides/1/blocks/0/chart/type'],
  ['opf/chart-mapping-adapted', '/slides/2/blocks/0/chart/type'],
];
const options = { paginate: false, date: '2026-11-08' };

test('rendered conversions report selected chart semantics exactly once, not once per output file', async () => {
  const original = structuredClone(source);
  for (const format of ['svg', 'png', 'pdf']) {
    const result = await convert(source, { ...options, format, ...(format === 'png' ? { scale: 0.5 } : {}) });
    assert.deepEqual(semantic(result).map(f => [f.ruleId, f.path]), expected, format);
    assert.ok(semantic(result).every(f => f.severity === 'warning'));
    assert.ok(result.files.length > 0);
  }
  assert.deepEqual(source, original);
});

test('native PPTX retains its existing authoritative warnings; picture PPTX receives the semantic warnings', async () => {
  const native = await convert(source, { ...options, format: 'pptx' });
  assert.deepEqual(semantic(native), []);
  assert.equal(native.findings.filter(f => f.ruleId === 'pptx/chart-data-adapted').length, 3);
  const pictures = await convert(source, { ...options, format: 'pptx', as: 'images', scale: 0.5 });
  assert.deepEqual(semantic(pictures).map(f => [f.ruleId, f.path]), expected);
  assert.equal(pictures.findings.filter(f => f.ruleId === 'pptx/chart-data-adapted').length, 0);
  const chartPictures = await convert(source, { ...options, format: 'pptx', charts: 'picture' });
  assert.deepEqual(semantic(chartPictures), [], 'the native exporter still owns per-chart picture notices');
  assert.equal(chartPictures.findings.filter(f => f.ruleId === 'pptx/chart-data-adapted').length, 3);
});

test('hidden/selected slide warnings follow the actual drawing selection and deck serialization remains unchanged', async () => {
  const deck = structuredClone(source); deck.slides[0].hidden = true;
  const visible = await convert(deck, { ...options, format: 'svg' });
  assert.deepEqual(semantic(visible).map(f => [f.ruleId, f.path]), expected.slice(1));
  const selected = await convert(deck, { ...options, format: 'svg', slides: 1 });
  assert.deepEqual(semantic(selected).map(f => [f.ruleId, f.path]), expected.slice(0, 1));
  const written = await convert(source, { format: 'json' });
  assert.deepEqual(semantic(written), []);
  assert.deepEqual(JSON.parse(Buffer.from(written.files[0].bytes).toString('utf8')), source);
});
