// CE-06 (promoted from examples/playground.js): text measurement and font notes shared by the workspace parts. No renderer import: the script
// planner comes with the fonts handle (`textMeasurement.forScripts`, the renderer's font registry), so the `/workspace` entry, which re-exports
// `layoutOptionsFor`, loads no renderer code for a host that mounts only the source pane.
import { resolveScriptFonts } from "@openpresentation/opf/composition";

/**
 * The layout options for composing slide `index` of `deck`: the fonts handle's measurement, made script-aware for this document (Japanese
 * under Aptos measures with Noto Sans JP, where the plain strict measurement would throw "cannot display U+65E5" with every face loaded).
 * A fonts handle without a measurement, or whose measurement has no script planner (`forScripts`), is passed through.
 */
export function layoutOptionsFor(fonts, deck, index, catalogs) {
  if (!fonts?.textMeasurement) return fonts ? { fonts } : {};
  if (typeof fonts.textMeasurement.forScripts !== "function") return { fonts };
  try {
    return { fonts: { textMeasurement: fonts.textMeasurement.forScripts(resolveScriptFonts(deck, { slideIndex: index, catalogs })) } };
  } catch {
    return { fonts };
  }
}

/** Review text for one font resolution the registry recorded. A change inside one family is a style fallback, not a replacement font. */
export function describeFontChange(change) {
  const sameFamily = (change.sourceFamily ?? change.requestedFamily).toLowerCase() === change.resolvedFamily.toLowerCase();
  if (!sameFamily) return `${change.requestedFamily} → ${change.resolvedFamily} · ${change.compatibility === "metric" ? "Metric substitute" : "Approximate substitute; wrapping may change"} (${change.resolvedWeight}).`;
  const drawn = `${change.resolvedFamily} ${change.resolvedWeight}${change.italic ? " italic" : ""}`;
  return change.requestedWeight === change.resolvedWeight
    ? `${change.requestedFamily}: the ${change.italic ? "italic" : "upright"} face asked for is not available, so ${drawn} is drawn; wrapping may change.`
    : `${change.requestedFamily} ${change.requestedWeight}: that weight is not available, so ${drawn} is drawn; wrapping may change.`;
}

/** Notes (`{ path, message }`) for the font substitutions a fonts handle recorded, one per requested face. */
export function fontSubstitutionNotes(fonts) {
  const changes = fonts?.substitutions ?? [];
  return changes
    .filter((change, index, all) => all.findIndex((other) => other.requestedFamily === change.requestedFamily && other.requestedWeight === change.requestedWeight && other.italic === change.italic) === index)
    .map((change) => ({ path: change.path ?? "design.fontScheme", message: describeFontChange(change) }));
}
