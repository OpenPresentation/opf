// SOURCE ONLY. Reads retained JSON; no PPTX import, layout, render or Office.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

let stage='input-admission';
try {
 const [consumerArg,proofFile,fixtureFile,observationFile,suiteFile,output]=process.argv.slice(2);
 assert.equal(process.argv.length,8);assert.match(process.version,/^v24\./u);
 assert.equal(process.env.NODE_OPTIONS,undefined);assert.equal(process.env.NODE_PATH,undefined);
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),before=new Map();
 const read=(file,expected,bytes)=>{const stat=fs.statSync(file);assert.ok(stat.isFile()&&stat.size<=16*1024*1024);if(bytes!==undefined)assert.equal(stat.size,bytes);const data=fs.readFileSync(file);assert.equal(sha(data),expected);if(bytes!==undefined)assert.equal(data.length,bytes);before.set(file,expected);return data;};
 const fixture=JSON.parse(read(fixtureFile,'69ad66eae58f2d7d7a075a78d8cc64d70b8900032f31e97d9e87748ecf85ecbb',519));
 const observation=JSON.parse(read(observationFile,'e001c71f5b2286320f89f5c86262a739a95634e016e3e6d91c15045542a6559f',613994));
 const proof=JSON.parse(read(proofFile,'0863398537df02b5127bd56ff6e5c6e7cf40963b07aec03e8f292d0680e2c1e0'));
 const suite=JSON.parse(read(suiteFile,'132ae22279365ff57d883bdc141fbc945f5fb1f737dd4250f8b834fd048f5e5b',625243));
 const consumer=fs.realpathSync(consumerArg),modules=path.join(consumer,'node_modules');
 assert.equal(fs.realpathSync(suite.provenance.packages.consumer),consumer);
 const manifests=new Map();
 for(const name of ['@openpresentation/opf','@openpresentation/gallery']){
  const records=suite.provenance.packages.packages.filter(row=>row.name===name);assert.equal(records.length,1);const record=records[0];
  assert.equal(fs.realpathSync(path.join(modules,...name.split('/'))),record.directory);assert.ok(record.directory.startsWith(modules+path.sep));
  const rows=record.runtime.files.filter(row=>row.path==='package.json');assert.equal(rows.length,1);
  const manifest=JSON.parse(read(path.join(record.directory,'package.json'),rows[0].sha256,rows[0].bytes));assert.equal(manifest.name,name);manifests.set(name,manifest);
 }
 assert.equal(proof.mode,'candidate-tarballs');read(path.join(consumer,'package-lock.json'),proof.lockSha256);
 assert.ok(proof.runtime&&Object.keys(proof.runtime).length>0&&Object.keys(proof.runtime).length<=2000);
 // Reuse the retained actual consumer's complete runtime identity map. This is
 // not a new package inventory or a substitute for its packed qualification.
 for(const [relative,expected]of Object.entries(proof.runtime)){
  const file=fs.realpathSync(path.join(modules,relative));assert.ok(file.startsWith(modules+path.sep));read(file,expected);
 }
 const require=createRequire(path.join(consumer,'package.json'));
 const boundEntry=name=>{const file=fs.realpathSync(require.resolve(name));assert.ok(before.has(file));return file;};
 const coreEntry=boundEntry('@openpresentation/opf'),galleryEntry=boundEntry('@openpresentation/gallery');
 const corePackage=manifests.get('@openpresentation/opf'),galleryPackage=manifests.get('@openpresentation/gallery');
 assert.equal(corePackage.name,'@openpresentation/opf');assert.equal(galleryPackage.name,'@openpresentation/gallery');
 for(const manifest of [corePackage,galleryPackage])assert.equal(manifest.version,proof.packages.find(row=>row.name===manifest.name)?.installedVersion);

 stage='retained-model-comparison';
 assert.equal(observation.profile,'b07-current-one-case-readonly-v1');assert.equal(observation.nativeAcceptance,false);
 const phaseNames=['original','saved','reopened'],findings=observation.findings;
 for(const name of phaseNames)assert.ok(findings[name]&&Array.isArray(findings[name].diagnostics));
 assert.deepEqual(findings.original.imported,fixture);assert.deepEqual(findings.original.diagnostics,[]);
 assert.deepEqual(findings.saved.imported,findings.reopened.imported);
 assert.deepEqual(findings.saved.diagnostics,findings.reopened.diagnostics);
 const message='Current native text and full parsed styles retained; original scalar defaults were not restored after edits.';
 for(const name of ['saved','reopened']){
  assert.equal(findings[name].diagnostics.length,4);
  for(const diagnostic of findings[name].diagnostics){assert.equal(diagnostic.code,'native-scalar-fragment-reflow');assert.equal(diagnostic.message,message);}
 }
 // Compare already-retained, ordered native run/paragraph text and explicit
 // descriptors. Do not parse XML again or infer inherited-context equivalence.
 stage='retained-native-shape-contract';
 assert.equal(findings.original.nativeShapes.length,16);
 assert.deepEqual(findings.saved.nativeShapes,findings.reopened.nativeShapes);
 const withoutTopLevelRaw=shape=>{assert.ok(Object.hasOwn(shape,'raw'));const {raw,...rest}=shape;return rest;};
 const originalShapes=findings.original.nativeShapes,savedShapes=findings.saved.nativeShapes;
 assert.deepEqual(savedShapes.map(withoutTopLevelRaw),originalShapes.map(withoutTopLevelRaw));
 // Every other field remains exact, INCLUDING each run's rawProperties.
 // Raw OOXML is neither normalized nor represented as equal after Office Save.
 let rawChangedShapeCount=0;
 for(let index=0;index<originalShapes.length;index++){
  assert.notDeepEqual(savedShapes[index].raw,originalShapes[index].raw);rawChangedShapeCount++;
 }
 assert.equal(rawChangedShapeCount,16);
 stage='four-scalar-to-rich-comparison';
 const paths=[['slides',0,'blocks',0,'text'],['slides',0,'blocks',1,'text'],['slides',0,'blocks',2,'items',0],['slides',0,'blocks',2,'items',1]];
 const get=(value,parts)=>parts.reduce((parent,key)=>parent[key],value);
 const projected=structuredClone(findings.saved.imported),groups=[];
 for(const parts of paths){
  const value=get(findings.saved.imported,parts),original=get(fixture,parts);assert.equal(typeof original,'string');assert.ok(Array.isArray(value)&&value.length>0);
  let offset=0;const runs=[];
  for(const run of value){
   assert.ok(run&&typeof run==='object'&&!Array.isArray(run)&&typeof run.text==='string');
   const from=offset;offset+=run.text.length;runs.push({from,to:offset,textSha256:sha(run.text),styleKeys:Object.keys(run).filter(key=>key!=='text').sort()});
  }
  const current=value.map(run=>run.text).join('');assert.equal(current,original);
  // Closed, comparison-only inverse: use CURRENT joined characters, never old
  // source words or styles. No projected model is written or re-exported.
  get(projected,parts.slice(0,-1))[parts.at(-1)]=current;
  groups.push({path:parts.join('.'),utf16:current.length,runCount:value.length,runs});
 }
 assert.deepEqual(projected,fixture,'Every field outside the four exact representation changes must remain equal');
 assert.equal(groups.reduce((sum,group)=>sum+group.utf16,0),98);assert.equal(fixture.slides[0].title.length,19);
 stage='retained-native-png-records';
 const nativePhaseNames=['original','edited','reopened'];
 assert.deepEqual(Object.keys(observation.phases),nativePhaseNames);
 const pngs=nativePhaseNames.map(name=>observation.phases[name].png);
 for(const png of pngs){assert.equal(png.bytes,12267);assert.match(png.sha256,/^[a-f0-9]{64}$/u);assert.equal(png.width,1280);assert.equal(png.height,720);assert.equal(png.sha256,pngs[0].sha256);}

 stage='actual-consumer-format-validation';
 const core=await import(pathToFileURL(coreEntry).href),{gallery}=await import(pathToFileURL(galleryEntry).href),validations=[];
 // Actual supported API: schema/semantic format only, without layout/fonts.
 // See core src/schema-check.ts and validator.ts; no guessed CLI option.
 for(const [name,document]of [['fixture',fixture],...phaseNames.map(name=>[name,findings[name].imported])]){
  stage='actual-consumer-format-'+name;const unchanged=JSON.stringify(document);
  const result=core.validate(document,{only:['format'],catalogs:[gallery]});assert.equal(JSON.stringify(document),unchanged);
  assert.equal(result.valid,true);assert.deepEqual(result.findings,[]);validations.push({name,valid:true,findingCount:0});
 }
 stage='final-identity-check';
 for(const [file,expected]of before)assert.equal(sha(fs.readFileSync(file)),expected);
 assert.ok(path.isAbsolute(output)&&!fs.existsSync(output));assert.equal(fs.realpathSync(path.dirname(output)),path.dirname(output));
 for(const protectedPath of [consumer,fixtureFile,observationFile,proofFile,suiteFile]){
  const absolute=fs.realpathSync(protectedPath);assert.ok(output!==absolute&&!output.startsWith(absolute+path.sep)&&!absolute.startsWith(output+path.sep));
 }
 const result={status:'PASS',nodeVersion:process.version,consumer:{coreVersion:corePackage.version,galleryVersion:galleryPackage.version,proofSha256:before.get(proofFile),runtimeFiles:Object.keys(proof.runtime).length},
  observationSha256:before.get(observationFile),fixtureSha256:before.get(fixtureFile),suiteSha256:before.get(suiteFile),representationChanges:groups,otherFieldsExact:true,savedReopenedExact:true,nativeShapesExceptTopLevelRawExact:true,nativeRunPropertiesExact:true,savedReopenedNativeShapesExact:true,
  originalSavedRawEqual:false,rawChangedShapeCount,rawDifferenceWitness:{bytes:15148,sha256:'f2158f7b5e4034e64b28db1dbf7078ec8d5932cfaec65b571d1fc1ef5f49e77e',scope:'Separate retained JSON diff, reviewed before this checker: only16 custDataLst r:id leaves differ; this checker does not normalize or re-diff raw OOXML.'},
  diagnostics:{original:0,saved:4,reopened:4,code:'native-scalar-fragment-reflow'},validations,
  phasePngs:{byteIdentical:true,bytes:pngs[0].bytes,sha256:pngs[0].sha256,visualAcceptance:false},
  scope:'Retained-model/current-run consistency and schema qualification only. Complete native body/frame/signature proof equality is separately established; changed inherited context is NOT proved equivalent. No original scalar/default-style restoration, reimport, rendering or Office.'};
 fs.mkdirSync(output);const bytes=JSON.stringify(result,null,2)+'\n';fs.writeFileSync(path.join(output,'summary.json'),bytes,{flag:'wx'});
 console.log(JSON.stringify({status:'PASS',bytes:Buffer.byteLength(bytes),sha256:sha(bytes)}));
} catch (error) {
 // Report only the checker line/column, never assertion messages, paths or values.
 const location=String(error.stack).match(/verify[.]mjs:(\d+):(\d+)/u);
 console.error(JSON.stringify({status:'FAIL',stage,checkerLocation:location?{line:Number(location[1]),column:Number(location[2])}:null}));process.exitCode=1;
}
