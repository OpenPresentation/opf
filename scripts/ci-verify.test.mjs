// MR-30: the verify aggregator: a selected job needs a leg and a green `check`, a skipped job has no leg, and nothing unreadable passes.
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
const legs = [{ job: 'lint' }, { job: 'lint' }, { job: 'core' }, { job: 'render' }, { job: 'render' }];
const green = { scope: 'success', check: 'success' };

test('every selected job has legs and the matrix job succeeded: verify passes', () => {
  const result = verdict({ needs: needsOf(green), jobs, legs });
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
  assert.equal(result.rows.length, 4);
});

test('a failed, cancelled or skipped matrix job fails verify (one red leg is a red check)', () => {
  for (const bad of ['skipped', 'failure', 'cancelled']) {
    const result = verdict({ needs: needsOf({ ...green, check: bad }), jobs, legs });
    assert.equal(result.ok, false, bad);
    assert.match(result.problems.join(' '), new RegExp(`lint: expected success, got ${bad}`));
  }
});

test('a selected job without a leg fails verify, and so does a leg of a job the scope skipped', () => {
  const missing = verdict({ needs: needsOf(green), jobs, legs: legs.filter((leg) => leg.job !== 'core') });
  assert.equal(missing.ok, false);
  assert.match(missing.problems.join(' '), /core: expected success, got no leg in the matrix/);
  const extra = verdict({ needs: needsOf(green), jobs, legs: [...legs, { job: 'editor' }] });
  assert.equal(extra.ok, false);
  assert.match(extra.problems.join(' '), /editor: expected no leg \(skipped by scope\), got 1 leg/);
  const unknown = verdict({ needs: needsOf(green), jobs, legs: [...legs, { job: 'mystery' }] });
  assert.equal(unknown.ok, false);
  assert.match(unknown.problems.join(' '), /mystery/);
});

test('an empty matrix fails verify (nothing ran)', () => {
  const result = verdict({ needs: needsOf(green), jobs: { lint: 'full' }, legs: [] });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(' '), /no leg at all/);
});

test('scope failing or its outputs unreadable fails closed', () => {
  assert.equal(verdict({ needs: needsOf({ scope: 'failure', check: 'skipped' }), jobs: null, legs: null }).ok, false);
  assert.equal(verdict({ needs: needsOf(green), jobs: null, legs }).ok, false);
  assert.equal(verdict({ needs: needsOf(green), jobs, legs: null }).ok, false);
  assert.equal(verdict({ needs: needsOf(green), jobs, legs: [{ nope: 1 }] }).ok, false);
  assert.equal(verdict({ needs: needsOf(green), jobs: ['lint'], legs }).ok, false);
  assert.equal(verdict({ needs: {}, jobs, legs }).ok, false);
  const failedScope = verdict({ needs: needsOf({ scope: 'failure', check: 'success' }), jobs, legs });
  assert.equal(failedScope.ok, false);
  assert.match(failedScope.problems[0], /scope: expected success, got failure/);
});

test('a verify that does not wait for the matrix job fails (the workflow and the scope drifted apart)', () => {
  const result = verdict({ needs: needsOf({ scope: 'success' }), jobs, legs });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(' '), /check: not a dependency of verify/);
});

test('any other job verify waits for is a gate: it must have succeeded', () => {
  assert.equal(verdict({ needs: needsOf({ ...green, later: 'success' }), jobs, legs }).ok, true);
  for (const bad of ['skipped', 'failure', 'cancelled']) assert.equal(verdict({ needs: needsOf({ ...green, later: bad }), jobs, legs }).ok, false, bad);
});

test('the markdown lists every job and marks the wrong ones', () => {
  const markdown = renderMarkdown(verdict({ needs: needsOf({ ...green, check: 'failure' }), jobs, legs }));
  assert.match(markdown, /^### verify: FAILED/);
  assert.match(markdown, /\| core \| success \| failure \(wrong\) \|/);
  assert.match(markdown, /\| editor \| no leg \(skipped by scope\) \| no leg \|/);
});

test('with a real scope decision: a docs-only change passes with the one lint leg and nothing else', () => {
  const decision = scope({ files: ['docs/programs/monorepo/README.md'], graph: TARGET_GRAPH });
  assert.deepEqual(decision.required, ['lint']);
  assert.deepEqual(decision.legs.map((leg) => leg.job), ['lint']);
  assert.equal(verdict({ needs: needsOf(green), jobs: decision.jobs, legs: decision.legs }).ok, true);
  assert.equal(verdict({ needs: needsOf({ ...green, check: 'failure' }), jobs: decision.jobs, legs: decision.legs }).ok, false);
});

test('with a real scope decision: every selected job has a leg for each kind of change', () => {
  for (const files of [['packages/render/src/a.js'], ['packages/javascript/package.json'], ['scripts/a.mjs'], ['packages/editor/test/a.mjs']]) {
    const decision = scope({ files, graph: TARGET_GRAPH });
    assert.equal(verdict({ needs: needsOf(green), jobs: decision.jobs, legs: decision.legs }).ok, true, files.join());
  }
});

test('run reads NEEDS, JOBS and LEGS, writes the step summary, and the command line exits 1 on a failure', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ci-verify-'));
  try {
    const summary = path.join(dir, 'summary.md');
    const env = { NEEDS: JSON.stringify(needsOf(green)), JOBS: JSON.stringify(jobs), LEGS: JSON.stringify(legs), GITHUB_STEP_SUMMARY: summary };
    const ok = run([], env);
    assert.equal(ok.ok, true);
    assert.match(readFileSync(summary, 'utf8'), /every job the scope selected passed/);
    assert.equal(run([], { NEEDS: 'not json', JOBS: '', LEGS: '' }).ok, false);
    assert.throws(() => run(['--frobnicate'], {}), /unknown argument/);
    const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ci-verify.mjs');
    const failing = spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, ...env, GITHUB_STEP_SUMMARY: '', NEEDS: JSON.stringify(needsOf({ ...green, check: 'failure' })) } });
    assert.equal(failing.status, 1);
    assert.match(failing.stdout, /::error title=verify::lint: expected success, got failure/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
