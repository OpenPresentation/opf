import {createRequire} from 'node:module';
// Reproduce the remaining code-label gap on the coordinated published set; quote is intentionally absent.
// node scripts/probe-code-layout-gap.mjs <registry-consumer> [output-prefix]
import {readFile,writeFile,realpath,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const consumer=path.resolve(process.argv[2]??'artifacts/npm/registry-consumer');
const output=path.resolve(process.argv[3]??'artifacts/code-layout-gap');
assert.ok(!process.env.NODE_OPTIONS && !process.execArgv.some(value => /^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(value)),
  'Run without NODE_OPTIONS or preload/loader arguments so local source cannot replace registry modules.');
const require=createRequire(path.join(consumer,'package.json'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const lock=JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8'));
const modules=await realpath(path.join(consumer,'node_modules')),packages=[];
async function verifyPackage(name) {
  if(packages.some(item=>item.name===name))return;
  const file=path.join(modules,name,'package.json'),manifest=JSON.parse(await readFile(file,'utf8'));
  const entry=lock.packages['node_modules/'+name];
  assert.ok((await realpath(path.dirname(file))).startsWith(modules+path.sep));
  assert.ok(manifest.name===name&&entry?.version===manifest.version&&!entry.link&&entry.resolved?.startsWith('https://registry.npmjs.org/')&&entry.integrity?.startsWith('sha512-'));
  packages.push({name,version:manifest.version,integrity:entry.integrity});
}
for(const [name,version] of [['@openpresentation/opf','0.8.0'],['@openpresentation/opf-render','0.6.0']]) {
  await verifyPackage(name);
  assert.equal(packages.find(item=>item.name===name).version,version,`Shared-code baseline requires ${name}@${version}`);
}
const load=async name=>{
  const parts=name.split('/'),pkg=parts.slice(0,2).join('/');
  const file=require.resolve(pkg+'/package.json'),manifest=JSON.parse(await readFile(file,'utf8'));
  const entry=manifest.exports[parts.length===2?'.':'./'+parts.slice(2).join('/')];
  return import(pathToFileURL(path.resolve(path.dirname(file),typeof entry==='string'?entry:entry.import??entry.default)).href);
};
const {validatePresentation}=await load('@openpresentation/opf');
const {resolvePresentation,renderSvg}=await load('@openpresentation/opf-render/svg');
const {loadOfficeFontRegistry}=await load('@openpresentation/opf-render/fonts-node');
const fonts=await loadOfficeFontRegistry();
const fontHashes=[];
for(const file of fonts.fontFiles) {
  const actual=await realpath(file);
  assert.ok(actual.startsWith(modules+path.sep),'Use only the installed open-font packages');
  const relative=path.relative(modules,actual).split(path.sep).join('/');
  const parts=relative.split('/'),name=parts.slice(0,relative.startsWith('@')?2:1).join('/');
  await verifyPackage(name);
  fontHashes.push({file:relative,sha256:hash(await readFile(actual))});
}
const document={design:{fontScheme:{heading:{family:'Carlito'},body:{family:'Carlito'},code:{family:'Cousine'}}},slides:[
  {code:{source:'const value = 42;',language:'very-long-language-label-'.repeat(20)}},
  {code:{source:'def check():\r\n    value = "two  spaces"\r\n    return value  \r\n',language:'python',filename:'src/check.py'}},
]};
assert.ok(validatePresentation(document).valid);
const original=structuredClone(document);
const decode=text=>text.replace(/&(amp|lt|gt|quot|apos);/g,(_,name)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[name]);
const results=document.slides.map((slide,index)=>{
  const deck={...document,slides:[slide]},bound=resolvePresentation(deck,{textMeasurement:fonts.textMeasurement}).slides[0];
  const diagnostics=[];
  const svg=renderSvg(deck,{trace:true,textMeasurement:fonts.textMeasurement,onDiagnostic:value=>diagnostics.push(value)});
  const serializedCodeText=[...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)]
    .filter(match=>match[1].includes('data-opf-path="slides.0.code"')).map(match=>decode(match[2]));
  assert.ok(serializedCodeText.length>1);
  const label=slide.code?.language.toUpperCase(),box=bound.geometry.items[0].box;
  const labelWidth=label?fonts.textMeasurement.measure(label,14,{fontFamily:'Cousine',fontWeight:700}):undefined;
  return {index,compositionDiagnostics:bound.geometry.diagnostics,renderDiagnostics:diagnostics,
    ...(label?{labelWidth,labelAvailableWidth:box.width-36,labelOverflows:labelWidth>box.width-36}:{}),
    svgSha256:hash(svg),serializedCodeText,
    ...(slide.code.filename?{filenameSerialized:serializedCodeText.some(text=>text.includes(slide.code.filename)),
      sourceLines:slide.code.source.split(/\r\n|\r|\n/),bodyLines:serializedCodeText.slice(1)}:{})};
});
assert.equal(results[0].compositionDiagnostics.length,0);
assert.equal(results[0].renderDiagnostics.length,0);
assert.ok(results[0].labelOverflows);
assert.equal(results[1].compositionDiagnostics.length,0);
assert.equal(results[1].renderDiagnostics.length,0);
assert.equal(results[1].filenameSerialized,false);
assert.notDeepEqual(results[1].bodyLines,results[1].sourceLines);
assert.ok(results[1].bodyLines.includes('value = "two spaces"'),'The current renderer collapses even whitespace inside a source string literal.');
assert.deepEqual(document,original,'The gap affects displayed output, not source JSON mutation.');
await mkdir(path.dirname(output),{recursive:true});
const source=JSON.stringify(document,null,2)+'\n';
await writeFile(output+'.opf.json',source);
await writeFile(output+'.json',JSON.stringify({packages,sourceSha256:hash(source),fontHashes,scope:'Expected gaps in actual registry core 0.8.0/renderer 0.6.0 with bundled open-font advances and serialized SVG text. Source JSON remains unchanged. These assertions document the baseline defects, not acceptable future behavior; no browser glyph-box or native export/raster claim.',results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));

