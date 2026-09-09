import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const output=new URL('../artifacts/jpeg/browser/',import.meta.url);
await mkdir(output,{recursive:true});
const result=await build({entryPoints:[fileURLToPath(new URL('../test/jpeg-browser.js',import.meta.url))],bundle:true,platform:'browser',format:'esm',outfile:fileURLToPath(new URL('bundle.js',output)),metafile:true});
assert.ok(!Object.keys(result.metafile.inputs).some(path=>path.includes('sharp')||path.includes('raster-images.js')||path.endsWith('/raster.js')),'Native raster code must not enter the browser bundle');
await writeFile(new URL('index.html',output),'<!doctype html><meta charset="utf-8"><title>JPEG browser orientation</title><h1>JPEG browser orientation</h1><pre>Running…</pre><script type="module" src="bundle.js"></script>');
console.log('Browser bundle passed: no native raster modules. Serve /artifacts/jpeg/browser/index.html to run the JPEG orientation comparisons.');

const {loadBundledFontRegistry}=await import('../dist/fonts-node.js');
const {renderSvg}=await import('../dist/svg.js');
const fonts=await loadBundledFontRegistry();
const quoteDirectory=new URL('../artifacts/quote-footer/browser/',import.meta.url);
await mkdir(quoteDirectory,{recursive:true});
const fontManifest=[];
for(const face of fonts.embeddedFonts.filter(face=>['Roboto','Roboto Medium','Roboto SemiBold'].includes(face.family)&&!face.italic&&[400,500,600,700].includes(face.weight))){
  const filename=`font-${face.weight}.ttf`;
  await writeFile(new URL(filename,quoteDirectory),Buffer.from(face.dataUrl.split(',')[1],'base64'));
  fontManifest.push({family:face.family,weight:face.weight,italic:face.italic,url:'./'+filename,license:face.license});
}
assert.equal(fontManifest.length,4);
const cases=[];
for(const dimensions of [{width:1280,height:720},{width:540,height:960}])for(const repeats of [12,16,20,24]){
  const deck={design:{dimensions,fontScheme:'roboto'},slides:[{title:'A quote and its source',quote:{text:'A shared layout keeps the evidence readable when the words change. '.repeat(repeats),attribution:'A reviewer',source:'Recorded interview'}}]};
  const diagnostics=[];
  const svg=renderSvg(deck,{trace:true,textMeasurement:fonts.textMeasurement,onDiagnostic:value=>diagnostics.push(value)});
  assert.equal(diagnostics.length,0);
  const id=`${dimensions.width}-${repeats}`,filename=id+'.svg';
  await writeFile(new URL(filename,quoteDirectory),svg);
  cases.push({id,url:'./'+filename});
}
await writeFile(new URL('fixtures.json',quoteDirectory),JSON.stringify({fonts:fontManifest,cases}));
await build({entryPoints:[fileURLToPath(new URL('../test/quote-footer-browser.js',import.meta.url))],bundle:true,platform:'browser',format:'esm',outfile:fileURLToPath(new URL('bundle.js',quoteDirectory))});
await writeFile(new URL('index.html',quoteDirectory),'<!doctype html><meta charset="utf-8"><title>Quote footer verification</title><h1>Quote footer verification</h1><pre>Running…</pre><main></main><script type="module" src="bundle.js"></script>');
console.log('Quote browser fixtures ready: actual glyph containment with four bundled open font faces.');
