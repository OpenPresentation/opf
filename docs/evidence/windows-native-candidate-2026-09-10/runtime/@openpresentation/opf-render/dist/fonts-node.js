import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { createHash } from "node:crypto";
import { createFontRegistry, OPFFontError } from "./fonts.js";
import { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
export { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
const require = createRequire(import.meta.url);

async function verifiedFile(file, expected, details) {
  let bytes;
  try { bytes = await readFile(file); }
  catch (error) { throw new OPFFontError("font-resource-unavailable", "Reinstall the pinned font package: a required local resource is unavailable.", {...details, cause: error.code}); }
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) throw new OPFFontError("font-integrity-mismatch", "The local font resource differs from the reviewed font manifest; reinstall the pinned package.", {...details, expected, actual});
  return bytes;
}

async function loadPack(pack) {
  const entries = [], fontFiles = [];
  for (const pkg of BUNDLED_FONT_MANIFEST.packages.filter(item => item.pack === pack)) {
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
      entries.push({data:new Uint8Array(data), family:face.family, weight:face.weight, italic:face.italic, license});
    }
  }
  return {entries, fontFiles};
}

/** Bundled, openly licensed faces. No system font discovery or network requests. */
export async function loadBundledFontRegistry(options = {}) {
  const {entries, fontFiles} = await loadPack("base");
  return Object.assign(createFontRegistry(entries,options),{fontFiles});
}

/** Six pinned open-source Office substitutes, optionally alongside the base Roboto pack. */
export async function loadOfficeFontRegistry(options = {}) {
  const {entries, fontFiles} = await loadPack("office");
  if (options.includeBaseFonts !== false) {
    const base = await loadPack("base");
    fontFiles.push(...base.fontFiles);
    entries.push(...base.entries);
  }
  return Object.assign(createFontRegistry(entries,{substitutionPolicy:"metric",...options}),{fontFiles});
}

/** One set of verified font inputs for layout, SVG, editor, PPTX, and Node raster export. */
export async function prepareNodeFonts({pack = "base", ...options} = {}) {
  if (pack !== "base" && pack !== "office") throw new OPFFontError("invalid-font-pack", "Choose the base or office font pack.", {pack});
  const registry = await (pack === "base" ? loadBundledFontRegistry(options) : loadOfficeFontRegistry(options));
  return {
    registry,
    manifest:BUNDLED_FONT_MANIFEST,
    options:{
      textMeasurement:registry.textMeasurement,
      embeddedFonts:registry.embeddedFonts,
      fontFiles:[...registry.fontFiles],
      useBundledFonts:false,
      loadSystemFonts:false,
    },
  };
}
