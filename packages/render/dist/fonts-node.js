import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import { createFontRegistry, OPFFontError } from "./fonts.js";
import { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
import { lazyFontList } from "./lazy-font-list.js";
export { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
import { analyzePresentationScripts, nextFallbackPackage, scriptFontPackages, scriptSelectionOf, uncoveredCjkCharacters } from "./script-font-pack.js";
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

// `skipped`: an optional npm package that is not installed is recorded there instead of failing (scripts: 'auto').
// `fallbackOnly`: the faces serve glyph fallback and requests by their own name, never a replacement for another family.
async function loadPackages(packages, skipped, {fallbackOnly = false} = {}) {
  const entries = [], fontFiles = [];
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
      throw new OPFFontError("font-resource-unavailable", `Install ${pkg.name}@${pkg.version} to use this offline font pack.`, {package:pkg.name, cause:error.code});
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
const loadPack = pack => loadPackages(BUNDLED_FONT_MANIFEST.packages.filter(item => item.pack === pack));

/**
 * Adds the script pack. `scripts` is 'all', ISO 15924 codes, or 'auto' (FF-19): detect the scripts the
 * `presentation` draws and load only their faces. Auto never fails on a missing optional package or a
 * script no pinned font serves; it reports them through `onDiagnostic` and `selection`.
 */
async function withScripts(loaded, scripts, {presentation, onDiagnostic} = {}) {
  if (scripts === undefined || (Array.isArray(scripts) && !scripts.length)) return loaded;
  // A package the registry already loaded (the default Noto Sans fallback) is never loaded twice.
  const notLoaded = list => list.filter(pkg => !loaded.packages?.includes(pkg.name));
  if (scripts !== "auto") {
    const extra = await loadPackages(notLoaded(scriptFontPackages(scripts)));
    return {...loaded, entries:[...loaded.entries, ...embedUsed(extra.entries)], fontFiles:[...loaded.fontFiles, ...extra.fontFiles], packages:[...(loaded.packages ?? []), ...extra.packages]};
  }
  if (presentation === null || typeof presentation !== "object") throw new OPFFontError("invalid-font-scripts", "scripts: 'auto' needs the presentation whose text decides the scripts.", {scripts});
  const selection = scriptSelectionOf(analyzePresentationScripts(presentation)), skipped = [];
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
async function completeFallback(registry, presentation, loaded, onDiagnostic) {
  const selection = loaded.selection;
  if (!selection) return;
  const seen = new Set([...selection.packages, ...selection.notInstalled]);
  for (;;) {
    const analysis = analyzePresentationScripts(presentation), covers = character => registry.scriptFacesCover(character);
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

/** Bundled, openly licensed faces. No system font discovery or network requests. */
export async function loadBundledFontRegistry({scripts, faces, presentation, onDiagnostic, ...options} = {}) {
  const {entries, fontFiles, selection} = await withFaces(await withScripts(await loadPack("base"), scripts, {presentation, onDiagnostic}), faces);
  const registry = Object.assign(createFontRegistry(entries,options),{fontFiles, ...(selection ? {scriptSelection: selection} : {})});
  registry.lazyFonts = lazyOf(registry);
  await completeFallback(registry, presentation, {fontFiles, selection}, onDiagnostic);
  return registry;
}

/** Office substitutes plus the open families that font schemes select (FF-31),
 * optionally alongside the base Roboto pack. `includeOpenFonts: false` leaves the open families out. */
export async function loadOfficeFontRegistry({scripts, faces, presentation, onDiagnostic, ...options} = {}) {
  const {entries, fontFiles, packages} = await loadPack("office");
  for (const [include, pack] of [[options.includeOpenFonts, "open"], [options.includeBaseFonts, "base"]]) {
    if (include === false) continue;
    const extra = await loadPack(pack);
    fontFiles.push(...extra.fontFiles);
    entries.push(...extra.entries);
    packages.push(...extra.packages);
  }
  // Noto Sans (regular, bold, italic, bold italic) is the default Latin, Cyrillic and Greek fallback face
  // (glyph fallback), so Georgia with Russian text previews without the scripts option. It is embedded in an
  // SVG only when the slide's text draws it (embed "used"); raster output reads it from fontFiles. Unless the
  // caller asked for it with scripts it is fallback-only, so no other family's preview changes.
  const requested = scripts === undefined || scripts === "auto" || (Array.isArray(scripts) && !scripts.length) ? [] : scriptFontPackages(scripts).map(pkg => pkg.name);
  const fallback = await loadPackages(scriptFontPackages(["Latn"]).filter(pkg => !requested.includes(pkg.name)), undefined, {fallbackOnly:true});
  fontFiles.push(...fallback.fontFiles);
  entries.push(...fallback.entries);
  packages.push(...fallback.packages);
  const loaded = await withFaces(await withScripts({entries, fontFiles, packages}, scripts, {presentation, onDiagnostic}), faces);
  const aliases = options.includeOpenFonts === false ? options.aliases : {...renamedAliases(), ...options.aliases};
  const registry = Object.assign(createFontRegistry(loaded.entries,{substitutionPolicy:"metric",...options,...(aliases?{aliases}:{})}),{fontFiles:loaded.fontFiles, ...(loaded.selection ? {scriptSelection: loaded.selection} : {})});
  registry.lazyFonts = lazyOf(registry);
  await completeFallback(registry, presentation, loaded, onDiagnostic);
  return registry;
}

/** One set of verified font inputs for layout, SVG, editor, PPTX, and Node raster export. */
export async function prepareNodeFonts({pack = "base", embedScriptFonts = false, ...options} = {}) {
  if (pack !== "base" && pack !== "office") throw new OPFFontError("invalid-font-pack", "Choose the base or office font pack.", {pack});
  const registry = await (pack === "base" ? loadBundledFontRegistry(options) : loadOfficeFontRegistry(options));
  // Script faces are large (CJK faces are 5-10 MB each). Raster output reads them
  // from fontFiles; embed them in standalone SVG only on request. The default Noto Sans fallback is always offered
  // (embed "used"), so an SVG carries it exactly when its text draws it.
  const embeddedFonts = registry.selectEmbeddedFonts(face => embedScriptFonts || !face.scripts || face.fallbackOnly);
  return {
    registry,
    manifest:BUNDLED_FONT_MANIFEST,
    options:{
      textMeasurement:registry.textMeasurement,
      embeddedFonts,
      fontFiles:[...registry.fontFiles],
      useBundledFonts:false,
      loadSystemFonts:false,
    },
  };
}
