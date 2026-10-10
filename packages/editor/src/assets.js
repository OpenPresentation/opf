// Image assets for the design controls (RR-06): turn a local file into an entry of the document's
// `assets` map and reference it from a logo, watermark, background or header/footer
// zone in the same undoable patch. The file is validated before anything changes: the type must be
// PNG, JPEG, GIF, WebP or SVG, its bytes must match that type, and its size must be under a cap with a
// clear error. A host that keeps images elsewhere passes `onAddAsset` and gets the bytes instead.
import { applyJsonPatch, getValueAtPath, opfPathToJsonPointer } from "./index.js";
import { fail } from "./edit-helpers.js";

/** Accepted image types by media type, with their usual extensions. */
export const IMAGE_MEDIA_TYPES = Object.freeze({
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "image/svg+xml": ["svg"],
});
/** The `accept` value for a file input. */
export const IMAGE_ACCEPT = Object.keys(IMAGE_MEDIA_TYPES).join(",");
/** Default size cap for an uploaded image (2 MiB). Raise it with the `maxBytes` option. */
export const DEFAULT_MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const formatSize = (bytes) => (bytes < 1024 ? `${bytes} bytes` : bytes >= 1024 * 1024 ? `${+(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const formatKb = (bytes) => `${+(bytes / 1024).toFixed(1)} KB`;
// "2 MB; the limit is 2 MB" tells nobody anything: when the two round alike, say it in kilobytes.
function tooLarge(name, size, maxBytes) {
  const [actual, limit] = formatSize(size) === formatSize(maxBytes) ? [formatKb(size), formatKb(maxBytes)] : [formatSize(size), formatSize(maxBytes)];
  return `${name ? `"${name}"` : "This file"} is ${actual}; the limit is ${limit}. Resize or compress it, or host it and use a web address instead.`;
}

/** The image type the first bytes of `bytes` say it is, or undefined. SVG is recognized by its root element. */
export function sniffImageType(bytes) {
  const at = (index) => bytes[index];
  if (bytes.length >= 8 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return "image/png";
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38) return "image/gif";
  if (bytes.length >= 12 && at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return "image/webp";
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 2048)).replace(/^﻿/, "").trimStart();
  if (/^(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) return "image/svg+xml";
  return undefined;
}

function mediaTypeFromName(name) {
  const extension = /\.([a-z0-9]+)$/i.exec(name ?? "")?.[1]?.toLowerCase();
  return Object.entries(IMAGE_MEDIA_TYPES).find(([, extensions]) => extensions.includes(extension))?.[0];
}

// An SVG used as an image cannot run script in a browser, but the same bytes travel in the document
// to other tools; refuse the constructs that exist only to run or fetch things.
function unsafeSvg(bytes) {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return /<script[\s>]|<foreignObject[\s>]|\son[a-z]+\s*=|javascript:|<iframe[\s>]|<!ENTITY/i.test(text);
}

/**
 * Validate a file's bytes and name. Returns `{ mediaType }` or throws `invalid-image` with a message that says what to do.
 * `declaredType` is the browser-reported type (may be empty); the bytes decide.
 */
export function checkImageBytes(bytes, { name, declaredType, maxBytes = DEFAULT_MAX_IMAGE_BYTES } = {}) {
  const label = name ? `"${name}"` : "This file";
  if (!bytes || !bytes.length) throw fail("invalid-image", `${label} is empty.`, { name });
  if (bytes.length > maxBytes)
    throw fail("image-too-large", tooLarge(name, bytes.length, maxBytes), { name, size: bytes.length, maxBytes });
  const mediaType = sniffImageType(bytes);
  if (!mediaType) throw fail("invalid-image", `${label} is not a PNG, JPEG, GIF, WebP or SVG image.`, { name, declaredType });
  const claimed = declaredType && IMAGE_MEDIA_TYPES[declaredType] ? declaredType : mediaTypeFromName(name);
  if (claimed && claimed !== mediaType) throw fail("invalid-image", `${label} says it is ${claimed.replace("image/", "").toUpperCase()} but its contents are ${mediaType.replace("image/", "").toUpperCase()}. Save it as the right type and choose it again.`, { name, claimed, mediaType });
  if (mediaType === "image/svg+xml" && unsafeSvg(bytes)) throw fail("invalid-image", `${label} contains script or embedded content that an image must not carry. Export a plain SVG and choose it again.`, { name });
  return { mediaType };
}

/** Read a File or Blob into validated bytes: `{ name, mediaType, bytes, size }`. Rejects before reading when the size is already over the cap. */
export async function readImageFile(file, { maxBytes = DEFAULT_MAX_IMAGE_BYTES } = {}) {
  if (!file || typeof file.arrayBuffer !== "function") throw fail("invalid-image", "Choose an image file.", {});
  if (typeof file.size === "number" && file.size > maxBytes)
    throw fail("image-too-large", tooLarge(file.name, file.size, maxBytes), { name: file.name, size: file.size, maxBytes });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { mediaType } = checkImageBytes(bytes, { name: file.name, declaredType: file.type, maxBytes });
  return { name: file.name ?? "image", mediaType, bytes, size: bytes.length };
}

function toBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

/** A data URI for validated image bytes. */
export function imageDataUri(bytes, mediaType) {
  return `data:${mediaType};base64,${toBase64(bytes)}`;
}

/** An asset id for a file name that is free in the document (`logo`, then `logo-2`, ...). */
export function uniqueAssetId(presentation, name) {
  const base = String(name ?? "image").replace(/\.[a-z0-9]+$/i, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "image";
  const taken = presentation?.assets && typeof presentation.assets === "object" ? presentation.assets : {};
  if (!Object.hasOwn(taken, base)) return base;
  for (let n = 2; ; n += 1) if (!Object.hasOwn(taken, `${base}-${n}`)) return `${base}-${n}`;
}

/**
 * The patch that adds one validated image to `assets` (the entry is `{ src: dataUri, mediaType, title, alt? }`),
 * with the `asset:<id>` reference to use. Pure: touches no session.
 */
export function prepareImageAsset(presentation, image, { alt, id } = {}) {
  const assetId = id ?? uniqueAssetId(presentation, image.name);
  if (presentation?.assets && Object.hasOwn(presentation.assets, assetId)) throw fail("asset-exists", `An asset named "${assetId}" already exists.`, { id: assetId });
  const entry = { src: imageDataUri(image.bytes, image.mediaType), mediaType: image.mediaType, title: image.name };
  if (typeof alt === "string" && alt.trim()) entry.alt = alt.trim();
  const patches = presentation?.assets && typeof presentation.assets === "object" && !Array.isArray(presentation.assets)
    ? [{ op: "add", path: opfPathToJsonPointer(["assets", assetId]), value: entry }]
    : [{ op: "add", path: "/assets", value: { [assetId]: entry } }];
  return { id: assetId, reference: `asset:${assetId}`, entry, patches };
}

/**
 * Add an uploaded image and use it in one undoable transaction. `build(reference, presentation)` returns the
 * prepared change that uses the image (any `prepare...` function of this package, for example
 * `(ref, doc) => prepareOrganizationLogo(doc, "icon", ref, { background: "onDark" })`); its patches run after the asset patch.
 *
 * Options: `alt` (saved on the asset), `maxBytes`, `meta`, and `onAddAsset({ name, mediaType, bytes, size, alt, file })`
 * for a host that stores images itself: it returns the reference to use (a web address or an `asset:` id the
 * host added) and nothing is added to `assets`.
 */
export async function applyImageUpload(editor, file, build, options = {}) {
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  const image = await readImageFile(file, { maxBytes: options.maxBytes });
  const { alt, meta } = options;
  let reference;
  let assetPatches = [];
  let assetId;
  if (typeof options.onAddAsset === "function") {
    const stored = await options.onAddAsset({ name: image.name, mediaType: image.mediaType, bytes: image.bytes, size: image.size, alt: alt?.trim() || undefined, file });
    reference = typeof stored === "string" ? stored : stored?.src;
    if (typeof reference !== "string" || !reference.trim()) throw fail("invalid-asset-reference", "The host's onAddAsset must return the image's reference (a web address or an asset: id).", {});
  } else {
    // Build against the document as it is after the read: the file may have taken a moment to arrive.
    const added = prepareImageAsset(editor.presentation, image, { alt });
    reference = added.reference;
    assetPatches = added.patches;
    assetId = added.id;
  }
  const presentation = assetPatches.length ? applyJsonPatch(editor.presentation, assetPatches) : editor.presentation;
  const prepared = build(reference, presentation);
  const patches = [...assetPatches, ...prepared.patches];
  const summary = { assetId, reference, changed: patches.length > 0, prepared };
  if (!patches.length) return { ...summary, presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(patches, { ...meta, source: meta?.source ?? "image-upload", ...(assetId ? { assetId } : {}), reference });
  return { ...change, ...summary };
}

/** The patch that sets (or, for an empty string, removes) an asset's alt text. The asset must exist in `assets`. */
export function prepareAssetAlt(presentation, assetId, alt) {
  const entry = getValueAtPath(presentation, ["assets", assetId]);
  if (entry === undefined) throw fail("unknown-asset", `There is no asset named "${assetId}".`, { assetId });
  const object = typeof entry === "string" ? { src: entry } : { ...entry };
  const text = typeof alt === "string" ? alt.trim() : "";
  if (text) object.alt = text;
  else delete object.alt;
  const value = Object.keys(object).length === 1 && typeof object.src === "string" ? object.src : object;
  const same = JSON.stringify(value) === JSON.stringify(entry);
  return { assetId, patches: same ? [] : [{ op: "replace", path: opfPathToJsonPointer(["assets", assetId]), value }], changed: !same };
}

/** Set an asset's alt text as one undoable transaction. */
export function setAssetAlt(editor, assetId, alt, meta = {}) {
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  const prepared = prepareAssetAlt(editor.presentation, assetId, alt);
  if (!prepared.changed) return { ...prepared, presentation: editor.presentation, inversePatches: [], validation: editor.validation };
  return { ...editor.applyPatch(prepared.patches, { ...meta, source: meta.source ?? "asset-alt", assetId }), assetId, changed: true };
}

/** The `assets` id a reference names (`asset:logo` gives `logo`), or undefined for a URL or data address. */
export function assetIdOf(reference) {
  const source = typeof reference === "string" ? reference : reference && typeof reference === "object" ? reference.src : undefined;
  return typeof source === "string" && source.startsWith("asset:") ? source.slice("asset:".length) : undefined;
}
