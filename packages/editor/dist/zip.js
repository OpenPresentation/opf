// A minimal ZIP writer for the multi-file downloads (all slides as PNG or SVG). One archive, no dependency, a fixed
// timestamp (1980-01-01) so the same files always give the same bytes. Entries are stored, or deflated when the
// platform has CompressionStream (the SVG slides compress well; the PNGs do not need it).

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

/** CRC-32 of the bytes, as an unsigned integer. */
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index++) crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Build a ZIP archive from `[{ name, bytes }]`. `compress` (default true) deflates an entry when that makes it smaller and the
 * platform can; the result is a valid ZIP either way. `signal` stops between entries.
 */
export async function createZip(entries, { compress = true, signal } = {}) {
  const encoder = new TextEncoder();
  const canDeflate = compress && typeof CompressionStream === "function" && typeof Blob === "function";
  const local = [], central = [];
  let offset = 0;
  for (const entry of entries) {
    signal?.throwIfAborted?.();
    const name = encoder.encode(entry.name);
    const bytes = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes);
    const crc = crc32(bytes);
    let stored = bytes, method = 0;
    if (canDeflate && bytes.length > 64) {
      const packed = await deflateRaw(bytes);
      if (packed.length < bytes.length) { stored = packed; method = 8; }
    }
    // 2.0 to extract deflate; bit 11 says the name is UTF-8; time 00:00:00, date 1980-01-01.
    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true); header.setUint16(4, 20, true); header.setUint16(6, 0x0800, true); header.setUint16(8, method, true);
    header.setUint16(10, 0, true); header.setUint16(12, 0x21, true);
    header.setUint32(14, crc, true); header.setUint32(18, stored.length, true); header.setUint32(22, bytes.length, true);
    header.setUint16(26, name.length, true); header.setUint16(28, 0, true);
    local.push(new Uint8Array(header.buffer), name, stored);
    const directory = new DataView(new ArrayBuffer(46));
    directory.setUint32(0, 0x02014b50, true); directory.setUint16(4, 20, true); directory.setUint16(6, 20, true); directory.setUint16(8, 0x0800, true); directory.setUint16(10, method, true);
    directory.setUint16(12, 0, true); directory.setUint16(14, 0x21, true);
    directory.setUint32(16, crc, true); directory.setUint32(20, stored.length, true); directory.setUint32(24, bytes.length, true);
    directory.setUint16(28, name.length, true); directory.setUint32(42, offset, true);
    central.push(new Uint8Array(directory.buffer), name);
    offset += 30 + name.length + stored.length;
  }
  const size = central.reduce((total, part) => total + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  const parts = [...local, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let position = 0;
  for (const part of parts) { out.set(part, position); position += part.length; }
  if (offset > 0xfffffffe || entries.length > 0xfffe) throw new Error("The archive is too large for a ZIP file without ZIP64. Export fewer slides at a time.");
  return out;
}
