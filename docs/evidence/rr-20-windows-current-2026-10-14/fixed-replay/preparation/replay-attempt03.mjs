import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root='C:/opf-work/current-2ec2-stretch-01',consumer=root+'/opf/artifacts/npm/consumer',oldConsumer='C:/opf-work/current-be40-gallery3-01/opf/artifacts/npm/consumer',manual='C:/opf-work/native-manual-current-6eea8909-attempt01',out=root+'/replay-attempt03';
assert.ok(!existsSync(out));mkdirSync(out);
const json=(name,value)=>writeFileSync(out+'/'+name,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const hash=b=>createHash('sha256').update(b).digest('hex');
const {installedIdentity}=await import(pathToFileURL('C:/opf-work/native-tools-181bbf03/scripts/native-acceptance/identity.mjs').href);
const {installedEngines}=await import(pathToFileURL('C:/opf-work/native-tools-181bbf03/scripts/native-acceptance/generate.mjs').href);
const current=await installedEngines(consumer),historical=await installedEngines(oldConsumer);
json('runtime-identities.json',{current:installedIdentity(consumer),historical:installedIdentity(oldConsumer),nativeIdentityUnchanged:true,registryAcceptance:false,nativeAcceptance:false});
const manifest=JSON.parse(readFileSync(root+'/opf/artifacts/npm/manifest.json','utf8'));
assert.equal(manifest.published,false);assert.equal(manifest.artifacts.length,5);
for(const a of manifest.artifacts)assert.equal(hash(readFileSync(root+'/opf/artifacts/npm/'+a.file)),a.sha256);
const heads=['opf','opf-render','opf-pptx','opf-editor'].map(name=>({name,revision:execFileSync('git',['-C',root+'/'+name,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),status:execFileSync('git',['-C',root+'/'+name,'status','--porcelain'],{encoding:'utf8'}).trim()}));
for(const h of heads)assert.equal(h.status,'');json('source-and-pack-identities.json',{heads,manifest});
const req=createRequire(consumer+'/package.json'),cli=req.resolve('@openpresentation/cli/package.json').replace(/package.json$/,'dist/index.js');
const composition=await import(pathToFileURL(path.dirname(req.resolve('@openpresentation/opf/package.json'))+'/dist/composition.js').href);
const results=[];
const pictureTree=bytes=>{
const archive=current.fflate.unzipSync(bytes),xml=current.fflate.strFromU8(archive['ppt/slides/slide1.xml']),picture=xml.match(/<p:pic>[\s\S]*?<\/p:pic>/)?.[0];assert.ok(picture);
const rels=current.fflate.strFromU8(archive['ppt/slides/_rels/slide1.xml.rels']);const rid=picture.match(/r:embed="([^"]+)"/)[1];const relation=[...rels.matchAll(/<Relationship\b[^>]*\/>/g)].map(x=>x[0]).find(x=>x.includes('Id="'+rid+'"'));assert.ok(relation);const target=relation.match(/Target="([^"]+)"/)[1];const media=path.posix.normalize('ppt/slides/'+target);
const srcRect=picture.match(/<a:srcRect\b[^>]*\/>/)?.[0]??null;const frame=picture.match(/<a:xfrm\b[^>]*>[\s\S]*?<\/a:xfrm>/)?.[0];
return {picture,srcRect,frame,media,mediaSha256:hash(archive[media]),placeholder:picture.match(/<p:ph\b[^>]*\/>/)?.[0],fullSource:!srcRect||![...srcRect.matchAll(/[lrtb]="([^"]+)"/g)].some(m=>Number(m[1])!==0)};
};
try{
for(const id of ['change-layout','new-custom','new-text','change-picture']){
const input=readFileSync(manual+'/'+id+'.pptx'),diagnostics=[],oldDiagnostics=[];
const direct=await current.pptx.fromPptx(input,{catalogs:[current.gallery],onDiagnostic:d=>diagnostics.push(d)});
const old=await historical.pptx.fromPptx(input,{catalogs:[historical.gallery],onDiagnostic:d=>oldDiagnostics.push(d)});
json(id+'-direct.opf.json',direct);json(id+'-direct-diagnostics.json',diagnostics);json(id+'-historical-direct.opf.json',old);json(id+'-historical-direct-diagnostics.json',oldDiagnostics);
const apiResults=[];
for(const catalogMode of ['default','registered']){
const opts=catalogMode==='default'?{}:{catalogs:[current.gallery]};
const opened=await current.core.open(input,opts);assert.deepEqual(opened,direct);
const converted=await current.core.convert(input,{...opts,format:'json'});const convertedDoc=JSON.parse(Buffer.from(converted.files[0].bytes).toString());assert.deepEqual(convertedDoc,direct);assert.ok(!converted.findings.some(d=>JSON.stringify(d).includes('unresolved-reference')));
json(id+'-'+catalogMode+'-open.opf.json',opened);json(id+'-'+catalogMode+'-convert.opf.json',convertedDoc);json(id+'-'+catalogMode+'-convert-findings.json',converted.findings);apiResults.push({catalogMode,openMatches:true,convertMatches:true,unresolvedReferenceWarnings:0});
}
const stdout=execFileSync(process.execPath,[cli,'convert',manual+'/'+id+'.pptx',out+'/'+id+'-cli.opf.json'],{encoding:'utf8'});writeFileSync(out+'/'+id+'-cli-stdout.json',stdout,{flag:'wx'});assert.deepEqual(JSON.parse(readFileSync(out+'/'+id+'-cli.opf.json','utf8')),direct);assert.ok(!stdout.includes('unresolved-reference'));
let change='none';
if(id==='change-picture'){
const block=direct.slides[0].blocks.find(b=>b.image);assert.equal(block.fit,'stretch');assert.equal(block.image.alt,undefined);assert.equal(hash(Buffer.from(block.image.src.split(',')[1],'base64')),'a168bef97c7e01a6a993350bb1d0e73dd8af1bfb9949cf1b36d88c48124dfd6e');const normalized=structuredClone(direct);delete normalized.slides[0].blocks.find(b=>b.image).fit;assert.deepEqual(normalized,old);change='image block fit:stretch only';
const reexport=await current.pptx.toPptx(direct,{catalogs:[current.gallery],seed:1,timestamp:'2026-01-01T00:00:00Z'});writeFileSync(out+'/'+id+'-reexport.pptx',reexport,{flag:'wx'});const saved=pictureTree(input),exported=pictureTree(reexport);assert.ok(saved.fullSource&&exported.fullSource);assert.equal(exported.mediaSha256,saved.mediaSha256);assert.match(saved.placeholder,/idx="500"/);assert.match(exported.placeholder,/idx="500"/);json(id+'-reexport-inspection.json',{saved,exported,absoluteGeometryParityAsserted:false,pixelParityAsserted:false});
}else assert.deepEqual(direct,old);
if(id==='change-layout')assert.equal(direct.slides[0].layout,'hero');
if(id==='new-text'){assert.equal(direct.slides[3].layout,'text');assert.equal(direct.slides[3].title,'RR20 built-in title witness');assert.equal(direct.slides[3].text,'RR20 built-in body witness.');}
if(id==='new-custom'){
assert.equal(direct.slides[3].layout,'named');assert.equal(direct.slides[3].blocks[0].text,'RR20 custom first region witness.');
const context=current.core.resolveSlideContext(direct,3,{catalogs:[current.gallery]});const binding=composition.bindRegions(direct.slides[3],context.options.layout,{slideIndex:3});const previous=JSON.parse(readFileSync(manual+'/new-custom-region-binding.json','utf8'));assert.deepEqual(binding,previous.binding);const composed=composition.composeSlide(context.slide,context.options);json(id+'-resolved-context.json',{context,binding,composed,scope:'Portable allocation; no native or pixel parity assertion'});
}
results.push({id,savedSha256:hash(input),apiResults,cliMatchesDirect:true,changeAgainstHistoricalDirect:change,passed:true});json(id+'-progress.json',results);console.log(id+' passed');
}
json('report.json',{results,passed:true,scope:'Bounded offline replay of four retained manual archives; no new Office action, native/global/registry acceptance or publication',nativeAcceptance:false,registryAcceptance:false});
}catch(error){json('failure.json',{error:String(error),stack:error.stack,results});throw error;}


