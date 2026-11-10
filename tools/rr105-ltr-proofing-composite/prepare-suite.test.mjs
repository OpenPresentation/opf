import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseArgs,sourcePlan,inspect,sha} from './prepare-suite.mjs';
const folder=fileURLToPath(new URL('./',import.meta.url));
const exact=[{op:'ltr-run-restore-ar-sa',slideIndex:1,shapeName:'OPF list slides.0.items line 0'}];
test('default plan binds exact historical original09, one closed composite and all thirty character samples',()=>{
 const before=fs.readdirSync(folder).sort(),p=sourcePlan();assert.equal(p.mode,'source-plan-only');assert.equal(p.nativeAuthorized,false);assert.equal(p.nativeRun,false);assert.equal(p.validateOnlyRun,false);assert.equal(p.source.originalArchiveSha256,'4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2');assert.deepEqual(p.source.limits,{slides:1,shapes:3,actions:1,timeoutSeconds:45,phases:['original','edited','reopened'],characterSamplesPerPhase:10});assert.deepEqual(p.source.samplePlan.map(x=>x.positions1Based),[[1,2,3,4,6,9],[1,2,3,4]]);assert.deepEqual(JSON.parse(fs.readFileSync(new URL('./references/composite.json',import.meta.url))),exact);const raw=gunzipSync(fs.readFileSync(new URL('./references/original09.pptx.gz',import.meta.url)));assert.equal(raw.length,101027);assert.equal(sha(raw),p.source.originalArchiveSha256);assert.deepEqual(fs.readdirSync(folder).sort(),before);
});
test('actual default child CLI is inspect-only and does not create a suite or activate Office',()=>{
 const before=fs.readdirSync(folder).sort(),raw=execFileSync(process.execPath,[fileURLToPath(new URL('./prepare-suite.mjs',import.meta.url))],{encoding:'utf8'}),p=JSON.parse(raw);assert.equal(p.mode,'source-plan-only');assert.equal(p.nativeRun,false);assert.equal(p.validateOnlyRun,false);assert.deepEqual(fs.readdirSync(folder).sort(),before);
});
test('explicit preparation arguments reject missing, duplicate, unknown and native-entry flags',()=>{
 assert.deepEqual(parseArgs([]),{mode:'plan'});const args=['--worker-checkout','C:/worker','--controller','C:/controller','--expect-head','a'.repeat(40)];assert.equal(parseArgs(['inspect',...args]).mode,'inspect');assert.equal(parseArgs(['prepare',...args,'--output','C:/fresh']).mode,'prepare');for(const bad of [['native'],['prepare'],['inspect',...args,'--output','C:/bad'],['prepare',...args],['inspect',...args,'--controller','C:/duplicate'],['inspect',...args,'--RunOffice','true'],['inspect',...args,'--output']])assert.throws(()=>parseArgs(bad));
});
test('identity admission refuses incomplete SHA before reading supplied roots',()=>{
 for(const head of ['unreviewed','a'.repeat(39),'A'.repeat(40),'a'.repeat(41)])assert.throws(()=>inspect({workerCheckout:'C:/not-an-execution-root',controller:'C:/not-an-execution-root',expectedHead:head}),/Explicit reviewed head required/);
});
test('the complete lifecycle entrypoint, ownership, failure latch and supervisor sources remain inherited byte-for-byte',()=>{
 const p=sourcePlan(),base=gunzipSync(fs.readFileSync(new URL('./references/base-worker.ps1.gz',import.meta.url))).toString('utf8'),current=fs.readFileSync(new URL('./worker-package/test/native-furniture-control.ps1',import.meta.url),'utf8');const start="Write-FurnitureReport; Write-FurnitureStage 'worker.initialize' 'success'";assert.equal(current.slice(current.indexOf(start)),base.slice(base.indexOf(start)));assert.equal(current.slice(0,current.indexOf('$ErrorActionPreference')),base.slice(0,base.indexOf('$ErrorActionPreference')));assert.match(current,/if\(\$TimeoutSeconds -ne 45\)/);for(const f of p.source.workerFiles.slice(1))assert.equal(f.sha256,p.source.baseWorkerFiles.find(x=>x.path===f.path).sha256);
});
test('source plan refuses changed worker bytes and does not retag historical input or weaken composite admission',()=>{
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'b07-composite-pure-'));
 try {const copied=path.join(scratch,'tools','rr105-ltr-proofing-composite');fs.cpSync(folder,copied,{recursive:true});const cli=path.join(copied,'prepare-suite.mjs');const run=()=>execFileSync(process.execPath,[cli],{encoding:'utf8',stdio:['ignore','pipe','pipe']});assert.equal(JSON.parse(run()).mode,'source-plan-only');const f=path.join(copied,'worker-package/test/native-furniture-control.ps1'),original=fs.readFileSync(f);fs.appendFileSync(f,'# altered');assert.throws(run);fs.writeFileSync(f,original);const sourceFile=path.join(copied,'SOURCE.json'),source=JSON.parse(fs.readFileSync(sourceFile,'utf8'));for(const mutate of [s=>s.originalArchiveSha256='0'.repeat(64),s=>s.limits.actions=0,s=>s.composite.finalLanguageId=1033,s=>s.composite.declaredIntermediateLanguageIds.push(0)]){const bad=structuredClone(source);mutate(bad);fs.writeFileSync(sourceFile,JSON.stringify(bad));assert.throws(run);} }finally{fs.rmSync(scratch,{recursive:true,force:true});}
});
