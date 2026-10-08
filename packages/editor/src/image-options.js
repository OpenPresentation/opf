// Image blocks (FA-22/FA-23, OPF 0.15): every content picture is an image block, and its framing lives on the block: fit and
// focus, the treatments (shape, corner radius, border, opacity, recolor, overlay, aspect ratio) and placement (bleed to one slide
// edge, the only thing that moves content aside). Each change is one validated JSON Patch applied as one undoable transaction;
// the `prepare…` form returns the patch without touching a session. `design.imageFit` (a design option) is the deck or slide
// default fit.
import { getValueAtPath, opfPathToJsonPointer, splitOpfPath } from "./index.js";
import { checkedDocument, fail, same } from "./edit-helpers.js";
import { checkFormat } from "./checks.js";
import { isAuthoringColorRef } from "./color-authoring.js";

export const IMAGE_FITS = Object.freeze(["cover", "contain", "stretch"]);
export const IMAGE_SHAPES = Object.freeze(["rectangle", "rounded", "circle", "hexagon"]);
export const IMAGE_EDGES = Object.freeze(["left", "right", "top", "bottom"]);
/** The fields an image block carries besides its `image`, in schema order. */
export const IMAGE_TREATMENT_FIELDS = Object.freeze(["fit", "focus", "aspectRatio", "shape", "cornerRadius", "border", "opacity", "recolor", "overlay", "placement"]);

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const bad = (message, details) => fail("invalid-image-treatment", message, details);
const fraction = (value, min = 0, max = 1) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const colorRef = (value, what) => {
  if (typeof value !== "string" || !value.trim() || !isAuthoringColorRef(value)) throw bad(`${what} must be a hex color such as #1F2937, a scheme color such as accent1 or surface, or var:<id>.`, { value });
  return value.trim();
};

/** A focus point `{ x, y }`, each 0 (left/top) to 1 (right/bottom). */
export function normalizeFocus(value) {
  if (!isObject(value) || !fraction(Number(value.x)) || !fraction(Number(value.y))) throw bad("A focus point is { x, y }, each from 0 (left or top) to 1 (right or bottom).", { value });
  return { x: Number(value.x), y: Number(value.y) };
}

/**
 * An overlay `{ color, opacity, edge?, size? }`, shared by image backgrounds and image blocks: a scrim over the whole picture, or a
 * band along one edge (`size` 0.05 to 1, default 0.3). `color` is any ColorRef, theme roles included.
 */
export function normalizeOverlay(value) {
  if (!isObject(value)) throw bad("An overlay is { color, opacity }, with an optional edge and size for a band.", { value });
  const out = { color: colorRef(value.color, "The overlay color"), opacity: Number(value.opacity) };
  if (value.opacity === undefined || value.opacity === "" || !fraction(out.opacity)) throw bad("The overlay opacity is a number from 0 to 1.", { value });
  if (value.edge !== undefined && value.edge !== null && value.edge !== "") {
    if (!IMAGE_EDGES.includes(value.edge)) throw bad(`An overlay band runs along one edge: ${IMAGE_EDGES.join(", ")}.`, { value });
    out.edge = value.edge;
    if (value.size !== undefined && value.size !== null && value.size !== "") {
      const size = Number(value.size);
      if (!fraction(size, 0.05, 1)) throw bad("The overlay band size is a share of the picture from 0.05 to 1.", { value });
      out.size = size;
    }
  }
  return out;
}

/** A recolor: `"grayscale"` or a duotone `{ dark, light }` (ColorRefs), shared by image backgrounds and image blocks. */
export function normalizeRecolor(value) {
  if (value === "grayscale") return value;
  if (isObject(value)) return { dark: colorRef(value.dark, "The duotone dark color"), light: colorRef(value.light, "The duotone light color") };
  throw bad('Recolor is "grayscale" or a duotone { dark, light }.', { field: "recolor", value });
}

/** A placement `{ edge, size?, inset? }`: the block bleeds to that slide edge and takes `size` (0.1 to 0.9, default 0.5) of the slide. */
export function normalizePlacement(value) {
  if (!isObject(value) || !IMAGE_EDGES.includes(value.edge)) throw bad(`A placement names the slide edge the image bleeds to: ${IMAGE_EDGES.join(", ")}.`, { value });
  const out = { edge: value.edge };
  if (value.size !== undefined && value.size !== null && value.size !== "") {
    const size = Number(value.size);
    if (!fraction(size, 0.1, 0.9)) throw bad("The placed image's share of the slide is from 0.1 to 0.9.", { value });
    out.size = size;
  }
  if (value.inset === true) out.inset = true;
  return out;
}

function normalizeField(key, value) {
  switch (key) {
    case "fit":
      if (!IMAGE_FITS.includes(value)) throw bad(`Image fit is one of ${IMAGE_FITS.join(", ")}.`, { field: key, value });
      return value;
    case "focus":
      return normalizeFocus(value);
    case "aspectRatio": {
      const ratio = Number(value);
      if (!(Number.isFinite(ratio) && ratio > 0 && ratio <= 10)) throw bad("The frame's aspect ratio is a width-to-height number above 0 and up to 10, for example 1.78.", { field: key, value });
      return ratio;
    }
    case "shape":
      if (!IMAGE_SHAPES.includes(value)) throw bad(`Image shape is one of ${IMAGE_SHAPES.join(", ")}.`, { field: key, value });
      return value;
    case "cornerRadius": {
      const radius = Number(value);
      if (!fraction(radius, 0, 0.5)) throw bad("The corner radius is a share of the frame's shorter side from 0 to 0.5.", { field: key, value });
      return radius;
    }
    case "border": {
      if (!isObject(value)) throw bad("A border is { color, width }.", { field: key, value });
      const width = Number(value.width);
      if (!fraction(width, 0, 64)) throw bad("The border width is from 0 to 64 reference pixels.", { field: key, value });
      return { color: colorRef(value.color, "The border color"), width };
    }
    case "opacity": {
      const opacity = Number(value);
      if (!fraction(opacity)) throw bad("Image opacity is a number from 0 to 1.", { field: key, value });
      return opacity;
    }
    case "recolor":
      return normalizeRecolor(value);
    case "overlay":
      return normalizeOverlay(value);
    case "placement":
      return normalizePlacement(value);
    default:
      throw bad(`Unknown image treatment: ${key}. Use ${IMAGE_TREATMENT_FIELDS.join(", ")}.`, { field: key });
  }
}

/** The payload that holds the picture at `blockPath` (a block, a region payload or the slide itself for `Slide.image`). */
function imagePayload(presentation, blockPath) {
  const parts = splitOpfPath(blockPath);
  if (parts[0] === "slides" && parts.at(-1) === "image") parts.pop();
  if (parts[0] !== "slides" || !presentation.slides?.[Number(parts[1])]) throw fail("not-an-image-block", "Choose an image block on a slide.", { path: blockPath });
  // The slide's own `image` (Slide.image) takes no framing fields: the slide object is not an image block.
  if (parts.length === 2) throw fail("not-an-image-block", "The slide's own image takes no fit, treatments or placement. Make it an image block (in blocks) to frame it.", { path: blockPath });
  const payload = getValueAtPath(presentation, parts);
  if (!isObject(payload) || payload.image === undefined) throw fail("not-an-image-block", "Choose an image block: these settings frame a picture.", { path: blockPath });
  return { parts, payload };
}

// Only a top-level block (slides.N.blocks.I) may be placed (core's image-placement-invalid rule; the slide's own image cannot).
const placeable = (parts) => parts.length === 4 && parts[2] === "blocks";

/** Edges already taken by another placed top-level block of the slide. */
function usedEdges(presentation, parts) {
  const slide = presentation.slides[Number(parts[1])];
  const self = parts.length === 4 ? Number(parts[3]) : -1;
  const edges = new Set();
  for (const [index, block] of (Array.isArray(slide?.blocks) ? slide.blocks : []).entries()) if (index !== self && isObject(block?.placement)) edges.add(block.placement.edge);
  return edges;
}

/**
 * The image block's framing as a form shows it: `{ path, fit, focus, aspectRatio, shape, cornerRadius, border, opacity, recolor,
 * overlay, placement, placeable, usedEdges }`. Fields the block does not set are undefined (the effective fit is then
 * `design.imageFit`, else cover).
 */
export function readImageTreatments(presentation, blockPath) {
  const { parts, payload } = imagePayload(presentation, blockPath);
  const out = { path: parts.join(".") };
  for (const key of IMAGE_TREATMENT_FIELDS) out[key] = payload[key] === undefined ? undefined : structuredClone(payload[key]);
  out.placeable = placeable(parts);
  out.usedEdges = [...usedEdges(presentation, parts)];
  return out;
}

/** The patches that set (a value) or remove (`null`) treatment fields of the image block at `blockPath`. */
export function imageTreatmentPatches(presentation, blockPath, fields) {
  if (!isObject(fields)) throw bad("Pass the image settings to change, for example { fit: \"contain\" }.", { fields });
  const { parts, payload } = imagePayload(presentation, blockPath);
  const patches = [];
  for (const [key, raw] of Object.entries(fields)) {
    if (raw === undefined) continue;
    const at = opfPathToJsonPointer([...parts, key]);
    if (raw === null) {
      if (payload[key] !== undefined) patches.push({ op: "remove", path: at });
      continue;
    }
    const value = normalizeField(key, raw);
    if (key === "placement") {
      if (!placeable(parts)) throw fail("placement-not-top-level", "Only an image block directly in the slide's blocks can bleed to an edge, not one inside a group or region or the slide's own image.", { path: blockPath });
      if (usedEdges(presentation, parts).has(value.edge)) throw fail("placement-edge-taken", `Another image already bleeds to the ${value.edge} edge of this slide. Choose another edge or move that image first.`, { path: blockPath, edge: value.edge });
    }
    if (payload[key] === undefined) patches.push({ op: "add", path: at, value });
    else if (!same(payload[key], value)) patches.push({ op: "replace", path: at, value });
  }
  return patches;
}

/** Compute the patch for `setImageTreatment` without touching a session: `{ presentation, patches, changed, path, slideIndex }`. */
export function prepareImageTreatment(presentation, blockPath, fields) {
  const before = checkFormat(presentation);
  const patches = imageTreatmentPatches(presentation, blockPath, fields);
  const next = checkedDocument(presentation, patches, before);
  const parts = splitOpfPath(blockPath);
  return { presentation: structuredClone(next), patches, changed: patches.length > 0, path: parts.join("."), slideIndex: Number(parts[1]) };
}

/**
 * Set or remove (`null`) treatment fields of one image block as a single undoable transaction:
 * `setImageTreatment(editor, "slides.1.blocks.0", { fit: "contain", placement: { edge: "right", size: 0.45 } })`.
 */
export function setImageTreatment(editor, blockPath, fields, meta = {}) {
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  const prepared = prepareImageTreatment(editor.presentation, blockPath, fields);
  const { presentation, patches, ...summary } = prepared;
  void presentation;
  if (!prepared.changed) return { ...summary, presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(patches, { ...meta, source: meta.source ?? "image-treatment", path: prepared.path });
  return { ...change, ...summary };
}
