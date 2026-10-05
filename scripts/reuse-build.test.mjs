// RR-45 (opf#368, item 5): a build is reused only within the CI job that made it.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { canReuse, stamp, stampPath } from './reuse-build.mjs';

const script = fileURLToPath(new URL('./reuse-build.mjs', import.meta.url));
function packageDirectory() {
  const directory = mkdtempSync(path.join(tmpdir(), 'opf-reuse-build-'));
  mkdirSync(path.join(directory, 'dist'));
  writeFileSync(path.join(directory, 'dist', 'index.js'), 'export {};\n');
  return directory;
}

test('without OPF_REUSE_BUILD nothing is ever reused and stamp removes an old stamp', () => {
  const directory = packageDirectory();
  try {
    assert.equal(stamp(directory, 'job-1'), true);
    assert.equal(canReuse(directory, ''), false);
    assert.equal(canReuse(directory, undefined), false);
    assert.equal(stamp(directory, ''), false);
    assert.equal(existsSync(stampPath(directory)), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('a build is reused only for the token that stamped it, and only while dist/index.js exists', () => {
  const directory = packageDirectory();
  try {
    assert.equal(canReuse(directory, 'run-1-1-verify'), false, 'no stamp yet');
    stamp(directory, 'run-1-1-verify');
    assert.equal(readFileSync(stampPath(directory), 'utf8'), 'run-1-1-verify');
    assert.equal(canReuse(directory, 'run-1-1-verify'), true);
    assert.equal(canReuse(directory, 'run-1-2-verify'), false, 'another attempt builds again');
    assert.equal(canReuse(directory, 'run-1-1-node-range'), false, 'another job builds again');
    rmSync(path.join(directory, 'dist'), { recursive: true });
    assert.equal(canReuse(directory, 'run-1-1-verify'), false, 'a cleaned package builds again');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('the command line: check exits 0 only to reuse, 1 to build; a bad command exits 2', () => {
  const directory = packageDirectory();
  const run = (args, token) => spawnSync(process.execPath, [script, ...args, directory], { encoding: 'utf8', env: { ...process.env, OPF_REUSE_BUILD: token } }).status;
  try {
    assert.equal(run(['check'], 'job'), 1);
    assert.equal(run(['stamp'], 'job'), 0);
    assert.equal(run(['check'], 'job'), 0);
    assert.equal(run(['check'], ''), 1);
    assert.equal(run(['stamp'], ''), 0);
    assert.equal(run(['check'], 'job'), 1, 'a stamp without a token removed the old stamp');
    assert.equal(run(['other'], 'job'), 2);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('both package builds go through reuse-build and stamp only after the whole build', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const core = JSON.parse(readFileSync(path.join(root, 'packages/javascript/package.json'), 'utf8')).scripts.build;
  const cli = JSON.parse(readFileSync(path.join(root, 'packages/cli/package.json'), 'utf8')).scripts.build;
  assert.match(core, /^node \.\.\/\.\.\/scripts\/reuse-build\.mjs check \|\| \(.*tsup.*&& node \.\.\/\.\.\/scripts\/reuse-build\.mjs stamp\)$/);
  assert.match(cli, /^pnpm --filter @openpresentation\/opf build && \(node \.\.\/\.\.\/scripts\/reuse-build\.mjs check \|\| \(tsup && node \.\.\/\.\.\/scripts\/reuse-build\.mjs stamp\)\)$/);
});
