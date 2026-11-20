import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {digest,repositoryIdentity} from './identity.mjs';
import {FURNITURE_POLICY} from './furniture-profile.mjs';
import {LIST_EDIT_ACTION,LIST_EDIT_CASE} from './compare-list-edit.mjs';
import {assertTypedFurnitureCompletion,assertFurnitureComparisonKind,loadFurnitureController,assertFurnitureSemanticPostflight,compareFurnitureSemanticValues,compareInheritedFurniture} from './compare-furniture-profile.mjs';

const PROFILE='full59-ordinary-furniture-lifecycle-v1';
function completion(){const requestSha256='a'.repeat(64);return {binding:{envelope:{profile:PROFILE,selectedCase:{id:'feature-metrics'}},request:{runOfficeRequested:true},requestSha256},runner:{schemaVersion:1,profile:PROFILE,caseId:'feature-metrics',requestSha256,runOfficeRequested:true,status:'lifecycle-observed; semantic-and-visual-review-required',nativeAcceptance:false,registryAcceptance:false}};}
test('real typed completion contract accepts its own fields without a forged legacy runner',()=>{const f=completion();assertTypedFurnitureCompletion(f.binding,f.runner);assert.equal(f.runner.provenance,undefined);assert.equal(f.runner.executingCode,undefined);});
for(const [name,mutate]of Object.entries({pending:f=>{f.runner.status='native-worker-pending';},failed:f=>{f.runner.status='failed; no-retry';},pure:f=>{f.runner.runOfficeRequested=false;},request:f=>{f.binding.request.runOfficeRequested=false;},hash:f=>{f.runner.requestSha256='b'.repeat(64);},case:f=>{f.runner.caseId='layout-empty-custom';},dense:f=>{f.binding.envelope.profile='full59-dense-events-furniture-lifecycle-v1';},claim:f=>{f.runner.nativeAcceptance=true;},legacy:f=>{f.runner.provenance={};}}))test('typed semantic completion refuses '+name,()=>{const f=completion();mutate(f);assert.throws(()=>assertTypedFurnitureCompletion(f.binding,f.runner));});

function postflight(){
 const binding={requestSha256:'a'.repeat(64)},admission={profile:PROFILE,requestSha256:binding.requestSha256,policy:FURNITURE_POLICY};
 const row={schemaVersion:1,sequence:1,utc:'2026-11-11T12:00:00.000Z',elapsedMilliseconds:0,status:'observed',error:null,processIds:[]},bytes=Buffer.from(JSON.stringify(row)+'\n');
 const result={schemaVersion:1,policy:'global-zero-after-completed-owned-quit-v1',budgetMilliseconds:5000,intervalMilliseconds:100,maximumQueries:51,observedZero:true,officeActions:0,sampleCount:1,initialProcessIds:[],initialCount:0,finalProcessIds:[],finalCount:0,elapsedMilliseconds:0,finishedElapsedMilliseconds:0};
 return {binding,admission,bytes,postflight:{policy:FURNITURE_POLICY,error:null,identity:{bytes:bytes.length,sha256:digest(bytes)},initialCount:0,finalCount:0,result}};
}
test('typed semantic bridge keeps the unchanged complete postflight grammar',()=>{const f=postflight();assertFurnitureSemanticPostflight(f.binding,f.admission,f.postflight,f.bytes);for(const mutate of [g=>{g.postflight.error='fault';},g=>{g.postflight.result.maximumQueries=52;},g=>{g.postflight.result.observedZero=false;},g=>{g.postflight.result.officeActions=1;},g=>{g.postflight.identity.sha256='0'.repeat(64);},g=>{g.admission.requestSha256='b'.repeat(64);},g=>{g.bytes=Buffer.from(g.bytes.toString().replace('"sequence":1','"sequence":2'));g.postflight.identity={bytes:g.bytes.length,sha256:digest(g.bytes)};}]){const g=postflight();mutate(g);assert.throws(()=>assertFurnitureSemanticPostflight(g.binding,g.admission,g.postflight,g.bytes));}});

test('semantic action coverage stays explicit; alt/tag/move/untracked style are refusals',()=>{
 for(const actions of [[],[{op:'set-text'}]])assert.equal(assertFurnitureComparisonKind('text',{caseId:'layout-title-auto',actions}).kind,'text');
 for(const op of ['set-alt','set-tag','move-slide','delete-shape','duplicate-shape','set-text-style'])assert.throws(()=>assertFurnitureComparisonKind('text',{caseId:'furniture-inherited',actions:[{op}]}));
 assert.equal(assertFurnitureComparisonKind('fonts',{caseId:'feature-metrics',actions:[],captureTextFonts:true}).kind,'fonts');
 for(const context of [{caseId:'feature-list',actions:[],captureTextFonts:true},{caseId:'feature-metrics',actions:[],captureTextFonts:false},{caseId:'feature-metrics',actions:[{op:'set-text'}],captureTextFonts:true}])assert.throws(()=>assertFurnitureComparisonKind('fonts',context));
 assert.equal(assertFurnitureComparisonKind('list-edit',{caseId:LIST_EDIT_CASE,actions:[LIST_EDIT_ACTION]}).kind,'list-edit');assert.throws(()=>assertFurnitureComparisonKind('list-edit',{caseId:LIST_EDIT_CASE,actions:[{...LIST_EDIT_ACTION,color:'00FF00'}]}));
});
function textValues(){const shape={name:'Metric',text:'42 ms',left:12,top:18,width:72,height:30,rotation:0},phase=()=>({slideCount:1,slides:[{index:1,shapeCount:1,shapes:[{...shape,hasTextFrame:-1}]}]});return {caseId:'feature-metrics',actions:[],expected:[{shapes:[shape]}],report:{schemaVersion:1,cleanupConfirmed:true,officeOperationsStopped:false,error:null,lastStage:'worker.complete',lastStatus:'success',actionPlan:{actions:[],completed:[]},phases:{original:phase(),edited:phase(),reopened:phase()}}};}
test('actual reused text comparison preserves0.02 geometry and current edited/reopened words',()=>{
 const f=textValues();assert.equal(compareFurnitureSemanticValues('text',f).passed,true);const action={op:'set-text',slideIndex:1,shapeName:'Metric',text:'Native 7'};f.actions=[action];f.report.actionPlan={actions:[action],completed:[{index:1,op:'set-text',status:'success'}]};for(const phase of ['edited','reopened'])f.report.phases[phase].slides[0].shapes[0].text='Native 7';assert.equal(compareFurnitureSemanticValues('text',f).passed,true);f.report.phases.reopened.slides[0].shapes[0].text='Stale 7';assert.equal(compareFurnitureSemanticValues('text',f).passed,false);f.report.phases.reopened.slides[0].shapes[0].text='Native 7';f.report.phases.original.slides[0].shapes[0].left+=0.0201;assert.equal(compareFurnitureSemanticValues('text',f).passed,false);
});
test('reused font comparison requires actual requested uniform whole-range descriptors',()=>{
 const f=textValues();f.captureTextFonts=true;f.expected[0].shapes[0].font={name:'Roboto',sizePoints:24,bold:false,italic:false};for(const phase of ['original','edited','reopened'])f.report.phases[phase].slides[0].shapes[0].textFont={status:'uniform',name:'Roboto',sizePoints:24,bold:0,italic:0,unavailableFields:[]};assert.equal(compareFurnitureSemanticValues('fonts',f).passed,true);f.report.phases.reopened.slides[0].shapes[0].textFont.name='Wrong';assert.equal(compareFurnitureSemanticValues('fonts',f).passed,false);delete f.report.phases.reopened.slides[0].shapes[0].textFont;assert.throws(()=>compareFurnitureSemanticValues('fonts',f));
});
test('no generic full-source equality is introduced; the closed list edit retains its strict whole-document check',()=>{
 const source={slides:[{items:[{text:'With a description',description:'about it'},'Unchanged second entry']}]},edited=structuredClone(source);edited.slides[0].items[0].description=[{text:'about it',fontSize:36,color:'#FF0000'}];const shapes=[{name:LIST_EDIT_ACTION.shapeName,text:'about it',hasTextFrame:-1}],phase=()=>({slideCount:1,slides:[{index:1,shapeCount:1,shapes:structuredClone(shapes)}]});
 const f={caseId:LIST_EDIT_CASE,actions:[LIST_EDIT_ACTION],source,original:structuredClone(source),edited,expectedText:[{shapes}],nativeStyle:{text:'about it',fontSize:36,color:'#FF0000'},report:{schemaVersion:1,cleanupConfirmed:true,officeOperationsStopped:false,error:null,lastStage:'worker.complete',lastStatus:'success',actionPlan:{actions:[LIST_EDIT_ACTION],completed:[{index:1,op:'set-text-style',status:'success'}],styleEdits:[{index:1,slideIndex:1,shapeName:LIST_EDIT_ACTION.shapeName,observed:{textBefore:'about it',textAfter:'about it',fontSize:36,color:'FF0000'}}]},phases:{original:phase(),edited:phase(),reopened:phase()}}};assert.equal(compareFurnitureSemanticValues('list-edit',f).passed,true);f.edited.slides[0].items[1]='Unrequested change';assert.throws(()=>compareFurnitureSemanticValues('list-edit',f));const text=textValues();text.source={completely:'different authored provenance is not a generic comparator assertion'};assert.equal(compareFurnitureSemanticValues('text',text).passed,true);
});

function controllerFixture(){
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'opf-semantic-authority-')),controller=path.join(root,'controller'),folder=path.join(controller,'scripts/native-acceptance');fs.mkdirSync(folder,{recursive:true});const sentinel=path.join(root,'imported');
 fs.writeFileSync(path.join(folder,'furniture-profile.mjs'),"import './helper.mjs';\nexport function verifyFurnitureExecution(){throw Error('Synthetic source-admission fixture is never native evidence')}\nexport function admitFurnitureExecution(){throw Error('Synthetic source-admission fixture is never native evidence')}\n");fs.writeFileSync(path.join(folder,'helper.mjs'),`import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(sentinel)},'source imported',{flag:'wx'});\n`);
 const git=args=>execFileSync('git',args,{cwd:controller,encoding:'utf8',stdio:['ignore','pipe','pipe']});git(['init','-q']);git(['add','.']);git(['-c','user.name=OPF fixture','-c','user.email=fixture@example.invalid','commit','-qm','Source admission only']);
 const envelope={profile:PROFILE,controller:repositoryIdentity(controller,['scripts/native-acceptance/furniture-profile.mjs','scripts/native-acceptance/helper.mjs'])},envelopeFile=path.join(root,'envelope.json');
 function options(){const bytes=Buffer.from(JSON.stringify(envelope));fs.writeFileSync(envelopeFile,bytes);return {controller,expectedControllerSha:envelope.controller.revision,envelopeFile,envelopeSha256:digest(bytes)};}
 return {root,controller,sentinel,envelope,envelopeFile,options};
}
test('pinned frozen-controller source is checked before import, independently of analysis ROOT',async()=>{
 const f=controllerFixture();let passed=false;try{const loaded=await loadFurnitureController(f.options());assert.equal(typeof loaded.module.verifyFurnitureExecution,'function');assert.equal(fs.readFileSync(f.sentinel,'utf8'),'source imported');passed=true;}finally{if(passed)fs.rmSync(f.root,{recursive:true,force:true});else console.error('Preserved failing source fixture: '+f.root);}
});
for(const mode of ['wrong-envelope-hash','wrong-revision','foreign-controller','dirty-controller','unsealed-import','changed-file-record','duplicate-record','foreign-profile'])test('refuse '+mode+' before any controller module evaluation',async()=>{
 const f=controllerFixture();let passed=false;try{let options=f.options();
 if(mode==='wrong-envelope-hash')options.envelopeSha256='0'.repeat(64);
 if(mode==='wrong-revision')options.expectedControllerSha='0'.repeat(40);
 if(mode==='foreign-controller')options.controller=f.root;
 if(mode==='dirty-controller')fs.appendFileSync(path.join(f.controller,'scripts/native-acceptance/helper.mjs'),'// dirty\n');
 if(mode==='unsealed-import'){f.envelope.controller.files.pop();options=f.options();}
 if(mode==='changed-file-record'){f.envelope.controller.files[0].sha256='0'.repeat(64);options=f.options();}
 if(mode==='duplicate-record'){f.envelope.controller.files.push(structuredClone(f.envelope.controller.files[0]));options=f.options();}
 if(mode==='foreign-profile'){f.envelope.profile='full59-dense-events-furniture-lifecycle-v1';options=f.options();}
 await assert.rejects(()=>loadFurnitureController(options));assert.equal(fs.existsSync(f.sentinel),false);passed=true;
 }finally{if(passed)fs.rmSync(f.root,{recursive:true,force:true});else console.error('Preserved failing source fixture: '+f.root);}
});


const furnitureActionSource=new URL('./fixtures/actions/furniture-inherited.json',import.meta.url);
const furnitureActionBytes=fs.readFileSync(furnitureActionSource),furnitureActions=JSON.parse(furnitureActionBytes);
function inheritedFurniture(){
 const shape=(index,name,text)=>({index,id:100+index,name,type:17,left:12+index,top:30,width:160,height:24,rotation:0,hasTextFrame:-1,text,alternativeText:'Original alt '+name,tags:[{index:1,name:'KEPT',value:'opaque'}],unknownCaptured:{keep:true}});
 const slides=[
  {index:1,slideId:101,name:'Slide one',tags:[{index:1,name:'SLIDE',value:'one'}],shapeCount:2,shapes:[shape(1,furnitureActions[0].shapeName,'Original furniture text'),shape(2,'Unchanged first-slide label','Other first')]},
  {index:2,slideId:102,name:'Slide two',tags:[],shapeCount:2,shapes:[{...shape(1,furnitureActions[1].shapeName,null),type:13,hasTextFrame:0},shape(2,'Unchanged second-slide label','Other second')]},
  {index:3,slideId:103,name:'Slide three',tags:[],shapeCount:1,shapes:[shape(1,'Unchanged third-slide label','Other third')]},
 ];
 const edited=structuredClone([slides[2],slides[0],slides[1]]);edited[0].index=1;edited[1].index=2;edited[2].index=3;edited[1].shapes[0].text='';edited[2].shapes[0].alternativeText='Native edited furniture picture alt';
 return {caseId:'furniture-inherited',actions:structuredClone(furnitureActions),report:{schemaVersion:1,cleanupConfirmed:true,officeOperationsStopped:false,error:null,lastStage:'worker.complete',lastStatus:'success',actionPlan:{actions:structuredClone(furnitureActions),completed:furnitureActions.map((action,index)=>({index:index+1,op:action.op,status:'success'})),styleEdits:[],chartPoints:[],chartSeriesEdits:[]},phases:{original:{slideCount:3,slides},edited:{slideCount:3,slides:edited},reopened:{slideCount:3,slides:structuredClone(edited)}}}};
}
test('closed source-bound furniture actions preserve all captured native fields and real slide identities',()=>{
 assert.deepEqual(furnitureActions.map(action=>action.op),['set-text','set-alt','move-slide']);assert.equal(furnitureActions.length,3);const f=inheritedFurniture(),before=structuredClone(f);const result=compareFurnitureSemanticValues('furniture-inherited',f);assert.equal(result.passed,true);assert.equal(result.sourceActionSha256,digest(furnitureActionBytes));assert.deepEqual(result.originalSlideIds,[101,102,103]);assert.deepEqual(result.editedSlideIds,[103,101,102]);assert.deepEqual(f,before,'Comparator must not mutate retained observations');assert.equal(result.visualAcceptance,false);assert.equal(result.nativeAcceptance,false);
});
for(const [name,mutate]of Object.entries({
 'wrong alt':f=>{f.report.phases.edited.slides[2].shapes[0].alternativeText='Wrong';},
 'wrong move':f=>{const slides=structuredClone(f.report.phases.original.slides);slides[0].shapes[0].text='';slides[1].shapes[0].alternativeText=furnitureActions[1].alt;f.report.phases.edited.slides=slides;},
 'wrong order':f=>{f.report.phases.reopened.slides[1].shapes.reverse();f.report.phases.reopened.slides[1].shapes.forEach((shape,index)=>{shape.index=index+1;});},
 'stale empty text':f=>{f.report.phases.reopened.slides[1].shapes[0].text='Original furniture text';},
 'wrong slide ID':f=>{f.report.phases.edited.slides[0].slideId=999;},
 'wrong slide name':f=>{f.report.phases.edited.slides[0].name='Renamed';},
 'changed shape ID':f=>{f.report.phases.edited.slides[0].shapes[0].id++;},
 'changed geometry':f=>{f.report.phases.reopened.slides[0].shapes[0].left+=0.00001;},
 'changed other words':f=>{f.report.phases.edited.slides[1].shapes[1].text='Unrequested';},
 'changed tags':f=>{f.report.phases.edited.slides[1].shapes[0].tags=[];},
 'dropped unknown capture':f=>{delete f.report.phases.reopened.slides[0].shapes[0].unknownCaptured;},
 'unrequested style effect':f=>{f.report.actionPlan.styleEdits=[{}];},
 'incomplete actions':f=>{f.report.actionPlan.completed.pop();},
 'missing original field':f=>{delete f.report.phases.original.slides[0].shapes[0].rotation;},
 'extra slide':f=>{f.report.phases.reopened.slides.push(structuredClone(f.report.phases.reopened.slides[0]));},
}))test('closed furniture effects refuse '+name,()=>{const f=inheritedFurniture();mutate(f);assert.throws(()=>compareInheritedFurniture(f));});
test('furniture coverage refuses another case or any changed/reordered/extra source action',()=>{
 for(const mutate of [f=>{f.caseId='layout-title-auto';},f=>{f.actions[0].text='Not empty';},f=>{f.actions[1].alt='Wrong requested alt';},f=>{f.actions[2].toIndex=2;},f=>{f.actions.reverse();},f=>{f.actions.push({op:'set-tag'});},f=>{f.actions[0].extra=true;}]){const f=inheritedFurniture();mutate(f);assert.throws(()=>compareInheritedFurniture(f));}
 const f=inheritedFurniture();assert.throws(()=>compareFurnitureSemanticValues('text',f));assert.throws(()=>assertFurnitureComparisonKind('furniture-inherited',{caseId:'furniture-inherited',actions:[]}));
});
