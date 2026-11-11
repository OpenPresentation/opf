// Closed current FULL59 lifecycle route. No Office or process enumeration here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {digest,fileIdentity,repositoryIdentity,installedIdentity} from './identity.mjs';
import {canonicalOwnedPath,readOwnedFile,readOwnedJson,assertOwnedKeys,ownedControllerFiles,makeOwnedAdmission,writeOwnedAdmission,assertOwnedKernel,sourceIdentityFiles} from './owned-postflight.mjs';
import {B07_COMPLETED_LIFECYCLE} from './b07-postflight.mjs';
import {readB07SuccessfulStages,readDenseFurnitureSuccessfulStages} from './b07-stages.mjs';
import {readB07PackedProof} from './b07-current-generate.mjs';
import {PRIMARY_CASE_NAMES} from './fixture-source.mjs';
import {assertReferenceWitnessPostflight} from './reference-chart-profile.mjs';
import {inspectDenseArchive,assertDenseLifecycle} from './dense-survey-contract.mjs';

const ROOT=fs.realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
export const FURNITURE_PROFILE='full59-ordinary-furniture-lifecycle-v1';
const lifecycleNames=[...B07_COMPLETED_LIFECYCLE];lifecycleNames.splice(1,0,'preflight.globalIdle','application.create');
export const FURNITURE_COMPLETED_LIFECYCLE=Object.freeze(lifecycleNames);
export const FURNITURE_POLICY=Object.freeze({policy:'ordinary-furniture-bounded-global-zero-after-completed-owned-quit-v1',observationPolicy:'global-zero-after-completed-owned-quit-v1',budgetMilliseconds:5000,intervalMilliseconds:100,maximumQueries:51,observerSource:'scripts/native-acceptance/run-reference-chart-profile.ps1',observerSourceSha256:'8902c341911dd9711872b4745d8ac3fe6524b9f5dcaa6d7ccd17b7f1f1116ee3'});
export const FULL59_SHA256='132ae22279365ff57d883bdc141fbc945f5fb1f737dd4250f8b834fd048f5e5b';
export const PRODUCER='9a20aed56f2d1a762c3a88ab24f8cc25d849d61f';
const chartNames=['treemap-category','histogram-single','histogram-category','pareto-multi','box-multi','waterfall-single','funnel-category','world-category','all-seven'];
export const FULL59_CASE_IDS=Object.freeze([...PRIMARY_CASE_NAMES,...chartNames.flatMap(name=>['fallback','auto','native'].map(mode=>`chart-mode-${name}-${mode}`)),...['auto','fallback','native'].map(mode=>`chart-mode-pareto-single-${mode}`),'table-colors']);
export const ORDINARY_CASE_IDS=Object.freeze(FULL59_CASE_IDS.filter(id=>!id.includes('all-seven')&&!['feature-dense-events','table-colors'].includes(id)));
const PROCESS_HELPER={bytes:2341,sha256:'b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c'};
const PROOF='0863398537df02b5127bd56ff6e5c6e7cf40963b07aec03e8f292d0680e2c1e0';
export const DENSE_FURNITURE_PROFILE='full59-dense-events-furniture-lifecycle-v1';
export const DENSE_FURNITURE_POLICY=Object.freeze({...FURNITURE_POLICY,policy:'dense-events-exact50-global-zero-after-completed-owned-quit-v1'});
const workerFiles=['native-furniture-control.ps1','native-process.ps1','native-process-check.ps1','native-furniture-harness-check.ps1'].map(n=>'packages/pptx/test/'+n);
const entries=['furniture-profile.mjs','furniture-postflight.ps1','furniture-profile.test.mjs','furniture-control-fixture.mjs','furniture-postflight-self-test.ps1','run-windows.ps1'].map(n=>'scripts/native-acceptance/'+n);
const files=dense=>ownedControllerFiles(ROOT,[...entries,...(dense?['scripts/native-acceptance/dense-furniture-profile.mjs','scripts/native-acceptance/run-dense-furniture-profile.ps1','scripts/native-acceptance/dense-furniture-profile.test.mjs']:[]),...workerFiles,'scripts/native-acceptance/owned-postflight.ps1',FURNITURE_POLICY.observerSource]);
const hex=v=>assert.match(v??'',/^[a-f0-9]{64}$/u);
const json=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
const wire=v=>JSON.stringify(v).split('').map(c=>c.charCodeAt(0)>126?'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'):c).join('');
const keys=assertOwnedKeys;
const at=(root,name)=>canonicalOwnedPath(path.join(root,name));
function sameRecord(root,record){assert.deepEqual(fileIdentity(at(root,record.path)),{bytes:record.bytes,sha256:record.sha256});}
function sameRepository(record){assert.equal(record.dirty,false);assert.deepEqual(repositoryIdentity(record.directory,record.files.map(f=>f.path)),record);}
function assertNode(record){assert.match(process.version,/^v24\./u);assert.equal(process.env.NODE_OPTIONS,undefined);assert.equal(process.env.NODE_PATH,undefined);assert.equal(process.execArgv.length,0);assert.deepEqual(record,{path:fs.realpathSync(process.execPath),version:process.version,identity:fileIdentity(process.execPath)});}
function outputPath(output,protectedRoots){canonicalOwnedPath(output);for(const root of protectedRoots){canonicalOwnedPath(root);for(const [a,b]of [[output,root],[root,output]])assert.ok(a!==b&&!a.startsWith(b+path.sep),'Output overlaps source/suite/consumer');}return output;}
function assertFurnitureSelection(suite,caseId,plan){
 assert.equal(suite.schemaVersion,1);assert.equal(suite.nativeAcceptance,false);assert.equal(suite.provenance.nativeAcceptance,false);assert.equal(suite.provenance.registryAcceptance,false);
 assert.deepEqual(suite.cases.map(c=>c.id),FULL59_CASE_IDS);
 const selected=suite.cases.find(c=>c.id===caseId);assert.ok(selected,'Exact closed case missing');assert.equal(selected.worker,'furniture');assert.equal(selected.automaticControlEligible,true);
 assert.ok(Number.isSafeInteger(selected.slideCount)&&selected.slideCount>=1&&selected.slideCount<=3);
 assert.ok(!caseId.includes('all-seven')&&!['feature-dense-events','table-colors'].includes(caseId),'Dedicated case refused');
 assert.ok(Array.isArray(plan)&&plan.length<=20);return selected;
}
// Two closed internal routes share the same lifecycle/kernel/identity implementation.
// No caller can provide caps, policy, case allowlists or an alternate observer.
function furnitureRoute(dense){
 const profile=dense?DENSE_FURNITURE_PROFILE:FURNITURE_PROFILE,policy=dense?DENSE_FURNITURE_POLICY:FURNITURE_POLICY;
 function selection(suite,caseId,plan){
  if(!dense)return assertFurnitureSelection(suite,caseId,plan);
  assert.equal(suite.schemaVersion,1);assert.equal(suite.nativeAcceptance,false);assert.equal(suite.provenance.nativeAcceptance,false);assert.equal(suite.provenance.registryAcceptance,false);assert.deepEqual(suite.cases.map(c=>c.id),FULL59_CASE_IDS);
  assert.equal(caseId,'feature-dense-events');const selected=suite.cases.find(c=>c.id===caseId);assert.ok(selected);assert.equal(selected.worker,'furniture');assert.equal(selected.automaticControlEligible,false);assert.equal(selected.slideCount,1);assert.deepEqual(plan,[]);return selected;
 }
function bindFurnitureEnvelope(file,sha){
 hex(sha);const bytes=readOwnedFile(file,4194304);assert.equal(digest(bytes),sha);return validateFurnitureEnvelope(JSON.parse(bytes),bytes,sha);
}
function validateFurnitureEnvelope(e,bytes=json(e),sha=digest(bytes)){
 keys(e,['schemaVersion','profile','policy','generation','controller','node','selectedCase','plan','captureTextFonts','nativeAcceptance','registryAcceptance']);
 assert.equal(e.schemaVersion,1);assert.equal(e.profile,profile);assert.deepEqual(e.policy,policy);assert.equal(e.nativeAcceptance,false);assert.equal(e.registryAcceptance,false);assert.equal(typeof e.captureTextFonts,'boolean');
 keys(e.generation,['suiteDirectory','manifestSha256','producerRepository','consumer','packedProof','provenance']);
 const g=e.generation;assert.equal(g.manifestSha256,FULL59_SHA256);assert.equal(g.provenance.suiteRepository.revision,PRODUCER);assert.equal(g.provenance.suiteRepository.directory,g.producerRepository);
 assert.equal(digest(readOwnedFile(at(g.suiteDirectory,'suite.json'))),FULL59_SHA256);const suite=readOwnedJson(at(g.suiteDirectory,'suite.json'));assert.deepEqual(suite.provenance,g.provenance);
 sameRepository(g.provenance.suiteRepository);sameRepository(g.provenance.workerRepository);
 assert.deepEqual(installedIdentity(g.consumer),g.provenance.packages);
 assert.equal(g.packedProof.sha256,PROOF);assert.deepEqual(readB07PackedProof({consumer:g.consumer,proof:g.packedProof.file,expectedProofSha256:PROOF,preparationRepository:g.producerRepository}),g.packedProof);
 assert.ok(suite.files.length>0&&suite.files.length<=1000);assert.equal(new Set(suite.files.map(r=>r.path.toLowerCase())).size,suite.files.length);for(const row of suite.files)sameRecord(g.suiteDirectory,row);
 const selected=selection(suite,e.selectedCase.id,e.plan);assert.deepEqual(selected,e.selectedCase);
 const input=readOwnedFile(at(g.suiteDirectory,selected.input),16777216),planBytes=readOwnedFile(at(g.suiteDirectory,selected.actionPlan),4194304);
 assert.equal(digest(input),selected.archiveSha256);assert.deepEqual(JSON.parse(planBytes),e.plan);const archive=dense?inspectDenseArchive(input):undefined;
 assert.deepEqual(fileIdentity(at(ROOT,workerFiles[1])),PROCESS_HELPER,'Unchanged maintained worker supervisor required');assert.deepEqual(e.controller,repositoryIdentity(ROOT,files(dense)));assert.equal(e.controller.dirty,false);assertNode(e.node);
 assert.equal(digest(readOwnedFile(at(ROOT,FURNITURE_POLICY.observerSource))),FURNITURE_POLICY.observerSourceSha256);
 if(dense)assert.equal(e.captureTextFonts,false);return {envelope:e,envelopeSha256:sha,envelopeBytes:bytes,suite,input,planBytes,...(dense?{archive}:{})};
}
function createFurnitureEnvelope(options){
 keys(options,['suiteDirectory','producerRepository','consumer','packedProof','caseId','captureTextFonts']);
 const suite=readOwnedJson(at(options.suiteDirectory,'suite.json'));
 const selected=suite.cases.find(c=>c.id===options.caseId);assert.ok(selected);
 const e={schemaVersion:1,profile,policy,generation:{suiteDirectory:options.suiteDirectory,manifestSha256:digest(readOwnedFile(at(options.suiteDirectory,'suite.json'))),producerRepository:options.producerRepository,consumer:options.consumer,packedProof:readB07PackedProof({consumer:options.consumer,proof:options.packedProof,expectedProofSha256:PROOF,preparationRepository:options.producerRepository}),provenance:suite.provenance},controller:repositoryIdentity(ROOT,files(dense)),node:{path:fs.realpathSync(process.execPath),version:process.version,identity:fileIdentity(process.execPath)},selectedCase:selected,plan:readOwnedJson(at(options.suiteDirectory,selected.actionPlan)),captureTextFonts:options.captureTextFonts,nativeAcceptance:false,registryAcceptance:false};
 validateFurnitureEnvelope(e);return e;
}
function expectedRequest(b,output,timeoutSeconds,runOfficeRequested){
 assert.ok(Number.isInteger(timeoutSeconds)&&timeoutSeconds>=5&&timeoutSeconds<=60);assert.equal(typeof runOfficeRequested,'boolean');
 return {schemaVersion:1,profile,policy,envelopeSha256:b.envelopeSha256,output,timeoutSeconds,runOfficeRequested,caseId:b.envelope.selectedCase.id,slideCount:b.envelope.selectedCase.slideCount,captureTextFonts:b.envelope.captureTextFonts,readOnlySurvey:dense,actionPlan:{bytes:b.planBytes.length,sha256:digest(b.planBytes),actions:b.envelope.plan},input:{bytes:b.input.length,sha256:digest(b.input)},worker:{path:at(ROOT,workerFiles[0]),...fileIdentity(at(ROOT,workerFiles[0]))},processHelper:{path:at(ROOT,workerFiles[1]),...fileIdentity(at(ROOT,workerFiles[1]))},node:b.envelope.node,controller:b.envelope.controller,nativeAcceptance:false,registryAcceptance:false};
}
function prepareFurnitureExecution(file,sha,output,{timeoutSeconds=45,runOfficeRequested=false}={}){
 const b=bindFurnitureEnvelope(file,sha);outputPath(output,[ROOT,b.envelope.generation.suiteDirectory,b.envelope.generation.producerRepository,b.envelope.generation.consumer,b.envelope.generation.provenance.workerRepository.directory,file]);assert.equal(fs.existsSync(output),false,'Fresh output required');
 const request=expectedRequest(b,output,timeoutSeconds,runOfficeRequested);fs.mkdirSync(output);fs.mkdirSync(at(output,'inputs'));fs.mkdirSync(at(output,'harness'));
 for(const [name,data]of [['inputs/case.pptx',b.input],['inputs/action-plan.json',b.planBytes],['inputs/execution-envelope.json',b.envelopeBytes],['execution-request.json',json(request)]])fs.writeFileSync(at(output,name),data,{flag:'wx'});
 verifyFurnitureExecution(file,sha,output,runOfficeRequested);return {profile,output,requestSha256:digest(json(request)),nativeAcceptance:false};
}
function verifyFurnitureExecution(file,sha,output,office){
 const b=bindFurnitureEnvelope(file,sha);outputPath(output,[ROOT,b.envelope.generation.suiteDirectory,b.envelope.generation.producerRepository,b.envelope.generation.consumer,b.envelope.generation.provenance.workerRepository.directory,file]);
 assert.deepEqual(readOwnedFile(at(output,'inputs/execution-envelope.json')),b.envelopeBytes);assert.deepEqual(readOwnedFile(at(output,'inputs/case.pptx')),b.input);assert.deepEqual(readOwnedFile(at(output,'inputs/action-plan.json')),b.planBytes);
 const q=readOwnedJson(at(output,'execution-request.json'));assert.deepEqual(q,expectedRequest(b,output,q.timeoutSeconds,office));
 return {...b,output,request:q,requestSha256:digest(readOwnedFile(at(output,'execution-request.json')))};
}
function assertFurnitureReady(terminal,report,request,stageBytes){
 assert.equal(terminal.timedOut,false);assert.equal(terminal.exitCode,0);assert.equal(terminal.cleanupConfirmed,true);assert.equal(terminal.lastDurableStage,'worker.complete');assert.equal(terminal.lastDurableStatus,'success');
 assert.equal(report.cleanupConfirmed,true);assert.equal(report.officeOperationsStopped,false);assert.equal(report.error,null);assert.equal(report.lastStage,'worker.complete');assert.equal(report.lastStatus,'success');
 assert.equal(report.schemaVersion,1);assert.equal(request.profile,profile);assert.deepEqual(request.policy,policy);assert.equal(request.nativeAcceptance,false);assert.equal(request.registryAcceptance,false);assert.ok(Number.isInteger(request.timeoutSeconds)&&request.timeoutSeconds>=5&&request.timeoutSeconds<=60);assert.ok(dense?request.caseId==='feature-dense-events':ORDINARY_CASE_IDS.includes(request.caseId),'Exact closed FULL59 case required');assert.equal(request.runOfficeRequested,true);assert.equal(request.readOnlySurvey,dense);assert.equal(report.readOnlySurvey,dense);if(dense){assert.equal(request.slideCount,1);assert.equal(request.captureTextFonts,false);assert.deepEqual(request.actionPlan.actions,[]);for(const key of ['completed','styleEdits','chartPoints','chartSeriesEdits'])assert.deepEqual(report.actionPlan[key],[]);}assert.equal(report.captureTextFonts,request.captureTextFonts);
 assert.deepEqual(report.globalPreflight,{policy:'strict-name-query-v1',count:0});assert.deepEqual(report.actionPlan.actions,request.actionPlan.actions);assert.deepEqual(report.actionPlan.completed,request.actionPlan.actions.map((a,i)=>({index:i+1,op:a.op,status:'success'})));
 for(const phase of ['original','edited','reopened']){const state=report.phases[phase];assert.ok(state&&Array.isArray(state.slides)&&state.slides.length>=1&&state.slides.length<=(dense?1:3));assert.equal(state.slides.length,request.slideCount);for(const slide of state.slides)assert.ok(Array.isArray(slide.shapes)&&(dense?slide.shapes.length===50:slide.shapes.length<=30));assert.equal(state.slideCount,state.slides.length);assert.equal(state.rasters.length,state.slides.length);assert.equal(new Set(state.rasters.map(r=>r.slideIndex)).size,state.slides.length);for(const [i,slide]of state.slides.entries()){assert.equal(slide.index,i+1);assert.equal(slide.shapeCount,slide.shapes.length);}}
 const original=report.source.openedPath,saved=report.saved.path;assert.equal(typeof original,'string');assert.equal(typeof saved,'string');canonicalOwnedPath(original);canonicalOwnedPath(saved);assert.equal(original,at(request.output,'native/inputs/input.pptx'));assert.equal(saved,at(request.output,'native/native-furniture-control.pptx'));
 const stages=(dense?readDenseFurnitureSuccessfulStages:readB07SuccessfulStages)(stageBytes);let timestamp=-Infinity;for(const row of stages){keys(row,['sequence','timestamp','stage','status','error','cleanupConfirmed','officeOperationsStopped','ownedPresentationPath']);assert.equal(typeof row.cleanupConfirmed,'boolean');assert.ok(row.ownedPresentationPath===null||(typeof row.ownedPresentationPath==='string'&&(row.ownedPresentationPath===original||row.ownedPresentationPath===saved)),'Every raw owned path must be null or an exact bound path string');assert.ok(typeof row.timestamp==='string'&&/Z$/u.test(row.timestamp));const now=Date.parse(row.timestamp);assert.ok(Number.isFinite(now)&&now>=timestamp);timestamp=now;assert.ok(typeof row.stage==='string'&&row.stage.length>0&&row.stage.length<=255);}
 let previous=0;const names=FURNITURE_COMPLETED_LIFECYCLE;
 const lifecycle=names.map(name=>{const matches=stages.filter(s=>s.stage===name&&s.status==='success');assert.equal(matches.length,1,'Missing/duplicate lifecycle '+name);const row=matches[0];const operations=stages.filter(s=>s.stage===name);if(name.startsWith('worker.')||name.endsWith('.cleanup')){assert.equal(operations.length,1);}else{assert.equal(operations.length,2);const begins=operations.filter(s=>s.status==='begin');assert.equal(begins.length,1);assert.ok(begins[0].sequence>previous&&begins[0].sequence<row.sequence,'Critical begin must follow the previous critical success');}
  assert.ok(row.sequence>previous);previous=row.sequence;
  if(['worker.initialize','preflight.globalIdle','application.create','application.ownership.presentations.count.get','application.cleanup.presentations.count.get'].includes(name)){assert.equal(row.ownedPresentationPath,null);assert.equal(row.cleanupConfirmed,true);}
  if(['input.presentation.open','input.presentation.fullName.get','input.presentation.readOnly.get','edited.presentation.saveCopyAs','edited.presentation.close'].includes(name)){assert.equal(row.ownedPresentationPath,original);assert.equal(row.cleanupConfirmed,false);}
  if(['reopen.presentation.open','reopen.presentation.fullName.get','reopen.presentation.readOnly.get','reopened.presentation.close'].includes(name)){assert.equal(row.ownedPresentationPath,saved);assert.equal(row.cleanupConfirmed,false);}
  if(name.endsWith('.cleanup')||['application.cleanup.quit','worker.complete'].includes(name)){assert.equal(row.cleanupConfirmed,true);assert.equal(row.ownedPresentationPath,null);}return {stage:name,sequence:row.sequence};});
 return {workerCleanupConfirmed:true,stageCount:stages.length,lifecycle,caseId:request.caseId,actionCount:request.actionPlan.actions.length};
}
function admitFurnitureExecution(b){
 const {output,request:q}=b,native=at(output,'native'),request=readOwnedJson(at(native,'request.json')),report=readOwnedJson(at(native,'report.json')),terminal=readOwnedJson(at(native,'supervisor.json'));
 assert.equal(request.captureTextFonts,q.captureTextFonts);assert.equal(request.readOnlySurvey,dense);assert.equal(request.textProbePlan,undefined);assert.equal(request.source.path,at(output,'inputs/case.pptx'));assert.equal(request.source.sha256,q.input.sha256);assert.equal(request.source.snapshotSha256,q.input.sha256);
 assert.equal(request.actionPlan.path,at(output,'inputs/action-plan.json'));assert.equal(request.actionPlan.snapshotSha256,q.actionPlan.sha256);assert.equal(request.actionPlan.sha256,q.actionPlan.sha256);assert.equal(request.actionPlan.count,q.actionPlan.actions.length);
 for(const [name,pinned]of [['verifier',q.worker],['processHelper',q.processHelper]]){assert.equal(request[name].path,pinned.path);assert.equal(request[name].sha256,pinned.sha256);assert.equal(request[name].snapshotSha256,pinned.sha256);assert.deepEqual(fileIdentity(request[name].snapshotPath),{bytes:pinned.bytes,sha256:pinned.sha256});}
 for(const [key,pin]of [['source',q.input],['actionPlan',q.actionPlan]])assert.deepEqual(fileIdentity(request[key].snapshotPath),{bytes:pin.bytes,sha256:pin.sha256});
 assert.equal(request.source.snapshotPath,at(native,'inputs/input.pptx'));assert.equal(request.actionPlan.snapshotPath,at(native,'inputs/action-plan.json'));assert.equal(request.verifier.snapshotPath,at(native,'inputs/native-furniture-control.ps1'));assert.equal(request.processHelper.snapshotPath,at(native,'inputs/native-process.ps1'));
 assert.deepEqual(report.source,{path:request.source.path,sha256:request.source.sha256,openedPath:request.source.snapshotPath,openedSha256:request.source.sha256});assert.deepEqual(report.inputs,{verifier:request.verifier,processHelper:request.processHelper});
 assert.equal(report.actionPlan.path,request.actionPlan.path);assert.equal(report.actionPlan.sha256,q.actionPlan.sha256);assert.equal(report.actionPlan.snapshotPath,request.actionPlan.snapshotPath);assert.equal(report.actionPlan.snapshotSha256,q.actionPlan.sha256);
 const saved=at(native,'native-furniture-control.pptx'),savedIdentity=fileIdentity(saved);assert.deepEqual(report.saved,{path:saved,sha256:savedIdentity.sha256});assert.deepEqual(report.reopened,report.saved);
 const ready=assertFurnitureReady(terminal,report,{...q,slideCount:b.envelope.selectedCase.slideCount},readOwnedFile(at(native,'stages.jsonl'),4194304));
 const kernel=readOwnedJson(at(native,'worker.json'));assertOwnedKernel(kernel,q.timeoutSeconds);
 if(dense){assertDenseLifecycle({report,request,terminal,shapeNames:b.archive.shapeNames,shapeWords:b.archive.shapeWords,inputSha256:q.input.sha256,planSha256:q.actionPlan.sha256});const savedArchive=inspectDenseArchive(readOwnedFile(saved,16777216));for(const key of ['slideCount','shapeCount','shapeNames','shapeWords'])assert.deepEqual(savedArchive[key],b.archive[key],'Saved dense content changed: '+key);}
 const g=b.envelope.generation;
 const bound=[...sourceIdentityFiles(g.provenance),b.envelope.node.path,g.packedProof.file,g.packedProof.packedManifest.file,at(g.consumer,'package-lock.json'),at(g.suiteDirectory,'suite.json'),...g.packedProof.packages.map(p=>at(path.dirname(g.consumer),p.file)),...b.suite.files.map(p=>at(g.suiteDirectory,p.path)),fileURLToPath(import.meta.url),at(output,'execution-request.json'),at(output,'inputs/execution-envelope.json'),at(output,'inputs/case.pptx'),at(output,'inputs/action-plan.json'),...b.envelope.controller.files.map(r=>at(ROOT,r.path)),...['request.json','report.json','supervisor.json','worker.json','stages.jsonl','inputs/input.pptx','inputs/action-plan.json','inputs/native-furniture-control.ps1','inputs/native-process.ps1','native-furniture-control.pptx'].map(n=>at(native,n))];
 for(const phase of ['original','edited','reopened'])for(const raster of report.phases[phase].rasters){const expected=at(native,`${phase}-slide-${String(raster.slideIndex).padStart(2,'0')}.png`);assert.equal(raster.path,expected);assert.ok(Number.isInteger(raster.slideIndex)&&raster.slideIndex>=1&&raster.slideIndex<=b.envelope.selectedCase.slideCount);assert.equal(fileIdentity(expected).sha256,raster.sha256);const png=readOwnedFile(expected);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),1280);assert.equal(png.readUInt32BE(20),720);bound.push(expected);}
 const admission=makeOwnedAdmission({profile,policy,requestSha256:b.requestSha256,files:bound,ready});return admission;
}
async function main(argv){
 const [command,...args]=argv,o={};assert.equal(args.length%2,0);for(let i=0;i<args.length;i+=2){assert.ok(args[i].startsWith('--')&&!Object.hasOwn(o,args[i]));o[args[i]]=args[i+1];}
 if(command==='create'){keys(o,['--options','--output']);const e=createFurnitureEnvelope(readOwnedJson(o['--options']));outputPath(o['--output'],[ROOT,e.generation.suiteDirectory,e.generation.producerRepository,e.generation.consumer,e.generation.provenance.workerRepository.directory]);fs.writeFileSync(canonicalOwnedPath(o['--output']),json(e),{flag:'wx'});console.log(wire(fileIdentity(o['--output'])));return;}
 if(command==='prepare'){keys(o,['--envelope','--sha256','--output','--require-office']);assert.ok(['true','false'].includes(o['--require-office']));console.log(wire(prepareFurnitureExecution(o['--envelope'],o['--sha256'],o['--output'],{runOfficeRequested:o['--require-office']==='true'})));return;}
 keys(o,['--envelope','--sha256','--output','--require-office']);assert.ok(['true','false'].includes(o['--require-office']));const b=verifyFurnitureExecution(o['--envelope'],o['--sha256'],o['--output'],o['--require-office']==='true');
 if(command==='verify-execution'){console.log(wire({verified:true,requestSha256:b.requestSha256}));return;}
 assert.ok(['verify-postflight','observe'].includes(command));const a=admitFurnitureExecution(b);
 if(command==='verify-postflight'){console.log(wire(writeOwnedAdmission(at(b.output,'postflight-admission.json'),a)));return;}
 assert.deepEqual(readOwnedJson(at(b.output,'postflight-admission.json')),a);
 const postflight=readOwnedJson(at(b.output,'postflight-result.json')),bytes=readOwnedFile(at(b.output,'postflight.jsonl'),65536);assert.deepEqual(postflight.policy,policy);
 assert.equal(postflight.error,null);assert.equal(postflight.identity.bytes,bytes.length);assert.equal(postflight.identity.sha256,digest(bytes));
 assertReferenceWitnessPostflight({workerCleanupConfirmed:true,postflightError:postflight.error,postflight:postflight.result,powerPointPostflightInitialCount:postflight.initialCount,powerPointPostflightCount:postflight.finalCount},bytes.toString('utf8').trim().split(/\r?\n/u).map(s=>JSON.parse(s)));
 console.log(wire({profile,status:'lifecycle-observed; semantic-and-visual-review-required',nativeAcceptance:false,registryAcceptance:false}));
}
 return Object.freeze({bindFurnitureEnvelope,createFurnitureEnvelope,prepareFurnitureExecution,verifyFurnitureExecution,assertFurnitureReady,admitFurnitureExecution,assertFurnitureSelection:selection,main});
}
const ordinary=furnitureRoute(false);
export const {bindFurnitureEnvelope,createFurnitureEnvelope,prepareFurnitureExecution,verifyFurnitureExecution,assertFurnitureReady,admitFurnitureExecution}=ordinary;
export {assertFurnitureSelection};
export const denseFurnitureRoute=furnitureRoute(true);
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)ordinary.main(process.argv.slice(2)).catch(error=>{console.error(error);process.exitCode=1;});
