// RR-57 (CI diet): the shape of the workflows that keep the runner pool from saturating, and the merge-queue path scope.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const workflowDir = path.join(root, '.github/workflows');
const workflows = readdirSync(workflowDir).filter((name) => name.endsWith('.yml')).sort();
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');

/** The top-level keys under `jobs:` with their text (two-space indented keys, as in every workflow here). */
function jobsOf(text) {
  const jobs = [];
  for (const line of text.slice(text.indexOf('\njobs:\n') + 6).split('\n')) {
    const start = /^ {2}([A-Za-z0-9_-]+):\s*$/u.exec(line);
    if (start) jobs.push({ id: start[1], text: '' });
    else if (jobs.length) jobs.at(-1).text += `${line}\n`;
  }
  return jobs;
}
const triggersOf = (text) => text.slice(text.indexOf('\non:'), text.indexOf('\npermissions:') > 0 ? text.indexOf('\npermissions:') : text.indexOf('\nconcurrency:'));

test('every job has a timeout-minutes (a hung job must not hold a runner for six hours)', () => {
  const missing = [];
  for (const name of workflows) {
    for (const job of jobsOf(read(`.github/workflows/${name}`))) {
      if (/^ {4}uses:/mu.test(job.text)) continue; // a reusable workflow call cannot set one
      if (!/^ {4}timeout-minutes:/mu.test(job.text)) missing.push(`${name}: ${job.id}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('the heavy workflows run in the queue, not again on push to main', () => {
  for (const name of ['opf-ci.yml', 'ecosystem-ci.yml', 'cli-windows.yml', 'published-matrix.yml', 'installed-parity.yml']) {
    const triggers = triggersOf(read(`.github/workflows/${name}`));
    assert.ok(triggers.includes('\n  merge_group:'), `${name} runs for the merge queue`);
    assert.ok(!triggers.includes('\n  push:'), `${name} has no push trigger: the queue tested the exact commit main moves to`);
  }
  assert.ok(triggersOf(read('.github/workflows/ecosystem-ci.yml')).includes('\n  schedule:'), 'the nightly run stays the safety net');
});

test('the legs moved off pull requests start from the label full-ci and ignore other labels', () => {
  for (const name of ['engines-range.yml', 'cli-windows.yml', 'published-matrix.yml', 'installed-parity.yml']) {
    const text = read(`.github/workflows/${name}`);
    assert.match(triggersOf(text), /types: \[opened, synchronize, reopened, labeled\]/u, name);
    assert.match(text, /contains\(github\.event\.pull_request\.labels\.\*\.name, 'full-ci'\)/u, name);
    assert.match(text, /github\.event\.action == 'labeled' && github\.event\.label\.name != 'full-ci' && 'ignored'/u, `${name}: an unrelated label has its own concurrency group`);
  }
  // The required workflows never see the `labeled` event, so an unrelated label cannot re-run a required check.
  for (const name of ['opf-ci.yml', 'ecosystem-ci.yml']) assert.doesNotMatch(triggersOf(read(`.github/workflows/${name}`)), /labeled/u, name);
});

test('the Node 22 and 26 legs are not in OPF CI any more and keep their job name', () => {
  assert.doesNotMatch(read('.github/workflows/opf-ci.yml'), /node-range|engines range/u);
  const engines = read('.github/workflows/engines-range.yml');
  assert.match(engines, /name: Node \$\{\{ matrix\.node \}\} \(engines range\)/u);
  assert.match(engines, /node: \[22, 26\]/u);
});

// The paths-changed composite action, run against a real queue-shaped repository.
function actionScript() {
  const text = read('.github/actions/paths-changed/action.yml');
  return text.slice(text.indexOf('      run: |\n') + '      run: |\n'.length).replace(/^ {8}/gmu, '');
}
function scopeOutcome({ files, patterns, event = 'merge_group', baseSha = 'base' }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'opf-paths-changed-'));
  try {
    const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' }).trim();
    const origin = path.join(dir, 'origin');
    mkdirSync(origin);
    git(origin, 'init', '-q', '-b', 'main');
    writeFileSync(path.join(origin, 'README.md'), 'x');
    git(origin, 'add', '.');
    git(origin, 'commit', '-q', '-m', 'base');
    const base = git(origin, 'rev-parse', 'HEAD');
    for (const file of files) {
      mkdirSync(path.dirname(path.join(origin, file)), { recursive: true });
      writeFileSync(path.join(origin, file), 'changed');
    }
    git(origin, 'add', '.');
    git(origin, 'commit', '-q', '-m', 'entry', '--allow-empty');
    const work = path.join(dir, 'work');
    git(dir, 'clone', '-q', '--depth=1', `file://${origin}`, work);
    const output = path.join(dir, 'output');
    writeFileSync(output, '');
    const result = spawnSync('bash', ['-c', actionScript()], {
      cwd: work,
      encoding: 'utf8',
      env: { ...process.env, EVENT: event, BASE_SHA: baseSha === 'base' ? base : baseSha, PATTERNS: patterns, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: path.join(dir, 'summary') },
    });
    assert.equal(result.status, 0, result.stderr);
    return readFileSync(output, 'utf8').trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('paths-changed: a queue entry runs the legs only when it changes a matching path', () => {
  const patterns = 'packages/cli/**\nscripts/run-tests.mjs\n  .github/workflows/cli-windows.yml\n';
  assert.equal(scopeOutcome({ files: ['packages/cli/src/a/b.mjs'], patterns }), 'run=true');
  assert.equal(scopeOutcome({ files: ['scripts/run-tests.mjs'], patterns }), 'run=true');
  assert.equal(scopeOutcome({ files: ['docs/x.md', 'packages/javascript/src/x.ts'], patterns }), 'run=false');
});

test('paths-changed: every other event, and any failure to list the files, answers run=true', () => {
  assert.equal(scopeOutcome({ files: ['docs/x.md'], patterns: 'packages/cli/**', event: 'pull_request' }), 'run=true');
  assert.equal(scopeOutcome({ files: ['docs/x.md'], patterns: 'packages/cli/**', baseSha: '' }), 'run=true');
  assert.equal(scopeOutcome({ files: ['docs/x.md'], patterns: 'packages/cli/**', baseSha: '0123456789012345678901234567890123456789' }), 'run=true');
});
