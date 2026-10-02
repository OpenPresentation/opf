import assert from 'node:assert/strict';
import test from 'node:test';
import {compareParity, keyOf, leaves} from './compare-parity.mjs';

const result = (id, cls, size = 12) => ({dimension: 'layouts', variant: 'published', id, class: cls, checks: {geometry: 'pass', text: cls === 'perfect' ? 'pass' : 'near'}, stats: {runs: 3}, diffs: [], size});
const host = (results, overrides = {}) => ({
  results: {meta: {generatedAt: String(Math.random()), node: 'v24.21.0', heads: {opf: 'a'}, fontHost: 'gallery'}, results},
  installed: {packages: {'@openpresentation/opf': {version: '0.12.0', gitHead: 'a'}}, dependencies: {fflate: '0.8.2', ...overrides}}
});

test('leaves lists every leaf with its path', () => {
  assert.deepEqual([...leaves({a: [1, {b: 'x'}], c: {}})], [['a.0', '1'], ['a.1.b', '"x"'], ['c', '{}']]);
  assert.equal(keyOf(result('title', 'perfect')), 'layouts/published/title');
});

test('identical results on every system have no difference, whatever the clock says', () => {
  const rows = [result('a', 'perfect'), result('b', 'near')];
  const summary = compareParity({ubuntu: host(rows), windows: host(rows), macos: host(rows)});
  assert.equal(summary.differences.length, 0);
  assert.equal(summary.values, 2);
  assert.deepEqual([summary.counts.macos.perfect, summary.counts.macos.near, summary.counts.macos.mismatch], [1, 1, 0]);
});

test('a different class, check outcome, missing value or meta field is a difference', () => {
  const base = [result('a', 'perfect'), result('b', 'near')];
  const summary = compareParity({ubuntu: host(base), windows: host([result('a', 'near'), result('b', 'near')]), macos: host([base[0]])});
  const fields = summary.differences.map((difference) => `${difference.scope} ${difference.field}`);
  assert.ok(fields.includes('layouts/published/a class'));
  assert.ok(fields.includes('layouts/published/a checks.text'));
  assert.ok(fields.includes('layouts/published/b (value present)'));
});

test('platform builds of dependencies are listed but do not decide the comparison', () => {
  const rows = [result('a', 'perfect')];
  const summary = compareParity({ubuntu: host(rows, {'@img/sharp-linux-x64': '1.0.0'}), macos: host(rows, {'@img/sharp-darwin-arm64': '1.0.0'})});
  assert.equal(summary.differences.length, 0);
  assert.equal(summary.installedDifferences.length, 2);
});
