import { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
import { OPFFontError } from "./font-registry.js";

// FF-31: the vendored faces (the open families and Intos) are not in a registry's eager list. Browser hosts load them
// on demand from separate hash-pinned files; Node hosts and build scripts list them to copy the files.

/** Every vendored face: family, style, its file relative to the package root, its pinned sha256 and its package. */
export function lazyFontList(manifest = BUNDLED_FONT_MANIFEST) {
  return Object.freeze(manifest.packages.filter(pkg => pkg.vendored && (pkg.pack === "open" || pkg.embed === "used")).flatMap(pkg => pkg.faces.map(face => Object.freeze({
    package: pkg.name, family: face.family, weight: face.weight, italic: face.italic,
    file: `${pkg.vendored}/${face.file}`, sha256: face.sha256, license: pkg.license,
    ...(pkg.renamedFrom ? { renamedFrom: pkg.renamedFrom } : {}),
  }))));
}

/**
 * Hash-pinned browser entries for the vendored faces, served by the host from `baseUrl` at their package-relative paths. A face
 * that carries its own `url` (a host's extra lazy face, FF-41) keeps it; `baseUrl` is then needed only for the faces without one.
 */
export function lazyFontEntries(options, list = lazyFontList()) {
  const baseUrl = options?.baseUrl;
  const needsBase = list.some(face => typeof face.url !== "string");
  if (needsBase && (typeof baseUrl !== "string" || !baseUrl)) throw new OPFFontError("invalid-font-source", "lazyFontEntries needs a baseUrl, where the host serves the package's fonts directory.");
  const base = needsBase ? (baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`) : "";
  return list.map(face => ({ url: typeof face.url === "string" ? face.url : `${base}${face.file}`, family: face.family, weight: face.weight, italic: face.italic, sha256: face.sha256, package: face.package, ...(face.license ? { license: face.license } : {}) }));
}

/** Roboto Regular, the renderer's fallback family: the face a browser registry starts with. */
const isRobotoRegular = face => face?.family === "Roboto" && face.weight === 400 && !face.italic;

/**
 * Split a list of faces (a host's manifest, `registry.embeddedFonts`) into the ones a registry starts with and the rest, which a
 * host passes as `extraLazyFonts` so they load on demand. By default the startup set is Roboto Regular, the fallback family; pass
 * `startup` to choose other faces (for example the ones `presentationFaces` says the first deck draws). Order is kept.
 * @template {{family: string, weight: number, italic?: boolean}} T
 * @param {readonly T[]} faces
 * @param {{startup?: (face: T) => boolean}} [options]
 * @returns {{startup: T[], rest: T[]}}
 */
export function splitStartupFaces(faces, options = {}) {
  const test = options.startup ?? isRobotoRegular;
  if (typeof test !== "function") throw new OPFFontError("invalid-font-source", "splitStartupFaces: startup must be a function.");
  const startup = [], rest = [];
  for (const face of faces) (test(face) ? startup : rest).push(face);
  return { startup, rest };
}

/**
 * Validate a host's extra lazy faces (`{family, weight, italic, url, sha256, license?}`) and shape them like the vendored ones
 * (`package: "host"`, `file` = `url`). The SHA-256 is mandatory: the registry verifies every byte it adds.
 */
export function normalizeExtraLazyFonts(faces) {
  if (faces === undefined) return [];
  if (!Array.isArray(faces)) throw new OPFFontError("invalid-font-source", "extraLazyFonts must be an array of {family, weight, italic, url, sha256} entries.");
  const seen = new Set();
  return faces.map((face, index) => {
    const label = `extraLazyFonts[${index}]`;
    if (typeof face?.family !== "string" || !face.family.trim() || /[\u0000-\u001f"'\\<>;]/.test(face.family)) throw new OPFFontError("invalid-font-source", `${label} needs a plain family name.`);
    if (!Number.isInteger(face.weight) || face.weight < 1 || face.weight > 1000) throw new OPFFontError("invalid-font-source", `${label} needs a weight between 1 and 1000.`);
    if (typeof face.url !== "string" || !face.url) throw new OPFFontError("invalid-font-source", `${label} needs the url the host serves the font file from.`);
    if (typeof face.sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(face.sha256)) throw new OPFFontError("invalid-font-source", `${label} needs the font file's SHA-256 (64 hex digits): extra faces are verified before use.`);
    if (seen.has(face.url)) throw new OPFFontError("invalid-font-source", `${label} repeats url ${face.url}.`);
    seen.add(face.url);
    return Object.freeze({ package: "host", family: face.family, weight: face.weight, italic: face.italic === true, file: face.url, url: face.url, sha256: face.sha256.toLowerCase(), ...(typeof face.license === "string" ? { license: face.license } : {}) });
  });
}

