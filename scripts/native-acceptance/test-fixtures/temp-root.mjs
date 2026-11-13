// Scratch folders for the native-acceptance tests that exist on every machine: under OPF_WORKTREE_DIR when it is set (a short
// path such as C:\opf-work on Windows, where deep trees below AppData exceed MAX_PATH), else under the OS temp directory. The
// test that makes one removes it in after().
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function testTempRoot(env = process.env) {
  if (!env.OPF_WORKTREE_DIR) return os.tmpdir();
  const root = path.resolve(env.OPF_WORKTREE_DIR);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

/** A fresh empty folder named `<prefix>XXXXXX` under testTempRoot(). */
export function makeTestTempDir(prefix, env = process.env) {
  return fs.mkdtempSync(path.join(testTempRoot(env), prefix));
}
