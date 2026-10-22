// Color variants (RR-96): `design.variant`, at the deck or on one slide. A variant is a mapping over the deck's one twelve-slot color
// scheme, as PowerPoint's color map is, never a second scheme: which slot is the background (and so the text and the alternate
// surface) and, optionally, the order of the accents. `light1`, `light2`, `dark1` and `dark2` are the four backgrounds PowerPoint's
// Variants gallery offers. A choice writes the slot name, so it keeps following the deck's color scheme. Every function has a
// `prepare…` form that returns the patch without touching a session and a session form that commits it as one undoable edit, like
// every other design option; the preview and the PowerPoint export read the variant from core, nothing is drawn here.
import { resolveSlideContext } from "@openpresentation/opf";
import { normalizeColorVariant } from "@openpresentation/opf/composition";
import { getValueAtPath, opfPathToJsonPointer } from "./index.js";
import { checkedDocument, designPatches, fail } from "./edit-helpers.js";
import { checkFormat } from "./checks.js";
import { ACCENT_SLOTS, VARIANT_BACKGROUND_SLOTS, readSchemeSlots } from "./color-slots.js";

export { ACCENT_SLOTS, VARIANT_BACKGROUND_SLOTS };
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const sameOrder = (accents) => accents.every((slot, index) => slot === ACCENT_SLOTS[index]);

/** For each background slot: the slots the variant maps to the text, the alternate surface and the secondary text (the schema's ColorVariant table). */
export const VARIANT_MAPS = Object.freeze({
  light1: Object.freeze({ bg1: "light1", tx1: "dark1", bg2: "light2", tx2: "dark2", dark: false }),
  light2: Object.freeze({ bg1: "light2", tx1: "dark1", bg2: "light2", tx2: "dark2", dark: false }),
  dark1: Object.freeze({ bg1: "dark1", tx1: "light1", bg2: "dark2", tx2: "light2", dark: true }),
  dark2: Object.freeze({ bg1: "dark2", tx1: "light1", bg2: "dark2", tx2: "light2", dark: true }),
});

/**
 * Validate a variant and return what to store: the background slot as a string, or `{ background, accents }` only when the accents are
 * reordered. Accepts a slot, `{ background, accents? }`; a full accent list in the scheme's own order is dropped (it says nothing).
 */
export function normalizeVariant(value) {
  const spec = typeof value === "string" ? { background: value } : value;
  if (!isObject(spec)) throw fail("invalid-variant", `A variant is a background slot (${VARIANT_BACKGROUND_SLOTS.join(", ")}) or { background, accents }.`, { value });
  const extra = Object.keys(spec).filter((key) => key !== "background" && key !== "accents");
  if (extra.length) throw fail("invalid-variant", `A variant has a background and optionally accents, not ${extra.join(", ")}.`, { fields: extra });
  if (!VARIANT_BACKGROUND_SLOTS.includes(spec.background)) throw fail("invalid-variant", `The variant background is one of ${VARIANT_BACKGROUND_SLOTS.join(", ")}.`, { background: spec.background });
  if (spec.accents === undefined || spec.accents === null) return spec.background;
  const accents = spec.accents;
  if (!Array.isArray(accents) || accents.length !== ACCENT_SLOTS.length || new Set(accents).size !== ACCENT_SLOTS.length || accents.some((slot) => !ACCENT_SLOTS.includes(slot)))
    throw fail("invalid-variant", "The accent order uses each of accent1 to accent6 once.", { accents });
  return sameOrder(accents) ? spec.background : { background: spec.background, accents: [...accents] };
}

// Core's own normalization of a stored variant (the string shorthand or the object) to the object it resolves with.
const asObject = (stored) => normalizeColorVariant(stored);

function scopeOf(presentation, options) {
  const index = options.slideIndex;
  if (index === undefined) return { scope: "deck", base: [] };
  if (!Number.isInteger(index) || !presentation.slides?.[index]) throw fail("slide-index-out-of-range", "Choose an existing slide for this option.", { slideIndex: index });
  return { scope: "slide", base: ["slides", String(index)], slideIndex: index };
}

const ownVariant = (presentation, base) => {
  const design = getValueAtPath(presentation, base.length ? [...base, "design"] : ["design"]);
  return isObject(design) && design.variant !== undefined ? design.variant : undefined;
};

/**
 * The variant at a scope, for a panel. `own` is what that scope's `design.variant` says (`{ background, accents? }`, undefined when
 * it sets none), `background` and `accents` the slide's effective variant (core's resolution: a slide's variant, a theme-slot
 * background, a picture or gradient `tone`, the deck's variant, the theme's, then the default; `accents` always has the six slots in
 * order), `scope` where `own` comes from ("slide", "deck" or "default") and `inherited` whether a slide takes it from the deck.
 */
export function readDesignVariant(presentation, options = {}) {
  const { base } = scopeOf(presentation, options);
  const own = ownVariant(presentation, base);
  const deck = ownVariant(presentation, []);
  let effective;
  try {
    const slide = options.slideIndex ?? 0;
    effective = resolveSlideContext(presentation, Math.min(Math.max(slide, 0), Math.max((presentation.slides?.length ?? 1) - 1, 0)), options.catalogs ? { catalogs: options.catalogs } : {}).resolved?.roles?.variant;
  } catch { /* older core or an unresolvable document: fall back to what the document says */ }
  const fallback = asObject(own ?? deck) ?? { background: "light1" };
  const shown = isObject(effective) && typeof effective.background === "string" ? effective : fallback;
  const slideScope = options.slideIndex !== undefined;
  return {
    own: own === undefined ? undefined : asObject(own),
    background: shown.background,
    accents: Array.isArray(shown.accents) ? [...shown.accents] : [...ACCENT_SLOTS],
    scope: own !== undefined ? (slideScope ? "slide" : "deck") : slideScope && deck !== undefined ? "deck" : "default",
    inherited: slideScope && own === undefined,
  };
}

/**
 * The four variants as swatches built from the deck's own scheme slots at a scope: for each of `light1`, `light2`, `dark1` and `dark2`
 * the colors of its background, text, alternate surface and first three accents (in the effective accent order), and whether it is
 * the effective one. A color the scheme leaves out is undefined.
 */
export function variantSwatches(presentation, options = {}) {
  const slots = readSchemeSlots(presentation, { slideIndex: options.slideIndex ?? 0, catalogs: options.catalogs });
  const current = readDesignVariant(presentation, options);
  return VARIANT_BACKGROUND_SLOTS.map((slot) => {
    const map = VARIANT_MAPS[slot];
    return {
      slot,
      dark: map.dark,
      background: slots[map.bg1],
      text: slots[map.tx1],
      surface: slots[map.bg2],
      accents: current.accents.slice(0, 3).map((accent) => slots[accent]),
      selected: current.background === slot,
    };
  });
}

/** Slides whose own design hides a deck-level variant: their own `variant`, or a theme-slot background that decides the slide's variant (or a tone). */
function shadowedSlides(presentation) {
  const hidden = [];
  (presentation.slides ?? []).forEach((slide, index) => {
    const design = slide?.design;
    if (!isObject(design)) return;
    const background = design.background;
    const decides = design.variant !== undefined || background === "light1" || background === "light2" || background === "dark1" || background === "dark2" || (isObject(background) && (background.type === "theme" || background.tone !== undefined));
    if (decides) hidden.push(index);
  });
  return hidden;
}

/**
 * Compute the patch that sets the variant, at the deck or (with `slideIndex`) on one slide. `value` is a background slot, `{ background,
 * accents? }`, or `null` to remove the variant at that scope (a slide then follows the deck). `{ accents }` alone keeps the scope's
 * (or else the effective) background. Deck scope: `clearSlideOverrides` also removes the slides' own variants that would hide the
 * change; `shadowed` lists the slides whose own variant or background would still hide it.
 */
export function prepareDesignVariant(presentation, value, options = {}) {
  if (!isObject(presentation)) throw fail("invalid-input", "Design variants need an OPF document object.");
  if (value === undefined) throw fail("invalid-variant", "Pass a variant, or null to remove it.");
  const before = checkFormat(presentation);
  const { scope, base, slideIndex } = scopeOf(presentation, options);
  let stored = null;
  if (value !== null) {
    let spec = value;
    if (isObject(value) && value.background === undefined) {
      const current = readDesignVariant(presentation, { slideIndex, catalogs: options.catalogs });
      spec = { background: current.background, ...value };
    }
    stored = normalizeVariant(spec);
  }
  const patches = designPatches(presentation, base, { variant: stored });
  let shadowed = [];
  if (scope === "deck") {
    shadowed = shadowedSlides(presentation);
    if (options.clearSlideOverrides) {
      for (const index of shadowed) {
        if (presentation.slides[index].design?.variant !== undefined) patches.push({ op: "remove", path: opfPathToJsonPointer(["slides", String(index), "design", "variant"]) });
      }
      shadowed = shadowedSlides(applyRemovals(presentation, patches));
    }
  }
  const next = checkedDocument(presentation, patches, before);
  return { option: "variant", scope, ...(slideIndex !== undefined ? { slideIndex } : {}), presentation: next, patches, changed: patches.length > 0, shadowed };
}

function applyRemovals(presentation, patches) {
  const copy = structuredClone(presentation);
  for (const patch of patches) {
    if (patch.op !== "remove") continue;
    const match = /^\/slides\/(\d+)\/design\/variant$/.exec(patch.path);
    if (match) delete copy.slides[Number(match[1])].design.variant;
  }
  return copy;
}

function checkEditor(editor) {
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function")
    throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
}

/** Set the variant as one undoable transaction. See {@link prepareDesignVariant}. */
export function setDesignVariant(editor, value, options = {}) {
  checkEditor(editor);
  const { meta = {}, ...rest } = options;
  const prepared = prepareDesignVariant(editor.presentation, value, { catalogs: editor.catalogs, ...rest });
  const { presentation, patches, ...summary } = prepared;
  void presentation;
  if (!prepared.changed) return { ...summary, presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(patches, { ...meta, source: meta.source ?? "design-option", option: "variant", scope: prepared.scope });
  return { ...change, ...summary };
}
