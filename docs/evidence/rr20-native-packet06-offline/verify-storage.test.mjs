import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const run = directory => spawnSync(process.execPath, [path.join(root, 'verify-storage.mjs'), directory], { encoding: 'utf8' });
test('subset verification retains explicit pending boundaries and rejects altered evidence', async () => {
  const good = run(root);
  assert.equal(good.status, 0, good.stderr);
  assert.deepEqual(JSON.parse(good.stdout), { storedFiles: 167, omittedPreviews: 68, fullPacketVerified: false, nativeAcceptance: 'pending' });
  const scratch = await mkdtemp(path.join(tmpdir(), 'opf-packet-storage-'));
  try {
    for (const kind of ['tamper', 'duplicate', 'omission']) {
      const copy = path.join(scratch, kind);
      await cp(root, copy, { recursive: true });
      const indexFile = path.join(copy, 'storage-index.json');
      const index = JSON.parse(await readFile(indexFile));
      if (kind === 'tamper') await writeFile(path.join(copy, index.stored[0].file), 'altered');
      else {
        if (kind === 'duplicate') index.stored.push(index.stored[0]);
        else index.omittedPreviewPaths.pop();
        await writeFile(indexFile, JSON.stringify(index));
      }
      assert.notEqual(run(copy).status, 0, `${kind} was accepted`);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
