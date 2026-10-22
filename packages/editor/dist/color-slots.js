// RR-96: the color scheme slots a picker offers as swatches, read from the scheme the document resolves for a slide. A slot is
// shown as its own color, so a swatch is what the deck draws, and a choice writes the slot name (`accent3`, `dark1`), never the hex,
// so it keeps following the deck if its scheme changes. Read only: no edit goes through here.
import { resolveSlideContext } from "@openpresentation/opf";

/** The four background slots a variant maps to the background, in the order PowerPoint's Variants gallery shows them. */
export const VARIANT_BACKGROUND_SLOTS = Object.freeze(["light1", "light2", "dark1", "dark2"]);
/** The six accent slots, in the scheme's own order. */
export const ACCENT_SLOTS = Object.freeze(["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"]);

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The hex color of each of `light1`, `light2`, `dark1`, `dark2` and `accent1` to `accent6` in the deck's resolved color scheme at
 * `slideIndex` (default: the first slide; a slide has the deck's scheme unless it sets its own). A slot the scheme leaves out is
 * absent. Never throws: an unresolvable document gives `{}`.
 */
export function readSchemeSlots(presentation, { slideIndex = 0, catalogs } = {}) {
  let scheme;
  try {
    const slides = Array.isArray(presentation?.slides) ? presentation.slides.length : 0;
    scheme = resolveSlideContext(presentation, Math.min(Math.max(slideIndex, 0), Math.max(slides - 1, 0)), catalogs ? { catalogs } : {}).resolved?.colorScheme;
  } catch {
    return {};
  }
  const slots = {};
  for (const name of [...VARIANT_BACKGROUND_SLOTS, ...ACCENT_SLOTS]) {
    if (typeof scheme?.[name] === "string" && HEX.test(scheme[name])) slots[name] = scheme[name];
  }
  return slots;
}
