import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
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
await writeFile(new URL('fonts.json', output), JSON.stringify((await loadOfficeFontRegistry()).embeddedFonts));
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
console.log(`Browser editor built in artifacts/playground (${scriptFaces} lazy script faces)`);
