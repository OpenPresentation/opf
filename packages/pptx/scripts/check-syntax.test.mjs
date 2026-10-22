import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { listSources } from './check-syntax.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
