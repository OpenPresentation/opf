/**
 * Intrinsic aspect ratio (width / height) of an image source, read without fetching: an embedded
 * `data:` URI (PNG, JPEG, GIF, WebP, SVG), or an `asset:<id>` reference to one in `assets`.
 * Any other source (a URL or file path) has no readable dimensions here and returns undefined;
 * hosts resolve those themselves.
 *
 * Only a bounded prefix of the payload is decoded (never the whole of a multi-megabyte logo): 64 KiB, which
 * holds every PNG, GIF and WebP header and the root `<svg>` tag of any real SVG, then 1 MiB for a JPEG whose
 * start-of-frame segment sits behind large EXIF or ICC data. A JPEG whose frame header is still not inside
 * 1 MiB, or an SVG whose root tag is not inside 64 KiB, has no readable proportions (undefined, so a square
 * box). Results are memoized per source string, so a deck's repeated header image is read once.
 */
type Dimensions = {width: number; height: number};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function sourceOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  return isRecord(value) && typeof value.src === 'string' ? value.src : undefined;
}

/** Bytes decoded for the first read, and for a JPEG whose frame header was not inside them. */
const PREFIX_BYTES = 64 * 1024, JPEG_PREFIX_BYTES = 1024 * 1024;

/** The media type and at most `limit` leading bytes of a data URI payload. */
function dataBytes(uri: string, limit: number): {type: string; bytes: Uint8Array} | undefined {
  const match = /^data:([^;,]*)((?:;[^;,]*)*),/i.exec(uri);
  if (!match) return undefined;
  const type = (match[1] ?? '').toLowerCase(), start = match[0].length;
  try {
    if (/;base64/i.test(match[2] ?? '')) {
      // Four base64 characters are three bytes; slice slightly more than needed so whitespace inside the prefix cannot starve it.
      const chars = Math.ceil(limit / 3) * 4, text = uri.slice(start, start + chars + chars / 8).replace(/\s+/g, '').slice(0, chars);
      return {type, bytes: Uint8Array.from(atob(text.slice(0, text.length - (text.length % 4))), char => char.charCodeAt(0))};
    }
    // Percent-encoded text: cut the prefix before a partial %XX escape so the decode cannot fail on the cut.
    const prefix = uri.slice(start, start + limit).replace(/%[0-9a-f]?$/i, '');
    return {type, bytes: new TextEncoder().encode(decodeURIComponent(prefix))};
  } catch { return undefined; }
}

const at = (b: Uint8Array, i: number) => b[i] ?? 0;
const u16be = (b: Uint8Array, i: number) => (at(b, i) << 8) | at(b, i + 1);
const u32be = (b: Uint8Array, i: number) => ((at(b, i) << 24) | (at(b, i + 1) << 16) | (at(b, i + 2) << 8) | at(b, i + 3)) >>> 0;
const u16le = (b: Uint8Array, i: number) => at(b, i) | (at(b, i + 1) << 8);
const u24le = (b: Uint8Array, i: number) => at(b, i) | (at(b, i + 1) << 8) | (at(b, i + 2) << 16);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

function rasterDimensions(b: Uint8Array): Dimensions | undefined {
  if (b.length >= 24 && u32be(b, 0) === 0x89504e47 && ascii(b, 12, 4) === 'IHDR') return {width: u32be(b, 16), height: u32be(b, 20)};
  if (b.length >= 10 && (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a')) return {width: u16le(b, 6), height: u16le(b, 8)};
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (at(b, i) !== 0xff) { i++; continue; }
      const marker = at(b, i + 1);
      if (marker === 0xff) { i++; continue; }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return {height: u16be(b, i + 5), width: u16be(b, i + 7)};
      i += 2 + u16be(b, i + 2);
    }
    return undefined;
  }
  if (b.length >= 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const chunk = ascii(b, 12, 4);
    if (chunk === 'VP8X') return {width: u24le(b, 24) + 1, height: u24le(b, 27) + 1};
    if (chunk === 'VP8L' && at(b, 20) === 0x2f) { const bits = u16le(b, 21) | (u16le(b, 23) << 16); return {width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1}; }
    if (chunk === 'VP8 ') return {width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff};
  }
  return undefined;
}

function svgDimensions(text: string): Dimensions | undefined {
  const root = /<svg\b([^>]*)>/i.exec(text)?.[1];
  if (root === undefined) return undefined;
  const attribute = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(root)?.[1];
  const length = (value: string | undefined) => { const match = value && /^\s*([0-9]*\.?[0-9]+)\s*(px|pt|in|cm|mm|em)?\s*$/i.exec(value); return match ? Number(match[1]) : undefined; };
  const width = length(attribute('width')), height = length(attribute('height'));
  if (width && height) return {width, height};
  const box = attribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (box && box.length === 4 && box.every(Number.isFinite)) { const [, , width = 0, height = 0] = box; if (width > 0 && height > 0) return {width, height}; }
  return undefined;
}

const cache = new Map<string, number | undefined>(), CACHE_ENTRIES = 64;

function readAspect(source: string): number | undefined {
  const first = dataBytes(source, PREFIX_BYTES);
  if (!first) return undefined;
  let dimensions: Dimensions | undefined;
  if (first.type.startsWith('image/svg')) dimensions = svgDimensions(new TextDecoder().decode(first.bytes));
  else {
    dimensions = rasterDimensions(first.bytes);
    // A JPEG with a large EXIF/ICC segment: read more, once. Other formats carry their size in the first bytes.
    if (!dimensions && first.bytes.length >= 2 && first.bytes[0] === 0xff && first.bytes[1] === 0xd8) {
      const more = dataBytes(source, JPEG_PREFIX_BYTES);
      if (more) dimensions = rasterDimensions(more.bytes);
    }
  }
  return dimensions && dimensions.width > 0 && dimensions.height > 0 ? dimensions.width / dimensions.height : undefined;
}

/** Width / height of an embedded image, following `asset:<id>` references through `assets`; undefined when unreadable. */
export function intrinsicImageAspect(value: unknown, assets?: unknown): number | undefined {
  let source = sourceOf(value);
  for (let hop = 0; source?.startsWith('asset:') && hop < 8; hop++) source = sourceOf(isRecord(assets) ? assets[source.slice(6)] : undefined);
  if (!source?.startsWith('data:')) return undefined;
  if (cache.has(source)) return cache.get(source);
  const aspect = readAspect(source);
  if (cache.size >= CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(source, aspect);
  return aspect;
}
