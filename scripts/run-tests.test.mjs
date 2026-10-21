import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { BROWSER, nodeArgs, selectTests } from './run-tests.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runner = path.join(root, 'scripts', 'run-tests.mjs');

test('selectTests puts *.test.mjs in the node:test batch and runs the other files by name, minus the excluded ones', () => {
  const files = ['b.mjs', 'a.mjs', 'helper.mjs', 'x-browser.mjs', 'browser-check.mjs', 'fonts-browser.mjs', 'z.test.mjs', 'y.test.mjs'];
  const suites = { exclude: ['helper.mjs'], include: ['fonts-browser.mjs'] };
  assert.deepEqual(selectTests(files, suites), { batch: ['y.test.mjs', 'z.test.mjs'], scripts: ['a.mjs', 'b.mjs', 'fonts-browser.mjs'] });
});

test('selectTests fails on a stale or contradictory suites.json instead of silently dropping a test', () => {
  assert.throws(() => selectTests(['a.mjs'], { exclude: ['gone.mjs'] }), /exclude names gone\.mjs/);
  assert.throws(() => selectTests(['a.mjs'], { include: ['a.mjs'] }), /does not skip/);
  assert.throws(() => selectTests(['a-browser.mjs'], { include: ['a-browser.mjs'], exclude: ['a-browser.mjs'] }), /both include and exclude/);
  assert.throws(() => selectTests(['a.mjs'], { exclude: ['a.mjs', 'a.mjs'] }), /twice/);
});

test('the browser pattern matches browser suites and not look-alikes', () => {
  for (const name of ['rich-tab-browser.mjs', 'browser-check.mjs', 'a-browser-b.mjs']) assert.ok(BROWSER.test(name), name);
  for (const name of ['browsers.mjs', 'rich-tab.mjs']) assert.equal(BROWSER.test(name), false, name);
});

test('selectTests treats nodeTest files as name-order scripts that run under node --test', () => {
  const files = ['a.mjs', 'node-test.mjs', 'z.test.mjs'];
  const suites = { nodeTest: ['node-test.mjs'] };
  assert.deepEqual(selectTests(files, suites), { batch: ['z.test.mjs'], scripts: ['a.mjs', 'node-test.mjs'] });
  assert.deepEqual(nodeArgs('a.mjs', suites), ['test/a.mjs']);
  assert.deepEqual(nodeArgs('node-test.mjs', suites), ['--test', 'test/node-test.mjs']);
  assert.throws(() => selectTests(files, { nodeTest: ['gone.mjs'] }), /nodeTest names gone\.mjs/);
  assert.throws(() => selectTests(files, { nodeTest: ['z.test.mjs'] }), /already runs in the node:test batch/);
  assert.throws(() => selectTests(files, { nodeTest: ['a.mjs'], exclude: ['a.mjs'] }), /both nodeTest and exclude/);
  assert.throws(() => selectTests(files, { nodeTest: ['a.mjs', 'a.mjs'] }), /twice/);
});

test('RR-53: the contract suite is the full suite minus contractExclude, and a stale or unexplained exclusion fails', () => {
  const files = ['a.mjs', 'b.mjs', 'c.mjs', 'c-browser.mjs', 'helper.mjs', 'u.test.mjs'];
  const suites = { exclude: ['helper.mjs'], contractExclude: { 'b.mjs': 'package internal', 'u.test.mjs': 'package internal' } };
  assert.deepEqual(selectTests(files, suites), { batch: ['u.test.mjs'], scripts: ['a.mjs', 'b.mjs', 'c.mjs'] });
  assert.deepEqual(selectTests(files, suites, 'contract'), { batch: [], scripts: ['a.mjs', 'c.mjs'] });
  assert.deepEqual(selectTests(files, { exclude: suites.exclude }, 'contract'), selectTests(files, { exclude: suites.exclude }), 'no contractExclude: the contract is the full suite');
  assert.throws(() => selectTests(files, { contractExclude: { 'gone.mjs': 'x' } }, 'contract'), /contractExclude names gone\.mjs/);
  assert.throws(() => selectTests(files, { exclude: ['a.mjs'], contractExclude: { 'a.mjs': 'x' } }, 'contract'), /contractExclude names a\.mjs, which the full suite does not run/);
  assert.throws(() => selectTests(files, { contractExclude: { 'c-browser.mjs': 'x' } }, 'contract'), /does not run/);
  assert.throws(() => selectTests(files, { contractExclude: { 'a.mjs': ' ' } }, 'contract'), /needs a reason for a\.mjs/);
  assert.throws(() => selectTests(files, suites, 'nightly'), /Unknown suite/);
});

// Every package directory with a test/suites.json (core and the CLI today; the imported packages join as they land).
const packageDirectories = () => readdirSync(path.join(root, 'packages'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(path.join(root, 'packages', e.name, 'test', 'suites.json')))
  .map((e) => `packages/${e.name}`);

test('every package test directory agrees with its suites.json and its contract exclusions', () => {
  const directories = packageDirectories();
  assert.ok(directories.includes('packages/javascript') && directories.includes('packages/cli'));
  for (const dir of directories) {
    const suites = JSON.parse(readFileSync(path.join(root, dir, 'test', 'suites.json'), 'utf8'));
    const files = readdirSync(path.join(root, dir, 'test'), { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.mjs'))
      .map((e) => e.name);
    const { batch, scripts } = selectTests(files, suites);
    assert.ok(batch.length + scripts.length > 0, dir);
    if (dir === 'packages/javascript' || dir === 'packages/cli') {
      assert.ok(batch.length > 0, dir);
      assert.ok(scripts.length > 0, dir);
    }
    const excluded = Object.keys(suites.contractExclude ?? {});
    const contract = selectTests(files, suites, 'contract');
    assert.equal(contract.batch.length + contract.scripts.length, batch.length + scripts.length - excluded.length, dir);
    for (const name of excluded) assert.ok([...batch, ...scripts].includes(name), `${dir}: ${name} is a full-suite test`);
    const scriptsText = JSON.parse(readFileSync(path.join(root, dir, 'package.json'), 'utf8')).scripts;
    if (scriptsText['test:contract']) {
      assert.match(scriptsText['test:contract'], /run-tests\.mjs --suite contract/, dir);
      assert.doesNotMatch(scriptsText.test, /--suite/, `${dir}: npm test stays the full suite`);
    }
  }
});

test('run-tests runs the batch, then the scripts in order, stops at the first failure, and lists commands with --list', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'run-tests-'));
  try {
    mkdirSync(path.join(dir, 'test'));
    writeFileSync(path.join(dir, 'test', 'unit.test.mjs'), "import test from 'node:test';\ntest('ok', () => {});\n");
    writeFileSync(path.join(dir, 'test', 'a.mjs'), 'console.log("ran a");\n');
    writeFileSync(path.join(dir, 'test', 'b.mjs'), 'process.exit(3);\n');
    writeFileSync(path.join(dir, 'test', 'c.mjs'), 'console.log("ran c");\n');
    writeFileSync(path.join(dir, 'test', 'c-browser.mjs'), 'process.exit(9);\n');
    const run = (...args) => spawnSync(process.execPath, [runner, ...args], { cwd: dir, encoding: 'utf8' });
    assert.equal(run('--list').stdout, 'node --test test/unit.test.mjs\nnode test/a.mjs\nnode test/b.mjs\nnode test/c.mjs\n');
    const result = run();
    assert.equal(result.status, 3);
    assert.match(result.stdout, /ran a/);
    assert.doesNotMatch(result.stdout, /ran c/);
    assert.match(result.stderr, /test\/b\.mjs failed \(exit 3\); 1 test\(s\) not run/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('run-tests runs the nodeTest files under node --test, runs the contract suite with --suite, and takes the package directory with --dir', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'run-tests-'));
  try {
    mkdirSync(path.join(dir, 'test'));
    writeFileSync(path.join(dir, 'test', 'a.mjs'), 'console.log("ran a");\n');
    writeFileSync(path.join(dir, 'test', 'internal.mjs'), 'console.log("ran internal");\n');
    writeFileSync(path.join(dir, 'test', 'unit.mjs'), "import test from 'node:test';\ntest('ok', () => { console.log('ran unit'); });\n");
    writeFileSync(path.join(dir, 'test', 'suites.json'), JSON.stringify({ nodeTest: ['unit.mjs'], contractExclude: { 'internal.mjs': 'package machinery' } }));
    // Run from another directory: --dir names the package.
    const run = (...args) => spawnSync(process.execPath, [runner, '--dir', dir, ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(run('--list').stdout, 'node test/a.mjs\nnode test/internal.mjs\nnode --test test/unit.mjs\n');
    assert.equal(run('--suite', 'contract', '--list').stdout, 'node test/a.mjs\nnode --test test/unit.mjs\n');
    const full = run();
    assert.equal(full.status, 0, full.stderr);
    assert.match(full.stdout, /\[3\/3\] node --test test\/unit\.mjs/);
    assert.match(full.stdout, /run-tests: 0 node:test files and 3 scripts passed\n/);
    const contract = run('--suite', 'contract');
    assert.equal(contract.status, 0, contract.stderr);
    assert.doesNotMatch(contract.stdout, /ran internal/);
    assert.match(contract.stdout, /2 scripts passed \(contract suite\)/);
    const unknown = run('--suite', 'nightly');
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /Unknown suite nightly/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
