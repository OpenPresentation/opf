import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import test,{after} from 'node:test';
import {digest,installedIdentity,repositoryIdentity} from './identity.mjs';
import {windowsPowerShellEnvironment} from './windows-powershell-env.mjs';
import {DENSE_PROFILE,DENSE_CONTROLLER_FILES,inspectDenseArchive,assertDenseSelection,createDenseEnvelope,validateDenseEnvelope,readDenseEnvelope,assertDenseLifecycle,assertDenseOutput,plainLocalPath,bindDenseObservation} from './dense-survey-contract.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),fixture=fileURLToPath(new URL('./fixtures/dense-survey/',import.meta.url));
const receipt=JSON.parse(fs.readFileSync(path.join(fixture,'receipt.json'),'utf8')),input=fs.readFileSync(path.join(fixture,'input.pptx')),plan=fs.readFileSync(path.join(fixture,'action-plan.json'));
const pptx=createRequire(createRequire(import.meta.url).resolve('@openpresentation/opf-pptx/package.json')),deps={...pptx('fflate'),...pptx('fast-xml-parser')};
const expectedArchive=inspectDenseArchive(input,deps);
function suite(){return {schemaVersion:1,nativeAcceptance:false,provenance:{nativeAcceptance:false,registryAcceptance:false},cases:[{...structuredClone(receipt.selectedCase),input:'input.pptx',actionPlan:'action-plan.json',source:'source.opf.json'}]};}
function mutateXml(change){const parts=deps.unzipSync(input);parts['ppt/slides/slide1.xml']=deps.strToU8(change(deps.strFromU8(parts['ppt/slides/slide1.xml'])));return Buffer.from(deps.zipSync(parts));}
function lifecycle(){
 const inputSha256=digest(input),planSha256=digest(plan),fileSha='a'.repeat(64),actionPlan={sha256:planSha256,snapshotSha256:planSha256,actions:[],completed:[],styleEdits:[],chartPoints:[],chartSeriesEdits:[]};
 const phase=()=>({slideCount:1,slides:[{index:1,shapeCount:50,shapes:expectedArchive.shapeNames.map((name,index)=>({name,index:index+1,id:index+1,type:17,left:0,top:0,width:100,height:20,rotation:0,hasTextFrame:-1,text:expectedArchive.shapeWords[index].join(' ')}))}],rasters:[{slideIndex:1,sha256:fileSha}]});
 return {shapeNames:expectedArchive.shapeNames,shapeWords:expectedArchive.shapeWords,inputSha256,planSha256,terminal:{timedOut:false,exitCode:0,cleanupConfirmed:true},request:{readOnlySurvey:true,source:{sha256:inputSha256,snapshotSha256:inputSha256},actionPlan:{sha256:planSha256,snapshotSha256:planSha256,count:0}},report:{schemaVersion:1,readOnlySurvey:true,cleanupConfirmed:true,officeOperationsStopped:false,error:null,lastStage:'worker.complete',lastStatus:'success',source:{sha256:inputSha256,openedSha256:inputSha256},actionPlan,phases:{original:phase(),edited:phase(),reopened:phase()},saved:{sha256:fileSha},reopened:{sha256:fileSha}}};
}
const scratchParent=path.join(root,'artifacts','dense-survey-pure-tests');fs.mkdirSync(scratchParent,{recursive:true});const scratch=fs.mkdtempSync(path.join(scratchParent,'attempt-'));
after(()=>{assert.ok(path.resolve(scratch).startsWith(path.resolve(scratchParent)+path.sep));fs.rmSync(scratch,{recursive:true,force:true});});
const git=(directory,args)=>execFileSync('git',args,{cwd:directory,encoding:'utf8',stdio:['ignore','pipe','pipe']});
function repository(directory,files){fs.mkdirSync(directory,{recursive:true});for(const [file,bytes]of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(directory,file)),{recursive:true});fs.writeFileSync(path.join(directory,file),bytes);}git(directory,['init','-q']);git(directory,['add','.']);git(directory,['-c','user.name=OPF pure fixture','-c','user.email=pure@example.invalid','commit','-qm','Synthetic offline identity fixture']);return repositoryIdentity(directory,Object.keys(files));}
function filesFrom(paths,base=root){return Object.fromEntries(paths.map(file=>[file,fs.readFileSync(path.join(base,file))]));}
function authority(){
 const folder=fs.mkdtempSync(path.join(scratch,'binding-')),controller=path.join(folder,'controller'),preparation=path.join(folder,'preparation'),worker=path.join(folder,'worker'),consumer=path.join(folder,'consumer'),suiteDirectory=path.join(folder,'suite');
 const controllerIdentity=repository(controller,filesFrom(DENSE_CONTROLLER_FILES));
 const generationIdentity=repository(preparation,filesFrom(['scripts/native-acceptance/run-windows.ps1']));
 const workerPaths=['test/native-furniture-control.ps1','test/native-process.ps1','test/native-process-check.ps1','test/native-furniture-harness-check.ps1'];
 const workerIdentity=repository(worker,filesFrom(workerPaths,path.join(root,'packages','pptx')));
 fs.mkdirSync(consumer);fs.writeFileSync(path.join(consumer,'package.json'),'{}\n');
 for(const name of ['opf','opf-render','opf-pptx','opf-editor','cli','gallery']){const d=path.join(consumer,'node_modules','@openpresentation',name);fs.mkdirSync(path.join(d,'dist'),{recursive:true});fs.writeFileSync(path.join(d,'package.json'),JSON.stringify({name:'@openpresentation/'+name,version:'0.0.0-pure-fixture',exports:{'./package.json':'./package.json'}}));fs.writeFileSync(path.join(d,'dist','index.js'),'// Synthetic identity only; never a published or native runtime.\n');}
 const s=suite();s.provenance={nativeAcceptance:false,registryAcceptance:false,suiteRepository:generationIdentity,workerRepository:workerIdentity,packages:installedIdentity(consumer)};
 fs.mkdirSync(suiteDirectory);for(const name of ['input.pptx','action-plan.json','source.opf.json'])fs.copyFileSync(path.join(fixture,name),path.join(suiteDirectory,name));s.files=['input.pptx','action-plan.json','source.opf.json'].map(file=>({path:file,bytes:fs.statSync(path.join(suiteDirectory,file)).size,sha256:digest(fs.readFileSync(path.join(suiteDirectory,file)))}));
 fs.writeFileSync(path.join(suiteDirectory,'suite.json'),JSON.stringify(s));
 const envelope=createDenseEnvelope({suiteDirectory,expectedManifestSha256:digest(fs.readFileSync(path.join(suiteDirectory,'suite.json'))),preparationRepository:preparation,workerRepository:worker,consumer,root:controller});
 return {folder,controller,controllerIdentity,preparation,worker,consumer,suiteDirectory,envelope};
}

test('retained public dense input has exactly one original slide and50 independently named shapes',()=>{
 for(const record of receipt.files){const bytes=fs.readFileSync(path.join(fixture,record.path));assert.equal(bytes.length,record.bytes);assert.equal(digest(bytes),record.sha256);}
 assert.equal(expectedArchive.slideCount,1);assert.equal(expectedArchive.shapeCount,50);assert.equal(expectedArchive.shapeNames.length,50);assert.equal(new Set(expectedArchive.shapeNames).size,50);
 const xml=new deps.XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false}).parse(deps.strFromU8(deps.unzipSync(input)['ppt/slides/slide1.xml']));
 assert.deepEqual(expectedArchive.shapeNames,xml['p:sld']['p:cSld']['p:spTree']['p:sp'].map(s=>s['p:nvSpPr']['p:cNvPr'].name));
 assert.equal(assertDenseSelection(suite(),input,plan,deps).selected.automaticControlEligible,false);
});
test('dense profile rejects a different, duplicate, missing or generically eligible selected case',()=>{
 for(const mutate of [s=>s.cases[0].id='Other',s=>s.cases.push(structuredClone(s.cases[0])),s=>s.cases=[],s=>s.cases[0].automaticControlEligible=true,s=>s.cases[0].worker='table-colors',s=>s.cases[0].slideCount=2,s=>s.cases[0].archiveSha256='b'.repeat(64),s=>s.nativeAcceptance=true]){const s=suite();mutate(s);assert.throws(()=>assertDenseSelection(s,input,plan,deps));}
});
test('read-only profile rejects every nonempty plan and non-list plan',()=>{for(const value of ['{}','null','[{}]','["noop"]'])assert.throws(()=>assertDenseSelection(suite(),input,Buffer.from(value),deps),/no actions/);});
test('source-bound profile never borrows the delegate100-shape allowance',()=>{
 const removed=mutateXml(xml=>xml.replace(/<p:sp>.*?<\/p:sp>/su,''));assert.throws(()=>inspectDenseArchive(removed,deps),/exactly50/);
 const added=mutateXml(xml=>xml.replace('</p:spTree>',xml.match(/<p:sp>.*?<\/p:sp>/su)[0]+'</p:spTree>'));assert.throws(()=>inspectDenseArchive(added,deps),/exactly50/);
 const parts=deps.unzipSync(input);parts['ppt/slides/slide2.xml']=parts['ppt/slides/slide1.xml'];assert.throws(()=>inspectDenseArchive(deps.zipSync(parts),deps),/exactly one/);
 assert.throws(()=>inspectDenseArchive(Buffer.alloc(16*1024*1024+1),deps),/16MiB/);
});
test('duplicate names and XML declarations refuse rather than silently remap native shape ownership',()=>{
 const altered=mutateXml(xml=>{const names=[...xml.matchAll(/<p:cNvPr[^>]*\bname="([^"]+)"/gu)];return xml.replace('name="'+names[2][1]+'"','name="'+names[1][1]+'"');});assert.throws(()=>inspectDenseArchive(altered,deps),/unique/);
 assert.throws(()=>inspectDenseArchive(mutateXml(xml=>'<!DOCTYPE p:sld>'+xml),deps),/declarations/);
});
test('all three phases retain all50 ordered identities and observation-only acceptance flags',()=>{const result=assertDenseLifecycle(lifecycle());assert.equal(result.nativeAcceptance,false);assert.equal(result.registryAcceptance,false);});
test('every modeled phase refuses missing, added, renamed, reordered or incomplete shape records',()=>{
 for(const phase of ['original','edited','reopened'])for(const mode of ['missing-phase','missing-slide','49','51','name','order','index','missing-png','missing-text','changed-word','missing-geometry']){const f=lifecycle(),p=f.report.phases[phase];if(mode==='missing-phase')delete f.report.phases[phase];if(mode==='missing-slide')p.slides=[];if(mode==='49')p.slides[0].shapes.pop();if(mode==='51')p.slides[0].shapes.push({...p.slides[0].shapes[0]});if(mode==='name')p.slides[0].shapes[0].name='Different';if(mode==='order')p.slides[0].shapes.reverse();if(mode==='index')p.slides[0].index=2;if(mode==='missing-png')p.rasters=[];if(mode==='missing-text')delete p.slides[0].shapes[0].text;if(mode==='changed-word')p.slides[0].shapes.find(s=>s.text).text='Foreign words';if(mode==='missing-geometry')delete p.slides[0].shapes[0].width;assert.throws(()=>assertDenseLifecycle(f));}
});
test('failure latch, timeout, source/plan identity and readonly mode cannot be hidden by a successful-looking report',()=>{
 for(const mutate of [f=>f.terminal.timedOut=true,f=>f.terminal.exitCode=1,f=>f.terminal.cleanupConfirmed=false,f=>f.report.cleanupConfirmed=false,f=>f.report.officeOperationsStopped=true,f=>f.report.error='failed',f=>f.report.lastStage='save',f=>f.request.readOnlySurvey=false,f=>delete f.report.readOnlySurvey,f=>f.request.source.snapshotSha256='b'.repeat(64),f=>f.report.source.openedSha256='b'.repeat(64),f=>f.report.actionPlan.completed.push({op:'noop'}),f=>f.report.actionPlan.styleEdits.push({}),f=>f.request.actionPlan.count=1,f=>f.report.reopened.sha256='b'.repeat(64)]){const f=lifecycle();mutate(f);assert.throws(()=>assertDenseLifecycle(f));}
});
test('reusable envelope keeps preparation, worker and new controller identities distinct without workstation constants',()=>{
 const a=authority(),b=validateDenseEnvelope(a.envelope,{root:a.controller,deps});assert.equal(b.selected.automaticControlEligible,false);assert.deepEqual(a.envelope.controllerRepository,a.controllerIdentity);assert.notEqual(a.envelope.controllerRepository.directory,a.envelope.generation.provenance.suiteRepository.directory);assert.notEqual(a.envelope.controllerRepository.revision,a.envelope.generation.provenance.workerRepository.revision);
 const file=path.join(a.folder,'execution-envelope.json');fs.writeFileSync(file,JSON.stringify(a.envelope));const sha=digest(fs.readFileSync(file));assert.equal(readDenseEnvelope(file,sha,{root:a.controller,deps}).envelopeSha256,sha);assert.throws(()=>readDenseEnvelope(file,'b'.repeat(64),{root:a.controller,deps}),/digest changed/);
 for(const destination of [a.controller,path.join(a.preparation,'new.json'),path.dirname(a.worker),a.suiteDirectory,a.consumer])assert.throws(()=>assertDenseOutput(destination,a.envelope,file),/overlaps/);assert.equal(assertDenseOutput(path.join(a.folder,'fresh-attempt'),a.envelope,file),path.join(a.folder,'fresh-attempt'));
});
test('original generator HEAD and every original recorded byte remain binding even when new controller is unchanged',()=>{
 const a=authority(),file=path.join(a.preparation,'scripts/native-acceptance/run-windows.ps1');fs.appendFileSync(file,'\n# changed\n');assert.throws(()=>validateDenseEnvelope(a.envelope,{root:a.controller,deps}),/Changed recorded|identity changed/);
});
test('new controller, worker and installed consumer drift each refuse before any delegate can start',()=>{
 for(const target of ['controller','worker','consumer']){const a=authority();const file=target==='controller'?path.join(a.controller,DENSE_CONTROLLER_FILES[0]):target==='worker'?path.join(a.worker,'test/native-process.ps1'):path.join(a.consumer,'node_modules/@openpresentation/opf/dist/index.js');fs.appendFileSync(file,'\n// changed\n');assert.throws(()=>validateDenseEnvelope(a.envelope,{root:a.controller,deps}),/Changed|changed/);}
});
test('suite mutation, missing assets, unsafe records and non-clean generation refuse',()=>{
 for(const mutate of [a=>fs.appendFileSync(path.join(a.suiteDirectory,'suite.json'),' '),a=>fs.unlinkSync(path.join(a.suiteDirectory,'source.opf.json')),a=>a.envelope.generation.provenance.workerRepository.dirty=true,a=>a.envelope.limits.delegateShapeLimit=101,a=>a.envelope.controllerRepository.files[0].path='../escaped']){const a=authority();mutate(a);assert.throws(()=>validateDenseEnvelope(a.envelope,{root:a.controller,deps}));}
 assert.throws(()=>plainLocalPath('//server/share/case.pptx'),/non-UNC/);
});
test('PowerShell bootstrap and default no-Office path have pure refusal controls', {skip:process.platform!=='win32'?'Windows PowerShell unavailable; no Windows claim':false},()=>{
 const a=authority(),identity=path.join(a.folder,'controller.json');fs.writeFileSync(identity,JSON.stringify(a.envelope.controllerRepository));
 const shell=path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe');const result=spawnSync(shell,['-NoProfile','-NonInteractive','-File',path.join(root,'scripts/native-acceptance/run-dense-survey-self-test.ps1'),'-ControllerPath',path.join(root,'scripts/native-acceptance/run-dense-survey-windows.ps1'),'-ControllerRoot',a.controller,'-ControllerIdentity',identity,'-GenericRunner',path.join(root,'scripts/native-acceptance/run-windows.ps1'),'-WorkerPath',path.join(root,'packages/pptx/test/native-furniture-control.ps1')],{encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,env:windowsPowerShellEnvironment(process.env)});
 assert.ifError(result.error);assert.equal(result.status,0,result.stdout+'\n'+result.stderr);assert.match(result.stdout,/PASS: \d+ pure dense-controller controls; no child worker or Office executed/);
});

// These are deliberately modeled worker outputs, never Office observations.
function modeledObservation(a){
 const output=path.join(a.folder,'modeled-attempt'),native=path.join(output,'native'),inputs=path.join(output,'inputs'),snapshots=path.join(native,'inputs');fs.mkdirSync(snapshots,{recursive:true});fs.mkdirSync(inputs);
 const envelopeFile=path.join(a.folder,'modeled-envelope.json');fs.writeFileSync(envelopeFile,JSON.stringify(a.envelope));const envelopeSha=digest(fs.readFileSync(envelopeFile));fs.copyFileSync(envelopeFile,path.join(output,'execution-envelope.json'));
 const f=lifecycle(),sourceFile=path.join(inputs,'case.pptx'),planFile=path.join(inputs,'action-plan.json'),nativeInput=path.join(snapshots,'input.pptx'),nativePlan=path.join(snapshots,'action-plan.json'),saved=path.join(native,'native-furniture-control.pptx');
 for(const file of [sourceFile,nativeInput,saved])fs.writeFileSync(file,input);for(const file of [planFile,nativePlan])fs.writeFileSync(file,plan);
 Object.assign(f.request,{captureTextFonts:false});Object.assign(f.report,{captureTextFonts:false});Object.assign(f.request.source,{path:sourceFile,snapshotPath:nativeInput});Object.assign(f.report.source,{path:sourceFile,openedPath:nativeInput});
 for(const value of [f.request.actionPlan,f.report.actionPlan])Object.assign(value,{path:planFile,snapshotPath:nativePlan});
 for(const value of [f.report.saved,f.report.reopened])Object.assign(value,{path:saved,sha256:digest(input)});
 for(const [key,file]of [['verifier','native-furniture-control.ps1'],['processHelper','native-process.ps1']]){const source=path.join(a.worker,'test',file),snapshot=path.join(snapshots,file),bytes=fs.readFileSync(source);fs.writeFileSync(snapshot,bytes);f.request[key]={path:source,snapshotPath:snapshot,sha256:digest(bytes),snapshotSha256:digest(bytes)};}
 f.report.inputs={verifier:structuredClone(f.request.verifier),processHelper:structuredClone(f.request.processHelper)};
 const png=fs.readFileSync(path.join(fixture,'preview.png'));for(const phase of ['original','edited','reopened']){const file=path.join(native,phase+'-slide-01.png');fs.writeFileSync(file,png);Object.assign(f.report.phases[phase].rasters[0],{path:file,sha256:digest(png)});}
 const runner={schemaVersion:1,profile:DENSE_PROFILE,generation:a.envelope.generation,controllerRepository:a.envelope.controllerRepository,envelopeSha256:envelopeSha,readOnlySurvey:true,runOfficeRequested:true,timeoutSeconds:45,status:'native-worker-pending',nativeAcceptance:false,registryAcceptance:false};
 const save=()=>{for(const [file,data]of [['runner.json',runner],['native/request.json',f.request],['native/report.json',f.report],['native/supervisor.json',f.terminal]])fs.writeFileSync(path.join(output,file),JSON.stringify(data));};save();
 return {output,native,envelopeFile,envelopeSha,f,runner,save,bind:()=>bindDenseObservation({envelopeFile,expectedEnvelopeSha256:envelopeSha,output,root:a.controller})};
}
test('full Office-free output binder preserves separate generation/controller identities and every owned snapshot',()=>{
 const a=authority(),m=modeledObservation(a),result=m.bind();assert.equal(result.phases,3);assert.equal(result.shapesPerPhase,50);assert.equal(result.nativeAcceptance,false);assert.equal(result.registryAcceptance,false);assert.deepEqual(result.controllerRepository,a.envelope.controllerRepository);assert.deepEqual(result.generation,a.envelope.generation);
});
test('failed or no-Office receipts cannot be relabeled as native observations',()=>{
 const a=authority(),m=modeledObservation(a);for(const status of ['failed; no-retry','pure-checks-completed; native-not-run']){m.runner.status=status;m.save();assert.throws(m.bind,/Failed or pure-only/);}m.runner.status='native-worker-pending';m.runner.runOfficeRequested=false;m.save();assert.throws(m.bind,/not requested/);
});
test('foreign-attempt paths refuse even if every copied input byte is identical',()=>{
 const a=authority(),m=modeledObservation(a),foreign=path.join(a.folder,'foreign-identical.pptx');fs.writeFileSync(foreign,input);m.f.report.source.openedPath=foreign;m.save();assert.throws(m.bind,/Foreign attempt path/);
});
test('each phase needs its original owned raster and unchanged saved source words',()=>{
 const a=authority(),m=modeledObservation(a),raster=path.join(m.native,'original-slide-01.png'),original=fs.readFileSync(raster);fs.writeFileSync(raster,'not PNG');assert.throws(m.bind,/PNG/);fs.writeFileSync(raster,original);
 const saved=path.join(m.native,'native-furniture-control.pptx'),changed=mutateXml(xml=>xml.replace(/(<a:t(?:\s[^>]*)?>)([^<]+)(<\/a:t>)/u,(_match,start,_words,end)=>start+'CHANGED'+end));fs.writeFileSync(saved,changed);m.f.report.saved.sha256=digest(changed);m.f.report.reopened.sha256=digest(changed);m.save();assert.throws(m.bind,/Saved dense content changed/);
});
test('symlink or reparse aliases never substitute for owned local inputs',()=>{
 const target=path.join(scratch,'plain-target'),link=path.join(scratch,'aliased-target');fs.mkdirSync(target);fs.symlinkSync(target,link,process.platform==='win32'?'junction':'dir');assert.throws(()=>plainLocalPath(link),/Reparse.symlink/);
});

test('ZIP entry-count and expanded-entry refusals happen before XML/native handling',()=>{
 const parts=deps.unzipSync(input);for(let index=0;index<4097;index++)parts['extra-part-'+index+'.txt']=new Uint8Array([1]);assert.throws(()=>inspectDenseArchive(deps.zipSync(parts),deps),/4096 ZIP entries/);
 const expanded=deps.unzipSync(input);expanded['oversized.xml']=new Uint8Array(8*1024*1024+1);assert.throws(()=>inspectDenseArchive(deps.zipSync(expanded),deps),/expansion bound/);
});

const cliReceipts=fs.mkdtempSync(path.join(root,'artifacts','dense-public-cli-receipts-'));let cliSequence=0;
function publicCli(a,label,args){
 const script=path.join(a.controller,'scripts/native-acceptance/dense-survey-contract.mjs'),result=spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});
 const name=String(++cliSequence).padStart(3,'0')+'-'+label;fs.writeFileSync(path.join(cliReceipts,name+'.stdout.log'),result.stdout??'');fs.writeFileSync(path.join(cliReceipts,name+'.stderr.log'),result.stderr??'');
 fs.writeFileSync(path.join(cliReceipts,name+'.json'),JSON.stringify({scope:'Real child public CLI against a frozen copied controller and synthetic pure authority; no Office',command:process.execPath,args:[script,...args],status:result.status,signal:result.signal,error:result.error?.message,controllerCodeSha256:digest(fs.readFileSync(script))},null,2)+'\n');
 assert.ifError(result.error);return result;
}
function publicAuthority(){
 const a=authority(),link=path.join(a.controller,'node_modules');fs.writeFileSync(path.join(a.controller,'.gitignore'),'node_modules\n');fs.symlinkSync(path.join(root,'node_modules'),link,process.platform==='win32'?'junction':'dir');
 git(a.controller,['add','.gitignore']);git(a.controller,['-c','user.name=OPF pure fixture','-c','user.email=pure@example.invalid','commit','-qm','Freeze copied public CLI dependency resolution']);
 const envelope=path.join(a.folder,'public-envelope.json'),manifest=digest(fs.readFileSync(path.join(a.suiteDirectory,'suite.json')));
 const create=['create','--suite',a.suiteDirectory,'--expected-manifest-sha256',manifest,'--preparation-repository',a.preparation,'--worker-repository',a.worker,'--consumer',a.consumer,'--output',envelope];
 return {...a,link,envelopeFile:envelope,manifest,create,release(){assert.ok(fs.lstatSync(link).isSymbolicLink());fs.unlinkSync(link);}};
}
test('public CLI children accept every declared sha256 flag through create, verify and modeled observe',()=>{
 const a=publicAuthority();try{
  const created=publicCli(a,'create-valid',a.create);assert.equal(created.status,0,created.stderr);const createdRecord=JSON.parse(created.stdout);assert.equal(createdRecord.profile,DENSE_PROFILE);const envelope=JSON.parse(fs.readFileSync(a.envelopeFile));assert.equal(createdRecord.sha256,digest(fs.readFileSync(a.envelopeFile)));
  const verified=publicCli(a,'verify-valid',['verify','--envelope',a.envelopeFile,'--expected-envelope-sha256',createdRecord.sha256]);assert.equal(verified.status,0,verified.stderr);assert.equal(JSON.parse(verified.stdout).envelopeSha256,createdRecord.sha256);
  const modeled=modeledObservation({...a,envelope});const observed=publicCli(a,'observe-valid',['observe','--envelope',modeled.envelopeFile,'--expected-envelope-sha256',modeled.envelopeSha,'--output',modeled.output]);assert.equal(observed.status,0,observed.stderr);assert.equal(JSON.parse(observed.stdout).nativeAcceptance,false);assert.equal(JSON.parse(fs.readFileSync(path.join(modeled.output,'dense-survey-observation.json'))).shapesPerPhase,50);
 }finally{a.release();}
});
test('public CLI children refuse malformed, missing, duplicate and unknown options for every mode',()=>{
 const a=publicAuthority();try{
  for(const mode of ['create','verify','observe'])for(const suffix of [['--invalid_flag','value'],['--1invalid','value'],['--bad--flag','value'],['--envelope'],['--envelope','one','--envelope','two'],['--unknown-option','value']]){const result=publicCli(a,mode+'-reject-option',[mode,...suffix]);assert.notEqual(result.status,0,JSON.stringify(suffix));}
  for(const [mode,args]of [['create',a.create.slice(1)],['verify',['--envelope','unused','--expected-envelope-sha256','a'.repeat(64)]],['observe',['--envelope','unused','--expected-envelope-sha256','a'.repeat(64),'--output','unused']]]){const result=publicCli(a,mode+'-unknown-with-valid-flags',[mode,...args,'--unexpected-option','value']);assert.notEqual(result.status,0);assert.match(result.stderr,/deepEqual|deeply|Expected values/u);}
 }finally{a.release();}
});
test('public CLI children reach and retain real manifest/envelope digest refusals',()=>{
 const a=publicAuthority();try{
  for(const value of ['b'.repeat(64),'not-a-digest']){const args=[...a.create];args[args.indexOf('--expected-manifest-sha256')+1]=value;const result=publicCli(a,'create-bad-digest',args);assert.notEqual(result.status,0);assert.match(result.stderr,value.length===64?/Expected suite digest differs/u:/explicit SHA256/u);assert.equal(fs.existsSync(a.envelopeFile),false);}
  const created=publicCli(a,'create-for-digest-controls',a.create);assert.equal(created.status,0,created.stderr);
  for(const mode of ['verify','observe'])for(const value of ['b'.repeat(64),'not-a-digest']){const args=[mode,'--envelope',a.envelopeFile,'--expected-envelope-sha256',value,...(mode==='observe'?['--output',path.join(a.folder,'uncreated-observation')]:[])];const result=publicCli(a,mode+'-bad-digest',args);assert.notEqual(result.status,0);assert.match(result.stderr,value.length===64?/Execution envelope digest changed/u:/explicit SHA256/u);}
 }finally{a.release();}
});
