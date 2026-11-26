// Embed blocks (FR-08): a live web page that a web presenter may show when its host allows, and a picture or card linked to it
// everywhere else. The editor never loads the page: it edits the address, the title, the frame's proportions and the preview picture
// (picked or uploaded, which becomes an asset). Each change is one validated JSON Patch applied as one undoable transaction; the
// `prepare…` form returns the patch without touching a session.
import { getValueAtPath, opfPathToJsonPointer, splitOpfPath } from "./index.js";
import { checkedDocument, fail, same } from "./edit-helpers.js";
import { checkFormat } from "./checks.js";

/** The aspect ratios the inspector offers beside a number field: the frame's width over its height. */
export const EMBED_ASPECT_PRESETS = Object.freeze([
  Object.freeze({ id: "16:9", label: "16:9 (default)", value: 16 / 9 }),
  Object.freeze({ id: "16:10", label: "16:10", value: 1.6 }),
  Object.freeze({ id: "4:3", label: "4:3", value: 4 / 3 }),
  Object.freeze({ id: "1:1", label: "1:1", value: 1 }),
]);
/** The fields an embed object holds, in schema order. */
export const EMBED_FIELDS = Object.freeze(["src", "title", "aspectRatio", "preview"]);

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const bad = (message, details) => fail("invalid-embed", message, details);
const HTTPS = /^https:\/\/[^\s/?#]\S*$/;

function embedPayload(presentation, blockPath) {
  const parts = splitOpfPath(blockPath);
  const payload = getValueAtPath(presentation, parts);
  if (!isObject(payload) || payload.embed === undefined) throw bad("Choose a block or slide that holds an embed.", { path: blockPath });
  return { parts, payload };
}

/** The embed object of a block, whichever form it was written in: `{ path, src, title, aspectRatio, preview }`. Absent fields are undefined. */
export function readEmbed(presentation, blockPath) {
  const { parts, payload } = embedPayload(presentation, blockPath);
  const value = typeof payload.embed === "string" ? { src: payload.embed } : payload.embed;
  const out = { path: parts.join(".") };
  for (const key of EMBED_FIELDS) out[key] = value[key] === undefined ? undefined : structuredClone(value[key]);
  return out;
}

function normalize(key, raw) {
  switch (key) {
    case "src": {
      const value = typeof raw === "string" ? raw.trim() : "";
      if (!HTTPS.test(value) || value.length > 2048) throw bad("An embed's address is an https address, for example https://app.example.com/dashboard.", { value: raw });
      return value;
    }
    case "title": {
      if (typeof raw !== "string" || !raw.trim()) throw bad("A title is some text; clear it to use the site name.", { value: raw });
      return raw.trim();
    }
    case "aspectRatio": {
      const value = Number(raw);
      if (!Number.isFinite(value) || !(value > 0) || value > 10) throw bad("An aspect ratio is a number above 0 and up to 10, width over height (1.78 is 16:9).", { value: raw });
      return value;
    }
    case "preview": {
      if (typeof raw !== "string" || !/^(asset:|https:\/\/|data:|\.\/|\.\.\/)/.test(raw.trim())) throw bad("A preview is a picture: an asset: reference, an https address, a data URI or a relative path.", { value: raw });
      return raw.trim();
    }
    default:
      throw bad(`An embed has no "${key}" field.`, { key });
  }
}

/**
 * The embed an edit leaves: `fields` sets (a value) or removes (`null`) the address, title, aspect ratio and preview of the embed at
 * `blockPath`. It stays the string shorthand while it holds only an address.
 */
export function editedEmbed(presentation, blockPath, fields) {
  if (!isObject(fields)) throw bad("Pass the embed settings to change, for example { title: \"Revenue dashboard\" }.", { fields });
  for (const key of Object.keys(fields)) if (!EMBED_FIELDS.includes(key)) throw bad(`An embed has no "${key}" field (it has ${EMBED_FIELDS.join(", ")}).`, { key });
  const current = readEmbed(presentation, blockPath);
  const next = {};
  for (const key of EMBED_FIELDS) {
    const raw = fields[key];
    const value = raw === undefined ? current[key] : raw === null ? undefined : normalize(key, raw);
    if (key === "src" && value === undefined) throw bad("An embed needs an address.", { path: blockPath });
    if (value !== undefined) next[key] = value;
  }
  if (typeof fields.preview === "string" && next.preview?.startsWith("asset:") && !Object.hasOwn(presentation?.assets ?? {}, next.preview.slice(6))) throw bad(`The deck has no asset "${next.preview.slice(6)}"; add the picture to its assets first.`, { value: next.preview });
  return Object.keys(next).length === 1 ? next.src : next;
}

/** The patch that sets or removes fields of the embed at `blockPath` (one replace of its value). */
export function embedPatches(presentation, blockPath, fields) {
  const { parts, payload } = embedPayload(presentation, blockPath);
  const value = editedEmbed(presentation, blockPath, fields);
  return same(payload.embed, value) ? [] : [{ op: "replace", path: opfPathToJsonPointer([...parts, "embed"]), value }];
}

/** Compute the patch for `setEmbed` without touching a session: `{ presentation, patches, changed, path, slideIndex }`. */
export function prepareEmbed(presentation, blockPath, fields) {
  const before = checkFormat(presentation);
  const patches = embedPatches(presentation, blockPath, fields);
  const next = checkedDocument(presentation, patches, before);
  const parts = splitOpfPath(blockPath);
  return { presentation: structuredClone(next), patches, changed: patches.length > 0, path: parts.join("."), slideIndex: Number(parts[1]) };
}

/**
 * Set or remove (`null`) fields of one embed as a single undoable transaction:
 * `setEmbed(editor, "slides.1.blocks.0", { title: "Prototype", aspectRatio: 1.6 })`.
 */
export function setEmbed(editor, blockPath, fields, meta = {}) {
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  const prepared = prepareEmbed(editor.presentation, blockPath, fields);
  const { presentation, patches, ...summary } = prepared;
  void presentation;
  if (!prepared.changed) return { ...summary, presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(patches, { ...meta, source: meta.source ?? "embed", path: prepared.path });
  return { ...change, ...summary };
}
