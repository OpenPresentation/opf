import { build } from 'esbuild';
import { mkdir, readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as renderFonts from '@openpresentation/opf-render/fonts-node';
const { loadOfficeFontRegistry } = renderFonts;
const require = createRequire(import.meta.url);

const root = new URL('../', import.meta.url);
const output = new URL('artifacts/playground/', root);
await mkdir(output, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('examples/playground.js', root))],
  outfile: fileURLToPath(new URL('playground.js', output)),
  bundle: true, platform: 'browser', format: 'esm', minify: true,
});
const officeFonts = await loadOfficeFontRegistry();
await writeFile(new URL('fonts.json', output), JSON.stringify(officeFonts.embeddedFonts));
// FF-31: the vendored preview faces (Intos for the Aptos scheme, the open families) are not in fonts.json. They are served next to
// the page at their package-relative paths (fonts/intos/..., fonts/<family>/...) and fetched on demand, only for the font
// families a document resolves, hash-verified by the renderer (registry.ensureLazyFonts). Never a font CDN. A renderer without
// lazyFonts (published 0.10.0 and earlier) has none to copy, and the playground then keeps the fonts it has.
let lazyFaces = 0;
if (officeFonts.lazyFonts?.length) {
  const renderRoot = path.dirname(require.resolve('@openpresentation/opf-render/package.json'));
  for (const directory of new Set(officeFonts.lazyFonts.map(face => path.posix.dirname(face.file)))) {
    for (const name of (await readdir(path.join(renderRoot, directory))).sort()) {
      const target = new URL(`${directory}/${name}`, output);
      await mkdir(new URL('./', target), { recursive: true });
      await copyFile(path.join(renderRoot, directory, name), target);
    }
  }
  for (const face of officeFonts.lazyFonts) {
    if (createHash('sha256').update(await readFile(new URL(face.file, output))).digest('hex') !== face.sha256) throw new Error(`${face.file} differs from the reviewed font manifest.`);
    lazyFaces++;
  }
}
// FF-19: the pinned script faces (OFL Noto) are served next to the page and fetched lazily, only for the scripts a
// document draws, hash-verified by the renderer. Never a font CDN. A renderer without the script pack (published
// 0.9.x) has none to copy, and the playground then keeps its Latin fonts.
let scriptFaces = 0;
if (typeof renderFonts.scriptFontPackages === 'function') {
  for (const pkg of renderFonts.scriptFontPackages('all')) {
    let directory;
    try { directory = path.dirname(require.resolve(`${pkg.name}/package.json`)); }
    catch { throw new Error(`Install ${pkg.name}@${pkg.version} to build the playground with script fonts.`); }
    for (const face of pkg.faces) {
      const bytes = await readFile(path.join(directory, face.file));
      if (createHash('sha256').update(bytes).digest('hex') !== face.sha256) throw new Error(`${pkg.name}/${face.file} differs from the reviewed font manifest.`);
      const target = new URL(`script-fonts/${pkg.name.split('/').pop()}/${face.file}`, output);
      await mkdir(new URL('./', target), { recursive: true });
      await writeFile(target, bytes);
      scriptFaces++;
    }
  }
}
for (const [source, destination] of [['playground.html', 'index.html'], ['playground.css', 'playground.css'], ['galleries.json', 'galleries.json']]) {
  await copyFile(new URL('examples/' + source, root), new URL(destination, output));
}
console.log(`Browser editor built in artifacts/playground (${scriptFaces} lazy script faces, ${lazyFaces} lazy preview faces)`);
