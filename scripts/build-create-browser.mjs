import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(new URL('../packages/javascript/package.json',import.meta.url));
const {build}=createRequire(require.resolve('tsup'))('esbuild');
await build({entryPoints:['scripts/test-create-browser.mjs'],outfile:'artifacts/editor/create-tests.js',bundle:true,format:'esm',platform:'browser',alias:{'@openpresentation/opf-render/svg':path.resolve('../opf-render/src/svg.js'),'@openpresentation/opf-render':path.resolve('../opf-render/src/svg.js')}});
await writeFile('artifacts/editor/create-tests.html','<!doctype html><meta charset="utf-8"><title>Content creation checks</title><h1>Build slides on the canvas</h1><div id="canvas" style="max-width:1100px"></div><pre id="results"></pre><script type="module" src="./create-tests.js"></script>');
