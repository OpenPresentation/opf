// FF-31: the pinned lazy-font manifest that pptx.gallery serves next to the editor.
//
// The editor previews the default Aptos scheme with Intos, and the open families with their own faces, using the renderer's
// vendored faces. They are not in fonts.json: the editor fetches them on demand from `<page>/fonts/<family>/`
// (`registry.ensureLazyFonts`). The faces are binaries (about 19 MB in 51 files), so they are never committed to the gallery
// repository. This module builds the small, reviewable half that is committed: `lazy-fonts.json`, listing every vendored
// package with its pinned upstream version, SPDX license, license-file hash and every face with its SHA-256, taken from the
// published renderer's own manifest. The gallery's build copies the faces from the pinned `@openpresentation/opf-render`
// package (which ships them under `fonts/`) into an untracked public path, verifying each hash, and writes the license
// notices beside them, the way it does for script fonts (gallery-script-fonts.mjs). Nothing is hotlinked from a font CDN.

export const LAZY_FONTS_CONTRACT = 'opf-gallery-editor-lazy-fonts/v1';
export const ALLOWED_LAZY_FONT_LICENSES = ['OFL-1.1', 'Apache-2.0', 'MIT', 'UFL-1.0'];
const hex = /^[0-9a-f]{64}$/;

/**
 * Manifest from the renderer's `BUNDLED_FONT_MANIFEST` (`@openpresentation/opf-render/fonts-node`): the vendored packages whose
 * faces are `embed: "used"` (the open families and Intos). Returns undefined when that renderer vendors none (0.10.0 and
 * earlier), so an older pinned renderer still builds. `rendererVersion` is the published `@openpresentation/opf-render`
 * version that ships the files.
 */
export function galleryLazyFontManifest(renderFonts, rendererVersion) {
  const packages = (renderFonts?.BUNDLED_FONT_MANIFEST?.packages ?? []).filter(pkg => typeof pkg.vendored === 'string' && (pkg.pack === 'open' || pkg.embed === 'used'));
  if (!packages.length) return undefined;
  const manifest = {
    contract: LAZY_FONTS_CONTRACT, baseUrl: './',
    renderer: { name: '@openpresentation/opf-render', version: rendererVersion },
    packages: packages.map(pkg => ({
      name: pkg.name, directory: pkg.vendored, version: pkg.version, source: pkg.source, license: pkg.license,
      licenseFile: pkg.licenseFile, licenseSha256: pkg.licenseSha256,
      ...(pkg.noticeFile ? { noticeFile: pkg.noticeFile, noticeSha256: pkg.noticeSha256 } : {}),
      faces: pkg.faces.map(face => ({ file: face.file, family: face.family, weight: face.weight, italic: face.italic, sha256: face.sha256 })),
    })),
  };
  verifyGalleryLazyFontManifest(manifest);
  return manifest;
}

/**
 * The manifest the gallery editor build ships, decided by the pinned editor example. An example that never calls
 * `ensureLazyFonts` needs none (undefined). An example that does, with a renderer that vendors no faces, would ship an editor
 * whose Aptos and open-family previews fall back to other faces, so that fails loudly instead of building silently.
 */
export function galleryLazyFontManifestForExample(renderFonts, rendererVersion, exampleSource) {
  if (!/ensureLazyFonts/.test(exampleSource)) return undefined;
  const manifest = galleryLazyFontManifest(renderFonts, rendererVersion);
  if (!manifest) throw new Error('The pinned editor example calls ensureLazyFonts but the pinned @openpresentation/opf-render vendors no lazy fonts (Intos and the open families, after 0.10.0). Move release-plan.json to a renderer release that ships them, or pin an editor example that does not load them.');
  return manifest;
}

/** Throws unless every package is an exact-version, allowed-license, hash-pinned set of relative font files. */
export function verifyGalleryLazyFontManifest(manifest) {
  const fail = message => { throw new Error(`Lazy font manifest: ${message}`); };
  if (manifest?.contract !== LAZY_FONTS_CONTRACT) fail('unknown contract');
  if (manifest.baseUrl !== './') fail('baseUrl must be the page directory ./');
  if (manifest.renderer?.name !== '@openpresentation/opf-render' || !/^\d+\.\d+\.\d+$/.test(manifest.renderer.version ?? '')) fail('the renderer that ships the files needs an exact version');
  if (!Array.isArray(manifest.packages) || !manifest.packages.length) fail('no packages');
  const seen = new Set(), directories = new Set();
  for (const pkg of manifest.packages) {
    if (!/^fonts\/[a-z0-9-]+$/.test(pkg.directory) || directories.has(pkg.directory)) fail(`${pkg.name} needs a unique fonts/<name> directory`);
    directories.add(pkg.directory);
    if (!ALLOWED_LAZY_FONT_LICENSES.includes(pkg.license)) fail(`${pkg.name} license ${pkg.license} is not allowed`);
    if (!hex.test(pkg.licenseSha256) || !/^[A-Za-z0-9_.-]+$/.test(pkg.licenseFile ?? '')) fail(`${pkg.name} needs a hashed license file`);
    if (pkg.noticeFile !== undefined && (!hex.test(pkg.noticeSha256) || !/^[A-Za-z0-9_.-]+$/.test(pkg.noticeFile))) fail(`${pkg.name} needs a hashed notice file`);
    if (!Array.isArray(pkg.faces) || !pkg.faces.length) fail(`${pkg.name} has no faces`);
    for (const face of pkg.faces) {
      const id = `${pkg.directory}/${face.file}`;
      if (!/^[A-Za-z0-9_.-]+\.ttf$/.test(face.file) || face.file.includes('..') || seen.has(id)) fail(`${id} is not a unique relative .ttf path`);
      seen.add(id);
      if (!hex.test(face.sha256)) fail(`${id} needs a SHA-256`);
    }
  }
  return manifest;
}
