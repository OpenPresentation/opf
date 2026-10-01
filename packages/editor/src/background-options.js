// Backgrounds (RR-06): every background form the schema has, with validation that explains itself.
// A background is a theme slot, a solid color, a linear gradient, an image or a pattern, at the deck
// or on one slide. `setBackground` is one undoable patch through the `backgrounds` switch, so the
// preview, export and Undo behave like every other dimension.
import { prepareDimensionSwitch, switchDimension } from "./switches.js";
import { fail } from "./edit-helpers.js";

export const BACKGROUND_TYPES = Object.freeze(["theme", "solid", "gradient", "image", "pattern"]);
export const THEME_BACKGROUND_SLOTS = Object.freeze(["light1", "light2", "dark1", "dark2"]);
export const IMAGE_BACKGROUND_FITS = Object.freeze(["cover", "contain", "tile"]);
/** Scheme slots and roles a ColorRef may name (the schema's ColorRef enum), besides hex colors and `var:<id>`. */
export const COLOR_NAMES = Object.freeze([
  "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "dark1", "dark2", "light1", "light2", "hyperlink", "followedHyperlink",
  "primary", "secondary", "accent", "background", "surface", "text", "textSecondary",
]);
/**
 * The 54 DrawingML preset patterns (ECMA-376 ST_PresetPatternVal) by family. PPTX export writes them as
 * native pattern fills; the schema also allows engine-defined ids, which `setBackground` accepts as text.
 */
export const PATTERN_GROUPS = Object.freeze({
  Percent: ["pct5", "pct10", "pct20", "pct25", "pct30", "pct40", "pct50", "pct60", "pct70", "pct75", "pct80", "pct90"],
  "Horizontal and vertical": ["horz", "vert", "ltHorz", "ltVert", "dkHorz", "dkVert", "narHorz", "narVert", "dashHorz", "dashVert", "cross"],
  Diagonal: ["dnDiag", "upDiag", "ltDnDiag", "ltUpDiag", "dkDnDiag", "dkUpDiag", "wdDnDiag", "wdUpDiag", "dashDnDiag", "dashUpDiag", "diagCross"],
  "Checks, grids and bricks": ["smCheck", "lgCheck", "smGrid", "lgGrid", "dotGrid", "smConfetti", "lgConfetti", "horzBrick", "diagBrick"],
  "Shapes and textures": ["solidDmnd", "openDmnd", "dotDmnd", "plaid", "sphere", "weave", "divot", "shingle", "wave", "trellis", "zigZag"],
});
export const PATTERN_PRESETS = Object.freeze(Object.values(PATTERN_GROUPS).flat());

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Whether `value` is a ColorRef: a hex color, a scheme slot or role name, or `var:<id>`. */
export function isColorRef(value) {
  return typeof value === "string" && (HEX.test(value) || COLOR_NAMES.includes(value) || /^var:[a-z][a-z0-9-]*$/.test(value));
}

function colorRef(value, what) {
  if (!isColorRef(value)) throw fail("invalid-background", `${what} must be a hex color such as #1F2937, a scheme color such as accent1 or surface, or var:<id>.`, { value });
  return typeof value === "string" && HEX.test(value) ? value.toUpperCase() : value;
}

function opacityOf(spec) {
  if (spec.opacity === undefined || spec.opacity === null) return undefined;
  if (typeof spec.opacity !== "number" || !(spec.opacity >= 0 && spec.opacity <= 1)) throw fail("invalid-background", "Background opacity is a number from 0 to 1.", { opacity: spec.opacity });
  return spec.opacity;
}

/**
 * Validate a background description and return the value to store: a theme slot or a plain hex color stays
 * the shorthand string; everything else is the object form. Throws `invalid-background` with a sentence a
 * person can act on. Gradient stops are sorted by position (at least two); radial gradients are not part
 * of the schema.
 */
export function normalizeBackground(spec) {
  if (typeof spec === "string") {
    if (THEME_BACKGROUND_SLOTS.includes(spec)) return spec;
    if (HEX.test(spec)) return spec.toUpperCase();
    throw fail("invalid-background", `A background shorthand is a theme slot (${THEME_BACKGROUND_SLOTS.join(", ")}) or a hex color.`, { spec });
  }
  if (!isObject(spec)) throw fail("invalid-background", "Describe the background as { type, ... } or a theme slot / hex shorthand.", { spec });
  const opacity = opacityOf(spec);
  const withOpacity = (value) => (opacity === undefined ? value : { ...value, opacity });
  switch (spec.type) {
    case "theme":
      if (!THEME_BACKGROUND_SLOTS.includes(spec.slot)) throw fail("invalid-background", `A theme background names a slot: ${THEME_BACKGROUND_SLOTS.join(", ")}.`, { spec });
      return spec.slot;
    case "solid": {
      const color = colorRef(spec.color, "A solid background color");
      return opacity === undefined && HEX.test(color) ? color : withOpacity({ type: "solid", color });
    }
    case "gradient": {
      const gradient = spec.gradient;
      if (!isObject(gradient) || !Array.isArray(gradient.stops) || gradient.stops.length < 2) throw fail("invalid-background", "A gradient needs at least two color stops.", { spec });
      const stops = gradient.stops.map((stop, index) => {
        if (!isObject(stop)) throw fail("invalid-background", `Stop ${index + 1} needs a color and a position.`, { spec });
        const position = typeof stop.position === "string" && stop.position.trim() !== "" ? Number(stop.position) : stop.position;
        if (typeof position !== "number" || !(position >= 0 && position <= 1)) throw fail("invalid-background", `Stop ${index + 1}: the position is a number from 0 (start) to 1 (end).`, { spec });
        return { color: colorRef(stop.color, `Stop ${index + 1}: the color`), position };
      });
      stops.sort((a, b) => a.position - b.position);
      const angle = gradient.angle === undefined || gradient.angle === null || gradient.angle === "" ? undefined : Number(gradient.angle);
      if (angle !== undefined && !Number.isFinite(angle)) throw fail("invalid-background", "The gradient angle is a number of degrees (0 is left to right, 90 top to bottom).", { spec });
      return withOpacity({ type: "gradient", gradient: { ...(angle === undefined ? {} : { angle }), stops } });
    }
    case "image": {
      const image = spec.image;
      if (!isObject(image) || typeof image.src !== "string" || !image.src.trim()) throw fail("invalid-background", "An image background needs an image: choose a file or enter a source.", { spec });
      if (image.fit !== undefined && image.fit !== "" && !IMAGE_BACKGROUND_FITS.includes(image.fit)) throw fail("invalid-background", `Image fit is one of ${IMAGE_BACKGROUND_FITS.join(", ")}.`, { spec });
      return withOpacity({ type: "image", image: { src: image.src.trim(), ...(image.fit ? { fit: image.fit } : {}) } });
    }
    case "pattern": {
      const pattern = spec.pattern;
      if (!isObject(pattern) || typeof pattern.preset !== "string" || !pattern.preset.trim()) throw fail("invalid-background", "A pattern background needs a preset.", { spec });
      const out = { preset: pattern.preset.trim() };
      if (pattern.foregroundColor) out.foregroundColor = colorRef(pattern.foregroundColor, "The pattern foreground color");
      if (pattern.backgroundColor) out.backgroundColor = colorRef(pattern.backgroundColor, "The pattern background color");
      return withOpacity({ type: "pattern", pattern: out });
    }
    default:
      throw fail("invalid-background", `Background type is one of ${BACKGROUND_TYPES.join(", ")}.`, { spec });
  }
}

/** Compute the patch that sets (or, for `null`, removes) the background, without touching a session. Options as `prepareDimensionSwitch` (`slideIndex`, `clearSlideOverrides`). */
export function prepareBackground(document, spec, options = {}) {
  return prepareDimensionSwitch(document, "backgrounds", spec === null ? null : normalizeBackground(spec), options);
}

/** Set the background as one undoable transaction; `null` removes it so the theme's (or the deck's) shows again. */
export function setBackground(editor, spec, options = {}) {
  return switchDimension(editor, "backgrounds", spec === null ? null : normalizeBackground(spec), options);
}

/**
 * The background that applies at a scope as a flat description for a form:
 * `{ type, slot?, color?, opacity?, angle?, stops?, src?, fit?, preset?, foregroundColor?, backgroundColor?, scope, value }`.
 * `type` is undefined when nothing is set; `scope` is "slide" when the slide sets its own, else "deck".
 */
export function readBackground(document, { slideIndex } = {}) {
  const own = slideIndex === undefined ? undefined : document.slides?.[slideIndex]?.design?.background;
  const value = own !== undefined ? own : document.design?.background;
  const scope = own !== undefined ? "slide" : "deck";
  if (value === undefined) return { scope };
  if (typeof value === "string") return THEME_BACKGROUND_SLOTS.includes(value) ? { type: "theme", slot: value, scope, value } : { type: "solid", color: value, scope, value };
  if (!isObject(value)) return { scope, value };
  const base = { type: value.type, opacity: value.opacity, scope, value };
  if (value.type === "theme") return { ...base, slot: value.slot };
  if (value.type === "solid") return { ...base, color: value.color };
  if (value.type === "gradient") return { ...base, angle: value.gradient?.angle, stops: structuredClone(value.gradient?.stops ?? []) };
  if (value.type === "image") return { ...base, src: value.image?.src, fit: value.image?.fit };
  if (value.type === "pattern") return { ...base, preset: value.pattern?.preset, foregroundColor: value.pattern?.foregroundColor, backgroundColor: value.pattern?.backgroundColor };
  return base;
}

