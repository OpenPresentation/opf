// A deterministic TrueType (glyf) subsetter for the vector PDF export (RR-12). It keeps the glyphs a document
// uses (plus the components of composite glyphs and .notdef), renumbers them in ascending original order, and
// writes head, hhea, maxp, hmtx, loca, glyf plus the original cvt/fpgm/prep when present, so the glyph
// programs keep running. Every table is derived from the font bytes and the glyph set only.

const TABLE_ORDER_ERROR = "Not a TrueType (glyf) font.";

function readTables(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const signature = view.getUint32(0);
  if (signature !== 0x00010000 && signature !== 0x74727565) throw new Error(TABLE_ORDER_ERROR);
  const count = view.getUint16(4);
  const tables = new Map();
  for (let index = 0; index < count; index++) {
    const at = 12 + index * 16;
    const tag = String.fromCharCode(data[at], data[at + 1], data[at + 2], data[at + 3]);
    tables.set(tag, { offset: view.getUint32(at + 8), length: view.getUint32(at + 12) });
  }
  for (const required of ["head", "hhea", "maxp", "hmtx", "loca", "glyf"]) if (!tables.has(required)) throw new Error(TABLE_ORDER_ERROR);
  // Every table must lie inside the file and be long enough for what is read from it (corrupt fonts must fail cleanly).
  for (const [tag, { offset, length }] of tables) if (offset > data.length || offset + length > data.length) throw new Error(`Font table ${tag} lies outside the file.`);
  const minimum = { head: 54, hhea: 36, maxp: 6 };
  for (const [tag, size] of Object.entries(minimum)) if (tables.get(tag).length < size) throw new Error(`Font table ${tag} is truncated.`);
  return { view, tables };
}

/** Whether `data` is an sfnt with TrueType outlines (the only outline format this subsetter writes). */
export function isTrueTypeOutlines(data) {
  if (data.length < 12) return false;
  const signature = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0);
  return signature === 0x00010000 || signature === 0x74727565;
}

export function subsetTrueType(data, wantedGlyphs) {
  const { view, tables } = readTables(data);
  const head = tables.get("head"), hhea = tables.get("hhea"), maxp = tables.get("maxp");
  const hmtx = tables.get("hmtx"), loca = tables.get("loca"), glyf = tables.get("glyf");
  const longLoca = view.getInt16(head.offset + 50) !== 0;
  const numGlyphs = view.getUint16(maxp.offset + 4);
  const metricCount = view.getUint16(hhea.offset + 34);
  if (numGlyphs < 1 || metricCount < 1 || metricCount > numGlyphs) throw new Error("Font glyph counts are inconsistent.");
  if (loca.length < (numGlyphs + 1) * (longLoca ? 4 : 2) || hmtx.length < metricCount * 4) throw new Error("Font loca or hmtx table is truncated.");
  const glyphRange = (id) => {
    if (id >= numGlyphs) return [0, 0];
    const at = loca.offset + id * (longLoca ? 4 : 2);
    const range = longLoca
      ? [view.getUint32(at), view.getUint32(at + 4)]
      : [view.getUint16(at) * 2, view.getUint16(at + 2) * 2];
    if (range[1] < range[0] || range[1] > glyf.length) throw new Error(`Font glyph ${id} lies outside the glyf table.`);
    return range;
  };

  // Close over composite glyph components.
  const included = new Set();
  const pending = [0, ...wantedGlyphs];
  const components = (id) => {
    const [start, end] = glyphRange(id);
    if (end - start < 10) return [];
    const base = glyf.offset + start;
    if (view.getInt16(base) >= 0) return [];
    const found = [];
    let at = base + 10;
    for (;;) {
      const flags = view.getUint16(at), component = view.getUint16(at + 2);
      found.push({ at: at + 2, id: component });
      at += 4 + (flags & 0x0001 ? 4 : 2);
      if (flags & 0x0008) at += 2; else if (flags & 0x0040) at += 4; else if (flags & 0x0080) at += 8;
      if (!(flags & 0x0020)) break;
    }
    return found;
  };
  while (pending.length) {
    const id = pending.pop();
    if (id >= numGlyphs || included.has(id)) continue;
    included.add(id);
    for (const component of components(id)) pending.push(component.id);
  }
  const order = [...included].sort((a, b) => a - b);
  const mapping = new Map(order.map((id, index) => [id, index]));

  // glyf and loca (always the long format).
  const glyphChunks = [];
  const newLoca = new Uint8Array((order.length + 1) * 4);
  const locaView = new DataView(newLoca.buffer);
  let glyfLength = 0;
  order.forEach((id, index) => {
    locaView.setUint32(index * 4, glyfLength);
    const [start, end] = glyphRange(id);
    const length = end - start;
    if (length > 0) {
      const bytes = data.slice(glyf.offset + start, glyf.offset + end);
      const glyphView = new DataView(bytes.buffer);
      if (length >= 10 && glyphView.getInt16(0) < 0) {
        for (const component of components(id)) glyphView.setUint16(component.at - (glyf.offset + start), mapping.get(component.id));
      }
      const padded = new Uint8Array((length + 3) & ~3);
      padded.set(bytes);
      glyphChunks.push(padded);
      glyfLength += padded.length;
    }
  });
  locaView.setUint32(order.length * 4, glyfLength);
  const newGlyf = new Uint8Array(glyfLength);
  let position = 0;
  for (const chunk of glyphChunks) { newGlyf.set(chunk, position); position += chunk.length; }

  // hmtx: one full (advance, lsb) record per kept glyph.
  const newHmtx = new Uint8Array(order.length * 4);
  const hmtxView = new DataView(newHmtx.buffer);
  order.forEach((id, index) => {
    const advance = hmtx.length >= 4 ? view.getUint16(hmtx.offset + Math.min(id, metricCount - 1) * 4) : 0;
    const side = id < metricCount
      ? view.getInt16(hmtx.offset + id * 4 + 2)
      : view.getInt16(hmtx.offset + metricCount * 4 + (id - metricCount) * 2);
    hmtxView.setUint16(index * 4, advance);
    hmtxView.setInt16(index * 4 + 2, side);
  });

  const newHead = data.slice(head.offset, head.offset + head.length);
  const newHeadView = new DataView(newHead.buffer);
  newHeadView.setUint32(8, 0); // checkSumAdjustment, filled in once the file is complete
  newHeadView.setInt16(50, 1);
  const newHhea = data.slice(hhea.offset, hhea.offset + hhea.length);
  new DataView(newHhea.buffer).setUint16(34, order.length);
  const newMaxp = data.slice(maxp.offset, maxp.offset + maxp.length);
  new DataView(newMaxp.buffer).setUint16(4, order.length);

  const output = [["head", newHead], ["hhea", newHhea], ["maxp", newMaxp], ["hmtx", newHmtx], ["loca", newLoca], ["glyf", newGlyf]];
  for (const optional of ["cvt ", "fpgm", "prep"]) {
    const table = tables.get(optional);
    if (table) output.push([optional, data.slice(table.offset, table.offset + table.length)]);
  }
  output.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return { data: assemble(output), mapping };
}

function assemble(tables) {
  const count = tables.length;
  let searchRange = 1, entrySelector = 0;
  while (searchRange * 2 <= count) { searchRange *= 2; entrySelector++; }
  searchRange *= 16;
  let offset = 12 + count * 16;
  const records = tables.map(([tag, bytes]) => {
    const record = { tag, bytes, offset, checksum: checksum(bytes) };
    offset += (bytes.length + 3) & ~3;
    return record;
  });
  const out = new Uint8Array(offset);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, count);
  view.setUint16(6, searchRange);
  view.setUint16(8, entrySelector);
  view.setUint16(10, count * 16 - searchRange);
  records.forEach((record, index) => {
    const at = 12 + index * 16;
    for (let i = 0; i < 4; i++) out[at + i] = record.tag.charCodeAt(i);
    view.setUint32(at + 4, record.checksum);
    view.setUint32(at + 8, record.offset);
    view.setUint32(at + 12, record.bytes.length);
    out.set(record.bytes, record.offset);
  });
  const adjustment = (0xb1b0afba - checksum(out)) >>> 0;
  const head = records.find((record) => record.tag === "head");
  view.setUint32(head.offset + 8, adjustment);
  return out;
}

function checksum(bytes) {
  let sum = 0;
  const length = bytes.length;
  for (let index = 0; index < length; index += 4) {
    sum = (sum + (((bytes[index] ?? 0) << 24) | ((bytes[index + 1] ?? 0) << 16) | ((bytes[index + 2] ?? 0) << 8) | (bytes[index + 3] ?? 0))) >>> 0;
  }
  return sum >>> 0;
}
