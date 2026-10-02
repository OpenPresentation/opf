import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { aggregate, fromPlaywrightJson, render } from './flake-repeat.mjs';
import { splitCommand, validateQuarantine } from './quarantine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const known = new Set(['a', 'b']);
const entry = (patch = {}) => ({ id: 'a', issue: 'https://github.com/OpenPresentation/opf/issues/1', owner: '@owner', reason: 'flakes on a slow runner', added: '2026-10-01', expires: '2026-10-10', ...patch });
const check = (entries, today = '2026-10-02') => validateQuarantine({ schema: 1, entries }, { today, knownIds: known });

test('an empty list is valid and honours nothing', () => {
  assert.deepEqual(check([]), { errors: [], expired: [], active: [] });
});
test('a complete entry is honoured until its expiry date, inclusive', () => {
  assert.deepEqual(check([entry()]).active, ['a']);
  assert.deepEqual(check([entry()], '2026-10-10').active, ['a']);
});
test('an expired entry is an error and is not honoured', () => {
  const result = check([entry()], '2026-10-11');
  assert.deepEqual(result.expired, ['a']);
  assert.deepEqual(result.active, []);
  assert.match(result.errors[0], /expired on 2026-10-10/);
});
test('an expiry more than 14 days after the day it was added is refused', () => {
  assert.match(check([entry({ expires: '2026-10-16' })]).errors[0], /more than 14 days/);
  assert.deepEqual(check([entry({ expires: '2026-10-16' })]).active, []);
  assert.deepEqual(check([entry({ expires: '2026-10-15' })]).errors, []);
});
test('every field is required and the issue must be a GitHub issue link', () => {
  for (const patch of [{ issue: 'https://example.com/1' }, { issue: 'https://github.com/OpenPresentation/opf/pull/1' }, { owner: ' ' }, { reason: '' }, { added: '2026-02-30' }, { expires: 'soon' }, { id: '' }]) {
    assert.equal(check([entry(patch)]).errors.length, 1, JSON.stringify(patch));
  }
});
test('an id that is not a test, a duplicate and a future "added" are refused', () => {
  assert.match(check([entry({ id: 'zzz' })]).errors[0], /not a test/);
  assert.match(check([entry(), entry()]).errors[0], /listed twice/);
  assert.match(check([entry({ added: '2026-10-03', expires: '2026-10-05' })]).errors[0], /future/);
});
test('suite commands are plain argument lists', () => {
  assert.deepEqual(splitCommand('node test/a.mjs  artifacts/x'), ['node', 'test/a.mjs', 'artifacts/x']);
  assert.throws(() => splitCommand('node -e "1"'), /plain argument list/);
});

// --- the command line, in a scratch repository -------------------------------------------------------------------
function scratch() {
  const root = mkdtempSync(path.join(tmpdir(), 'quarantine-'));
  mkdirSync(path.join(root, 'test'));
  writeFileSync(path.join(root, 'test/pass.mjs'), 'console.log("pass")');
  writeFileSync(path.join(root, 'test/fail.mjs'), 'console.error("boom"); process.exit(3)');
  writeFileSync(path.join(root, 'test/flip.mjs'), 'import fs from "node:fs"; const n=fs.existsSync("flip.count")?+fs.readFileSync("flip.count","utf8"):0; fs.writeFileSync("flip.count",String(n+1)); process.exit(n%2?0:1)');
  writeFileSync(path.join(root, 'test/browser-suites.json'), JSON.stringify({ schema: 1, suites: { s: { tests: [{ id: 'pass', command: 'node test/pass.mjs' }, { id: 'fail', command: 'node test/fail.mjs' }, { id: 'last', command: 'node test/pass.mjs' }] }, f: { tests: [{ id: 'flip', command: 'node test/flip.mjs' }] }, c: { continueOnFailure: true, tests: [{ id: 'cfail', command: 'node test/fail.mjs' }, { id: 'clast', command: 'node test/pass.mjs' }] } } }));
  return root;
}
const write = (root, entries) => writeFileSync(path.join(root, 'test/quarantine.json'), JSON.stringify({ schema: 1, entries }));
const cli = (root, script, ...args) => spawnSync(process.execPath, [path.join(here, script), ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '' } });

test('check passes on an empty list and fails on an expired entry', () => {
  const root = scratch();
  write(root, []);
  assert.equal(cli(root, 'quarantine.mjs', 'check', '--today', '2026-10-02').status, 0);
  write(root, [entry({ id: 'fail' })]);
  assert.equal(cli(root, 'quarantine.mjs', 'check', '--today', '2026-10-02').status, 0);
  const expired = cli(root, 'quarantine.mjs', 'check', '--today', '2026-10-20');
  assert.equal(expired.status, 1);
  assert.match(expired.stderr, /expired on 2026-10-10/);
});
test('without a quarantine entry a failing test fails the suite and stops it', () => {
  const root = scratch();
  write(root, []);
  const run = cli(root, 'quarantine.mjs', 'run-suite', 's', '--today', '2026-10-02');
  assert.equal(run.status, 3);
  assert.doesNotMatch(run.stdout, /> last/);
});
test('a quarantined failing test is deferred, the suite passes and the deferred step reports it without failing', () => {
  const root = scratch();
  write(root, [entry({ id: 'fail' })]);
  const run = cli(root, 'quarantine.mjs', 'run-suite', 's', '--today', '2026-10-02');
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /> last/);
  assert.match(run.stdout, /::notice title=Quarantined test deferred::fail/);
  const deferred = cli(root, 'quarantine.mjs', 'run-deferred', '--today', '2026-10-02');
  assert.equal(deferred.status, 0);
  assert.match(deferred.stdout, /::warning title=Quarantined test failed::fail/);
  const report = JSON.parse(readFileSync(path.join(root, 'artifacts/quarantine/report.json'), 'utf8'));
  assert.equal(report.failed, 1);
  assert.equal(report.tests[0].issue, 'https://github.com/OpenPresentation/opf/issues/1');
});
test('a continueOnFailure suite runs every test and then fails with the first failure', () => {
  const root = scratch();
  write(root, []);
  const run = cli(root, 'quarantine.mjs', 'run-suite', 'c', '--today', '2026-10-02');
  assert.equal(run.status, 3);
  assert.match(run.stdout, /> clast/);
});
test('an expired entry is not honoured: its test is a gate again', () => {
  const root = scratch();
  write(root, [entry({ id: 'fail' })]);
  assert.equal(cli(root, 'quarantine.mjs', 'run-suite', 's', '--today', '2026-10-20').status, 3);
});
test('flake-repeat records a pass rate per test and keeps going after a failure', () => {
  const root = scratch();
  const run = cli(root, 'flake-repeat.mjs', '--suite', 'f', '--repeat', '4', '--out', 'out');
  assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(readFileSync(path.join(root, 'out/flake-repeat.json'), 'utf8'));
  assert.equal(report.tests.length, 1);
  assert.deepEqual([report.tests[0].runs, report.tests[0].passes, report.tests[0].passRate], [4, 2, 0.5]);
  assert.match(run.stdout, /::warning title=Flaky test::flip passed 2 of 4 runs \(50%\)/);
  assert.match(readFileSync(path.join(root, 'out/flake-repeat.md'), 'utf8'), /\| f \| `flip` \| 4 \| 2 \| 50% \|/);
});
test('aggregate, render and the Playwright JSON reader agree on the numbers', () => {
  const rows = aggregate([{ id: 'x', suite: 's', rep: 1, ok: true, ms: 1000 }, { id: 'x', suite: 's', rep: 2, ok: false, code: 1, ms: 3000, tail: ['bad'] }]);
  assert.deepEqual([rows[0].runs, rows[0].passes, rows[0].passRate, rows[0].medianSeconds], [2, 1, 0.5, 2]);
  assert.match(render({ repeat: 2, commit: 'abc', runner: 'x', startedAt: 'now', tests: rows }), /1 of 1 tests failed at least once/);
  const runs = fromPlaywrightJson({ suites: [{ title: 'a.spec.ts', file: 'a.spec.ts', specs: [{ title: 't', file: 'a.spec.ts', tests: [{ projectName: 'chromium', results: [{ status: 'passed', duration: 5 }, { status: 'failed', duration: 7, error: { message: 'nope' } }] }] }] }] });
  assert.deepEqual(aggregate(runs).map((row) => [row.id, row.runs, row.passes]), [['a.spec.ts › t', 2, 1]]);
});
