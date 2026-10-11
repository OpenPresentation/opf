import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.dirname(fileURLToPath(import.meta.url));
assert.ok((await lstat(root)).isDirectory() && !(await lstat(root)).isSymbolicLink());
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function regular(file) {
  assert.ok(!path.isAbsolute(file) && !file.includes('\\') && path.posix.normalize(file) === file && !file.split('/').includes('..'));
  let cursor = root;
  for (const part of file.split('/')) {
    cursor = path.join(cursor, part);
    assert.ok(!(await lstat(cursor)).isSymbolicLink(), 'storage path cannot alias another file');
  }
  assert.ok((await lstat(cursor)).isFile());
  return readFile(cursor);
}
const index = JSON.parse(await regular('storage-index.json'));
const packetBytes = await regular('packet.json');
const packet = JSON.parse(packetBytes);
const seal = JSON.parse(await regular('seal.json'));
assert.equal(index.nativeAcceptance, 'pending');
assert.equal(hash(packetBytes), index.packetSha256);
assert.equal(hash(packetBytes), seal.packetSha256);
assert.equal(hash(await regular('offline-result.json')), seal.offlineResultSha256);
assert.equal(new Set(packet.files.map(f => f.file)).size, packet.files.length);
assert.equal(new Set(index.stored.map(f => f.file)).size, index.stored.length);
assert.deepEqual(index.stored, packet.files.filter(f => !f.file.startsWith('previews/')));
assert.deepEqual(index.omittedPreviewPaths, packet.files.filter(f => f.file.startsWith('previews/')).map(f => f.file));
for (const entry of index.stored) {
  const bytes = await regular(entry.file);
  assert.equal(bytes.length, entry.bytes, entry.file);
  assert.equal(hash(bytes), entry.sha256, entry.file);
}
console.log(JSON.stringify({ storedFiles: index.stored.length, omittedPreviews: index.omittedPreviewPaths.length, fullPacketVerified: false, nativeAcceptance: 'pending' }));
