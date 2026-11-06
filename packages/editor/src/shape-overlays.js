// Overlay shapes and connectors (SH-06 Part B, on SH-04's format): the shapes a slide draws over its composed content (`slide.shapes`), each placed by
// fractions of the slide (`x`, `y`, `width`, `height`) or attached to a block (`at`), and the connectors that join two blocks or overlay shapes. Insert,
// move, resize, restack, delete and connect them as one undoable step each through the session (`editor.applyPatch`), so Undo, Redo and proposals work
// as for any other edit; the `prepare...` forms return the patch without a session. Stacking is the array order (later is on top). A connector end names a
// block or overlay by its `id`: connecting two things that have none gives them one, in the same patch, so one undo takes both back. Editing a shape's own
// properties (fill, line, text) is shape-options.js, which also takes an overlay shape's path. Plain JS with no DOM and no Node imports.
import { SHAPE_PRESETS, presetAspect } from "@openpresentation/opf/composition";
import { getValueAtPath, opfPathToJsonPointer, splitOpfPath } from "./index.js";
import { checkedDocument, fail, same } from "./edit-helpers.js";
import { checkFormat } from "./checks.js";
import { collectReservedPresentationIds } from "./presentation-ids.js";

const OVERLAY = /^slides\.(0|[1-9][0-9]*)\.shapes\.(0|[1-9][0-9]*)(?:\.|$)/;
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const bad = (message, details) => fail("invalid-overlay", message, details);
const rounded = (value) => Math.round(value * 10000) / 10000;

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur", "yi", "ps", "sd", "ug", "dv", "ckb", "iw"]);
/** Whether a slide is drawn right to left (its language, else the deck's, is Arabic, Hebrew, Persian, Urdu and the like): its overlays' `x` counts from the right edge. */
export function slideIsRtl(presentation, slideIndex) {
  const language = presentation.slides?.[slideIndex]?.language ?? presentation.language;
  return typeof language === "string" && RTL_LANGUAGES.has(language.toLowerCase().split(/[-_]/)[0]);
}

/** How a connector draws between its ends. */
export const CONNECTOR_ROUTES = Object.freeze(["straight", "elbow", "curved"]);
/** The ways to restack an overlay: all the way up or down, or one place. */
export const OVERLAY_LAYER_MOVES = Object.freeze(["front", "forward", "backward", "back"]);

// --- finding an overlay ----------------------------------------------------------------------------------------------------------

/** The overlay entry (shape or connector) a selection is in, as its path `slides.N.shapes.I`, or undefined. */
export function overlayPathForSelection(presentation, selectedPath) {
  const match = OVERLAY.exec(String(selectedPath ?? ""));
  if (!match) return undefined;
  const path = `slides.${match[1]}.shapes.${match[2]}`;
  return isObject(getValueAtPath(presentation, splitOpfPath(path))) ? path : undefined;
}

/**
 * The overlay a path (or a selection inside it) names: `{ path, slideIndex, index, count, kind, placement, entry }`. `kind` is `shape` or `connector`
 * (an entry with `connector`), `placement` is `fractions` (`x`, `y`, `width`, `height`), `at` (attached to a block) or `none` (a connector), `count` is how many
 * overlays the slide has, `entry` a copy. Undefined when the path is no overlay.
 */
export function readOverlay(presentation, selectedPath) {
  const path = overlayPathForSelection(presentation, selectedPath);
  if (!path) return undefined;
  const parts = splitOpfPath(path);
  const entry = getValueAtPath(presentation, parts);
  const slide = presentation.slides[Number(parts[1])];
  const kind = isObject(entry.connector) ? "connector" : "shape";
  return {
    path,
    slideIndex: Number(parts[1]),
    index: Number(parts[3]),
    count: slide.shapes.length,
    kind,
    placement: kind === "connector" ? "none" : isObject(entry.at) ? "at" : "fractions",
    entry: structuredClone(entry),
  };
}

function requireOverlay(presentation, path, kind) {
  const found = readOverlay(presentation, path);
  if (!found) throw fail("not-an-overlay", "Choose an overlay shape or connector of a slide's shapes.", { path });
  if (kind && found.kind !== kind) throw fail("not-an-overlay", kind === "shape" ? "This is a connector, not a shape." : "This is a shape, not a connector.", { path });
  return found;
}

function requireEditor(editor) {
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
}

/** Validate the candidate patches as every edit does and return `{ presentation, patches, changed, path }`. */
function prepared(presentation, patches, path) {
  const next = checkedDocument(presentation, patches, checkFormat(presentation));
  return { presentation: structuredClone(next), patches, changed: patches.length > 0, path };
}

function applyPrepared(editor, result, meta, source) {
  const { presentation, patches, ...summary } = result;
  void presentation;
  if (!result.changed) return { ...summary, presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(patches, { ...meta, source: meta.source ?? source, path: result.path });
  return { ...change, ...summary };
}

// --- inserting -------------------------------------------------------------------------------------------------------------------

/**
 * Compute the patch that adds an overlay shape on top of a slide: `{ shape, x, y, width, height, ...block }`. The frame is `options.frame` (fractions), else
 * about a fifth of the slide wide at the preset's own proportions, centered on `options.center` (fractions, default the middle). `options.size` is the slide's
 * pixel size for those proportions (default 1280 by 720). Returns `{ presentation, patches, path, changed, shape, frame }` with `path` the new entry.
 */
export function prepareOverlayInsert(presentation, options) {
  const preset = options?.shape;
  if (typeof preset !== "string" || !SHAPE_PRESETS.includes(preset)) throw bad(`${JSON.stringify(preset)} is not a preset shape (searchShapes finds one).`, { shape: preset });
  const slideIndex = options.slideIndex;
  const slide = presentation.slides?.[slideIndex];
  if (!Number.isInteger(slideIndex) || !isObject(slide)) throw bad("Say which slide the shape goes on: slideIndex.", { slideIndex });
  const size = options.size ?? { width: 1280, height: 720 };
  let frame = options.frame;
  if (!frame) {
    const aspect = presetAspect(preset);
    let width = 0.2;
    let height = (width * size.width) / (size.height * aspect);
    if (height > 0.6) {
      height = 0.6;
      width = (height * size.height * aspect) / size.width;
    }
    const center = options.center ?? { x: 0.5, y: 0.5 };
    frame = { x: Math.min(1 - width, Math.max(0, center.x - width / 2)), y: Math.min(1 - height, Math.max(0, center.y - height / 2)), width, height };
  }
  const entry = { shape: preset, x: rounded(frame.x), y: rounded(frame.y), width: rounded(frame.width), height: rounded(frame.height), ...(isObject(options.block) ? structuredClone(options.block) : {}) };
  const existing = Array.isArray(slide.shapes) ? slide.shapes.length : 0;
  const patches = existing ? [{ op: "add", path: opfPathToJsonPointer(["slides", String(slideIndex), "shapes", String(existing)]), value: entry }] : [{ op: "add", path: opfPathToJsonPointer(["slides", String(slideIndex), "shapes"]), value: [entry] }];
  return { ...prepared(presentation, patches, `slides.${slideIndex}.shapes.${existing}`), shape: preset, frame: { x: entry.x, y: entry.y, width: entry.width, height: entry.height } };
}

/** Add an overlay shape on top of a slide as one undoable step; the change's `path` is the new entry (`slides.0.shapes.2`). */
export function insertOverlayShape(editor, options, meta = {}) {
  requireEditor(editor);
  return applyPrepared(editor, prepareOverlayInsert(editor.presentation, options), meta, "overlay-insert");
}

// --- moving and resizing ---------------------------------------------------------------------------------------------------------

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * Compute the patch that places an overlay shape. A shape placed by fractions takes `{ x, y, width, height }` (any of them, fractions of the slide: the
 * frame is kept on the slide and at least 0.5% wide and high). A shape attached to a block (`at`) keeps its anchor: it takes `{ offset, width, height }`
 * (reference pixels for the offset; the sizes in the unit the anchor already uses, a fraction of the block up to 1, else pixels), and asking it for `x` or `y`
 * is refused (`overlay-anchored`): detach it first (`detachOverlay`).
 */
export function prepareOverlayFrame(presentation, path, change) {
  const found = requireOverlay(presentation, path, "shape");
  if (!isObject(change)) throw bad("Pass the frame to set, for example { x: 0.1, y: 0.2 }.", { change });
  const parts = splitOpfPath(found.path);
  const entry = found.entry;
  const patches = [];
  const write = (target, key, value) => {
    const at = opfPathToJsonPointer([...parts, ...target, key]);
    const old = target.length ? entry.at?.[key] : entry[key];
    if (old === undefined) patches.push({ op: "add", path: at, value });
    else if (!same(old, value)) patches.push({ op: "replace", path: at, value });
  };
  for (const key of Object.keys(change)) if (change[key] !== undefined && !["x", "y", "width", "height", "offset"].includes(key)) throw bad(`Unknown frame key: ${key}. Use x, y, width, height or offset.`, { key });
  const number = (key) => {
    const value = Number(change[key]);
    if (!Number.isFinite(value)) throw bad(`${key} is a number.`, { key, value: change[key] });
    return value;
  };
  if (found.placement === "at") {
    if (change.x !== undefined || change.y !== undefined) throw fail("overlay-anchored", "This shape is attached to a block, so it has no x and y of its own. Detach it from the block first.", { path: found.path });
    if (change.offset !== undefined) write(["at"], "offset", Math.round(clamp(number("offset"), -720, 720) * 100) / 100);
    for (const key of ["width", "height"]) if (change[key] !== undefined) write(["at"], key, Math.round(clamp(number(key), 0.001, 1280) * 10000) / 10000);
  } else {
    if (change.offset !== undefined) throw bad("offset belongs to a shape attached to a block.", { path: found.path });
    const width = clamp(change.width !== undefined ? number("width") : (entry.width ?? 0.2), 0.005, 1);
    const height = clamp(change.height !== undefined ? number("height") : (entry.height ?? 0.2), 0.005, 1);
    if (change.width !== undefined) write([], "width", rounded(width));
    if (change.height !== undefined) write([], "height", rounded(height));
    if (change.x !== undefined || change.width !== undefined) write([], "x", rounded(clamp(change.x !== undefined ? number("x") : (entry.x ?? 0), 0, 1 - width)));
    if (change.y !== undefined || change.height !== undefined) write([], "y", rounded(clamp(change.y !== undefined ? number("y") : (entry.y ?? 0), 0, 1 - height)));
  }
  return prepared(presentation, patches, found.path);
}

/** Move or resize an overlay shape as one undoable step: `setOverlayFrame(editor, "slides.0.shapes.1", { x: 0.3, y: 0.2, width: 0.25 })`. */
export function setOverlayFrame(editor, path, change, meta = {}) {
  requireEditor(editor);
  return applyPrepared(editor, prepareOverlayFrame(editor.presentation, path, change), meta, "overlay-frame");
}

/**
 * Compute the patch that frees an attached overlay shape: its `at` goes and its box, `frame` (fractions of the slide, from where composition drew it), becomes its
 * `x`, `y`, `width` and `height`. Connectors and the rest are untouched.
 */
export function prepareOverlayDetach(presentation, path, frame) {
  const found = requireOverlay(presentation, path, "shape");
  if (found.placement !== "at") throw bad("This shape is not attached to a block.", { path: found.path });
  if (![frame?.x, frame?.y, frame?.width, frame?.height].every(Number.isFinite)) throw bad("Pass the frame the shape has now, in fractions of the slide: { x, y, width, height }.", { frame });
  const width = clamp(frame.width, 0.005, 1);
  const height = clamp(frame.height, 0.005, 1);
  const parts = splitOpfPath(found.path);
  const at = (key) => opfPathToJsonPointer([...parts, key]);
  const patches = [
    { op: "remove", path: at("at") },
    { op: "add", path: at("x"), value: rounded(clamp(frame.x, 0, 1 - width)) },
    { op: "add", path: at("y"), value: rounded(clamp(frame.y, 0, 1 - height)) },
    { op: "add", path: at("width"), value: rounded(width) },
    { op: "add", path: at("height"), value: rounded(height) },
  ];
  return prepared(presentation, patches, found.path);
}

/** Free an attached overlay shape from its block as one undoable step (`frame`: where it is now, fractions of the slide). */
export function detachOverlay(editor, path, frame, meta = {}) {
  requireEditor(editor);
  return applyPrepared(editor, prepareOverlayDetach(editor.presentation, path, frame), meta, "overlay-detach");
}

// --- stacking and removing -------------------------------------------------------------------------------------------------------

/** Compute the patch that restacks an overlay (array order: later is on top). `where` is `front`, `forward`, `backward` or `back`. The change's `path` is the entry's new place. */
export function prepareOverlayLayer(presentation, path, where) {
  if (!OVERLAY_LAYER_MOVES.includes(where)) throw bad(`Restack an overlay with ${OVERLAY_LAYER_MOVES.join(", ")}.`, { where });
  const found = requireOverlay(presentation, path);
  const last = found.count - 1;
  const target = where === "front" ? last : where === "back" ? 0 : where === "forward" ? Math.min(last, found.index + 1) : Math.max(0, found.index - 1);
  const parts = splitOpfPath(found.path);
  const next = `slides.${found.slideIndex}.shapes.${target}`;
  if (target === found.index) return { ...prepared(presentation, [], found.path), index: found.index };
  const patches = [{ op: "move", from: opfPathToJsonPointer(parts), path: opfPathToJsonPointer(["slides", String(found.slideIndex), "shapes", String(target)]) }];
  return { ...prepared(presentation, patches, next), index: target };
}

/** Bring an overlay shape or connector forward or send it backward as one undoable step: `moveOverlayLayer(editor, "slides.0.shapes.1", "front")`. */
export function moveOverlayLayer(editor, path, where, meta = {}) {
  requireEditor(editor);
  return applyPrepared(editor, prepareOverlayLayer(editor.presentation, path, where), meta, "overlay-layer");
}

/**
 * Compute the patch that removes an overlay entry, and with a shape the connectors that end on it (a connector with a missing end is an error), and the
 * `shapes` key when nothing is left. Returns the patch with `removed`, the paths of the entries it takes out.
 */
export function prepareOverlayRemove(presentation, path) {
  const found = requireOverlay(presentation, path);
  const slide = presentation.slides[found.slideIndex];
  const id = typeof found.entry.id === "string" ? found.entry.id : undefined;
  const gone = new Set([found.index]);
  if (found.kind === "shape" && id)
    slide.shapes.forEach((entry, index) => {
      if (isObject(entry?.connector) && (entry.connector.from === id || entry.connector.to === id)) gone.add(index);
    });
  const patches = gone.size === slide.shapes.length
    ? [{ op: "remove", path: opfPathToJsonPointer(["slides", String(found.slideIndex), "shapes"]) }]
    : [...gone].sort((a, b) => b - a).map((index) => ({ op: "remove", path: opfPathToJsonPointer(["slides", String(found.slideIndex), "shapes", String(index)]) }));
  return { ...prepared(presentation, patches, `slides.${found.slideIndex}`), removed: [...gone].sort((a, b) => a - b).map((index) => `slides.${found.slideIndex}.shapes.${index}`) };
}

/** Delete an overlay shape (and the connectors on it) or a connector as one undoable step. */
export function removeOverlay(editor, path, meta = {}) {
  requireEditor(editor);
  return applyPrepared(editor, prepareOverlayRemove(editor.presentation, path), meta, "overlay-remove");
}

// --- connectors ------------------------------------------------------------------------------------------------------------------

/**
 * What a connector can join on a slide: its blocks (every block of the slide, groups' blocks included) and its overlay shapes, as `{ path, kind, id?, label }` in
 * document order. A thing with no `id` can still be joined: `connectShapes` gives it one.
 */
export function listConnectionEnds(presentation, slideIndex) {
  const slide = presentation.slides?.[slideIndex];
  const out = [];
  if (!isObject(slide)) return out;
  const label = (entry, fallback) => {
    for (const key of ["text", "title", "heading"]) if (typeof entry?.[key] === "string" && entry[key].trim()) return entry[key].trim().replace(/\s+/g, " ").slice(0, 32);
    if (entry?.metric?.label) return String(entry.metric.label).slice(0, 32);
    if (typeof entry?.shape === "string") return entry.shape;
    if (typeof entry?.chart === "object") return "chart";
    return fallback;
  };
  const walk = (blocks, base) => {
    blocks.forEach((block, index) => {
      if (!isObject(block)) return;
      const path = `${base}.blocks.${index}`;
      if (Array.isArray(block.blocks)) walk(block.blocks, path);
      else out.push({ path, kind: "block", ...(typeof block.id === "string" ? { id: block.id } : {}), label: `${label(block, `block ${index + 1}`)}` });
    });
  };
  if (Array.isArray(slide.blocks)) walk(slide.blocks, `slides.${slideIndex}`);
  (slide.shapes ?? []).forEach((entry, index) => {
    if (isObject(entry) && !isObject(entry.connector)) out.push({ path: `slides.${slideIndex}.shapes.${index}`, kind: "shape", ...(typeof entry.id === "string" ? { id: entry.id } : {}), label: label(entry, `shape ${index + 1}`) });
  });
  return out;
}

/** A free id for `base`: `base`, else `base-2`, `base-3`... not used by any slide, block or overlay of the deck (they share one namespace). */
function freeId(presentation, base, taken) {
  const used = new Set([...collectReservedPresentationIds(presentation), ...taken]);
  for (const slide of presentation.slides ?? []) for (const entry of slide?.shapes ?? []) if (typeof entry?.id === "string") used.add(entry.id);
  const stem = String(base).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "shape";
  if (!used.has(stem)) return stem;
  for (let n = 2; ; n += 1) if (!used.has(`${stem}-${n}`)) return `${stem}-${n}`;
}

/** The id of the end at `path`, and the patch that gives it one when it has none (`taken`: ids this patch list already adds). */
function endId(presentation, ref, taken) {
  const parts = splitOpfPath(ref);
  const entry = getValueAtPath(presentation, parts);
  if (!isObject(entry)) throw bad(`${ref} is not a block or an overlay shape.`, { path: ref });
  if (isObject(entry.connector)) throw bad("A connector cannot end on another connector.", { path: ref });
  if (typeof entry.id === "string" && entry.id) return { id: entry.id, patches: [] };
  // From the thing's own words ("Review gate" is review-gate), else its preset (wedgeRectCallout is wedge-rect-callout).
  const words = typeof entry.text === "string" ? entry.text : Array.isArray(entry.text) ? entry.text.map((run) => (typeof run === "string" ? run : (run?.text ?? ""))).join("") : "";
  const base = words.trim() ? words.trim().split(/\s+/).slice(0, 3).join(" ") : typeof entry.shape === "string" ? entry.shape.replace(/([a-z])([A-Z])/g, "$1-$2") : parts.at(-2) === "shapes" ? "shape" : "block";
  const id = freeId(presentation, base, taken);
  taken.add(id);
  return { id, patches: [{ op: "add", path: opfPathToJsonPointer([...parts, "id"]), value: id }] };
}

/**
 * Compute the patch that joins two blocks or overlay shapes with a connector (`{ slideIndex, from, to, route?, stroke? }`, `from` and `to` the paths of the two
 * ends, a selection inside one works). An end with no `id` is given one in the same patch. The connector goes on top of the slide's overlays. `route` is `straight`
 * (the default), `elbow` or `curved`; `stroke` takes the usual line keys (`{ end: { type: "triangle" } }` for an arrow). Returns the patch with `path`, the new entry.
 */
export function prepareConnect(presentation, options) {
  const slideIndex = options?.slideIndex;
  const slide = presentation.slides?.[slideIndex];
  if (!Number.isInteger(slideIndex) || !isObject(slide)) throw bad("Say which slide the connector goes on: slideIndex.", { slideIndex });
  const route = options.route ?? "straight";
  if (!CONNECTOR_ROUTES.includes(route)) throw bad(`A connector's route is ${CONNECTOR_ROUTES.join(", ")}.`, { route });
  const owned = (ref) => {
    const parts = splitOpfPath(ref);
    // A selection inside a block or overlay (a block's `.text`, an overlay's `.shape`) names that block or overlay.
    for (let length = parts.length; length >= 2; length -= 1) {
      const value = getValueAtPath(presentation, parts.slice(0, length));
      const at = parts.slice(0, length);
      if (isObject(value) && at[0] === "slides" && Number(at[1]) === slideIndex && ((at.at(-2) === "blocks" && !Array.isArray(value.blocks)) || at.at(-2) === "shapes")) return at.join(".");
    }
    throw bad(`${ref} is not a block or an overlay shape of slide ${slideIndex + 1}.`, { path: ref });
  };
  const fromPath = owned(options.from);
  const toPath = owned(options.to);
  if (fromPath === toPath) throw bad("A connector joins two different things.", { from: fromPath, to: toPath });
  const taken = new Set();
  const from = endId(presentation, fromPath, taken);
  const to = endId(presentation, toPath, taken);
  const existing = Array.isArray(slide.shapes) ? slide.shapes.length : 0;
  const entry = { connector: { from: from.id, to: to.id, ...(route === "straight" ? {} : { route }) }, ...(isObject(options.stroke) || options.stroke === "none" ? { stroke: structuredClone(options.stroke) } : {}) };
  const patches = [...from.patches, ...to.patches];
  patches.push(existing ? { op: "add", path: opfPathToJsonPointer(["slides", String(slideIndex), "shapes", String(existing)]), value: entry } : { op: "add", path: opfPathToJsonPointer(["slides", String(slideIndex), "shapes"]), value: [entry] });
  return { ...prepared(presentation, patches, `slides.${slideIndex}.shapes.${existing}`), from: from.id, to: to.id };
}

/** Join two blocks or overlay shapes with a connector as one undoable step (ends without an `id` get one). The change's `path` is the connector. */
export function connectShapes(editor, options, meta = {}) {
  requireEditor(editor);
  return applyPrepared(editor, prepareConnect(editor.presentation, options), meta, "connector-insert");
}

/**
 * Compute the patch that changes a connector: `route` (`straight`, `elbow`, `curved`), its ends `from` and `to` (paths of a block or an overlay shape, as
 * `connectShapes` takes them; an end with no `id` gets one), and `fromSite` and `toSite` (a connection site index; `null` goes back to choosing the facing
 * sites). Its line is `setShapeProperties(editor, path, { stroke })`.
 */
export function prepareConnectorChange(presentation, path, change) {
  const found = requireOverlay(presentation, path, "connector");
  if (!isObject(change)) throw bad("Pass what to change: { route, from, to, fromSite, toSite }.", { change });
  const parts = splitOpfPath(found.path);
  const connector = { ...found.entry.connector };
  const taken = new Set();
  const patches = [];
  const owned = (ref) => {
    const own = splitOpfPath(ref);
    for (let length = own.length; length >= 2; length -= 1) {
      const at = own.slice(0, length);
      const value = getValueAtPath(presentation, at);
      if (isObject(value) && Number(at[1]) === found.slideIndex && ((at.at(-2) === "blocks" && !Array.isArray(value.blocks)) || (at.at(-2) === "shapes" && !isObject(value.connector)))) return at.join(".");
    }
    throw bad(`${ref} is not a block or an overlay shape of this slide.`, { path: ref });
  };
  for (const key of Object.keys(change)) if (change[key] !== undefined && !["route", "from", "to", "fromSite", "toSite"].includes(key)) throw bad(`Unknown connector key: ${key}.`, { key });
  if (change.route !== undefined) {
    if (change.route !== null && !CONNECTOR_ROUTES.includes(change.route)) throw bad(`A connector's route is ${CONNECTOR_ROUTES.join(", ")}.`, { route: change.route });
    if (change.route === null || change.route === "straight") delete connector.route;
    else connector.route = change.route;
  }
  for (const [key, ref] of [["from", change.from], ["to", change.to]]) {
    if (ref === undefined) continue;
    const end = endId(presentation, owned(ref), taken);
    patches.push(...end.patches);
    connector[key] = end.id;
  }
  if (connector.from === connector.to) throw bad("A connector joins two different things.", {});
  for (const key of ["fromSite", "toSite"]) {
    if (change[key] === undefined) continue;
    if (change[key] === null) delete connector[key];
    else if (!Number.isInteger(change[key]) || change[key] < 0) throw bad(`${key} is a connection site number from 0.`, { key, value: change[key] });
    else connector[key] = change[key];
  }
  if (!same(found.entry.connector, connector)) patches.push({ op: "replace", path: opfPathToJsonPointer([...parts, "connector"]), value: connector });
  return prepared(presentation, patches, found.path);
}

/** Change a connector's route, ends or sites as one undoable step. */
export function setConnector(editor, path, change, meta = {}) {
  requireEditor(editor);
  return applyPrepared(editor, prepareConnectorChange(editor.presentation, path, change), meta, "connector-change");
}
