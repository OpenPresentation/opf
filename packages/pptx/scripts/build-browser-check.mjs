import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const directory=new URL('../artifacts/webp-fallback/browser/',import.meta.url);
await mkdir(directory,{recursive:true});
const result=await build({entryPoints:[new URL('../test/webp-fallback-browser.js',import.meta.url).pathname],bundle:true,platform:'browser',format:'esm',outfile:new URL('bundle.js',directory).pathname,metafile:true});
assert.ok(!Object.keys(result.metafile.inputs).some(path=>path.includes('sharp')||path.includes('image-fallback-node')),'Browser output must exclude the native decoder');
await writeFile(new URL('index.html',directory),'<!doctype html><meta charset="utf-8"><title>WebP fallback verification</title><h1>WebP fallback verification</h1><pre>Running…</pre><script type="module" src="./bundle.js"></script>');
console.log('Browser build passed: browser decoder selected, no Sharp/native inputs. Serve the repository and open /artifacts/webp-fallback/browser/index.html for pixel checks.');
