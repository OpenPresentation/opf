// Separate closed visible/minimized qualification. Preparation is not owner authorization.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createSh21Envelope,verifySh21Source,SH21_WINDOWED_PROFILE,SH21_WINDOWED_POLICY,assertSh21WindowedReady,compareSh21Persisted,compareSh21OriginalMaterialized} from './sh21-edit-profile.mjs';
import {readSh21HistoricalInput} from './sh21-edit-contract.mjs';
import {digest,fileIdentity,repositoryIdentity} from './identity.mjs';
import {ownedControllerFiles,canonicalOwnedPath,readOwnedFile,readOwnedJson,assertOwnedKeys,assertOwnedStageWire,makeOwnedAdmission,writeOwnedAdmission,sourceIdentityFiles,assertOwnedPostflightArtifacts,assertOwnedAdmissionFiles} from './owned-postflight.mjs';
import {assertReferenceWitnessPostflight} from './reference-chart-profile.mjs';
const ROOT=fs.realpathSync(fileURLToPath(new URL('../../',import.meta.url))),prefix='scripts/native-acceptance/';
export const WINDOWED_PROFILE=SH21_WINDOWED_PROFILE;
export const WINDOWED_POLICY=SH21_WINDOWED_POLICY;
export const WINDOW_MODE=Object.freeze({visible:-1,windowState:2,withWindow:-1,readOnly:-1});
export function assertWindowedSelection(mode,caseId,witness){assert.ok(['org-witness','edit'].includes(mode));if(mode==='org-witness'){assert.equal(caseId,'org-chart-3');assert.equal(witness,null);}else{assert.ok(['org-chart-3','hierarchy-3','venn-3'].includes(caseId));assert.ok(witness&&typeof witness.output==='string'&&Array.isArray(witness.files));}}
const WINDOWED_SUPERVISOR=Object.freeze({bytes:2341,sha256:'b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c'});
export function assertWindowedInfrastructure(supervisor,observer){assert.deepEqual(supervisor,WINDOWED_SUPERVISOR,'Fixed maintained supervisor bytes required');assert.equal(observer.sha256,WINDOWED_POLICY.observerSourceSha256,'Fixed maintained observer bytes required');}
export const WINDOWED_ENTRIES=['sh21-windowed-profile.mjs','sh21-windowed-bootstrap.ps1','sh21-windowed-actions.ps1','sh21-windowed-worker.ps1','run-sh21-windowed-profile.ps1','sh21-windowed.test.mjs','sh21-windowed-check.ps1'].map(n=>prefix+n);
const json=v=>Buffer.from(JSON.stringify(v,null,2)+'\n'),at=(root,name)=>canonicalOwnedPath(path.join(root,name)),write=(file,data)=>fs.writeFileSync(canonicalOwnedPath(file),data,{flag:'wx'});
const historical=caseId=>readSh21HistoricalInput(ROOT,caseId);
const files=source=>ownedControllerFiles(ROOT,[...source.controller.files.map(r=>r.path),...WINDOWED_ENTRIES]);
export async function createWindowedEnvelope({mode,caseId,consumer,witnessOutput=null}){
 const source=createSh21Envelope({caseId,consumer}),witness=witnessOutput===null?null:await readWindowedWitness(witnessOutput,source);assertWindowedSelection(mode,caseId,witness);
 return{schemaVersion:1,profile:WINDOWED_PROFILE,policy:WINDOWED_POLICY,mode,windowMode:WINDOW_MODE,source,controller:repositoryIdentity(ROOT,files(source)),timeoutSeconds:45,maximumTotalShapes:32,witness,nativeAcceptance:false,registryAcceptance:false};
}
export function bindWindowedEnvelope(file,sha){
 assert.match(sha,/^[a-f0-9]{64}$/u);const bytes=readOwnedFile(file,4194304);assert.equal(digest(bytes),sha);const e=JSON.parse(bytes);
 assertOwnedKeys(e,['schemaVersion','profile','policy','mode','windowMode','source','controller','timeoutSeconds','maximumTotalShapes','witness','nativeAcceptance','registryAcceptance']);
 assertWindowedInfrastructure(fileIdentity(at(ROOT,'packages/pptx/test/native-process.ps1')),fileIdentity(at(ROOT,WINDOWED_POLICY.observerSource)));
 assert.equal(e.schemaVersion,1);assert.equal(e.profile,WINDOWED_PROFILE);assert.deepEqual(e.policy,WINDOWED_POLICY);assert.deepEqual(e.windowMode,WINDOW_MODE);assert.equal(e.timeoutSeconds,45);assert.equal(e.maximumTotalShapes,32);assert.equal(e.nativeAcceptance,false);assert.equal(e.registryAcceptance,false);assertWindowedSelection(e.mode,e.source.plan.caseId,e.witness);
 assert.deepEqual(e.source,createSh21Envelope({caseId:e.source.plan.caseId,consumer:e.source.installed.consumer}));assert.deepEqual(e.controller,repositoryIdentity(ROOT,files(e.source)));assert.equal(e.controller.dirty,false);
 return{envelope:e,envelopeBytes:bytes,envelopeSha256:sha,...historical(e.source.plan.caseId)};
}
function outputPath(output,e){canonicalOwnedPath(output);for(const root of [ROOT,e.source.installed.consumer,...e.source.installed.packages.map(p=>p.directory),...(e.witness?[e.witness.output]:[])])assert.ok(output!==root&&!output.startsWith(root+path.sep)&&!root.startsWith(output+path.sep),'Output overlaps bound source/runtime');return output;}
function expectedRequest(b,output,office){
 assert.equal(typeof office,'boolean');const snapshots=[{path:'execution-envelope.json',bytes:b.envelopeBytes.length,sha256:b.envelopeSha256},{path:'inputs/case.pptx',bytes:b.bytes.length,sha256:digest(b.bytes)},{path:'inputs/plan.json',bytes:json(b.plan).length,sha256:digest(json(b.plan))},...['sh21-windowed-worker.ps1'].map(n=>({path:'inputs/'+n,...fileIdentity(at(ROOT,prefix+n))})),{path:'inputs/native-process.ps1',...WINDOWED_SUPERVISOR}];
 return{schemaVersion:1,profile:WINDOWED_PROFILE,policy:WINDOWED_POLICY,envelopeSha256:b.envelopeSha256,output,timeoutSeconds:45,maximumTotalShapes:32,planModelSha256:digest(JSON.stringify(b.plan)),planFileIdentity:{bytes:json(b.plan).length,sha256:digest(json(b.plan))},mode:b.envelope.mode,windowMode:WINDOW_MODE,witness:b.envelope.witness,runOfficeRequested:office,plan:b.plan,node:b.envelope.source.node,controller:b.envelope.controller,snapshots,workerPath:at(output,'inputs/sh21-windowed-worker.ps1'),nativeRoot:at(output,'native'),nativeAcceptance:false,registryAcceptance:false};
}
export function prepareWindowed(file,sha,output,office=false){
 const b=bindWindowedEnvelope(file,sha);outputPath(output,b.envelope);assert.ok(output!==file&&!file.startsWith(output+path.sep)&&!output.startsWith(file+path.sep),'Output overlaps source envelope');assert.equal(fs.existsSync(output),false);const q=expectedRequest(b,output,office);fs.mkdirSync(output);fs.mkdirSync(at(output,'inputs'));
 for(const [name,bytes]of [['execution-envelope.json',b.envelopeBytes],['inputs/case.pptx',b.bytes],['inputs/plan.json',json(b.plan)],['inputs/sh21-windowed-worker.ps1',readOwnedFile(at(ROOT,prefix+'sh21-windowed-worker.ps1'))],['inputs/native-process.ps1',readOwnedFile(at(ROOT,'packages/pptx/test/native-process.ps1'))],['execution-request.json',json(q)]])write(at(output,name),bytes);
 verifyWindowed(file,sha,output,office);return{profile:WINDOWED_PROFILE,output,requestSha256:digest(json(q)),nativeAcceptance:false};
}
export function verifyWindowed(file,sha,output,office){
 const b=bindWindowedEnvelope(file,sha);outputPath(output,b.envelope);const q=readOwnedJson(at(output,'execution-request.json'));assert.deepEqual(q,expectedRequest(b,output,office));
 for(const r of q.snapshots)assert.deepEqual(fileIdentity(at(output,r.path)),{bytes:r.bytes,sha256:r.sha256});assert.deepEqual(readOwnedFile(at(output,'inputs/case.pptx')),b.bytes);assert.deepEqual(readOwnedFile(at(output,'inputs/plan.json')),json(b.plan));return{...b,output,request:q,requestSha256:fileIdentity(at(output,'execution-request.json')).sha256};
}
export async function windowedCompletion(b){
 if(b.envelope.witness)assert.deepEqual(b.envelope.witness,await readWindowedWitness(b.envelope.witness.output,b.envelope.source));
 const file=n=>at(b.output,n),report=readOwnedJson(file('native/report.json')),terminal=readOwnedJson(file('native/worker.json')),stages=assertOwnedStageWire(readOwnedFile(file('native/stages.jsonl'),4194304));
 const ready=assertSh21WindowedReady(terminal,report,b.request,stages),sourceBinding={envelope:b.envelope.source,plan:b.plan,bytes:b.bytes};
 const comparison=b.envelope.mode==='org-witness'?await compareSh21OriginalMaterialized(sourceBinding,report):await compareSh21Persisted(sourceBinding,readOwnedFile(file('native/saved.pptx'),16777216),report);
 const identities=['execution-envelope.json','execution-request.json','native/report.json','native/worker.json','native/stages.jsonl',...b.request.snapshots.map(s=>s.path)].map(file);
 if(b.envelope.mode==='org-witness'){assert.equal(report.savedSha256,null);assert.equal(fs.existsSync(file('native/saved.pptx')),false,'Zero-action witness cannot save');}else{const saved=file('native/saved.pptx');assert.equal(fileIdentity(saved).sha256,report.savedSha256);identities.push(saved);}
 for(const phase of b.envelope.mode==='org-witness'?['original']:['original','edited','saved-reopened']){const png=file('native/'+phase+'.png'),bytes=readOwnedFile(png,16777216);assert.deepEqual(report.phases[phase].raster,{path:png,sha256:digest(bytes)});assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));assert.equal(bytes.readUInt32BE(16),1280);assert.equal(bytes.readUInt32BE(20),720);identities.push(png);}
 identities.push(b.envelope.source.node.path,...sourceIdentityFiles(b.envelope.controller,b.envelope.source.installed,b.envelope.source.libraries),...(b.envelope.witness?.files.map(r=>r.file)??[]));
 verifyWindowed(file('execution-envelope.json'),b.envelopeSha256,b.output,true);
 return{admission:makeOwnedAdmission({profile:WINDOWED_PROFILE,policy:WINDOWED_POLICY,requestSha256:b.requestSha256,files:identities,ready}),comparison};
}
// Bind both genuine requests without filtering/projecting the full admission.
// The generic helper deliberately retains its single-request contract unchanged.
export function assertWindowedPostflightArtifacts(postflight,bytes,admission,b){
 assertOwnedAdmissionFiles(admission);const current=at(b.output,'execution-request.json'),witness=b.envelope.witness;
 const expected=[{file:current,sha256:b.requestSha256},...(witness?[{file:at(witness.output,'execution-request.json'),sha256:witness.requestSha256}]:[])];
 assert.equal(new Set(expected.map(r=>r.file)).size,expected.length);assert.deepEqual(admission.files.filter(r=>path.basename(r.file)==='execution-request.json').map(r=>r.file).sort(),expected.map(r=>r.file).sort(),'Exactly the current and bound witness request paths required');
 assert.equal(admission.requestSha256,b.requestSha256);for(const r of expected){const rows=admission.files.filter(f=>f.file===r.file);assert.equal(rows.length,1);assert.equal(rows[0].sha256,r.sha256);assert.deepEqual({bytes:rows[0].bytes,sha256:rows[0].sha256},fileIdentity(r.file));}
 for(const r of witness?.files??[]){canonicalOwnedPath(r.file);assert.deepEqual(admission.files.filter(f=>f.file===r.file),[r],'Every already-verified witness file remains bound through observer');}
 if(!witness)return assertOwnedPostflightArtifacts(postflight,bytes,WINDOWED_POLICY,admission);
 const bound=json(admission);assert.equal(postflight.schemaVersion,1);assert.deepEqual(postflight.policy,WINDOWED_POLICY);assert.deepEqual(postflight.admission,{path:at(b.output,'postflight-admission.json'),bytes:bound.length,sha256:digest(bound)});assert.deepEqual(postflight.identity,{path:'postflight.jsonl',bytes:bytes.length,sha256:digest(bytes)});assert.ok(bytes.length>0&&bytes.length<=65536);
 const rows=bytes.toString('utf8').trim().split(/\r?\n/u).map(line=>JSON.parse(line));assertReferenceWitnessPostflight({workerCleanupConfirmed:postflight.workerCleanupConfirmed,postflightError:postflight.error,postflight:postflight.result,powerPointPostflightInitialCount:postflight.initialCount,powerPointPostflightCount:postflight.finalCount},rows);return rows;
}
export async function readWindowedWitness(output,source){
 canonicalOwnedPath(output);const envelope=path.join(output,'execution-envelope.json'),sha=fileIdentity(envelope).sha256,b=verifyWindowed(envelope,sha,output,true);assert.equal(b.envelope.mode,'org-witness');assert.equal(b.plan.caseId,'org-chart-3');
 assert.deepEqual(b.envelope.source.installed,source.installed,'Witness must use the same actual consumer');assert.deepEqual(b.envelope.controller,repositoryIdentity(ROOT,files(source)),'Witness must use this exact clean controller');
 const result=await windowedCompletion(b);assert.deepEqual(readOwnedJson(at(output,'postflight-admission.json')),result.admission);assert.deepEqual(readOwnedJson(at(output,'observations.json')),result);
 const supervisor=readOwnedJson(at(output,'native/supervisor.json'));assert.equal(supervisor.cleanupConfirmed,true);assertWindowedPostflightArtifacts(supervisor.postflight,readOwnedFile(at(output,'postflight.jsonl'),65536),result.admission,b);
 const names=['execution-envelope.json','execution-request.json','postflight-admission.json','observations.json','native/supervisor.json','postflight.jsonl'];
 return{output,envelopeSha256:sha,requestSha256:b.requestSha256,files:[...new Map([...result.admission.files,...names.map(n=>({file:at(output,n),...fileIdentity(at(output,n))}))].map(r=>[r.file,r])).values()].sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0)};
}
async function main(argv){
 const [command,...rest]=argv,o={};assert.equal(rest.length%2,0);for(let i=0;i<rest.length;i+=2){assert.ok(['--consumer','--case','--mode','--witness','--envelope','--sha256','--output','--require-office'].includes(rest[i]));assert.ok(!Object.hasOwn(o,rest[i]));assert.ok(rest[i+1]&&!rest[i+1].startsWith('--'));o[rest[i]]=rest[i+1];}
 if(command==='create-envelope'){const e=await createWindowedEnvelope({mode:o['--mode'],caseId:o['--case'],consumer:o['--consumer'],witnessOutput:o['--witness']??null});write(o['--output'],json(e));console.log(JSON.stringify({path:o['--output'],...fileIdentity(o['--output'])}));return;}
 assert.ok(['true','false'].includes(o['--require-office']??'false'));const office=o['--require-office']==='true',file=o['--envelope'],sha=o['--sha256'],output=o['--output'];
 if(command==='verify-source'){const b=bindWindowedEnvelope(file,sha);console.log(JSON.stringify(await verifySh21Source({...b,envelope:b.envelope.source})));return;}
 if(command==='prepare'){console.log(JSON.stringify(prepareWindowed(file,sha,output,office)));return;}
 const b=verifyWindowed(file,sha,output,office);if(b.envelope.witness)assert.deepEqual(b.envelope.witness,await readWindowedWitness(b.envelope.witness.output,b.envelope.source));
 if(command==='verify-execution'){await verifySh21Source({...b,envelope:b.envelope.source});console.log(JSON.stringify({controller:ROOT,inputPath:at(output,'inputs/case.pptx'),requestSha256:b.requestSha256,plan:b.plan}));return;}
 assert.ok(office&&['verify-complete','verify-admission','observe'].includes(command));const result=await windowedCompletion(b),admission=result.admission,admissionFile=at(output,'postflight-admission.json');
 if(command==='verify-complete'){console.log(JSON.stringify(writeOwnedAdmission(admissionFile,admission)));return;}
 assert.deepEqual(readOwnedJson(admissionFile),admission);
 if(command==='observe'){const s=readOwnedJson(at(output,'native/supervisor.json'));assert.equal(s.cleanupConfirmed,true);assertWindowedPostflightArtifacts(s.postflight,readOwnedFile(at(output,'postflight.jsonl'),65536),admission,b);write(at(output,'observations.json'),json(result));}
 console.log(JSON.stringify({profile:WINDOWED_PROFILE,requestSha256:b.requestSha256,ready:admission.ready}));
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main(process.argv.slice(2)).catch(e=>{console.error(e.stack);process.exitCode=1;});
