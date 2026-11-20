// Closed org-only, zero-action capability capture. Never changes SH21 edit admission.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createSh21Envelope,verifySh21Source} from './sh21-edit-profile.mjs';
import {readSh21HistoricalInput,assertSh21Observation} from './sh21-edit-contract.mjs';
import {digest,fileIdentity,repositoryIdentity} from './identity.mjs';
import {OWNED_POSTFLIGHT_POLICY,ownedControllerFiles,canonicalOwnedPath,readOwnedFile,readOwnedJson,assertOwnedKeys,assertOwnedStageWire,assertOwnedOperations,assertOwnedKernel,makeOwnedAdmission,writeOwnedAdmission,sourceIdentityFiles,assertOwnedPostflightArtifacts} from './owned-postflight.mjs';
const ROOT=fs.realpathSync(fileURLToPath(new URL('../../',import.meta.url))),prefix='scripts/native-acceptance/';
export const CAPABILITY_PROFILE='sh21-org-windowless-node-shapes-capability-v1';
export const CAPABILITY_POLICY=Object.freeze({policy:'sh21-org-zero-action-node-shapes-capability-v1',...OWNED_POSTFLIGHT_POLICY});
const CAPABILITY_SUPERVISOR=Object.freeze({bytes:2341,sha256:'b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c'});
export function assertCapabilityInfrastructure(supervisor,observer){assert.deepEqual(supervisor,CAPABILITY_SUPERVISOR,'Fixed maintained supervisor bytes required');assert.equal(observer.sha256,CAPABILITY_POLICY.observerSourceSha256,'Fixed maintained observer bytes required');}
export const CAPABILITY_ENTRIES=['sh21-node-shapes-profile.mjs','sh21-node-shapes-bootstrap.ps1','sh21-node-shapes-actions.ps1','sh21-node-shapes-worker.ps1','run-sh21-node-shapes.ps1','sh21-node-shapes.test.mjs','sh21-node-shapes-check.ps1'].map(n=>prefix+n);
const json=v=>Buffer.from(JSON.stringify(v,null,2)+'\n'),at=(root,name)=>canonicalOwnedPath(path.join(root,name)),write=(file,data)=>fs.writeFileSync(canonicalOwnedPath(file),data,{flag:'wx'});
const historical=()=>readSh21HistoricalInput(ROOT,'org-chart-3');
const files=source=>ownedControllerFiles(ROOT,[...source.controller.files.map(r=>r.path),...CAPABILITY_ENTRIES]);
export function createCapabilityEnvelope(consumer){
 const source=createSh21Envelope({caseId:'org-chart-3',consumer});
 return{schemaVersion:1,profile:CAPABILITY_PROFILE,policy:CAPABILITY_POLICY,source,controller:repositoryIdentity(ROOT,files(source)),timeoutSeconds:45,maximumTotalShapes:32,actions:[],geometryAcceptance:false,nativeAcceptance:false,registryAcceptance:false};
}
export function bindCapabilityEnvelope(file,sha){
 assert.match(sha,/^[a-f0-9]{64}$/u);const bytes=readOwnedFile(file,4194304);assert.equal(digest(bytes),sha);const e=JSON.parse(bytes);
 assertOwnedKeys(e,['schemaVersion','profile','policy','source','controller','timeoutSeconds','maximumTotalShapes','actions','geometryAcceptance','nativeAcceptance','registryAcceptance']);
 assertCapabilityInfrastructure(fileIdentity(at(ROOT,'packages/pptx/test/native-process.ps1')),fileIdentity(at(ROOT,CAPABILITY_POLICY.observerSource)));
 assert.equal(e.schemaVersion,1);assert.equal(e.profile,CAPABILITY_PROFILE);assert.deepEqual(e.policy,CAPABILITY_POLICY);assert.equal(e.timeoutSeconds,45);assert.equal(e.maximumTotalShapes,32);assert.deepEqual(e.actions,[]);
 for(const name of ['geometryAcceptance','nativeAcceptance','registryAcceptance'])assert.equal(e[name],false);
 assert.equal(e.source.plan.caseId,'org-chart-3');assert.deepEqual(e.source,createSh21Envelope({caseId:'org-chart-3',consumer:e.source.installed.consumer}));assert.deepEqual(e.controller,repositoryIdentity(ROOT,files(e.source)));assert.equal(e.controller.dirty,false);
 return{envelope:e,envelopeBytes:bytes,envelopeSha256:sha,...historical()};
}
function outputPath(output,e){canonicalOwnedPath(output);for(const root of [ROOT,e.source.installed.consumer,...e.source.installed.packages.map(p=>p.directory)])assert.ok(output!==root&&!output.startsWith(root+path.sep)&&!root.startsWith(output+path.sep),'Output overlaps bound source/runtime');return output;}
function expectedRequest(b,output,office){
 assert.equal(typeof office,'boolean');const snapshots=[{path:'execution-envelope.json',bytes:b.envelopeBytes.length,sha256:b.envelopeSha256},{path:'inputs/case.pptx',bytes:b.bytes.length,sha256:digest(b.bytes)},{path:'inputs/plan.json',bytes:json(b.plan).length,sha256:digest(json(b.plan))},...['sh21-node-shapes-worker.ps1'].map(n=>({path:'inputs/'+n,...fileIdentity(at(ROOT,prefix+n))})),{path:'inputs/native-process.ps1',...CAPABILITY_SUPERVISOR}];
 return{schemaVersion:1,profile:CAPABILITY_PROFILE,policy:CAPABILITY_POLICY,envelopeSha256:b.envelopeSha256,output,timeoutSeconds:45,maximumTotalShapes:32,runOfficeRequested:office,plan:b.plan,node:b.envelope.source.node,controller:b.envelope.controller,snapshots,workerPath:at(output,'inputs/sh21-node-shapes-worker.ps1'),nativeRoot:at(output,'native'),actions:[],geometryAcceptance:false,nativeAcceptance:false,registryAcceptance:false};
}
export function prepareCapability(file,sha,output,office=false){
 const b=bindCapabilityEnvelope(file,sha);outputPath(output,b.envelope);assert.ok(output!==file&&!file.startsWith(output+path.sep)&&!output.startsWith(file+path.sep),'Output overlaps source envelope');assert.equal(fs.existsSync(output),false);const q=expectedRequest(b,output,office);fs.mkdirSync(output);fs.mkdirSync(at(output,'inputs'));
 for(const [name,bytes]of [['execution-envelope.json',b.envelopeBytes],['inputs/case.pptx',b.bytes],['inputs/plan.json',json(b.plan)],['inputs/sh21-node-shapes-worker.ps1',readOwnedFile(at(ROOT,prefix+'sh21-node-shapes-worker.ps1'))],['inputs/native-process.ps1',readOwnedFile(at(ROOT,'packages/pptx/test/native-process.ps1'))],['execution-request.json',json(q)]])write(at(output,name),bytes);
 verifyCapability(file,sha,output,office);return{profile:CAPABILITY_PROFILE,output,requestSha256:digest(json(q)),geometryAcceptance:false,nativeAcceptance:false};
}
export function verifyCapability(file,sha,output,office){
 const b=bindCapabilityEnvelope(file,sha);outputPath(output,b.envelope);const q=readOwnedJson(at(output,'execution-request.json'));assert.deepEqual(q,expectedRequest(b,output,office));
 for(const r of q.snapshots)assert.deepEqual(fileIdentity(at(output,r.path)),{bytes:r.bytes,sha256:r.sha256});assert.deepEqual(readOwnedFile(at(output,'inputs/case.pptx')),b.bytes);assert.deepEqual(readOwnedFile(at(output,'inputs/plan.json')),json(b.plan));return{...b,output,request:q,requestSha256:fileIdentity(at(output,'execution-request.json')).sha256};
}
const owner=p=>[p+'.fullName',p+'.readOnly'];
const nodeOps=(p,row)=>['get','frame','range','text','level','type','children','children.count',...(row.level>1?['parent','parent.frame','parent.range','parent.text']:[])].map(s=>p+'.'+s);
export function capabilityOperations(record){
 const target='original.target',p='capability',names=['worker.initialize','preflight.globalIdle','application.create','application.initial.presentations','application.initial.count','application.version','application.path','original.preflight.presentations','original.preflight.count','original.open','original.fullName','original.readOnly',...owner(target+'.owner'),...[ 'slides','slides.count','slide.get','shapes','shapes.count'].map(s=>target+'.'+s),...[1,2].flatMap(i=>['get','id','name'].map(s=>target+'.shape.'+i+'.'+s)),...['hasSmartArt','smartArt','layout','layout.id'].map(s=>target+'.'+s),...owner(target+'.finalOwner'),...owner(p+'.capture.owner'),p+'.export',...owner(p+'.owner'),p+'.nodes',p+'.nodes.count',...record.nodes.flatMap(row=>nodeOps(p+'.node.'+row.index,row)),...owner(p+'.finalOwner'),...['Left','Top','Width','Height'].map(s=>p+'.frame.'+s)];
 for(const r of record.ranges){const n=p+'.range.'+r.nativeNodeIndex;names.push(...owner(n+'.owner'),...nodeOps(n+'.node',r.node),n+'.shapes',...owner(n+'.shapesOwner'));if(r.status!=='unavailable')names.push(n+'.count',...owner(n+'.countOwner'));for(const item of r.items){const ip=n+'.item.'+item.index;names.push(ip+'.get',...owner(ip+'.owner'),...['Id','Name','Left','Top','Width','Height','Rotation','Type','HasTextFrame','Connector'].map(s=>ip+'.'+s));if(item.HasTextFrame===-1)names.push(...['frame','range','text','font','font.Name','font.Size','font.Bold','font.Italic'].map(s=>ip+'.'+s));names.push(...owner(ip+'.finalOwner'));}if(r.status==='captured')names.push(...owner(n+'.finalOwner'));}
 return[...names,...owner(p+'.capture.finalOwner'),'original.close.fullName','original.close.discard','original.close','application.final.presentations','application.final.count','application.quit','worker.complete'];
}
export function assessNodeShapes(record,plan){
 assert.equal(plan.caseId,'org-chart-3');
 assertOwnedKeys(record,['nodes','semanticToNativeIndex','frame','ranges','findings','raster','geometryAcceptance','connectorCoverage']);assertSh21Observation({nodes:record.nodes,semanticToNativeIndex:record.semanticToNativeIndex},plan,'before');assert.equal(record.geometryAcceptance,false);assert.equal(record.connectorCoverage,'unproven');assertOwnedKeys(record.frame,['Left','Top','Width','Height']);assert.ok(Array.isArray(record.ranges)&&record.ranges.length>=1&&record.ranges.length<=3);
 const expectedFindings=[],analysis=[],ids=new Set();let total=0,bounded=false;
 const finding=(code,nativeNodeIndex=0,shapeIndex=0)=>expectedFindings.push({code,nativeNodeIndex,shapeIndex});
 for(const [i,r]of record.ranges.entries()){
  assertOwnedKeys(r,['nativeNodeIndex','node','status','count','items']);assert.equal(r.nativeNodeIndex,i+1);assert.deepEqual(r.node,record.nodes[i]);assert.ok(Array.isArray(r.items));assert.equal(bounded,false,'Nothing may follow a bounded stop');
  if(r.status==='unavailable'){assert.equal(r.count,null);assert.deepEqual(r.items,[]);finding('node-shapes-unavailable',i+1);continue;}
  if(r.status==='bounded-stop'){assert.ok(!Number.isSafeInteger(r.count)||r.count<0||r.count>32-total);assert.deepEqual(r.items,[]);finding('node-shapes-count-outside-total-bound',i+1);bounded=true;continue;}
  assert.ok(Number.isSafeInteger(r.count)&&r.count>=0&&r.count<=32-total);assert.equal(r.items.length,r.count);assert.equal(r.status,r.count?'captured':'empty');if(!r.count)finding('node-shapes-empty',i+1);
  for(const [j,item]of r.items.entries()){
   assertOwnedKeys(item,['index','Id','Name','Left','Top','Width','Height','Rotation','Type','HasTextFrame','Connector','text','font']);assert.equal(item.index,j+1);total++;
   if(!Number.isSafeInteger(item.Id)||item.Id<=0||typeof item.Name!=='string'||ids.has(item.Id))analysis.push({code:'nonunique-or-invalid-shape-identity',nativeNodeIndex:i+1,shapeIndex:j+1});ids.add(item.Id);
   if(!['Left','Top','Width','Height','Rotation'].every(k=>Number.isFinite(item[k]))||item.Width<0||item.Height<0||(item.Connector!==-1&&(item.Width===0||item.Height===0)))analysis.push({code:'unusable-shape-geometry',nativeNodeIndex:i+1,shapeIndex:j+1});
   if(![-1,0].includes(item.HasTextFrame)||![-1,0].includes(item.Connector)||!Number.isSafeInteger(item.Type))analysis.push({code:'unsupported-shape-descriptor',nativeNodeIndex:i+1,shapeIndex:j+1});
   if(item.HasTextFrame===-1){assertOwnedKeys(item.font,['Name','Size','Bold','Italic']);if(typeof item.text!=='string'||typeof item.font.Name!=='string'||!Number.isFinite(item.font.Size)||![-1,0].includes(item.font.Bold)||![-1,0].includes(item.font.Italic))analysis.push({code:'unusable-text-or-style',nativeNodeIndex:i+1,shapeIndex:j+1});}else{assert.equal(item.text,null);assert.equal(item.font,null);}
  }
  if(r.items.filter(item=>item.HasTextFrame===-1&&item.text===r.node.text).length!==1)analysis.push({code:'nonunique-node-text-shape',nativeNodeIndex:i+1,shapeIndex:0});
 }
 assert.ok(bounded||record.ranges.length===3);finding('connector-coverage-unproven');assert.deepEqual(record.findings,expectedFindings);if(!Object.values(record.frame).every(Number.isFinite)||record.frame.Width<=0||record.frame.Height<=0)analysis.push({code:'unusable-frame',nativeNodeIndex:0,shapeIndex:0});
 return{totalCapturedShapes:total,findings:[...expectedFindings,...analysis],sourceFontSizeExpectation:{value:plan.sourceFontSize,scope:'Existing source-plan value; native point/OPF unit equivalence remains unqualified'},geometryAcceptance:false,connectorCoverage:'unproven'};
}
export function assertCapabilityReady(terminal,r,q,stages){
 assertOwnedKernel(terminal,45);assert.equal(q.profile,CAPABILITY_PROFILE);assert.equal(q.plan.caseId,'org-chart-3');assert.deepEqual(q.policy,CAPABILITY_POLICY);assert.equal(q.timeoutSeconds,45);assert.equal(q.maximumTotalShapes,32);assert.equal(q.runOfficeRequested,true);assert.deepEqual(q.actions,[]);for(const name of ['geometryAcceptance','nativeAcceptance','registryAcceptance'])assert.equal(q[name],false);
 for(const [name,value]of Object.entries({schemaVersion:1,profile:CAPABILITY_PROFILE,requestSha256:digest(json(q)),envelopeSha256:q.envelopeSha256,sourcePath:at(q.output,'inputs/case.pptx'),sourceSha256:q.plan.inputSha256,cleanupConfirmed:true,officeOperationsStopped:false,error:null,lastStage:'worker.complete',lastStatus:'success',closes:1,saveCopies:0,quits:1}))assert.deepEqual(r[name],value,name);
 assert.deepEqual(r.actions,[]);assert.deepEqual(r.opens,[{phase:'original',path:r.sourcePath,readOnly:-1,sha256:r.sourceSha256}]);assert.deepEqual(Object.keys(r.phases),['capability']);const record=r.phases.capability,assessment=assessNodeShapes(record,q.plan);assertOwnedOperations(stages,capabilityOperations(record));const success=new Map(stages.filter(s=>s.status==='success').map(s=>[s.stage,s]));
 for(const s of stages)assert.ok(!Object.hasOwn(s,'ownedPresentationPath')||s.ownedPresentationPath===null||s.ownedPresentationPath===r.sourcePath);for(const name of ['preflight.globalIdle','application.initial.count','application.final.count'])assert.equal(success.get(name).value,0);assert.equal(success.get('worker.complete').cleanupConfirmed,true);
 const equal=(stage,value)=>assert.deepEqual(success.get(stage)?.value,value,'Current stage value differs: '+stage),node=(p,row)=>{for(const k of ['text','level','type'])equal(p+'.'+k,row[k]);equal(p+'.children.count',row.children);if(row.level>1)equal(p+'.parent.text',row.parent);};
 equal('original.preflight.count',0);equal('original.fullName',r.sourcePath);equal('original.readOnly',-1);equal('original.target.layout.id',q.plan.layoutId);equal('capability.nodes.count',3);for(const row of record.nodes)node('capability.node.'+row.index,row);for(const k of ['Left','Top','Width','Height'])equal('capability.frame.'+k,record.frame[k]);
 const ownership=['original.target.owner','original.target.finalOwner','capability.capture.owner','capability.owner','capability.finalOwner','capability.capture.finalOwner'];
 for(const range of record.ranges){const p='capability.range.'+range.nativeNodeIndex;ownership.push(p+'.owner',p+'.shapesOwner');if(range.status!=='unavailable')ownership.push(p+'.countOwner');node(p+'.node',range.node);if(range.status!=='unavailable')equal(p+'.count',range.count);for(const item of range.items){const ip=p+'.item.'+item.index;ownership.push(ip+'.owner',ip+'.finalOwner');for(const k of ['Id','Name','Left','Top','Width','Height','Rotation','Type','HasTextFrame','Connector'])equal(ip+'.'+k,item[k]);if(item.HasTextFrame===-1){equal(ip+'.text',item.text);for(const k of ['Name','Size','Bold','Italic'])equal(ip+'.font.'+k,item.font[k]);}}if(range.status==='captured')ownership.push(p+'.finalOwner');for(const k of ['index','text','level','parent','type','children'])assert.deepEqual(r.probes.filter(v=>v.stage===p+'.reread.'+k),[{stage:p+'.reread.'+k,expected:range.node[k],actual:range.node[k],matched:true}]);}
 assert.ok(Array.isArray(r.probes)&&r.probes.length>0);for(const p of r.probes){assertOwnedKeys(p,['stage','expected','actual','matched']);assert.equal(p.matched,true);}assert.deepEqual(r.probes.filter(p=>p.stage==='source.unchanged'),[{stage:'source.unchanged',expected:q.plan.inputSha256,actual:q.plan.inputSha256,matched:true}]);
 for(const p of ownership){equal(p+'.fullName',r.sourcePath);equal(p+'.readOnly',-1);for(const [suffix,expected,actual]of [['ownership','same verified owned application/presentation references',true],['capturedRefs',true,true],['fullName.refs',true,true],['fullName',r.sourcePath,r.sourcePath],['readOnly.refs',true,true],['readOnly',-1,-1]])assert.deepEqual(r.probes.filter(v=>v.stage===p+'.'+suffix),[{stage:p+'.'+suffix,expected,actual,matched:true}]);}
 for(const i of record.semanticToNativeIndex.keys()){for(const suffix of ['unique','unused']){const v=suffix==='unique'?1:true;assert.deepEqual(r.probes.filter(p=>p.stage==='capability.semantic.'+(i+1)+'.'+suffix),[{stage:'capability.semantic.'+(i+1)+'.'+suffix,expected:v,actual:v,matched:true}]);}}assert.deepEqual(r.probes.filter(p=>p.stage==='capability.semantic.complete'),[{stage:'capability.semantic.complete',expected:3,actual:3,matched:true}]);
 return{captureCompleted:true,stageCount:stages.length,opens:1,saves:0,closes:1,quits:1,actions:0,workerCleanupConfirmed:true,...assessment};
}
async function completion(b){
 const file=n=>at(b.output,n),report=readOwnedJson(file('native/report.json')),terminal=readOwnedJson(file('native/worker.json')),stages=assertOwnedStageWire(readOwnedFile(file('native/stages.jsonl'),4194304)),ready=assertCapabilityReady(terminal,report,b.request,stages),png=file('native/capability.png'),bytes=readOwnedFile(png,16777216);
 assert.deepEqual(report.phases.capability.raster,{path:png,sha256:digest(bytes)});assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));assert.equal(bytes.readUInt32BE(16),1280);assert.equal(bytes.readUInt32BE(20),720);
 const identities=['execution-envelope.json','execution-request.json','native/report.json','native/worker.json','native/stages.jsonl','native/capability.png',...b.request.snapshots.map(s=>s.path)].map(file);identities.push(b.envelope.source.node.path,...sourceIdentityFiles(b.envelope.controller,b.envelope.source.installed,b.envelope.source.libraries));verifyCapability(file('execution-envelope.json'),b.envelopeSha256,b.output,true);
 return makeOwnedAdmission({profile:CAPABILITY_PROFILE,policy:CAPABILITY_POLICY,requestSha256:b.requestSha256,files:identities,ready});
}
async function main(argv){
 const [command,...rest]=argv,o={};assert.equal(rest.length%2,0);for(let i=0;i<rest.length;i+=2){assert.ok(['--consumer','--envelope','--sha256','--output','--require-office'].includes(rest[i]));assert.ok(!Object.hasOwn(o,rest[i]));assert.ok(rest[i+1]&&!rest[i+1].startsWith('--'));o[rest[i]]=rest[i+1];}
 if(command==='create-envelope'){const e=createCapabilityEnvelope(o['--consumer']);write(o['--output'],json(e));console.log(JSON.stringify({path:o['--output'],...fileIdentity(o['--output'])}));return;}
 assert.ok(['true','false'].includes(o['--require-office']??'false'));const office=o['--require-office']==='true',file=o['--envelope'],sha=o['--sha256'],output=o['--output'];
 if(command==='verify-source'){const b=bindCapabilityEnvelope(file,sha);console.log(JSON.stringify(await verifySh21Source({...b,envelope:b.envelope.source})));return;}
 if(command==='prepare'){console.log(JSON.stringify(prepareCapability(file,sha,output,office)));return;}
 const b=verifyCapability(file,sha,output,office);
 if(command==='verify-execution'){await verifySh21Source({...b,envelope:b.envelope.source});console.log(JSON.stringify({controller:ROOT,inputPath:at(output,'inputs/case.pptx'),requestSha256:b.requestSha256,plan:b.plan}));return;}
 assert.ok(office&&['verify-complete','verify-admission','observe'].includes(command));const admission=await completion(b),admissionFile=at(output,'postflight-admission.json');
 if(command==='verify-complete'){console.log(JSON.stringify(writeOwnedAdmission(admissionFile,admission)));return;}
 assert.deepEqual(readOwnedJson(admissionFile),admission);
 if(command==='observe'){const s=readOwnedJson(at(output,'native/supervisor.json'));assert.equal(s.cleanupConfirmed,true);assertOwnedPostflightArtifacts(s.postflight,readOwnedFile(at(output,'postflight.jsonl'),65536),CAPABILITY_POLICY,admission);write(at(output,'capability-observations.json'),json({admission,scope:'One org-only windowless readonly capability; no edit/native geometry/connector completeness acceptance'}));}
 console.log(JSON.stringify({profile:CAPABILITY_PROFILE,requestSha256:b.requestSha256,ready:admission.ready}));
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main(process.argv.slice(2)).catch(e=>{console.error(e.stack);process.exitCode=1;});
