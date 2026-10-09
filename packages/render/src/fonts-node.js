import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import { createFontRegistry, OPFFontError } from "./font-registry.js";
import { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
import { lazyFontList } from "./lazy-font-list.js";
import { textOutlines } from "./text-paths.js";
import { createSubsetter, fontSubsets } from "./font-subset.js";
import { createShaper } from "./hb-shape.js";
export { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
import { analyzePresentationScripts, autoScriptSelection, nextFallbackPackage, scriptFontPackages, scriptSelectionOf, uncoveredCjkCharacters } from "./script-font-pack.js";
export { autoScriptSelection, detectPresentationScripts, scriptFontPackages } from "./script-font-pack.js";
// Script faces are embedded in a standalone SVG only when the slide's text uses their family.
const embedUsed = entries => entries.map(entry => ({...entry, embed: "used"}));
const require = createRequire(import.meta.url);

async function verifiedFile(file, expected, details) {
  let bytes;
  try { bytes = await readFile(file); }
  catch (error) { throw new OPFFontError("font-resource-unavailable", "Reinstall the pinned font package: a required local resource is unavailable.", {...details, cause: error.code}); }
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) throw new OPFFontError("font-integrity-mismatch", "The local font resource differs from the reviewed font manifest; reinstall the pinned package.", {...details, expected, actual});
  return bytes;
}

// The default Latin, Cyrillic and Greek glyph-fallback face (the office pack always loads it, fallback-only).
const FALLBACK_PACKAGE = "@expo-google-fonts/noto-sans";

// RR-63: every `@expo-google-fonts/*` package is an optional peer dependency, so a host installs only the faces it uses. A request that
// needs packages that are not installed fails once, naming all of them and the install command, instead of one package at a time.
function requireInstalled(packages, what) {
  const missing = packages.filter(pkg => {
    if (pkg.vendored) return false;
    try { require.resolve(`${pkg.name}/package.json`); return false; } catch { return true; }
  });
  if (!missing.length) return;
  const install = `npm install ${missing.map(pkg => `${pkg.name}@${pkg.version}`).join(" ")}`;
  throw new OPFFontError("font-resource-unavailable", `${what} needs font packages that are not installed (optional peer dependencies of @openpresentation/opf-render): run \`${install}\`.`, {packages: missing.map(pkg => pkg.name), install});
}

// `skipped`: an optional npm package that is not installed is recorded there instead of failing (scripts: 'auto').
// `fallbackOnly`: the faces serve glyph fallback and requests by their own name, never a replacement for another family.
// `what`: how the request is named in the error for a package that is not installed, for example "The 'office' font pack".
async function loadPackages(packages, skipped, {fallbackOnly = false, what = "This font request"} = {}) {
  const entries = [], fontFiles = [];
  if (!skipped) requireInstalled(packages, what);
  for (const pkg of packages) {
    if (pkg.vendored) {
      // FF-31: vendored faces ship inside this package (pkg.vendored, for example fonts/carlito), hash-pinned like the npm packs. The open pack is
      // embedded in an SVG only when the slide's text names the family (embed "used"); raster output reads the files.
      const directory = fileURLToPath(new URL(`../${pkg.vendored}/`, import.meta.url));
      let license = (await verifiedFile(path.join(directory, pkg.licenseFile), pkg.licenseSha256, {package:pkg.name, file:pkg.licenseFile})).toString("utf8");
      // A notice file carries provenance and upstream copyright lines that the upstream license file omits.
      if (pkg.noticeFile) license += "\n\n" + (await verifiedFile(path.join(directory, pkg.noticeFile), pkg.noticeSha256, {package:pkg.name, file:pkg.noticeFile})).toString("utf8");
      // One rule for the vendored faces the SVG embeds only when its text names them: the open pack and any package flagged embed "used" (Intos).
      const lazy = pkg.pack === "open" || pkg.embed === "used";
      for (const face of pkg.faces) {
        const file = path.join(directory, face.file);
        const data = await verifiedFile(file, face.sha256, {package:pkg.name, file:face.file});
        fontFiles.push(file);
        entries.push({data:new Uint8Array(data), family:face.family, weight:face.weight, italic:face.italic, license, ...(lazy ? {embed:"used"} : {})});
      }
      continue;
    }
    let manifestPath, installed;
    try {
      manifestPath = require.resolve(`${pkg.name}/package.json`);
      installed = JSON.parse(await readFile(manifestPath, "utf8"));
    } catch (error) {
      if (skipped) { skipped.push({package: pkg.name, version: pkg.version, scripts: [...pkg.scripts]}); continue; }
      throw new OPFFontError("font-resource-unavailable", `Install ${pkg.name}@${pkg.version} to use ${what}.`, {package:pkg.name, cause:error.code});
    }
    if (installed.version !== pkg.version) throw new OPFFontError("font-version-mismatch", `Expected ${pkg.name}@${pkg.version}; reinstall the pinned package.`, {package:pkg.name, expected:pkg.version, actual:installed.version});
    const directory = path.dirname(manifestPath);
    const license = (await verifiedFile(path.join(directory, pkg.licenseFile), pkg.licenseSha256, {package:pkg.name, file:pkg.licenseFile})).toString("utf8");
    for (const face of pkg.faces) {
      const file = path.join(directory, face.file);
      const data = await verifiedFile(file, face.sha256, {package:pkg.name, file:face.file});
      fontFiles.push(file);
      entries.push({data:new Uint8Array(data), family:face.family, weight:face.weight, italic:face.italic, license, ...(pkg.scripts ? {scripts:[...pkg.scripts]} : {}), ...(fallbackOnly ? {fallbackOnly:true, embed:"used"} : {})});
    }
  }
  return {entries, fontFiles, packages:packages.map(pkg => pkg.name)};
}

// A package that is the renamed successor of a family (Source Sans 3, formerly Source Sans Pro) answers to the
// old name through a built-in alias, reported visual like other aliases; it is not a claim of the old face.
const renamedAliases = () => Object.fromEntries(BUNDLED_FONT_MANIFEST.packages.filter(item => item.pack === "open" && item.renamedFrom).map(item => [item.renamedFrom, item.faces[0].family]));
// The vendored faces this registry holds that are embed "used": a host that serves fonts itself lists them to copy their files.
const lazyOf = registry => lazyFontList().filter(face => registry.describeFaces().some(held => held.family === face.family && held.weight === face.weight && held.italic === face.italic));
const loadPack = pack => loadPackages(BUNDLED_FONT_MANIFEST.packages.filter(item => item.pack === pack), undefined, {what: `The '${pack}' font pack`});

/**
 * Adds the script pack. `scripts` is 'all', ISO 15924 codes, or 'auto' (FF-19): detect the scripts the
 * `presentation` draws and load only their faces. Auto never fails on a missing optional package or a
 * script no pinned font serves; it reports them through `onDiagnostic` and `selection`. `renderOptions` are the host's `toSvg`
 * options (see `analyzePresentationScripts`).
 */
async function withScripts(loaded, scripts, {presentation, onDiagnostic, renderOptions} = {}) {
  if (scripts === undefined || (Array.isArray(scripts) && !scripts.length)) return loaded;
  // A package the registry already loaded (the default Noto Sans fallback) is never loaded twice.
  const notLoaded = list => list.filter(pkg => !loaded.packages?.includes(pkg.name));
  if (scripts !== "auto") {
    const extra = await loadPackages(notLoaded(scriptFontPackages(scripts)), undefined, {what: `The requested script fonts (${Array.isArray(scripts) ? scripts.join(", ") : scripts})`});
    return {...loaded, entries:[...loaded.entries, ...embedUsed(extra.entries)], fontFiles:[...loaded.fontFiles, ...extra.fontFiles], packages:[...(loaded.packages ?? []), ...extra.packages]};
  }
  if (presentation === null || typeof presentation !== "object") throw new OPFFontError("invalid-font-scripts", "scripts: 'auto' needs the presentation whose text decides the scripts.", {scripts});
  const selection = scriptSelectionOf(analyzePresentationScripts(presentation, undefined, renderOptions)), skipped = [];
  const extra = await loadPackages(notLoaded(scriptFontPackages(selection.scripts)), skipped);
  for (const script of selection.unavailable) onDiagnostic?.({code: "script-font-unavailable", script, message: `No pinned open font serves script '${script}'; that text uses the design font.`});
  for (const item of skipped) onDiagnostic?.({code: "script-font-not-installed", package: item.package, scripts: item.scripts, message: `Install ${item.package}@${item.version} to preview ${item.scripts.join(", ")} text with its designated open font.`});
  return {entries:[...loaded.entries, ...embedUsed(extra.entries)], fontFiles:[...loaded.fontFiles, ...extra.fontFiles], packages:[...(loaded.packages ?? []), ...extra.packages],
    selection:{...selection, packages: scriptFontPackages(selection.scripts).map(item => item.name).filter(name => !skipped.some(item => item.package === name)), notInstalled: skipped.map(item => item.package)}};
}

/**
 * scripts: 'auto' with glyph fallback (FF-19): a drawn Han, kana or Hangul character that no loaded script face
 * has (Japanese-only kanji in a Simplified Chinese run, hanja) needs the next CJK face along the fallback chain.
 * Adds those packages to the registry and its fontFiles until every such character is covered or the chain ends.
 */
async function completeFallback(registry, presentation, loaded, onDiagnostic, renderOptions) {
  const selection = loaded.selection;
  if (!selection) return;
  const seen = new Set([...(loaded.packages ?? []), ...selection.packages, ...selection.notInstalled]);
  for (;;) {
    const analysis = analyzePresentationScripts(presentation, undefined, renderOptions), covers = character => registry.scriptFacesCover(character);
    const next = nextFallbackPackage(analysis, {covers, loaded: seen});
    if (!next) {
      const uncovered = uncoveredCjkCharacters(analysis, {covers, limit: 8});
      if (uncovered.length) { selection.uncovered = uncovered; onDiagnostic?.({code: "script-glyph-uncovered", characters: uncovered, message: `No loaded script face has ${uncovered.map(character => "U+" + character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")).join(", ")}; the preview reports missing-glyph for them.`}); }
      return;
    }
    seen.add(next.name);
    const skipped = [], extra = await loadPackages([next], skipped);
    if (skipped.length) {
      selection.notInstalled.push(next.name);
      onDiagnostic?.({code: "script-font-not-installed", package: next.name, scripts: [...next.scripts], message: `Install ${next.name}@${next.version} for glyphs the loaded CJK faces lack.`});
      continue;
    }
    registry.addFaces(embedUsed(extra.entries));
    loaded.fontFiles.push(...extra.fontFiles);
    loaded.packages?.push(next.name);
    selection.packages.push(next.name);
  }
}

/** FF-31: caller-supplied faces, for example the caller's own licensed Aptos files. Plain
 * FontFaceInput entries; Node callers may pass `path` instead of `data`. They come first, so the
 * real family resolves as an exact face ahead of any replacement. */
async function callerFaces(faces = []) {
  if (!Array.isArray(faces)) throw new OPFFontError("invalid-font-data", "faces must be an array of font entries.");
  const entries = [], fontFiles = [];
  for (const face of faces) {
    if (face?.data instanceof Uint8Array) { entries.push(face); continue; }
    if (typeof face?.path !== "string") throw new OPFFontError("invalid-font-data", "Each caller face needs data (Uint8Array) or a file path.");
    let data;
    try { data = await readFile(face.path); } catch (error) { throw new OPFFontError("font-resource-unavailable", `Cannot read caller font file ${face.path}.`, {file:face.path, cause:error.code}); }
    const {path:file, ...rest} = face;
    entries.push({...rest, data:new Uint8Array(data)});
    fontFiles.push(path.resolve(file));
  }
  return {entries, fontFiles};
}

async function withFaces(loaded, faces) {
  if (!faces?.length) return loaded;
  const own = await callerFaces(faces);
  return {...loaded, entries:[...own.entries, ...loaded.entries], fontFiles:[...own.fontFiles, ...loaded.fontFiles]};
}

/**
 * Build the registry of a pack: `base` (the bundled Roboto faces), `office` (the metric and visual substitutes for the Office
 * families plus the open families font schemes select, FF-31, optionally alongside the base) or `none` (only the caller's
 * `faces`). Returns the live registry and what was loaded (`entries`, `fontFiles`, `packages`, `selection`), which `ensure` extends.
 */
async function buildRegistry(pack, {scripts, faces, presentation, onDiagnostic, renderOptions, ...options}) {
  let loaded, registryOptions = options;
  // RR-63: name every npm font package the pack needs at once, before loading any of them.
  if (pack === "base" || pack === "office") {
    const packs = pack === "base" ? ["base"] : ["office", ...(options.includeBaseFonts === false ? [] : ["base"])];
    requireInstalled([...BUNDLED_FONT_MANIFEST.packages.filter(item => packs.includes(item.pack)), ...(pack === "office" ? scriptFontPackages(["Latn"]) : [])], `The '${pack}' font pack`);
  }
  if (pack === "office") {
    const {entries, fontFiles, packages} = await loadPack("office");
    for (const [include, name] of [[options.includeOpenFonts, "open"], [options.includeBaseFonts, "base"]]) {
      if (include === false) continue;
      const extra = await loadPack(name);
      fontFiles.push(...extra.fontFiles);
      entries.push(...extra.entries);
      packages.push(...extra.packages);
    }
    // Noto Sans (regular, bold, italic, bold italic) is the default Latin, Cyrillic and Greek fallback face
    // (glyph fallback), so Georgia with Russian text previews without the scripts option. It is embedded in an
    // SVG only when the slide's text draws it (embed "used"); raster output reads it from fontFiles. Unless the
    // caller asked for it with scripts it is fallback-only, so no other family's preview changes. "auto" counts as asking for it when the
    // presentation itself selects Latn (a Sylfaen scheme: Noto Sans is its designated replacement, which a fallback-only face never is), as
    // an explicit list does; a presentation that does not select Latn keeps it fallback-only.
    const requested = scripts === "auto" && presentation !== null && typeof presentation === "object" ? scriptFontPackages(autoScriptSelection(presentation, renderOptions).scripts).map(pkg => pkg.name)
      : scripts === undefined || scripts === "auto" || (Array.isArray(scripts) && !scripts.length) ? [] : scriptFontPackages(scripts).map(pkg => pkg.name);
    const fallback = await loadPackages(scriptFontPackages(["Latn"]).filter(pkg => !requested.includes(pkg.name)), undefined, {fallbackOnly:true, what: "The 'office' font pack (its default glyph-fallback face)"});
    fontFiles.push(...fallback.fontFiles);
    entries.push(...fallback.entries);
    packages.push(...fallback.packages);
    loaded = await withFaces(await withScripts({entries, fontFiles, packages}, scripts, {presentation, onDiagnostic, renderOptions}), faces);
    // A package that is the renamed successor of a family answers to the old name through a built-in alias.
    const aliases = options.includeOpenFonts === false ? options.aliases : {...renamedAliases(), ...options.aliases};
    registryOptions = {substitutionPolicy:"metric", ...options, ...(aliases ? {aliases} : {})};
  } else {
    loaded = await withFaces(await withScripts(pack === "none" ? {entries:[], fontFiles:[], packages:[]} : await loadPack("base"), scripts, {presentation, onDiagnostic, renderOptions}), faces);
  }
  loaded.packages ??= [];
  const registry = Object.assign(createFontRegistry(loaded.entries, registryOptions), {fontFiles: loaded.fontFiles, ...(loaded.selection ? {scriptSelection: loaded.selection} : {})});
  registry.lazyFonts = lazyOf(registry);
  await completeFallback(registry, presentation, loaded, onDiagnostic, renderOptions);
  return {registry, loaded};
}

/**
 * Load the faces a text needs that this handle does not hold yet: what `scripts: "auto"` does at load, run again for another
 * presentation (an edit that adds a script, another deck on the same handle). Cheap when nothing is needed. A package that is not
 * installed, or a script no pinned font serves, is reported once through `onDiagnostic`. Resolves with the script packages this
 * call added (`scripts`; `lazy` is always empty here: Node loads every vendored face with its pack) and the drawn CJK
 * characters no loaded face covers.
 */
async function ensureFonts(registry, loaded, presentation, {onDiagnostic, renderOptions} = {}) {
  if (presentation === null || typeof presentation !== "object") throw new OPFFontError("invalid-font-scripts", "ensure needs the presentation whose text decides the scripts.");
  const selection = (loaded.selection ??= {detected: [], scripts: [], unavailable: [], packages: [], notInstalled: []});
  registry.scriptSelection = selection;
  const before = loaded.packages.length;
  const wanted = scriptSelectionOf(analyzePresentationScripts(presentation, undefined, renderOptions));
  const held = new Set([...loaded.packages, ...selection.notInstalled]);
  const skipped = [];
  const extra = await loadPackages(scriptFontPackages(wanted.scripts).filter(pkg => !held.has(pkg.name)), skipped);
  if (extra.entries.length) registry.addFaces(embedUsed(extra.entries));
  loaded.fontFiles.push(...extra.fontFiles);
  loaded.packages.push(...extra.packages);
  selection.packages.push(...extra.packages);
  for (const item of skipped) {
    selection.notInstalled.push(item.package);
    onDiagnostic?.({code: "script-font-not-installed", package: item.package, scripts: item.scripts, message: `Install ${item.package}@${item.version} to preview ${item.scripts.join(", ")} text with its designated open font.`});
  }
  for (const script of wanted.unavailable) if (!selection.unavailable.includes(script)) {
    selection.unavailable.push(script);
    onDiagnostic?.({code: "script-font-unavailable", script, message: `No pinned open font serves script '${script}'; that text uses the design font.`});
  }
  await completeFallback(registry, presentation, loaded, onDiagnostic, renderOptions);
  return {scripts: loaded.packages.slice(before), lazy: [], uncovered: selection.uncovered ? [...selection.uncovered] : []};
}

// RR-65: hb-subset from the pinned harfbuzzjs package (MIT), compiled once per process. The module has no imports, so it is
// instantiated synchronously and toSvg stays synchronous. A copy that cannot be loaded leaves the handle without `subsets`
// (whole faces, as before RR-65): a byte saving never stops fonts from loading.
let subsetterPromise;
function nodeSubsetter() {
  subsetterPromise ??= readFile(require.resolve("harfbuzzjs/dist/harfbuzz-subset.wasm")).then(createSubsetter, () => null).catch(() => null);
  return subsetterPromise;
}

// RR-64 phase 2: HarfBuzz's shaper (harfbuzz.wasm of the same package) for text drawn as outlines, so the outlines are shaped as
// a browser shapes the text. Without it outlines are shaped with fontkit.
let shaperPromise;
function nodeShaper() {
  shaperPromise ??= readFile(require.resolve("harfbuzzjs/dist/harfbuzz.wasm")).then(createShaper, () => null).catch(() => null);
  return shaperPromise;
}

/**
 * The fonts handle: one set of verified font inputs for layout, SVG, editor, PPTX and Node raster export. Pass it as `{ fonts }` to
 * `toSvg`, `toPng`, `toPdf`, core `paginate` and `validate`, and `toPptx`.
 *
 * Bundled, openly licensed faces only: no system font discovery and no network requests. `pack`: `base` (default, Roboto),
 * `office` (the Office substitutes and the open families) or `none` (only the `faces` you supply). Everything else
 * (`substitutionPolicy`, `aliases`, `fallbackFamily`, `themeFonts`, `strictGlyphs`, `includeBaseFonts`, `includeOpenFonts`,
 * `faces`, `scripts`, `presentation`, `onDiagnostic`, `renderOptions`) goes to the registry. `embedScriptFonts` embeds the large script
 * faces in standalone SVG (default false: raster output reads them from `fontFiles`).
 */
export async function loadFonts({pack = "base", embedScriptFonts = false, ...options} = {}) {
  if (pack !== "base" && pack !== "office" && pack !== "none") throw new OPFFontError("invalid-font-pack", "Choose the base, office or none font pack.", {pack});
  const {registry, loaded} = await buildRegistry(pack, options);
  // Script faces are large (CJK faces are 5-10 MB each). Raster output reads them from fontFiles; embed them in standalone SVG only
  // on request. The default Noto Sans fallback is always offered (embed "used"), so an SVG carries it exactly when its text draws it.
  const selectEmbedded = () => registry.selectEmbeddedFonts(face => embedScriptFonts || !face.scripts || face.fallbackOnly);
  // The embedded list is base64 of every face: computed on first use, and again after `ensure` added faces.
  let embeddedFonts, fontFiles = [...registry.fontFiles];
  const refresh = () => { embeddedFonts = undefined; fontFiles = [...registry.fontFiles]; };
  const [subsetter, shaper] = await Promise.all([nodeSubsetter(), nodeShaper()]);
  return {
    textMeasurement: registry.textMeasurement,
    get embeddedFonts() { return (embeddedFonts ??= selectEmbedded()); },
    get fontFiles() { return fontFiles; },
    useBundledFonts: false,
    loadSystemFonts: false,
    registry,
    // RR-64: the outline engine `toSvg(deck, { fonts, text: "paths" })` draws text with, over this registry's faces.
    outlines: textOutlines({ registry, shaper }),
    // RR-65: the subset engine that cuts each face an SVG embeds to the characters the slide draws.
    ...(subsetter ? { subsets: fontSubsets(registry, subsetter) } : {}),
    manifest: BUNDLED_FONT_MANIFEST,
    get substitutions() { return registry.substitutions; },
    /** Load the script faces the presentation's text needs (see `ensureFonts`); `embeddedFonts` and `fontFiles` then include them. */
    async ensure(presentation, callOptions = {}) {
      const result = await ensureFonts(registry, loaded, presentation, {onDiagnostic: callOptions.onDiagnostic ?? options.onDiagnostic, renderOptions: {...options.renderOptions, ...callOptions.renderOptions}});
      refresh();
      return result;
    },
    /** Synchronous: the script packages the presentation needs that are not loaded yet. Empty means `ensure` loads nothing. */
    pending(presentation, renderOptions) {
      const held = new Set([...loaded.packages, ...(loaded.selection?.notInstalled ?? [])]);
      const analysis = analyzePresentationScripts(presentation, undefined, {...options.renderOptions, ...renderOptions});
      const primary = scriptFontPackages(scriptSelectionOf(analysis).scripts).map(pkg => pkg.name).filter(name => !held.has(name));
      if (primary.length) return primary;
      const next = nextFallbackPackage(analysis, {covers: character => registry.scriptFacesCover(character), loaded: held});
      return next ? [next.name] : [];
    },
  };
}
