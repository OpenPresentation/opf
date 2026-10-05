import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { BROWSER, selectTests } from './run-tests.mjs';

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

test('every package test directory agrees with its suites.json', () => {
  for (const dir of ['packages/javascript', 'packages/cli']) {
    const suites = JSON.parse(readFileSync(path.join(root, dir, 'test', 'suites.json'), 'utf8'));
    const files = readdirSync(path.join(root, dir, 'test'), { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.mjs'))
      .map((e) => e.name);
    const { batch, scripts } = selectTests(files, suites);
    assert.ok(batch.length > 0, dir);
    assert.ok(scripts.length > 0, dir);
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
