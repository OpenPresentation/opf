// Shape blocks (SH-06, OPF 0.34): insert a shape, change its preset, drag its adjust handles and edit every property of it (fill, stroke, style,
// effects, rotation, text, accessibility), each one validated JSON Patch applied as one undoable step through the session (`editor.applyPatch`),
// so Undo, Redo, proposals and every host subscription work as for any other edit. The `prepare...` form of each returns the patch without
// touching a session. The catalog (gallery groups, Aspose names, search) is core's `@openpresentation/opf/shape-catalog`; the geometry that pins an
// adjust value to its handle's range loads on demand (`loadShapeEngine`): until it has loaded a value is only checked as a number and by the
// validator. Plain JS with no DOM and no Node imports, so it runs in a browser, a Worker or Node.
import { SHAPE_PRESETS, isShapeBlock, presetAspect } from "@openpresentation/opf/composition";
import { SHAPE_CATALOG, SHAPE_CATEGORIES, searchShapeCatalog, shapeCatalogEntry, shapesInCategory } from "@openpresentation/opf/shape-catalog";
import { getValueAtPath, opfPathToJsonPointer, splitOpfPath } from "./index.js";
import { checkedDocument, fail, same } from "./edit-helpers.js";
import { checkFormat } from "./checks.js";
import { prepareBlockInsert } from "./blocks.js";
import { loadShapeEngine, shapeEngine } from "./shape-engine.js";

export { SHAPE_CATALOG, SHAPE_CATEGORIES, loadShapeEngine, shapeEngine };

const INDEX = /^(0|[1-9][0-9]*)$/;
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const bad = (message, details) => fail("invalid-shape", message, details);

/** The keys of a shape block this module edits: the preset and its adjust values, the fill, the line, the theme style, the effects, the transform, the text and the accessibility keys. */
export const SHAPE_PROPERTY_KEYS = Object.freeze([
  "shape", "adjust", "aspectRatio", "fill", "opacity", "stroke", "style", "shadow", "innerShadow", "glow", "softEdge", "reflection", "blur",
  "rotate", "flip", "text", "anchor", "padding", "textDirection", "alt", "decorative", "hidden", "link",
]);

// --- the catalog ------------------------------------------------------------------------------------------------------------------

/** The presets matching `query` (DrawingML name, Aspose name, common words), best first; an empty query lists the gallery in order. `{ category, limit }` narrow it. */
export function searchShapes(query = "", options = {}) {
  return searchShapeCatalog(query, options).map((result) => result.entry);
}

/** PowerPoint's gallery groups, each `{ id, title, shapes }` with its presets in gallery order. */
export function shapeGroups() {
  return SHAPE_CATEGORIES.map((category) => ({ id: category.id, title: category.title, shapes: shapesInCategory(category.id) }));
}

/** A readable label for a preset: `rightArrowCallout` is "Right Arrow Callout". */
export function shapeLabel(name) {
  return String(name).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Za-z])([0-9])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

/** Up to three presets nearest to a typed name: those the search finds, then those within a few edits. */
function nearestPresets(typed) {
  const target = typed.toLowerCase();
  const found = searchShapeCatalog(typed, { limit: 3 }).map((result) => result.entry.name);
  if (found.length) return found;
  const distance = (a, b) => {
    let previous = Array.from({ length: b.length + 1 }, (_, at) => at);
    for (let i = 1; i <= a.length; i += 1) {
      const row = [i];
      for (let j = 1; j <= b.length; j += 1) row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = row;
    }
    return previous[b.length];
  };
  return SHAPE_PRESETS.map((name) => [name, distance(target, name.toLowerCase())]).filter(([, d]) => d <= Math.max(2, Math.floor(target.length / 4))).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([name]) => name);
}

function requirePreset(name) {
  if (typeof name !== "string" || !SHAPE_PRESETS.includes(name)) {
    const near = typeof name === "string" && name ? nearestPresets(name) : [];
    throw bad(`${JSON.stringify(name)} is not a preset shape.${near.length ? ` Did you mean ${near.join(", ")}?` : ""} Search them with searchShapes (or the MCP's search_shapes).`, { shape: name, nearest: near });
  }
  return name;
}

// --- finding the shape block -------------------------------------------------------------------------------------------------------

/**
 * The shape block a selection is in, as its path: `slides.0.blocks.1.shape` and `slides.0.blocks.1.text` give `slides.0.blocks.1`; a slide or
 * region that holds a shape inline is the block only when the selection is its `shape` or `path`. Undefined for anything else.
 */
export function shapeBlockPathForSelection(presentation, selectedPath) {
  let parts;
  try {
    parts = splitOpfPath(selectedPath);
  } catch {
    return undefined;
  }
  if (parts[0] !== "slides") return undefined;
  for (let length = parts.length; length >= 2; length -= 1) {
    const at = parts.slice(0, length);
    const value = getValueAtPath(presentation, at);
    if (!isObject(value) || !isShapeBlock(value)) continue;
    const explicit = at.at(-2) === "blocks" && INDEX.test(at.at(-1) ?? "");
    if (explicit || parts[length] === "shape" || parts[length] === "path") return at.join(".");
  }
  return undefined;
}

/**
 * The shape block at `path` (a selection inside it works): `{ path, explicit, preset, custom, block }`. `preset` is the DrawingML name (undefined for a
 * custom `path`), `custom` is true for an outline of the author's own, `explicit` is false for a slide or region that holds the shape inline.
 * Undefined when the path is no shape block.
 */
export function readShape(presentation, path) {
  const found = shapeBlockPathForSelection(presentation, path);
  if (!found) return undefined;
  const parts = splitOpfPath(found);
  const block = getValueAtPath(presentation, parts);
  return {
    path: found,
    explicit: parts.at(-2) === "blocks" && INDEX.test(parts.at(-1) ?? ""),
    preset: typeof block.shape === "string" ? block.shape : undefined,
    custom: block.shape === undefined && block.path !== undefined,
    block: structuredClone(block),
  };
}

function requireShape(presentation, path) {
  const found = readShape(presentation, path);
  if (!found) throw fail("not-a-shape-block", "Choose a shape block: these settings edit a shape.", { path });
  return found;
}

// --- normalizing values --------------------------------------------------------------------------------------------------------------

/** A copy without `undefined` and `null` members, recursively; an empty object stays (the caller decides what empty means). */
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (isObject(value)) return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null).map(([key, entry]) => [key, clean(entry)]));
  return value;
}

const rounded = (value, places) => Math.round(value * 10 ** places) / 10 ** places;

/** The value to write for a key, or `null` when the value means "remove the key". Throws `invalid-shape` for a value that cannot be written. */
function normalize(key, value) {
  switch (key) {
    case "shape":
      return requirePreset(value);
    case "adjust":
      return clean(value);
    case "text":
      if (typeof value === "string") return value === "" ? null : value;
      return clean(value);
    case "alt":
    case "link":
      if (typeof value !== "string") throw bad(`${key} is text.`, { key, value });
      return value.trim() === "" ? null : value.trim();
    case "decorative":
    case "hidden":
      if (typeof value !== "boolean") throw bad(`${key} is true or false.`, { key, value });
      return value ? true : null;
    case "rotate": {
      const turn = Number(value);
      if (!Number.isFinite(turn)) throw bad("Rotation is a number of degrees.", { key, value });
      const wrapped = turn % 360 === 0 ? 0 : turn > 360 || turn < -360 ? turn % 360 : turn;
      return wrapped === 0 ? null : rounded(wrapped, 2);
    }
    case "flip":
      return value === "" ? null : value;
    case "softEdge":
    case "blur": {
      const radius = Number(value);
      if (!Number.isFinite(radius)) throw bad(`${key} is a radius in reference pixels.`, { key, value });
      return radius === 0 ? null : radius;
    }
    default:
      return clean(value);
  }
}

/** A shape's default frame in a 100-unit box (for range checks without a layout): the block's `aspectRatio`, else the preset's. */
function defaultFrame(block, preset) {
  const aspect = Number(block.aspectRatio) > 0 ? Number(block.aspectRatio) : presetAspect(preset);
  return { width: 100 * aspect, height: 100 };
}

/**
 * The adjust values to write for `adjust` merged over a block's own: names the preset has, finite numbers, pinned to each handle's range at
 * the frame (`size`, else the default frame) once the geometry is loaded (`loadShapeEngine`). `null` removes a value (the preset's default
 * is drawn). Rounded to 4 places (fractions) and 2 (degrees). Returns `{ adjust, pinned }`; `adjust` is undefined when nothing is left.
 */
function mergeAdjust(block, preset, adjust, size) {
  if (!isObject(adjust)) throw bad("Adjust values are { name: number }, for example { adj1: 0.4 }.", { adjust });
  if (typeof preset !== "string") throw bad("Only a preset shape has adjust values; a custom path has none.", { adjust });
  const engine = shapeEngine();
  const frame = size ?? defaultFrame(block, preset);
  const known = engine ? engine.presetAdjustments(preset, frame.width, frame.height) : undefined;
  const next = isObject(block.adjust) ? { ...block.adjust } : {};
  const pinned = [];
  for (const [name, raw] of Object.entries(adjust)) {
    if (raw === null || raw === undefined) {
      delete next[name];
      continue;
    }
    let value = Number(raw);
    if (typeof raw === "boolean" || !Number.isFinite(value)) throw bad(`Adjust value ${name} is a number.`, { name, value: raw });
    if (known) {
      const spec = known[name];
      if (!spec) throw fail("shape-adjust-unknown", `${preset} has no adjust value '${name}'; it has ${Object.keys(known).join(", ") || "none"}.`, { name, shape: preset, known: Object.keys(known) });
      // The handle's range, widened to hold the preset's default (star24, star32 and mathDivide report one that leaves it out).
      const low = spec.min === null ? -Infinity : Math.min(spec.min, spec.default);
      const high = spec.max === null ? Infinity : Math.max(spec.max, spec.default);
      const pin = Math.min(high, Math.max(low, value));
      if (pin !== value) pinned.push(name);
      // Rounding must not step outside the range it was pinned to.
      value = Math.min(high, Math.max(low, rounded(pin, spec.unit === "degrees" ? 2 : 4)));
    } else value = rounded(value, 4);
    next[name] = value;
  }
  return { adjust: Object.keys(next).length ? next : undefined, pinned };
}

/** What changing the preset keeps of the adjust values: the names the new preset has (with the geometry loaded), else none. */
function adjustAfterPreset(block, preset) {
  if (!isObject(block.adjust)) return undefined;
  const engine = shapeEngine();
  if (!engine || typeof block.shape !== "string") return undefined;
  const frame = defaultFrame(block, preset);
  const known = engine.presetAdjustments(preset, frame.width, frame.height);
  const kept = Object.fromEntries(Object.entries(block.adjust).filter(([name, value]) => {
    const spec = known[name];
    return spec && (spec.min === null || value >= spec.min) && (spec.max === null || value <= spec.max);
  }));
  return Object.keys(kept).length ? kept : undefined;
}

// --- one change -------------------------------------------------------------------------------------------------------------------

/** The patches that set (a value) or remove (`null`) keys of the shape block at `path`. */
export function shapePropertyPatches(presentation, path, fields, options = {}) {
  if (!isObject(fields)) throw bad("Pass the shape settings to change, for example { fill: \"accent2\" }.", { fields });
  const found = requireShape(presentation, path);
  const parts = splitOpfPath(found.path);
  const block = found.block;
  const patches = [];
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  for (const [key] of entries) if (!SHAPE_PROPERTY_KEYS.includes(key)) throw bad(`Unknown shape setting: ${key}. Use ${SHAPE_PROPERTY_KEYS.join(", ")}.`, { key });
  const staged = { ...block };
  const write = (key, value) => {
    const at = opfPathToJsonPointer([...parts, key]);
    if (value === null || value === undefined) {
      if (staged[key] !== undefined) patches.push({ op: "remove", path: at });
      delete staged[key];
    } else if (staged[key] === undefined) {
      patches.push({ op: "add", path: at, value: structuredClone(value) });
      staged[key] = value;
    } else if (!same(staged[key], value)) {
      patches.push({ op: "replace", path: at, value: structuredClone(value) });
      staged[key] = value;
    }
  };
  for (const [key, raw] of entries) {
    if (key === "text" && !found.explicit && raw !== null)
      throw fail("shape-text-needs-block", "This shape sits directly in its slide or region, so text there would be a second block. Add the shape as a block of the slide to give it text.", { path: found.path });
    if (key === "adjust") {
      if (raw === null) write("adjust", null);
      else write("adjust", mergeAdjust(staged, found.preset, raw, options.size).adjust ?? null);
      continue;
    }
    if (key === "shape" && raw !== null) {
      const preset = requirePreset(raw);
      write("shape", preset);
      if (!("adjust" in fields)) write("adjust", adjustAfterPreset(block, preset) ?? null);
      continue;
    }
    if (key === "shape") throw bad("A shape block always has a preset; choose one with searchShapes.", { key });
    write(key, raw === null ? null : normalize(key, raw));
  }
  return patches;
}

/** Compute the patch for `setShapeProperties` without touching a session: `{ presentation, patches, changed, path }`. */
export function prepareShapeProperties(presentation, path, fields, options = {}) {
  const found = requireShape(presentation, path);
  const before = checkFormat(presentation);
  const patches = shapePropertyPatches(presentation, found.path, fields, options);
  const next = checkedDocument(presentation, patches, before);
  return { presentation: structuredClone(next), patches, changed: patches.length > 0, path: found.path };
}

function requireEditor(editor) {
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
}

function applyPrepared(editor, prepared, meta, source) {
  const { presentation, patches, ...summary } = prepared;
  void presentation;
  if (!prepared.changed) return { ...summary, presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(patches, { ...meta, source: meta.source ?? source, path: prepared.path });
  return { ...change, ...summary };
}

/**
 * Set or remove (`null`) keys of one shape block as a single undoable step:
 * `setShapeProperties(editor, "slides.1.blocks.0", { fill: { gradient: { type: "linear", angle: 45, stops: [...] } }, shadow: "soft", rotate: 15 })`.
 * Empty values remove their key (empty text, `false`, rotation 0, an empty effect), so the file stays small. Throws `not-a-shape-block`,
 * `invalid-shape` (an unknown key, a name that is not a preset, a value of the wrong kind), `shape-adjust-unknown` and `invalid-opf-edit`
 * (the schema's message) when the result would not be valid OPF; nothing changes then.
 */
export function setShapeProperties(editor, path, fields, meta = {}) {
  requireEditor(editor);
  return applyPrepared(editor, prepareShapeProperties(editor.presentation, path, fields, { size: meta.size }), meta, "shape-properties");
}

/** Change the preset of a shape block. The adjust values the new preset also has (and that fit its handles) are kept; the others are dropped. One undoable step. */
export function setShapePreset(editor, path, preset, meta = {}) {
  return setShapeProperties(editor, path, { shape: preset }, { ...meta, source: meta.source ?? "shape-preset" });
}

/**
 * Set the adjust values (the yellow handles) of a shape block: `{ adj1: 0.4 }` merges over the block's own, `null` removes one (the preset's default
 * is drawn). Values are fractions and degrees, pinned to each handle's range at the shape's frame (`meta.size`: `{ width, height }` in any one unit; else
 * the block's default frame; load the geometry first, `await loadShapeEngine()`, or the range is only the validator's to report). One undoable step.
 */
export function setShapeAdjust(editor, path, adjust, meta = {}) {
  requireEditor(editor);
  const prepared = prepareShapeProperties(editor.presentation, path, { adjust }, { size: meta.size });
  return applyPrepared(editor, prepared, meta, "shape-adjust");
}

/** The adjust values of a shape block at a size: each handle value's current value (the block's, else the preset's default), range and unit. Needs the geometry (`loadShapeEngine`); undefined before. */
export function readShapeAdjust(presentation, path, size) {
  const found = readShape(presentation, path);
  const engine = shapeEngine();
  if (!found?.preset || !engine) return undefined;
  const frame = size ?? defaultFrame(found.block, found.preset);
  const known = engine.presetAdjustments(found.preset, frame.width, frame.height);
  return Object.fromEntries(Object.entries(known).map(([name, spec]) => [name, { ...spec, value: typeof found.block.adjust?.[name] === "number" ? found.block.adjust[name] : spec.default, set: found.block.adjust?.[name] !== undefined }]));
}

// --- inserting -------------------------------------------------------------------------------------------------------------------------

/** Compute the patch that inserts a shape block (`{ shape, ...block }`) into a slide, group or region: `{ presentation, patches, path, changed }` with `path` the new block. */
export function prepareShapeInsert(presentation, options) {
  const preset = requirePreset(options?.shape);
  const container = options.containerPath ?? (Number.isInteger(options.slideIndex) ? `slides.${options.slideIndex}` : undefined);
  if (container === undefined) throw bad("Say where the shape goes: a slideIndex or a containerPath.", { options });
  const block = { shape: preset, ...(isObject(options.block) ? clean(options.block) : {}) };
  const prepared = prepareBlockInsert(presentation, container, block, options.index);
  return { ...prepared, path: splitOpfPath(prepared.path).join("."), shape: preset };
}

/**
 * Insert a shape block as one undoable step: `insertShape(editor, { slideIndex: 0, shape: "chevron" })` adds it at the end of the slide's blocks (a
 * slide that holds its content inline becomes blocks first, in the same step). `containerPath` and `index` place it in a group or region or before another
 * block; `block` adds keys (`{ text: "Plan", fill: "accent2" }`). Returns the change with `path`, the new block.
 */
export function insertShape(editor, options, meta = {}) {
  requireEditor(editor);
  const prepared = prepareShapeInsert(editor.presentation, options);
  const { presentation, patches, ...summary } = prepared;
  void presentation;
  const change = editor.applyPatch(patches, { ...meta, source: meta.source ?? "shape-insert", path: prepared.path });
  return { ...change, ...summary };
}

export { shapeCatalogEntry };
