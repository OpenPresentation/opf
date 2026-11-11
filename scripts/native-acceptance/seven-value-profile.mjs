// Prospective typed treemap action controller; no Office calls in this module.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createSevenEnvelope,validateSevenEnvelope,assertSevenOutput,importSevenPublic,SEVEN_SUPERVISOR,SEVEN_CONTROLLER_FILES} from './seven-chart-profile.mjs';
import {inspectSevenArchive,bindSevenPhase} from './seven-chart-archive.mjs';
import {digest,fileIdentity,repositoryIdentity} from './identity.mjs';
import {bindSevenValueActionFile} from './seven-value-archive.mjs';
import {CURRENT_VALUE_PROFILE,CURRENT_SEVEN_FIXTURE,CURRENT_SEVEN_FIXTURE_SHA256,currentSevenArchiveContext,bindCurrentTreemap,compareCurrentTreemapEdit} from './seven-value-current.mjs';
import {OWNED_SHARED_FILES,OWNED_POSTFLIGHT_POLICY,ownedControllerFiles,canonicalOwnedPath,readOwnedFile,readOwnedJson,assertOwnedKeys,writeOwnedRequest,bindOwnedRequest,REQUEST_HASH_TOKEN,writeOwnedAdmission,makeOwnedAdmission,assertOwnedKernel,assertOwnedStageWire,assertOwnedOperations,ownedSuccess,sourceIdentityFiles,assertOwnedPostflightArtifacts} from './owned-postflight.mjs';
import {sevenExpectedOperations} from './seven-postflight.mjs';
import {sevenValueLibraries} from './seven-value-libraries.mjs';

const ROOT=fs.realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
export const VALUE_POLICY=Object.freeze({policy:'seven-treemap-value-bounded-global-zero-after-completed-owned-quit-v1',...OWNED_POSTFLIGHT_POLICY});
const entries=['seven-value-profile.mjs','seven-value-current.mjs','seven-value-raw.mjs','seven-value-archive.mjs','seven-value-actions.ps1','seven-value-worker.ps1','run-seven-value-profile.ps1','seven-value-bootstrap.ps1','seven-value-postflight.ps1','seven-value-archive.test.mjs','seven-value-actions-self-test.ps1','seven-value-current.test.mjs','seven-value-control-fixture.mjs','seven-value-profile.test.mjs','seven-value-postflight-self-test.ps1'].map(name=>'scripts/native-acceptance/'+name);
export const VALUE_FILES=ownedControllerFiles(ROOT,[...entries,...SEVEN_CONTROLLER_FILES,...OWNED_SHARED_FILES,CURRENT_SEVEN_FIXTURE,'scripts/native-acceptance/seven-postflight.ps1']);
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const at=(root,relative)=>canonicalOwnedPath(path.join(root,relative));
const write=(file,bytes)=>{fs.writeFileSync(canonicalOwnedPath(file),bytes,{flag:'wx'});return fileIdentity(file);};
const keys=assertOwnedKeys;
export function createSevenValueEnvelope(options){
 keys(options,['generation','selection']);
 keys(options.generation,['suiteDirectory','expectedManifestSha256','caseId','preparationRepository','workerRepository','consumer']);
 const archiveContext=currentSevenArchiveContext(ROOT),base=createSevenEnvelope({...options.generation,root:ROOT,archiveContext});base.controllerRepository=repositoryIdentity(ROOT,VALUE_FILES);
 const bound=validateSevenEnvelope(base,{root:ROOT,archiveContext}),target=bindCurrentTreemap(bound.input,bound.source.deck,options.selection,{root:ROOT});
 const actionBytes=json(target.action),wire=bindSevenValueActionFile(actionBytes,target.action);
 return{schemaVersion:1,profile:CURRENT_VALUE_PROFILE,postflightPolicy:VALUE_POLICY,limits:{...base.limits,maxActions:1},libraries:sevenValueLibraries(),base,selection:options.selection,action:wire.action,actionModelSha256:wire.actionModelSha256,actionFileIdentity:wire.actionFileIdentity,census:target.census,classification:target.classification,nativeAcceptance:false,registryAcceptance:false};
}
export function validateSevenValueEnvelope(envelope){
 keys(envelope,['schemaVersion','profile','postflightPolicy','limits','libraries','base','selection','action','actionModelSha256','actionFileIdentity','census','classification','nativeAcceptance','registryAcceptance']);
 assert.equal(envelope.schemaVersion,1);assert.equal(envelope.profile,CURRENT_VALUE_PROFILE);assert.deepEqual(envelope.postflightPolicy,VALUE_POLICY);assert.equal(envelope.nativeAcceptance,false);assert.equal(envelope.registryAcceptance,false);
 keys(envelope.base,['schemaVersion','profile','postflightPolicy','nativeAcceptance','registryAcceptance','generation','controllerRepository','node','limits','phases','archive','source']);
 assert.deepEqual(envelope.libraries,sevenValueLibraries(),'Controller parser/ZIP implementation changed');
 const base=validateSevenEnvelope(envelope.base,{root:ROOT,archiveContext:currentSevenArchiveContext(ROOT)});
 assert.deepEqual(envelope.limits,{...envelope.base.limits,maxActions:1});
 assert.deepEqual(envelope.base.controllerRepository,repositoryIdentity(ROOT,VALUE_FILES));
 assert.equal(envelope.base.generation.provenance.chartBaselines.current.sha256,CURRENT_SEVEN_FIXTURE_SHA256);
 const target=bindCurrentTreemap(base.input,base.source.deck,envelope.selection,{root:ROOT});
 for(const key of ['action','actionModelSha256','census','classification'])assert.deepEqual(envelope[key],target[key]);
 assert.deepEqual(envelope.actionFileIdentity,{bytes:json(target.action).length,sha256:digest(json(target.action))});
 return{...base,envelope,target};
}
export function readSevenValueEnvelope(file,sha256){
 const bytes=readOwnedFile(file,4*1024*1024);assert.equal(digest(bytes),sha256);
 return{...validateSevenValueEnvelope(JSON.parse(bytes)),envelopeSha256:sha256};
}
function expectedSnapshots(binding,envelopeFile){
 const root=binding.envelope.base.controllerRepository.directory;
 return[
  {path:'execution-envelope.json',...fileIdentity(envelopeFile)},
  {path:'inputs/case.pptx',bytes:binding.input.length,sha256:digest(binding.input)},
  {path:'inputs/action.json',...binding.envelope.actionFileIdentity},
  {path:'inputs/seven-value-worker.ps1',...fileIdentity(at(root,'scripts/native-acceptance/seven-value-worker.ps1'))},
  {...SEVEN_SUPERVISOR,path:'inputs/native-process.ps1'},
 ];
}
export function expectedSevenValueRequest(binding,directory,runner,snapshots){
 const base=binding.envelope.base;
 return{schemaVersion:1,profile:CURRENT_VALUE_PROFILE,policy:VALUE_POLICY,envelopeSha256:binding.envelopeSha256,output:directory,node:base.node,controller:base.controllerRepository,generation:base.generation,snapshots,timeoutSeconds:runner.timeoutSeconds,runOfficeRequested:runner.runOfficeRequested,
 selectedCase:{caseId:base.generation.caseId,selection:binding.envelope.selection,action:binding.envelope.action,actionModelSha256:binding.envelope.actionModelSha256,actionFileIdentity:binding.envelope.actionFileIdentity,representation:'native-treemap-choice'},
 workerPath:at(directory,'inputs/seven-value-worker.ps1'),nativeRoot:at(directory,'native'),workerArguments:['-ExecutionEnvelope',at(directory,'execution-envelope.json'),'-ExpectedEnvelopeSha256',binding.envelopeSha256,'-NodeExecutable',base.node.path,'-OutputDirectory',at(directory,'native'),'-TimeoutSeconds',String(runner.timeoutSeconds),'-ExpectedRequestSha256',REQUEST_HASH_TOKEN,'-Worker'],nativeAcceptance:false,registryAcceptance:false};
}
export function validateSevenValueExecution(envelopeFile,sha256,directory,requireOffice){
 // The production/default path ALWAYS verifies real source/runtime authority
 // before the independently testable owned-record stage. No injected verifier.
 const binding=readSevenValueEnvelope(envelopeFile,sha256);
 return assertSevenValueExecutionRecords(binding,envelopeFile,directory,requireOffice);
}
export function assertSevenValueExecutionRecords(binding,envelopeFile,directory,requireOffice){
 const sha256=binding.envelopeSha256;
 directory=assertSevenOutput(directory,binding.envelope.base);
 const runner=readOwnedJson(at(directory,'runner.json'));
 keys(runner,['schemaVersion','profile','envelopeSha256','timeoutSeconds','runOfficeRequested','status','snapshots','request']);
 assert.equal(runner.schemaVersion,1);assert.equal(runner.profile,CURRENT_VALUE_PROFILE);assert.equal(runner.envelopeSha256,sha256);assert.equal(runner.runOfficeRequested,requireOffice);
 assert.ok(Number.isInteger(runner.timeoutSeconds)&&runner.timeoutSeconds>=5&&runner.timeoutSeconds<=60);
 assert.equal(runner.status,requireOffice?'prepared-native-request; execution-not-acceptance':'pure-prepared; native-not-run');
 const snapshots=expectedSnapshots(binding,envelopeFile);assert.deepEqual(runner.snapshots,snapshots);
 for(const record of snapshots)assert.deepEqual(fileIdentity(at(directory,record.path)),{bytes:record.bytes,sha256:record.sha256});
 const wire=bindSevenValueActionFile(readOwnedFile(at(directory,'inputs/action.json'),4*1024*1024),binding.target.action);
 assert.equal(wire.actionModelSha256,binding.envelope.actionModelSha256);assert.deepEqual(wire.actionFileIdentity,binding.envelope.actionFileIdentity);
 const requestBinding=bindOwnedRequest(at(directory,'execution-request.json'),expectedSevenValueRequest(binding,directory,runner,snapshots));assert.deepEqual(runner.request,requestBinding.identity);
 return{...binding,directory,runner,snapshots,requestBinding};
}
export function prepareSevenValueExecution(envelopeFile,sha256,output,{timeoutSeconds=45,runOfficeRequested=false}={}){
 const binding=readSevenValueEnvelope(envelopeFile,sha256),base=binding.envelope.base;
 assert.ok(Number.isInteger(timeoutSeconds)&&timeoutSeconds>=5&&timeoutSeconds<=60);assert.equal(typeof runOfficeRequested,'boolean');
 const directory=assertSevenOutput(output,base,envelopeFile);assert.equal(fs.existsSync(directory),false,'Fresh owned output required');
 fs.mkdirSync(directory);fs.mkdirSync(at(directory,'inputs'));
 const copies=[['execution-envelope.json',readOwnedFile(envelopeFile)],['inputs/case.pptx',binding.input],['inputs/action.json',json(binding.target.action)],['inputs/seven-value-worker.ps1',readOwnedFile(at(ROOT,'scripts/native-acceptance/seven-value-worker.ps1'))],['inputs/native-process.ps1',readOwnedFile(at(base.generation.workerRepository,SEVEN_SUPERVISOR.path))]];
 for(const [name,bytes]of copies)write(at(directory,name),bytes);
 const snapshots=expectedSnapshots(binding,envelopeFile),runner={schemaVersion:1,profile:CURRENT_VALUE_PROFILE,envelopeSha256:sha256,timeoutSeconds,runOfficeRequested,status:runOfficeRequested?'prepared-native-request; execution-not-acceptance':'pure-prepared; native-not-run',snapshots,request:null};
 const made=writeOwnedRequest(at(directory,'execution-request.json'),expectedSevenValueRequest(binding,directory,runner,snapshots));runner.request=made.identity;write(at(directory,'runner.json'),json(runner));
 validateSevenValueExecution(at(directory,'execution-envelope.json'),sha256,directory,runOfficeRequested);
 return{directory,request:made.identity,workerArguments:made.workerArguments,nativeAcceptance:false};
}
function valueTargetOperations(prefix,shapeCount){
 const names=['fullName','readOnly','slides','slides.count','slide.get','shapes','shapes.count'].map(suffix=>prefix+'.'+suffix);
 assert.ok(Number.isInteger(shapeCount)&&shapeCount>=1&&shapeCount<=3);
 for(let index=1;index<=shapeCount;index++)names.push(...['get','id','name'].map(suffix=>prefix+'.shape.'+index+'.'+suffix));
 names.push(...['hasChart','chart','chart.type','series','series.count','series.item','series.name'].map(suffix=>prefix+'.'+suffix));return names;
}
export function sevenValueOperations(report,action){
 const originalCount=report.phases.original.slides[action.slideIndex-1].shapeCount,savedCount=report.phases['saved-reopened'].slides[action.slideIndex-1].shapeCount;
 const guard=prefix=>[prefix+'.fullName',prefix+'.readOnly'];
 const original=[...valueTargetOperations('value.original.target',originalCount),...guard('value.original.read'),'value.original.values.get',...guard('value.setter'),'value.series.values.set',...guard('value.edited.read'),'value.edited.values.get'];
 const reopened=[...valueTargetOperations('value.saved-reopened.target',savedCount),...guard('value.saved-reopened.read'),'value.saved-reopened.values.get'];
 return sevenExpectedOperations(report).flatMap(name=>[...(name==='application.create'?['preflight.globalIdle']:[]),...(name==='copy.fullName'?original:[]),...(name==='saved-reopened.slides'?reopened:[]),name]);
}
export function sevenValueCriticalProbes(report,action){
 const records=[],add=(stage,expected,actual=expected)=>records.push({stage,expected,actual,matched:true});
 add('preflight.globalIdle',0);
 const owned=prefix=>add(prefix+'.ownership','same verified owned application/presentation references',true);
 const guard=(prefix,file)=>{owned(prefix);for(const suffix of ['capturedRefs','fullName.refs'])add(prefix+'.'+suffix,'same captured owned references/path',true);add(prefix+'.fullName',file);add(prefix+'.readOnly.refs','same captured owned references/path',true);add(prefix+'.readOnly',-1);};
 const target=(prefix,phase,file)=>{owned(prefix);add(prefix+'.fullName',file);add(prefix+'.readOnly',-1);add(prefix+'.slides.count',7);add(prefix+'.shapes.count','1..3',report.phases[phase].slides[action.slideIndex-1].shapeCount);add(prefix+'.exactTarget',1);add(prefix+'.hasChart',-1);add(prefix+'.chart.type',action.comChartType);add(prefix+'.series.count','1..'+action.maxSeriesCount,1);add(prefix+'.series.name',action.seriesName);};
 const readback=(phase,values)=>values.forEach((value,index)=>add('value.'+phase+'.expected.'+index,value));
 target('value.original.target','original',report.sourcePath);guard('value.original.read',report.sourcePath);readback('original',action.expectedValues);guard('value.setter',report.sourcePath);guard('value.edited.read',report.sourcePath);readback('edited',action.newValues);
 target('value.saved-reopened.target','saved-reopened',report.savedPath);guard('value.saved-reopened.read',report.savedPath);readback('saved-reopened',action.newValues);
 return records;
}
export function assertSevenValueReady(binding,terminal,report,stages,savedArchive){
 const {envelope,directory,target,requestBinding}=binding,base=envelope.base,action=target.action;
 assertOwnedKernel(terminal,binding.runner.timeoutSeconds);assert.equal(binding.runner.runOfficeRequested,true);
 for(const [field,value]of Object.entries({profile:CURRENT_VALUE_PROFILE,schemaVersion:3,requestSha256:requestBinding.identity.sha256,envelopeSha256:binding.envelopeSha256,sourcePath:at(directory,'inputs/case.pptx'),sourceSha256:digest(binding.input),savedPath:at(directory,'native/saved.pptx'),workerPath:at(directory,'inputs/seven-value-worker.ps1'),workerSha256:fileIdentity(at(directory,'inputs/seven-value-worker.ps1')).sha256,error:null,officeOperationsStopped:false,cleanupConfirmed:true,lastStage:'worker.complete',lastStatus:'success',closes:2,saveCopies:1,quits:1}))assert.deepEqual(report[field],value,field);
 for(const field of ['generation','controllerRepository','node'])assert.deepEqual(report[field],base[field]);assert.deepEqual(report.limits,envelope.limits);
 assert.deepEqual(Object.keys(report.phases),['original','saved-reopened']);bindSevenPhase(binding.archive,report.phases.original);bindSevenPhase(savedArchive,report.phases['saved-reopened']);
 assert.equal(report.actions.length,1);const probe=report.actions[0];
 for(const [field,value]of Object.entries({op:action.op,actionModelSha256:envelope.actionModelSha256,actionFileIdentity:envelope.actionFileIdentity,status:'success',setterAttempts:1,before:action.expectedValues,after:action.newValues,reopened:action.newValues,observedKind:'System.Array',observedRank:1,observedLength:action.expectedValues.length,observedValues:action.newValues}))assert.deepEqual(probe[field],value,field);
 assert.deepEqual(report.opens.map(open=>[open.phase,open.path,open.readOnly,open.sha256]),[['original',report.sourcePath,-1,report.sourceSha256],['saved-reopened',report.savedPath,-1,report.savedSha256]]);
 assert.ok(Array.isArray(report.probes)&&report.probes.length>0);for(const probe of report.probes)assert.equal(probe.matched,true);
 assert.deepEqual(report.probes.filter(probe=>typeof probe.stage==='string'&&(probe.stage.startsWith('value.')||probe.stage.startsWith('preflight.'))),sevenValueCriticalProbes(report,action),'Exact current value ownership/readback probe grammar differs');
 const successes=assertOwnedOperations(stages,sevenValueOperations(report,action)),value=name=>ownedSuccess(stages,name).value;
 for(const name of ['preflight.globalIdle','application.initial.count','original.preflight.count','saved-reopened.preflight.count','application.final.count'])assert.equal(value(name),0);
 for(const [phase,expectedPath]of [['original',report.sourcePath],['saved-reopened',report.savedPath]]){
  for(const suffix of ['fullName','close.fullName'])assert.equal(value(phase+'.'+suffix),expectedPath);assert.equal(value(phase+'.readOnly'),-1);assert.equal(value(phase+'.slides.count'),7);
  for(let slide=1;slide<=7;slide++)for(let shape=1;shape<=2;shape++){
   const observed=report.phases[phase].slides[slide-1].shapes[shape-1],prefix=phase+'.slide.'+slide+'.shape.'+shape;
   for(const field of ['id','name','type','left','top','width','height','rotation','hasTextFrame','alternativeText'])assert.deepEqual(value(prefix+'.'+field),observed[field]);
   if(observed.hasTextFrame===-1)assert.equal(value(prefix+'.text'),observed.text);else assert.equal(observed.text,null);
  }
 }
 for(const prefix of ['value.original.target','value.original.read','value.setter','value.edited.read','value.saved-reopened.target','value.saved-reopened.read']){assert.equal(value(prefix+'.fullName'),prefix.includes('saved-reopened')?report.savedPath:report.sourcePath);assert.equal(value(prefix+'.readOnly'),-1);}
 for(const prefix of ['value.original.target','value.saved-reopened.target']){
  assert.equal(value(prefix+'.chart.type'),117);assert.equal(value(prefix+'.hasChart'),-1);assert.equal(value(prefix+'.series.count'),1);assert.equal(value(prefix+'.series.name'),action.seriesName);assert.equal(value(prefix+'.slides.count'),7);
  const phase=prefix.includes('saved-reopened')?'saved-reopened':'original',shapes=report.phases[phase].slides[action.slideIndex-1].shapes;
  assert.equal(value(prefix+'.shapes.count'),shapes.length);let matches=0;
  for(const [index,shape]of shapes.entries()){assert.equal(value(prefix+'.shape.'+(index+1)+'.id'),shape.id);assert.equal(value(prefix+'.shape.'+(index+1)+'.name'),shape.name);if(shape.id===action.shapeId&&shape.name===action.shapeName)matches++;}
  assert.equal(matches,1);
 }
 for(const phase of ['original','edited','saved-reopened'])assert.equal(value('value.'+phase+'.values.get'),'[unsupported non-primitive value]');
 assert.equal(value('copy.fullName'),report.sourcePath);assert.equal(value('copy.afterName'),report.sourcePath);assert.equal(successes.at(-1).cleanupConfirmed,true);
 return{workerCleanupConfirmed:true,stageCount:stages.length,lifecycle:successes.map(({stage,sequence})=>({stage,sequence})),opens:2,saves:1,closes:2,edits:1,quits:1};
}
export async function sevenValueAdmission(binding){
 const {directory,envelope}=binding,report=readOwnedJson(at(directory,'native/report.json')),terminal=readOwnedJson(at(directory,'native/worker.json')),stages=assertOwnedStageWire(readOwnedFile(at(directory,'native/stages.jsonl'),4*1024*1024)),saved=readOwnedFile(at(directory,'native/saved.pptx'));
 assert.equal(digest(saved),report.savedSha256);const savedArchive=inspectSevenArchive(saved,undefined,binding.target.archiveContext),ready=assertSevenValueReady(binding,terminal,report,stages,savedArchive);
 const imports={};for(const [phase,bytes]of [['original',binding.input],['saved-reopened',saved]])imports[phase]=await importSevenPublic(bytes,{consumer:envelope.base.generation.consumer});
 const comparison=compareCurrentTreemapEdit({input:binding.input,saved,source:binding.source.deck,action:binding.target.action,phases:report.phases,imports,root:ROOT});
 const files=['execution-envelope.json','execution-request.json','runner.json','native/report.json','native/worker.json','native/stages.jsonl','native/saved.pptx',...binding.snapshots.map(record=>record.path)].map(relative=>at(directory,relative));
 for(const phase of ['original','saved-reopened']){assert.equal(report.phases[phase].rasters.length,7);for(const [index,raster]of report.phases[phase].rasters.entries()){
  const file=at(directory,'native/'+phase+'-'+String(index+1).padStart(2,'0')+'.png');assert.equal(raster.slideIndex,index+1);assert.equal(raster.path,file);assert.equal(fileIdentity(file).sha256,raster.sha256);const png=readOwnedFile(file);assert.ok(png.length>=33&&png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));assert.equal(png.readUInt32BE(16),1280);assert.equal(png.readUInt32BE(20),720);files.push(file);
 }}
 files.push(envelope.base.node.path,...sourceIdentityFiles(envelope.base.controllerRepository,envelope.base.generation.provenance,envelope.libraries),binding.source.identity.path,at(envelope.base.generation.suiteDirectory,'suite.json'));
 validateSevenValueExecution(at(directory,'execution-envelope.json'),binding.envelopeSha256,directory,true);
 return{admission:makeOwnedAdmission({profile:CURRENT_VALUE_PROFILE,policy:VALUE_POLICY,requestSha256:binding.requestBinding.identity.sha256,files,ready}),comparison,imports};
}
async function main(argv){
 const [command,...rest]=argv,options={};assert.equal(rest.length%2,0);for(let i=0;i<rest.length;i+=2){assert.match(rest[i],/^--[a-z-]+$/u);assert.ok(!Object.hasOwn(options,rest[i]));options[rest[i]]=rest[i+1];}
 const allowed=command==='create-envelope'?['--options','--output']:['--envelope','--sha256','--output','--require-office','--timeout'];for(const name of Object.keys(options))assert.ok(allowed.includes(name),'Unknown argument');
 if(command==='create-envelope'){const envelope=createSevenValueEnvelope(readOwnedJson(options['--options']));write(options['--output'],json(envelope));console.log(JSON.stringify({path:options['--output'],...fileIdentity(options['--output'])}));return;}
 const file=options['--envelope'],sha=options['--sha256'],output=options['--output'];
 if(command==='verify'){const b=readSevenValueEnvelope(file,sha);console.log(JSON.stringify({profile:CURRENT_VALUE_PROFILE,node:b.envelope.base.node,controller:b.envelope.base.controllerRepository}));return;}
 assert.ok(['true','false'].includes(options['--require-office']??'false'));const office=options['--require-office']==='true';
 if(command==='prepare'){console.log(JSON.stringify(prepareSevenValueExecution(file,sha,output,{timeoutSeconds:Number(options['--timeout']??45),runOfficeRequested:office})));return;}
 const b=validateSevenValueExecution(file,sha,output,office);
 if(command==='verify-execution'){console.log(JSON.stringify({inputPath:at(output,'inputs/case.pptx'),sourceSha256:digest(b.input),requestSha256:b.requestBinding.identity.sha256,actionModelSha256:b.envelope.actionModelSha256,actionFileIdentity:b.envelope.actionFileIdentity}));return;}
 assert.equal(office,true);assert.ok(['verify-postflight','verify-admission','observe'].includes(command));const result=await sevenValueAdmission(b),admissionFile=at(output,'postflight-admission.json');
 if(command==='verify-postflight'){console.log(JSON.stringify(writeOwnedAdmission(admissionFile,result.admission)));return;}
 assert.deepEqual(readOwnedJson(admissionFile),result.admission,'Admission changed from actual current verification');
 if(command==='observe'){const terminal=readOwnedJson(at(output,'native/supervisor.json'));assert.equal(terminal.cleanupConfirmed,true);assertOwnedPostflightArtifacts(terminal.postflight,readOwnedFile(at(output,'postflight.jsonl'),65536),VALUE_POLICY,result.admission);write(at(output,'observations.json'),json(result));}
 console.log(JSON.stringify({profile:CURRENT_VALUE_PROFILE,verified:true,nativeAcceptance:false,registryAcceptance:false}));
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main(process.argv.slice(2)).catch(error=>{console.error(error.stack);process.exitCode=1;});
