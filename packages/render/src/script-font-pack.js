// Optional script font pack (FF-19): pinned, hash-verified OFL Noto faces that
// stand in for proprietary script fonts in previews. The packages are optional
// peers, so the renderer install stays small; hosts install only what they use.
import { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
import { OPFFontError } from "./font-registry.js";
import { SCRIPT_FONT_REPLACEMENTS, glyphFallbackFamilies, scriptOfCharacter, scriptsOfText } from "./script-fonts.js";
import { resolveScriptFonts } from "@openpresentation/opf/composition";
import { presentationFamilies } from "./lazy-fonts.js";
import { SYMBOL_SCRIPT, isSymbolEncodedFamily } from "./symbol-fonts.js";

const SCRIPT_ALIASES = Object.freeze({Hira: "Jpan", Kana: "Jpan", Hrkt: "Jpan", Hang: "Kore", Hani: "Hans", Zyyy: "Latn"});

/** Script-pack manifest packages serving `scripts` ("all" or ISO 15924 codes such as `Jpan`, `Arab`). */
export function scriptFontPackages(scripts) {
  const available = BUNDLED_FONT_MANIFEST.packages.filter(item => item.pack === "scripts");
  if (scripts === "all") return available;
  if (!Array.isArray(scripts)) throw new OPFFontError("invalid-font-scripts", "scripts must be 'all' or an array of ISO 15924 script codes.", {scripts});
  const wanted = new Set();
  for (const value of scripts) {
    const code = typeof value === "string" && /^[A-Za-z]{4}$/.test(value) ? value[0].toUpperCase() + value.slice(1).toLowerCase() : undefined;
    const script = SCRIPT_ALIASES[code] ?? code;
    if (!script || !available.some(item => item.scripts.includes(script))) {
      throw new OPFFontError("font-script-unavailable", `No pinned open font serves script '${value}'.`, {script: value, available: [...new Set(available.flatMap(item => item.scripts))].sort()});
    }
    wanted.add(script);
  }
  return available.filter(item => item.scripts.some(script => wanted.has(script)));
}

/**
 * Browser entries for the script pack. `baseUrl` is where the host serves the
 * installed `@expo-google-fonts/*` packages (for example a copy of
 * `node_modules/@expo-google-fonts`). Each entry carries the reviewed SHA-256,
 * which `loadFonts` (browser) verifies before use.
 */
export function scriptFontEntries(scripts, {baseUrl}) {
  return scriptPackageEntries(scriptFontPackages(scripts), {baseUrl});
}

/** Browser entries for whole manifest packages (see `scriptFontEntries`). */
export function scriptPackageEntries(packages, {baseUrl}) {
  if (typeof baseUrl !== "string" || !baseUrl) throw new OPFFontError("invalid-font-source", "scriptFontEntries requires the baseUrl that serves the installed font packages.");
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return packages.flatMap(pkg => pkg.faces.map(face => ({
    url: `${root}${pkg.name.split("/").pop()}/${face.file}`,
    family: face.family, weight: face.weight, italic: face.italic, sha256: face.sha256,
    scripts: [...pkg.scripts], package: `${pkg.name}@${pkg.version}`, license: pkg.license,
    // A script face is embedded in a standalone SVG only when the slide's text uses its family.
    embed: "used",
  })));
}

// Fields a preview never draws (checked against what the renderer and core composition draw).
// Everywhere: the schema URL, embedded assets, catalog records, speaker notes, ids, image alt text and sources,
// links, metadata and typed `extensions` passthrough. On the presentation: name (aria-label fallback), description,
// filename, author, audience, purpose, tone, takeaway, duration, tags, narrative, language and version.
// On a slide: beat. The organization (name), the speaker (name and title) and a slide's section are drawn only through the
// built-in variables that read them ({{organization.name}}, {{speaker.title}}, {{slide.section}}, FA-31), so they count
// only when a string the preview draws holds such a token. Everything else is drawn text: titles, text blocks, list items,
// runs, table cells, chart labels, categories and series names, code, quotes, metrics, timelines, header and footer text.
const UNDRAWN_KEYS = Object.freeze(["$schema", "assets", "catalogs", "notes", "id", "alt", "altText", "src", "url", "href", "link", "metadata", "extensions"]);
const UNDRAWN_ROOT_KEYS = Object.freeze(["name", "description", "filename", "author", "authors", "creator", "audience", "purpose", "tone", "takeaway", "duration", "tags", "narrative", "language", "license", "version", "keywords"]);
const UNDRAWN_SLIDE_KEYS = Object.freeze(["beat"]);
const UNDRAWN_VALUE = /^(?:https?|data|blob|pkg|file|mailto):\S*$/i;

// The built-in variables that copy a document value into drawn text: the inline token and the whole-field reference
// (a logo or photo reference draws a picture, not text).
const ORGANIZATION_TOKEN = /\{\{\s*organization\.|var:organization\.(?!logo\b)/;
const SPEAKER_TOKEN = /\{\{\s*speaker\.|var:speaker\.(?!photo\b|image\b|avatar\b)/;
const SECTION_TOKEN = /\{\{\s*slide\.section\s*[|}]/;

/** The strings under `presentation`, skipping the keys in the three sets (root keys, slide keys, and everywhere). */
function* walkStrings(presentation, undrawn, undrawnRoot, undrawnSlide) {
  function* visit(item, level) {
    if (typeof item === "string") { if (!UNDRAWN_VALUE.test(item)) yield item; }
    else if (Array.isArray(item)) for (const child of item) yield* visit(child, level === "slides" ? "slide" : level === "root" ? "deep" : level);
    else if (item && typeof item === "object") {
      for (const [key, child] of Object.entries(item)) {
        if (undrawn.has(key) || (level === "root" && undrawnRoot.has(key)) || (level === "slide" && undrawnSlide.has(key))) continue;
        yield* visit(child, level === "root" && key === "slides" ? "slides" : "deep");
      }
    }
  }
  yield* visit(presentation, "root");
}

/** The strings a preview of this presentation draws. */
export function* drawnStrings(presentation) {
  const undrawn = new Set(UNDRAWN_KEYS), undrawnRoot = new Set([...UNDRAWN_ROOT_KEYS, "organization", "speaker"]), undrawnSlide = new Set([...UNDRAWN_SLIDE_KEYS, "section"]);
  // The organization, the speaker and a slide's section draw only where a drawn string reads them with a built-in variable.
  for (const text of walkStrings(presentation, undrawn, undrawnRoot, undrawnSlide)) {
    if (ORGANIZATION_TOKEN.test(text)) undrawnRoot.delete("organization");
    if (SPEAKER_TOKEN.test(text)) undrawnRoot.delete("speaker");
    if (SECTION_TOKEN.test(text)) undrawnSlide.delete("section");
  }
  yield* walkStrings(presentation, undrawn, undrawnRoot, undrawnSlide);
}

/**
 * The script profile of a presentation: core `resolveScriptFonts` output, exactly what the renderer plans
 * with. When it throws, the renderer ignores the document language, so the profile is empty and Han text is
 * Simplified Chinese, as drawn. `renderOptions.catalogs` (the host's registered catalogs) resolve as they do for the renderer.
 */
export function presentationScriptProfile(presentation, renderOptions) {
  try { return resolveScriptFonts(presentation, renderOptions?.catalogs !== undefined ? { catalogs: renderOptions.catalogs } : {}); } catch { /* the renderer falls back the same way */ }
  return {};
}

const servedScripts = () => new Set(BUNDLED_FONT_MANIFEST.packages.filter(item => item.pack === "scripts").flatMap(item => item.scripts));
const cjkKeys = ["Jpan", "Hans", "Hant", "Kore"];
const cjkCharacters = new Set(["Hani", "Hira", "Kana", "Hang", "Bopo"]);

/**
 * ISO 15924 script whose pinned face a family resolves to: a proprietary script font (Yu Gothic: Jpan), a pinned face itself
 * (Noto Sans JP: Jpan), or a symbol-encoded family (Wingdings: Zsym, whose codes draw with the pinned symbol faces, FF-45).
 */
function scriptOfFamily(family) {
  const name = String(family ?? "").toLowerCase();
  if (!name) return undefined;
  if (isSymbolEncodedFamily(name)) return SYMBOL_SCRIPT;
  const rule = SCRIPT_FONT_REPLACEMENTS.find(item => item.requestedFamily.toLowerCase() === name);
  if (rule) return rule.script;
  return BUNDLED_FONT_MANIFEST.packages.find(item => item.pack === "scripts" && item.faces.some(face => face.family.toLowerCase() === name))?.scripts[0];
}

/**
 * The scripts whose faces the deck's font schemes need in order to resolve at all. A scheme that names a script font
 * (Yu Gothic, Malgun Gothic, Arabic Typesetting or a pinned Noto family) previews its Latin text with that font's
 * open replacement, so the face is needed even when no drawn character has the script. A slide may override the
 * scheme (`slide.design`), so each such slide is resolved too. `han` is the CJK script the scheme names, which tells
 * Han-only text apart when the language does not (a Yu Gothic deck whose language is English).
 *
 * `renderOptions` are the host's `toSvg` options: their `catalogs` (core `Catalog[]`) go to core's `resolveScriptFonts`
 * unchanged, and the families the renderer resolves per slide count too, so a scheme that exists only in the host's catalogs
 * and names a script font still loads that font.
 */
function designScripts(presentation, profile, renderOptions) {
  const scripts = new Set();
  let han;
  const note = resolved => {
    for (const family of [resolved?.heading?.latin, resolved?.body?.latin]) {
      const script = scriptOfFamily(family);
      if (!script) continue;
      scripts.add(script);
      if (!han && cjkKeys.includes(script)) han = script;
    }
  };
  note(profile);
  if (Array.isArray(presentation?.slides)) {
    presentation.slides.forEach((slide, slideIndex) => {
      if (!slide || typeof slide !== "object" || !slide.design || typeof slide.design !== "object") return;
      try { note(resolveScriptFonts(presentation, { slideIndex, ...(renderOptions?.catalogs !== undefined ? { catalogs: renderOptions.catalogs } : {}) })); } catch { /* the renderer reports it when it draws the slide */ }
    });
  }
  if (renderOptions?.catalogs) {
    for (const family of presentationFamilies(presentation, renderOptions)) note({ heading: { latin: family }, body: { latin: family } });
  }
  // FF-45: a run or design that names a symbol-encoded family (a Wingdings bullet run, a Symbol heading) needs the symbol faces.
  for (const family of namedFontFamilies(presentation)) if (isSymbolEncodedFamily(family)) scripts.add(SYMBOL_SCRIPT);
  return { scripts: [...scripts].sort(), han };
}

/** Every `fontFamily` string and `design.fonts` role family named anywhere in the document (runs, table cells, slide designs). */
function* namedFontFamilies(value, key) {
  if (typeof value === "string") { if (key === "fontFamily") yield value; return; }
  if (Array.isArray(value)) { for (const child of value) yield* namedFontFamilies(child, key); return; }
  if (!value || typeof value !== "object") return;
  for (const [childKey, child] of Object.entries(value)) {
    if (childKey === "fonts" && child && typeof child === "object" && !Array.isArray(child)) { for (const family of Object.values(child)) if (typeof family === "string") yield family; continue; }
    yield* namedFontFamilies(child, childKey);
  }
}

/**
 * What a preview of the presentation draws: its script profile, the scripts of its text (the renderer's own
 * itemization, so language-dependent punctuation counts), the scripts its font schemes need (`design`, for example
 * Jpan for a Yu Gothic scheme) and the CJK characters that a glyph fallback might have to draw with another CJK face.
 * The text decides, so a document is analyzed without resolving its layouts and catalogs; `renderOptions` (the host's
 * `toSvg` options) matter only for font schemes the host supplies in `renderOptions.catalogs`, which then resolve
 * like the renderer resolves them; a document that then does not resolve throws what `toSvg` throws for it.
 */
export function analyzePresentationScripts(presentation, profile, renderOptions) {
  profile ??= presentationScriptProfile(presentation, renderOptions);
  const scripts = new Set(), cjk = new Set();
  const design = designScripts(presentation, profile, renderOptions);
  // Han-only text in a deck whose language is not CJK draws with the scheme's own CJK face when the scheme names one.
  const itemizing = design.han && !cjkKeys.includes(profile?.script) ? { ...profile, script: design.han } : profile;
  for (const text of drawnStrings(presentation)) {
    for (const script of scriptsOfText(text, itemizing)) scripts.add(script);
    for (const character of text) if (character.codePointAt(0) > 0x2E7F && cjkCharacters.has(scriptOfCharacter(character))) cjk.add(character);
  }
  return { profile, detected: [...scripts].sort(), design: design.scripts, cjk };
}

/**
 * Script keys (ISO 15924: `Jpan`, `Hans`, `Arab`, ...) whose faces a preview of this presentation needs.
 * Text decides, itemized exactly as drawing does: the document language only tells Han text apart
 * (Japanese, Korean, Simplified or Traditional Chinese) and makes curly quotes, dashes and the ellipsis
 * East Asian. Text the preview never draws (ids, alt text, sources, assets, catalogs, notes) is ignored.
 * Greek and Cyrillic add nothing: the office registry always carries Noto Sans (the glyph-fallback face) and Roboto covers them.
 * Pass `profile` to reuse a resolved profile. Other options are the host's `toSvg` options (`catalogs`, see `analyzePresentationScripts`).
 */
export function detectPresentationScripts(presentation, { profile, ...renderOptions } = {}) {
  return analyzePresentationScripts(presentation, profile, renderOptions).detected;
}

/** The scripts of an analysis that a pinned pack serves (`scripts`, the input for `scriptFontPackages`) and those it does not. */
export function scriptSelectionOf(analysis) {
  const served = servedScripts();
  // `scripts` are the faces to load: the text's scripts and the ones its font schemes need; `detected` stays what the text draws.
  const needed = [...new Set([...analysis.detected, ...(analysis.design ?? [])])].sort();
  return { detected: analysis.detected, scripts: needed.filter(script => served.has(script)), unavailable: analysis.detected.filter(script => !served.has(script)) };
}

/**
 * What `scripts: 'auto'` loads for a presentation: the `detected` scripts, those a pinned pack serves
 * (`scripts`, the input for `scriptFontPackages`) and those it does not (`unavailable`, for example
 * Cherokee or Tifinagh, which draw with whatever the design font covers).
 */
export function autoScriptSelection(presentation, options) {
  const { profile, ...renderOptions } = options ?? {};
  return scriptSelectionOf(analyzePresentationScripts(presentation, profile, renderOptions));
}

/**
 * The next CJK package a glyph fallback needs (FF-19): a drawn Han, kana or Hangul character that no loaded
 * script face has (Japanese-only kanji in a Simplified Chinese run, Simplified-only hanzi beside kana, hanja)
 * takes the first unloaded CJK face along the renderer's fallback chain. `covers(character)` says whether a
 * loaded script face has the glyph; `loaded` holds the loaded package names. Undefined when nothing is needed,
 * the renderer has no glyph fallback, or the cap is reached: a character no CJK face covers must not pull in
 * every CJK package (10 to 20 MiB each), so at most ONE fallback package is loaded beyond the packages the
 * text's own scripts need. Characters still uncovered then are reported (`uncoveredCjkCharacters`) and the
 * renderer reports `missing-glyph` for them.
 */
export function nextFallbackPackage(analysis, { covers, loaded }) {
  const packages = BUNDLED_FONT_MANIFEST.packages.filter(item => item.pack === "scripts" && item.scripts.some(script => cjkKeys.includes(script)));
  const primary = new Set([...analysis.detected, ...(analysis.design ?? [])].filter(script => cjkKeys.includes(script))).size;
  if (packages.filter(item => loaded.has(item.name)).length >= primary + 1) return undefined;
  for (const character of analysis.cjk) {
    if (covers(character)) continue;
    for (const family of glyphFallbackFamilies(character, analysis.profile, analysis.profile?.serif === true)) {
      const pkg = packages.find(item => !loaded.has(item.name) && item.faces.some(face => face.family === family));
      if (pkg) return pkg;
    }
  }
  return undefined;
}

/** Drawn Han, kana or Hangul characters (at most `limit`) that no loaded script face covers. */
export function uncoveredCjkCharacters(analysis, { covers, limit = 16 }) {
  return [...analysis.cjk].filter(character => !covers(character)).slice(0, limit);
}
