import { build } from 'esbuild';
import { mkdir, readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as renderFonts from '@openpresentation/opf-render/fonts-node';
const require = createRequire(import.meta.url);

const root = new URL('../', import.meta.url);
// OPF_PLAYGROUND_OUT builds somewhere else (the tests build a second copy); OPF_PLAYGROUND_SPLIT_FONTS=1 (or --split-fonts) starts the page
// with Roboto Regular only and serves the other eager faces as separate hash-pinned files listed in base-fonts.json (FF-41).
const output = process.env.OPF_PLAYGROUND_OUT ? pathToFileURL(path.resolve(process.env.OPF_PLAYGROUND_OUT) + path.sep) : new URL('artifacts/playground/', root);
const splitFonts = process.env.OPF_PLAYGROUND_SPLIT_FONTS === '1' || process.argv.includes('--split-fonts');
await mkdir(output, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('examples/playground.js', root))],
  outfile: fileURLToPath(new URL('playground.js', output)),
  bundle: true, platform: 'browser', format: 'esm', minify: true,
});
// The renderer's fonts handle for the Office pack: its registry's eager faces are the page's startup faces, its registry lists the vendored ones.
const officeFonts = await renderFonts.loadFonts({ pack: 'office' });
const isStartup = face => face.family === 'Roboto' && face.weight === 400 && !face.italic;
if (splitFonts) {
  const base = [];
  for (const face of officeFonts.registry.embeddedFonts.filter(face => !isStartup(face))) {
    const bytes = Buffer.from(face.dataUrl.split(',')[1], 'base64'), sha256 = createHash('sha256').update(bytes).digest('hex');
    const file = `${face.family.replace(/[^a-z0-9]+/gi, '-')}-${face.weight}-${face.italic ? 'italic' : 'normal'}-${sha256.slice(0, 12)}.ttf`;
    await writeFile(new URL(file, output), bytes);
    base.push({ family: face.family, weight: face.weight, italic: Boolean(face.italic), license: face.license, file, sha256 });
  }
  await writeFile(new URL('base-fonts.json', output), JSON.stringify(base));
} else await writeFile(new URL('base-fonts.json', output), '[]');
await writeFile(new URL('fonts.json', output), JSON.stringify(splitFonts ? officeFonts.registry.embeddedFonts.filter(isStartup) : officeFonts.registry.embeddedFonts));
// FF-31: the vendored preview faces (Intos for the Aptos scheme, the open families) are not in fonts.json. They are served next to
// the page at their package-relative paths (fonts/intos/..., fonts/<family>/...) and fetched on demand, only for the font
// families a document resolves, hash-verified by the renderer (fonts.ensure). Never a font CDN.
let lazyFaces = 0;
const lazyFonts = officeFonts.registry.lazyFonts;
if (lazyFonts.length) {
  const renderRoot = path.dirname(require.resolve('@openpresentation/opf-render/package.json'));
  for (const directory of new Set(lazyFonts.map(face => path.posix.dirname(face.file)))) {
    for (const name of (await readdir(path.join(renderRoot, directory))).sort()) {
      const target = new URL(`${directory}/${name}`, output);
      await mkdir(new URL('./', target), { recursive: true });
      await copyFile(path.join(renderRoot, directory, name), target);
    }
  }
  for (const face of lazyFonts) {
    if (createHash('sha256').update(await readFile(new URL(face.file, output))).digest('hex') !== face.sha256) throw new Error(`${face.file} differs from the reviewed font manifest.`);
    lazyFaces++;
  }
}
// FF-19: the pinned script faces (OFL Noto) are served next to the page and fetched lazily, only for the scripts a
// document draws, hash-verified by the renderer. Never a font CDN.
let scriptFaces = 0;
{
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
// RR-65, RR-64 (opf-editor#141): harfbuzzjs's two WASM modules, served next to the page. The browser fonts handle takes them as
// `subsetWasm` (SVG downloads embed each face cut to the slide's glyphs instead of whole) and `shapeWasm` (outlined text is shaped by
// HarfBuzz). They are the copies the installed renderer depends on (harfbuzzjs, MIT), so the page runs the version the renderer was tested with.
const renderRequire = createRequire(require.resolve('@openpresentation/opf-render/package.json'));
for (const name of ['harfbuzz-subset.wasm', 'harfbuzz.wasm']) await copyFile(renderRequire.resolve(`harfbuzzjs/dist/${name}`), new URL(name, output));
for (const [source, destination] of [['playground.html', 'index.html'], ['playground.css', 'playground.css'], ['galleries.json', 'galleries.json']]) {
  await copyFile(new URL('examples/' + source, root), new URL(destination, output));
}
console.log(`Browser editor built in ${fileURLToPath(output)} (${splitFonts ? 'eager faces split: Roboto Regular at start, the rest on demand; ' : ''}${scriptFaces} lazy script faces, ${lazyFaces} lazy preview faces)`);
