import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(new URL('../packages/javascript/package.json',import.meta.url)),{build}=createRequire(require.resolve('tsup'))('esbuild');
await build({entryPoints:['scripts/test-block-browser.mjs'],outfile:'artifacts/editor/block-tests.js',bundle:true,format:'esm',platform:'browser',alias:{'@openpresentation/opf-render/svg':path.resolve('../opf-render/src/svg.js')}});
await writeFile('artifacts/editor/block-tests.html','<!doctype html><meta charset="utf-8"><title>Block move checks</title><style>body{font:14px system-ui;margin:20px;background:#f5f4f8}#canvas{width:1000px;max-width:100%}#verify{padding:8px;margin:12px 0}</style><h1>Move whole content blocks</h1><p>Drag the first numbered handle to the right half of the third block. Click a handle to move between groups.</p><div id="canvas"></div><button id="verify">Verify block drag</button><div id="drag-status" role="status"></div><pre id="results"></pre><script type="module" src="./block-tests.js"></script>');
