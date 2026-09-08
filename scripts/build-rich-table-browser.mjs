import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const editor = path.resolve(process.env.OPF_EDITOR_ROOT ?? path.join(root, '../opf-editor'));
const renderer = path.resolve(process.env.OPF_RENDER_ROOT ?? path.join(root, '../opf-render'));
const output = path.join(root, 'artifacts/rich-table-browser');
const require = createRequire(new URL('../packages/javascript/package.json', import.meta.url));
const {build} = createRequire(require.resolve('tsup'))('esbuild');
await mkdir(output, {recursive: true});
await build({
  entryPoints: [path.join(editor, 'test/rich-table-browser.mjs')],
  outfile: path.join(output, 'test.js'),
  bundle: true, format: 'esm', platform: 'browser',
  alias: {
    '@openpresentation/opf-render/svg': path.join(renderer, 'src/svg.js'),
    '@openpresentation/opf-render/fonts-browser': path.join(renderer, 'src/fonts-browser.js'),
    '@openpresentation/opf-render': path.join(renderer, 'src/svg.js'),
  },
});
const {loadOfficeFontRegistry} = await import(pathToFileURL(path.join(renderer, 'dist/fonts-node.js')));
const {embeddedFonts} = await loadOfficeFontRegistry();
await writeFile(path.join(output, 'fonts.json'), JSON.stringify(embeddedFonts.filter(face => ['Roboto', 'Roboto Mono'].includes(face.family))));
await writeFile(path.join(output, 'index.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><title>Rich table verification</title><style>body{font:15px system-ui;margin:24px;background:#eee}#canvas{width:100%;max-width:1100px;background:white}pre{white-space:pre-wrap}</style><h1>Rich table verification</h1><div id="canvas"></div><pre id="results"></pre><script type="module" src="./test.js"></script></html>');
console.log('Built artifacts/rich-table-browser. Serve this directory over HTTP; open index.html and inspect the visible PASS/FAIL results.');
