import { fontPolicyFor } from "@openpresentation/opf/font-policy";
import { pickFace } from "./font-registry.js";
import { toSvg } from "./svg.js";
import { deckInternals } from "./svg-internals.js";
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
 * `toSvg` options. The analysis supplies its own measurement and reports nothing: callbacks, the host's fonts handle
 * (measurement and embedded fonts), asset resolution and tracing are dropped.
 */
const NOT_RESOLVE_OPTIONS = new Set(["fonts", "onDiagnostic", "trace", "glyphFallback", "imageResolver", "strictAssets", "signal"]);
function resolveOptionsOf(options) {
  return Object.fromEntries(Object.entries(options ?? {}).filter(([key]) => !NOT_RESOLVE_OPTIONS.has(key)));
}

/**
 * The font families a presentation's slides resolve (heading, body and code roles of every slide, including per-slide
 * design overrides), as `toSvg` resolves them with the same `options` (`catalogs`, ...). This is the role families,
 * not what is drawn: use `presentationFaces` for that.
 *
 * A document that does not resolve throws the error `toSvg` throws for it (an OPFRenderError such as
 * `catalog-resolution-failed` for a layout id no catalog has, or `invalid-opf`), never an empty set: a document whose layout comes only from
 * `options.catalogs` needs those catalogs here too.
 */
export function presentationFamilies(presentation, options = {}) {
  return createFontAnalysis().families(presentation, options);
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
 * the renderer's own layout and painting run with a recording measurement, so it follows exactly what `toSvg` measures
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
 * `options` are the `toSvg` options the document resolves with (`catalogs`, `date`, `validate`, ...). A document that
 * does not resolve throws what `toSvg` throws for it.
 * @param {unknown} presentation
 * @param {object} [options]
 * @param {{faces: Iterable<{family: string, weight: number, italic: boolean}>, policy?: "none"|"metric"|"visual", aliases?: ReadonlyMap<string, string>, fallbackFamily?: string}} [registry]
 * @returns {{family: string, weight: number, italic: boolean}[]}
 */
export function presentationFaces(presentation, options = {}, registry) {
  return createFontAnalysis().faces(presentation, options, registry);
}

const faceKey = (family, weight, italic) => `${lc(family)}\u0000${weight}\u0000${italic}`;
const byFace = (a, b) => a.family < b.family ? -1 : a.family > b.family ? 1 : Number(a.italic) - Number(b.italic) || a.weight - b.weight;

/**
 * The measurement `presentationFaces` draws with: it records every style it is asked to measure (resolved through `settle`) into
 * the map `record.into` holds (switch it to file what follows elsewhere).
 */
function recordingMeasurement(settle, into) {
  const record = { into };
  record.textMeasurement = {
    measure(text, size, style) {
      if (text !== "") {
        const settled = settle(style), family = settled?.fontFamily;
        if (typeof family === "string" && family.trim() && !family.startsWith("+")) {
          const weight = Number.isFinite(settled.fontWeight) ? settled.fontWeight : 400, italic = settled.italic === true;
          const key = faceKey(family, weight, italic);
          if (!record.into.has(key)) record.into.set(key, { family, weight, italic });
        }
      }
      return String(text).length * size * RECORDED_EM;
    },
    resolveStyle: settle,
  };
  return record;
}

// Stable short tokens for option values: objects by identity (a host passes the same catalog objects on every call; the editor
// freezes its catalog list), plain values and small plain objects by content.
const objectTokens = new WeakMap();
let nextObjectToken = 0;
function optionToken(value) {
  if (value === null || typeof value !== "object" && typeof value !== "function") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(optionToken).join(",")}]`;
  let token = objectTokens.get(value);
  if (token === undefined) { token = `#${nextObjectToken++}`; objectTokens.set(value, token); }
  return token;
}
// The options a deck resolves with, as a key. `variables` is left out where it cannot change the deck (the editor's views pass `variables:
// false` or nothing for the same plain deck, which must not analyze it twice).
function optionsKey(options, presentation) {
  return Object.keys(options).sort().filter(key => key !== "variables" || !deckInternals.variablesIdle(presentation, options.variables))
    .map(key => `${JSON.stringify(key)}:${optionToken(options[key])}`).join(",");
}

/**
 * Content keys of a deck for the per-slide caches: `context` is everything a slide's drawing reads besides the slide itself (the deck
 * without its slides, and every slide's section, which furniture can show on other slides; the rule the editor's thumbnail cache
 * uses), `slides[i]` the slide with its number and the slide count. Keys are taken from the content on every call, never from object
 * identity, so a host that changes a deck in place is analyzed right. Undefined for input that is not a plain deck object (JSON
 * text, bytes, a deck without a slide list or one JSON cannot write): such input is analyzed whole, as `toSvg` draws it.
 */
export function deckKeys(presentation) {
  if (presentation === null || typeof presentation !== "object" || ArrayBuffer.isView(presentation) || !Array.isArray(presentation.slides)) return undefined;
  try {
    const { slides, ...metadata } = presentation;
    return {
      context: JSON.stringify([metadata, slides.map(slide => slide?.section ?? null)]),
      slides: slides.map((slide, index) => `${index}/${slides.length}/${JSON.stringify(slide) ?? ""}`),
    };
  } catch { return undefined; }
}

/**
 * Per-slide results kept between calls: a few contexts (least recently used first out) and, in each, the slides most recently asked
 * for, up to twice the deck's slides (a host that alternates a document and a draft of it keeps both).
 */
function slideMemory(contexts = 8) {
  const byContext = new Map();
  return (context, slides) => {
    let entries = byContext.get(context);
    if (entries) byContext.delete(context);
    else entries = new Map();
    byContext.set(context, entries);
    while (byContext.size > contexts) byContext.delete(byContext.keys().next().value);
    const limit = 2 * slides + 16;
    return {
      get(key) {
        const value = entries.get(key);
        if (value !== undefined) { entries.delete(key); entries.set(key, value); }
        return value;
      },
      set(key, value) {
        entries.set(key, value);
        while (entries.size > limit) entries.delete(entries.keys().next().value);
      },
    };
  };
}

/**
 * `presentationFaces` and `presentationFamilies` with memory, for a fonts handle that is asked again and again (FF-41; the 0.28.0
 * startup regression). Each slide's result is kept by the slide's content, and a call analyzes only the slides whose content,
 * number or slide count changed: `faces` composes and draws just those slides with the recording measurement, `families` resolves
 * just their designs. Everything else a slide's result depends on (the rest of the deck, every slide's section, the render
 * options and, for faces, the registry view) is the cache's context: a change there analyzes every slide again. The results are
 * the ones `presentationFaces` and `presentationFamilies` give, errors included: a deck not checked before is opened (resolved and
 * checked) even when every slide is known, and a slide that fails throws what `toSvg` throws for it (only slides that succeed are
 * kept).
 *
 * `stats` counts the work, for tests and benchmarks: `decks` (decks opened), `slides` (slides composed and drawn for faces) and
 * `designs` (slide designs resolved for families).
 */
export function createFontAnalysis() {
  const memory = slideMemory(), stats = { decks: 0, slides: 0, designs: 0 }, checked = new Set();
  // The deck behind `keys`, opened (resolved and checked as `toSvg` does) when work is needed or this exact deck was never checked.
  const opener = (presentation, resolveOptions, keys, optionsToken) => {
    const whole = `${optionsToken}\u0001${keys.context}\u0001${keys.slides.join("\u0001")}`;
    let deck;
    const open = () => {
      if (!deck) {
        deck = deckInternals.openDeck(presentation, resolveOptions);
        stats.decks++;
        checked.delete(whole);
        checked.add(whole);
        while (checked.size > 8) checked.delete(checked.keys().next().value);
      }
      return deck;
    };
    return { open, check: () => { if (!checked.has(whole)) open(); } };
  };

  function faces(presentation, options = {}, registry) {
    const resolveOptions = resolveOptionsOf(options);
    if (registry) registry = { ...registry, faces: [...registry.faces] };
    const view = registry ? registryView(registry) : undefined;
    const settle = style => {
      if (!view) return { ...style };
      try { return view(style); } catch { return { ...style }; }
    };
    const keys = deckKeys(presentation);
    if (!keys) {
      // Not a deck object: one whole-deck pass, kept nowhere.
      const seen = new Map();
      toSvg(presentation, { ...resolveOptions, fonts: { textMeasurement: recordingMeasurement(settle, seen).textMeasurement } });
      stats.decks++;
      return [...seen.values()].sort(byFace);
    }
    const optionsToken = optionsKey(resolveOptions, presentation);
    const slides = memory(`faces\u0001${optionsToken}\u0001${registry ? registryKey(registry) : ""}\u0001${keys.context}`, keys.slides.length);
    const deck = opener(presentation, resolveOptions, keys, optionsToken);
    const entries = keys.slides.map(slides.get);
    const missing = entries.flatMap((entry, index) => entry === undefined ? [index] : []);
    if (missing.length) {
      // Composition of the slides, then their drawing, as `toSvg` runs them.
      const opened = deck.open();
      const made = new Map(missing.map(index => [index, { composed: new Map(), drawn: new Map() }]));
      const recorders = new Map(missing.map(index => [index, recordingMeasurement(settle, made.get(index).composed)]));
      for (const index of missing) opened.bind(index, recorders.get(index).textMeasurement);
      // A slide is drawn with the measurement it was composed with; what it measures from here on is its drawing. `skipHidden`
      // leaves hidden slides undrawn (they are still composed), as in `toSvg`.
      for (const index of missing) {
        if (resolveOptions.skipHidden === true && opened.presentation.slides[index]?.hidden === true) continue;
        recorders.get(index).into = made.get(index).drawn;
        opened.render(index);
      }
      for (const [index, entry] of made) { slides.set(keys.slides[index], entry); entries[index] = entry; }
      stats.slides += missing.length;
    } else deck.check();
    // In the order one `toSvg` records them: every slide's composition, then every slide's drawing.
    const seen = new Map();
    for (const phase of ["composed", "drawn"]) for (const entry of entries) for (const [key, face] of entry[phase]) if (!seen.has(key)) seen.set(key, face);
    return [...seen.values()].sort(byFace).map(face => ({ ...face }));
  }

  function families(presentation, options = {}) {
    const resolveOptions = resolveOptionsOf(options);
    const familiesOf = design => Object.values(design?.fonts ?? {}).filter(family => typeof family === "string" && family);
    const keys = deckKeys(presentation);
    let entries;
    if (!keys) {
      const opened = deckInternals.openDeck(presentation, resolveOptions);
      stats.decks++;
      entries = opened.presentation.slides.map((_, index) => familiesOf(opened.design(index)));
      stats.designs += entries.length;
    } else {
      const optionsToken = optionsKey(resolveOptions, presentation);
      const slides = memory(`families\u0001${optionsToken}\u0001${keys.context}`, keys.slides.length);
      const deck = opener(presentation, resolveOptions, keys, optionsToken);
      entries = keys.slides.map(slides.get);
      const missing = entries.flatMap((entry, index) => entry === undefined ? [index] : []);
      if (missing.length) {
        const opened = deck.open();
        // The design as drawing binds it, without composing the slide (composing every slide with the default measurement made
        // this the slowest step of a browser font check in 0.28.0).
        for (const index of missing) { entries[index] = familiesOf(opened.design(index)); slides.set(keys.slides[index], entries[index]); }
        stats.designs += missing.length;
      } else deck.check();
    }
    return new Set(entries.flat());
  }

  return { faces, families, stats };
}

function registryKey({ faces, policy = "none", aliases = new Map(), fallbackFamily }) {
  // Every field `pickFace` reads, as it reads them (`italic` is compared with ===, `fallbackOnly` and `scripts` by truth).
  return JSON.stringify([faces.map(face => [face.family, face.familyGroup ?? face.family, face.weight ?? null, face.italic ?? null, !!face.fallbackOnly, !!face.scripts]), policy, [...aliases], fallbackFamily ?? null]);
}

/**
 * The vendored faces (of `lazy`) a presentation draws that the registry does not hold: what a registry loads before it can
 * paint the document as Node paints it with every vendored face loaded. `held` lists the registry's faces
 * (`registry.describeFaces()`), `loaded` the lazy files already loaded; `policy`, `aliases` and `fallbackFamily` are the
 * registry's. `renderOptions` are the `toSvg` options the document resolves with (`catalogs`, ...), and a document that
 * does not resolve throws what `toSvg` throws for it. Face level: a bold or italic run added by an edit adds just that face.
 * Pass `analysis` (`createFontAnalysis()`) to keep each slide's faces between calls: then only slides that changed are analyzed.
 */
export function lazyFacesNeeded(presentation, renderOptions, { lazy, held, loaded = new Set(), policy = "none", aliases = new Map(), fallbackFamily, analysis }) {
  const heldFaces = [...held], heldKeys = new Set(heldFaces.map(faceKeyOf));
  const missing = lazy.filter(face => !heldKeys.has(faceKeyOf(face)) && !loaded.has(face.file));
  // `analysis` (from `createFontAnalysis`) keeps each slide's faces between calls, so a fonts handle redoes only changed slides.
  const drawn = new Set((analysis ?? createFontAnalysis()).faces(presentation, renderOptions, { faces: [...heldFaces, ...missing], policy, aliases, fallbackFamily }).map(faceKeyOf));
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
