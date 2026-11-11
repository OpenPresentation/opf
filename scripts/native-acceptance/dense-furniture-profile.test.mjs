import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {digest} from './identity.mjs';
import {windowsPowerShellEnvironment} from './windows-powershell-env.mjs';
import {FURNITURE_PROFILE,FURNITURE_POLICY,FULL59_CASE_IDS,assertFurnitureReady as ordinaryReady,assertFurnitureSelection as ordinarySelection} from './furniture-profile.mjs';
import {DENSE_FURNITURE_PROFILE,DENSE_FURNITURE_POLICY,assertFurnitureReady,assertFurnitureSelection,bindFurnitureEnvelope} from './dense-furniture-profile.mjs';
import {furnitureFixture,writeFurnitureFixture} from './furniture-control-fixture.mjs';
import {inspectDenseArchive} from './dense-survey-contract.mjs';

const root=fs.realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
const wire=e=>Buffer.from(e.stages.map(s=>JSON.stringify(s)).join('\n')+'\n');
const admit=e=>assertFurnitureReady(e.terminal,e.report,e.request,wire(e));
function fixture(output=path.join(root,'synthetic-dense-never-office')){
 const e=furnitureFixture(output);
 Object.assign(e.request,{profile:DENSE_FURNITURE_PROFILE,policy:structuredClone(DENSE_FURNITURE_POLICY),caseId:'feature-dense-events',readOnlySurvey:true});
 e.report.readOnlySurvey=true;Object.assign(e.report.actionPlan,{styleEdits:[],chartPoints:[],chartSeriesEdits:[]});
 for(const phase of ['original','edited','reopened']){const slide=e.report.phases[phase].slides[0];slide.shapes=Array.from({length:50},(_,i)=>({index:i+1,name:'Synthetic dense '+i}));slide.shapeCount=50;}
 Object.assign(e.admission,{profile:DENSE_FURNITURE_PROFILE,policy:structuredClone(DENSE_FURNITURE_POLICY),ready:admit(e),requestSha256:digest(Buffer.from(JSON.stringify(e.request,null,2)+'\n'))});return e;
}
function suite(){return {schemaVersion:1,nativeAcceptance:false,provenance:{nativeAcceptance:false,registryAcceptance:false},cases:FULL59_CASE_IDS.map(id=>({id,worker:'furniture',automaticControlEligible:id!=='feature-dense-events',slideCount:1}))};}

test('closed dense ready admits exact50 only and retains all18 ordinary lifecycle facts',()=>{const e=fixture(),r=admit(e);assert.equal(r.lifecycle.length,18);assert.equal(r.caseId,'feature-dense-events');assert.equal(r.actionCount,0);assert.equal(DENSE_FURNITURE_POLICY.maximumQueries,51);assert.equal(DENSE_FURNITURE_POLICY.observerSourceSha256,FURNITURE_POLICY.observerSourceSha256);});
for(const phase of ['original','edited','reopened'])for(const count of [49,51])test(`dense ${phase} requires50 actual shapes, refuses${count}`,()=>{const e=fixture(),slide=e.report.phases[phase].slides[0];slide.shapes=Array(count).fill({});slide.shapeCount=count;assert.throws(()=>admit(e));});
const mutants={
 'ordinary case':e=>{e.request.caseId='feature-metrics';},
 'ordinary profile':e=>{e.request.profile=FURNITURE_PROFILE;},
 'ordinary policy':e=>{e.request.policy=FURNITURE_POLICY;},
 'survey false':e=>{e.request.readOnlySurvey=false;e.report.readOnlySurvey=false;},
 'two slides':e=>{e.report.phases.original.slides.push(structuredClone(e.report.phases.original.slides[0]));e.report.phases.original.slideCount=2;},
 'action':e=>{e.request.actionPlan.actions=[{op:'set-text'}];},
 'completion':e=>{e.report.actionPlan.completed=[{index:1,op:'set-text',status:'success'}];},
 'style edit':e=>{e.report.actionPlan.styleEdits=[{}];},
 'font capture':e=>{e.request.captureTextFonts=true;e.report.captureTextFonts=true;},
 'nonzero preflight':e=>{e.report.globalPreflight.count=1;},
 'foreign owner':e=>{e.stages.find(s=>s.stage==='input.presentation.open'&&s.status==='success').ownedPresentationPath='foreign';},
 'object ordinary owner':e=>{e.stages[0].ownedPresentationPath={foreign:true};},
 'missing create':e=>{e.stages=e.stages.filter(s=>s.stage!=='application.create');e.stages.forEach((s,i)=>{s.sequence=i+1;});},
 'create before preflight':e=>{const rows=e.stages.filter(s=>s.stage==='application.create');e.stages=e.stages.filter(s=>s.stage!=='application.create');e.stages.splice(1,0,...rows);e.stages.forEach((s,i)=>{s.sequence=i+1;});},
 'missing Quit':e=>{e.stages=e.stages.filter(s=>s.stage!=='application.cleanup.quit');e.stages.forEach((s,i)=>{s.sequence=i+1;});},
 'timeout':e=>{e.terminal.timedOut=true;},
 'fault latch':e=>{e.report.officeOperationsStopped=true;},
};
for(const [name,mutate]of Object.entries(mutants))test('dense ready refuses '+name,()=>{const e=fixture();mutate(e);assert.throws(()=>admit(e));});
test('dense8192 row bound retains wire/owner guards; ordinary5000 bound is unchanged',()=>{
 const e=fixture(),template=e.stages.find(s=>s.stage==='input.presentation.readOnly.get'&&s.status==='success'),padding=Array.from({length:8192-e.stages.length},(_,i)=>({...template,stage:'original.bound-inspection-'+i}));const at=e.stages.findIndex(s=>s.stage==='edited.presentation.saveCopyAs'&&s.status==='begin');e.stages.splice(at,0,...padding);e.stages.forEach((s,i)=>{s.sequence=i+1;});assert.equal(admit(e).stageCount,8192);
 const ordinary=furnitureFixture();ordinary.stages=e.stages;assert.throws(()=>ordinaryReady(ordinary.terminal,ordinary.report,ordinary.request,wire(ordinary)));
 e.stages[at].ownedPresentationPath='foreign';assert.throws(()=>admit(e));e.stages[at].ownedPresentationPath=template.ownedPresentationPath;e.stages[at].sequence=1;assert.throws(()=>admit(e));e.stages[at].sequence=at+1;e.stages[at].error='fault';assert.throws(()=>admit(e));e.stages[at].error='';e.stages.splice(at,0,{...template,stage:'original.over-bound'});e.stages.forEach((s,i)=>{s.sequence=i+1;});assert.throws(()=>admit(e));
});
test('ordinary selection/ready retain their closed profile and3/30/20 limits',()=>{const s=suite();assert.throws(()=>ordinarySelection(s,'feature-dense-events',[]));assert.throws(()=>ordinaryReady(fixture().terminal,fixture().report,fixture().request,wire(fixture())));const e=furnitureFixture();e.report.phases.original.slides[0].shapes=Array(31).fill({});e.report.phases.original.slides[0].shapeCount=31;assert.throws(()=>ordinaryReady(e.terminal,e.report,e.request,wire(e)));assert.throws(()=>ordinarySelection(s,'feature-metrics',Array(21).fill({})));});
test('dense selection keeps59 roster and false generic eligibility; case/actions/crossroute refuse',()=>{const s=suite();assert.equal(assertFurnitureSelection(s,'feature-dense-events',[]).automaticControlEligible,false);for(const [name,actions]of [['feature-metrics',[]],['feature-dense-events',[{}]]])assert.throws(()=>assertFurnitureSelection(s,name,actions));s.cases.find(c=>c.id==='feature-dense-events').automaticControlEligible=true;assert.throws(()=>assertFurnitureSelection(s,'feature-dense-events',[]));s.cases.pop();assert.throws(()=>assertFurnitureSelection(s,'feature-dense-events',[]));});
test('existing bounded archive inspector enforces50 physical source shapes, not survey100',()=>{
 const local=createRequire(import.meta.url),pptx=createRequire(local.resolve('@openpresentation/opf-pptx/package.json')),deps={...pptx('fflate'),...pptx('fast-xml-parser')};
 const input=fs.readFileSync(new URL('./fixtures/dense-survey/input.pptx',import.meta.url));assert.equal(inspectDenseArchive(input,deps).shapeCount,50);
 const original=deps.unzipSync(input),xml=deps.strFromU8(original['ppt/slides/slide1.xml']);const first=xml.match(/<p:sp>.*?<\/p:sp>/su)?.[0];assert.ok(first);
 for(const current of [xml.replace(first,''),xml.replace('</p:spTree>',first+'</p:spTree>')]){const parts={...original,'ppt/slides/slide1.xml':deps.strToU8(current)};assert.throws(()=>inspectDenseArchive(deps.zipSync(parts),deps),/exactly50/);}
});
test('dense production envelope reader still refuses identity drift before source access',()=>{const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'opf-dense-wire-'));try{const file=path.join(dir,'envelope.json'),bytes=Buffer.from(JSON.stringify({schemaVersion:1,profile:FURNITURE_PROFILE}));fs.writeFileSync(file,bytes);assert.throws(()=>bindFurnitureEnvelope(file,'0'.repeat(64)));assert.throws(()=>bindFurnitureEnvelope(file,digest(bytes)));fs.appendFileSync(file,' ');assert.throws(()=>bindFurnitureEnvelope(file,digest(bytes)));}finally{fs.rmSync(dir,{recursive:true,force:true});}});

test('actual Windows PS5 dense exact50 typed bridge/default-delegate controls; no Office/process queries',t=>{
 if(process.platform!=='win32'){t.skip('Actual Windows PS5 controls remain separate');return;}
 const cases=['zero','absent','drain','timeout','kernel-timeout','worker-budget','pending','fault','missing-quit','wrong-owner','begin-object-owner','begin-foreign-owner','ordinary-object-owner','ordinary-foreign-owner','original-owner-object','saved-owner-object','crossed-open-begin','crossed-create-begin','missing-create','duplicate-create','create-before-preflight','case-id','unfinished-action','artifact-drift','query-fault','query-prefix','deadline','busy','new-pid','append-fault',...['original','edited','reopened'].flatMap(p=>[49,51].map(n=>`shapes-${p}-${n}`)),'dense-two-slides','dense-survey-false','dense-fonts','dense-completed','dense-ordinary-profile','dense-ordinary-policy','dense-stages-8192','dense-stages-8193'];
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'opf-dense-furn-'));let passed=false;
 try{for(const name of cases){const output=path.join(dir,name);writeFurnitureFixture(output,fixture(output));}fs.writeFileSync(path.join(dir,'context.json'),JSON.stringify({synthetic:true,nativeAcceptance:false,profile:DENSE_FURNITURE_PROFILE,controllerRoot:root,cases}));
  const run=spawnSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',path.join(root,'scripts/native-acceptance/furniture-postflight-self-test.ps1'),'-FixtureRoot',dir,'-DenseEvents'],{encoding:'utf8',env:windowsPowerShellEnvironment(process.env),timeout:60000,maxBuffer:4*1024*1024});
  assert.ifError(run.error);assert.equal(run.status,0,run.stdout+'\n'+run.stderr);const result=JSON.parse(run.stdout.trim());assert.equal(cases.length,44);assert.equal(result.controls,44);assert.equal(result.failed,0);assert.equal(result.realProcessQueries,0);assert.equal(result.officeActions,0);passed=true;
 }finally{if(passed){fs.rmSync(dir,{recursive:true,force:true});}else{console.error('Preserved failing dense managed fixture: '+dir);}}
});
