// RR-76: what a face's license lets a document embed, from its OS/2 fsType (the OpenType embedding permissions). Bit 0x0002
// (Restricted License) forbids embedding; 0x0200 (bitmap embedding only) allows only bitmaps, so an outline face cannot be
// embedded either; 0x0100 (no subsetting) allows the whole face only. 0x0004 (preview and print) and 0x0008 (editable) allow it.
// A face with no OS/2 table carries no restriction. No imports: the SVG writer and the subsetter both read it.

const RESTRICTED = 0x0002, NO_SUBSETTING = 0x0100, BITMAP_ONLY = 0x0200;

/** The OS/2 fsType of font bytes, or null when the font has no OS/2 table. */
export function fsTypeOf(data) {
  if (!data || data.length < 12) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = view.getUint16(4);
  for (let index = 0; index < count; index++) {
    const at = 12 + index * 16;
    if (at + 16 > data.length) return null;
    if (String.fromCharCode(data[at], data[at + 1], data[at + 2], data[at + 3]) !== "OS/2") continue;
    const offset = view.getUint32(at + 8);
    return offset + 10 <= data.length ? view.getUint16(offset + 8) : null;
  }
  return null;
}

/**
 * The OS/2 fsType of a font data URL (base64), reading only the table directory and the two fsType bytes, so a large face is
 * never decoded whole; null when the font has no OS/2 table or the URL cannot be read.
 */
export function dataUrlFsType(dataUrl) {
  const comma = String(dataUrl ?? "").indexOf(",");
  if (comma < 0) return null;
  const base64 = dataUrl.slice(comma + 1);
  const head = decodeRange(base64, 0, 12);
  if (head.length < 12) return null;
  const count = (head[4] << 8) | head[5];
  const directory = decodeRange(base64, 12, 12 + count * 16);
  for (let index = 0; index + 16 <= directory.length; index += 16) {
    if (String.fromCharCode(directory[index], directory[index + 1], directory[index + 2], directory[index + 3]) !== "OS/2") continue;
    const offset = ((directory[index + 8] << 24) | (directory[index + 9] << 16) | (directory[index + 10] << 8) | directory[index + 11]) >>> 0;
    const bytes = decodeRange(base64, offset + 8, offset + 10);
    return bytes.length === 2 ? (bytes[0] << 8) | bytes[1] : null;
  }
  return null;
}

/** Whether the face may be embedded at all (as outline data). */
export function embeddingAllowed(fsType) {
  return fsType === null || ((fsType & RESTRICTED) === 0 && (fsType & BITMAP_ONLY) === 0);
}

/** Whether the face may be embedded as a subset. */
export function subsettingAllowed(fsType) {
  return fsType !== null && embeddingAllowed(fsType) && (fsType & NO_SUBSETTING) === 0;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const VALUES = new Map([...ALPHABET].map((character, index) => [character, index]));

// Bytes [start, end) of base64 text, decoding only the 4-character groups that hold them.
function decodeRange(base64, start, end) {
  const first = Math.floor(start / 3), last = Math.ceil(end / 3);
  const text = base64.slice(first * 4, last * 4);
  const bytes = [];
  for (let index = 0; index + 4 <= text.length; index += 4) {
    const [a, b, c, d] = [...text.slice(index, index + 4)].map((character) => VALUES.get(character));
    if (a === undefined || b === undefined) break;
    bytes.push((a << 2) | (b >> 4));
    if (c !== undefined) bytes.push(((b & 15) << 4) | (c >> 2));
    if (d !== undefined) bytes.push(((c & 3) << 6) | d);
  }
  return bytes.slice(start - first * 3, end - first * 3);
}
