import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const folder=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(folder,'../../../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const q=read(path.join(folder,'qualification.json')),packed=fs.readFileSync(path.join(folder,q.raw.path));
assert.equal(q.neverMerge,true);assert.equal(q.sourcePreparationOnly,true);assert.equal(q.suitePrepared,false);assert.equal(q.validateOnlyRun,false);assert.equal(q.officeActivated,false);assert.equal(q.nativeRun,false);assert.equal(q.nativeAcceptance,false);assert.equal(q.currentRuntimeAcceptance,false);assert.equal(q.mappedCheckRun,false);
assert.equal(packed.length,q.raw.bytes);assert.equal(sha(packed),q.raw.sha256);
const expanded=gunzipSync(packed,{maxOutputLength:16*1024*1024});assert.equal(expanded.length,q.raw.expandedBytes);
const {records}=JSON.parse(expanded);assert.equal(records.length,q.raw.records);
const entries=new Map();
for(const r of records){assert(!r.path.includes('..')&&!path.isAbsolute(r.path));assert(!entries.has(r.path));const b=Buffer.from(r.base64,'base64');assert.equal(b.length,r.bytes,r.path);assert.equal(sha(b),r.sha256,r.path);entries.set(r.path,b);}
const record=p=>{assert(entries.has(p),p);return JSON.parse(entries.get(p).toString('utf8').replace(/^\uFEFF/,''));};
for(const label of ['node-final','managed-final','character-final']){const r=record(label+'.exit.json');assert.equal(r.status,0,label);assert.equal(r.signal,null);assert.equal(r.officeActivated,false);assert.equal(entries.get(label+'.stderr.log').length,0);}
for(const label of ['managed-01','managed-02','managed-03','character-01'])assert.equal(record(label+'.exit.json').status,1,label);
const managed=record('managed-final/managed.json'),character=record('character-final/managed.json');
assert.equal(managed.mode,'PURE_MANAGED_FAKE_ONLY');assert.equal(managed.cases.length,481);assert(managed.cases.every(c=>c.passed===true));assert.equal(managed.comStages.length,112);assert.equal(managed.actionReportWrites,186);assert.equal(managed.cases.filter(c=>c.name.startsWith('stage-io:')).length,147);assert.equal(managed.cases.filter(c=>c.name.startsWith('report-io:')).length,186);assert.equal(managed.cases.filter(c=>c.name.startsWith('com-fault:')).length,112);
assert.equal(new Set(managed.comStages).size,112);assert.deepEqual(managed.cases.filter(c=>c.name.startsWith('com-fault:')).map(c=>c.name.slice(10)),managed.comStages);
for(const r of managed.cases.filter(c=>c.name.startsWith('com-fault:')||c.name.startsWith('report-io:')||c.name.startsWith('stage-io:')))assert.equal(r.stopped,true,r.name);
for(const name of ['normal','middle-1025']){const r=managed.cases.find(c=>c.name===name);assert.equal(r.ltrRunCalls,1);assert.equal(r.languageAssignments,1);assert.deepEqual(r.completedPhases,['original','edited','reopened']);assert.equal(r.intermediateLanguageId,name==='normal'?1033:1025);}
assert.equal(character.cases.length,23);assert(character.cases.every(c=>c.passed===true));assert.equal(character.protectedFunctions.length,49);assert.equal(character.zipPartNamesInOrder.length,147);assert.equal(character.nativeRun,false);assert.equal(character.officeActivated,false);
const changes=character.protectedFunctions.filter(f=>!f.unchanged).map(f=>f.name).sort();assert.deepEqual(changes,['Apply-FurnitureAction','Assert-FurnitureProofingInput','Read-AndValidateActionPlan','Read-FurnitureState']);
for(const f of q.sourceFiles){assert(!f.path.includes('..')&&!path.isAbsolute(f.path));const b=fs.readFileSync(path.join(root,f.path));assert.equal(b.length,f.bytes,f.path);assert.equal(sha(b),f.sha256,f.path);}
const tool=path.join(root,'tools/rr105-ltr-proofing-composite'),source=read(path.join(tool,'SOURCE.json'));
assert.equal(managed.workerSha256,source.workerFiles[0].sha256);assert.equal(character.workerSha256,source.workerFiles[0].sha256);assert.equal(source.baseWorkerRevision,'496cac197b1c57c03b4529065f91bb205dc0bf2f');
for(const r of [...source.references,...source.workerFiles.map(f=>({...f,path:'worker-package/'+f.path}))]){const b=fs.readFileSync(path.join(tool,r.path));assert.equal(b.length,r.bytes,r.path);assert.equal(sha(b),r.sha256,r.path);if(r.expandedSha256){const raw=gunzipSync(b);assert.equal(raw.length,r.expandedBytes);assert.equal(sha(raw),r.expandedSha256);}}
assert.equal(source.originalArchiveSha256,'4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2');assert.equal(source.originalArchiveBytes,101027);assert.equal(source.originalZipParts,147);assert.equal(source.limits.timeoutSeconds,45);assert.equal(source.limits.actions,1);
for(const p of q.protectedObjects){assert.equal(p.headObject,p.baseObject);assert.equal(execFileSync('git',['-C',root,'rev-parse',q.baseRevision+':'+p.path],{encoding:'utf8'}).trim(),p.baseObject);assert.equal(execFileSync('git',['-C',root,'diff','--name-only',q.baseRevision,'--',p.path],{encoding:'utf8'}).trim(),'');}
console.log(JSON.stringify({passed:true,rawRecords:records.length,rawBytes:records.reduce((n,r)=>n+r.bytes,0),sourceFiles:q.sourceFiles.length,pureControls:{node:6,managed:481,character:23},newComStages:112,actionReportWrites:186,stageJournalFaults:147,originalParts:147,suitePrepared:false,validateOnlyRun:false,officeActivated:false,nativeAcceptance:false}));
