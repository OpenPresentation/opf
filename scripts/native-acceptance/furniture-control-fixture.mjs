// Synthetic owned-record controls only. These bytes must never reach Office.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {FURNITURE_PROFILE,FURNITURE_POLICY,FURNITURE_COMPLETED_LIFECYCLE,assertFurnitureReady} from './furniture-profile.mjs';
import {fileIdentity,digest} from './identity.mjs';
const root=fs.realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
const json=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
export function furnitureFixture(output=path.join(root,'synthetic-furniture-never-office')){
 const input=path.join(output,'native/inputs/input.pptx'),saved=path.join(output,'native/native-furniture-control.pptx');
 const request={schemaVersion:1,profile:FURNITURE_PROFILE,policy:FURNITURE_POLICY,timeoutSeconds:45,nativeAcceptance:false,registryAcceptance:false,caseId:'feature-metrics',runOfficeRequested:true,readOnlySurvey:false,captureTextFonts:false,actionPlan:{actions:[]},output,controller:{directory:root},slideCount:1};
 const report={schemaVersion:1,cleanupConfirmed:true,officeOperationsStopped:false,error:null,lastStage:'worker.complete',lastStatus:'success',captureTextFonts:false,readOnlySurvey:false,globalPreflight:{policy:'strict-name-query-v1',count:0},actionPlan:{actions:[],completed:[]},source:{openedPath:input},saved:{path:saved},phases:{}};
 for(const phase of ['original','edited','reopened'])report.phases[phase]={slideCount:1,slides:[{index:1,shapeCount:0,shapes:[]}],rasters:[{slideIndex:1}]};
 const terminal={timedOut:false,exitCode:0,cleanupConfirmed:true,lastDurableStage:'worker.complete',lastDurableStatus:'success'};
 const names=FURNITURE_COMPLETED_LIFECYCLE;let sequence=0;
 const stages=[];for(const name of names){
  const clear=name.startsWith('worker.')||name.startsWith('application.')||name==='preflight.globalIdle'||name.endsWith('.cleanup');
  const ownedPresentationPath=clear?null:name.startsWith('reopen')?saved:input;
  for(const status of name.startsWith('worker.')||name.endsWith('.cleanup')?['success']:['begin','success'])stages.push({sequence:++sequence,timestamp:'2026-11-11T12:00:00.000Z',stage:name,status,error:'',cleanupConfirmed:clear,officeOperationsStopped:false,ownedPresentationPath});
 }
 const bytes=Buffer.from(stages.map(s=>JSON.stringify(s)).join('\n')+'\n');
 const ready=assertFurnitureReady(terminal,report,request,bytes);
 const admission={schemaVersion:1,profile:FURNITURE_PROFILE,policy:FURNITURE_POLICY,requestSha256:digest(json(request)),ready,files:[],nativeAcceptance:false,registryAcceptance:false};
 const kernel={timedOut:false,exitCode:0,timeoutSeconds:45,startedAt:'2026-11-11T12:00:00.000Z',finishedAt:'2026-11-11T12:00:01.000Z'};return {terminal,report,request,stages,admission,kernel};
}
export function writeFurnitureFixture(output,e=furnitureFixture(output)){
 fs.mkdirSync(output,{recursive:false});fs.mkdirSync(path.join(output,'native'));
 for(const [name,value]of [['execution-request.json',e.request],['native/report.json',e.report],['native/supervisor.json',e.terminal],['native/worker.json',e.kernel]])fs.writeFileSync(path.join(output,name),json(value),{flag:'wx'});
 fs.writeFileSync(path.join(output,'native/stages.jsonl'),e.stages.map(s=>JSON.stringify(s)).join('\n')+'\n',{flag:'wx'});
 const files=['execution-request.json','native/report.json','native/supervisor.json','native/worker.json','native/stages.jsonl'].map(n=>path.join(output,n));
 files.push(...['furniture-postflight.ps1','owned-postflight.ps1','run-reference-chart-profile.ps1'].map(n=>path.join(root,'scripts/native-acceptance',n)));
 e.admission.files=files.map(file=>({file,...fileIdentity(file)}));const admission=path.join(output,'postflight-admission.json');fs.writeFileSync(admission,json(e.admission),{flag:'wx'});
 return {file:admission,sha256:fileIdentity(admission).sha256};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){if(process.argv.length!==3)throw Error('Synthetic fixture requires one fresh output');console.log(JSON.stringify(writeFurnitureFixture(process.argv[2])));}
