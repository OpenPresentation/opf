// Lossless receipt verification only: never import or execute archived tools.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const folder = path.dirname(fileURLToPath(import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'packet-manifest.json')));
const stored = fs.readFileSync(path.join(folder, manifest.packet.file));
assert.equal(stored.length, manifest.packet.bytes); assert.equal(sha(stored), manifest.packet.sha256);
const raw = gunzipSync(stored); assert.equal(raw.length, manifest.raw.bytes); assert.equal(sha(raw), manifest.raw.sha256);
const packet = JSON.parse(raw); assert.equal(packet.scope, 'LOSSLESS_ACTUAL_RR54_ARCHIVE_AUDIT_NOT_PROMOTION');
assert.equal(packet.files.length, manifest.files.length);
const extract = process.argv.find(arg => arg.startsWith('--extract='))?.slice(10);
if (extract) assert.ok(!fs.existsSync(extract), 'Fresh extraction directory required');
for (const [index, item] of packet.files.entries()) {
  assert.deepEqual({file: item.file, bytes: item.bytes, sha256: item.sha256}, manifest.files[index]);
  const bytes = Buffer.from(item.base64, 'base64'); assert.equal(bytes.length, item.bytes); assert.equal(sha(bytes), item.sha256);
  assert.ok(!path.isAbsolute(item.file) && !item.file.split(/[\\/]/).includes('..'));
  if (extract) {const target = path.join(extract, item.file); fs.mkdirSync(path.dirname(target), {recursive: true}); fs.writeFileSync(target, bytes, {flag: 'wx'});}
}
for (const item of manifest.generatedFiles) {const bytes = fs.readFileSync(path.join(folder, item.file)); assert.equal(bytes.length, item.bytes); assert.equal(sha(bytes), item.sha256);}
console.log(JSON.stringify({scope: 'BUILTINS_ONLY_LOSSLESS_PACKET_VERIFICATION', files: packet.files.length, originalBytes: manifest.totalMemberBytes, storedBytes: stored.length, exports: 0, builds: 0, promoted: false}));
