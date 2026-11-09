import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const directory = fileURLToPath(new URL('./', import.meta.url));
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const runtimeRoot = path.resolve(process.argv[2] ?? root);
const require = createRequire(path.join(runtimeRoot, 'packages/pptx/package.json'));
const {unzipSync, zipSync} = require('fflate');
const sha = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, {cwd: root, maxBuffer: 16 * 1024 * 1024});
const show = (ref, file) => git('show', ref + ':' + file);
const assembly = 'ef5405b3bbf9c47c8ae2e790e08aa72dcb18875f';
const producer = '513156a982397eaa0033808215fbb86dd284745b';
const evidence = '5e89a184ffc8a38539f5fb5e573f403066bcca17';
const prefix = 'docs/evidence/rr105-034-archive-review/';
const recordPath = 'packages/gallery/catalog/layouts/inverted-pyramid.json';
const fixturePath = 'packages/pptx/test/fixtures/chartex-fallback-main.json';
const expected = 'd1e56048a3953d90d9f81232afd6f8f6ba79e66a286eb9c28873e065cbb21394';
const observed = 'c844c8abe2f223546f9a735e27f16cb0e036dd7c519b01992e02df5c22639079';
const part = 'ppt/tags/opfLayout18.xml';
const fixture = JSON.parse(show(assembly, fixturePath));
assert.equal(fixture.entries['treemap-category'].sha256, expected);
const originalSource = show(producer, recordPath), currentSource = show(assembly, recordPath);
const originalRecord = JSON.parse(originalSource), currentRecord = JSON.parse(currentSource);
assert.deepEqual({...originalRecord, description: null}, {...currentRecord, description: null});
assert.notEqual(originalRecord.description, currentRecord.description);
const embedded = record => Object.fromEntries(Object.entries(record).filter(([key]) => key !== '$schema' && key !== 'id' && !key.startsWith('x-')));
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : value !== null && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
  : JSON.stringify(value);
const recordHash = record => {
  let hash = 0xcbf29ce484222325n;
  for (const byte of Buffer.from(canonical(record))) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return hash.toString(16).padStart(16, '0');
};
const oldHash = recordHash(embedded(originalRecord)), newHash = recordHash(embedded(currentRecord));
assert.equal(oldHash, '4baa264255f9f66b'); assert.equal(newHash, '22f5fe00efa7a1f8');
const archivePath = prefix + 'nine/treemap-category.zip', outer = show(evidence, archivePath);
assert.equal(sha(outer), '33611d6be8310b553ab01cda1c1867b264d19df579d0ff926a07408ba42027b0');
const outerParts = unzipSync(outer), before = Buffer.from(outerParts['after.pptx']);
assert.equal(before.length, 107595); assert.equal(sha(before), expected);
const provenancePath = prefix + 'maintained-originals-and-provenance.zip';
const provenanceArchive = show(evidence, provenancePath);
const provenanceBytes = unzipSync(provenanceArchive)['nine/provenance.json'];
const provenance = JSON.parse(Buffer.from(provenanceBytes));
assert.equal(provenance.candidate.head, producer); assert.equal(provenance.node, 'v24.20.0'); assert.equal(provenance.platform, 'win32');
const beforeParts = unzipSync(before);
const options = {level: 6, mtime: new Date(1980, 0, 1, 0, 0, 0)};
const repack = parts => Buffer.from(zipSync(Object.fromEntries(Object.keys(parts).sort().map(name => [name, [parts[name], options]])), options));
assert.deepEqual(repack(beforeParts), before, 'An unchanged deterministic repack must reproduce every original byte');
const beforeTag = Buffer.from(beforeParts[part]), xml = beforeTag.toString();
const match = /name="OPF_LAYOUT_V1" val="([0-9A-F]+)"/.exec(xml); assert(match);
const payload = JSON.parse(Buffer.from(match[1], 'hex').toString());
const encode = value => Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase();
assert.equal(encode(payload), match[1]); assert.equal(payload.id, 'inverted-pyramid'); assert.equal(payload.hash, oldHash);
payload.hash = newHash;
const afterTag = Buffer.from(xml.replace(match[1], encode(payload)));
const afterParts = {...beforeParts, [part]: afterTag}, after = repack(afterParts);
assert.equal(after.length, 107591); assert.equal(sha(after), observed);
const names = Object.keys(beforeParts).sort(); assert.equal(names.length, 150);
assert.deepEqual(Object.keys(afterParts).sort(), names);
const byteDifferences = [...beforeTag].flatMap((byte, offset) => byte === afterTag[offset] ? [] : [{offset, before: byte, after: afterTag[offset]}]);
assert.equal(beforeTag.length, 519); assert.equal(afterTag.length, 519); assert.equal(byteDifferences.length, 21);
const headers = bytes => {
  const end = bytes.lastIndexOf(Buffer.from('504b0506', 'hex')); assert(end >= 0);
  const count = bytes.readUInt16LE(end + 10), result = new Map(); let cursor = bytes.readUInt32LE(end + 16);
  for (let index = 0; index < count; index++) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
    const n = bytes.readUInt16LE(cursor + 28), extra = bytes.readUInt16LE(cursor + 30), comment = bytes.readUInt16LE(cursor + 32);
    const name = bytes.toString('utf8', cursor + 46, cursor + 46 + n);
    result.set(name, {method: bytes.readUInt16LE(cursor + 10), flags: bytes.readUInt16LE(cursor + 8), dosTime: bytes.readUInt16LE(cursor + 12), dosDate: bytes.readUInt16LE(cursor + 14), compressedBytes: bytes.readUInt32LE(cursor + 20)});
    cursor += 46 + n + extra + comment;
  }
  assert.equal(count, 150); return result;
};
const beforeHeaders = headers(before), afterHeaders = headers(after);
const parts = names.map(name => {
  const a = beforeParts[name], b = afterParts[name], changed = !Buffer.from(a).equals(Buffer.from(b));
  const ah = beforeHeaders.get(name), bh = afterHeaders.get(name);
  assert.deepEqual({...ah, compressedBytes: null}, {...bh, compressedBytes: null});
  assert.equal(ah.dosTime, 0); assert.equal(ah.dosDate, 33); assert.equal(ah.method, 8);
  return {name, before: {bytes: a.length, sha256: sha(a), ...ah}, after: {bytes: b.length, sha256: sha(b), ...bh}, changed};
});
assert.deepEqual(parts.filter(row => row.changed).map(row => row.name), [part]);
const protectedPaths = ['packages/javascript', 'packages/gallery', 'packages/render', 'packages/pptx', 'spec', 'pnpm-lock.yaml', 'package.json'];
const protectedObjects = protectedPaths.map(file => {
  const object = git('rev-parse', assembly + ':' + file).toString().trim();
  assert.equal(git('rev-parse', 'HEAD:' + file).toString().trim(), object);
  return {path: file, object};
});
const toolPaths = ['packages/gallery/scripts/build.mjs', 'packages/pptx/src/template-layouts.js', 'packages/pptx/src/code-provenance.js', 'packages/pptx/src/index.js'];
const receipt = {
  format: 1, scope: 'one-deck pure archive derivation only; no exporter, fixture promotion or native acceptance',
  assembly, reviewedProducer: producer, publishedEvidence: {commit: evidence, archivePath, outerSha256: sha(outer), innerPath: 'after.pptx', provenancePath, provenanceEntry: 'nine/provenance.json', provenanceSha256: sha(provenanceBytes)},
  priorReviewRuntime: {node: provenance.node, platform: provenance.platform}, proofRuntime: {node: process.version, platform: process.platform, arch: process.arch},
  source: {path: recordPath, before: {sha256: sha(originalSource), bytes: originalSource.length, text: originalSource.toString()}, after: {sha256: sha(currentSource), bytes: currentSource.length, text: currentSource.toString()}, changedFields: ['description'], oldEmbeddedRecordHash: oldHash, newEmbeddedRecordHash: newHash},
  fixture: {path: fixturePath, sha256: sha(show(assembly, fixturePath)), expectedSha256: expected},
  originalArchive: {bytes: before.length, sha256: sha(before)}, unchangedRepackByteExact: true,
  derivedArchive: {bytes: after.length, sha256: sha(after)}, observedFailureSha256: observed, derivedEqualsObserved: true,
  zip: {compressionLevel: 6, localDate: '1980-01-01T00:00:00 local', method: 8, dosTime: 0, dosDate: 33},
  changedPart: {path: part, beforeText: beforeTag.toString(), afterText: afterTag.toString(), byteDifferences},
  parts, protectedObjects, tools: toolPaths.map(file => ({path: file, sha256: sha(show(assembly, file))})),
  fflate: {version: '0.8.3', moduleSha256: sha(readFileSync(require.resolve('fflate')))},
  productFilesChanged: 0, exportsRun: 0, buildsRun: 0, officeCalls: 0, fixturePromoted: false, otherEightDecksQualified: false
};
const receiptPath = path.join(directory, 'receipt.json'), bytes = JSON.stringify(receipt, null, 2) + '\n';
if (process.argv.includes('--write')) writeFileSync(receiptPath, bytes, {flag: 'wx'});
else assert.deepEqual(JSON.parse(readFileSync(receiptPath)), receipt, 'Receipt must match fresh read-only derivation');
console.log(JSON.stringify({verified: true, reviewed: expected, derived: sha(after), equalsObserved: true, parts: parts.length, unchangedParts: parts.filter(row => !row.changed).length, changedPart: part, changedRawBytes: byteDifferences.length, exportsRun: 0, fixturePromoted: false, otherEightDecksQualified: false}));
