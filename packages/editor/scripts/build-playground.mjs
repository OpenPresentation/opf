import { build } from 'esbuild';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadOfficeFontRegistry } from '@openpresentation/opf-render/fonts-node';

const root = new URL('../', import.meta.url);
const output = new URL('artifacts/playground/', root);
await mkdir(output, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('examples/playground.js', root))],
  outfile: fileURLToPath(new URL('playground.js', output)),
  bundle: true, platform: 'browser', format: 'esm', minify: true,
});
await writeFile(new URL('fonts.json', output), JSON.stringify((await loadOfficeFontRegistry()).embeddedFonts));
for (const [source, destination] of [['playground.html', 'index.html'], ['playground.css', 'playground.css'], ['galleries.json', 'galleries.json']]) {
  await copyFile(new URL('examples/' + source, root), new URL(destination, output));
}
console.log('Browser editor built in artifacts/playground');
