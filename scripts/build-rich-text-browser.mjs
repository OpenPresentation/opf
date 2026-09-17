import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),require=createRequire(new URL('../packages/javascript/package.json',import.meta.url));
const {build}=createRequire(require.resolve('tsup'))('esbuild');
await build({entryPoints:['scripts/test-rich-text-browser.mjs'],outfile:'artifacts/editor/rich-text-tests.js',bundle:true,format:'esm',platform:'browser',alias:{'@openpresentation/opf-render/svg':path.resolve('../opf-render/src/svg.js'),'@openpresentation/opf-render':path.resolve('../opf-render/src/svg.js')}});
await writeFile('artifacts/editor/rich-text-tests.html','<!doctype html><meta charset="utf-8"><title>Rich text canvas checks</title><h1>Rich text canvas</h1><p>Select text in the slide to format it, or double-click to type directly into mixed-style text.</p><div id="canvas" style="max-width:1100px"></div><pre id="results"></pre><script type="module" src="./rich-text-tests.js"></script>');
