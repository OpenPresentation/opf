// Actual production record/ready functions over explicitly SYNTHETIC records.
// Real source-authority/default-entry and native qualification are separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {syntheticValueControl} from './seven-value-control-fixture.mjs';
import {assertSevenValueExecutionRecords,assertSevenValueReady,validateSevenValueExecution,VALUE_FILES} from './seven-value-profile.mjs';
import {fileIdentity} from './identity.mjs';
import {windowsPowerShellEnvironment} from './windows-powershell-env.mjs';
const ROOT=fs.realpathSync(fileURLToPath(new URL('../../',import.meta.url))),parent=fs.realpathSync(os.tmpdir());
function owned(run){const root=path.join(parent,'opf-seven-value-control-'+randomUUID());let passed=false;try{const f=syntheticValueControl(root);run(f);passed=true;}finally{if(passed){assert.ok(path.basename(root).startsWith('opf-seven-value-control-'));fs.rmSync(root,{recursive:true,force:true});}else console.error('Preserved synthetic Seven-value control: '+root);}}
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
test('actual CLI accepts the required sha256 option and reaches the exact envelope digest guard',()=>owned(f=>{
 const script=path.join(ROOT,'scripts/native-acceptance/seven-value-profile.mjs'),wrong='0'.repeat(64);
 const run=spawnSync(process.execPath,[script,'verify','--envelope',f.envelopeFile,'--sha256',wrong],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
 assert.ifError(run.error);assert.equal(run.status,1);assert.equal(run.stdout,'');
 assert.ok(run.stderr.includes(fileIdentity(f.envelopeFile).sha256));assert.ok(run.stderr.includes(wrong));
 assert.match(run.stderr,/readSevenValueEnvelope/u);
 const unknown=spawnSync(process.execPath,[script,'verify','--envelope',f.envelopeFile,'--sha257',wrong],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
 assert.ifError(unknown.error);assert.equal(unknown.status,1);assert.match(unknown.stderr,/Unknown argument/u);
}));
test('production owned-record verifier accepts exact synthetic files and binds raw request identity',()=>owned(f=>{
 const b=assertSevenValueExecutionRecords(f.binding,f.envelopeFile,f.directory,true);assert.equal(b.requestBinding.identity.sha256,fileIdentity(path.join(f.directory,'execution-request.json')).sha256);
 // Same fake metadata CANNOT traverse the real source/default verifier.
 assert.throws(()=>validateSevenValueExecution(f.envelopeFile,f.binding.envelopeSha256,f.directory,true));
}));
for(const mode of ['unknown-runner','foreign-profile','pure-attempt','timeout','snapshot-missing','snapshot-duplicate','snapshot-hash','action-wire','request-extra','request-profile','request-box','request-model','request-wire','worker-argument','controller-directory','model-vs-wire'])test('production owned-record verifier refuses '+mode,()=>owned(f=>{
 const runnerFile=path.join(f.directory,'runner.json'),runner=read(runnerFile),requestFile=path.join(f.directory,'execution-request.json'),request=read(requestFile);
 if(mode==='unknown-runner')runner.unknown=true;if(mode==='foreign-profile')runner.profile='foreign';if(mode==='pure-attempt')runner.runOfficeRequested=false;if(mode==='timeout')runner.timeoutSeconds=61;
 if(mode==='snapshot-missing')runner.snapshots.pop();if(mode==='snapshot-duplicate')runner.snapshots.push(runner.snapshots[0]);if(mode==='snapshot-hash')runner.snapshots[0].sha256='0'.repeat(64);
 if(mode==='action-wire')fs.appendFileSync(path.join(f.directory,'inputs/action.json'),' ');
 if(mode==='request-extra')request.extra=true;if(mode==='request-profile')request.profile='seven-chart-original-readonly-v2';if(mode==='request-box')request.selectedCase.action.sourceType='box-and-whisker';if(mode==='request-model')request.selectedCase.actionModelSha256='0'.repeat(64);if(mode==='request-wire')request.selectedCase.actionFileIdentity.bytes++;
 if(mode==='worker-argument')request.workerArguments.push('-Unknown');if(mode==='controller-directory')request.controller.directory=path.join(f.root,'foreign');
 if(mode==='model-vs-wire')f.binding.envelope.actionModelSha256='0'.repeat(64);
 write(requestFile,request);runner.request={path:'execution-request.json',...fileIdentity(requestFile)};write(runnerFile,runner);
 assert.throws(()=>assertSevenValueExecutionRecords(f.binding,f.envelopeFile,f.directory,true));
}));
test('production default source reader rejects byte drift before metadata verification',()=>owned(f=>{
 fs.appendFileSync(f.envelopeFile,' ');assert.throws(()=>validateSevenValueExecution(f.envelopeFile,f.binding.envelopeSha256,f.directory,true));
}));
test('actual typed-ready accepts the complete synthetic one-setter/three-readback evidence',()=>owned(f=>{
 assert.equal(assertSevenValueReady(f.binding,f.evidence.terminal,f.evidence.report,f.evidence.stages,f.archive).edits,1);
 assert.equal(f.evidence.report.probes.length,57);
}));
for(const mode of ['missing-owned-proof','duplicate-owned-proof','reordered-owned-proofs','false-actual-owned-proof','false-expected-owned-proof','unknown-owned-proof','wrong-readback-proof','failed-worker','timed-out','cleanup-false','stage-gap','stage-error','stage-object','stage-missing','stage-extra','stage-readonly','preflight-nonzero','missing-preflight-proof','second-setter','wrong-before','wrong-after','stale-reopened','foreign-source-path','wrong-wire'])test('typed-ready refuses '+mode,()=>owned(f=>{
 const e=f.evidence,r=e.report,s=e.stages,p=r.probes.findIndex(probe=>probe.stage==='value.setter.capturedRefs');
 if(mode==='missing-owned-proof')r.probes.splice(p,1);if(mode==='duplicate-owned-proof')r.probes.splice(p,0,structuredClone(r.probes[p]));if(mode==='reordered-owned-proofs')[r.probes[p],r.probes[p+1]]=[r.probes[p+1],r.probes[p]];
 if(mode==='false-actual-owned-proof')r.probes[p].actual=false;if(mode==='false-expected-owned-proof')r.probes[p].expected='foreign';if(mode==='unknown-owned-proof')r.probes[p].extra=true;if(mode==='wrong-readback-proof')r.probes.find(probe=>probe.stage==='value.edited.expected.0').actual=42;
 if(mode==='failed-worker')e.terminal.exitCode=1;if(mode==='timed-out')e.terminal.timedOut=true;if(mode==='cleanup-false')r.cleanupConfirmed=false;
 if(mode==='stage-gap')s[0].sequence=2;if(mode==='stage-error')s[0].error='fault';if(mode==='stage-object')s[0].value={foreign:true};if(mode==='stage-missing')s.pop();if(mode==='stage-extra')s.push(structuredClone(s.at(-1)));
 if(mode==='stage-readonly')s.find(row=>row.stage==='value.setter.readOnly'&&row.status==='success').value=0;
 if(mode==='preflight-nonzero')s.find(row=>row.stage==='preflight.globalIdle'&&row.status==='success').value=1;if(mode==='missing-preflight-proof')r.probes.shift();
 if(mode==='second-setter')r.actions[0].setterAttempts=2;if(mode==='wrong-before')r.actions[0].before[0]=41;if(mode==='wrong-after')r.actions[0].after[0]=42;if(mode==='stale-reopened')r.actions[0].reopened[0]=42;if(mode==='foreign-source-path')r.sourcePath+='-foreign';if(mode==='wrong-wire')r.actions[0].actionFileIdentity.sha256='0'.repeat(64);
 assert.throws(()=>assertSevenValueReady(f.binding,e.terminal,r,s,f.archive));
}));
test('source closure includes new controller, raw guard, managed bridge controls and exact observer',()=>{
 for(const name of ['seven-value-profile.mjs','seven-value-raw.mjs','seven-value-control-fixture.mjs','seven-value-profile.test.mjs','seven-value-postflight-self-test.ps1','seven-value-worker.ps1','run-reference-chart-profile.ps1'])assert.ok(VALUE_FILES.includes('scripts/native-acceptance/'+name),name);
});
test('actual Windows PS5 strict preflight and typed bridge controls; no Office/process queries',t=>{
 if(process.platform!=='win32'){t.skip('Actual Windows PowerShell5.1 managed controls, not a portable qualification');return;}
 owned(f=>{
  const run=spawnSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',path.join(ROOT,'scripts/native-acceptance/seven-value-postflight-self-test.ps1'),'-FixtureFile',path.join(f.root,'synthetic-context.json')],{encoding:'utf8',env:windowsPowerShellEnvironment(process.env),timeout:60000,maxBuffer:4*1024*1024});
  assert.ifError(run.error);assert.equal(run.status,0,run.stdout+'\n'+run.stderr);const result=JSON.parse(run.stdout.trim());assert.equal(result.realProcessQueries,0);assert.equal(result.officeActions,0);assert.equal(result.failed,0);assert.ok(result.controls>=30);
 });
});
