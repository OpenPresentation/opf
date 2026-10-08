// Image crop and focal point (RR-25): the model.
//
// The OPF schema has no crop rectangle on an image (`Asset` is `src`, `alt`, `title`, `description`, `mediaType`, `format`).
// An image block has a `fit` (cover, contain, stretch) and, since OPF 0.15, a `focus` point that a cover fit keeps in view
// (image-options.js sets both). A crop that removes part of the picture is still not a field, so the editor writes it into
// the picture itself: the cropped pixels become a new entry of `assets` and the image points at it, in ONE undoable change.
// Because the preview and the PPTX export both read those pixels, they cannot disagree about what is shown; the block's fit
// then places the cropped picture in its frame exactly as before (opf-pptx writes the usual `a:srcRect` for that placement,
// and none for a picture whose shape matches its frame).
//
// A focal point works the same way: the picture is cut to the frame's shape around the chosen point, so a centred cover
// fit shows what was chosen. The original asset stays in `assets`, and the new asset's `description` says "Cropped from
// asset:<id>", which is how "Restore original" finds it. This is the editor's way of working inside the current schema, not
// a new OPF field.
//
// This module is the pure part (rectangle maths, the patch that applies a crop) plus `cropImagePixels`, which needs a
// browser canvas. `image-cropper.js` is the DOM that drives it.
import { OPFEditorError, getValueAtPath, opfPathToJsonPointer } from "./index.js";
import { DEFAULT_MAX_IMAGE_BYTES, assetIdOf, imageDataUri, sniffImageType, uniqueAssetId } from "./assets.js";

/** The smallest crop side, in source pixels. */
export const MIN_CROP_SIDE = 8;
const PROVENANCE = /^Cropped from asset:(.+)$/;

const fail = (code, message, details) => new OPFEditorError(code, message, details);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));

/** Aspect choices of the crop tool. `ratio` is width / height; `free` and the frame/original ones have none fixed here. */
export const CROP_ASPECTS = Object.freeze([
  { id: "free", label: "Free" },
  { id: "original", label: "Original" },
  { id: "frame", label: "Frame" },
  { id: "1:1", label: "Square 1:1", ratio: 1 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "3:4", label: "Portrait 3:4", ratio: 3 / 4 },
  { id: "2:3", label: "Portrait 2:3", ratio: 2 / 3 },
  { id: "9:16", label: "Portrait 9:16", ratio: 9 / 16 },
]);

/** The ratio of an aspect id for an image and frame, or undefined for "free". */
export function aspectRatioFor(id, { width, height, frame } = {}) {
  if (id === "free" || id === undefined) return undefined;
  if (id === "original") return width / height;
  if (id === "frame") return frame > 0 ? frame : undefined;
  return CROP_ASPECTS.find((aspect) => aspect.id === id)?.ratio;
}

// ---- rectangle maths (source pixels; rect is { x, y, width, height }) -------------------------------------------------

/** The whole image. */
export const fullRect = (width, height) => ({ x: 0, y: 0, width, height });

/** Keep a rectangle inside the image and at least `min` on each side. */
export function clampRect(rect, bounds, min = MIN_CROP_SIDE) {
  const width = clamp(rect.width, Math.min(min, bounds.width), bounds.width);
  const height = clamp(rect.height, Math.min(min, bounds.height), bounds.height);
  return { x: clamp(rect.x, 0, bounds.width - width), y: clamp(rect.y, 0, bounds.height - height), width, height };
}

/** Move a rectangle by a distance, staying inside the image. */
export function moveRect(rect, dx, dy, bounds) {
  return { ...rect, x: clamp(rect.x + dx, 0, bounds.width - rect.width), y: clamp(rect.y + dy, 0, bounds.height - rect.height) };
}

/**
 * Drag one handle of a crop rectangle to `point` (a source-pixel position). `handle` is `n`, `ne`, `e`, `se`, `s`, `sw`, `w`
 * or `nw`. With `aspect` (width / height) the ratio is kept: a corner follows the pointer along the diagonal and an edge
 * resizes about the rectangle's centre on the other axis. The result stays inside `bounds` and keeps at least `min`.
 */
export function resizeRect(start, handle, point, bounds, { aspect, min = MIN_CROP_SIDE } = {}) {
  const dx = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0;
  const dy = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0;
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  let left = dx < 0 ? clamp(point.x, 0, right - min) : start.x;
  let top = dy < 0 ? clamp(point.y, 0, bottom - min) : start.y;
  let farRight = dx > 0 ? clamp(point.x, start.x + min, bounds.width) : right;
  let farBottom = dy > 0 ? clamp(point.y, start.y + min, bounds.height) : bottom;
  if (!aspect) return { x: left, y: top, width: farRight - left, height: farBottom - top };
  const minWidth = Math.max(min, min * aspect);
  if (dx !== 0 && dy !== 0) {
    const roomWidth = dx > 0 ? bounds.width - start.x : right;
    const roomHeight = dy > 0 ? bounds.height - start.y : bottom;
    const maxWidth = Math.min(roomWidth, roomHeight * aspect);
    const width = clamp(Math.max(farRight - left, (farBottom - top) * aspect), Math.min(minWidth, maxWidth), maxWidth);
    const height = width / aspect;
    return { x: dx > 0 ? start.x : right - width, y: dy > 0 ? start.y : bottom - height, width, height };
  }
  if (dx !== 0) {
    const centerY = start.y + start.height / 2;
    const roomWidth = dx > 0 ? bounds.width - start.x : right;
    const maxWidth = Math.min(roomWidth, 2 * Math.min(centerY, bounds.height - centerY) * aspect);
    const width = clamp(farRight - left, Math.min(minWidth, maxWidth), maxWidth);
    const height = width / aspect;
    return { x: dx > 0 ? start.x : right - width, y: centerY - height / 2, width, height };
  }
  const centerX = start.x + start.width / 2;
  const roomHeight = dy > 0 ? bounds.height - start.y : bottom;
  const maxHeight = Math.min(roomHeight, (2 * Math.min(centerX, bounds.width - centerX)) / aspect);
  const height = clamp(farBottom - top, Math.min(min, maxHeight), maxHeight);
  const width = height * aspect;
  return { x: centerX - width / 2, y: dy > 0 ? start.y : bottom - height, width, height };
}

/** The largest rectangle with `aspect` that fits inside `rect`, centred on it. */
export function fitAspect(rect, aspect) {
  if (!aspect) return rect;
  let width = rect.width;
  let height = width / aspect;
  if (height > rect.height) {
    height = rect.height;
    width = height * aspect;
  }
  return { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height };
}

/**
 * The crop a focal point asks for: the largest window of the frame's `aspect` (width / height) in the image, divided by
 * `zoom` (1 or more), centred on `focal` (`{ x, y }` as fractions of the image) and kept inside the image.
 */
export function focalWindow(bounds, aspect, focal, zoom = 1) {
  const whole = fitAspect(fullRect(bounds.width, bounds.height), aspect);
  const scale = 1 / Math.max(1, zoom);
  const width = Math.max(Math.min(MIN_CROP_SIDE, bounds.width), whole.width * scale);
  const height = Math.max(Math.min(MIN_CROP_SIDE, bounds.height), whole.height * scale);
  return {
    x: clamp(focal.x * bounds.width - width / 2, 0, bounds.width - width),
    y: clamp(focal.y * bounds.height - height / 2, 0, bounds.height - height),
    width,
    height,
  };
}

/** The centre of a crop rectangle as fractions of the image: the focal point it shows. */
export const focalPointOf = (rect, bounds) => ({ x: (rect.x + rect.width / 2) / bounds.width, y: (rect.y + rect.height / 2) / bounds.height });

/** Whole source pixels, at least 1 by 1, inside the image. */
export function roundRect(rect, bounds) {
  const x = clamp(Math.round(rect.x), 0, bounds.width - 1);
  const y = clamp(Math.round(rect.y), 0, bounds.height - 1);
  return { x, y, width: clamp(Math.round(rect.width), 1, bounds.width - x), height: clamp(Math.round(rect.height), 1, bounds.height - y) };
}

/** True when the rectangle is the whole image (to within half a pixel). */
export const isFullRect = (rect, bounds) => rect.x < 0.5 && rect.y < 0.5 && Math.abs(rect.width - bounds.width) < 0.5 && Math.abs(rect.height - bounds.height) < 0.5;

// ---- locating and reading an image field ------------------------------------------------------------------------------

/**
 * What a path holds when it is a picture: `{ path, pointer, form, srcPointer, src, assetId, assetSrc, alt, mediaType, origin }`
 * or `{ error }` with the reason it is not a croppable picture. `form` is "string" (the field is the source) or "object"
 * (the field is `{ src, ... }`); `assetSrc` is what `src` resolves to (the asset's own `src`), and `origin` is the asset a
 * crop of this picture was made from, when there is one.
 */
export function describeImage(presentation, path) {
  const segments = String(path).split(".");
  const last = segments.at(-1);
  if (last !== "image") return { error: "This is not a picture." };
  const value = getValueAtPath(presentation, path);
  const pointer = opfPathToJsonPointer(segments);
  let form;
  let src;
  let alt;
  if (typeof value === "string") {
    form = "string";
    src = value;
  } else if (isObject(value) && typeof value.src === "string") {
    form = "object";
    src = value.src;
    alt = typeof value.alt === "string" ? value.alt : undefined;
  } else return { error: "This picture has no source to crop." };
  const assetId = assetIdOf(src);
  let assetSrc = src;
  let entry;
  if (assetId !== undefined) {
    entry = getValueAtPath(presentation, ["assets", assetId]);
    if (entry === undefined) return { error: `The picture asset "${assetId}" is missing from this presentation.` };
    assetSrc = typeof entry === "string" ? entry : entry?.src;
    if (typeof assetSrc !== "string") return { error: `The picture asset "${assetId}" has no source.` };
    if (typeof entry === "object" && alt === undefined && typeof entry.alt === "string") alt = entry.alt;
  }
  const dataType = /^data:([^;,]+)/.exec(assetSrc)?.[1];
  const mediaType = (isObject(entry) && entry.mediaType) || dataType;
  const origin = isObject(entry) && typeof entry.description === "string" ? PROVENANCE.exec(entry.description)?.[1] : undefined;
  if (mediaType === "image/svg+xml" || /\.svg(?:[?#].*)?$/i.test(assetSrc)) {
    return { error: "A vector (SVG) picture has no pixels to crop; it stays sharp at any size. Use Fit instead, or replace it with a PNG or JPEG." };
  }
  return { path, pointer, form, srcPointer: form === "object" ? `${pointer}/src` : pointer, src, assetId, assetSrc, alt, mediaType, origin, entry };
}

/** How many places in the document use `asset:<id>` (the `assets` map itself is not counted). */
export function countAssetReferences(presentation, id) {
  const reference = `asset:${id}`;
  let count = 0;
  const walk = (value) => {
    if (typeof value === "string") count += value === reference ? 1 : 0;
    else if (Array.isArray(value)) value.forEach(walk);
    else if (isObject(value)) for (const [key, child] of Object.entries(value)) if (key !== "assets" || value !== presentation) walk(child);
  };
  walk(presentation);
  return count;
}

// ---- the change --------------------------------------------------------------------------------------------------------

function assetPatches(presentation, id, entry) {
  const assets = presentation?.assets;
  return isObject(assets)
    ? [{ op: "add", path: opfPathToJsonPointer(["assets", id]), value: entry }]
    : [{ op: "add", path: "/assets", value: { [id]: entry } }];
}

/**
 * The patches that apply a cropped picture: a new asset (`{ src, mediaType, title, alt?, description }`) and the image
 * pointing at it. `pixels` is `{ dataUri, mediaType, width, height }` (from `cropImagePixels`). A previous crop's asset that
 * nothing else uses is removed in the same change. Pure.
 */
export function prepareCrop(presentation, path, pixels) {
  const image = describeImage(presentation, path);
  if (image.error) throw fail("not-croppable", image.error, { path });
  const origin = image.origin ?? image.assetId;
  const id = uniqueAssetId(presentation, `${origin ?? "image"}-crop`);
  const title = (isObject(image.entry) && typeof image.entry.title === "string" ? image.entry.title : origin ?? "Picture").replace(/ \(cropped\)$/, "");
  const entry = { src: pixels.dataUri, mediaType: pixels.mediaType, title: `${title} (cropped)` };
  if (image.alt) entry.alt = image.alt;
  if (origin) entry.description = `Cropped from asset:${origin}`;
  const patches = assetPatches(presentation, id, entry);
  patches.push({ op: "replace", path: image.srcPointer, value: `asset:${id}` });
  if (image.origin && image.assetId && countAssetReferences(presentation, image.assetId) === 1) patches.push({ op: "remove", path: opfPathToJsonPointer(["assets", image.assetId]) });
  return { patches, assetId: id, reference: `asset:${id}`, origin, image };
}

/** The patches that put a cropped picture back to the asset it was cropped from, or null when there is none. */
export function prepareRestore(presentation, path) {
  const image = describeImage(presentation, path);
  if (image.error || !image.origin || getValueAtPath(presentation, ["assets", image.origin]) === undefined) return null;
  const patches = [{ op: "replace", path: image.srcPointer, value: `asset:${image.origin}` }];
  if (countAssetReferences(presentation, image.assetId) === 1) patches.push({ op: "remove", path: opfPathToJsonPointer(["assets", image.assetId]) });
  return { patches, origin: image.origin, image };
}

/** Put a cropped picture back to its original as one undoable change. Returns null when there is no original to restore. */
export function restoreOriginal(editor, path, meta = {}) {
  const prepared = prepareRestore(editor.presentation, path);
  if (!prepared) return null;
  return { ...editor.applyPatch(prepared.patches, { ...meta, source: meta.source ?? "image-restore", path }), origin: prepared.origin };
}

// ---- pixels (browser) --------------------------------------------------------------------------------------------------

/**
 * Load an image's pixels: `{ image, width, height }`. Rejects with a readable `image-unreadable` error. A picture hosted on
 * another origin may be refused by the browser when its pixels are read, which `cropImagePixels` reports.
 */
export async function loadImagePixels(src, { document: doc = globalThis.document, signal } = {}) {
  const win = doc.defaultView ?? globalThis;
  const attempt = (anonymous) => new Promise((resolve, reject) => {
    const image = new win.Image();
    if (anonymous) image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(fail("image-unreadable", "The picture could not be loaded. If it is hosted elsewhere, upload it to the presentation first.", { src: src.slice(0, 80) }));
    signal?.addEventListener("abort", () => { image.src = ""; }, { once: true });
    image.src = src;
  });
  // A picture on another site is read with CORS first (so its pixels can be cut); without it the picture still shows and
  // cropImagePixels reports why it cannot be cut.
  const hosted = !/^(?:data|blob):/.test(src);
  const image = hosted ? await attempt(true).catch(() => attempt(false)) : await attempt(false);
  if (!image.naturalWidth || !image.naturalHeight) throw fail("image-unreadable", "The picture has no size.", {});
  return { image, width: image.naturalWidth, height: image.naturalHeight };
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

function hasTransparency(context, width, height) {
  const data = context.getImageData(0, 0, width, height).data;
  for (let index = 3; index < data.length; index += 4) if (data[index] < 255) return true;
  return false;
}

/**
 * Cut a rectangle (source pixels) out of a loaded picture at its own resolution. JPEG stays JPEG (quality 0.92); every
 * other type becomes PNG so transparency survives. A PNG over `maxBytes` with no transparency is saved as JPEG instead.
 * Returns `{ dataUri, mediaType, width, height, bytes }` (bytes is the byte count) or throws `image-too-large` or
 * `image-unreadable` (a cross-origin picture the browser will not let a script read).
 */
export async function cropImagePixels(loaded, rect, { mediaType, maxBytes = DEFAULT_MAX_IMAGE_BYTES, document: doc = globalThis.document } = {}) {
  const bounds = { width: loaded.width, height: loaded.height };
  const box = roundRect(rect, bounds);
  const canvas = doc.createElement("canvas");
  canvas.width = box.width;
  canvas.height = box.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(loaded.image, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
  const wantJpeg = mediaType === "image/jpeg";
  let blob;
  let outType = wantJpeg ? "image/jpeg" : "image/png";
  try {
    blob = await toBlob(canvas, outType, wantJpeg ? 0.92 : undefined);
    if (blob && !wantJpeg && blob.size > maxBytes) {
      // A photo saved as PNG can be several times the size of its JPEG; use JPEG when nothing is transparent.
      if (!hasTransparency(context, box.width, box.height)) {
        const alternative = await toBlob(canvas, "image/jpeg", 0.92);
        if (alternative && alternative.size < blob.size) { blob = alternative; outType = "image/jpeg"; }
      }
    }
  } catch (error) {
    throw fail("image-unreadable", "The browser does not let the editor read this picture's pixels (it is hosted on another site). Upload it to the presentation, then crop it.", { cause: String(error?.message ?? error) });
  }
  if (!blob) throw fail("image-unreadable", "The cropped picture could not be encoded.", {});
  if (blob.size > maxBytes) throw fail("image-too-large", `The cropped picture is ${(blob.size / 1048576).toFixed(1)} MB, over the ${(maxBytes / 1048576).toFixed(1)} MB limit. Crop a smaller area.`, { size: blob.size, maxBytes });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const sniffed = sniffImageType(bytes) ?? outType;
  return { dataUri: imageDataUri(bytes, sniffed), mediaType: sniffed, width: box.width, height: box.height, bytes: bytes.length };
}

/**
 * Crop a picture of the document and apply it as one undoable change. `rect` is in source pixels of the picture as it is
 * now. Options: `loaded` (an already loaded `loadImagePixels` result), `maxBytes`, `meta`. Returns the session's change plus
 * `{ assetId, reference, width, height }`.
 */
export async function applyCrop(editor, path, rect, options = {}) {
  const image = describeImage(editor.presentation, path);
  if (image.error) throw fail("not-croppable", image.error, { path });
  const loaded = options.loaded ?? await loadImagePixels(image.assetSrc);
  const pixels = await cropImagePixels(loaded, rect, { mediaType: image.mediaType, maxBytes: options.maxBytes });
  // The document may have changed while the picture was encoding.
  const prepared = prepareCrop(editor.presentation, path, pixels);
  const change = editor.applyPatch(prepared.patches, { ...options.meta, source: options.meta?.source ?? "image-crop", path, assetId: prepared.assetId });
  return { ...change, assetId: prepared.assetId, reference: prepared.reference, width: pixels.width, height: pixels.height };
}
