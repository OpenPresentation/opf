import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const directory=new URL('../artifacts/webp-fallback/browser/',import.meta.url);
await mkdir(directory,{recursive:true});
const result=await build({entryPoints:[fileURLToPath(new URL('../test/webp-fallback-browser.js',import.meta.url))],bundle:true,platform:'browser',format:'esm',outfile:fileURLToPath(new URL('bundle.js',directory)),metafile:true});
assert.ok(!Object.keys(result.metafile.inputs).some(path=>path.includes('sharp')||path.includes('image-fallback-node')),'Browser output must exclude the native decoder');
await writeFile(new URL('index.html',directory),'<!doctype html><meta charset="utf-8"><title>WebP fallback verification</title><h1>WebP fallback verification</h1><pre>Running…</pre><script type="module" src="./bundle.js"></script>');
console.log('Browser build passed: browser decoder selected, no Sharp/native inputs. Serve the repository and open /artifacts/webp-fallback/browser/index.html for pixel checks.');

const tableDirectory=new URL('../artifacts/native-rich-table-import/browser/',import.meta.url);
await mkdir(tableDirectory,{recursive:true});
const tableResult=await build({entryPoints:[fileURLToPath(new URL('../test/rich-table-import-browser.js',import.meta.url))],bundle:true,platform:'browser',format:'esm',outfile:fileURLToPath(new URL('bundle.js',tableDirectory)),metafile:true});
assert.ok(!Object.keys(tableResult.metafile.inputs).some(path=>path.includes('sharp')||path.includes('image-fallback-node')),'Table import browser output must exclude the native decoder');
await writeFile(new URL('index.html',tableDirectory),'<!doctype html><meta charset="utf-8"><title>Native rich table import</title><h1>Native rich table import</h1><pre>Running…</pre><main style="max-width:960px"></main><script type="module" src="./bundle.js"></script>');
console.log('Native rich table import browser bundle ready at /artifacts/native-rich-table-import/browser/index.html.');

const stylesDirectory=new URL('../artifacts/native-table-styles/browser/',import.meta.url);
await mkdir(stylesDirectory,{recursive:true});
const stylesResult=await build({entryPoints:[fileURLToPath(new URL('../test/table-styles-browser.js',import.meta.url))],bundle:true,platform:'browser',format:'esm',outfile:fileURLToPath(new URL('bundle.js',stylesDirectory)),metafile:true});
assert.ok(!Object.keys(stylesResult.metafile.inputs).some(path=>path.includes('sharp')||path.includes('image-fallback-node')),'Table styles browser output must exclude the native decoder');
const {copyFile}=await import('node:fs/promises');
await copyFile(new URL('../test/fixtures/table-styles/conditional.pptx',import.meta.url),new URL('conditional.pptx',stylesDirectory));
await writeFile(new URL('index.html',stylesDirectory),'<!doctype html><meta charset="utf-8"><title>Native table styles</title><h1>Native table style verification</h1><pre>Running…</pre><main style="max-width:960px"></main><script type="module" src="./bundle.js"></script>');
console.log('Native conditional table style browser bundle ready at /artifacts/native-table-styles/browser/index.html.');
