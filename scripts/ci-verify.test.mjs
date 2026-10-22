// MR-30: the verify aggregator: skipped by scope is success, skipped otherwise is failure, and nothing unreadable passes.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderMarkdown, run, verdict } from './ci-verify.mjs';
import { scope, TARGET_GRAPH } from './ci-scope.mjs';

const needsOf = (results) => Object.fromEntries(Object.entries(results).map(([job, result]) => [job, { result }]));
const jobs = { lint: 'full', core: 'full', render: 'contract', editor: 'skip' };

test('every selected job succeeded and the skipped one is skipped: verify passes', () => {
  const result = verdict({ needs: needsOf({ scope: 'success', lint: 'success', core: 'success', render: 'success', editor: 'skipped' }), jobs });
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
  assert.equal(result.rows.length, 4);
});

test('a job the scope skipped may also have run and succeeded', () => {
  assert.equal(verdict({ needs: needsOf({ scope: 'success', lint: 'success', core: 'success', render: 'success', editor: 'success' }), jobs }).ok, true);
});

test('a selected job that was skipped, failed or cancelled fails verify', () => {
  for (const bad of ['skipped', 'failure', 'cancelled']) {
    const result = verdict({ needs: needsOf({ scope: 'success', lint: 'success', core: bad, render: 'success', editor: 'skipped' }), jobs });
    assert.equal(result.ok, false, bad);
    assert.match(result.problems[0], new RegExp(`core: expected success, got ${bad}`));
  }
});

test('a skipped-by-scope job that failed fails verify', () => {
  const result = verdict({ needs: needsOf({ scope: 'success', lint: 'success', core: 'success', render: 'success', editor: 'failure' }), jobs });
  assert.equal(result.ok, false);
  assert.match(result.problems[0], /editor/);
});

test('scope failing or its output unreadable fails closed', () => {
  assert.equal(verdict({ needs: needsOf({ scope: 'failure' }), jobs: null }).ok, false);
  assert.equal(verdict({ needs: needsOf({ scope: 'success', lint: 'success' }), jobs: null }).ok, false);
  assert.equal(verdict({ needs: needsOf({ scope: 'success', lint: 'success' }), jobs: ['lint'] }).ok, false);
  assert.equal(verdict({ needs: {}, jobs }).ok, false);
  const failedScope = verdict({ needs: needsOf({ scope: 'failure', lint: 'success', core: 'success', render: 'success', editor: 'skipped' }), jobs });
  assert.equal(failedScope.ok, false);
  assert.match(failedScope.problems[0], /scope: expected success, got failure/);
});

test('a job the scope names but verify does not wait for fails verify (the workflow and the scope drifted apart)', () => {
  const result = verdict({ needs: needsOf({ scope: 'success', lint: 'success', core: 'success', render: 'success' }), jobs });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(' '), /editor: expected skipped, got not a dependency of verify/);
});

test('a job outside the scope is a gate; only an optional one may be skipped', () => {
  const base = { scope: 'success', lint: 'success', core: 'success', render: 'success', editor: 'skipped' };
  assert.equal(verdict({ needs: needsOf({ ...base, slow: 'success' }), jobs }).ok, true);
  assert.equal(verdict({ needs: needsOf({ ...base, slow: 'skipped' }), jobs }).ok, false);
  assert.equal(verdict({ needs: needsOf({ ...base, slow: 'skipped' }), jobs, optional: ['slow'] }).ok, true);
  assert.equal(verdict({ needs: needsOf({ ...base, slow: 'failure' }), jobs, optional: ['slow'] }).ok, false);
});

test('the markdown lists every job and marks the wrong ones', () => {
  const markdown = renderMarkdown(verdict({ needs: needsOf({ scope: 'success', lint: 'success', core: 'failure', render: 'success', editor: 'skipped' }), jobs }));
  assert.match(markdown, /^### verify: FAILED/);
  assert.match(markdown, /\| core \| success \| failure \(wrong\) \|/);
  assert.match(markdown, /\| editor \| skipped by scope \| skipped \|/);
});

test('with a real scope decision: a docs-only change passes when every package job is skipped', () => {
  const decision = scope({ files: ['docs/programs/monorepo/README.md'], graph: TARGET_GRAPH });
  const results = Object.fromEntries(Object.entries(decision.jobs).map(([job, tier]) => [job, tier === 'skip' ? 'skipped' : 'success']));
  assert.equal(verdict({ needs: needsOf({ scope: 'success', ...results }), jobs: decision.jobs }).ok, true);
  assert.deepEqual(decision.required, ['lint']);
  const wrong = { ...results, lint: 'skipped' };
  assert.equal(verdict({ needs: needsOf({ scope: 'success', ...wrong }), jobs: decision.jobs }).ok, false);
});

test('run reads NEEDS and JOBS, writes the step summary, and the command line exits 1 on a failure', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ci-verify-'));
  try {
    const summary = path.join(dir, 'summary.md');
    const ok = run([], { NEEDS: JSON.stringify(needsOf({ scope: 'success', lint: 'success', core: 'success', render: 'success', editor: 'skipped' })), JOBS: JSON.stringify(jobs), GITHUB_STEP_SUMMARY: summary });
    assert.equal(ok.ok, true);
    assert.match(readFileSync(summary, 'utf8'), /every job the scope selected passed/);
    assert.equal(run([], { NEEDS: 'not json', JOBS: '' }).ok, false);
    assert.throws(() => run(['--frobnicate'], {}), /unknown argument/);
    const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ci-verify.mjs');
    const failing = spawnSync(process.execPath, [script, '--optional', 'slow'], { encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '', NEEDS: JSON.stringify(needsOf({ scope: 'success', lint: 'failure', core: 'success', render: 'success', editor: 'skipped' })), JOBS: JSON.stringify(jobs) } });
    assert.equal(failing.status, 1);
    assert.match(failing.stdout, /::error title=verify::lint: expected success, got failure/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
