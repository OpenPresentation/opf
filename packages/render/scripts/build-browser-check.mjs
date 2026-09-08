import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const output=new URL('../artifacts/jpeg/browser/',import.meta.url);
await mkdir(output,{recursive:true});
const result=await build({entryPoints:[new URL('../test/jpeg-browser.js',import.meta.url).pathname],bundle:true,platform:'browser',format:'esm',outfile:new URL('bundle.js',output).pathname,metafile:true});
assert.ok(!Object.keys(result.metafile.inputs).some(path=>path.includes('sharp')||path.includes('raster-images.js')||path.endsWith('/raster.js')),'Native raster code must not enter the browser bundle');
await writeFile(new URL('index.html',output),'<!doctype html><meta charset="utf-8"><title>JPEG browser orientation</title><h1>JPEG browser orientation</h1><pre>Running…</pre><script type="module" src="bundle.js"></script>');
console.log('Browser bundle passed: no native raster modules. Serve /artifacts/jpeg/browser/index.html to run the JPEG orientation comparisons.');
