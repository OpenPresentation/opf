import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(new URL('../packages/javascript/package.json',import.meta.url));
const {build}=createRequire(require.resolve('tsup'))('esbuild');
await build({entryPoints:['scripts/test-list-browser.mjs'],outfile:'artifacts/editor/list-tests.js',bundle:true,format:'esm',platform:'browser',alias:{'@openpresentation/opf-render/svg':path.resolve('../opf-render/src/svg.js'),'@openpresentation/opf-render':path.resolve('../opf-render/src/svg.js')}});
await writeFile('artifacts/editor/list-tests.html','<!doctype html><meta charset="utf-8"><title>List canvas checks</title><h1>Editable lists</h1><div id="canvas" style="max-width:1100px"></div><pre id="results"></pre><script type="module" src="./list-tests.js"></script>');
