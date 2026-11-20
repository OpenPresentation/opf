// Test-owned records only. No genuine PPTX/Office/runtime/source authority.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {digest,fileIdentity} from './identity.mjs';
import {CURRENT_VALUE_PROFILE} from './seven-value-current.mjs';
import {VALUE_POLICY,expectedSevenValueRequest,sevenValueOperations,sevenValueCriticalProbes,assertSevenValueReady} from './seven-value-profile.mjs';
import {writeOwnedRequest} from './owned-postflight.mjs';
import {SEVEN_SUPERVISOR} from './seven-chart-profile.mjs';
const ROOT=fs.realpathSync(fileURLToPath(new URL('../../',import.meta.url))),stamp='2000-01-01T00:00:00.000Z';
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const put=(file,bytes)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});return fileIdentity(file);};
export function syntheticValueControl(root){
 assert.equal(fs.existsSync(root),false);fs.mkdirSync(root);root=fs.realpathSync(root);
 const directory=path.join(root,'output'),controller=path.join(root,'synthetic-controller');fs.mkdirSync(directory);fs.mkdirSync(path.join(directory,'inputs'));fs.mkdirSync(path.join(directory,'native'));
 const generation={caseId:'SYNTHETIC',provenance:{}};for(const field of ['suiteDirectory','preparationRepository','workerRepository','consumer']){generation[field]=path.join(root,field);fs.mkdirSync(generation[field]);}
 const input=Buffer.from('SYNTHETIC INERT BYTES; NOT A PPTX'),action={op:'set-seven-series-values',slideIndex:1,shapeId:2,shapeName:'Chart',branch:'choice',sourceType:'treemap',comChartType:117,seriesIndex:1,maxSeriesCount:1,seriesName:'Value',chartPart:'ppt/charts/chartEx1.xml',chartFamily:'chartEx',dataId:'0',dimensionIndex:1,layoutId:'treemap',dataFormula:'Sheet1!$B$2:$B$5',workbookPart:'ppt/embeddings/book.xlsx',worksheet:'Sheet1',workbookCells:['B2','B3','B4','B5'],pointIndex:1,expectedValues:[42,31,-8,19],newValues:[43,31,-8,19],inputSha256:digest(input),sourceModelSha256:'a'.repeat(64)};
 const actionBytes=json(action),actionModelSha256=digest(Buffer.from(JSON.stringify(action))),actionFileIdentity={bytes:actionBytes.length,sha256:digest(actionBytes)};
 const base={generation,controllerRepository:{directory:controller,revision:'a'.repeat(40),dirty:false,files:[]},node:{path:process.execPath,version:process.version,identity:{bytes:0,sha256:'a'.repeat(64)}},limits:{maxActions:0}};
 const envelope={schemaVersion:1,profile:CURRENT_VALUE_PROFILE,base,limits:{maxActions:1},selection:{slideIndex:1,seriesIndex:1,pointIndex:1,newValue:43},action,actionModelSha256,actionFileIdentity};
 const envelopeFile=path.join(root,'synthetic-envelope.json'),envelopeBytes=json(envelope);put(envelopeFile,envelopeBytes);
 const worker=Buffer.from('# Test-owned inert snapshot; NEVER execute\n');put(path.join(controller,'scripts/native-acceptance/seven-value-worker.ps1'),worker);
 const supervisor=fs.readFileSync(path.join(ROOT,'packages/pptx/test/native-process.ps1'));assert.deepEqual({path:SEVEN_SUPERVISOR.path,bytes:supervisor.length,sha256:digest(supervisor)},SEVEN_SUPERVISOR);
 const copies=[['execution-envelope.json',envelopeBytes],['inputs/case.pptx',input],['inputs/action.json',actionBytes],['inputs/seven-value-worker.ps1',worker],['inputs/native-process.ps1',supervisor]],snapshots=copies.map(([name,bytes])=>({path:name,...put(path.join(directory,name),bytes)}));
 const binding={envelope,envelopeSha256:digest(envelopeBytes),input,target:{action},directory,snapshots},runner={schemaVersion:1,profile:CURRENT_VALUE_PROFILE,envelopeSha256:binding.envelopeSha256,timeoutSeconds:45,runOfficeRequested:true,status:'prepared-native-request; execution-not-acceptance',snapshots,request:null};
 const request=expectedSevenValueRequest(binding,directory,runner,snapshots),requestBinding=writeOwnedRequest(path.join(directory,'execution-request.json'),request);runner.request=requestBinding.identity;put(path.join(directory,'runner.json'),json(runner));Object.assign(binding,{runner,requestBinding:{request,identity:requestBinding.identity}});
 const archive={slides:Array.from({length:7},(_,index)=>({index:index+1,part:'ppt/slides/slide'+(index+1)+'.xml',shapes:[{kind:'title',id:1,name:'Title',branch:'direct',text:'Synthetic',geometry:{}},{kind:'chart',id:2,name:'Chart',branch:'choice',chartPart:'synthetic',uri:'synthetic',chart:{},geometry:{}}]}))};binding.archive=archive;
 const phase=()=>({slideCount:7,slides:Array.from({length:7},(_,index)=>({index:index+1,slideId:index+256,name:'Synthetic',shapeCount:2,shapes:[{index:1,id:1,name:'Title',type:14,left:0,top:0,width:1,height:1,rotation:0,hasTextFrame:-1,text:'Synthetic',alternativeText:''},{index:2,id:2,name:'Chart',type:3,left:0,top:1,width:1,height:1,rotation:0,hasTextFrame:0,text:null,alternativeText:''}]})),rasters:Array.from({length:7},(_,index)=>({slideIndex:index+1,path:'SYNTHETIC',sha256:'a'.repeat(64)}))});
 const sourcePath=path.join(directory,'inputs/case.pptx'),savedPath=path.join(directory,'native/saved.pptx'),workerPath=path.join(directory,'inputs/seven-value-worker.ps1');put(savedPath,Buffer.from('SYNTHETIC SAVED; NOT A PPTX'));
 const report={schemaVersion:3,profile:CURRENT_VALUE_PROFILE,envelopeSha256:binding.envelopeSha256,requestSha256:requestBinding.identity.sha256,sourcePath,sourceSha256:digest(input),savedPath,savedSha256:fileIdentity(savedPath).sha256,workerPath,workerSha256:fileIdentity(workerPath).sha256,generation:structuredClone(generation),controllerRepository:structuredClone(base.controllerRepository),node:structuredClone(base.node),limits:structuredClone(envelope.limits),error:null,officeOperationsStopped:false,cleanupConfirmed:true,lastStage:'worker.complete',lastStatus:'success',closes:2,saveCopies:1,quits:1,phases:{original:phase(),'saved-reopened':phase()},opens:[{phase:'original',path:sourcePath,readOnly:-1,sha256:digest(input)},{phase:'saved-reopened',path:savedPath,readOnly:-1,sha256:fileIdentity(savedPath).sha256}],actions:[{op:action.op,actionModelSha256,actionFileIdentity:structuredClone(actionFileIdentity),status:'success',setterAttempts:1,before:[...action.expectedValues],after:[...action.newValues],reopened:[...action.newValues],observedKind:'System.Array',observedRank:1,observedLength:4,observedValues:[...action.newValues]}],probes:[]};
 report.probes=sevenValueCriticalProbes(report,action);
 function value(name){
  if(name==='preflight.globalIdle'||name==='application.initial.count'||name==='application.final.count'||name.endsWith('.preflight.count'))return 0;
  if(name.endsWith('.readOnly')||name.endsWith('.hasChart'))return -1;if(name.endsWith('.slides.count'))return 7;if(name.endsWith('.shapes.count'))return 2;if(name.endsWith('.chart.type'))return 117;if(name.endsWith('.series.count'))return 1;if(name.endsWith('.series.name'))return 'Value';
  if(name.endsWith('.values.get'))return '[unsupported non-primitive value]';
  if(name.endsWith('.fullName')||name==='copy.afterName')return name.startsWith('saved-reopened.')||name.startsWith('value.saved-reopened.')?savedPath:sourcePath;
  let found=/^(original|saved-reopened)\.slide\.(\d+)\.shape\.(\d+)\.(\w+)$/u.exec(name);if(found)return report.phases[found[1]].slides[Number(found[2])-1].shapes[Number(found[3])-1][found[4]]??null;
  found=/^value\.(original|saved-reopened)\.target\.shape\.(\d+)\.(id|name)$/u.exec(name);if(found)return report.phases[found[1]].slides[0].shapes[Number(found[2])-1][found[3]];
  return null;
 }
 const operations=sevenValueOperations(report,action),stages=operations.flatMap(stage=>stage.startsWith('worker.')?[{stage,status:'success'}]:[{stage,status:'begin'},{stage,status:'success'}]).map((row,index)=>({...row,sequence:index+1,timestamp:stamp,value:row.status==='success'?value(row.stage):null,error:'',officeOperationsStopped:false,cleanupConfirmed:row.stage==='worker.initialize'||row.stage==='worker.complete'}));
 const terminal={timedOut:false,exitCode:0,timeoutSeconds:45,startedAt:stamp,finishedAt:stamp},ready=assertSevenValueReady(binding,terminal,report,stages,archive);
 const reportFile=path.join(directory,'native/report.json'),stageFile=path.join(directory,'native/stages.jsonl'),terminalFile=path.join(directory,'native/worker.json');put(reportFile,json(report));put(stageFile,Buffer.from(stages.map(row=>JSON.stringify(row)).join('\n')+'\n'));put(terminalFile,json(terminal));
 const files=[reportFile,stageFile,terminalFile,...snapshots.map(record=>path.join(directory,record.path)),path.join(directory,'execution-request.json'),...['owned-postflight.ps1','seven-postflight.ps1','seven-value-postflight.ps1','run-reference-chart-profile.ps1'].map(name=>path.join(ROOT,'scripts/native-acceptance',name))].map(file=>({file,...fileIdentity(file)}));
 const admission={schemaVersion:1,profile:CURRENT_VALUE_PROFILE,policy:VALUE_POLICY,requestSha256:requestBinding.identity.sha256,ready,files,nativeAcceptance:false,registryAcceptance:false};
 const evidence={admission,request,report,terminal,stages},admissionFile=path.join(directory,'postflight-admission.json');put(admissionFile,json(admission));
 const result={synthetic:true,nativeAcceptance:false,root,directory,envelopeFile,binding,archive,evidence,operations,controllerRoot:ROOT,admissionFile};
 put(path.join(root,'synthetic-context.json'),json(result));return result;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){assert.deepEqual(process.argv.slice(2,3),['--emit-synthetic']);const result=syntheticValueControl(process.argv[3]);console.log(JSON.stringify({fixture:path.join(result.root,'synthetic-context.json')}));}
