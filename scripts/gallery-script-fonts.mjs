// FF-19: the pinned script-font manifest that pptx.gallery serves next to the editor.
//
// The editor previews non-Latin documents with the renderer's pinned OFL Noto faces, fetched lazily from
// `script-fonts/` next to playground.js. The faces are binaries (66.9 MiB in 63 files), so they are never
// committed to the gallery repository. This module builds the small, reviewable half that is committed:
// `script-fonts.json`, listing every package, version, SPDX license, license-file hash and face with its
// SHA-256, taken from the published renderer's own manifest. The gallery's build (scripts/prepare-editor-
// script-fonts.mjs there) copies the faces from the pinned `@expo-google-fonts/*` packages into an
// untracked public path, verifying each hash, and writes the license notices beside them. Nothing is
// hotlinked from a font CDN.

export const SCRIPT_FONTS_CONTRACT = 'opf-gallery-editor-script-fonts/v1';
export const ALLOWED_SCRIPT_FONT_LICENSES = ['OFL-1.1'];
const hex = /^[0-9a-f]{64}$/;

/**
 * Manifest from the renderer's `scriptFontPackages('all')` (`@openpresentation/opf-render/fonts-node`, 0.10.0 and
 * later). Returns undefined when that renderer has no script pack, so an older pinned renderer still builds.
 */
export function galleryScriptFontManifest(renderFonts) {
  if (typeof renderFonts?.scriptFontPackages !== 'function') return undefined;
  const packages = renderFonts.scriptFontPackages('all').map(pkg => ({
    name: pkg.name, version: pkg.version, directory: pkg.name.split('/').pop(),
    scripts: [...pkg.scripts], license: pkg.license, licenseFile: pkg.licenseFile, licenseSha256: pkg.licenseSha256,
    source: pkg.source,
    faces: pkg.faces.map(face => ({ file: face.file, family: face.family, weight: face.weight, italic: face.italic, sha256: face.sha256 })),
  }));
  const manifest = { contract: SCRIPT_FONTS_CONTRACT, baseUrl: 'script-fonts/', packages };
  verifyGalleryScriptFontManifest(manifest);
  return manifest;
}

/**
 * The manifest the gallery editor build ships, decided by the pinned editor example. An example that does not fetch
 * from `./script-fonts/` needs none (undefined). An example that does, with a renderer that has no script pack, would
 * ship an editor whose script text fails to load fonts, so that fails loudly instead of building silently without it.
 */
export function galleryScriptFontManifestForExample(renderFonts, exampleSource) {
  if (!/\.\/script-fonts\//.test(exampleSource)) return undefined;
  const manifest = galleryScriptFontManifest(renderFonts);
  if (!manifest) throw new Error('The pinned editor example loads ./script-fonts/ but the pinned @openpresentation/opf-render has no script font pack (scriptFontPackages, 0.10.0 and later). Move release-plan.json to a renderer release that has it, or to an editor example that does not load script fonts.');
  return manifest;
}

/** Throws unless every package is an exact-version, allowed-license, hash-pinned local face set. */
export function verifyGalleryScriptFontManifest(manifest) {
  const fail = message => { throw new Error(`Script font manifest: ${message}`); };
  if (manifest?.contract !== SCRIPT_FONTS_CONTRACT) fail('unknown contract');
  if (manifest.baseUrl !== 'script-fonts/') fail('baseUrl must be the relative script-fonts/ directory');
  if (!Array.isArray(manifest.packages) || !manifest.packages.length) fail('no packages');
  const seen = new Set();
  for (const pkg of manifest.packages) {
    if (!/^@expo-google-fonts\/(?:noto-[a-z0-9-]+|stix-two-math)$/.test(pkg.name)) fail(`${pkg.name} is not a pinned @expo-google-fonts/noto-* or stix-two-math package`);
    if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) fail(`${pkg.name} needs an exact version`);
    if (!ALLOWED_SCRIPT_FONT_LICENSES.includes(pkg.license)) fail(`${pkg.name} license ${pkg.license} is not allowed`);
    if (!hex.test(pkg.licenseSha256) || !pkg.licenseFile || /[\\/]|\.\./.test(pkg.licenseFile)) fail(`${pkg.name} needs a hashed license file`);
    if (pkg.directory !== pkg.name.split('/').pop()) fail(`${pkg.name} directory must match its name`);
    if (!Array.isArray(pkg.faces) || !pkg.faces.length) fail(`${pkg.name} has no faces`);
    for (const face of pkg.faces) {
      const id = `${pkg.directory}/${face.file}`;
      if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.ttf$/.test(face.file) || seen.has(id)) fail(`${id} is not a unique relative .ttf path`);
      seen.add(id);
      if (!hex.test(face.sha256)) fail(`${id} needs a SHA-256`);
    }
  }
  return manifest;
}
