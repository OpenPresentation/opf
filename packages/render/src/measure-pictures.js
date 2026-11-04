// LH-145: `measurePictures(deck)` reads the pixels of a deck's picture backgrounds once each and returns the `pictureLuminance` sampler
// that core composition (`ComposeSlideOptions.pictureLuminance`) and both engines accept, so the automatic scrim of LH-02 is sized for
// the picture under the text (none on a dark photo under light text) instead of for any picture from black to white.
//
// This module is edge-safe: it imports no converter and no Node module, so the browser entries (`/svg`, the editor) can reach it. It
// reads sources, decodes them with `options.decode` (the Node entry's default is sharp, loaded lazily; the default here is the
// browser's canvas) and builds each grid with core's `luminanceGrid`. A picture that cannot be read or decoded is left out and
// reported (`picture-not-measured`): its slide keeps the worst-case scrim, which is always safe.
import { resolveDesignRecords } from "@openpresentation/opf";
import { imageBackground, luminanceGrid } from "@openpresentation/opf/composition";

/** The longest side a picture is decoded at. A cell of the 32 x 18 grid still spans tens of pixels, and the cost stays flat for any photo. */
export const MEASURE_MAX_SIDE = 1024;
/** The largest picture file read (bytes). */
const MAX_BYTES = 64 * 1024 * 1024;

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * The luminance sampler of a deck's picture backgrounds (slide, deck and theme), measured once each.
 *
 * `deck` is a parsed OPF deck (a JSON string or bytes also work). Sources are followed as the renderer follows them: an `asset:` reference
 * through `deck.assets`, then `options.imageResolver` (the same function `toSvg` takes; it may be async and may return a data URI, bytes or
 * `{ data, mediaType }`). A data URI is decoded as it is; any other string is fetched only when `options.fetch` is given. Nothing else is read.
 * `options.cache` (a Map the host keeps) holds the work per resolved source, so editing a deck decodes a picture once, not on every change; a
 * picture that failed stays failed in it (and is reported once), so a broken file is not decoded again on every edit.
 */
export async function measurePictures(deck, options = {}) {
  const presentation = parseDeck(deck);
  const found = backgroundSources(presentation, options.catalogs);
  const cache = options.cache instanceof Map ? options.cache : new Map();
  const decode = options.decode ?? decodeWithCanvas;
  const grids = new Map(), used = new Set();
  await Promise.all(found.map(async ({ src, path }) => {
    try {
      const picture = await readPicture(presentation, src, path, options);
      if (!picture) return;
      used.add(picture.key);
      if (!cache.has(picture.key)) cache.set(picture.key, measure(picture, decode, options.maxSide ?? MEASURE_MAX_SIDE).catch((error) => { note(options, path, error); return null; }));
      const grid = await cache.get(picture.key);
      if (grid) grids.set(src, grid);
    } catch (error) {
      note(options, path, error);
    }
  }));
  // A host cache that outlives many edits drops the pictures this deck no longer uses once it holds more than a few.
  if (cache.size > 16) for (const key of [...cache.keys()]) if (!used.has(key)) cache.delete(key);
  const sampler = (src) => grids.get(src);
  Object.defineProperties(sampler, {
    sources: { value: Object.freeze(found.map((entry) => entry.src)), enumerable: true },
    measured: { get: () => grids.size, enumerable: true },
  });
  return sampler;
}

function parseDeck(input) {
  const value = input instanceof Uint8Array ? new TextDecoder().decode(input) : input;
  const deck = typeof value === "string" ? JSON.parse(value) : value;
  if (!isRecord(deck)) throw new TypeError("measurePictures needs an OPF deck: a parsed object, a JSON string or bytes.");
  return deck;
}

// Every picture a slide can show as its background: the slide's own, the deck's and the theme's (core composes with the first that is set).
function backgroundSources(deck, catalogs) {
  const found = new Map();
  const add = (value, path) => {
    const background = imageBackground(value);
    if (background && !found.has(background.src)) found.set(background.src, { src: background.src, path });
  };
  add(isRecord(deck.design) ? deck.design.background : undefined, "design.background");
  const slides = Array.isArray(deck.slides) ? deck.slides : [];
  const themes = new Set();
  slides.forEach((slide, index) => {
    const design = isRecord(slide) && isRecord(slide.design) ? slide.design : {};
    add(design.background, `slides.${index}.design.background`);
    const reference = design.theme ?? (isRecord(deck.design) ? deck.design.theme : undefined);
    const key = typeof reference === "string" ? reference : "";
    if (themes.has(key)) return;
    themes.add(key);
    try { add(resolveDesignRecords(deck, index, catalogs === undefined ? {} : { catalogs }).theme.background, "theme"); } catch { /* an unresolved theme draws the engine default, which has no picture */ }
  });
  return [...found.values()];
}

// The drawable source of a background, as the renderer resolves it (render's resolveImageSource): `asset:` references, then the host's resolver.
async function readPicture(deck, raw, path, options) {
  const assets = isRecord(deck.assets) ? deck.assets : {};
  const named = (value) => (typeof value === "string" ? { src: value } : isRecord(value) ? value : { src: "" });
  let asset = { src: raw };
  const seen = new Set();
  while (typeof asset.src === "string" && asset.src.startsWith("asset:")) {
    const id = asset.src.slice(6);
    if (seen.has(id) || !Object.hasOwn(assets, id)) return undefined;
    seen.add(id);
    const { src: _source, ...overrides } = asset;
    asset = { ...named(assets[id]), ...overrides };
  }
  if (typeof asset.src !== "string" || !asset.src) return undefined;
  const resolved = (await options.imageResolver?.(asset.src, { asset, path })) ?? asset.src;
  if (typeof resolved === "string") {
    if (/^data:/i.test(resolved)) return { key: resolved, bytes: () => dataUriBytes(resolved) };
    if (typeof options.fetch === "function" && /^(?:https?|blob):/i.test(resolved)) return { key: resolved, bytes: () => fetchBytes(resolved, options.fetch) };
    return undefined;
  }
  if (resolved instanceof Uint8Array) return { key: resolved, bytes: () => ({ bytes: resolved, mediaType: undefined }) };
  if (isRecord(resolved) && resolved.data instanceof Uint8Array) return { key: resolved.data, bytes: () => ({ bytes: resolved.data, mediaType: typeof resolved.mediaType === "string" ? resolved.mediaType : undefined }) };
  if (isRecord(resolved) && typeof resolved.data === "string" && /^data:/i.test(resolved.data)) return { key: resolved.data, bytes: () => dataUriBytes(resolved.data) };
  return undefined;
}

function dataUriBytes(uri) {
  const comma = uri.indexOf(",");
  const header = uri.slice(5, comma), payload = uri.slice(comma + 1);
  const mediaType = header.split(";")[0].trim().toLowerCase() || undefined;
  let bytes;
  if (/;base64$/i.test(header)) {
    const binary = atob(decodeURIComponent(payload).replace(/\s+/g, ""));
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } else bytes = new TextEncoder().encode(decodeURIComponent(payload));
  return { bytes, mediaType };
}

async function fetchBytes(url, fetcher) {
  const response = await fetcher(url);
  if (response.ok === false) throw new Error(`The picture could not be fetched (${response.status}).`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), mediaType: response.headers?.get?.("content-type")?.split(";")[0].trim().toLowerCase() || undefined };
}

const startsWith = (bytes, signature, offset = 0) => signature.every((value, index) => bytes[offset + index] === value);
/** The media type of picture bytes: what the bytes are, else what the source said. */
export function sniffMediaType(bytes, declared) {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (/<svg[\s>]/i.test(new TextDecoder().decode(bytes.subarray(0, 4096)))) return "image/svg+xml";
  return declared;
}

async function measure(picture, decode, maxSide) {
  const { bytes, mediaType } = await picture.bytes();
  if (bytes.length > MAX_BYTES) throw new Error(`The picture is larger than ${MAX_BYTES / 1024 / 1024} MB.`);
  const pixels = await decode(bytes, sniffMediaType(bytes, mediaType), { maxSide });
  return luminanceGrid(pixels.data, pixels.width, pixels.height, { channels: pixels.channels });
}

const note = (options, path, error) => options.onDiagnostic?.({
  code: "picture-not-measured",
  path,
  message: `The picture could not be measured, so its scrim is sized for any picture from black to white: ${error instanceof Error ? error.message : String(error)}`,
});

/**
 * The browser decoder: the picture drawn on a canvas at most `maxSide` pixels on its longest side. Rejects where there is no canvas
 * (a Node host passes `decode`, as the Node entry does with sharp).
 */
export async function decodeWithCanvas(bytes, mediaType, { maxSide }) {
  const blob = new Blob([bytes], mediaType ? { type: mediaType } : {});
  let source, width, height, release;
  if (mediaType !== "image/svg+xml" && typeof createImageBitmap === "function") {
    source = await createImageBitmap(blob);
    ({ width, height } = source);
    release = () => source.close?.();
  } else if (typeof Image === "function" && typeof URL?.createObjectURL === "function") {
    const url = URL.createObjectURL(blob);
    source = new Image();
    source.src = url;
    try { await source.decode(); } finally { URL.revokeObjectURL(url); }
    ({ naturalWidth: width, naturalHeight: height } = source);
  } else throw new Error("This host cannot decode pictures: pass options.decode.");
  try {
    if (!(width > 0 && height > 0)) throw new Error("The picture has no size.");
    const factor = Math.min(1, maxSide / Math.max(width, height));
    const w = Math.max(1, Math.round(width * factor)), h = Math.max(1, Math.round(height * factor));
    const canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This host has no 2D canvas.");
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, w, h);
    const { data } = context.getImageData(0, 0, w, h);
    return { width: w, height: h, data, channels: 4 };
  } finally {
    release?.();
  }
}
