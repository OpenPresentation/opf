import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SPARSE_PATTERNS, parseArgs, planAdd, storeDirFor, windowsPathProblem, worktreeParent } from './agent-worktree.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agent-worktree.mjs');
const GIT_IDENTITY = ['-c', 'user.email=agent@example.test', '-c', 'user.name=Agent', '-c', 'commit.gpgsign=false'];
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

test('parseArgs reads the task and the options, and rejects what it does not know', () => {
  const parsed = parseArgs(['add', 'mr-16-demo', '--branch', 'codex/x', '--store-dir', '/s', '--clone', '--url', 'file:///o', '--full', '--no-install']);
  assert.deepEqual(parsed, { command: 'add', target: 'mr-16-demo', branch: 'codex/x', storeDir: '/s', clone: true, url: 'file:///o', full: true, noInstall: true });
  assert.throws(() => parseArgs(['add', 'a', '--bogus']), /Unknown option --bogus/);
  assert.throws(() => parseArgs(['add', 'a', '--branch']), /--branch needs a value/);
  assert.throws(() => parseArgs(['add']), /Usage/);
  assert.throws(() => parseArgs(['add', 'a', 'b']), /Usage/);
});

test('the sparse profile leaves out the evidence archives of the root and of every package, and nothing else', () => {
  assert.deepEqual(SPARSE_PATTERNS, ['/*', '!/docs/evidence/', '!/packages/*/docs/evidence/']);
});

test('the shared pnpm store sits beside the checkouts unless a flag or OPF_PNPM_STORE says otherwise', () => {
  const directory = path.resolve('work', 'task-a');
  assert.equal(storeDirFor(directory, {}, {}), path.join(path.resolve('work'), '.pnpm-store'));
  assert.equal(storeDirFor(directory, {}, { OPF_PNPM_STORE: 'env-store' }), path.resolve('env-store'));
  assert.equal(storeDirFor(directory, { storeDir: 'flag-store' }, { OPF_PNPM_STORE: 'env-store' }), path.resolve('flag-store'));
  assert.equal(worktreeParent({ OPF_WORKTREE_DIR: 'here' }, 'linux', '/home/u'), path.resolve('here'));
  assert.equal(worktreeParent({}, 'linux', '/home/u'), path.join('/home/u', 'opf-work'));
  assert.equal(worktreeParent({}, 'win32', 'C:\\Users\\u'), 'C:\\opf-work');
});

test('Windows checkouts must stay on a short path', () => {
  assert.equal(windowsPathProblem('C:\\opf-work\\ff-07-script-slots', 'win32'), null);
  assert.match(windowsPathProblem(`C:\\Users\\u\\AppData\\Local\\Temp\\claude\\${'x'.repeat(40)}\\task`, 'win32'), /MAX_PATH/);
  assert.equal(windowsPathProblem(`/very/long/${'x'.repeat(80)}`, 'linux'), null);
});

test('planAdd lists the git commands of a clone and of a worktree', () => {
  const clone = planAdd({ mode: 'clone', url: 'file:///o', directory: '/w/t', branch: 'codex/t' });
  assert.deepEqual(clone.map((step) => step.args.slice(0, 3)), [['clone', '--filter=blob:none', '--no-checkout'], ['sparse-checkout', 'set', '--no-cone'], ['checkout', '--no-track', '-b']]);
  assert.deepEqual(clone[0].args.slice(3), ['file:///o', '/w/t']);
  assert.deepEqual(clone[2].args.slice(3), ['codex/t', 'origin/main']);
  const worktree = planAdd({ mode: 'worktree', repo: '/r', directory: '/w/t', branch: 'codex/t' });
  assert.deepEqual(worktree.map((step) => step.args[0]), ['fetch', 'worktree', 'sparse-checkout', 'reset']);
  assert.deepEqual(worktree[0].args, ['fetch', 'origin', 'main']);
  assert.equal(worktree[0].cwd, '/r');
  assert.deepEqual(planAdd({ mode: 'worktree', repo: '/r', directory: '/w/t', branch: 'b', sparse: false, fetch: false }).map((step) => step.args[0]), ['worktree', 'reset']);
  assert.deepEqual(planAdd({ mode: 'clone', directory: '/w/t', branch: 'b', sparse: false }).map((step) => step.args[0]), ['clone', 'checkout']);
});

// --- real git, in a scratch origin ---------------------------------------------------------------------------------
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'agent-worktree-'));
  const seed = path.join(root, 'seed');
  mkdirSync(seed);
  git(seed, 'init', '-q', '-b', 'main');
  const put = (name, text) => {
    mkdirSync(path.dirname(path.join(seed, name)), { recursive: true });
    writeFileSync(path.join(seed, name), text);
  };
  put('README.md', 'readme\n');
  put('pnpm-workspace.yaml', 'packages: []\n');
  put('scripts/agent-worktree.mjs', '// stands in for the real script: it marks this tree as a clone of the repository\n');
  put('docs/guide.md', 'guide\n');
  put('docs/evidence/big.bin', 'evidence\n');
  put('packages/render/src/index.js', 'export {};\n');
  put('packages/render/docs/evidence/big.bin', 'evidence\n');
  git(seed, 'add', '-A');
  git(seed, ...GIT_IDENTITY, 'commit', '-q', '-m', 'seed');
  const origin = path.join(root, 'origin.git');
  git(root, 'clone', '-q', '--bare', seed, origin);
  git(origin, 'config', 'uploadpack.allowFilter', 'true');
  const url = pathToFileURL(origin).href;
  const run = (cwd, ...args) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', env: { ...process.env, OPF_WORKTREE_DIR: path.join(root, 'work') } });
  return { root, url, origin, run, work: path.join(root, 'work') };
}
const files = (directory) => execFileSync('git', ['ls-files', '-z'], { cwd: directory, encoding: 'utf8' }).split('\0').filter(Boolean);

test('add --clone: sparse tree, evidence still tracked, no upstream, clean status; --full brings the evidence', () => {
  const f = fixture();
  try {
    const target = path.join(f.work, 'clone-task');
    const result = f.run(f.root, 'add', 'clone-task', '--clone', '--url', f.url, '--no-install');
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.equal(git(target, 'rev-parse', '--abbrev-ref', 'HEAD'), 'codex/clone-task');
    assert.equal(git(target, 'config', '--get', 'remote.origin.partialclonefilter'), 'blob:none');
    assert.equal(existsSync(path.join(target, 'README.md')), true);
    assert.equal(existsSync(path.join(target, 'packages', 'render', 'src', 'index.js')), true);
    assert.equal(existsSync(path.join(target, 'docs', 'evidence')), false, 'root evidence stays out of the working tree');
    assert.equal(existsSync(path.join(target, 'packages', 'render', 'docs', 'evidence')), false, 'package evidence stays out too');
    assert.ok(files(target).includes('docs/evidence/big.bin'), 'the index still lists the evidence');
    assert.equal(git(target, 'status', '--porcelain'), '');
    assert.equal(spawnSync('git', ['config', '--get', 'branch.codex/clone-task.merge'], { cwd: target }).status, 1, 'no upstream: a push goes to the branch of the same name');
    const full = f.run(f.root, 'add', 'full-task', '--clone', '--url', f.url, '--no-install', '--full');
    assert.equal(full.status, 0, full.stderr);
    assert.equal(existsSync(path.join(f.work, 'full-task', 'docs', 'evidence', 'big.bin')), true);
    assert.equal(existsSync(path.join(f.work, 'full-task', 'packages', 'render', 'docs', 'evidence', 'big.bin')), true);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test('inside a clone, add makes a sparse worktree from a fresh origin/main and leaves the clone alone; remove keeps dirty work', () => {
  const f = fixture();
  try {
    const main = path.join(f.root, 'main-clone');
    git(f.root, 'clone', '-q', f.url, main);
    // a commit lands on origin after the clone: add must fetch it
    const pusher = path.join(f.root, 'pusher');
    git(f.root, 'clone', '-q', f.url, pusher);
    writeFileSync(path.join(pusher, 'NEW.md'), 'new\n');
    git(pusher, 'add', '-A');
    git(pusher, ...GIT_IDENTITY, 'commit', '-q', '-m', 'later');
    git(pusher, 'push', '-q', 'origin', 'main');
    const result = f.run(main, 'add', 'wt-task', '--no-install');
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /worktree of /);
    const target = path.join(f.work, 'wt-task');
    assert.equal(existsSync(path.join(target, 'NEW.md')), true, 'fresh origin/main');
    assert.equal(existsSync(path.join(target, 'docs', 'evidence')), false);
    assert.equal(existsSync(path.join(target, 'packages', 'render', 'docs', 'evidence')), false);
    assert.equal(existsSync(path.join(target, 'docs', 'guide.md')), true);
    assert.equal(git(target, 'rev-parse', '--abbrev-ref', 'HEAD'), 'codex/wt-task');
    assert.equal(git(target, 'status', '--porcelain'), '');
    assert.equal(existsSync(path.join(main, 'docs', 'evidence', 'big.bin')), true, 'the clone you ran it from keeps its whole tree');
    assert.equal(git(main, 'status', '--porcelain'), '');
    // the task is not a valid name, the directory is taken
    assert.match(f.run(main, 'add', 'bad name', '--no-install').stderr, /not a task name/);
    assert.match(f.run(main, 'add', 'wt-task', '--no-install').stderr, /not empty/);
    // remove: uncommitted work is kept, then removed with --delete-branch once clean
    writeFileSync(path.join(target, 'scratch.txt'), 'wip\n');
    const kept = f.run(main, 'remove', 'wt-task');
    assert.notEqual(kept.status, 0);
    assert.equal(existsSync(target), true);
    rmSync(path.join(target, 'scratch.txt'));
    const removed = f.run(main, 'remove', 'wt-task', '--delete-branch');
    assert.equal(removed.status, 0, removed.stderr);
    assert.equal(existsSync(target), false);
    assert.equal(git(main, 'branch', '--list', 'codex/wt-task'), '');
    assert.doesNotMatch(git(main, 'worktree', 'list'), /wt-task/);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test('remove deletes a clean, pushed clone and keeps one with unpushed commits unless --force', () => {
  const f = fixture();
  try {
    const target = path.join(f.work, 'clone-task');
    assert.equal(f.run(f.root, 'add', 'clone-task', '--clone', '--url', f.url, '--no-install').status, 0);
    writeFileSync(path.join(target, 'work.txt'), 'work\n');
    git(target, 'add', '-A');
    git(target, ...GIT_IDENTITY, 'commit', '-q', '-m', 'work');
    const kept = f.run(f.root, 'remove', 'clone-task');
    assert.notEqual(kept.status, 0);
    assert.match(kept.stderr, /on no remote branch/);
    assert.equal(existsSync(target), true);
    git(target, 'push', '-q', 'origin', 'codex/clone-task');
    const removed = f.run(f.root, 'remove', target);
    assert.equal(removed.status, 0, removed.stderr);
    assert.equal(existsSync(target), false);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test('--dry-run prints the commands and the install with its store, and creates nothing', () => {
  const f = fixture();
  try {
    const result = f.run(f.root, 'add', 'dry-task', '--clone', '--url', f.url, '--dry-run', '--store-dir', path.join(f.root, 'store'));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /git clone --filter=blob:none --no-checkout /);
    assert.match(result.stdout, /git sparse-checkout set --no-cone '\/\*' '!\/docs\/evidence\/' '!\/packages\/\*\/docs\/evidence\/'/);
    assert.match(result.stdout, /pnpm install --frozen-lockfile\s+\(store .*store\)/);
    assert.equal(existsSync(path.join(f.work, 'dry-task')), false);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test('remove --delete-branch refuses a branch no remote branch contains, and --force deletes it', () => {
  const f = fixture();
  try {
    const main = path.join(f.root, 'main-clone');
    git(f.root, 'clone', '-q', f.url, main);
    assert.equal(f.run(main, 'add', 'wt-task', '--no-install').status, 0);
    const target = path.join(f.work, 'wt-task');
    writeFileSync(path.join(target, 'work.txt'), 'work\n');
    git(target, 'add', '-A');
    git(target, ...GIT_IDENTITY, 'commit', '-q', '-m', 'unpushed work');
    const refused = f.run(main, 'remove', 'wt-task', '--delete-branch');
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /on no remote branch/);
    assert.equal(existsSync(target), true);
    const forced = f.run(main, 'remove', 'wt-task', '--delete-branch', '--force');
    assert.equal(forced.status, 0, forced.stderr);
    assert.equal(existsSync(target), false);
    assert.equal(git(main, 'branch', '--list', 'codex/wt-task'), '');
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
