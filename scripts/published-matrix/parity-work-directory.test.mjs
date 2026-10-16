import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {assertParityWorkDirectory} from './parity-work-directory.mjs';

async function fixture(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'opf-parity-boundary-'));
  try { await run(root); } finally { await rm(root, {recursive: true, force: true}); }
}
async function checkout(root) {
  const repo = path.join(root, 'repo'); await mkdir(repo);
  execFileSync('git', ['init', '--quiet', repo]);
  await writeFile(path.join(repo, 'sentinel.txt'), 'keep checkout bytes');
  return repo;
}

test('existing checkout, nested path and absent descendant refuse without touching sentinel or Git metadata', () => fixture(async root => {
  const repo = await checkout(root); const child = path.join(repo, 'artifacts'); await mkdir(child);
  for (const work of [repo, child, path.join(child, 'not-created', 'consumer'), path.join(repo, '.git', 'objects')]) {
    await assert.rejects(assertParityWorkDirectory(work), /Git checkout/);
    assert.equal(await readFile(path.join(repo, 'sentinel.txt'), 'utf8'), 'keep checkout bytes');
    assert.match(await readFile(path.join(repo, '.git', 'HEAD'), 'utf8'), /^ref:/);
  }
}));

test('a container with a nested checkout refuses without touching either sentinel', () => fixture(async root => {
  await writeFile(path.join(root, 'container-sentinel.txt'), 'keep container');
  const nested = path.join(root, 'nested'); await mkdir(nested); const repo = await checkout(nested);
  await assert.rejects(assertParityWorkDirectory(root), /contains a Git checkout/);
  assert.equal(await readFile(path.join(root, 'container-sentinel.txt'), 'utf8'), 'keep container');
  assert.equal(await readFile(path.join(repo, 'sentinel.txt'), 'utf8'), 'keep checkout bytes');
}));

test('symlinked ancestor into a checkout also refuses', () => fixture(async root => {
  const repo = await checkout(root); const alias = path.join(root, 'alias');
  await symlink(repo, alias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(assertParityWorkDirectory(path.join(alias, 'absent', 'consumer')), /Git checkout/);
  assert.equal(await readFile(path.join(repo, 'sentinel.txt'), 'utf8'), 'keep checkout bytes');
}));

test('ordinary existing and absent scratch directories pass unchanged', () => fixture(async root => {
  const scratch = path.join(root, 'scratch'); await mkdir(scratch); await writeFile(path.join(scratch, 'old-result.json'), '{}');
  await assertParityWorkDirectory(scratch);
  await assertParityWorkDirectory(path.join(root, 'new', 'consumer'));
  assert.equal(await readFile(path.join(scratch, 'old-result.json'), 'utf8'), '{}');
  await assert.rejects(assertParityWorkDirectory(path.parse(root).root), /filesystem root/);
}));
