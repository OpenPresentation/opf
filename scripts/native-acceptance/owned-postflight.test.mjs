import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {digest} from './identity.mjs';
import {OWNED_POSTFLIGHT_POLICY, ownedControllerFiles, writeOwnedRequest, bindOwnedRequest, assertOwnedPostflightArtifacts} from './owned-postflight.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
test('reviewed observer complete source identity stays exact',()=>{
  const bytes=fs.readFileSync(path.join(root,OWNED_POSTFLIGHT_POLICY.observerSource));
  assert.equal(digest(bytes),OWNED_POSTFLIGHT_POLICY.observerSourceSha256);
  assert.deepEqual([OWNED_POSTFLIGHT_POLICY.budgetMilliseconds,OWNED_POSTFLIGHT_POLICY.intervalMilliseconds,OWNED_POSTFLIGHT_POLICY.maximumQueries],[5000,100,51]);
});
test('shared source includes both artifact-validator dependency branches',()=>{
  const closure=ownedControllerFiles(root,['scripts/native-acceptance/owned-postflight.mjs']);
  for(const name of ['reference-chart-profile.mjs','reference-chart-archive.mjs','reference-runtime-routes.mjs','identity.mjs'])assert.ok(closure.includes('scripts/native-acceptance/'+name));
});
test('immutable request uses exclusive creation and exact bytes/current authorization',()=>{
  const parent=path.join(root,'artifacts/native-pure-tests'); fs.mkdirSync(parent,{recursive:true});
  const dir=fs.mkdtempSync(path.join(parent,'opf-owned-request-'));
  try {
    const file=path.join(dir,'execution-request.json'),request={workerArguments:['@request-sha256'],profile:'synthetic'};
    const first=writeOwnedRequest(file,request);assert.deepEqual(bindOwnedRequest(file,request,first.identity.sha256).request,request);
    assert.throws(()=>writeOwnedRequest(file,request));
    assert.throws(()=>bindOwnedRequest(file,{...request,profile:'foreign'}));
    fs.appendFileSync(file,' ');assert.throws(()=>bindOwnedRequest(file,request,first.identity.sha256));
  } finally {
    const actual=fs.realpathSync(dir), allowed=fs.realpathSync(parent)+path.sep;
    assert.ok(actual.startsWith(allowed)&&path.basename(actual).startsWith('opf-owned-request-'));
    fs.rmSync(actual,{recursive:true,force:true});
  }
});
function artifact() {
  const admission={files:[{file:path.resolve('synthetic/execution-request.json')}]},bytes=Buffer.from(JSON.stringify({schemaVersion:1,sequence:1,utc:'2000-01-01T00:00:00.000Z',elapsedMilliseconds:0,status:'observed',processIds:[],error:null})+'\n');
  const result={schemaVersion:1,policy:'global-zero-after-completed-owned-quit-v1',budgetMilliseconds:5000,intervalMilliseconds:100,maximumQueries:51,
    sampleCount:1,initialProcessIds:[],initialCount:0,finalProcessIds:[],finalCount:0,elapsedMilliseconds:0,finishedElapsedMilliseconds:0,observedZero:true,officeActions:0};
  const postflight={schemaVersion:1,policy:{policy:'synthetic',...OWNED_POSTFLIGHT_POLICY},admission:{path:path.resolve('synthetic/postflight-admission.json'),bytes:Buffer.byteLength(JSON.stringify(admission,null,2)+'\n'),sha256:digest(Buffer.from(JSON.stringify(admission,null,2)+'\n'))},
    identity:{path:'postflight.jsonl',bytes:bytes.length,sha256:digest(bytes)},workerCleanupConfirmed:true,error:null,result,initialCount:0,finalCount:0};
  return {admission,bytes,postflight};
}
test('existing artifact verifier accepts exact synthetic first zero',()=>{const a=artifact();assertOwnedPostflightArtifacts(a.postflight,a.bytes,a.postflight.policy,a.admission)});
for(const field of ['policy','hash','error','late','actions','admission'])test('artifact refuses '+field,()=>{
  const a=artifact(),expected=structuredClone(a.postflight.policy);
  if(field==='policy')a.postflight.policy.intervalMilliseconds=99;
  if(field==='hash')a.postflight.identity.sha256='0'.repeat(64);
  if(field==='error')a.postflight.error='synthetic';
  if(field==='late')a.postflight.result.finishedElapsedMilliseconds=5000;
  if(field==='actions')a.postflight.result.officeActions=1;
  if(field==='admission')a.postflight.admission.sha256='0'.repeat(64);
  assert.throws(()=>assertOwnedPostflightArtifacts(a.postflight,a.bytes,expected,a.admission));
});
test('actual PS5 pure observer and local dispatcher controls',t=>{
  if(process.platform!=='win32'){t.skip('Actual Windows PowerShell 5.1 control');return}
  const executable=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
  const env={...process.env};delete env.PSModulePath;
  for(const file of ['owned-postflight-check.ps1','owned-profile-admission-check.ps1','table-v3-worker-pure-check.ps1']) {
    const result=spawnSync(executable,['-NoProfile','-NonInteractive','-File',path.join(root,'scripts/native-acceptance',file),'-NodeExecutable',process.execPath],{env,encoding:'utf8',timeout:60000});
    assert.ifError(result.error);assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  }
});

