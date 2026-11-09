// Office-free binding for one explicitly excluded, read-only dense-slide profile.
// Generation identities remain immutable; this controller has its own identity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {digest,fileIdentity,installedIdentity,repositoryIdentity} from './identity.mjs';

export const DENSE_PROFILE='dense-events-readonly-v1';
export const DENSE_CONTROLLER_FILES=[
  'scripts/native-acceptance/dense-survey-contract.mjs',
  'scripts/native-acceptance/run-dense-survey-windows.ps1',
  'scripts/native-acceptance/identity.mjs',
  'scripts/native-acceptance/run-windows.ps1',
];
const controllerRoot=fileURLToPath(new URL('../../',import.meta.url));
const hasControl=value=>[...value].some(char=>char.charCodeAt(0)<32);
const hex=value=>assert.match(value,/^[a-f0-9]{64}$/u,'Expected an explicit SHA256 digest');
const unique=(items,key,label)=>{assert.ok(Array.isArray(items),label);const seen=new Set();for(const item of items){const value=key(item);assert.equal(typeof value,'string',label);assert.ok(value.length&&!seen.has(value.toLowerCase()),label);seen.add(value.toLowerCase());}};
export function plainLocalPath(file,{exists=true}={}){
  assert.equal(typeof file,'string');assert.ok(path.isAbsolute(file)&&!/^[/\\]{2}/u.test(file)&&!hasControl(file),'Expected an absolute local non-UNC path');
  const full=path.resolve(file);let cursor=full;
  for(;;){try{assert.ok(!fs.lstatSync(cursor).isSymbolicLink(),'Reparse/symlink path refused');}catch(error){if(error.code!=='ENOENT'||(exists&&cursor===full))throw error;}const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;}
  return full;
}
function portable(relative){assert.equal(typeof relative,'string');assert.ok(relative&&!path.isAbsolute(relative)&&!hasControl(relative)&&![...relative].some(char=>'\\<>:"|?*'.includes(char)),'Invalid portable asset path');for(const part of relative.split('/'))assert.ok(part&&!['.','..'].includes(part)&&!/[. ]$/u.test(part),'Invalid portable asset segment');return relative;}
function asset(root,relative){portable(relative);const full=plainLocalPath(path.resolve(root,relative));assert.ok(full.startsWith(path.resolve(root)+path.sep),'Asset escaped root');assert.ok(fs.lstatSync(full).isFile(),'Expected a regular asset');return full;}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/u,''));}
function records(root,files){
  assert.ok(Array.isArray(files)&&files.length>0&&files.length<=1000,'Bounded nonempty file records required');unique(files,r=>r.path,'Duplicate file record');let total=0;
  for(const record of files){hex(record.sha256);assert.ok(Number.isSafeInteger(record.bytes)&&record.bytes>=0&&record.bytes<=64*1024*1024,'Invalid file byte bound');total+=record.bytes;assert.ok(total<=256*1024*1024,'256MiB aggregate bound');assert.deepEqual(fileIdentity(asset(root,record.path)),{bytes:record.bytes,sha256:record.sha256},'Changed recorded asset '+record.path);}
}
function boundRepository(root,expected,required=[]){
  plainLocalPath(root);assert.match(expected.revision,/^[a-f0-9]{40}$/u);assert.equal(expected.dirty,false,'Only reviewed clean repositories are eligible');records(root,expected.files);
  for(const file of required)assert.equal(expected.files.filter(r=>r.path===file).length,1,'Missing required code identity '+file);
  const actual=repositoryIdentity(root,expected.files.map(r=>r.path));assert.deepEqual(actual,expected,'Repository HEAD, dirty state or code identity changed');return actual;
}
function dependencies(){const local=createRequire(import.meta.url);const pptx=createRequire(local.resolve('@openpresentation/opf-pptx/package.json'));return {...pptx('fflate'),...pptx('fast-xml-parser')};}

export function inspectDenseArchive(input,deps=dependencies()){
  assert.ok(Buffer.isBuffer(input)||input instanceof Uint8Array);assert.ok(input.length>0&&input.length<=16*1024*1024,'Dense survey input exceeds16MiB');
  let count=0,total=0;const names=new Set();
  const parts=deps.unzipSync(input,{filter(entry){count++;assert.ok(count<=4096,'Dense survey exceeds4096 ZIP entries');portable(entry.name.replace(/\/$/u,''));assert.ok(!names.has(entry.name.toLowerCase()),'Duplicate ZIP entry');names.add(entry.name.toLowerCase());assert.ok(entry.originalSize<=8*1024*1024,'ZIP entry expansion bound');total+=entry.originalSize;assert.ok(total<=64*1024*1024,'ZIP expansion bound');return true;}});
  const slideFiles=Object.keys(parts).filter(name=>/^ppt\/slides\/slide[1-9][0-9]*\.xml$/u.test(name));assert.deepEqual(slideFiles,['ppt/slides/slide1.xml'],'Dense survey requires exactly one original slide part');
  const source=Buffer.from(parts[slideFiles[0]]).toString('utf8');assert.ok(!/<!DOCTYPE|<!ENTITY/u.test(source),'XML declarations refused');assert.equal(deps.XMLValidator.validate(source),true,'Invalid slide XML');
  const parser=new deps.XMLParser({preserveOrder:true,ignoreAttributes:false,parseTagValue:false,parseAttributeValue:false,trimValues:false});const slide=parser.parse(source).find(n=>n['p:sld'])?.['p:sld'];
  const common=slide?.find(n=>n['p:cSld'])?.['p:cSld'],tree=common?.find(n=>n['p:spTree'])?.['p:spTree'];assert.ok(tree,'Missing slide shape tree');
  const shapes=tree.filter(n=>['p:sp','p:pic','p:graphicFrame','p:grpSp','p:cxnSp'].some(k=>Object.hasOwn(n,k)));assert.equal(shapes.length,50,'Dense profile requires exactly50 source shapes');
  const shapeNames=shapes.map(node=>{const kind=Object.keys(node).find(k=>k.startsWith('p:'));const nonvisual=node[kind].find(n=>Object.keys(n).some(k=>/^p:nv.+Pr$/u.test(k)));const container=nonvisual?.[Object.keys(nonvisual).find(k=>k.startsWith('p:'))];const named=container?.find(n=>n['p:cNvPr']);return named?.[':@']?.['@_name'];});
  unique(shapeNames,n=>n,'Source shape names must be nonempty and unique');assert.ok(shapes.every(n=>Object.hasOwn(n,'p:sp')),'Dense profile supports the original ordinary shape set only');
  const textOf=nodes=>nodes.map(n=>{if(n['#text']!==undefined)return String(n['#text']);if(Object.hasOwn(n,'a:br')||Object.hasOwn(n,'a:tab'))return ' ';return Object.entries(n).filter(([key])=>key!==':@').map(([,v])=>Array.isArray(v)?textOf(v):'').join('');}).join('');
  const shapeWords=shapes.map(n=>{const body=n['p:sp'].find(child=>child['p:txBody'])?.['p:txBody']??[];return body.filter(p=>p['a:p']).map(p=>textOf(p['a:p'])).join(' ').match(/\S+/gu)??[];});
  return {slideCount:1,shapeCount:50,shapeNames,shapeWords,zipEntries:count,expandedBytes:total};
}
export function assertDenseSelection(suite,input,plan,deps){
  assert.equal(suite.schemaVersion,1);assert.equal(suite.nativeAcceptance,false);assert.equal(suite.provenance.nativeAcceptance,false);assert.equal(suite.provenance.registryAcceptance,false);
  assert.ok(Array.isArray(suite.cases)&&suite.cases.length<=1000);unique(suite.cases,c=>c.id,'Case IDs');
  const matches=suite.cases.filter(c=>c.id==='feature-dense-events');assert.equal(matches.length,1,'Select the exact dense-events case');const selected=matches[0];
  assert.equal(selected.worker,'furniture');assert.equal(selected.automaticControlEligible,false,'Generic eligibility must remain false');assert.equal(selected.slideCount,1);assert.equal(selected.archiveSha256,digest(input));
  const actions=JSON.parse(Buffer.from(plan).toString('utf8').replace(/^\uFEFF/u,''));assert.deepEqual(actions,[],'Dense survey permits no actions');
  return {selected,archive:inspectDenseArchive(input,deps)};
}
function suiteBinding(generation,deps){
  const directory=plainLocalPath(generation.suiteDirectory);const manifest=asset(directory,'suite.json'),bytes=fs.readFileSync(manifest);hex(generation.manifestSha256);assert.equal(digest(bytes),generation.manifestSha256,'Suite manifest digest changed');
  const suite=JSON.parse(bytes);records(directory,suite.files);assert.deepEqual(suite.provenance,generation.provenance,'Generation provenance changed');
  const selected=suite.cases.find(c=>c.id==='feature-dense-events');assert.ok(selected,'Dense case missing');
  for(const key of ['input','actionPlan','source'])assert.equal(suite.files.filter(r=>r.path===selected[key]).length,1,'Dense asset must be recorded: '+key);
  const input=fs.readFileSync(asset(directory,selected.input)),plan=fs.readFileSync(asset(directory,selected.actionPlan));const checked=assertDenseSelection(suite,input,plan,deps);assert.deepEqual(selected,generation.selectedCase,'Selected generation case changed');
  return {suite,directory,input,plan,...checked};
}
export function validateDenseEnvelope(envelope,{root=controllerRoot,deps=dependencies()}={}){
  assert.equal(envelope.schemaVersion,1);assert.equal(envelope.profile,DENSE_PROFILE);assert.equal(envelope.nativeAcceptance,false);assert.equal(envelope.registryAcceptance,false);
  assert.deepEqual(envelope.limits,{slides:1,sourceShapes:50,delegateShapeLimit:100,maxActions:0,maxArchiveBytes:16*1024*1024,maxZipEntries:4096,maxTimeoutSeconds:60});
  const binding=suiteBinding(envelope.generation,deps);
  boundRepository(envelope.generation.preparationRepository,binding.suite.provenance.suiteRepository,['scripts/native-acceptance/run-windows.ps1']);
  boundRepository(envelope.generation.workerRepository,binding.suite.provenance.workerRepository,['test/native-furniture-control.ps1','test/native-process.ps1','test/native-process-check.ps1','test/native-furniture-harness-check.ps1']);
  const runtime=installedIdentity(envelope.generation.consumer);assert.deepEqual(runtime,binding.suite.provenance.packages,'Installed consumer runtime changed');
  boundRepository(root,envelope.controllerRepository,DENSE_CONTROLLER_FILES);assert.equal(envelope.controllerRepository.directory,fs.realpathSync(root));
  assert.deepEqual(fileIdentity(plainLocalPath(envelope.node.path)),envelope.node.identity,'Node executable changed');assert.equal(envelope.node.path,process.execPath);assert.equal(envelope.node.version,process.version);assert.match(process.version,/^v24\./u,'Native controller uses Node24');
  assert.deepEqual(binding.archive,envelope.archive,'Dense source geometry changed');return {...binding,envelope};
}
export function createDenseEnvelope({suiteDirectory,expectedManifestSha256,preparationRepository,workerRepository,consumer,root=controllerRoot}){
  hex(expectedManifestSha256);const manifest=asset(plainLocalPath(suiteDirectory),'suite.json'),bytes=fs.readFileSync(manifest);assert.equal(digest(bytes),expectedManifestSha256,'Expected suite digest differs');const suite=JSON.parse(bytes);
  const generation={suiteDirectory:fs.realpathSync(suiteDirectory),manifestSha256:expectedManifestSha256,preparationRepository:fs.realpathSync(preparationRepository),workerRepository:fs.realpathSync(workerRepository),consumer:fs.realpathSync(consumer),provenance:suite.provenance,selectedCase:suite.cases.find(c=>c.id==='feature-dense-events')};
  const controllerRepository=repositoryIdentity(root,DENSE_CONTROLLER_FILES);assert.equal(controllerRepository.dirty,false,'Freeze the reviewed controller before creating an execution envelope');
  const binding=suiteBinding(generation,dependencies());const envelope={schemaVersion:1,profile:DENSE_PROFILE,nativeAcceptance:false,registryAcceptance:false,generation,controllerRepository,node:{path:process.execPath,version:process.version,identity:fileIdentity(process.execPath)},archive:binding.archive,limits:{slides:1,sourceShapes:50,delegateShapeLimit:100,maxActions:0,maxArchiveBytes:16*1024*1024,maxZipEntries:4096,maxTimeoutSeconds:60}};
  validateDenseEnvelope(envelope,{root});return envelope;
}
export function readDenseEnvelope(file,expectedSha256,options){hex(expectedSha256);const bytes=fs.readFileSync(plainLocalPath(file));assert.ok(bytes.length<=4*1024*1024,'Envelope bound');assert.equal(digest(bytes),expectedSha256,'Execution envelope digest changed');const result=validateDenseEnvelope(JSON.parse(bytes),options);return {...result,envelopeSha256:digest(bytes)};}
export function assertDenseLifecycle({report,request,terminal,shapeNames,shapeWords,inputSha256,planSha256}){
  assert.equal(terminal.timedOut,false);assert.equal(terminal.exitCode,0);assert.equal(terminal.cleanupConfirmed,true);
  for(const value of [request,report])assert.equal(value.readOnlySurvey,true,'Survey flag missing');
  assert.equal(report.schemaVersion,1);assert.equal(report.cleanupConfirmed,true);assert.equal(report.officeOperationsStopped,false);assert.equal(report.error,null);assert.equal(report.lastStage,'worker.complete');assert.equal(report.lastStatus,'success');
  assert.equal(request.source.sha256,inputSha256);assert.equal(request.source.snapshotSha256,inputSha256);assert.equal(report.source.sha256,inputSha256);assert.equal(report.source.openedSha256,inputSha256);
  assert.equal(request.actionPlan.count,0);for(const value of [request.actionPlan,report.actionPlan]){assert.equal(value.sha256,planSha256);assert.equal(value.snapshotSha256,planSha256);}
  for(const key of ['actions','completed','styleEdits','chartPoints','chartSeriesEdits'])assert.deepEqual(report.actionPlan[key],[],'Unexpected native action '+key);
  for(const phase of ['original','edited','reopened']){const current=report.phases[phase];assert.equal(current.slideCount,1);assert.equal(current.slides.length,1);const slide=current.slides[0];assert.equal(slide.index,1);assert.equal(slide.shapeCount,50);assert.equal(slide.shapes.length,50);assert.deepEqual(slide.shapes.map(s=>s.name),shapeNames,'Dense shape identity/order changed');slide.shapes.forEach((s,i)=>{assert.equal(s.index,i+1);for(const field of ['id','type','left','top','width','height','rotation'])assert.ok(typeof s[field]==='number'&&Number.isFinite(s[field]),'Missing native shape descriptor '+field);assert.ok([-1,0].includes(s.hasTextFrame));assert.ok(s.text===null||typeof s.text==='string');assert.deepEqual((s.text??'').match(/\S+/gu)??[],shapeWords[i],'Dense visible words changed');});assert.equal(current.rasters.length,1);assert.equal(current.rasters[0].slideIndex,1);hex(current.rasters[0].sha256);}
  assert.equal(report.reopened.sha256,report.saved.sha256);hex(report.saved.sha256);return {nativeAcceptance:false,registryAcceptance:false,scope:'One read-only dense-slide observation; zero content edits. No native typography, glyph, raster or release acceptance.'};
}
export function bindDenseObservation({envelopeFile,expectedEnvelopeSha256,output,root=controllerRoot}){
  const binding=readDenseEnvelope(envelopeFile,expectedEnvelopeSha256,{root}),directory=assertDenseOutput(output,binding.envelope,envelopeFile),runner=readJson(asset(directory,'runner.json'));
  assert.equal(runner.schemaVersion,1);assert.equal(runner.nativeAcceptance,false);assert.equal(runner.registryAcceptance,false);assert.equal(runner.runOfficeRequested,true,'Native delegation was not requested');assert.ok(['native-worker-pending','native-observation-completed; acceptance-requires-supervisor-review'].includes(runner.status),'Failed or pure-only attempts cannot be replayed as native observations');assert.equal(runner.profile,DENSE_PROFILE);assert.equal(runner.envelopeSha256,binding.envelopeSha256);assert.deepEqual(runner.generation,binding.envelope.generation);assert.deepEqual(runner.controllerRepository,binding.envelope.controllerRepository);assert.equal(runner.readOnlySurvey,true);assert.ok(Number.isInteger(runner.timeoutSeconds)&&runner.timeoutSeconds>=5&&runner.timeoutSeconds<=60);
  assert.equal(digest(fs.readFileSync(asset(directory,'execution-envelope.json'))),binding.envelopeSha256);
  const native=path.join(directory,'native'),report=readJson(asset(native,'report.json')),request=readJson(asset(native,'request.json')),terminal=readJson(asset(native,'supervisor.json'));
  const inputSha=digest(binding.input),planSha=digest(binding.plan);
  const owned=(actual,relative)=>assert.equal(fs.realpathSync(plainLocalPath(actual)),fs.realpathSync(asset(directory,relative)),'Foreign attempt path');
  owned(request.source.path,'inputs/case.pptx');owned(request.source.snapshotPath,'native/inputs/input.pptx');owned(report.source.path,'inputs/case.pptx');owned(report.source.openedPath,'native/inputs/input.pptx');
  for(const value of [request.actionPlan,report.actionPlan]){owned(value.path,'inputs/action-plan.json');owned(value.snapshotPath,'native/inputs/action-plan.json');}
  for(const value of [request,report])assert.equal(value.captureTextFonts,false,'This profile did not request font capture');
  for(const [file,expected] of [['inputs/case.pptx',inputSha],['inputs/action-plan.json',planSha],['native/inputs/input.pptx',inputSha],['native/inputs/action-plan.json',planSha]])assert.equal(digest(fs.readFileSync(asset(directory,file))),expected,'Changed owned snapshot '+file);
  for(const [key,relative] of [['verifier','test/native-furniture-control.ps1'],['processHelper','test/native-process.ps1']]){const expected=binding.envelope.generation.provenance.workerRepository.files.find(r=>r.path===relative);assert.deepEqual(report.inputs[key],request[key]);assert.equal(fs.realpathSync(plainLocalPath(request[key].path)),fs.realpathSync(asset(binding.envelope.generation.workerRepository,relative)),'Foreign worker code path');owned(request[key].snapshotPath,'native/inputs/'+path.basename(relative));assert.equal(request[key].sha256,expected.sha256);assert.equal(request[key].snapshotSha256,expected.sha256);assert.equal(digest(fs.readFileSync(asset(native,'inputs/'+path.basename(relative)))),expected.sha256);}
  const result=assertDenseLifecycle({report,request,terminal,shapeNames:binding.archive.shapeNames,shapeWords:binding.archive.shapeWords,inputSha256:inputSha,planSha256:planSha});
  const saved=asset(native,'native-furniture-control.pptx');owned(report.saved.path,'native/native-furniture-control.pptx');owned(report.reopened.path,'native/native-furniture-control.pptx');const savedBytes=fs.readFileSync(saved);assert.equal(digest(savedBytes),report.saved.sha256);const reopenedArchive=inspectDenseArchive(savedBytes);for(const key of ['slideCount','shapeCount','shapeNames','shapeWords'])assert.deepEqual(reopenedArchive[key],binding.archive[key],'Saved dense content changed: '+key);
  const pngs=[];for(const phase of ['original','edited','reopened']){const record=report.phases[phase].rasters[0],file=asset(native,phase+'-slide-01.png');assert.equal(path.resolve(record.path),file);const png=fs.readFileSync(file);assert.ok(png.length>=33&&png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Native raster must be PNG');assert.equal(png.readUInt32BE(16),1280);assert.equal(png.readUInt32BE(20),720);const hash=digest(png);assert.equal(hash,record.sha256);pngs.push({phase,sha256:hash});}
  return {...result,profile:DENSE_PROFILE,envelopeSha256:binding.envelopeSha256,inputSha256:inputSha,savedSha256:report.saved.sha256,reportSha256:digest(fs.readFileSync(asset(native,'report.json'))),controllerRepository:binding.envelope.controllerRepository,generation:binding.envelope.generation,phases:3,slidesPerPhase:1,shapesPerPhase:50,pngs};
}
function args(argv){const [mode,...rest]=argv,options={};for(let i=0;i<rest.length;i+=2){assert.ok(/^--[a-z-]+$/u.test(rest[i])&&rest[i+1]&&!rest[i+1].startsWith('--'));assert.ok(!Object.hasOwn(options,rest[i]));options[rest[i]]=rest[i+1];}return {mode,options};}
export function assertDenseOutput(directory,envelope,envelopeFile){
  const full=plainLocalPath(directory,{exists:false});
  const roots=[envelope.generation.suiteDirectory,envelope.generation.preparationRepository,envelope.generation.workerRepository,envelope.generation.consumer,envelope.controllerRepository.directory,...(envelopeFile?[envelopeFile]:[])];
  const key=value=>path.resolve(value).replaceAll('\\','/').toLowerCase();const candidate=key(full);
  for(const root of roots){const protectedPath=key(plainLocalPath(root));assert.ok(candidate!==protectedPath&&!candidate.startsWith(protectedPath+'/')&&!protectedPath.startsWith(candidate+'/'),'Output overlaps immutable source/runtime/input');}
  return full;
}
function writeExclusive(file,value){const full=plainLocalPath(file,{exists:false});assert.ok(!fs.existsSync(full),'Fresh result path required');assert.ok(fs.statSync(path.dirname(full)).isDirectory());fs.writeFileSync(full,JSON.stringify(value,null,2)+'\n',{flag:'wx'});return fileIdentity(full);}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const {mode,options:o}=args(process.argv.slice(2));
  if(mode==='create'){
    assert.deepEqual(Object.keys(o).sort(),['--consumer','--expected-manifest-sha256','--output','--preparation-repository','--suite','--worker-repository'].sort());
    const envelope=createDenseEnvelope({suiteDirectory:o['--suite'],expectedManifestSha256:o['--expected-manifest-sha256'],preparationRepository:o['--preparation-repository'],workerRepository:o['--worker-repository'],consumer:o['--consumer']});assertDenseOutput(o['--output'],envelope);console.log(JSON.stringify({profile:DENSE_PROFILE,output:o['--output'],...writeExclusive(o['--output'],envelope),nativeAcceptance:false}));
  }else if(mode==='verify'){
    assert.deepEqual(Object.keys(o).sort(),['--envelope','--expected-envelope-sha256'].sort());const b=readDenseEnvelope(o['--envelope'],o['--expected-envelope-sha256']);console.log(JSON.stringify({profile:DENSE_PROFILE,envelopeSha256:b.envelopeSha256,generation:b.envelope.generation,controllerRepository:b.envelope.controllerRepository,node:b.envelope.node,archive:b.archive,inputPath:asset(b.directory,b.selected.input),planPath:asset(b.directory,b.selected.actionPlan)}));
  }else if(mode==='observe'){
    assert.deepEqual(Object.keys(o).sort(),['--envelope','--expected-envelope-sha256','--output'].sort());const result=bindDenseObservation({envelopeFile:o['--envelope'],expectedEnvelopeSha256:o['--expected-envelope-sha256'],output:o['--output']});writeExclusive(path.join(o['--output'],'dense-survey-observation.json'),result);console.log(JSON.stringify({profile:DENSE_PROFILE,nativeAcceptance:false,registryAcceptance:false,status:'observations-bound; supervisor acceptance required'}));
  }else throw Error('Use create, verify or observe; no Office is called by this module');
}
