// RR-28: the self-hosted font root <opf-deck> and the player load from. One directory a host serves from its own origin,
// laid out as the editor playground and the OpenPresentation sites serve it (nothing is ever requested from a font CDN):
//
//   <root>/base/<package>/<file>       the eager Office and base faces (Roboto Regular loads at startup, the rest on demand)
//   <root>/lazy/fonts/<family>/<file>  the vendored faces (Intos for the default Aptos scheme, the open families)
//   <root>/scripts/<package>/<file>    the Noto script faces (Japanese, Arabic, ...)
//
// `copyPreviewFonts` (the `/fonts-node` side of this layout, `preview-fonts-node.js`) fills it from the installed packages.
// Every file is verified against its pinned SHA-256 by the registry before use, and only the faces a deck draws are fetched.
import { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
import { lazyFontList, loadBrowserFontRegistry, splitStartupFaces } from "./fonts-browser.js";

/** The directory a package's files sit in under its kind: a vendored family's own name, or the npm package name without its scope. */
export function previewFontDirectory(pkg) {
  return pkg.vendored ? pkg.vendored.replace(/^fonts\//, "") : pkg.name.split("/").pop();
}

/**
 * Where every package of the manifest sits under a font root, relative to it: `kind` is `base`, `lazy` or `scripts`, and
 * `target` the package's directory (`lazy` keeps the renderer's package-relative `fonts/<family>` path, which is what
 * `lazyFontsBaseUrl` joins).
 */
export function previewFontLayout(manifest = BUNDLED_FONT_MANIFEST, lazyFiles = lazyFontList().map((face) => face.file)) {
  const lazy = new Set(lazyFiles);
  return manifest.packages.map((pkg) => {
    const directory = previewFontDirectory(pkg);
    const isLazy = pkg.faces.length > 0 && pkg.faces.every((face) => lazy.has(`${pkg.vendored}/${face.file}`));
    const kind = pkg.pack === "scripts" ? "scripts" : isLazy ? "lazy" : "base";
    return { pkg, kind, directory, target: kind === "lazy" ? `lazy/${pkg.vendored}` : `${kind}/${directory}` };
  });
}

/** The eager faces (everything the registry could hold at startup) with their root-relative file and pinned hash. */
export function previewBaseFaces(manifest = BUNDLED_FONT_MANIFEST) {
  return previewFontLayout(manifest).filter((entry) => entry.kind === "base").flatMap(({ pkg, target }) => pkg.faces.map((face) => ({
    family: face.family, weight: face.weight, italic: face.italic, file: `${target}/${face.file}`, sha256: face.sha256, license: pkg.license,
  })));
}

const absolute = (root, document) => {
  const text = String(root);
  const base = document?.baseURI ?? globalThis.document?.baseURI ?? globalThis.location?.href;
  const url = base ? new URL(text, base).href : text;
  return url.endsWith("/") ? url : `${url}/`;
};

const shared = new Map();

/**
 * A browser font registry over a font root. It starts with Roboto Regular (the renderer's fallback family) and loads the rest
 * only when a deck draws it, face by face: vendored faces from `<root>/lazy/`, script faces from `<root>/scripts/`, the other
 * eager faces as the registry's extra lazy faces. One registry is shared by every deck on the page that names the same root.
 */
export function loadPreviewFonts(root, options = {}) {
  if (typeof root !== "string" || !root) return Promise.reject(new TypeError("loadPreviewFonts needs the URL of the font root."));
  const base = absolute(root, options.document);
  const shareable = !options.document && !options.fetch && !options.registryOptions;
  if (shareable && shared.has(base)) return shared.get(base);
  const faces = previewBaseFaces();
  const { startup, rest } = splitStartupFaces(faces, { startup: (face) => face.family === "Roboto" && face.weight === 400 && !face.italic });
  const entry = (face) => ({ url: base + face.file, family: face.family, weight: face.weight, italic: face.italic, license: face.license, sha256: face.sha256 });
  const promise = loadBrowserFontRegistry(startup.map(entry), {
    substitutionPolicy: "visual",
    fallbackFamily: "Roboto",
    scriptBaseUrl: `${base}scripts/`,
    lazyFontsBaseUrl: `${base}lazy/`,
    extraLazyFonts: rest.map(entry),
    ...(options.document ? { document: options.document } : {}),
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    ...options.registryOptions,
  });
  if (shareable) {
    shared.set(base, promise);
    promise.catch(() => { if (shared.get(base) === promise) shared.delete(base); });
  }
  return promise;
}
