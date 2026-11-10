import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, realpath, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { installedLayoutAuthority, assertLayoutCatalog } from './helpers/catalog-contract.mjs';

const executable = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const authority = await installedLayoutAuthority(executable);
function run(args) {
  const result = spawnSync(process.execPath, [executable, ...args], { encoding: 'utf8', maxBuffer: 4 << 20, timeout: 20000 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
const records = run(['catalog', 'layouts']);
const summary = run(['catalogs']).find(kind => kind.kind === 'layouts');

test('the real CLI exposes the entire matching installed gallery, in order and without record drift', () => {
  assert.deepEqual(assertLayoutCatalog(records, summary, authority), authority.ids);
});

test('catalog boundaries refuse missing, extra, duplicate, reordered, count, source and record drift', () => {
  for (const [name, mutate] of [
    ['missing', r => r.pop()],
    ['extra', r => r.push({ id: 'invented-layout', name: 'Invented' })],
    ['duplicate', r => { r[1] = r[0]; }],
    ['reordered', r => r.reverse()],
    ['record', r => { r[0].name += ' changed'; }],
  ]) {
    const changed = structuredClone(records); mutate(changed);
    assert.throws(() => assertLayoutCatalog(changed, summary, authority), undefined, name);
  }
  assert.throws(() => assertLayoutCatalog(records, { ...summary, count: summary.count - 1 }, authority));
  assert.throws(() => assertLayoutCatalog(records, { ...summary, source: 'foreign-catalog' }, authority));
});

test('the copied command harness and helper run outside the checkout using the public gallery API beside the executable', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'opf-cli-catalog-copy-'));
  try {
    const target = path.join(temp, 'packages/cli/test');
    await mkdir(path.join(target, 'helpers'), { recursive: true });
    const harness = await readFile(new URL('./cli.mjs', import.meta.url));
    const helper = await readFile(new URL('./helpers/catalog-contract.mjs', import.meta.url));
    // The maintained packed.mjs copier discovers this exact literal relative URL.
    assert.match(harness.toString(), /new URL\('\.\/helpers\/catalog-contract\.mjs', import\.meta\.url\)/);
    await writeFile(path.join(target, 'copied-command-tests.mjs'), harness);
    await writeFile(path.join(target, 'helpers/catalog-contract.mjs'), helper);
    assert.deepEqual(await readFile(path.join(target, 'helpers/catalog-contract.mjs')), helper);
    const result = spawnSync(process.execPath, [path.join(target, 'copied-command-tests.mjs')], {
      cwd: temp, env: { ...process.env, OPF_TEST_BIN: executable }, encoding: 'utf8', maxBuffer: 4 << 20, timeout: 120000,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /CLI.*passed/i);
  } finally {
    const actual = await realpath(temp), parent = await realpath(tmpdir());
    assert.ok(actual.startsWith(parent + path.sep) && path.basename(actual).startsWith('opf-cli-catalog-copy-'));
    await rm(actual, { recursive: true, force: true });
  }
});
