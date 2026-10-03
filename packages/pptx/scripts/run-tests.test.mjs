import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { listSources } from './check-syntax.mjs';
import { BROWSER, selectTests } from './run-tests.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('selectTests runs the glob in name order minus the excluded files and the browser suites', () => {
  const files = ['b.mjs', 'a.mjs', 'helper.mjs', 'x-browser.mjs', 'browser-check.mjs', 'fonts-browser.mjs', 'node-test.mjs'];
  const suites = { exclude: ['helper.mjs'], include: ['fonts-browser.mjs'], nodeTest: ['node-test.mjs'] };
  assert.deepEqual(selectTests(files, suites), [
    { file: 'test/a.mjs', args: [] },
    { file: 'test/b.mjs', args: [] },
    { file: 'test/fonts-browser.mjs', args: [] },
    { file: 'test/node-test.mjs', args: ['--test'] },
  ]);
});

test('selectTests fails on a stale or contradictory suites.json instead of silently dropping a test', () => {
  assert.throws(() => selectTests(['a.mjs'], { exclude: ['gone.mjs'] }), /exclude names gone\.mjs/);
  assert.throws(() => selectTests(['a.mjs'], { include: ['a.mjs'] }), /does not skip/);
  assert.throws(() => selectTests(['a-browser.mjs'], { include: ['a-browser.mjs'], exclude: ['a-browser.mjs'] }), /both include and exclude/);
  assert.throws(() => selectTests(['a.mjs'], { exclude: ['a.mjs', 'a.mjs'] }), /twice/);
});

test('the browser pattern matches browser suites and not look-alikes', () => {
  for (const name of ['rich-tab-browser.mjs', 'browser-check.mjs', 'fonts-browser.mjs', 'a-browser-b.mjs']) assert.ok(BROWSER.test(name), name);
  for (const name of ['browsers.mjs', 'rich-tab.mjs', 'unbrowserlike.mjs']) assert.equal(BROWSER.test(name), false, name);
});

test('test/suites.json agrees with test/ and every excluded file is a real file', () => {
  const suites = JSON.parse(readFileSync(path.join(root, 'test', 'suites.json'), 'utf8'));
  const files = readdirSync(path.join(root, 'test'), { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.mjs')).map((e) => e.name);
  const tests = selectTests(files, suites);
  assert.ok(tests.length > 0);
  assert.equal(new Set(tests.map((t) => t.file)).size, tests.length);
});

test('RR-53: the contract suite is the full suite minus contractExclude, and a stale or unexplained exclusion fails', () => {
  const files = ['a.mjs', 'b.mjs', 'c.mjs', 'c-browser.mjs', 'helper.mjs'];
  const suites = { exclude: ['helper.mjs'], contractExclude: { 'b.mjs': 'package internal' } };
  assert.deepEqual(selectTests(files, suites).map((t) => t.file), ['test/a.mjs', 'test/b.mjs', 'test/c.mjs']);
  assert.deepEqual(selectTests(files, suites, 'contract').map((t) => t.file), ['test/a.mjs', 'test/c.mjs']);
  assert.deepEqual(selectTests(files, { exclude: suites.exclude }, 'contract'), selectTests(files, { exclude: suites.exclude }), 'no contractExclude: the contract is the full suite');
  assert.throws(() => selectTests(files, { contractExclude: { 'gone.mjs': 'x' } }, 'contract'), /contractExclude names gone\.mjs/);
  assert.throws(() => selectTests(files, { exclude: ['a.mjs'], contractExclude: { 'a.mjs': 'x' } }, 'contract'), /contractExclude names a\.mjs, which the full suite does not run/);
  assert.throws(() => selectTests(files, { contractExclude: { 'c-browser.mjs': 'x' } }, 'contract'), /does not run/);
  assert.throws(() => selectTests(files, { contractExclude: { 'a.mjs': ' ' } }, 'contract'), /needs a reason for a\.mjs/);
  assert.throws(() => selectTests(files, suites, 'nightly'), /Unknown suite/);
});

test('RR-53: test/suites.json contract exclusions are real full-suite tests with reasons, and npm run test:contract runs the contract suite', () => {
  const suites = JSON.parse(readFileSync(path.join(root, 'test', 'suites.json'), 'utf8'));
  const files = readdirSync(path.join(root, 'test'), { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.mjs')).map((e) => e.name);
  const full = selectTests(files, suites).map((t) => t.file);
  const contract = selectTests(files, suites, 'contract').map((t) => t.file);
  const excluded = Object.keys(suites.contractExclude ?? {});
  assert.equal(contract.length, full.length - excluded.length);
  assert.ok(contract.length > 0 && contract.every((file) => full.includes(file)), 'the contract is a subset of the full suite');
  for (const name of excluded) assert.ok(full.includes(`test/${name}`), `${name} is a full-suite test`);
  const scripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  assert.match(scripts['test:contract'], /run-tests\.mjs --suite contract/);
  assert.doesNotMatch(scripts.test, /--suite/, 'npm test stays the full suite');
  assert.match(scripts.test, /run-tests\.mjs(?! --suite)/);
});

test('run-tests stops at the first failing test and lists commands with --list', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'run-tests-'));
  try {
    mkdirSync(path.join(dir, 'scripts'));
    mkdirSync(path.join(dir, 'test'));
    for (const name of ['run-tests.mjs']) writeFileSync(path.join(dir, 'scripts', name), readFileSync(path.join(root, 'scripts', name)));
    writeFileSync(path.join(dir, 'test', 'a.mjs'), 'console.log("ran a");\n');
    writeFileSync(path.join(dir, 'test', 'b.mjs'), 'process.exit(3);\n');
    writeFileSync(path.join(dir, 'test', 'c.mjs'), 'console.log("ran c");\n');
    writeFileSync(path.join(dir, 'test', 'c-browser.mjs'), 'process.exit(9);\n');
    const run = (...args) => spawnSync(process.execPath, [path.join(dir, 'scripts', 'run-tests.mjs'), ...args], { encoding: 'utf8' });
    assert.equal(run('--list').stdout, 'node test/a.mjs\nnode test/b.mjs\nnode test/c.mjs\n');
    const result = run();
    assert.equal(result.status, 3);
    assert.match(result.stdout, /ran a/);
    assert.doesNotMatch(result.stdout, /ran c/);
    assert.match(result.stderr, /test\/b\.mjs failed \(exit 3\); 1 test\(s\) not run/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('check-syntax lists sources in a stable order, skips fixtures and reports a syntax error', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'check-syntax-'));
  try {
    mkdirSync(path.join(dir, 'scripts'));
    mkdirSync(path.join(dir, 'src', 'fixtures'), { recursive: true });
    mkdirSync(path.join(dir, 'src', 'sub'));
    writeFileSync(path.join(dir, 'scripts', 'check-syntax.mjs'), readFileSync(path.join(root, 'scripts', 'check-syntax.mjs')));
    writeFileSync(path.join(dir, 'src', 'b.js'), 'export const b = 1;\n');
    writeFileSync(path.join(dir, 'src', 'a.mjs'), 'export const a = 1;\n');
    writeFileSync(path.join(dir, 'src', 'readme.md'), 'not code\n');
    writeFileSync(path.join(dir, 'src', 'fixtures', 'broken.js'), 'this is not javascript (\n');
    writeFileSync(path.join(dir, 'src', 'sub', 'c.cjs'), 'module.exports = 1;\n');
    assert.deepEqual(listSources(dir, 'src'), ['src/a.mjs', 'src/b.js', 'src/sub/c.cjs']);
    const run = (...args) => spawnSync(process.execPath, [path.join(dir, 'scripts', 'check-syntax.mjs'), ...args], { encoding: 'utf8' });
    const ok = run('src');
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /3 files checked, 0 failed/);
    writeFileSync(path.join(dir, 'src', 'sub', 'bad.js'), 'const = ;\n');
    const bad = run('src');
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /syntax error in src\/sub\/bad\.js/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
