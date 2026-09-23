import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { createHash } from "node:crypto";
import { createFontRegistry, OPFFontError } from "./fonts.js";
import { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
export { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
import { scriptFontPackages } from "./script-font-pack.js";
export { scriptFontPackages } from "./script-font-pack.js";
const require = createRequire(import.meta.url);

async function verifiedFile(file, expected, details) {
  let bytes;
  try { bytes = await readFile(file); }
  catch (error) { throw new OPFFontError("font-resource-unavailable", "Reinstall the pinned font package: a required local resource is unavailable.", {...details, cause: error.code}); }
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) throw new OPFFontError("font-integrity-mismatch", "The local font resource differs from the reviewed font manifest; reinstall the pinned package.", {...details, expected, actual});
  return bytes;
}

async function loadPackages(packages) {
  const entries = [], fontFiles = [];
  for (const pkg of packages) {
    let manifestPath, installed;
    try {
      manifestPath = require.resolve(`${pkg.name}/package.json`);
      installed = JSON.parse(await readFile(manifestPath, "utf8"));
    } catch (error) {
      throw new OPFFontError("font-resource-unavailable", `Install ${pkg.name}@${pkg.version} to use this offline font pack.`, {package:pkg.name, cause:error.code});
    }
    if (installed.version !== pkg.version) throw new OPFFontError("font-version-mismatch", `Expected ${pkg.name}@${pkg.version}; reinstall the pinned package.`, {package:pkg.name, expected:pkg.version, actual:installed.version});
    const directory = path.dirname(manifestPath);
    const license = (await verifiedFile(path.join(directory, pkg.licenseFile), pkg.licenseSha256, {package:pkg.name, file:pkg.licenseFile})).toString("utf8");
    for (const face of pkg.faces) {
      const file = path.join(directory, face.file);
      const data = await verifiedFile(file, face.sha256, {package:pkg.name, file:face.file});
      fontFiles.push(file);
      entries.push({data:new Uint8Array(data), family:face.family, weight:face.weight, italic:face.italic, license, ...(pkg.scripts ? {scripts:[...pkg.scripts]} : {})});
    }
  }
  return {entries, fontFiles};
}

const loadPack = pack => loadPackages(BUNDLED_FONT_MANIFEST.packages.filter(item => item.pack === pack));

async function withScripts(loaded, scripts) {
  if (scripts === undefined || (Array.isArray(scripts) && !scripts.length)) return loaded;
  const extra = await loadPackages(scriptFontPackages(scripts));
  return {entries:[...loaded.entries, ...extra.entries], fontFiles:[...loaded.fontFiles, ...extra.fontFiles]};
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
  return {entries:[...own.entries, ...loaded.entries], fontFiles:[...own.fontFiles, ...loaded.fontFiles]};
}

/** Bundled, openly licensed faces. No system font discovery or network requests. */
export async function loadBundledFontRegistry({scripts, faces, ...options} = {}) {
  const {entries, fontFiles} = await withFaces(await withScripts(await loadPack("base"), scripts), faces);
  return Object.assign(createFontRegistry(entries,options),{fontFiles});
}

/** Six pinned open-source Office substitutes, optionally alongside the base Roboto pack. */
export async function loadOfficeFontRegistry({scripts, faces, ...options} = {}) {
  const {entries, fontFiles} = await loadPack("office");
  if (options.includeBaseFonts !== false) {
    const base = await loadPack("base");
    fontFiles.push(...base.fontFiles);
    entries.push(...base.entries);
  }
  const loaded = await withFaces(await withScripts({entries, fontFiles}, scripts), faces);
  return Object.assign(createFontRegistry(loaded.entries,{substitutionPolicy:"metric",...options}),{fontFiles:loaded.fontFiles});
}

/** One set of verified font inputs for layout, SVG, editor, PPTX, and Node raster export. */
export async function prepareNodeFonts({pack = "base", embedScriptFonts = false, ...options} = {}) {
  if (pack !== "base" && pack !== "office") throw new OPFFontError("invalid-font-pack", "Choose the base or office font pack.", {pack});
  const registry = await (pack === "base" ? loadBundledFontRegistry(options) : loadOfficeFontRegistry(options));
  // Script faces are large (CJK faces are 5-10 MB each). Raster output reads them
  // from fontFiles; embed them in standalone SVG only on request.
  const embeddedFonts = registry.selectEmbeddedFonts(face => embedScriptFonts || !face.scripts);
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
