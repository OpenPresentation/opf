import { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
import { OPFFontError } from "./fonts.js";

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

/** Hash-pinned browser entries for the vendored faces, served by the host from `baseUrl` at their package-relative paths. */
export function lazyFontEntries(options, list = lazyFontList()) {
  const baseUrl = options?.baseUrl;
  if (typeof baseUrl !== "string" || !baseUrl) throw new OPFFontError("invalid-font-source", "lazyFontEntries needs a baseUrl, where the host serves the package's fonts directory.");
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return list.map(face => ({ url: `${base}${face.file}`, family: face.family, weight: face.weight, italic: face.italic, sha256: face.sha256, package: face.package }));
}

