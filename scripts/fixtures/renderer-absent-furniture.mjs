import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,realpath,lstat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {unzipSync,zipSync} from 'fflate';
import {toPptx,fromPptx} from '@openpresentation/opf-pptx';
import {validate} from '@openpresentation/opf';
const root=fileURLToPath(new URL('../',import.meta.url)),output=path.join(root,'outputs');
await mkdir(output,{recursive:true});
const require=createRequire(import.meta.url),hash=x=>createHash('sha256').update(x).digest('hex');
const enc=new TextEncoder(),dec=new TextDecoder(),decode=bytes=>dec.decode(bytes);
const json=async(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n');
const runtime={node:process.version,execPath:process.execPath,platform:process.platform,arch:process.arch,argv:process.argv,measurement:'No renderer and no textMeasurement provider',absent:[],resolved:{}};
for(const name of ['@openpresentation/opf-render','@openpresentation/opf-editor','image-size','pptxgenjs']){
 assert.throws(()=>require.resolve(name),{code:'MODULE_NOT_FOUND'});runtime.absent.push(name);
}
for(const name of ['@openpresentation/opf','@openpresentation/opf-pptx']){
 const file=fileURLToPath(import.meta.resolve(name+'/package.json')),dir=path.dirname(file),actual=await realpath(dir);
 assert.ok(actual.startsWith(await realpath(path.join(root,'consumer/node_modules'))));
 assert.equal((await lstat(dir)).isSymbolicLink(),false);
 runtime.resolved[name]={packageJson:file,realpath:actual,version:JSON.parse(await readFile(file)).version};
}
const lock=JSON.parse(await readFile(new URL('./package-lock.json',import.meta.url)));
assert.ok(!Object.keys(lock.packages).some(name=>name.includes('@openpresentation/opf-render')||name.includes('@openpresentation/opf-editor')));
runtime.lockSha256=hash(await readFile(new URL('./package-lock.json',import.meta.url)));
await json(path.join(root,'runtime.json'),runtime);
const fixed={seed:1,timestamp:'2026-01-01T00:00:00Z',zipDate:'2026-01-01T00:00:00Z'};
const xml=(entries,i=2)=>decode(entries[`ppt/slides/slide${i}.xml`]);
const furniture=slide=>[...slide.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(m=>m[0]).filter(s=>/name="OPF furniture/.test(s)).map(s=>({name:s.match(/name="([^"]+)"/)[1],texts:[...s.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m=>m[1]),fields:[...s.matchAll(/<a:fld\b[^>]*type="([^"]+)"/g)].map(m=>m[1])}));
const markers=entries=>Object.entries(entries).filter(([p])=>p.startsWith('ppt/tags/')).flatMap(([,data])=>[...decode(data).matchAll(/name="OPF_FURNITURE_V1" val="([A-F0-9]+)"/g)]).map(m=>JSON.parse(Buffer.from(m[1],'hex').toString()));
const markerCount=entries=>markers(entries).flatMap(r=>r.parts??[]).filter(part=>part.staticDate!==undefined).length;
const footer=(document,i=1)=>document.slides[i].design?.footer??document.design?.footer;
let groupDir;
async function emit(label,source,extra={}){
 const before=structuredClone(source),issues=[],options={...fixed,...extra};
 await json(path.join(groupDir,label+'.source.json'),source);await json(path.join(groupDir,label+'.options.json'),options);
 const validation=validate(source,{only:['format']});assert.equal(validation.valid,true,JSON.stringify(validation));
 let bytes;
 try {bytes=await toPptx(source,{...options,onDiagnostic:x=>issues.push(x)});} finally {
  await json(path.join(groupDir,label+'.export-diagnostics.json'),issues);
  await json(path.join(groupDir,label+'.source-after.json'),source);assert.deepEqual(source,before);
 }
 await writeFile(path.join(groupDir,label+'.pptx'),bytes);
 const entries=unzipSync(bytes),all=Object.fromEntries(Object.keys(entries).filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p)).map(p=>[p,furniture(decode(entries[p]))]));
 await json(path.join(groupDir,label+'.furniture.json'),all);
 return {bytes,entries,issues};
}
async function read(label,bytes){
 const issues=[],document=await fromPptx(bytes,{onDiagnostic:x=>issues.push(x)});
 await json(path.join(groupDir,label+'.imported.json'),document);await json(path.join(groupDir,label+'.import-diagnostics.json'),issues);
 assert.equal(validate(document,{only:['format']}).valid,true);return {document,issues};
}
const outcomes=[];
async function group(id,name,run){
 groupDir=path.join(output,id);await mkdir(groupDir,{recursive:true});const start=performance.now();
 try {const facts=await run();outcomes.push({id,name,passed:true,durationMs:performance.now()-start,facts});console.log('PASS '+id+' '+name);}
 catch(error){outcomes.push({id,name,passed:false,durationMs:performance.now()-start,error:{name:error.name,message:error.message,stack:error.stack,actual:error.actual,expected:error.expected}});console.log('FAIL '+id+' '+name+'\n'+error.stack);}
 await json(path.join(root,'outcomes.json'),{node:process.version,retries:0,groups:outcomes});
}
const deck=footer=>({design:{footer},slides:[{title:'Title',design:{footer:false}},{title:'Two'},{title:'Three'}]});
const wrapped={name:'Wrapped generated date boundary',design:{fontScheme:'roboto',dimensions:{widthInches:7.5,heightInches:13.3333333333},footer:{center:{date:true,dateFormat:'MMMM d, yyyy'},right:{slideNumber:true,slideNumberFormat:'{current} / {total}'}}},slides:[{title:'Title',design:{footer:false}},{title:'Content',text:'Keep body content.',composition:{minFontSize:32,overflow:'error'}},{title:'Third',text:'Still current.',composition:{minFontSize:32,overflow:'error'}}]};
await group('01','Existing basic renderer-absent contract',async()=>{
 const source={name:'Installed package',slides:[{title:'Editable output',table:{columns:['Item','Value'],rows:[['Quality',42]]}},{title:'Metric',metric:{value:'42%',label:'Measured outcome'}},{title:'Quote',quote:{text:'Keep the source.',attribution:'Reviewer',source:'Interview'}},{title:'Code',code:{language:'python',source:'approve(change)'}},{title:'Timeline',timeline:{events:[{when:'Q1',what:'Pilot'},{when:'Q2',what:'Rollout'}]}}]};
 const exported=await emit('basic',source),{document}=await read('basic',exported.bytes);assert.ok(exported.bytes.length>1000);assert.equal(document.slides.length,5);
 // FF-57: an unchanged quote re-imports as a quote payload (separate attribution and source fields); an older opf-pptx returns the joined footer text.
 const retained=text=>JSON.stringify(document).includes(text)||(text==='Reviewer - Interview'&&['"attribution":"Reviewer"','"source":"Interview"'].every(part=>JSON.stringify(document).includes(part)));
 for(const text of ['Quality','42%','Reviewer - Interview','approve(change)','Pilot','Rollout'])assert.ok(retained(text),text);
 return {slides:5,retainedText:['Quality','42%','Reviewer - Interview','approve(change)','Pilot','Rollout']};
});
await group('02','Inherited and local furniture, authored whitespace and metadata',async()=>{
 const source={name:'Furniture source preservation',author:'Probe author',organization:{id:'primary',name:'Probe organization'},design:{fontScheme:'roboto',header:{left:{text:' Authored\twords \r\n\r\nlast  \r'},center:{organization:true},right:{section:true}},footer:{left:{date:' 2026-09-14 '},right:{slideNumber:true}}},slides:[{title:'Hidden',text:'First body',notes:'First notes',design:{header:false,footer:false}},{title:'Inherited',section:'Section',text:'Keep body words.',notes:'Second notes\nSecond line.'},{title:'Local',text:'Local body',notes:'Third notes',design:{header:{left:{text:'Local header'}},footer:{left:{text:'Local footer'}}}}]};
 const exported=await emit('source',source),{document}=await read('source',exported.bytes);
 assert.deepEqual(document.design.header,source.design.header);assert.deepEqual(document.design.footer,source.design.footer);
 assert.deepEqual(document.slides[0].design.header,false);assert.deepEqual(document.slides[0].design.footer,false);
 assert.deepEqual(document.slides[2].design.header,source.slides[2].design.header);assert.deepEqual(document.slides[2].design.footer,source.slides[2].design.footer);
 for(const key of ['name','author','organization'])assert.deepEqual(document[key],source[key]);
 assert.deepEqual(document.slides.map(s=>s.notes),source.slides.map(s=>s.notes));
 assert.equal(furniture(xml(exported.entries,1)).length,0);
 for(const text of ['First body','Keep body words.','Local body'])assert.ok(JSON.stringify(document).includes(text));
 return {whitespace:document.design.header.left.text,notes:document.slides.map(s=>s.notes),localOverrides:true};
});
await group('03','Formatted date and slide-number fields, determinism and current host date',async()=>{
 const source=deck({left:{date:'2026-04-23',dateFormat:'MMM d, yyyy'},center:{date:true,dateFormat:'MMMM d, yyyy'},right:{slideNumber:true,slideNumberFormat:'{current} / {total}'}});
 const exported=await emit('first',source,{date:'2026-09-22'}),{document}=await read('first',exported.bytes);
 assert.deepEqual(exported.issues,[]);assert.deepEqual(document.design.footer,source.design.footer);assert.deepEqual(document.slides[0].design.footer,false);
 const slide=xml(exported.entries);assert.match(slide,/type="datetime4"/);assert.match(slide,/type="slidenum"/);assert.ok(slide.includes('Apr 23, 2026')&&slide.includes('September 22, 2026')&&slide.includes(' / 3'));
 const repeated=await emit('repeat',source,{date:'2026-09-22'});assert.deepEqual(repeated.bytes,exported.bytes);
 const next=await emit('next-host',document,{date:'2027-04-23'});assert.ok(xml(next.entries).includes('April 23, 2027'));assert.ok(!xml(next.entries).includes('September 22, 2026'));
 assert.deepEqual((await read('next-host',next.bytes)).document.design.footer,source.design.footer);
 return {sha256:hash(exported.bytes),byteDeterministic:true,nativeOoxmlFields:['datetime4','slidenum'],nativeOfficeUntested:true};
});
await group('04','Missing host date and unsupported native pattern diagnostics',async()=>{
 const source=deck({left:{date:true,dateFormat:'MMMM d, yyyy'}}),missing=await emit('missing-host',source);
 assert.ok(missing.issues.some(i=>i.code==='unresolved-content'&&i.path==='design.footer.left.date'));
 const iso=await emit('unsupported-native-pattern',deck({left:{date:true,dateFormat:'yyyy-MM-dd'}}),{date:'2026-09-22'});
 assert.deepEqual(iso.issues.map(i=>[i.code,i.path]),[['furniture-date-fixed','design.footer.left.date'],['furniture-date-fixed','design.footer.left.date']]);
 assert.doesNotMatch(xml(iso.entries),/type="datetime/);assert.ok(xml(iso.entries).includes('2026-09-22'));await read('unsupported-native-pattern',iso.bytes);
 return {missingDiagnostics:missing.issues,unsupportedPatternDiagnostics:iso.issues};
});
let wrappedExport;
await group('05','Exact portrait minFontSize:32 fixture with estimated composition',async()=>{
 wrappedExport=await emit('wrapped',wrapped,{date:'2026-09-22'});
 const lines=furniture(xml(wrappedExport.entries)).filter(s=>/ part 0 line /.test(s.name)).map(s=>s.texts.join(''));
 await json(path.join(groupDir,'observed-boundary.json'),{lines,wrapReached:lines.length>1,minFontSize:32,unit:'reference pixels',measurement:'estimated; no renderer/provider'});
 assert.ok(lines.length>1,'Exact fixture did not wrap under estimated composition; wrapped path is not covered.');assert.equal(lines.join(''),'September 22, 2026');
 assert.doesNotMatch(xml(wrappedExport.entries),/type="datetime/);assert.equal(markerCount(wrappedExport.entries),2);
 assert.deepEqual(wrappedExport.issues.map(({code,path})=>({code,path})),[1,2].map(()=>({code:'furniture-field-fixed',path:'design.footer.center.date'})));
 assert.ok(wrappedExport.issues.every(i=>/static text.*PowerPoint will not update/.test(i.message)));
 const {document}=await read('wrapped',wrappedExport.bytes);assert.deepEqual(document.design.footer,wrapped.design.footer);
 const repeat=await emit('wrapped-repeat',wrapped,{date:'2026-09-22'});assert.deepEqual(repeat.bytes,wrappedExport.bytes);
 const next=await emit('wrapped-next-host',document,{date:'2027-04-23'});assert.ok(xml(next.entries).includes('April')&&xml(next.entries).includes('2027'));assert.ok(!xml(next.entries).includes('September'));
 assert.deepEqual(footer((await read('wrapped-next-host',next.bytes)).document).center,wrapped.design.footer.center);
 return {lines,staticMarkers:2,byteDeterministic:true,sourceFormatRestored:true};
});
await group('06','Provenance modes and current edited or cleared wrapped text',async()=>{
 assert.ok(wrappedExport,'Prior exact fixture did not export.');assert.equal(markerCount(wrappedExport.entries),2,'Static wrapped full-mode boundary not reached.');
 for(const provenance of ['references-only',false]){
  const label=provenance===false?'off':'references-only',current=await emit(label,wrapped,{date:'2026-09-22',provenance});assert.equal(markerCount(current.entries),0);
  assert.deepEqual(footer((await read(label,current.bytes)).document).center,{date:'September 22, 2026'});
 }
 const edits=[];
 for(const [label,cleared]of [['typed',false],['cleared',true]]){
  let count=0;
  const entries=Object.fromEntries(Object.entries(wrappedExport.entries).map(([p,data])=>[p,/^ppt\/slides\/slide[23]\.xml$/.test(p)?enc.encode(decode(data).replace(/<p:sp>[\s\S]*?<\/p:sp>/g,shape=>{
   if(!/name="OPF furniture[^\"]* part 0 line /.test(shape))return shape;
   count++;const first=/ part 0 line 0"/.test(shape);return shape.replace(/<a:t>[^<]*<\/a:t>/g,'<a:t>'+(!cleared&&first?'Human words':'')+'</a:t>');
  })):data]));
  assert.ok(count>=4,'Expected multiple date-line shapes on both content slides.');const bytes=zipSync(entries);await writeFile(path.join(groupDir,label+'.pptx'),bytes);
  const {document,issues}=await read(label,bytes),expected=cleared?'':'Human words';assert.deepEqual(footer(document).center,{date:expected});assert.ok(issues.some(i=>i.code==='invalid-furniture-provenance'));
  const next=await emit(label+'-reexport',document,{date:'2030-01-01'});assert.deepEqual(footer((await read(label+'-reexport',next.bytes)).document).center,{date:expected});edits.push({label,changedShapes:count,expected});
 }
 return {modes:['references-only',false],edits,generatedIntentNotRestored:true};
});
const passed=outcomes.filter(g=>g.passed).length;
await json(path.join(root,'outcomes.json'),{node:process.version,retries:0,groups:outcomes,passed,total:outcomes.length,scope:'Installed copied preview tars, renderer absent; no measured/native/render/browser acceptance.'});
console.log(`${passed}/${outcomes.length} groups passed; no retries.`);process.exitCode=passed===outcomes.length?0:1;
