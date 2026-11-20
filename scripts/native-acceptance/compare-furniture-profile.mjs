// Offline semantic checks for a completed, separately pinned ordinary furniture controller.
// Never replace its receipt/provenance with a legacy runner record or current ROOT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {digest,fileIdentity,repositoryIdentity} from './identity.mjs';
import {canonicalOwnedPath,readOwnedFile,readOwnedJson,assertOwnedKeys,ownedControllerFiles} from './owned-postflight.mjs';
import {assertReferenceWitnessPostflight} from './reference-chart-profile.mjs';
import {compareTextObservations,exportedTextShapes} from './compare-text.mjs';
import {compareUniformTextFonts,explicitUniformTextFonts} from './compare-text-fonts.mjs';
import {compareListEditSemantics,nativeListDescription,LIST_EDIT_CASE,LIST_EDIT_ACTION} from './compare-list-edit.mjs';

const ROOT=fs.realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
const PROFILE='full59-ordinary-furniture-lifecycle-v1';
const CONTROLLER_ENTRY='scripts/native-acceptance/furniture-profile.mjs';
const FURNITURE_ACTION_SOURCE='scripts/native-acceptance/fixtures/actions/furniture-inherited.json';
const furnitureActionBytes=readOwnedFile(path.join(ROOT,FURNITURE_ACTION_SOURCE),4194304);
const FURNITURE_ACTIONS=Object.freeze(JSON.parse(furnitureActionBytes.toString('utf8')).map(action=>Object.freeze(action)));
const MODES=Object.freeze(['text','fonts','list-edit','furniture-inherited']);
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const keys=assertOwnedKeys;

export function assertTypedFurnitureCompletion(binding,runner){
 keys(runner,['schemaVersion','profile','caseId','requestSha256','runOfficeRequested','status','nativeAcceptance','registryAcceptance']);
 assert.equal(binding.envelope.profile,PROFILE);assert.equal(runner.schemaVersion,1);assert.equal(runner.profile,PROFILE);assert.equal(runner.caseId,binding.envelope.selectedCase.id);assert.equal(runner.requestSha256,binding.requestSha256);
 assert.equal(runner.runOfficeRequested,true);assert.equal(binding.request.runOfficeRequested,true);assert.equal(runner.status,'lifecycle-observed; semantic-and-visual-review-required');assert.equal(runner.nativeAcceptance,false);assert.equal(runner.registryAcceptance,false);
}
export function assertFurnitureComparisonKind(kind,{caseId,actions,captureTextFonts}){
 assert.ok(MODES.includes(kind),'Choose an explicit supported semantic kind');assert.ok(Array.isArray(actions)&&actions.length<=20);
 if(kind==='text'){for(const action of actions)assert.equal(action.op,'set-text','Text comparison refuses unsupported actions');}
 else if(kind==='fonts'){assert.equal(caseId,'feature-metrics');assert.equal(captureTextFonts,true);assert.deepEqual(actions,[]);}
 else if(kind==='list-edit'){assert.equal(caseId,LIST_EDIT_CASE);assert.deepEqual(actions,[LIST_EDIT_ACTION]);}
 else{assert.equal(caseId,'furniture-inherited');assert.deepEqual(actions,FURNITURE_ACTIONS,'Exact sealed furniture action plan required');}
 return {kind,caseId,actions:actions.map(action=>action.op)};
}

// One sealed three-operation case, not a general native action interpreter.
export function compareInheritedFurniture({caseId,actions,report}){
 assertFurnitureComparisonKind('furniture-inherited',{caseId,actions});
 assert.equal(report.schemaVersion,1);assert.deepEqual(report.actionPlan.actions,actions);assert.deepEqual(report.actionPlan.completed,actions.map((action,i)=>({index:i+1,op:action.op,status:'success'})));
 for(const name of ['styleEdits','chartPoints','chartSeriesEdits'])assert.deepEqual(report.actionPlan[name],[],'Unexpected furniture action record '+name);
 assert.equal(report.cleanupConfirmed,true);assert.equal(report.officeOperationsStopped,false);assert.equal(report.error,null);assert.equal(report.lastStage,'worker.complete');assert.equal(report.lastStatus,'success');
 const original=report.phases.original;assert.equal(original.slideCount,3);assert.ok(Array.isArray(original.slides));assert.equal(original.slides.length,3);
 const ids=new Set();for(const [index,slide]of original.slides.entries()){
  for(const name of ['index','slideId','name','tags','shapeCount','shapes'])assert.ok(Object.hasOwn(slide,name),'Missing captured slide '+name);
  assert.equal(slide.index,index+1);assert.ok(Number.isInteger(slide.slideId)&&slide.slideId>0&&!ids.has(slide.slideId));ids.add(slide.slideId);assert.equal(typeof slide.name,'string');assert.ok(Array.isArray(slide.tags)&&Array.isArray(slide.shapes)&&slide.shapes.length<=30);assert.equal(slide.shapeCount,slide.shapes.length);
  const names=new Set();for(const [shapeIndex,shape]of slide.shapes.entries()){
   for(const name of ['index','id','name','type','left','top','width','height','rotation','hasTextFrame','text','alternativeText','tags'])assert.ok(Object.hasOwn(shape,name),'Missing captured shape '+name);
   assert.equal(shape.index,shapeIndex+1);assert.equal(typeof shape.name,'string');assert.ok(shape.name.length&&!names.has(shape.name));names.add(shape.name);
   for(const name of ['id','type','left','top','width','height','rotation'])assert.ok(typeof shape[name]==='number'&&Number.isFinite(shape[name]),'Missing captured numeric '+name);
   assert.ok([-1,0].includes(shape.hasTextFrame));assert.ok(shape.text===null||typeof shape.text==='string');assert.equal(typeof shape.alternativeText,'string');assert.ok(Array.isArray(shape.tags));
  }
 }
 const expected=structuredClone(original.slides),[clear,alt]=actions;
 const textTargets=expected[clear.slideIndex-1].shapes.filter(shape=>shape.name===clear.shapeName),altTargets=expected[alt.slideIndex-1].shapes.filter(shape=>shape.name===alt.shapeName);assert.equal(textTargets.length,1);assert.equal(altTargets.length,1);assert.notEqual(textTargets[0].hasTextFrame,0);assert.equal(typeof textTargets[0].text,'string');
 textTargets[0].text=clear.text;altTargets[0].alternativeText=alt.alt;
 // Exact reviewed MoveTo(1) of original slide3: preserve captured IDs/fields,
 // change only its position and all three current positional indices.
 const moved=[expected[2],expected[0],expected[1]];moved.forEach((slide,index)=>{slide.index=index+1;});
 for(const phase of ['edited','reopened']){assert.equal(report.phases[phase].slideCount,3);assert.deepEqual(report.phases[phase].slides,moved,phase+': unexpected furniture action effect or unrelated captured mutation');}
 return {passed:true,case:caseId,actions:actions.map(action=>action.op),phases:3,slidesPerPhase:3,originalSlideIds:original.slides.map(slide=>slide.slideId),editedSlideIds:moved.map(slide=>slide.slideId),sourceActionSha256:digest(furnitureActionBytes),nativeAcceptance:false,registryAcceptance:false,visualAcceptance:false,scope:'Exact sealed empty-text, picture-alt and slide3-to1 move effects on full current native slide/shape records; every other captured field and order preserved. No source-JSON, inherited-layout, font-file, baseline or raster acceptance.'};
}

// Source admission comes BEFORE dynamic import. The expected revision is an
// explicit reviewed controller pin, not this analysis checkout's HEAD.
export async function loadFurnitureController({controller,expectedControllerSha,envelopeFile,envelopeSha256}){
 assert.match(expectedControllerSha,/^[a-f0-9]{40}$/u);assert.match(envelopeSha256,/^[a-f0-9]{64}$/u);canonicalOwnedPath(controller);canonicalOwnedPath(envelopeFile);
 const bytes=readOwnedFile(envelopeFile,4194304);assert.equal(digest(bytes),envelopeSha256);const envelope=JSON.parse(bytes.toString('utf8'));
 assert.equal(envelope.profile,PROFILE);const recorded=envelope.controller;assert.equal(recorded.directory,controller);assert.equal(recorded.revision,expectedControllerSha);assert.equal(recorded.dirty,false);
 assert.ok(Array.isArray(recorded.files)&&recorded.files.length>0&&recorded.files.length<=256);const names=new Set();
 for(const row of recorded.files){keys(row,['path','bytes','sha256']);assert.match(row.path,/^[a-zA-Z0-9_./-]+$/u);assert.ok(!path.isAbsolute(row.path)&&row.path.split('/').every(part=>part&&part!=='.'&&part!=='..')&&!names.has(row.path.toLowerCase()));names.add(row.path.toLowerCase());assert.ok(Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=4194304);assert.match(row.sha256,/^[a-f0-9]{64}$/u);canonicalOwnedPath(path.join(controller,row.path));}
 assert.deepEqual(repositoryIdentity(controller,recorded.files.map(row=>row.path)),recorded,'Pinned controller Git/source identity changed');
 for(const name of ownedControllerFiles(controller,[CONTROLLER_ENTRY]))assert.ok(names.has(name.toLowerCase()),'Unbound controller import '+name);
 const module=await import(pathToFileURL(path.join(controller,CONTROLLER_ENTRY)).href);
 for(const name of ['verifyFurnitureExecution','admitFurnitureExecution'])assert.equal(typeof module[name],'function','Missing maintained controller export '+name);
 return {module,envelope,envelopeBytes:bytes};
}

export function assertFurnitureSemanticPostflight(binding,admission,postflight,bytes){
 assert.equal(admission.profile,PROFILE);assert.equal(admission.requestSha256,binding.requestSha256);assert.deepEqual(postflight.policy,admission.policy);assert.equal(postflight.error,null);assert.equal(postflight.identity.bytes,bytes.length);assert.equal(postflight.identity.sha256,digest(bytes));
 assertReferenceWitnessPostflight({workerCleanupConfirmed:true,postflightError:postflight.error,postflight:postflight.result,powerPointPostflightInitialCount:postflight.initialCount,powerPointPostflightCount:postflight.finalCount},bytes.toString('utf8').trim().split(/\r?\n/u).map(line=>JSON.parse(line)));
}
export async function bindFurnitureSemanticEvidence(options){
 keys(options,['controller','expectedControllerSha','envelopeFile','envelopeSha256','output']);canonicalOwnedPath(options.output);
 const {module}=await loadFurnitureController(options);
 // Both exports execute with the genuine old module's ROOT and complete gates.
 // This is the sole maintained full artifact/admission scan for this comparison.
 const binding=module.verifyFurnitureExecution(options.envelopeFile,options.envelopeSha256,options.output,true),admission=module.admitFurnitureExecution(binding);
 assert.deepEqual(readOwnedJson(path.join(options.output,'postflight-admission.json')),admission);
 const postflight=readOwnedJson(path.join(options.output,'postflight-result.json')),postflightBytes=readOwnedFile(path.join(options.output,'postflight.jsonl'),65536);
 assertFurnitureSemanticPostflight(binding,admission,postflight,postflightBytes);
 const runner=readOwnedJson(path.join(options.output,'runner.json'));assertTypedFurnitureCompletion(binding,runner);
 const reportFile=path.join(options.output,'native/report.json'),report=readOwnedJson(reportFile),saved=readOwnedFile(path.join(options.output,'native/native-furniture-control.pptx'),16777216);
 assert.equal(digest(saved),report.saved.sha256);assert.equal(report.reopened.sha256,report.saved.sha256);
 const selected=binding.envelope.selectedCase,generation=binding.envelope.generation;
 let sourceBytes=null;if(selected.source!==undefined){const row=binding.suite.files.filter(row=>row.path===selected.source);assert.equal(row.length,1,'Source must remain sealed');sourceBytes=readOwnedFile(path.join(generation.suiteDirectory,selected.source));assert.equal(sourceBytes.length,row[0].bytes);assert.equal(digest(sourceBytes),row[0].sha256);}
 return {...binding,admission,postflight,runner,report,saved,sourceBytes,identity:{controller:options.controller,controllerRevision:options.expectedControllerSha,envelopeSha256:options.envelopeSha256,requestSha256:binding.requestSha256,runner:fileIdentity(path.join(options.output,'runner.json')),admission:fileIdentity(path.join(options.output,'postflight-admission.json')),postflight:fileIdentity(path.join(options.output,'postflight-result.json')),postflightJournal:fileIdentity(path.join(options.output,'postflight.jsonl')),report:fileIdentity(reportFile),inputSha256:digest(binding.input),savedSha256:digest(saved),sourceSha256:sourceBytes?digest(sourceBytes):null}};
}
// Pure dispatch only. Production calls it only after complete typed evidence binding.
export function compareFurnitureSemanticValues(kind,values){
 assertFurnitureComparisonKind(kind,values);
 if(kind==='text')return compareTextObservations(values);
 if(kind==='fonts')return compareUniformTextFonts(values);
 if(kind==='furniture-inherited')return compareInheritedFurniture(values);
 return compareListEditSemantics(values);
}
function analysisIdentity(){
 const identity=repositoryIdentity(ROOT,ownedControllerFiles(ROOT,['scripts/native-acceptance/compare-furniture-profile.mjs',FURNITURE_ACTION_SOURCE]));assert.equal(identity.dirty,false,'Freeze the separately reviewed analysis source');assert.deepEqual(fileIdentity(path.join(ROOT,FURNITURE_ACTION_SOURCE)),{bytes:furnitureActionBytes.length,sha256:digest(furnitureActionBytes)},'Loaded furniture source plan changed');return {repository:identity,node:process.version,executable:{path:fs.realpathSync(process.execPath),...fileIdentity(process.execPath)}};
}
export async function compareFurnitureProfile(options){
 keys(options,['controller','expectedControllerSha','envelopeFile','envelopeSha256','output','kind']);assert.ok(MODES.includes(options.kind));assert.match(process.version,/^v24\./u);assert.equal(process.execArgv.length,0);assert.equal(process.env.NODE_OPTIONS,undefined);assert.equal(process.env.NODE_PATH,undefined);
 const file=path.join(options.output,'typed-'+options.kind+'-comparison.json');assert.equal(fs.existsSync(file),false,'Preserve prior semantic comparison');
 const {kind,...bindingOptions}=options,analysis=analysisIdentity(),bound=await bindFurnitureSemanticEvidence(bindingOptions),{envelope,input,saved,report}=bound;
 const context={caseId:envelope.selectedCase.id,actions:envelope.plan,captureTextFonts:envelope.captureTextFonts};
 const beforeInput=digest(input),beforeSaved=digest(saved);let result,imports,failure;
 try {
 assertFurnitureComparisonKind(kind,context);
 const consumer=envelope.generation.consumer;let require,deps;
 if(kind!=='furniture-inherited'){require=createRequire(path.join(consumer,'package.json'));const dependencies=createRequire(require.resolve('@openpresentation/opf-pptx/package.json'));deps={...dependencies('fflate'),...dependencies('fast-xml-parser')};}
 if(kind==='text')result=compareFurnitureSemanticValues(kind,{expected:exportedTextShapes(input,deps,envelope.selectedCase.slideCount),report,...context});
 else if(kind==='fonts')result=compareFurnitureSemanticValues(kind,{expected:explicitUniformTextFonts(input,deps,envelope.selectedCase.slideCount),report,...context});
 else if(kind==='furniture-inherited')result=compareFurnitureSemanticValues(kind,{report,...context});
 else{
  assert.equal(envelope.selectedCase.source,`sources/${LIST_EDIT_CASE}.opf.json`);assert.ok(bound.sourceBytes);const source=JSON.parse(bound.sourceBytes.toString('utf8'));
  const pptx=await import(pathToFileURL(require.resolve('@openpresentation/opf-pptx')).href),{gallery}=await import(pathToFileURL(require.resolve('@openpresentation/gallery')).href);imports={};
  for(const [phase,bytes]of [['original',input],['saved-reopened',saved]]){const diagnostics=[],document=await pptx.fromPptx(bytes,{catalogs:[gallery],onDiagnostic:d=>diagnostics.push(d)});imports[phase]={document,diagnostics};}
  result=compareFurnitureSemanticValues(kind,{...context,source,original:imports.original.document,edited:imports['saved-reopened'].document,report,actions:context.actions,expectedText:exportedTextShapes(input,deps,1),nativeStyle:nativeListDescription(saved,deps)});
 }
 assert.equal(digest(input),beforeInput,'Comparator/importer mutated original bytes');assert.equal(digest(saved),beforeSaved,'Comparator/importer mutated saved bytes');
 } catch(error){failure=error;}
 const output={schemaVersion:1,profile:PROFILE,kind,caseId:context.caseId,identity:bound.identity,analysis,result:result??null,...(failure?{failure:{name:failure.name,message:failure.message}}:{}),...(imports?{imports}:{}),nativeAcceptance:false,registryAcceptance:false,visualAcceptance:false,scope:'Scoped semantic comparison after independently bound completed typed lifecycle; no general source-JSON, font-file, baseline, raster or release acceptance.'};
 fs.writeFileSync(file,json(output),{flag:'wx'});if(failure)throw failure;assert.equal(result.passed,true,'Semantic comparison failed; preserve '+file);return output;
}
async function main(argv){
 const values={};for(let i=0;i<argv.length;i+=2){assert.ok(['--controller','--expect-controller','--envelope','--sha256','--output','--kind'].includes(argv[i])&&!Object.hasOwn(values,argv[i])&&argv[i+1]&&!argv[i+1].startsWith('--'));values[argv[i]]=argv[i+1];}
 for(const key of ['--controller','--expect-controller','--envelope','--sha256','--output','--kind'])assert.ok(values[key],'Required '+key);
 const result=await compareFurnitureProfile({controller:values['--controller'],expectedControllerSha:values['--expect-controller'],envelopeFile:values['--envelope'],envelopeSha256:values['--sha256'],output:values['--output'],kind:values['--kind']});console.log(JSON.stringify({caseId:result.caseId,kind:result.kind,passed:result.result.passed,nativeAcceptance:false,visualAcceptance:false}));
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main(process.argv.slice(2)).catch(error=>{console.error(error);process.exitCode=1;});
