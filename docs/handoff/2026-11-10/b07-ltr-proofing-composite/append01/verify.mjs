import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const folder=path.dirname(fileURLToPath(import.meta.url)),parent=path.dirname(folder),root=path.resolve(folder,'../../../../..');
const sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const q=read(path.join(folder,'qualification.json')),old=read(path.join(parent,'qualification.json'));
const records=new Map();let bytes=0;
function packet(dir,metadata){const b=fs.readFileSync(path.join(dir,'raw.json.gz'));assert.equal(b.length,metadata.bytes);assert.equal(sha(b),metadata.sha256);const raw=gunzipSync(b,{maxOutputLength:16*1024*1024});if(metadata.expandedBytes)assert.equal(raw.length,metadata.expandedBytes);const data=JSON.parse(raw).records;assert.equal(data.length,metadata.records);for(const r of data){assert(!r.path.includes('..')&&!path.isAbsolute(r.path));assert(!records.has(r.path),r.path);const value=Buffer.from(r.base64,'base64');assert.equal(value.length,r.bytes,r.path);assert.equal(sha(value),r.sha256,r.path);records.set(r.path,value);bytes+=value.length;}}
packet(parent,{...old.raw,sha256:q.historicalPacket.sha256});packet(folder,q.raw);assert.equal(records.size,q.logicalRawRecords);
const record=p=>{assert(records.has(p),p);return JSON.parse(records.get(p).toString('utf8').replace(/^\uFEFF/,''));};
for(const label of ['node-safe','managed-safe','character-safe']){const r=record(label+'.exit.json');assert.equal(r.status,0,label);assert.equal(r.signal,null);assert.equal(r.officeActivated,false);assert.equal(r.workerSha256,q.workerSha256);assert.equal(records.get(label+'.stderr.log').length,0);}
for(const label of ['managed-01','managed-02','managed-03','character-01'])assert.equal(record(label+'.exit.json').status,1,label);
assert.equal(record('managed-peer-final.exit.json').status,0);
const fixture=record('phase-copy-diagnosis/diagnosis.json');assert.equal(fixture.unchangedJsonCopyRejected,true);assert.notEqual(fixture.originalFontType,fixture.copiedFontType);assert.equal(fixture.officeActivated,false);
const spy=record('nonprimitive-diagnosis/diagnosis.json');assert.equal(spy.workerSourceHead,q.historicalRevision);assert.equal(spy.unsafeValueRetainedInState,true);assert.equal(spy.spyPropertyReadsDuringSerialization,1);assert.equal(spy.officeActivated,false);
const managed=record('managed-safe/managed.json'),character=record('character-safe/managed.json');assert.equal(managed.mode,'PURE_MANAGED_FAKE_ONLY');assert.equal(managed.cases.length,484);assert(managed.cases.every(c=>c.passed===true));assert.equal(managed.comStages.length,112);assert.equal(managed.actionReportWrites,186);
for(const [prefix,count]of [['com-fault:',112],['report-io:',186],['stage-io:',147]]){const group=managed.cases.filter(c=>c.name.startsWith(prefix));assert.equal(group.length,count);assert(group.every(c=>c.stopped===true));}
for(const name of ['normal','middle-1025']){const r=managed.cases.find(c=>c.name===name);assert.equal(r.ltrRunCalls,1);assert.equal(r.languageAssignments,1);assert.deepEqual(r.completedPhases,['original','edited','reopened']);assert.equal(r.intermediateLanguageId,name==='normal'?1033:1025);}
for(const name of ['middle-object','middle-nonfinite','middle-overlong']){const r=managed.cases.find(c=>c.name===name);assert.equal(r.passed,true);assert.equal(r.languageAssignments,0);assert.equal(r.stopped,true);}
assert.equal(character.cases.length,23);assert(character.cases.every(c=>c.passed===true));assert.equal(character.protectedFunctions.length,49);assert.equal(character.zipPartNamesInOrder.length,147);
assert.deepEqual(character.protectedFunctions.filter(f=>!f.unchanged).map(f=>f.name).sort(),['Apply-FurnitureAction','Assert-FurnitureProofingInput','Read-AndValidateActionPlan','Read-FurnitureState']);
for(const r of old.sourceFiles){const b=execFileSync('git',['-C',root,'show',q.historicalRevision+':'+r.path],{maxBuffer:4*1024*1024});assert.equal(b.length,r.bytes,r.path);assert.equal(sha(b),r.sha256,r.path);}
for(const r of q.sourceFiles){const b=fs.readFileSync(path.join(root,r.path));assert.equal(b.length,r.bytes,r.path);assert.equal(sha(b),r.sha256,r.path);}
const tool=path.join(root,'tools/rr105-ltr-proofing-composite'),source=read(path.join(tool,'SOURCE.json'));assert.equal(source.workerFiles[0].sha256,q.workerSha256);assert.equal(managed.workerSha256,q.workerSha256);assert.equal(character.workerSha256,q.workerSha256);
for(const r of [...source.references,...source.workerFiles.map(f=>({...f,path:'worker-package/'+f.path}))]){const b=fs.readFileSync(path.join(tool,r.path));assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);if(r.expandedSha256){const expanded=gunzipSync(b);assert.equal(expanded.length,r.expandedBytes);assert.equal(sha(expanded),r.expandedSha256);}}
assert.equal(source.originalArchiveSha256,'4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2');assert.equal(source.originalArchiveBytes,101027);assert.equal(source.originalZipParts,147);assert.equal(source.limits.timeoutSeconds,45);assert.equal(source.limits.actions,1);
for(const p of q.protectedObjects){assert.equal(p.headObject,p.baseObject);assert.equal(execFileSync('git',['-C',root,'diff','--name-only',old.baseRevision,'--',p.path],{encoding:'utf8'}).trim(),'');}
for(const field of ['suitePrepared','validateOnlyRun','officeActivated','nativeRun','glyphFix','nativeAcceptance','currentRuntimeAcceptance','mappedCheckRun'])assert.equal(q[field],false,field);assert.equal(q.neverMerge,true);
console.log(JSON.stringify({passed:true,rawRecords:records.size,rawBytes:bytes,exactCurrentSources:q.sourceFiles.length,historicalSources:old.sourceFiles.length,pureControls:{node:6,managed:484,character:23},newComStages:112,actionReportWrites:186,stageJournalFaults:147,originalParts:147,suitePrepared:false,validateOnlyRun:false,officeActivated:false,nativeAcceptance:false}));
