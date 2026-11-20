// Pure/source controls only. Synthetic ZIPs and consumer receipts below are unit fixtures, never qualification outputs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {B07_CASES,B07_NATIVE_BODY_ID,B07_NATIVE_BODY_SHA256,b07NativeBodyExpectedImport,b07SourceSummary,projectB07Source,readB07Sources} from './b07-current-source.mjs';
import {assertB07Output,assertB07Validation,b07Differences,b07FontFacts,generateB07Current,inspectB07Archive,parseB07Arguments,readB07PackedProof,assertB07PackedPreparationRepository} from './b07-current-generate.mjs';
import {digest,packageNames} from './identity.mjs';
const require=createRequire(new URL('../../packages/javascript/package.json',import.meta.url));
const Ajv=require('ajv/dist/2020.js').default,addFormats=require('ajv-formats').default,ajv=new Ajv({allErrors:true,strict:false});addFormats(ajv);
const validate=ajv.compile(JSON.parse(fs.readFileSync(new URL('../../spec/schemas/opf.schema.json',import.meta.url),'utf8')));
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const owned=fn=>{const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'opf-b07-current-')));try{return fn(root);}finally{assert.ok(path.basename(root).startsWith('opf-b07-current-'));fs.rmSync(root,{recursive:true,force:true});}};

test('five closed sources retain historical pins, typed three-path projection and case10 exact bytes',()=>{
  const sources=readB07Sources();assert.equal(sources.length,5);assert.deepEqual(sources.map(source=>source.id),[...B07_CASES.map(pin=>pin.id),B07_NATIVE_BODY_ID]);
  assert.deepEqual(B07_CASES.map(pin=>pin.projection),['/slides/0/items/0/1/lang','/slides/0/items/0/0/lang','/slides/0/items/0/0/lang',null]);
  for(const source of sources.slice(0,4)){
    assert.equal(digest(source.originalBytes),source.pin.sha256);assert.equal(digest(source.currentBytes),source.pin.currentSha256);
    assert.equal(source.original.language,'ar-SA');assert.equal(source.document.language,'ar-SA');assert.equal(source.document.slides.length,1);
    if(source.pin.run===null){assert.deepEqual(source.currentBytes,source.originalBytes);assert.deepEqual(source.document,source.original);}
    else{
      const inverse=structuredClone(source.document),run=inverse.slides[0].items[0][source.pin.run];
      assert.equal(run.language,'ar-SA');assert.equal(Object.hasOwn(run,'lang'),false);const tag=run.language;delete run.language;run.lang=tag;
      assert.deepEqual(inverse,source.original,'Every field except the one typed key stays identical');
      assert.equal(source.document.slides[0].numbering,'arabic','Original marker carrier remains');
      const originalRun=source.original.slides[0].items[0][source.pin.run];
      assert.deepEqual(Buffer.from(run.text,'utf16le'),Buffer.from(originalRun.text,'utf16le'));
    }
  }
  assert.equal(sources[0].document.slides[0].items[0][0],'البند: ');
  assert.equal(sources[2].document.slides[0].items[0][0].text,'Item 1: Customers told us onboarding took too long, so we rebuilt it around the customer journey.');
  assert.deepEqual(sources[3].document.slides[0].blocks[2].items,['Item ١: Arabic-Indic number','Item ۱: Persian number']);
  assert.ok(b07SourceSummary().every(row=>row.nativeAcceptance===false&&row.registryAcceptance===false));
});

test('source hash, unknown IDs, proofing overrides, hidden characters and foreign metadata never enter projection',()=>{
  const source=readB07Sources()[0];
  assert.throws(()=>projectB07Source('other',source.originalBytes),/Unknown/u);
  assert.throws(()=>projectB07Source(source.id,Buffer.concat([source.originalBytes,Buffer.from(' ')])),/length/u);
  for(const mutate of [
    doc=>{doc.slides[0].items[0][1].language='en-US';},
    doc=>{doc.slides[0].items[0][1].lang='en-US';},
    doc=>{doc.slides[0].items[0][1].text+='\u202A';},
    doc=>{doc.extensions={lang:'literal left right',audience:'private'};},
    doc=>{doc.slides[0].numbering='roman';},
  ]){const changed=structuredClone(source.original);mutate(changed);assert.throws(()=>projectB07Source(source.id,json(changed)),/Historical source/u);}
  assert.deepEqual(readB07Sources()[0].originalBytes,source.originalBytes,'No failed projection rewrites the immutable snapshot');
});

test('current closed schema refuses original05/06/09 lang, accepts typed projection and already-current10',()=>{
  for(const source of readB07Sources()){
    const current={valid:validate(source.document),findings:structuredClone(validate.errors??[])};assert.equal(current.valid,true,JSON.stringify(current.findings));
    if(!source.pin){assertB07Validation(source,current);continue;}
    const original={valid:validate(source.original),findings:[]};
    if(source.pin.run!==null){assert.equal(original.valid,false);assert.ok(validate.errors.some(error=>error.keyword==='additionalProperties'&&error.params.additionalProperty==='lang'));original.findings=[{path:source.pin.projection,message:'legacy authored lang'}];}
    assertB07Validation(source,current,original);
    assert.throws(()=>assertB07Validation(source,{valid:false,findings:[]},original),/current authored/u);
    if(source.pin.run!==null){assert.throws(()=>assertB07Validation(source,current,{valid:true,findings:[]}),/historical-schema/u);assert.throws(()=>assertB07Validation(source,current,{valid:false,findings:[{path:'/unrelated'}]}),/typed legacy run/u);}
  }
});

test('native-body control is honest two-paragraph rich text with fixed families, no supplement and explicit canonical import',()=>{
  const body=readB07Sources().at(-1);assert.equal(body.bodyText,'native');assert.equal(body.currentBytes.length,333);assert.equal(digest(body.currentBytes),B07_NATIVE_BODY_SHA256);
  assert.deepEqual(body.document,{slides:[{title:'Title',text:[{text:'Bonjour 1\nWelcome 2 ',language:'ar-SA',fontFamily:'Georgia'},{text:'Hello 2',language:'ar-SA',fontFamily:'Times New Roman'}]}]});
  assert.equal(body.document.slides[0].text.map(run=>run.text).join('').split('\n').length,2);
  const expected=b07NativeBodyExpectedImport();assert.equal(validate(expected),true);assert.deepEqual(expected.slides[0].text.map(run=>run.text),['Bonjour 1','\n','Welcome 2 ','Hello 2']);
  assert.equal(expected.slides[0].text[0].bold,false);assert.equal(expected.slides[0].text[3].fontFamily,'Times New Roman');assert.notDeepEqual(expected,body.document,'Native canonical runs are not authored-boundary restoration');
});

test('default actual CLI inspect imports no product engines, installs nothing and creates no suite',()=>{
  const file=fileURLToPath(new URL('./b07-current-generate.mjs',import.meta.url));
  const program=`import{registerHooks}from'node:module';registerHooks({resolve(s,c,n){if(s.startsWith('@openpresentation/'))throw Error('Product engine imported during source inspection');return n(s,c);}});process.argv=[process.execPath,${JSON.stringify(file)},'inspect'];await import(${JSON.stringify(new URL('./b07-current-generate.mjs',import.meta.url).href)});`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',program],{encoding:'utf8',timeout:10000});assert.equal(child.status,0,child.stderr);
  const result=JSON.parse(child.stdout);assert.equal(result.generation,false);assert.equal(result.nativeAcceptance,false);assert.equal(result.cases.length,5);
});

test('generation requires every explicit external pin; invalid requests fail before any engine/output work',async()=>{
  assert.deepEqual(parseB07Arguments([]),{command:'inspect',options:{}});
  for(const args of [['other'],['inspect','--consumer','somewhere'],['generate'],['generate','--consumer','x','--consumer','x'],['generate','--other','x']])assert.throws(()=>parseB07Arguments(args));
  await assert.rejects(()=>generateB07Current({}),/reviewed new preparation HEAD/u);
  const args=['generate','--packed-preparation-repository','/retained-producer','--consumer','/consumer','--output','/output','--proof','/proof','--expected-proof-sha256','a'.repeat(64),'--expected-revision','b'.repeat(40),'--expected-runtime-sha256','c'.repeat(64),'--expected-routes-sha256','d'.repeat(64)];
  assert.equal(parseB07Arguments(args).options.expectedRevision,'b'.repeat(40));assert.equal(parseB07Arguments(args).options.packedPreparationRepository,'/retained-producer');assert.throws(()=>parseB07Arguments(args.slice(0,1).concat(args.slice(3))),/explicit source\/consumer pins/);
});

test('fresh output refuses source/consumer overlap, existing output and owned parent aliases',()=>owned(root=>{
  const source=path.join(root,'source'),consumer=path.join(root,'consumer'),retained=path.join(root,'retained-packed-producer');fs.mkdirSync(source);fs.mkdirSync(consumer);fs.mkdirSync(retained);
  assert.throws(()=>assertB07Output(path.join(retained,'new'),consumer,retained),/overlaps/u);
  assert.equal(assertB07Output(path.join(root,'new'),consumer,source),path.join(root,'new'));
  for(const output of [root,source,consumer,path.join(source,'child'),path.join(consumer,'child')])assert.throws(()=>assertB07Output(output,consumer,source),/overlaps/u);
  assert.throws(()=>assertB07Output('relative',consumer,source),/absolute/u);
  const exists=path.join(root,'exists');fs.mkdirSync(exists);assert.throws(()=>assertB07Output(exists,consumer,source),/new/u);
  const alias=path.join(root,'alias');fs.symlinkSync(root,alias,process.platform==='win32'?'junction':'dir');try{assert.throws(()=>assertB07Output(path.join(alias,'new'),consumer,source),/canonical/u);}finally{fs.unlinkSync(alias);}
  assert.deepEqual(fs.readdirSync(source),[]);assert.deepEqual(fs.readdirSync(consumer),[]);
}));

test('raw archive inspection keeps wire lang, physical xfrm, complete pPr/bodyPr and original shape cap',()=>{
  const peer=createRequire(new URL('../../packages/pptx/package.json',import.meta.url)),fflate=peer('fflate'),{XMLParser}=peer('fast-xml-parser');
  const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,trimValues:false});
  const shape='<p:sp><p:nvSpPr><p:cNvPr name="OPF native body slides.0.text"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="-9525" y="200"/><a:ext cx="300" cy="400"/></a:xfrm></p:spPr><p:txBody><a:bodyPr rtlCol="0" wrap="none"/><a:p><a:pPr rtl="1"><a:buAutoNum type="arabicPeriod" startAt="1"/></a:pPr><a:r><a:rPr lang="ar-SA" altLang="en-US"><a:latin typeface="Georgia"/><a:cs typeface="Georgia"/></a:rPr><a:t>Bonjour 1</a:t></a:r></a:p><a:p><a:r><a:rPr lang="ar-SA"/><a:t>Welcome 2</a:t></a:r></a:p></p:txBody></p:sp>';
  const xml=count=>'<p:sld><p:cSld><p:spTree>'+shape.repeat(count)+'</p:spTree></p:cSld></p:sld>',archive=count=>fflate.zipSync({'ppt/slides/slide1.xml':fflate.strToU8(xml(count))});
  const facts=inspectB07Archive(archive(1),{fflate,parser}),actual=facts.slides[0].shapes[0];assert.equal(facts.slides[0].xml,xml(1));assert.equal(actual.geometry['a:off'].x,'-9525');
  assert.equal(actual.body['a:bodyPr'].rtlCol,'0');assert.equal(actual.body['a:p'][0]['a:pPr']['a:buAutoNum'].startAt,'1');assert.equal(actual.body['a:p'][0]['a:r']['a:rPr'].lang,'ar-SA');assert.equal(Object.hasOwn(actual.body['a:p'][0]['a:r']['a:rPr'],'language'),false);
  assert.throws(()=>inspectB07Archive(archive(17),{fflate,parser}),/declared16/u);
});

test('findings preserve literal wire/property differences and preview hashes without a native-face claim',()=>{
  assert.deepEqual(b07Differences({lang:'ar-SA',left:1,missing:null},{lang:'en-US',left:2}),[
    {path:'/lang',beforePresent:true,afterPresent:true,before:'ar-SA',after:'en-US'},
    {path:'/left',beforePresent:true,afterPresent:true,before:1,after:2},
    {path:'/missing',beforePresent:true,afterPresent:false,before:null},
  ]);
  const bytes=Buffer.from('synthetic open preview font unit fixture'),fonts={registry:{describeFaces:()=>[{family:'Unit open face'}],exportFaces:()=>[{family:'Unit open face',data:bytes}]}},manifest={packages:[{name:'unit',version:'test-only',license:'OFL-1.1',licenseFile:'OFL.txt',licenseSha256:'a'.repeat(64),faces:[{sha256:digest(bytes)}]}]};
  const facts=b07FontFacts(fonts,manifest);assert.equal(facts.loaded[0].sha256,digest(bytes));assert.equal(facts.licenses[0].licenseSha256,'a'.repeat(64));assert.match(facts.scope,/native physical face remains unobserved/u);
  const wrong=structuredClone(manifest);wrong.packages[0].faces[0].sha256='0'.repeat(64);assert.throws(()=>b07FontFacts(fonts,wrong),/pinned manifest/u);
  wrong.packages[0].faces[0].sha256=digest(bytes);wrong.packages[0].license='proprietary';assert.throws(()=>b07FontFacts(fonts,wrong));
});

test('maintained packed-proof admission binds six real directory identities and refuses changed receipt/runtime/version',()=>owned(root=>{
  // Synthetic installed directories test receipt admission only. No fixture is an installed product engine and none is imported.
  const consumer=path.join(root,'consumer');fs.mkdirSync(consumer);fs.writeFileSync(path.join(consumer,'package.json'),'{}');const packages=[],runtime={},lock={packages:{}};
  for(const name of packageNames){const dir=path.join(consumer,'node_modules',name);fs.mkdirSync(path.join(dir,'dist'),{recursive:true});const bytes=Buffer.from('// synthetic admission unit fixture\n');fs.writeFileSync(path.join(dir,'dist/index.js'),bytes);fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name,version:'0.1.0-unit',exports:{'./package.json':'./package.json'}}));const file=name.split('/').at(-1)+'.tgz',tar=Buffer.from('synthetic tar integrity fixture '+name),integrity='sha512-'+createHash('sha512').update(tar).digest('base64');fs.writeFileSync(path.join(root,file),tar);packages.push({name,sourceVersion:'0.33.0',version:'0.1.0-unit',installedVersion:'0.1.0-unit',file,bytes:tar.length,sha256:digest(tar),integrity});runtime[name+'/dist/index.js']=digest(bytes);lock.packages['node_modules/'+name]={version:'0.1.0-unit',resolved:'file:../'+file,integrity};}
  const lockBytes=json(lock);fs.writeFileSync(path.join(consumer,'package-lock.json'),lockBytes);const report={mode:'candidate-tarballs',consumer,lockSha256:digest(lockBytes),packages,runtime},proof=path.join(root,'proof.json');
  const check=(options={})=>{const bytes=json(report);fs.writeFileSync(proof,bytes);fs.writeFileSync(path.join(root,'manifest.json'),json({published:false,artifacts:packages.map(({installedVersion:_v,integrity:_i,...archive})=>archive)}));return readB07PackedProof({consumer,proof,expectedProofSha256:digest(bytes),...options});};
  assert.equal(check().runtimeFiles,6);assert.equal(check().installedFiles,12);
  report.consumer='consumer';assert.equal(check({preparationRepository:assertB07PackedPreparationRepository(root)}).runtimeFiles,6,'A separate controller resolves the maintained receipt relative to its actual frozen producer');assert.throws(()=>check(),/ENOENT/u);report.consumer=consumer;
  assert.throws(()=>readB07PackedProof({consumer,proof,expectedProofSha256:'0'.repeat(64)}),/receipt changed/u);
  report.packages[0].sourceVersion='0.34.0';assert.throws(check,/sourceVersion/u);report.packages[0].sourceVersion='0.33.0';
  const file=path.join(consumer,'node_modules',packageNames[0],'dist/index.js');fs.writeFileSync(file,'// changed');assert.throws(check,/runtime differs/u);
}));

test('packed producer root is explicit/canonical and cannot alias the immutable proof authority',()=>owned(root=>{
 assert.equal(assertB07PackedPreparationRepository(root),root);
 for(const value of [undefined,null,'relative',path.join(root,'..',path.basename(root))+path.sep])assert.throws(()=>assertB07PackedPreparationRepository(value));
 const file=path.join(root,'not-directory');fs.writeFileSync(file,'inert');assert.throws(()=>assertB07PackedPreparationRepository(file),/directory/);
 const target=path.join(root,'retained'),alias=path.join(root,'alias');fs.mkdirSync(target);fs.symlinkSync(target,alias,process.platform==='win32'?'junction':'dir');assert.throws(()=>assertB07PackedPreparationRepository(alias),/Canonical|Aliased|Reparse\/symlink/);
}));
