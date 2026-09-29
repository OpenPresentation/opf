// FF-19: the gallery editor's script-font manifest is exact, hash-pinned and license-checked.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { galleryScriptFontManifest, verifyGalleryScriptFontManifest, SCRIPT_FONTS_CONTRACT } from './gallery-script-fonts.mjs';

const hash = seed => seed.repeat(64).slice(0, 64);
const pkg = (name, overrides = {}) => ({
  name: `@expo-google-fonts/${name}`, version: '0.4.3', pack: 'scripts', source: `https://www.npmjs.com/package/@expo-google-fonts/${name}/v/0.4.3`,
  scripts: ['Jpan'], license: 'OFL-1.1', licenseFile: 'LICENSE_FONT', licenseSha256: hash('a'),
  faces: [{ file: '400Regular/NotoSansJP_400Regular.ttf', family: 'Noto Sans JP', weight: 400, italic: false, sha256: hash('b') },
    { file: '700Bold/NotoSansJP_700Bold.ttf', family: 'Noto Sans JP', weight: 700, italic: false, sha256: hash('c') }], ...overrides,
});
const renderFonts = packages => ({ scriptFontPackages: scripts => { assert.equal(scripts, 'all'); return packages; } });

// A renderer without the script pack (published 0.9.x) yields no manifest: older pins still build.
assert.equal(galleryScriptFontManifest({}), undefined);
const manifest = galleryScriptFontManifest(renderFonts([pkg('noto-sans-jp')]));
assert.equal(manifest.contract, SCRIPT_FONTS_CONTRACT);
assert.equal(manifest.baseUrl, 'script-fonts/');
assert.deepEqual(manifest.packages[0].directory, 'noto-sans-jp');
assert.equal(manifest.packages[0].faces.length, 2);
// The manifest is data only: no URLs beyond the package source, no bytes.
assert.equal(JSON.stringify(manifest).includes('http://'), false);

const rejects = (change, pattern) => assert.throws(() => galleryScriptFontManifest(renderFonts([pkg('noto-sans-jp', change)])), pattern);
rejects({ license: 'GPL-3.0' }, /license GPL-3.0 is not allowed/);
rejects({ version: '^0.4.3' }, /exact version/);
rejects({ licenseSha256: 'nope' }, /hashed license file/);
rejects({ licenseFile: '../LICENSE' }, /hashed license file/);
rejects({ faces: [{ file: '400Regular/x.ttf', family: 'X', weight: 400, italic: false, sha256: 'short' }] }, /needs a SHA-256/);
rejects({ faces: [{ file: 'https://fonts.example/x.ttf', family: 'X', weight: 400, italic: false, sha256: hash('d') }] }, /relative \.ttf path/);
rejects({ faces: [] }, /no faces/);
assert.throws(() => galleryScriptFontManifest(renderFonts([pkg('noto-sans-jp'), pkg('noto-sans-jp')])), /unique relative/);
assert.throws(() => galleryScriptFontManifest(renderFonts([{ ...pkg('noto-sans-jp'), name: '@evil/noto-sans-jp' }])), /not a pinned @expo-google-fonts/);
assert.throws(() => verifyGalleryScriptFontManifest({ ...manifest, baseUrl: 'https://fonts.googleapis.com/' }), /relative script-fonts/);

// The renderer checked out beside this repository (when built) yields a manifest that passes the same checks.
const sibling = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../opf-render/dist/fonts-node.js');
if (existsSync(sibling)) {
  const real = galleryScriptFontManifest(await import(pathToFileURL(sibling).href));
  if (real) {
    assert.ok(real.packages.length >= 30 && real.packages.every(item => item.license === 'OFL-1.1'));
    console.log(`Gallery script fonts: fake and sibling-renderer manifests verified (${real.packages.length} packages, ${real.packages.reduce((total, item) => total + item.faces.length, 0)} faces).`);
    process.exit(0);
  }
}
console.log('Gallery script fonts: manifest shape, license and hash checks verified.');
