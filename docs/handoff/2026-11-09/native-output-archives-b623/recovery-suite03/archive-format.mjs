import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {crc32,deflateRawSync,inflateRawSync} from 'node:zlib';
const MAX_ARCHIVE=50*1024*1024,MAX_MEMBER=32*1024*1024,MAX_EXPANDED=100*1024*1024;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const utf8Sort = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const relativeSafe = (name) => {
  assert.equal(typeof name, 'string');
  assert.ok(name.length > 0 && name.length <= 1024 && !/[\\\u0000-\u001f:]/u.test(name), `Unsafe member ${name}`);
  assert.ok(!name.startsWith('/') && name.split('/').every((part) => part !== '' && part !== '.' && part !== '..'), `Unsafe member ${name}`);
  assert.ok(!/(^|\/)(?:node_modules|\.git|\.pnpm-store|\.env(?:\..*)?|\.npmrc|credentials?)(?:\/|$)|\.(?:key|pem|pfx|p12)$/iu.test(name), `Private or installed path ${name}`);
};
const inventory = (root, extraExactPaths = new Set()) => {
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
        assert.ok(/\.(?:json|pptx|png|svg)$/u.test(name) || extraExactPaths.has(name), `Unexpected output kind ${name}`);
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


export {sha256,utf8Sort,relativeSafe,inventory,makeZip,verifyZip};
