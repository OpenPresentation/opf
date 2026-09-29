import { fontPolicyFor } from "./font-policy.js";
import { resolvePresentation } from "./svg.js";
export { lazyFontEntries, lazyFontList } from "./lazy-font-list.js";

/**
 * FF-31: the vendored faces (the open families and Intos) are not in a registry's eager list. Browser hosts load them
 * on demand, from separate hash-pinned files, when a document's font families resolve to them. This module holds the
 * pure parts (which faces exist, which a presentation needs); fonts-browser.js does the fetching.
 */

const lc = value => String(value).trim().toLowerCase();

/** The font families a presentation's slides resolve (heading, body and code roles), or an empty set for a document that does not resolve. */
export function presentationFamilies(presentation) {
  const families = new Set();
  let resolved;
  try { resolved = resolvePresentation(presentation, {}); } catch { return families; }
  for (const slide of resolved.slides) for (const family of Object.values(slide.design?.fonts ?? {})) if (typeof family === "string" && family) families.add(family);
  return families;
}

/**
 * The vendored faces a document needs that the registry does not hold, following the registry's own order and substitution
 * policy: the family itself, an alias target, then (unless the policy is "none") the declared replacement and, under
 * "visual", its alternates. The first candidate the registry already has ends the search (it will resolve to that); the
 * first vendored candidate is needed, whole family, so the browser resolves exactly what Node resolves with everything
 * loaded, and nothing is downloaded for a family the policy would not resolve.
 * @param {Iterable<string>} families families the document resolves
 * @param {{lazy: readonly object[], hasFamily: (family: string) => boolean, loaded?: ReadonlySet<string>, policy?: "none"|"metric"|"visual", aliases?: ReadonlyMap<string, string>}} context
 */
export function lazyFontsFor(families, { lazy, hasFamily, loaded = new Set(), policy = "visual", aliases = new Map() }) {
  const byFamily = new Map();
  for (const face of lazy) { const list = byFamily.get(lc(face.family)) ?? []; list.push(face); byFamily.set(lc(face.family), list); }
  const needed = new Set();
  for (const family of families) {
    if (hasFamily(family)) continue;
    if (byFamily.has(lc(family))) { needed.add(lc(family)); continue; }
    const target = aliases.get(lc(family));
    if (target && (hasFamily(target) || byFamily.has(lc(target)))) { if (!hasFamily(target)) needed.add(lc(target)); continue; }
    if (policy === "none") continue;
    const row = fontPolicyFor(family), replacement = row?.replacement;
    const route = [];
    // Metric mode uses a metric replacement, or a visual one its policy row keeps as a metric-mode fallback; alternates are visual only.
    if (replacement && (policy === "visual" || replacement.compatibility === "metric" || replacement.metricModeFallback)) route.push(replacement.family);
    if (policy === "visual") route.push(...(row?.alternates ?? []));
    for (const candidate of route) {
      if (hasFamily(candidate)) break;
      if (byFamily.has(lc(candidate))) { needed.add(lc(candidate)); break; }
    }
  }
  return [...needed].flatMap(family => byFamily.get(family)).filter(face => !loaded.has(face.file));
}
