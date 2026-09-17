import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
// Historical counterexamples, not a passing-fit contract for future versions.
// node scripts/probe-metric-layout-gap.mjs <registry-consumer> [output-prefix]
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const baselinePath=fileURLToPath(new URL('../docs/evidence/shared-code-complete/registry-code-node24.json',import.meta.url));
const baselineBytes=await readFile(baselinePath,'utf8');
const baseline=JSON.parse(baselineBytes);
assert.ok(process.argv[2],'Pass a verified registry consumer directory.');
const consumer=path.resolve(process.argv[2]);
const output=path.resolve(process.argv[3]??'artifacts/metric-layout-gap');
const require=createRequire(path.join(consumer,'package.json'));
const modules=await realpath(path.join(consumer,'node_modules'));
assert.ok(!process.env.NODE_OPTIONS&&!process.execArgv.some(x=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(x)));
const lock=JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8'));
const packages=[];
for(const [name,version] of [['@openpresentation/opf','0.9.0'],['@openpresentation/opf-render','0.7.0'],['@openpresentation/opf-pptx','0.7.0']]){
 const dir=await realpath(path.join(modules,name));assert.ok(dir.startsWith(modules+path.sep));const p=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8')),entry=lock.packages['node_modules/'+name];
 assert.equal(p.version,version);assert.equal(entry.version,version);assert.ok(!entry.link&&entry.resolved.startsWith('https://registry.npmjs.org/'));packages.push({name,version,integrity:entry.integrity});
 const expected=baseline.packages.find(p=>p.name===name);assert.equal(expected.integrity,entry.integrity);
 for(const [file,digest] of Object.entries(expected.files)) {
  const actual=await realpath(path.join(dir,file));assert.ok(actual.startsWith(dir+path.sep));
  assert.equal(hash(await readFile(actual)),digest,`${name}/${file} matches the verified registry archive`);
 }
 packages.at(-1).verifiedFiles=Object.keys(expected.files).length;
}
const load=async name=>{
 const parts=name.split('/'),pkg=parts.slice(0,2).join('/');
 const file=require.resolve(pkg+'/package.json'),manifest=JSON.parse(await readFile(file,'utf8'));
 const entry=manifest.exports[parts.length===2?'.':'./'+parts.slice(2).join('/')];
 return import(pathToFileURL(path.resolve(path.dirname(file),typeof entry==='string'?entry:entry.import??entry.default)).href);
};
const {validatePresentation}=await load('@openpresentation/opf');
const {composeSlide}=await load('@openpresentation/opf/composition');
const {resolvePresentation,renderSvg}=await load('@openpresentation/opf-render/svg');
const {loadOfficeFontRegistry}=await load('@openpresentation/opf-render/fonts-node');
const {toPptx}=await load('@openpresentation/opf-pptx');
const JSZip=require('jszip');const fonts=await loadOfficeFontRegistry();
const fontHashes=[];
for(const file of fonts.fontFiles){const actual=await realpath(file);assert.ok(actual.startsWith(modules+path.sep));fontHashes.push({file:path.relative(modules,actual).replaceAll('\\','/'),sha256:hash(await readFile(actual))});}
const design={fontScheme:{heading:{family:'Carlito'},body:{family:'Carlito'},code:{family:'Cousine'}}};
const cases=[
 {id:'visible-metadata',document:{design,slides:[{metric:{value:42,label:'Latency',unit:'ms',delta:0,trend:'flat'}}]}},
 {id:'readability-floor',document:{design,slides:[{composition:{minFontSize:32},metric:{value:42,label:'Latency'}}]}},
 {id:'strict-long-label',document:{design:{...design,dimensions:{widthInches:5.625,heightInches:10}},slides:[{composition:{minFontSize:32,overflow:'error'},metric:{value:42,label:'The complete supporting label must remain readable. '.repeat(300)}}]}}
];
const results=[];const decode=t=>t.replace(/&(amp|lt|gt|quot|apos);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[n]);
for(const c of cases){assert.equal(validatePresentation(c.document).valid,true);const before=JSON.stringify(c.document);const bound=resolvePresentation(c.document,{textMeasurement:fonts.textMeasurement}).slides[0];
 const composed=composeSlide(c.document.slides[0],{...bound.design.dimensions,fonts:bound.design.fonts,textMeasurement:fonts.textMeasurement,explain:true});
 const result={id:c.id,compositionDiagnostics:bound.geometry.diagnostics,unmeasured:composed.explanation.unmeasuredPayloads};
 try{const svg=renderSvg(c.document,{trace:true,textMeasurement:fonts.textMeasurement});result.svgText=[...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map(m=>({text:decode(m[2]),fontSize:Number(/font-size="([^"]+)"/.exec(m[1])[1]),path:/data-opf-path="([^"]+)"/.exec(m[1])?.[1]}));}
 catch(e){result.renderError={code:e.code,message:e.message};}
 try{const pptx=await toPptx(c.document,{textMeasurement:fonts.textMeasurement});const zip=await JSZip.loadAsync(pptx);const xml=await zip.file('ppt/slides/slide1.xml').async('string');result.pptxText=[...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m=>decode(m[1]));}
 catch(e){result.pptxError={code:e.code,message:e.message};}
 assert.equal(JSON.stringify(c.document),before);results.push(result);
}
assert.deepEqual(results[0].svgText.map(t=>t.text),['42','Latency']);
assert.deepEqual(results[0].pptxText,['42','Latency']);
assert.equal(results[1].svgText.find(t=>t.text==='Latency').fontSize,23);
assert.deepEqual(results[2].compositionDiagnostics,[]);
assert.equal(results[2].renderError.code,'layout-overflow');assert.equal(results[2].pptxError.code,'layout-overflow');
assert.ok(results.every(r=>r.unmeasured.includes('slides.0.metric')));
const fixtureText=JSON.stringify(cases,null,2)+'\n';
const probeSha256=hash((await readFile(fileURLToPath(import.meta.url),'utf8')).replace(/\r\n/g,'\n'));
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output+'.fixtures.json',fixtureText);
await writeFile(output+`.node${process.versions.node.split('.')[0]}.json`,JSON.stringify({node:process.versions.node,probeSha256,baselineSha256:hash(baselineBytes.replace(/\r\n/g,'\n')),packages,fontHashes,fixtureSha256:hash(fixtureText),results,scope:'Expected defects in actual registry core 0.9.0/renderer and PPTX 0.7.0, with every library file checked against the verified archive report. Serialized SVG/PPTX text and font sizes are measured; no new browser glyph or native PowerPoint raster claim.'},null,2)+'\n');
console.log(`Three published metric gaps reproduced on Node ${process.versions.node}; ${packages.reduce((n,p)=>n+p.verifiedFiles,0)} library files matched verified registry archives. Source documents remain unchanged.`);
