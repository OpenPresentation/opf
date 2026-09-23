// Optional script font pack (FF-19): pinned, hash-verified OFL Noto faces that
// stand in for proprietary script fonts in previews. The packages are optional
// peers, so the renderer install stays small; hosts install only what they use.
import { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
import { OPFFontError } from "./fonts.js";

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
 * which `loadBrowserFontRegistry` verifies before use.
 */
export function scriptFontEntries(scripts, {baseUrl}) {
  if (typeof baseUrl !== "string" || !baseUrl) throw new OPFFontError("invalid-font-source", "scriptFontEntries requires the baseUrl that serves the installed font packages.");
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return scriptFontPackages(scripts).flatMap(pkg => pkg.faces.map(face => ({
    url: `${root}${pkg.name.split("/").pop()}/${face.file}`,
    family: face.family, weight: face.weight, italic: face.italic, sha256: face.sha256,
    scripts: [...pkg.scripts], package: `${pkg.name}@${pkg.version}`, license: pkg.license,
  })));
}
