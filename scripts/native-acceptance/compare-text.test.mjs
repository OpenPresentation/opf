import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {compareTextObservations,exportedTextShapes} from './compare-text.mjs';
const require=createRequire(new URL('../../packages/javascript/package.json',import.meta.url));
const peer=createRequire(require.resolve('@openpresentation/opf-pptx/package.json'));
const dependencies={...peer('fflate'),...peer('fast-xml-parser')};
function fixture(){
 const shape={name:'OPF metric 0 value line 0',text:'42  ms',left:12,top:18,width:72,height:30,rotation:0};
 const phase=()=>({slideCount:1,slides:[{index:1,shapeCount:1,shapes:[{...shape,hasTextFrame:-1}]}]});
 return {expected:[{shapes:[shape]}],report:{schemaVersion:1,cleanupConfirmed:true,officeOperationsStopped:false,error:null,lastStage:'worker.complete',lastStatus:'success',actionPlan:{actions:[],completed:[]},phases:{original:phase(),edited:phase(),reopened:phase()}}};
}
test('named text compares point geometry, stable words and unavailable fidelity separately',()=>{
 const f=fixture();f.report.phases.original.slides[0].shapes[0].top+=0.019;
 f.report.phases.reopened.slides[0].shapes[0].text='42\rms';
 const result=compareTextObservations(f);assert.equal(result.passed,true);assert.equal(result.tolerancePoints,0.02);assert.equal(result.nativeAcceptance,false);assert.equal(result.observations.length,3);assert.ok(result.unavailable.fontSelection&&result.unavailable.baseline&&result.unavailable.pixelEquivalence);
});
test('geometry beyond unchanged .02pt gate is a finding, never native acceptance',()=>{
 for(const field of ['left','top','width','height']){const f=fixture();f.report.phases.original.slides[0].shapes[0][field]+=0.0201;const result=compareTextObservations(f);assert.equal(result.passed,false);assert.equal(result.findings[0].field,field);}
});
test('text edits use exact supported action and reopening preserves edited words',()=>{
 const f=fixture(),action={op:'set-text',slideIndex:1,shapeName:f.expected[0].shapes[0].name,text:'Native 7'};f.actions=[action];f.report.actionPlan={actions:[action],completed:[{index:1,op:'set-text',status:'success'}]};for(const phase of ['edited','reopened'])f.report.phases[phase].slides[0].shapes[0].text='Native 7';assert.equal(compareTextObservations(f).passed,true);f.report.phases.reopened.slides[0].shapes[0].text='Stale 7';assert.equal(compareTextObservations(f).passed,false);
});
test('missing, duplicate, nonfinite and unsuccessful observations fail closed',()=>{
 for(const mutate of [f=>{f.report.phases.original.slides[0].shapes=[];},f=>{const slide=f.report.phases.original.slides[0];slide.shapes.push({...slide.shapes[0]});slide.shapeCount=2;},f=>{delete f.report.phases.original.slides[0].shapes[0].height;},f=>{f.report.phases.original.slides[0].shapes[0].top=NaN;},f=>{f.report.cleanupConfirmed=false;},f=>{f.report.officeOperationsStopped=true;},f=>{f.report.lastStage='worker.failure';},f=>{f.report.phases.reopened.slideCount=2;}]){const f=fixture();mutate(f);assert.throws(()=>compareTextObservations(f));}
});
test('unsupported structural/style actions and unknown edit targets are not silently compared',()=>{
 for(const op of ['set-text-style','delete-shape','move-slide','duplicate-shape','set-alt','set-tag']){const f=fixture();f.actions=[{op}];assert.throws(()=>compareTextObservations(f),/Unsupported text comparison action/);}
 const f=fixture();f.actions=[{op:'set-text',slideIndex:1,shapeName:'Unknown',text:'edit'}];assert.throws(()=>compareTextObservations(f),/exact named text/);
});
const archive=(shape='')=>dependencies.zipSync(Object.fromEntries(Object.entries({
 'ppt/presentation.xml':'<p:presentation><p:sldIdLst><p:sldId r:id="rId1"/></p:sldIdLst><p:sldSz cx="6858000" cy="12192000"/></p:presentation>',
 'ppt/_rels/presentation.xml.rels':'<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/></Relationships>',
 'ppt/slides/slide1.xml':`<p:sld><p:cSld><p:spTree>${shape}</p:spTree></p:cSld></p:sld>`,
}).map(([file,xml])=>[file,Buffer.from(xml)])));
const shape='<p:sp><p:nvSpPr><p:cNvPr name="OPF heading A &amp; B"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="152400" y="228600"/><a:ext cx="914400" cy="381000"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>42 </a:t></a:r><a:fld><a:t>ms</a:t></a:fld></a:p><a:p><a:r><a:t>Next &amp; last</a:t></a:r></a:p></p:txBody></p:sp>';
test('PPTX named text uses actual EMU units and ordered rich runs/fields/paragraphs',()=>{
 assert.deepEqual(exportedTextShapes(archive(shape),dependencies,1),[{dimensions:{width:540,height:960},shapes:[{name:'OPF heading A & B',text:'42 ms\rNext & last',left:12,top:18,width:72,height:30,rotation:0}]}]);
});
test('PPTX missing transform, duplicate names, groups, rotations and slide mismatch fail closed',()=>{
 for(const xml of [shape.replace('<a:off x="152400" y="228600"/>',''),shape+shape,`<p:grpSp>${shape}</p:grpSp>`,shape.replace('<a:xfrm>','<a:xfrm rot="60000">')])assert.throws(()=>exportedTextShapes(archive(xml),dependencies,1));
 assert.throws(()=>exportedTextShapes(archive(shape),dependencies,2),/slide count/);
});

test('complete comparison binds sealed inputs, installed graph, worker snapshots and lifecycle',async()=>{
 const {mkdir,mkdtemp,writeFile,readFile,realpath,rm,symlink}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),path=await import('node:path');
 const {digest,installedIdentity,packageNames}=await import('./identity.mjs'),{compareText,bindNativeCaseEvidence}=await import('./compare-text.mjs');
 const root=await realpath(await mkdtemp(path.join(tmpdir(),'native-text-compare-')));
 try{
  const consumer=path.join(root,'consumer'),suiteDirectory=path.join(root,'suite'),output=path.join(root,'result');
  await mkdir(consumer);await writeFile(path.join(consumer,'package.json'),'{}');
  for(const name of packageNames){const dir=path.join(consumer,'node_modules',name);await mkdir(path.join(dir,'dist'),{recursive:true});await writeFile(path.join(dir,'package.json'),JSON.stringify({name,version:'0.0.0',main:'dist/index.js'}));await writeFile(path.join(dir,'dist/index.js'),'export {};');}
  const depRoot=path.join(consumer,'node_modules/@openpresentation/opf-pptx/node_modules');await mkdir(depRoot);
  for(const name of ['fflate','fast-xml-parser']){let dir=path.dirname(peer.resolve(name));while(!await readFile(path.join(dir,'package.json')).then(()=>true,()=>false))dir=path.dirname(dir);await symlink(dir,path.join(depRoot,name),process.platform==='win32'?'junction':'dir');}
  for(const dir of [suiteDirectory,path.join(output,'inputs'),path.join(output,'native/inputs')])await mkdir(dir,{recursive:true});
  const input=archive(shape),plan=Buffer.from('[]\n'),code=Buffer.from('sealed worker'),helper=Buffer.from('sealed helper');
  const files=[{path:'inputs/test.pptx',bytes:input.length,sha256:digest(input)},{path:'actions/test.json',bytes:plan.length,sha256:digest(plan)}];
  for(const [file,bytes] of [['inputs/test.pptx',input],['actions/test.json',plan]]){await mkdir(path.dirname(path.join(suiteDirectory,file)),{recursive:true});await writeFile(path.join(suiteDirectory,file),bytes);}
  const workerFiles=[{path:'test/native-furniture-control.ps1',bytes:code.length,sha256:digest(code)},{path:'test/native-process.ps1',bytes:helper.length,sha256:digest(helper)}];
  const repository={revision:'1'.repeat(40),dirty:false,files:workerFiles},provenance={packages:installedIdentity(consumer),suiteRepository:repository,workerRepository:repository};
  const selected={id:'test',worker:'furniture',automaticControlEligible:true,input:files[0].path,actionPlan:files[1].path,archiveSha256:digest(input),slideCount:1},suite={schemaVersion:1,provenance,files,cases:[selected]};
  const suiteBytes=Buffer.from(JSON.stringify(suite));await writeFile(path.join(suiteDirectory,'suite.json'),suiteBytes);
  const runner={schemaVersion:1,case:'test',manifestSha256:digest(suiteBytes),selectedCase:selected,provenance,executingCode:{suite:repository,workers:repository},status:'native-observation-completed; acceptance-requires-supervisor-review',nativeAcceptance:false,registryAcceptance:false,timeoutSeconds:45};
  const request={source:{sha256:digest(input),snapshotSha256:digest(input)},actionPlan:{sha256:digest(plan),snapshotSha256:digest(plan),count:0},verifier:{sha256:digest(code),snapshotSha256:digest(code)},processHelper:{sha256:digest(helper),snapshotSha256:digest(helper)}};
  const expected=exportedTextShapes(input,dependencies,1),f=fixture();
  for(const phase of ['original','edited','reopened'])f.report.phases[phase].slides[0].shapes=[{...expected[0].shapes[0],hasTextFrame:-1}];
  Object.assign(f.report,{source:{sha256:digest(input),openedSha256:digest(input)},saved:{sha256:digest(input)},reopened:{sha256:digest(input)},inputs:{verifier:request.verifier,processHelper:request.processHelper}});Object.assign(f.report.actionPlan,request.actionPlan);
  for(const [file,bytes] of [['inputs/case.pptx',input],['inputs/action-plan.json',plan],['native/inputs/input.pptx',input],['native/inputs/action-plan.json',plan],['native/inputs/native-furniture-control.ps1',code],['native/inputs/native-process.ps1',helper],['native/native-furniture-control.pptx',input]])await writeFile(path.join(output,file),bytes);
  const writeJson=(file,value)=>writeFile(path.join(output,file),JSON.stringify(value));await writeJson('runner.json',runner);await writeJson('native/request.json',request);await writeJson('native/report.json',f.report);await writeJson('native/supervisor.json',{timedOut:false,exitCode:0,cleanupConfirmed:true});
  const options={suiteDirectory,output,consumer,caseId:'test'};
  runner.manifestSha256='0'.repeat(64);await writeJson('runner.json',runner);await assert.rejects(()=>compareText(options));runner.manifestSha256=digest(suiteBytes);await writeJson('runner.json',runner);
  await writeFile(path.join(output,'native/inputs/input.pptx'),'tampered');await assert.rejects(()=>compareText(options),/Snapshot changed/);await writeFile(path.join(output,'native/inputs/input.pptx'),input);
  await writeJson('native/supervisor.json',{timedOut:true,exitCode:0,cleanupConfirmed:true});await assert.rejects(()=>compareText(options));await writeJson('native/supervisor.json',{timedOut:false,exitCode:0,cleanupConfirmed:true});
  await writeFile(path.join(suiteDirectory,files[0].path),'tampered suite');await assert.rejects(()=>compareText(options),/Suite bytes differ/);await writeFile(path.join(suiteDirectory,files[0].path),input);
  f.report.source.sha256='0'.repeat(64);await writeJson('native/report.json',f.report);await assert.rejects(()=>compareText(options));f.report.source.sha256=digest(input);await writeJson('native/report.json',f.report);
  await writeFile(path.join(output,'native/inputs/native-furniture-control.ps1'),'tampered code');await assert.rejects(()=>compareText(options));await writeFile(path.join(output,'native/inputs/native-furniture-control.ps1'),code);
  await rm(path.join(output,'native/report.json'));await assert.rejects(()=>compareText(options),/ENOENT/);await writeJson('native/report.json',f.report);
  await writeFile(path.join(suiteDirectory,'suite.json'),JSON.stringify({...suite,cases:[selected,selected]}));await assert.rejects(()=>compareText(options),/duplicate/);await writeFile(path.join(suiteDirectory,'suite.json'),suiteBytes);
  suite.files[0].path='../escape';await writeFile(path.join(suiteDirectory,'suite.json'),JSON.stringify(suite));await assert.rejects(()=>compareText(options),/Unsafe asset path/);suite.files[0].path='inputs/test.pptx';await writeFile(path.join(suiteDirectory,'suite.json'),suiteBytes);
  const bound=await bindNativeCaseEvidence(options);assert.equal(bound.identity.inputSha256,digest(input));assert.deepEqual(bound.input,Buffer.from(input));assert.deepEqual(bound.saved,Buffer.from(input));assert.equal(bound.sourceBytes,null);assert.equal(bound.dependencies.XMLParser,dependencies.XMLParser);await assert.rejects(()=>readFile(path.join(output,'text-comparison.json')),/ENOENT/);
  const result=await compareText(options);assert.equal(result.passed,true);assert.equal(result.nativeAcceptance,false);assert.equal(result.case,'test');assert.equal(result.manifestSha256,digest(suiteBytes));await assert.rejects(()=>compareText(options),/EEXIST/);
 }finally{await rm(root,{recursive:true,force:true});}
});
