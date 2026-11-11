// Synthetic completed-worker/observation controls only; never Office evidence.
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {digest} from './identity.mjs';
import {B07_POSTFLIGHT_POLICY,B07_COMPLETED_LIFECYCLE,assertB07PostflightReady,assertB07BoundedPostflight} from './b07-postflight.mjs';
import {windowsPowerShellEnvironment} from './windows-powershell-env.mjs';

function completed() {
  const terminal={timedOut:false,exitCode:0,cleanupConfirmed:true,lastDurableStage:'worker.complete',lastDurableStatus:'success'};
  const report={cleanupConfirmed:true,officeOperationsStopped:false,error:null,lastStage:'worker.complete',lastStatus:'success',captureTextFonts:true,readOnlySurvey:false,actionPlan:{actions:[],completed:[]},phases:{original:{},edited:{},reopened:{}}};
  const request={captureTextFonts:true,readOnlySurvey:false,actionPlan:{count:0}};
  const stages=B07_COMPLETED_LIFECYCLE.flatMap(stage=>stage.startsWith('worker.')||stage.endsWith('.cleanup')?[[stage,'success']]:[[stage,'begin'],[stage,'success']]);
  stages.splice(8,0,['synthetic.parent','begin'],['synthetic.child','begin'],['synthetic.child','success'],['synthetic.parent','success']);
  return {terminal,report,request,stages:stages.map(([stage,status],index)=>({sequence:index+1,stage,status,error:index%2?'':null,officeOperationsStopped:false,cleanupConfirmed:true,ownedPresentationPath:null}))};
}
const wire=stages=>Buffer.from('\uFEFF'+stages.map(stage=>JSON.stringify(stage)).join('\r\n')+'\r\n');
const ready=value=>assertB07PostflightReady(value.terminal,value.report,value.request,wire(value.stages));

test('B07 postflight readiness uses actual completed-worker facts, preserving nested stages and raw records',()=>{
  const value=completed(),original=structuredClone(value),bytes=wire(value.stages),before=Buffer.from(bytes);
  const result=assertB07PostflightReady(value.terminal,value.report,value.request,bytes);
  assert.equal(result.workerCleanupConfirmed,true);
  assert.equal(result.stageCount,value.stages.length);
  assert.deepEqual(result.lifecycle.map(row=>row.stage),B07_COMPLETED_LIFECYCLE);
  assert.deepEqual(value,original);assert.deepEqual(bytes,before);
});

test('a fault, incomplete lifecycle or changed raw B07 request/report cannot authorize postflight',()=>{
  const mutations=[
    value=>{value.terminal.timedOut=true;},value=>{value.terminal.exitCode='0';},value=>{value.terminal.cleanupConfirmed=false;},value=>{value.terminal.lastDurableStage='worker.failure';},
    value=>{value.report.error='';},value=>{delete value.report.error;},value=>{value.report.officeOperationsStopped=true;},value=>{value.report.cleanupConfirmed=false;},value=>{value.report.lastStatus='begin';},
    value=>{value.request.captureTextFonts=false;},value=>{value.request.readOnlySurvey=true;},value=>{value.request.actionPlan.count='0';},value=>{value.report.actionPlan.actions.push({op:'synthetic-not-admitted'});},value=>{value.report.actionPlan.completed.push({status:'success'});},value=>{delete value.report.phases.edited;},
    ...B07_COMPLETED_LIFECYCLE.map(name=>value=>{value.stages=value.stages.filter(stage=>stage.stage!==name);value.stages.forEach((stage,index)=>{stage.sequence=index+1;});}),
    value=>{value.stages.at(-2).error=' ';},value=>{value.stages.at(-2).officeOperationsStopped=true;},
    value=>{value.stages.find(stage=>stage.stage==='edited.presentation.cleanup').ownedPresentationPath='unclosed.pptx';},
    value=>{value.stages.find(stage=>stage.stage==='application.cleanup.quit'&&stage.status==='success').cleanupConfirmed=false;},
    value=>{const a=value.stages.find(stage=>stage.stage==='edited.presentation.cleanup'),b=value.stages.find(stage=>stage.stage==='reopened.presentation.cleanup');[a.stage,b.stage]=[b.stage,a.stage];},
    value=>{const stage=structuredClone(value.stages.find(stage=>stage.stage==='application.cleanup.quit'&&stage.status==='success'));value.stages.splice(-1,0,stage);value.stages.forEach((row,index)=>{row.sequence=index+1;});},
  ];
  for(const mutate of mutations){const value=completed();mutate(value);assert.throws(()=>ready(value));}
});

function observation(){
  const rows=[{schemaVersion:1,sequence:1,utc:'2026-11-10T00:00:00.000Z',elapsedMilliseconds:0,status:'observed',processIds:[12345],error:null},{schemaVersion:1,sequence:2,utc:'2026-11-10T00:00:00.100Z',elapsedMilliseconds:100,status:'observed',processIds:[],error:null}];
  const bytes=Buffer.from(rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
  const postflight={policy:structuredClone(B07_POSTFLIGHT_POLICY),workerCleanupConfirmed:true,initialCount:1,finalCount:0,error:null,result:{schemaVersion:1,policy:B07_POSTFLIGHT_POLICY.observationPolicy,budgetMilliseconds:5000,intervalMilliseconds:100,maximumQueries:51,sampleCount:2,initialProcessIds:[12345],initialCount:1,finalProcessIds:[],finalCount:0,elapsedMilliseconds:100,finishedElapsedMilliseconds:101,observedZero:true,officeActions:0},identity:{path:'native/postflight.jsonl',bytes:bytes.length,sha256:digest(bytes)}};
  return {rows,bytes,postflight};
}
test('new B07 observation preserves first nonzero and reuses unchanged strict reference receipt validation',()=>{
  const {rows,bytes,postflight}=observation(),before=Buffer.from(bytes);
  assert.deepEqual(assertB07BoundedPostflight(postflight,bytes),rows);
  assert.deepEqual(postflight.result.initialProcessIds,[12345]);assert.equal(postflight.initialCount,1);assert.equal(postflight.finalCount,0);assert.deepEqual(bytes,before);
  for(const mutate of [p=>{p.identity.sha256='0'.repeat(64);},p=>{p.identity.bytes++;},p=>{p.identity.path='other.jsonl';},p=>{p.policy.budgetMilliseconds++;},p=>{p.workerCleanupConfirmed=false;},p=>{p.initialCount=0;},p=>{p.error='query fault';},p=>{p.result.finishedElapsedMilliseconds=5000;},p=>{p.result.observedZero=false;},p=>{p.result.officeActions=1;}]){const changed=structuredClone(postflight);mutate(changed);assert.throws(()=>assertB07BoundedPostflight(changed,bytes));}
  assert.throws(()=>assertB07BoundedPostflight({policy:'one-global-zero-query-after-completed-owned-quit',processIds:[],officeActions:0},bytes));
});

test('reviewed observer source remains exact and B07 source binds actual worker payloads before process observation',()=>{
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const observer=readFileSync(new URL('../../'+B07_POSTFLIGHT_POLICY.observerSource,import.meta.url));
  assert.equal(digest(observer),B07_POSTFLIGHT_POLICY.observerSourceSha256);
  assert.deepEqual(observer,execFileSync('git',['show','f3f04183c2d38ffe3e5755a23b571b6b9ce8155e:'+B07_POSTFLIGHT_POLICY.observerSource],{cwd:root}));
  // Stage 1 remains the immutable original whole worker. Stage 2 is ONLY the
  // independently reviewed strict idle function. Stage 3 adds ONLY the pinned
  // reviewed name-type diagnostic region. Stage 4 adds ONLY the pinned closed
  // reference mode in four exact regions; never derive from current bytes.
  const worker='packages/pptx/test/native-furniture-control.ps1';
  const frozen=execFileSync('git',['show','562a04c83f0407a2c395f6a55172b1d8120bd881:'+worker],{cwd:root});
  const reviewed=execFileSync('git',['show','a06c78686c3d3f59be6e6b9e8de65bac072ea515:'+worker],{cwd:root});
  assert.equal(frozen.length,84426);assert.equal(digest(frozen),'d6b9232eb7f25ff3402ea4629345681396085b5a6c309a694099f33371910c02');
  assert.equal(reviewed.length,84855);assert.equal(digest(reviewed),'43d2742d9d680d4ccf1394849b189472f06811ed1455af9da398076acc78465d');
  const idle=bytes=>{
    const begin=Buffer.from('function Assert-FurnitureOfficeIdle {\n'),end=Buffer.from('function Stop-FurnitureLifecycle([string]$Message) {\n');
    const from=bytes.indexOf(begin),to=bytes.indexOf(end);
    assert.ok(from>=0&&to>from);assert.equal(bytes.lastIndexOf(begin),from);assert.equal(bytes.lastIndexOf(end),to);
    const body=bytes.subarray(from,to);assert.equal(bytes.indexOf(body),from);assert.equal(bytes.lastIndexOf(body),from);
    return {from,to,body};
  };
  const originalIdle=idle(frozen),strictIdle=idle(reviewed);
  assert.deepEqual(originalIdle.body,Buffer.from("function Assert-FurnitureOfficeIdle {\n    if(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue) { throw 'POWERPNT.EXE is already running; do not attach to another session' }\n}\n"));
  const replace=(bytes,range,body)=>Buffer.concat([bytes.subarray(0,range.from),body,bytes.subarray(range.to)]);
  const derived=replace(frozen,originalIdle,strictIdle.body);
  assert.deepEqual(derived,reviewed,'Only the reviewed strict idle stage may change the original worker');
  assert.deepEqual(replace(reviewed,strictIdle,originalIdle.body),frozen,'Inverse derivation must preserve every original byte');
  const typeEvidence=execFileSync('git',['show','43f157dbe96c7e5b5b53db44ddbf96a124d3465a:'+worker],{cwd:root});
  assert.equal(typeEvidence.length,86566);assert.equal(digest(typeEvidence),'3d073e9f6fe0432a38e6e1edd2946f32859594f07e9a3590c9bbf5c3d66a2d32');
  const nameTypes=bytes=>{
    const begin=Buffer.from('# Bounded current native chart metadata only: no ChartData, Values setter, Excel or UI.\n'),end=Buffer.from('function Apply-FurnitureAction($Presentation,$Action,[int]$Number) {\n');
    const from=bytes.indexOf(begin),to=bytes.indexOf(end);
    assert.ok(from>=0&&to>from);assert.equal(bytes.lastIndexOf(begin),from);assert.equal(bytes.lastIndexOf(end),to);
    const body=bytes.subarray(from,to);assert.equal(bytes.indexOf(body),from);assert.equal(bytes.lastIndexOf(body),from);
    return {from,to,body};
  };
  const originalTypes=nameTypes(reviewed),observedTypes=nameTypes(typeEvidence),derivedTypes=replace(derived,originalTypes,observedTypes.body);
  assert.deepEqual(derivedTypes,typeEvidence,'Only the immutable reviewed type-observation region may change the strict-idle worker');
  assert.deepEqual(replace(typeEvidence,observedTypes,originalTypes.body),reviewed,'Type-evidence inverse must preserve every strict-idle worker byte');
  const referenceMode=execFileSync('git',['show','fdb175da1160deb9747a8bccb898d79f4dc273a6:'+worker],{cwd:root});
  assert.equal(referenceMode.length,91218);assert.equal(digest(referenceMode),'641c30e6dc9e3e89bae814c752e4fbc1bea41d8318b4f8a0af7e863434466060');
  const referenceAnchors=[
    ['param(\n',"$ErrorActionPreference='Stop'\n"],
    ['function Read-AndValidateActionPlan([string]$Path) {\n','function Get-FurnitureSurveySlideCount([string]$Path) {\n'],
    ['if(-not $Worker) {\n','function Write-FurnitureReport {\n'],
    ['# Bounded current native chart metadata only: no ChartData, Values setter, Excel or UI.\n','function Apply-FurnitureAction($Presentation,$Action,[int]$Number) {\n'],
  ];
  const referenceRange=(bytes,[a,b])=>{
    const begin=Buffer.from(a),end=Buffer.from(b),from=bytes.indexOf(begin),to=bytes.indexOf(end);
    assert.ok(from>=0&&to>from);assert.equal(bytes.lastIndexOf(begin),from);assert.equal(bytes.lastIndexOf(end),to);
    const body=bytes.subarray(from,to);assert.equal(bytes.indexOf(body),from);assert.equal(bytes.lastIndexOf(body),from);return{from,to,body};
  };
  const priorRanges=referenceAnchors.map(anchor=>referenceRange(typeEvidence,anchor)),closedRanges=referenceAnchors.map(anchor=>referenceRange(referenceMode,anchor));
  for(let index=1;index<priorRanges.length;index++){assert.ok(priorRanges[index-1].to<=priorRanges[index].from);assert.ok(closedRanges[index-1].to<=closedRanges[index].from);}
  let derivedReference=derivedTypes,inverseReference=referenceMode;
  for(let index=referenceAnchors.length-1;index>=0;index--){derivedReference=replace(derivedReference,priorRanges[index],closedRanges[index].body);inverseReference=replace(inverseReference,closedRanges[index],priorRanges[index].body);}
  assert.deepEqual(derivedReference,referenceMode,'Only the four immutable reviewed closed-reference regions may extend type diagnostics');
  assert.deepEqual(inverseReference,typeEvidence,'Fourth-stage inverse must preserve every43f type-diagnostic worker byte');
  assert.deepEqual(readFileSync(new URL('../../'+worker,import.meta.url)),derivedReference);
  for(const name of ['packages/pptx/test/native-process.ps1','scripts/native-acceptance/reference-chart-worker.ps1'])assert.deepEqual(readFileSync(new URL('../../'+name,import.meta.url)),execFileSync('git',['show','562a04c83f0407a2c395f6a55172b1d8120bd881:'+name],{cwd:root}));
  const runner=readFileSync(new URL('./run-b07-current-profile.ps1',import.meta.url),'utf8');
  assert.ok(runner.indexOf('if(-not $RunOffice)')<runner.indexOf('$checked=& $node $validator verify-postflight'));
  assert.ok(runner.indexOf('$checked=& $node $validator verify-postflight')<runner.indexOf('$postflightResult=Invoke-ReferenceWitnessPostflight'));
  assert.ok(runner.indexOf('Assert-NativeFileRecords $output $postflightBinding.rows')<runner.indexOf('$postflightResult=Invoke-ReferenceWitnessPostflight'));
  assert.ok(!runner.includes('Stop-Process')&&!runner.includes('New-Object -ComObject'));
});

test('actual Windows AST-only B07 adapter and reviewed observer use injected process/clock callbacks', {skip:process.platform!=='win32'},()=>{
  const script=fileURLToPath(new URL('./b07-postflight-self-test.ps1',import.meta.url));
  const child=spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-File',script],{env:windowsPowerShellEnvironment(process.env),windowsHide:true,encoding:'utf8',timeout:15000});
  assert.equal(child.status,0,child.stdout+child.stderr);
  const result=JSON.parse(child.stdout.replace(/^\uFEFF/u,'').trim());assert.equal(result.officeActivated,false);assert.equal(result.processQueriesAreInjected,true);assert.ok(result.guardRefusals>=20);assert.ok(result.scenarios>=6);
});
