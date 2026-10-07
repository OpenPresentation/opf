import { fontPolicyFor } from "@openpresentation/opf/font-policy";
import { pickFace } from "./font-registry.js";
import { renderSvg, resolvePresentation } from "./svg.js";
export { lazyFontEntries, lazyFontList } from "./lazy-font-list.js";

/**
 * FF-31: the vendored faces (the open families and Intos) are not in a registry's eager list. Browser hosts load them
 * on demand, from separate hash-pinned files, when a document draws them. This module holds the pure parts (which faces
 * exist, which a presentation needs); fonts-browser.js does the fetching.
 *
 * FF-41: the analysis is face level. `presentationFaces` lists the {family, weight, italic} the renderer draws (resolved as a
 * registry resolves them, on request), `lazyFacesNeeded` picks the vendored faces among them a registry lacks, and
 * `lazyFontsFor` selects the vendored faces a list of face requests resolves to; none of them loads whole families.
 */

const lc = value => String(value).trim().toLowerCase();

/**
 * Render options that decide how a document resolves (catalogs, validate, date, ...) are forwarded from the host's
 * `renderSvg` options. The analysis supplies its own measurement and reports nothing: callbacks, the host's fonts handle
 * (measurement and embedded fonts), asset resolution and tracing are dropped.
 */
const NOT_RESOLVE_OPTIONS = new Set(["fonts", "onDiagnostic", "trace", "glyphFallback", "imageResolver", "strictAssets", "signal"]);
function resolveOptionsOf(options) {
  return Object.fromEntries(Object.entries(options ?? {}).filter(([key]) => !NOT_RESOLVE_OPTIONS.has(key)));
}

/**
 * The font families a presentation's slides resolve (heading, body and code roles of every slide, including per-slide
 * design overrides), as `renderSvg` resolves them with the same `options` (`catalogs`, ...). This is the role families,
 * not what is drawn: use `presentationFaces` for that.
 *
 * A document that does not resolve throws the error `renderSvg` throws for it (an OPFRenderError such as
 * `catalog-resolution-failed` for a layout id no catalog has, or `invalid-opf`), never an empty set: a document whose layout comes only from
 * `options.catalogs` needs those catalogs here too.
 */
export function presentationFamilies(presentation, options = {}) {
  const families = new Set();
  const resolved = resolvePresentation(presentation, resolveOptionsOf(options));
  for (const slide of resolved.slides) for (const family of Object.values(slide.design?.fonts ?? {})) if (typeof family === "string" && family) families.add(family);
  return families;
}

// A measurement that costs nothing to overflow: text is measured as very narrow, so layout never fails on text that
// only the real faces would fit. Only the styles it is asked about matter.
const RECORDED_EM = 0.01;

/** The registry's view with faces added: what a registry holding `faces` resolves families to (`pickFace`, its own selection). */
function registryView({ faces, policy = "none", aliases = new Map(), fallbackFamily }) {
  const pool = [...faces].map(face => ({ ...face, familyGroup: face.familyGroup ?? face.family }));
  return style => {
    const family = style?.fontFamily;
    const { face } = pickFace(pool, family, style, { policy, aliases, fallbackFamily });
    return { ...style, fontFamily: face.family, fontWeight: face.weight, italic: face.italic };
  };
}

/**
 * The faces a preview of the presentation draws, as `[{family, weight, italic}]`, sorted by family, style and weight. It is
 * the renderer's own layout and painting run with a recording measurement, so it follows exactly what `renderSvg` measures
 * and draws: the heading and body roles of every slide that draws them, bold and italic runs of rich text, table and cell
 * styles, header and footer furniture, chart labels, metrics, quotes and timelines, the code role only where code is
 * drawn, per-slide design overrides, font scheme and theme resolution, and script slots (a script run is requested in its
 * slot's family). A role the document does not draw is not requested.
 *
 * Without `registry` the faces are the styles as the document names them: the family a role resolves to, with the weight
 * a use asks for (700 for headings and bold runs, 400 for body, 500 to 800 where a design asks).
 *
 * With `registry` (`{faces, policy, aliases, fallbackFamily}`: the faces a registry holds or could hold, `{family, weight,
 * italic}`, and its substitution options) every style resolves as that registry resolves it (`pickFace`, the registry's own
 * selection: the family or its alias or policy replacement, italic before weight, the nearest weight, ties to the
 * lighter), in the two steps drawing takes: a role's family resolves first, then each use's weight resolves within the
 * family found. The result is the faces the registry paints, for example `Intos 700` for a 600-weight label of an Aptos
 * deck. A style the registry cannot resolve is left as named (drawing reports it).
 *
 * `options` are the `renderSvg` options the document resolves with (`catalogs`, `date`, `validate`, ...). A document that
 * does not resolve throws what `renderSvg` throws for it.
 * @param {unknown} presentation
 * @param {object} [options]
 * @param {{faces: Iterable<{family: string, weight: number, italic: boolean}>, policy?: "none"|"metric"|"visual", aliases?: ReadonlyMap<string, string>, fallbackFamily?: string}} [registry]
 * @returns {{family: string, weight: number, italic: boolean}[]}
 */
export function presentationFaces(presentation, options = {}, registry) {
  const seen = new Map();
  const resolve = registry ? registryView(registry) : undefined;
  const settle = style => {
    if (!resolve) return { ...style };
    try { return resolve(style); } catch { return { ...style }; }
  };
  const record = style => {
    const family = style?.fontFamily;
    if (typeof family !== "string" || !family.trim() || family.startsWith("+")) return;
    const weight = Number.isFinite(style.fontWeight) ? style.fontWeight : 400, italic = style.italic === true;
    const key = `${lc(family)}\u0000${weight}\u0000${italic}`;
    if (!seen.has(key)) seen.set(key, { family, weight, italic });
  };
  const textMeasurement = {
    measure(text, size, style) { if (text !== "") record(settle(style)); return String(text).length * size * RECORDED_EM; },
    resolveStyle: settle,
  };
  renderSvg(presentation, { ...resolveOptionsOf(options), fonts: { textMeasurement } });
  return [...seen.values()].sort((a, b) => a.family < b.family ? -1 : a.family > b.family ? 1 : Number(a.italic) - Number(b.italic) || a.weight - b.weight);
}

/**
 * The vendored faces (of `lazy`) a presentation draws that the registry does not hold: what a registry loads before it can
 * paint the document as Node paints it with every vendored face loaded. `held` lists the registry's faces
 * (`registry.describeFaces()`), `loaded` the lazy files already loaded; `policy`, `aliases` and `fallbackFamily` are the
 * registry's. `renderOptions` are the `renderSvg` options the document resolves with (`catalogs`, ...), and a document that
 * does not resolve throws what `renderSvg` throws for it. Face level: a bold or italic run added by an edit adds just that face.
 */
export function lazyFacesNeeded(presentation, renderOptions, { lazy, held, loaded = new Set(), policy = "none", aliases = new Map(), fallbackFamily }) {
  const heldFaces = [...held], heldKeys = new Set(heldFaces.map(faceKeyOf));
  const missing = lazy.filter(face => !heldKeys.has(faceKeyOf(face)) && !loaded.has(face.file));
  const drawn = new Set(presentationFaces(presentation, renderOptions, { faces: [...heldFaces, ...missing], policy, aliases, fallbackFamily }).map(faceKeyOf));
  return missing.filter(face => drawn.has(faceKeyOf(face)));
}
function faceKeyOf(face) { return `${lc(face.family)}\u0000${face.weight}\u0000${!!face.italic}`; }

/**
 * The vendored faces a document needs that the registry does not hold, following the registry's own order and substitution
 * policy: the family itself, an alias target, then (unless the policy is "none") the declared replacement and, under
 * "visual", its alternates.
 *
 * Entries are face requests `{family, weight, italic}` (from `presentationFaces`) or family names. A face request is
 * resolved exactly as the registry resolves it with every vendored face loaded (`pickFace`, the registry's own selection,
 * over the faces it holds plus the vendored ones): the vendored face it lands on is needed if the registry does not hold
 * it, so a partially loaded family still loads its missing faces, and a face is never fetched for a weight or style the
 * document does not draw. A family name means every face of the family the route resolves to (the whole family, as
 * before FF-41). Nothing is downloaded for a family the policy would not resolve.
 * @param {Iterable<string | {family: string, weight?: number, italic?: boolean}>} entries
 * @param {{lazy: readonly object[], held?: Iterable<{family: string, weight: number, italic: boolean}>, hasFamily?: (family: string) => boolean, loaded?: ReadonlySet<string>, policy?: "none"|"metric"|"visual", aliases?: ReadonlyMap<string, string>, fallbackFamily?: string}} context
 * `held` lists the registry's faces (`registry.describeFaces()`); it is what makes the check face level. Without it a face
 * request falls back to family level with `hasFamily` (a held family needs nothing).
 */
export function lazyFontsFor(entries, { lazy, held, hasFamily, loaded = new Set(), policy = "visual", aliases = new Map(), fallbackFamily }) {
  const byFamily = new Map();
  for (const face of lazy) { const list = byFamily.get(lc(face.family)) ?? []; list.push(face); byFamily.set(lc(face.family), list); }
  const heldFaces = held === undefined ? undefined : [...held];
  const faceKey = face => `${lc(face.family)}\u0000${face.weight}\u0000${!!face.italic}`;
  const heldKeys = new Set((heldFaces ?? []).map(faceKey));
  const has = hasFamily ?? (family => (heldFaces ?? []).some(face => lc(face.family) === lc(family)));
  const needed = new Set(), neededFiles = new Set();
  // Whole families (a family name, or a face request without a face-level registry view).
  const addFamily = family => {
    // A family the registry holds only in part still needs its other vendored faces (face level, when the registry's faces are known).
    if (has(family)) { if (heldFaces && byFamily.has(lc(family))) needed.add(lc(family)); return; }
    if (byFamily.has(lc(family))) { needed.add(lc(family)); return; }
    const target = aliases.get(lc(family));
    if (target && (has(target) || byFamily.has(lc(target)))) { if (byFamily.has(lc(target)) && (!has(target) || heldFaces)) needed.add(lc(target)); return; }
    if (policy === "none") return;
    const row = fontPolicyFor(family), replacement = row?.replacement;
    const route = [];
    // Metric mode uses a metric replacement, or a visual one its policy row keeps as a metric-mode fallback; alternates are visual only.
    if (replacement && (policy === "visual" || replacement.compatibility === "metric" || replacement.metricModeFallback)) route.push(replacement.family);
    if (policy === "visual") route.push(...(row?.alternates ?? []));
    for (const candidate of route) {
      if (has(candidate)) { if (heldFaces && byFamily.has(lc(candidate))) needed.add(lc(candidate)); break; }
      if (byFamily.has(lc(candidate))) { needed.add(lc(candidate)); break; }
    }
  };
  // The registry's view with every vendored face added: what Node draws with everything loaded.
  let pool;
  const universe = () => pool ??= [
    ...heldFaces.map(face => ({ ...face, familyGroup: face.family })),
    ...lazy.filter(face => !heldKeys.has(faceKey(face)) && !loaded.has(face.file)).map(face => ({ family: face.family, familyGroup: face.family, weight: face.weight, italic: !!face.italic, lazy: face })),
  ];
  for (const entry of entries) {
    if (typeof entry === "string") { addFamily(entry); continue; }
    if (heldFaces === undefined) { addFamily(entry.family); continue; }
    let picked;
    try { picked = pickFace(universe(), entry.family, { fontFamily: entry.family, fontWeight: entry.weight ?? 400, italic: entry.italic === true }, { policy, aliases, fallbackFamily }); }
    // A face the registry cannot resolve even with every vendored face (unknown family, symbol font, ...) needs nothing here: drawing reports it.
    catch { continue; }
    if (picked.face.lazy) neededFiles.add(picked.face.lazy.file);
  }
  const all = [...needed].flatMap(family => byFamily.get(family) ?? []);
  for (const face of lazy) if (neededFiles.has(face.file)) all.push(face);
  return [...new Set(all)].filter(face => !loaded.has(face.file) && !heldKeys.has(faceKey(face)));
}
