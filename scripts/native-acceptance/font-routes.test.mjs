import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,mkdtemp,readFile,realpath,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {FONT_ROUTE_CASE_NAMES,loadFontRouteSource,previewRoutePins,selectFontRoutes} from './font-routes.mjs';
import {generatePrimaryFixtures} from './generate.mjs';
import {parseArguments,sealSuite} from './prepare.mjs';
import {digest} from './identity.mjs';
const require=createRequire(new URL('../../packages/javascript/package.json',import.meta.url));
const Ajv=require('ajv/dist/2020.js').default,addFormats=require('ajv-formats').default;
const ajv=new Ajv({allErrors:true,strict:false});addFormats(ajv);
const validate=ajv.compile(JSON.parse(await readFile(new URL('../../spec/schemas/opf.schema.json',import.meta.url),'utf8')));

test('font route selection is opt-in, bounded and canonical without changing default CLI',()=>{
 const base=['--consumer','consumer','--output','output','--pptx-repo','pptx'];
 assert.equal(parseArguments(base)['--font-routes'],undefined);
 assert.deepEqual(parseArguments([...base,'--font-routes','all'])['--font-routes'],FONT_ROUTE_CASE_NAMES);
 const names=[FONT_ROUTE_CASE_NAMES[3],FONT_ROUTE_CASE_NAMES[0]];
 assert.deepEqual(selectFontRoutes(names.join(',')),[...names].reverse());
 for(const value of ['',',','all,all',`${names[0]},${names[0]}`,'font-route-missing','../other','ALL'])assert.throws(()=>selectFontRoutes(value));
 assert.throws(()=>parseArguments([...base,'--font-routes']),/Missing value/);
 assert.throws(()=>parseArguments([...base,'--font-routes','all','--font-routes','all']),/Duplicate/);
});

test('five schema-valid route fixtures preserve corpus text, explicit upright styles and unresolved native scope',async()=>{
 const source=await loadFontRouteSource(selectFontRoutes('all'));
 assert.deepEqual(Object.keys(source.decks),FONT_ROUTE_CASE_NAMES);
 assert.equal(source.sourceFiles.length,2);
 for(const name of FONT_ROUTE_CASE_NAMES){
  const deck=source.decks[name],route=source.fontRoutes[name];
  assert.equal(validate(deck),true,JSON.stringify(validate.errors));
  assert.equal(deck.slides.length,3);
  assert.equal(deck.design.fontScheme.complexScript.major,route.requestedNativeFamily);
  assert.equal(deck.design.fontScheme.complexScript.minor,route.requestedNativeFamily);
  assert.equal(route.referenceMeasurement.sha256,null);assert.equal(route.physicalNativeFace,null);
  assert.equal(route.nativeAcceptance,false);assert.equal(route.productionCoefficientsSelected,false);
  assert.ok(route.controls.some(control=>control.id==='numbers'));
  assert.ok(route.controls.some(control=>control.id==='latin'));
  assert.ok(route.controls.some(control=>control.id==='neutrals'));
  assert.ok(route.controls.some(control=>control.id==='mixed'));
  for(const [index,weight]of [400,700].entries())for(const item of deck.slides[index].items){
   assert.equal(item[0].fontFamily,route.requestedNativeFamily);assert.equal(item[0].bold,weight===700);assert.equal(item[0].italic,false);
  }
  assert.deepEqual(deck.slides[2].items.map(item=>item[0].fontSize),[18,18,24,24,32,32]);
 }
 const arabic=source.decks[FONT_ROUTE_CASE_NAMES[0]];
 assert.equal(arabic.slides[0].items[0][0].text,'مراجعة ربع سنوية للمبيعات');
 assert.equal(arabic.slides[0].items[2][0].text,'مَرْحَبًا بِكُمْ فِي الْعَرْضِ');
 assert.ok(arabic.slides[0].items.some(item=>item[0].text.includes('۰۱۲۳۴۵۶۷۸۹')));
 const telugu=source.decks[FONT_ROUTE_CASE_NAMES[1]];
 assert.equal(telugu.slides[0].items[1][0].text,'క్ష జ్ఞ స్త్ర క్త ప్ర శ్రీ');
 await assert.rejects(()=>loadFontRouteSource([FONT_ROUTE_CASE_NAMES[1],FONT_ROUTE_CASE_NAMES[0]]),/canonical explicit/);
});

function fakeEngines(){
 const bytes=[Buffer.from('synthetic preview 400'),Buffer.from('synthetic preview 700')];
 const faces=[400,700].map((weight,i)=>({family:'Noto Naskh Arabic',weight,italic:false,sha256:digest(bytes[i])}));
 const calls={exports:[],previews:[],loads:[]};
 const fonts={ensure:async()=>{},registry:{describeFaces:()=>faces,exportFaces:()=>faces.map((face,i)=>({family:face.family,data:bytes[i]}))}};
 const engines={
  core:{validate:deck=>({valid:validate(deck),findings:validate.errors??[]}),convert:async(deck,options)=>{calls.previews.push({deck,options});return {files:deck.slides.map(()=>({bytes:Buffer.from(options.format)}))};}},
  pptx:{toPptx:async(deck,options)=>{calls.exports.push({deck,options});return Buffer.from(JSON.stringify(deck));},fromPptx:async bytes=>JSON.parse(Buffer.from(bytes).toString())},
  render:{loadFonts:async options=>{calls.loads.push(options);return fonts;}},gallery:{source:'synthetic unit-test gallery',layouts:{one:{}}},
  fflate:{unzipSync:bytes=>Object.fromEntries(JSON.parse(Buffer.from(bytes).toString()).slides.map((_,index)=>[`ppt/slides/slide${index+1}.xml`,Buffer.from('<p:sp>')])),strFromU8:bytes=>Buffer.from(bytes).toString()},
  fontManifest:{packages:[{name:'synthetic-unit-test-package',version:'test-only',license:'OFL-1.1',faces}]},
 };
 return {engines,calls,fonts};
}

test('selected generation seals all files, shares measured handle and refuses reused outputs or mismatched pins',async()=>{
 const scratch=await realpath(await mkdtemp(path.join(tmpdir(),'native-font-routes-')));
 try{
  const consumer=path.join(scratch,'consumer'),output=path.join(scratch,'attempt');await mkdir(consumer);
  const {engines,calls,fonts}=fakeEngines(),names=[FONT_ROUTE_CASE_NAMES[0]];
  const result=await generatePrimaryFixtures({consumer,output,sourceIdentity:{scope:'unit-test-only'},engines,fontRouteNames:names});
  assert.equal(result.cases.length,1);assert.deepEqual(result.scope,{kind:'font-routes',caseIds:names,defaultSuite:false,fullSuite:false,nativeAcceptance:false});
  assert.deepEqual(calls.loads,[{pack:'office',scripts:['Arab']}]);
  assert.ok(calls.exports.every(call=>call.options.fonts===fonts));assert.ok(calls.previews.every(call=>call.options.fonts===fonts));
  assert.ok(calls.exports.every(call=>call.deck.name.includes('Traditional Arabic')));
  assert.deepEqual(JSON.parse(await readFile(path.join(output,'actions',names[0]+'.json'))),[]);
  const metadata=JSON.parse(await readFile(path.join(output,result.cases[0].fontRouteMetadata)));
  assert.equal(metadata.requestedNativeFamily,'Traditional Arabic');assert.equal(metadata.preview.expectedFamily,'Noto Naskh Arabic');
  assert.equal(metadata.preview.actualPinnedBytesVerified,true);assert.equal(metadata.preview.physicalNativeFaceClaimed,false);
  assert.equal(metadata.referenceMeasurement.sha256,null);assert.equal(metadata.nativeAcceptance,false);
  await writeFile(path.join(output,'inspection','extra-selected-diagnostic.json'),'retained diagnostic');
  const suite=await sealSuite(output,{schemaVersion:1,...result});
  assert.ok(suite.files.some(file=>file.path==='inspection/extra-selected-diagnostic.json'),'seal walks whole generated tree independently');
  for(const file of suite.files){const bytes=await readFile(path.join(output,file.path));assert.equal(file.sha256,digest(bytes));assert.equal(file.bytes,bytes.length);}
  assert.deepEqual(JSON.parse(await readFile(path.join(output,'suite.json'))).files,suite.files);
  await assert.rejects(()=>sealSuite(output,result),{code:'EEXIST'});
  await assert.rejects(()=>generatePrimaryFixtures({consumer,output,sourceIdentity:{scope:'test'},engines,fontRouteNames:names}),{code:'EEXIST'});
  await assert.rejects(()=>generatePrimaryFixtures({consumer,output:path.join(consumer,'invalid'),sourceIdentity:{scope:'test'},engines,fontRouteNames:names}),/inside installed consumer/);
  const other=fakeEngines();other.engines.fontManifest.packages[0].faces[0].sha256='0'.repeat(64);
  const source=await loadFontRouteSource(names);
  assert.throws(()=>previewRoutePins(source.fontRoutes[names[0]],other.fonts,other.engines.fontManifest),/loaded preview bytes differ/);
  const linked=path.join(scratch,'linked');await mkdir(linked);await symlink(consumer,path.join(linked,'foreign'));
  await assert.rejects(()=>sealSuite(linked,{schemaVersion:1}),/symlink/);
 }finally{await rm(scratch,{recursive:true,force:true});}
});
