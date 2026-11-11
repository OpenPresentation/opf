import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import {digest} from './identity.mjs';
import {spawnSync} from 'node:child_process';
import {windowsPowerShellEnvironment} from './windows-powershell-env.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertFurnitureReady,assertFurnitureSelection,bindFurnitureEnvelope,FURNITURE_POLICY,FULL59_CASE_IDS} from './furniture-profile.mjs';
import {furnitureFixture,writeFurnitureFixture} from './furniture-control-fixture.mjs';
const wire=e=>Buffer.from(e.stages.map(s=>JSON.stringify(s)).join('\n')+'\n');
const admit=e=>assertFurnitureReady(e.terminal,e.report,e.request,wire(e));
const renumber=e=>{e.stages.forEach((row,index)=>{row.sequence=index+1;});};
function inspection(e){const position=e.stages.findIndex(row=>row.stage==='edited.presentation.saveCopyAs'&&row.status==='begin');const template=e.stages.find(row=>row.stage==='input.presentation.readOnly.get'&&row.status==='success');const rows=['begin','success'].map(status=>({...template,stage:'original.slide-1.get',status}));e.stages.splice(position,0,...rows);renumber(e);return rows;}
function crossBegin(e,name){const before=e.stages.filter(row=>row.status==='success').map(row=>row.stage);const index=e.stages.findIndex(row=>row.stage===name&&row.status==='begin');const [row]=e.stages.splice(index,1);e.stages.splice(e.stages.findIndex(s=>s.stage==='preflight.globalIdle'&&s.status==='success'),0,row);renumber(e);assert.deepEqual(e.stages.filter(s=>s.status==='success').map(s=>s.stage),before,'Mutation must preserve every critical success order');}

test('actual furniture wire is admitted without synthetic Seven/table values or counters',()=>{const e=furnitureFixture();assert.equal(admit(e).stageCount,e.stages.length);assert.equal(e.stages[0].value,undefined);assert.equal(e.report.opens,undefined);});
test('one exact nonempty sealed plan has one completion record and retains phase observations',()=>{const e=furnitureFixture(),action={op:'set-text',slideIndex:1,shapeName:'Synthetic',text:'Edited'};e.request.actionPlan.actions=[action];e.report.actionPlan.actions=[structuredClone(action)];e.report.actionPlan.completed=[{index:1,op:action.op,status:'success'}];assert.equal(admit(e).actionCount,1);e.report.actionPlan.completed[0].index=2;assert.throws(()=>admit(e));});
test('ordinary begin/success records with exact bound path strings remain admitted',()=>{const e=furnitureFixture();inspection(e);assert.equal(admit(e).stageCount,e.stages.length);});
const mutants={
 'begin object owner':e=>{e.stages.find(s=>s.stage==='input.presentation.open'&&s.status==='begin').ownedPresentationPath={foreign:true};},
 'begin foreign owner':e=>{e.stages.find(s=>s.stage==='input.presentation.open'&&s.status==='begin').ownedPresentationPath='foreign';},
 'ordinary object owner':e=>{inspection(e)[0].ownedPresentationPath={foreign:true};},
 'ordinary foreign owner':e=>{inspection(e)[1].ownedPresentationPath='foreign';},
 'original owner is object':e=>{e.report.source.openedPath={};},'saved owner is object':e=>{e.report.saved.path={};},
 'crossed open begin':e=>crossBegin(e,'input.presentation.open'),
 'crossed create begin':e=>crossBegin(e,'application.create'),
 'missing create':e=>{e.stages=e.stages.filter(s=>s.stage!=='application.create');renumber(e);},
 'duplicate create':e=>{const at=e.stages.findIndex(s=>s.stage==='application.create');e.stages.splice(at,0,...e.stages.filter(s=>s.stage==='application.create').map(s=>({...s})));renumber(e);},
 'create before preflight':e=>{const create=e.stages.filter(s=>s.stage==='application.create');e.stages=e.stages.filter(s=>s.stage!=='application.create');const at=e.stages.findIndex(s=>s.stage==='preflight.globalIdle');e.stages.splice(at,0,...create);renumber(e);},
 'worker budget':e=>{e.request.timeoutSeconds=61;},'native claim':e=>{e.request.nativeAcceptance=true;},'timeout':e=>{e.terminal.timedOut=true;},'nonzero worker':e=>{e.terminal.exitCode=1;},'pending terminal':e=>{e.terminal.lastDurableStatus='begin';},'missing Quit':e=>{e.stages=e.stages.filter(s=>s.stage!=='application.cleanup.quit');e.stages.forEach((s,i)=>{s.sequence=i+1;});},
 'duplicate critical begin':e=>{const row=structuredClone(e.stages.find(s=>s.stage==='preflight.globalIdle'&&s.status==='begin'));e.stages.splice(2,0,row);e.stages.forEach((s,i)=>{s.sequence=i+1;});},'missing critical begin':e=>{e.stages=e.stages.filter(s=>!(s.stage==='input.presentation.open'&&s.status==='begin'));e.stages.forEach((s,i)=>{s.sequence=i+1;});},'query proof missing':e=>{delete e.report.globalPreflight;},'nonzero global proof':e=>{e.report.globalPreflight.count=1;},'string global proof':e=>{e.report.globalPreflight.count='0';},'fault latch':e=>{e.report.officeOperationsStopped=true;},'nonempty error':e=>{e.stages[2].error='failure';},'whitespace error':e=>{e.stages[2].error=' ';},'false error':e=>{e.stages[2].error=false;},'numeric error':e=>{e.stages[2].error=0;},'object error':e=>{e.stages[2].error={};},
 'missing error field':e=>{delete e.stages[2].error;},'bad sequence':e=>{e.stages[2].sequence=1;},'backward clock':e=>{e.stages.at(-1).timestamp='2025-01-01T00:00:00Z';},'failed cleanup':e=>{e.report.cleanupConfirmed=false;},'foreign open owner':e=>{e.stages.find(s=>s.stage==='input.presentation.open'&&s.status==='success').ownedPresentationPath='foreign';},'foreign reopen owner':e=>{e.stages.find(s=>s.stage==='reopen.presentation.open'&&s.status==='success').ownedPresentationPath='foreign';},'owned path after quit':e=>{e.stages.at(-1).ownedPresentationPath='foreign';},'extra stage field':e=>{e.stages[1].value=null;},
 'foreign case':e=>{e.request.caseId='unreviewed';},'wrong profile':e=>{e.request.profile='seven-chart-original-readonly-v2';},'late deadline policy':e=>{e.request.policy={...FURNITURE_POLICY,budgetMilliseconds:5001};},'survey widened':e=>{e.request.readOnlySurvey=true;},'wrong font flag':e=>{e.request.captureTextFonts=true;},'missing phase':e=>{delete e.report.phases.reopened;},'too many slides':e=>{e.report.phases.original.slides=Array(4).fill({shapes:[]});},'too many shapes':e=>{e.report.phases.original.slides[0].shapes=Array(31).fill({});},'unexpected completion':e=>{e.report.actionPlan.completed=[{index:1,op:'set-text',status:'success'}];},'unrequested action':e=>{e.report.actionPlan.actions=[{op:'set-text'}];},
};
for(const [name,mutate]of Object.entries(mutants))test('furniture ready refuses '+name,()=>{const e=furnitureFixture();mutate(e);assert.throws(()=>admit(e));});
test('ordinary selection preserves dedicated refusals and source limits',()=>{const cases=FULL59_CASE_IDS.map(id=>({id,worker:'furniture',automaticControlEligible:true,slideCount:1}));const suite={schemaVersion:1,nativeAcceptance:false,provenance:{nativeAcceptance:false,registryAcceptance:false},cases};assert.equal(assertFurnitureSelection(suite,'feature-metrics',[]),cases.find(c=>c.id==='feature-metrics'));for(const name of ['chart-all-seven','table-colors','feature-dense-events']){const s=structuredClone(suite);assert.throws(()=>assertFurnitureSelection(s,name,[]));}for(const count of [0,4]){const s=structuredClone(suite);s.cases.find(c=>c.id==='feature-metrics').slideCount=count;assert.throws(()=>assertFurnitureSelection(s,'feature-metrics',[]));}assert.throws(()=>assertFurnitureSelection(suite,'feature-metrics',Array(21).fill({})));});
test('production envelope reader rejects file identity drift and unsupported closed keys before source access',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'opf-furn-wire-')),file=path.join(dir,'envelope.json');
 try{const bytes=Buffer.from(JSON.stringify({schemaVersion:1,profile:'foreign'}));fs.writeFileSync(file,bytes);assert.throws(()=>bindFurnitureEnvelope(file,'0'.repeat(64)));assert.throws(()=>bindFurnitureEnvelope(file,digest(bytes)));fs.appendFileSync(file,' ');assert.throws(()=>bindFurnitureEnvelope(file,digest(bytes)));}finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('actual Windows PS5 furniture managed default-delegate controls; no Office/process queries',t=>{
 if(process.platform!=='win32'){t.skip('Actual Windows PS5 controls remain separate');return;}
 const root=fileURLToPath(new URL('../../',import.meta.url)),dir=fs.mkdtempSync(path.join(os.tmpdir(),'opf-furn-'));
 const cases=['zero','absent','drain','timeout','kernel-timeout','worker-budget','pending','fault','missing-quit','wrong-owner','begin-object-owner','begin-foreign-owner','ordinary-object-owner','ordinary-foreign-owner','original-owner-object','saved-owner-object','crossed-open-begin','crossed-create-begin','missing-create','duplicate-create','create-before-preflight','case-id','unfinished-action','artifact-drift','query-fault','query-prefix','deadline','busy','new-pid','append-fault'];
 let passed=false;
 try{for(const name of cases)writeFurnitureFixture(path.join(dir,name));fs.writeFileSync(path.join(dir,'context.json'),JSON.stringify({synthetic:true,nativeAcceptance:false,controllerRoot:root,cases}));
  const run=spawnSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',path.join(root,'scripts/native-acceptance/furniture-postflight-self-test.ps1'),'-FixtureRoot',dir],{encoding:'utf8',env:windowsPowerShellEnvironment(process.env),timeout:60000,maxBuffer:4*1024*1024});
  assert.ifError(run.error);assert.equal(run.status,0,run.stdout+'\n'+run.stderr);const result=JSON.parse(run.stdout.trim());assert.equal(result.controls,cases.length);assert.equal(result.failed,0);assert.equal(result.realProcessQueries,0);assert.equal(result.officeActions,0);passed=true;
 }finally{if(passed){fs.rmSync(dir,{recursive:true,force:true});}else{console.error('Preserved failing furniture managed fixture: '+dir);}}
});
