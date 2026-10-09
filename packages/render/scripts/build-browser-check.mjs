import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const output=new URL('../artifacts/jpeg/browser/',import.meta.url);
await mkdir(output,{recursive:true});
const result=await build({entryPoints:[fileURLToPath(new URL('../test/jpeg-browser.js',import.meta.url))],bundle:true,platform:'browser',format:'esm',outfile:fileURLToPath(new URL('bundle.js',output)),metafile:true});
assert.ok(!Object.keys(result.metafile.inputs).some(path=>path.includes('sharp')||path.includes('raster-images.js')||path.endsWith('/raster.js')),'Native raster code must not enter the browser bundle');
// FF-19: the browser preview must call core's paragraphDirection (the export's RTL rule), not compile it away.
assert.equal(typeof (await import('@openpresentation/opf/composition')).paragraphDirection,'function','Core must export paragraphDirection from /composition');
// The renderer must keep the rule in a browser bundle that draws a slide (a bundle that never draws one tree-shakes it away).
const drawing=await build({stdin:{contents:"import {toSvg} from './dist/svg.js';globalThis.draw=toSvg;",resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'js'},bundle:true,platform:'browser',format:'esm',write:false,logLevel:'error'});
assert.ok(drawing.outputFiles[0].text.includes('function paragraphDirection('),'The browser bundle must include core paragraphDirection');
await writeFile(new URL('index.html',output),'<!doctype html><meta charset="utf-8"><title>JPEG browser orientation</title><h1>JPEG browser orientation</h1><pre>Running…</pre><script type="module" src="bundle.js"></script>');
console.log('Browser bundle passed: no native raster modules. Serve /artifacts/jpeg/browser/index.html to run the JPEG orientation comparisons.');

const {loadFonts}=await import('../dist/fonts-node.js');
const {toSvg,resolvePresentation}=await import('../dist/svg.js');
// FA-23: the deck names the gallery font scheme 'roboto'; register the gallery snapshot as a host does.
const {defaultCatalog}=await import('@openpresentation/opf/catalog');
const catalogs=[defaultCatalog];
const fonts=await loadFonts();
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
for(const dimensions of [{width:1280,height:720},{width:540,height:960}])for(const repeats of [12,16,20,24,'expanded-footer']){
  const expanded=repeats==='expanded-footer';
  const deck={design:{dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96},fontScheme:'roboto'},slides:[{title:'A quote and its source',quote:{text:expanded?'Keep the complete source visible.':'A shared layout keeps the evidence readable when the words change. '.repeat(repeats),attribution:expanded?'Long attribution '.repeat(60):'A reviewer',source:'Recorded interview'}}]};
  const diagnostics=[];
  const svg=toSvg(deck,1,{trace:true,catalogs,fonts:{textMeasurement:fonts.textMeasurement},onDiagnostic:value=>diagnostics.push(value)});
  assert.equal(diagnostics.length,0);
  const id=`${dimensions.width}-${repeats}`,filename=id+'.svg';
  await writeFile(new URL(filename,quoteDirectory),svg);
  assert.ok(svg.includes(`viewBox="0 0 ${dimensions.width} ${dimensions.height}"`));
  const item=resolvePresentation(deck,{catalogs,fonts:{textMeasurement:fonts.textMeasurement}}).slides[0].geometry.items.find(item=>item.field==='quote');
  const parts=item.quoteLayout.parts;
  cases.push({id,url:'./'+filename,...dimensions,cellBox:item.box,bodyBox:parts[0].box,footerBox:parts[1].box,body:parts[0].text,footer:parts[1].text});
}
await writeFile(new URL('fixtures.json',quoteDirectory),JSON.stringify({fonts:fontManifest,cases}));
await build({entryPoints:[fileURLToPath(new URL('../test/quote-footer-browser.js',import.meta.url))],bundle:true,platform:'browser',format:'esm',outfile:fileURLToPath(new URL('bundle.js',quoteDirectory))});
await writeFile(new URL('index.html',quoteDirectory),'<!doctype html><meta charset="utf-8"><title>Quote footer verification</title><h1>Quote footer verification</h1><pre>Running…</pre><main></main><script type="module" src="bundle.js"></script>');
console.log('Quote browser fixtures ready: actual glyph containment with four bundled open font faces.');
// RR-63: the converters and font packages are optional peers of the Node entries. No browser entry may reach them: a page that only draws SVG
// (`/svg`, `/fonts-browser`) or exports in the browser (`/export-browser`) bundles no pdf-lib, resvg, sharp, Node font loader or @expo-google-fonts file.
for(const entry of ['svg','fonts-browser','export-browser','player','element']){
  const bundle=await build({stdin:{contents:`import * as entry from './dist/${entry}.js';globalThis.entry=entry;`,resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'js'},bundle:true,platform:'browser',format:'esm',write:false,logLevel:'error',metafile:true});
  const forbidden=Object.keys(bundle.metafile.inputs).filter(path=>/(^|\/)(pdf-lib|@pdf-lib|@resvg|sharp|@img|@expo-google-fonts|converters\.js|fonts-node\.js|raster[a-z-]*\.js|preview-fonts-node\.js)(\/|$)/.test(path));
  assert.deepEqual(forbidden,[],`The /${entry} browser bundle must not reach the optional converters or Node font loading`);
}
console.log('Browser entries (/svg, /fonts-browser, /export-browser, /player, /element) bundle no converter or font package.');
