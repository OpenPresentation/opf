import assert from 'node:assert/strict';
import test from 'node:test';
import { reportStale, staleMode } from './tracker-staleness.mjs';

const capture = () => {
  const lines = { out: [], err: [] };
  return { lines, log: { log: (m) => lines.out.push(m), error: (m) => lines.err.push(m) } };
};

test('a stale tracker fails by default, so main, the merge queue, releases and a local pnpm test stay strict', () => {
  const { lines, log } = capture();
  assert.equal(staleMode({}), 'fail');
  assert.equal(reportStale('Gallery tracker is stale.', {}, log), true);
  assert.deepEqual(lines.out, []);
  assert.deepEqual(lines.err, ['Gallery tracker is stale.']);
});

test('OPF_TRACKER_STALE=warn turns the failure into a warning annotation', () => {
  const { lines, log } = capture();
  assert.equal(reportStale('Font tracker drift.', { OPF_TRACKER_STALE: 'warn' }, log), false);
  assert.match(lines.out[0], /^::warning title=Generated tracker is stale::Font tracker drift\. It is regenerated after merge/);
  assert.deepEqual(lines.err, []);
});

test('any other value is an error rather than a silent pass', () => {
  assert.throws(() => staleMode({ OPF_TRACKER_STALE: 'skip' }), /must be "warn" or "fail"/);
});
