import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {runtimeIdentity} from './identity.mjs';

test('runtime identity covers nested bytes and rejects symlink substitution', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'opf-native-identity-'));
  try {
    mkdirSync(path.join(root, 'dist', 'nested'), {recursive: true});
    writeFileSync(path.join(root, 'package.json'), '{"name":"fixture"}');
    writeFileSync(path.join(root, 'dist', 'nested', 'runtime.js'), 'one');
    const before = runtimeIdentity(root);
    writeFileSync(path.join(root, 'dist', 'nested', 'runtime.js'), 'two');
    assert.notEqual(runtimeIdentity(root).sha256, before.sha256);
    assert.equal(before.files.length, 2);
    // Directory junctions work without Windows developer-mode privileges.
    symlinkSync(path.join(root, 'dist', 'nested'), path.join(root, 'dist', 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => runtimeIdentity(root), /Runtime symlink/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
