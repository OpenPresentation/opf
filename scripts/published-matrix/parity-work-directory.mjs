// Refuse to erase a checkout before parity preparation recreates its scratch directory.
import assert from 'node:assert/strict';
import {lstat, readdir, realpath, stat} from 'node:fs/promises';
import path from 'node:path';

async function exists(file) {
  try { await lstat(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export async function assertParityWorkDirectory(work) {
  const target = path.resolve(work);
  assert.notEqual(target, path.parse(target).root, 'Parity scratch must not be a filesystem root');
  // An absent child may still belong to a checkout. Resolve its nearest existing ancestor,
  // including symlink parents, before walking upward for normal and linked-worktree markers.
  let ancestor = target;
  while (!(await exists(ancestor))) ancestor = path.dirname(ancestor);
  const actual = await realpath(ancestor);
  assert.ok((await stat(actual)).isDirectory(), 'Parity scratch ancestor must be a directory');
  for (let current = actual;; current = path.dirname(current)) {
    assert.ok(path.basename(current).toLowerCase() !== '.git' && !(await exists(path.join(current, '.git'))), `Parity work directory ${target} is inside a Git checkout (${current})`);
    if (current === path.dirname(current)) break;
  }
  if (!(await exists(target))) return;
  // A container can hold a checkout below it. Do not follow symlinks: rm of the
  // container unlinks those entries rather than recursively deleting their targets.
  const pending = [actual];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of await readdir(directory, {withFileTypes: true})) {
      assert.notEqual(entry.name.toLowerCase(), '.git', `Parity work directory ${target} contains a Git checkout (${directory})`);
      if (entry.isDirectory()) pending.push(path.join(directory, entry.name));
    }
  }
}
