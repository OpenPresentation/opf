// FF-31: the gallery editor's lazy-font manifest (Intos and the open families) is exact, hash-pinned and license-checked, and
// the gallery commits only that manifest, never the faces.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertLazyFontCount } from './lazy-font-counts.mjs';
import { galleryLazyFontManifest, galleryLazyFontManifestForExample, verifyGalleryLazyFontManifest, LAZY_FONTS_CONTRACT } from './gallery-lazy-fonts.mjs';

const hash = seed => seed.repeat(64).slice(0, 64);
const pkg = (name, overrides = {}) => ({
  name, vendored: `fonts/${name}`, version: 'fef9315c14da9e4b23b4c3cac8e718998d4e4736', pack: 'office', embed: 'used', source: `https://github.com/example/${name}/tree/fef9315c14da9e4b23b4c3cac8e718998d4e4736/fonts`,
  license: 'OFL-1.1', licenseFile: 'OFL.txt', licenseSha256: hash('a'), noticeFile: 'NOTICE.md', noticeSha256: hash('b'),
  faces: [{ file: 'Example-Regular.ttf', family: 'Example', weight: 400, italic: false, sha256: hash('c') }, { file: 'Example-Bold.ttf', family: 'Example', weight: 700, italic: false, sha256: hash('d') }], ...overrides,
});
const renderFonts = packages => ({ BUNDLED_FONT_MANIFEST: { version: 1, packages } });
const version = '0.11.0';

// A renderer that vendors no lazy faces (0.10.0 and earlier) yields no manifest; eager vendored packages (Carlito) are not lazy.
assert.equal(galleryLazyFontManifest({}, version), undefined);
assert.equal(galleryLazyFontManifest(renderFonts([{ ...pkg('carlito'), embed: undefined, pack: 'office' }]), version), undefined);
const manifest = galleryLazyFontManifest(renderFonts([pkg('intos'), { ...pkg('open-sans'), pack: 'open', embed: undefined, noticeFile: undefined, noticeSha256: undefined }, { name: '@expo-google-fonts/roboto', pack: 'base', faces: [] }]), version);
assert.equal(manifest.contract, LAZY_FONTS_CONTRACT);
assert.deepEqual(manifest.packages.map(item => item.directory), ['fonts/intos', 'fonts/open-sans']);
assert.deepEqual(manifest.renderer, { name: '@openpresentation/opf-render', version });
// The manifest is data only: no bytes and no URLs beyond the package source.
assert.equal(JSON.stringify(manifest).includes('"data"'), false);

const rejects = (change, pattern) => assert.throws(() => galleryLazyFontManifest(renderFonts([pkg('intos', change)]), version), pattern);
rejects({ license: 'GPL-3.0' }, /license GPL-3.0 is not allowed/);
rejects({ license: 'Bitstream-Vera' }, /not allowed/);
rejects({ licenseSha256: 'nope' }, /hashed license file/);
rejects({ licenseFile: '../LICENSE' }, /hashed license file/);
rejects({ noticeSha256: 'nope' }, /hashed notice file/);
rejects({ vendored: 'node_modules/intos' }, /fonts\/<name> directory/);
rejects({ faces: [{ file: 'X.ttf', family: 'X', weight: 400, italic: false, sha256: 'short' }] }, /needs a SHA-256/);
rejects({ faces: [{ file: 'https://fonts.example/x.ttf', family: 'X', weight: 400, italic: false, sha256: hash('e') }] }, /relative \.ttf path/);
rejects({ faces: [{ file: '../x.ttf', family: 'X', weight: 400, italic: false, sha256: hash('e') }] }, /relative \.ttf path/);
rejects({ faces: [] }, /no faces/);
assert.throws(() => galleryLazyFontManifest(renderFonts([pkg('intos'), pkg('intos')]), version), /unique fonts/);
assert.throws(() => galleryLazyFontManifest(renderFonts([pkg('intos')]), '^0.11.0'), /exact version/);
assert.throws(() => verifyGalleryLazyFontManifest({ ...manifest, baseUrl: 'https://cdn.example.test/' }), /page directory/);

// The pinned editor example decides: no call, no manifest; a call without lazy fonts in the renderer fails loudly.
const fake = renderFonts([pkg('intos')]);
assert.equal(galleryLazyFontManifestForExample({}, version, 'fetch("./fonts.json")'), undefined);
assert.equal(galleryLazyFontManifestForExample(fake, version, 'fetch("./fonts.json")'), undefined);
assert.equal(galleryLazyFontManifestForExample(fake, version, 'await browserFonts.loadFonts({lazyFontsBaseUrl: "./"})').packages.length, 1);
assert.throws(() => galleryLazyFontManifestForExample({}, version, 'await browserFonts.loadFonts({lazyFontsBaseUrl: "./"})'), /sets lazyFontsBaseUrl but the pinned @openpresentation\/opf-render vendors no lazy fonts/);

// The renderer checked out beside this repository (when built) yields a manifest that passes the same checks.
const sibling = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../opf-render/dist/fonts-node.js');
if (existsSync(sibling)) {
  const siblingFonts = await import(pathToFileURL(sibling).href);
  const real = galleryLazyFontManifest(siblingFonts, '0.11.0');
  if (real) {
    const faces = real.packages.reduce((total, item) => total + item.faces.length, 0);
    // Every vendored open-pack or embed:"used" face of the sibling renderer, and the exact count its version is expected to list.
    const expected = siblingFonts.BUNDLED_FONT_MANIFEST.packages.filter(item => item.vendored && (item.pack === 'open' || item.embed === 'used')).reduce((total, item) => total + item.faces.length, 0);
    assert.equal(faces, expected, 'the vendored open and Intos faces of the renderer');
    assertLazyFontCount(JSON.parse(readFileSync(path.resolve(path.dirname(sibling), '../package.json'), 'utf8')).version, faces, 'sibling opf-render');
    assert.ok(real.packages.some(item => item.name === 'intos' && item.noticeFile === 'NOTICE.md'));
    assert.equal(real.packages.some(item => item.name === 'carlito'), false, 'Carlito is eager, not lazy');
    console.log(`Gallery lazy fonts: fake and sibling-renderer manifests verified (${real.packages.length} packages, ${faces} faces).`);
    process.exit(0);
  }
}
console.log('Gallery lazy fonts: manifest shape, license and hash checks verified.');
