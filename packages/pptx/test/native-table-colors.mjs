// Native editable table color persistence; no raster-equivalence claim.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {toPptx} from '../dist/index.js';
const [mode,directory='artifacts/native-table-colors']=process.argv.slice(2);
assert.ok(['generate','compare'].includes(mode));
const output=path.resolve(directory),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async name=>JSON.parse((await readFile(path.join(output,name),'utf8')).replace(/^\uFEFF/,''));
const write=(name,data)=>writeFile(path.join(output,name),JSON.stringify(data,null,2)+'\n');
await mkdir(output,{recursive:true});
const runtime={};
for(const name of ['@openpresentation/opf','@openpresentation/opf-render','@openpresentation/opf-pptx']){
 const root=path.dirname(fileURLToPath(import.meta.resolve(name+'/package.json')));
 // Fingerprint the core functions/data actually used by export, not unrelated
 // generated documentation containing these evidence reports themselves.
 const seen=new Set(),visit=async file=>{
  if(seen.has(file))return;seen.add(file);
  const bytes=await readFile(path.join(root,'dist',file));runtime[name+'/dist/'+file]=hash(bytes);
  for(const [,child]of bytes.toString().matchAll(/(?:from\s*|import\s*)['"](\.\/[^'"]+\.js)['"]/g))await visit(path.posix.join(path.posix.dirname(file),child));
 };
 const files=name==='@openpresentation/opf'?['composition.js','validator.js','catalogs.js']:(await readdir(path.join(root,'dist'))).filter(file=>file.endsWith('.js')).sort();
 for(const file of files)await visit(file);
 runtime[name+'/package.json']=hash(await readFile(path.join(root,'package.json')));
}
for(const file of ['test/native-table-colors.mjs','test/native-table-colors.ps1','vendor/pptxgenjs/pptxgen.es.js','package-lock.json'])runtime[file]=hash(await readFile(new URL('../'+file,import.meta.url)));
if(mode==='generate'){
 const cases=[
  ['#F8FAFC','#000000','#000000'],['#0F172A','#FFFFFF','#FFFFFF'],
  ['#777777','#000000','#000000'],['#767676','#FFFFFF','#000000'],
  ['#FFFFFF80','#FFFFFF','#000000'],['#F8FAFC','#FFFFFF','#FFFFFF','#FFFFFF'],
 ];
 const slides=[],expected=[];
 for(const [fill,header,body,explicit]of cases){
  const style={fill,...(explicit?{color:explicit}:{})};
  slides.push({table:{columns:[{value:'Header',style},{value:['Inherited',{text:'Explicit',color:'#FF0000'}],style}],rows:[[{value:'Body',style},{value:['BodyInherited',{text:'BodyExplicit',color:'#FF0000'}],style}]]}});
  expected.push({fill,explicit:explicit??null,cells:[
   {row:1,column:1,runs:[{text:'Header',color:header}]},
   {row:1,column:2,runs:[{text:'Inherited',color:header},{text:'Explicit',color:'#FF0000'}]},
   {row:2,column:1,runs:[{text:'Body',color:body}]},
   {row:2,column:2,runs:[{text:'BodyInherited',color:body},{text:'BodyExplicit',color:'#FF0000'}]},
  ]});
 }
 const document={design:{background:'#FFFFFF',fontScheme:'roboto',colorScheme:{id:'cool-horizon',dark1:'#000000'}},slides};
 const original=structuredClone(document),bytes=await toPptx(document);assert.deepEqual(document,original);
 await writeFile(path.join(output,'table-colors.pptx'),bytes);
 await write('generation.json',{node:process.version,runtime,sourceSha256:hash(JSON.stringify(document)),pptxSha256:hash(bytes),expected});
 console.log('Generated six editable native table-color fixtures.');
}else{
 const generation=await json('generation.json'),native=await json('native.json');
 assert.deepEqual(runtime,generation.runtime,'Runtime changed after generation');
 assert.equal(native.generationSha256,hash(await readFile(path.join(output,'generation.json'))));
 assert.equal(generation.pptxSha256,hash(await readFile(path.join(output,'table-colors.pptx'))));
 assert.equal(native.savedSha256,hash(await readFile(path.join(output,'table-colors-saved.pptx'))));
 let observations=0;
 for(const phase of ['original','reopened']){
  assert.equal(native[phase].length,generation.expected.length);
  for(const [index,slide]of generation.expected.entries()){
   const actual=native[phase][index];assert.equal(actual.slide,index+1);assert.equal(actual.cells.length,slide.cells.length);
   for(const [j,cell]of slide.cells.entries()){
    const wanted=cell.runs.flatMap(run=>Array.from(run.text,character=>({character,color:run.color})));
    assert.deepEqual(actual.cells[j],{row:cell.row,column:cell.column,text:cell.runs.map(run=>run.text).join(''),characters:wanted},`${phase} slide ${index+1} cell ${j+1}`);
    observations+=wanted.length;
   }
   assert.equal(actual.pngSha256,hash(await readFile(path.join(output,actual.png))));
  }
 }
 await write('comparison.json',{node:process.version,generationSha256:native.generationSha256,nativeSha256:hash(await readFile(path.join(output,'native.json'))),slides:6,phases:2,cells:48,characterColorObservations:observations,passed:true,scope:'Actual PowerPoint editable table text and every source character color survive native save/reopen. Explicit low-contrast colors and translucent fills remain intentional counterexamples. Native rasters are recorded for review, not claimed equivalent to browser output.'});
 console.log(`Native tables passed: 48 original/reopened cells, ${observations} character colors.`);
}
