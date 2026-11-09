#!/usr/bin/env node
// Public-safe, byte-preserving archival only. No OPF import, render, export or Office calls.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const HANDOFF = 'docs/handoff/2026-11-09/native-output-archives-b623';
const OUTPUT = 'docs/evidence/native-current-b623-20261109';
const SOURCE = 'b623a3674037f29d68496e96a3f5b6da55d73470';
const TREE = '0d45431440e1b3150a31e8eee4a220a86908fa1e';
const PRODUCER = 'b721182431f1dd5961c1c3f1906ffcad94a3fdf7';
const PRODUCER_PATH = 'docs/handoff/2026-11-09/native-current-preparation-b623';
const MAX_ARCHIVE = 50 * 1024 * 1024;
const MAX_MEMBER = 32 * 1024 * 1024;
const MAX_EXPANDED = 100 * 1024 * 1024;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const utf8Sort = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const git = (...args) => {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: null, maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, `git ${args[0]} failed`);
  return result.stdout;
};
const object = (ref) => git('rev-parse', ref).toString('utf8').trim();
const relativeSafe = (name) => {
  assert.equal(typeof name, 'string');
  assert.ok(name.length > 0 && name.length <= 1024 && !/[\\\u0000-\u001f:]/u.test(name), `Unsafe member ${name}`);
  assert.ok(!name.startsWith('/') && name.split('/').every((part) => part !== '' && part !== '.' && part !== '..'), `Unsafe member ${name}`);
  assert.ok(!/(^|\/)(?:node_modules|\.git|\.pnpm-store|\.env(?:\..*)?|\.npmrc|credentials?)(?:\/|$)|\.(?:key|pem|pfx|p12)$/iu.test(name), `Private or installed path ${name}`);
};
const inventory = (root) => {
  assert.equal(realpathSync(root).replaceAll('\\', '/').toLowerCase(), root.toLowerCase());
  assert.ok(lstatSync(root).isDirectory() && !lstatSync(root).isSymbolicLink());
  const files = [];
  const walk = (dir, prefix = '') => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const name = prefix + entry.name;
      relativeSafe(name);
      const absolute = path.join(dir, entry.name);
      const stat = lstatSync(absolute);
      assert.ok(!stat.isSymbolicLink(), `Link refused: ${name}`);
      if (stat.isDirectory()) walk(absolute, `${name}/`);
      else {
        assert.ok(stat.isFile(), `Non-file refused: ${name}`);
        assert.ok(/\.(?:json|pptx|png|svg)$/u.test(name), `Unexpected output kind ${name}`);
        assert.ok(stat.size > 0 && stat.size < MAX_MEMBER);
        const bytes = readFileSync(absolute);
        files.push({ path: name, bytes: bytes.length, sha256: sha256(bytes), originalMtimeUTC: stat.mtime.toISOString() });
      }
    }
  };
  walk(root);
  return files.sort((a, b) => utf8Sort(a.path, b.path));
};

// Fixed timestamps/permissions, UTF-8 byte ordering, no comments/extras/descriptors.
// Deflate level 9 is selected only when smaller than the exact stored bytes.
const makeZip = (root, files) => {
  const localParts = [];
  const directory = [];
  let offset = 0;
  for (const file of files) {
    const bytes = readFileSync(path.join(root, file.path));
    assert.equal(bytes.length, file.bytes);
    assert.equal(sha256(bytes), file.sha256);
    const compressed = deflateRawSync(bytes, { level: 9 });
    const method = compressed.length < bytes.length ? 8 : 0;
    const body = method === 8 ? compressed : bytes;
    const name = Buffer.from(file.path, 'utf8');
    const crc = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, central, end]);
};

// Confined, exact ZIP reader: no extraction, links, duplicates, unknown parts,
// compression methods, unbounded expansion, hidden data or trailing bytes.
const verifyZip = (archive, expected) => {
  assert.ok(archive.length > 22 && archive.length < MAX_ARCHIVE);
  const end = archive.length - 22;
  assert.equal(archive.readUInt32LE(end), 0x06054b50);
  assert.equal(archive.readUInt16LE(end + 4), 0);
  assert.equal(archive.readUInt16LE(end + 6), 0);
  assert.equal(archive.readUInt16LE(end + 8), expected.length);
  assert.equal(archive.readUInt16LE(end + 10), expected.length);
  assert.equal(archive.readUInt16LE(end + 20), 0);
  const centralSize = archive.readUInt32LE(end + 12);
  const centralOffset = archive.readUInt32LE(end + 16);
  assert.equal(centralOffset + centralSize, end);
  let central = centralOffset;
  let local = 0;
  let total = 0;
  const names = new Set();
  const decoded = new Map();
  for (const file of expected) {
    assert.ok(central + 46 <= end);
    assert.equal(archive.readUInt32LE(central), 0x02014b50);
    assert.equal(archive.readUInt16LE(central + 4), 0x0314);
    assert.equal(archive.readUInt16LE(central + 6), 20);
    assert.equal(archive.readUInt16LE(central + 8), 0x800);
    const method = archive.readUInt16LE(central + 10);
    assert.ok(method === 0 || method === 8);
    assert.equal(archive.readUInt16LE(central + 12), 0);
    assert.equal(archive.readUInt16LE(central + 14), 33);
    const crc = archive.readUInt32LE(central + 16);
    const size = archive.readUInt32LE(central + 20);
    const expanded = archive.readUInt32LE(central + 24);
    const length = archive.readUInt16LE(central + 28);
    assert.equal(archive.readUInt16LE(central + 30), 0);
    assert.equal(archive.readUInt16LE(central + 32), 0);
    assert.equal(archive.readUInt16LE(central + 34), 0);
    assert.equal(archive.readUInt16LE(central + 36), 0);
    assert.equal(archive.readUInt32LE(central + 38), (0o100644 << 16) >>> 0);
    assert.equal(archive.readUInt32LE(central + 42), local);
    const nameBytes = archive.subarray(central + 46, central + 46 + length);
    const name = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
    relativeSafe(name);
    assert.equal(name, file.path);
    assert.ok(!names.has(name));
    names.add(name);
    assert.ok(expanded > 0 && expanded < MAX_MEMBER);
    assert.equal(expanded, file.bytes);
    total += expanded;
    assert.ok(total < MAX_EXPANDED);
    assert.equal(archive.readUInt32LE(local), 0x04034b50);
    assert.equal(archive.readUInt16LE(local + 4), 20);
    assert.equal(archive.readUInt16LE(local + 6), 0x800);
    assert.equal(archive.readUInt16LE(local + 8), method);
    assert.equal(archive.readUInt16LE(local + 10), 0);
    assert.equal(archive.readUInt16LE(local + 12), 33);
    assert.equal(archive.readUInt32LE(local + 14), crc);
    assert.equal(archive.readUInt32LE(local + 18), size);
    assert.equal(archive.readUInt32LE(local + 22), expanded);
    assert.equal(archive.readUInt16LE(local + 26), length);
    assert.equal(archive.readUInt16LE(local + 28), 0);
    assert.ok(archive.subarray(local + 30, local + 30 + length).equals(nameBytes));
    const bodyStart = local + 30 + length;
    assert.ok(bodyStart + size <= centralOffset);
    const compressed = archive.subarray(bodyStart, bodyStart + size);
    const body = method === 8 ? inflateRawSync(compressed, { maxOutputLength: expanded }) : compressed;
    assert.equal(body.length, expanded);
    assert.equal(crc32(body), crc);
    assert.equal(sha256(body), file.sha256);
    decoded.set(name, body);
    local = bodyStart + size;
    central += 46 + length;
  }
  assert.equal(local, centralOffset);
  assert.equal(central, end);
  return decoded;
};

const definitions = [
  { id: 'release-corpus', sourceRoot: 'C:/opf-work/n034-q02', file: 'release-corpus.zip', expectedFiles: 216, expectedBytes: 17092778, status: 'Preparation builder completed: 22 decks, 27 PPTX variants, 188 preview PNGs; not native-qualified.' },
  { id: 'generic-partial-unsealed', sourceRoot: 'C:/opf-work/n034-suite02', file: 'generic-partial-unsealed.zip', expectedFiles: 238, expectedBytes: 44189370, status: 'FAILED historical chart guard after 28 primary cases and first chart-mode export/import; NO suite.json seal; not native-qualified.' },
  { id: 'nine-diagnostics', sourceRoot: 'C:/opf-work/n034-nine02', file: 'nine-diagnostics.zip', expectedFiles: 10, expectedBytes: 1121237, status: 'Nine current-output comparisons and original diagnostic receipt; allNineMatched true is not physical native acceptance.' },
];
const protectedPaths = ['packages', 'spec', 'scripts', '.github', 'skills', 'examples', 'pnpm-lock.yaml', 'package.json', 'pnpm-workspace.yaml'];
const outputPath = path.join(ROOT, OUTPUT);
const manifestPath = path.join(HERE, 'manifest.json');
if (process.argv.includes('--create')) {
  assert.equal(object('HEAD'), SOURCE);
  assert.equal(object(`${SOURCE}^{tree}`), TREE);
  assert.ok(!existsSync(manifestPath) && !existsSync(outputPath), 'Fresh output paths required');
  mkdirSync(outputPath, { recursive: true });
  writeFileSync(path.join(outputPath, '.gitattributes'), '* -text\n');
  writeFileSync(path.join(HERE, '.gitattributes'), '* -text\n');
  const archives = definitions.map((definition) => {
    const files = inventory(definition.sourceRoot);
    assert.equal(files.length, definition.expectedFiles);
    assert.equal(files.reduce((sum, file) => sum + file.bytes, 0), definition.expectedBytes);
    if (definition.id === 'generic-partial-unsealed') assert.ok(!files.some((file) => file.path === 'suite.json'));
    const zip = makeZip(definition.sourceRoot, files);
    verifyZip(zip, files);
    const destination = path.join(outputPath, definition.file);
    writeFileSync(destination, zip, { flag: 'wx' });
    assert.deepEqual(inventory(definition.sourceRoot), files, 'Original output changed during archive creation');
    console.log(`${definition.id}: ${files.length} members, ${definition.expectedBytes} raw bytes, ${zip.length} ZIP bytes`);
    return { ...definition, archivePath: `${OUTPUT}/${definition.file}`, bytes: zip.length, sha256: sha256(zip), files };
  });
  const producerCopies = ['receipt.json', 'files.json', 'raw.zip'].map((name) => {
    const sourcePath = `${PRODUCER_PATH}/${name}`;
    const bytes = git('show', `${PRODUCER}:${sourcePath}`);
    const file = `producer-${name}`;
    writeFileSync(path.join(HERE, file), bytes, { flag: 'wx' });
    return { file, bytes: bytes.length, sha256: sha256(bytes), source: PRODUCER, sourcePath, gitBlob: object(`${PRODUCER}:${sourcePath}`) };
  });
  const manifest = {
    schema: 1,
    publication: 'PUBLIC-SAFE evidence-only NEVER MERGE',
    source: SOURCE,
    sourceTree: TREE,
    producerEvidence: PRODUCER,
    producerEvidencePath: PRODUCER_PATH,
    protectedObjects: Object.fromEntries(protectedPaths.map((name) => [name, object(`${SOURCE}:${name}`)])),
    nativeAcceptance: false,
    suiteSealed: false,
    physicalOfficeRunInThisArchiveTask: false,
    inputPrivacy: 'Only the three named producer roots; tracked public repository examples and synthetic qualification decks. No installed consumers, node_modules, credentials, private decks or unrelated paths.',
    preservation: 'Original member paths and bytes retained. ZIP member timestamps fixed at 1980-01-01 and permissions at regular 0644; original mtimes retained below. Sorted by UTF-8 path bytes. Deflate level 9 only when smaller; otherwise stored.',
    verifier: { file: 'archive.mjs', sha256: sha256(readFileSync(fileURLToPath(import.meta.url))) },
    totalFiles: archives.reduce((sum, archive) => sum + archive.files.length, 0),
    totalRawBytes: archives.reduce((sum, archive) => sum + archive.expectedBytes, 0),
    totalZipBytes: archives.reduce((sum, archive) => sum + archive.bytes, 0),
    producerCopies,
    archives,
  };
  assert.equal(manifest.totalFiles, 464);
  assert.equal(manifest.totalRawBytes, 62403385);
  assert.ok(manifest.totalZipBytes < MAX_EXPANDED);
  writeFileSync(manifestPath, jsonBytes(manifest), { flag: 'wx' });
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.source, SOURCE);
assert.equal(manifest.sourceTree, TREE);
assert.equal(manifest.producerEvidence, PRODUCER);
assert.equal(manifest.nativeAcceptance, false);
assert.equal(manifest.suiteSealed, false);
assert.equal(manifest.physicalOfficeRunInThisArchiveTask, false);
assert.equal(manifest.verifier.sha256, sha256(readFileSync(fileURLToPath(import.meta.url))));
assert.equal(object(`${SOURCE}^{tree}`), TREE);
for (const [name, expected] of Object.entries(manifest.protectedObjects)) {
  assert.ok(protectedPaths.includes(name));
  assert.equal(object(`HEAD:${name}`), expected, `Protected current source changed: ${name}`);
  assert.equal(object(`${SOURCE}:${name}`), expected);
}
assert.deepEqual(Object.keys(manifest.protectedObjects), protectedPaths);
for (const entry of manifest.producerCopies) {
  relativeSafe(entry.file);
  const bytes = readFileSync(path.join(HERE, entry.file));
  assert.equal(bytes.length, entry.bytes);
  assert.equal(sha256(bytes), entry.sha256);
  assert.ok(git('show', `${PRODUCER}:${entry.sourcePath}`).equals(bytes));
  assert.equal(object(`${PRODUCER}:${entry.sourcePath}`), entry.gitBlob);
}
let files = 0;
let rawBytes = 0;
let zipBytes = 0;
for (const [index, archive] of manifest.archives.entries()) {
  const definition = definitions[index];
  assert.equal(archive.id, definition.id);
  assert.equal(archive.sourceRoot, definition.sourceRoot);
  assert.equal(archive.archivePath, `${OUTPUT}/${definition.file}`);
  assert.equal(archive.expectedFiles, definition.expectedFiles);
  assert.equal(archive.expectedBytes, definition.expectedBytes);
  assert.equal(archive.files.length, definition.expectedFiles);
  assert.deepEqual(archive.files.map((file) => file.path), archive.files.map((file) => file.path).toSorted(utf8Sort));
  const bytes = readFileSync(path.join(ROOT, archive.archivePath));
  assert.equal(bytes.length, archive.bytes);
  assert.equal(sha256(bytes), archive.sha256);
  const decoded = verifyZip(bytes, archive.files);
  if (archive.id === 'release-corpus') {
    const build = JSON.parse(decoded.get('build.json'));
    assert.equal(build.revision, SOURCE);
    assert.equal(build.opfVersion, '0.33.0');
    assert.equal(build.manifestVersion, '0.34.0');
    assert.equal(archive.files.filter((file) => file.path.endsWith('.pptx')).length, 27);
    assert.equal(archive.files.filter((file) => file.path.endsWith('.png')).length, 188);
  }
  if (archive.id === 'generic-partial-unsealed') {
    assert.ok(!decoded.has('suite.json'));
    assert.equal(archive.files.filter((file) => file.path.endsWith('.pptx')).length, 29);
  }
  if (archive.id === 'nine-diagnostics') {
    const receipt = JSON.parse(decoded.get('receipt.json'));
    assert.equal(receipt.source, SOURCE);
    assert.equal(receipt.allNineMatched, true);
    assert.equal(receipt.nativeAcceptance, false);
    assert.equal(receipt.originalFailedPrepareUnchanged, true);
    assert.equal(archive.files.filter((file) => file.path.endsWith('.pptx')).length, 9);
  }
  if (process.argv.includes('--originals')) assert.deepEqual(inventory(definition.sourceRoot), archive.files, 'Original bytes or metadata changed');
  files += archive.files.length;
  rawBytes += archive.files.reduce((sum, file) => sum + file.bytes, 0);
  zipBytes += bytes.length;
}
assert.equal(manifest.archives.length, 3);
assert.equal(files, 464);
assert.equal(rawBytes, 62403385);
assert.equal(manifest.totalFiles, files);
assert.equal(manifest.totalRawBytes, rawBytes);
assert.equal(manifest.totalZipBytes, zipBytes);
const producerReceipt = JSON.parse(readFileSync(path.join(HERE, 'producer-receipt.json')));
assert.equal(producerReceipt.source, SOURCE);
assert.equal(producerReceipt.nativeAccepted, false);
assert.equal(producerReceipt.suiteSealed, false);
assert.equal(producerReceipt.genericPreparation.status, 'FAILED historical guard; unsealed');
console.log(JSON.stringify({ result: 'PASS', source: SOURCE, tree: TREE, archives: 3, files, rawBytes, zipBytes, originalsVerified: process.argv.includes('--originals'), nativeAcceptance: false, suiteSealed: false }));
