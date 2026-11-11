// Synthetic fixtures only; no Office import, process query, package build or native evidence.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest, fileIdentity} from './identity.mjs';
import {tableColorDocument} from './table-colors.mjs';
import {SEVEN_POSTFLIGHT_POLICY, sevenExpectedOperations, assertSevenPostflightReady} from './seven-postflight.mjs';
import {TABLE_POSTFLIGHT_POLICY, tableExpectedOperations, assertTablePostflightReady} from './table-postflight.mjs';
import {assertOwnedStageWire, makeOwnedRequest, writeOwnedRequest, makeOwnedAdmission, writeOwnedAdmission, REQUEST_HASH_TOKEN} from './owned-postflight.mjs';

const stamp='2000-01-01T00:00:00.000Z', hex='a'.repeat(64);
export function syntheticOwnedContext(profile, output=path.resolve('synthetic-owned-output')) {
  const seven=profile==='seven-chart-original-readonly-v2', nativeRoot=path.join(output,seven?'native':'table-colors');
  const sourcePath=path.join(seven?path.join(output,'inputs'):nativeRoot,seven?'case.pptx':'table-colors.pptx');
  const savedPath=path.join(nativeRoot,seven?'saved.pptx':'table-colors-saved.pptx');
  const workerPath=path.join(output,'inputs',seven?'seven-chart-worker.ps1':'native-table-colors-v3.ps1');
  const generation=seven?{}:{expected:tableColorDocument().expected};
  const envelope=seven?{generation:{},controllerRepository:{},node:{},limits:{}}:{output,generationIdentity:{},controller:{}};
  const request={schemaVersion:1,profile,policy:seven?SEVEN_POSTFLIGHT_POLICY:TABLE_POSTFLIGHT_POLICY,envelopeSha256:hex,
    output,node:{path:process.execPath},controller:{},generation:{},snapshots:[],timeoutSeconds:45,runOfficeRequested:true,
    selectedCase:seven?'chart-all-seven':'table-colors',workerPath,nativeRoot,workerArguments:[REQUEST_HASH_TOKEN],
    nativeAcceptance:false,registryAcceptance:false};
  const terminal={timedOut:false,exitCode:0,timeoutSeconds:45,startedAt:stamp,finishedAt:stamp};
  let report, originalArchive;
  if(seven) {
    const shapes=()=>[
      {index:1,id:1,name:'Title',type:1,left:0,top:0,width:1,height:1,rotation:0,hasTextFrame:-1,alternativeText:'',text:'Synthetic'},
      {index:2,id:2,name:'Chart',type:3,left:0,top:1,width:1,height:1,rotation:0,hasTextFrame:0,alternativeText:'',text:null},
    ];
    const phase=()=>({slideCount:7,slides:Array.from({length:7},(_,i)=>({index:i+1,slideId:i+1,name:'Synthetic',shapeCount:2,shapes:shapes()})),
      rasters:Array.from({length:7},(_,i)=>({slideIndex:i+1,path:path.join(nativeRoot,'synthetic-'+i+'.png'),sha256:hex}))});
    report={schemaVersion:2,profile,envelopeSha256:hex,requestSha256:hex,sourceSha256:hex,savedSha256:hex,
      sourcePath,savedPath,workerPath,generation:{},controllerRepository:{},node:{},limits:{},cleanupConfirmed:true,officeOperationsStopped:false,
      error:null,lastStage:'worker.complete',lastStatus:'success',actions:[],closes:2,saveCopies:1,quits:1,
      opens:[{phase:'original',path:sourcePath,readOnly:-1,sha256:hex},{phase:'saved-reopened',path:savedPath,readOnly:-1,sha256:hex}],
      probes:[{matched:true}],phases:{original:phase(),'saved-reopened':phase()}};
    originalArchive={slides:Array.from({length:7},()=>({shapes:[{kind:'title',id:1,name:'Title',text:'Synthetic',geometry:{}},{kind:'chart',id:2,name:'Chart',geometry:{}}]}))};
  } else {
    report={schemaVersion:3,profile,envelopeSha256:hex,requestSha256:hex,generationIdentity:{},executionIdentity:{},cleanupConfirmed:true,
      officeOperationsStopped:false,error:null,lastStage:'worker.complete',lastStatus:'success',nativeAcceptance:false,registryAcceptance:false,
      opens:[],edits:[],savedSha256:hex,editedSha256:hex,inputs:{sourcePath,sourceSha256:hex,generationPath:path.join(nativeRoot,'generation.json'),workerPath,workerSha256:hex,envelopePath:path.join(output,'table-profile.json')}};
    for(const [phase,file] of [['original',sourcePath],['reopened',savedPath],['edited',path.join(nativeRoot,'table-colors-edited.pptx')]]) {
      report.opens.push({phase,path:file,readOnly:-1,archiveSha256:hex});
      report[phase]=generation.expected.map((slide,i)=>({slide:i+1,png:phase+'-'+(i+1)+'.png',pngSha256:hex,
        cells:slide.cells.map(cell=>{
          const prefix=phase==='edited'&&cell.row===2&&cell.column===1?'Native ':'';
          const text=prefix+cell.runs.map(run=>run.text).join('');
          const colors=Array.from({length:prefix.length},()=>cell.runs[0].color).concat(cell.runs.flatMap(run=>Array.from({length:run.text.length},()=>run.color)));
          return {row:cell.row,column:cell.column,text,characters:text.split('').map((character,k)=>({character,color:colors[k]}))};
        })}));
    }
    report.edits=Array.from({length:6},(_,i)=>({slide:i+1,row:2,column:1,before:'Body',after:'Native Body',prefix:'Native '}));
  }
  const names=seven?sevenExpectedOperations(report):tableExpectedOperations(generation);
  function value(name) {
    if(name==='application.initial.count'||name==='application.final.count'||name.endsWith('.preflight.count'))return 0;
    if(name.endsWith('.readOnly'))return -1;
    if(name.endsWith('.slides.count'))return seven?7:6;
    if(seven) {
      if(name==='copy.fullName'||name==='copy.afterName')return sourcePath;
      const phase=name.startsWith('saved-reopened.')?'saved-reopened':'original';
      if(name.endsWith('.fullName'))return phase==='original'?sourcePath:savedPath;
      const match=/^(original|saved-reopened)\.slide\.(\d+)\.shape\.(\d+)\.(\w+)$/u.exec(name);
      if(match)return report.phases[match[1]].slides[Number(match[2])-1].shapes[Number(match[3])-1][match[4]]??null;
      if(name.endsWith('.shapes.count'))return 2;
    } else {
      const phase=name.split('.')[0];
      if(name.endsWith('.save.fullName')||name.endsWith('.save.afterName'))return phase==='original'?sourcePath:savedPath;
      if(name.endsWith('.fullName'))return report.opens.find(open=>open.phase===phase)?.path??null;
      if(name.endsWith('.shapes'))return 1;if(name.endsWith('.hasTable'))return -1;
      if(name.endsWith('.rows')||name.endsWith('.columns'))return 2;
      const match=/^(original|reopened|edited)\.slide\.(\d+)\.cell\.(\d+)\.(\d+)\.(text|character\.(\d+)\.color)$/u.exec(name);
      if(match) {
        const cell=report[match[1]][Number(match[2])-1].cells.find(cell=>cell.row===Number(match[3])&&cell.column===Number(match[4]));
        if(match[5]==='text')return cell.text;
        const color=cell.characters[Number(match[6])-1].color.slice(1);
        return parseInt(color.slice(0,2),16)+(parseInt(color.slice(2,4),16)<<8)+(parseInt(color.slice(4,6),16)<<16);
      }
      if(name.startsWith('edit.')&&name.endsWith('.before'))return 'Body';
      if(name.startsWith('edit.')&&name.endsWith('.after'))return 'Native Body';
    }
    return null;
  }
  const stages=names.flatMap(stage=>stage.startsWith('worker.')?[{stage,status:'success'}]:[{stage,status:'begin'},{stage,status:'success'}])
    .map((s,i)=>({...s,sequence:i+1,timestamp:stamp,value:s.status==='success'?value(s.stage):null,error:'',officeOperationsStopped:false,
      cleanupConfirmed:safeComplete(s.stage),...(seven?{}:{ownedPresentationPath:safeComplete(s.stage)?null:sourcePath})}));
  function safeComplete(stage){return stage==='worker.initialize'||stage==='worker.complete'}
  if (!seven) {
    let owned = null;
    for (const stage of stages) {
      const phase = stage.stage.split('.')[0];
      if (stage.stage === phase + '.open' && stage.status === 'begin') owned = report.opens.find(open => open.phase === phase).path;
      stage.ownedPresentationPath = owned;
      if (stage.stage === phase + '.close' && stage.status === 'success') owned = null;
    }
  }
  const context={terminal,report,request,stages,envelope,profile:envelope,generation,progress:stages.at(-1),inputSha256:hex,sourcePath,savedPath,workerPath,originalArchive,savedArchive:originalArchive};
  return context;
}
export function assertSyntheticContext(context) {
  return context.request.profile==='seven-chart-original-readonly-v2'?assertSevenPostflightReady(context):assertTablePostflightReady(context);
}
export function emitSyntheticAdmission(output, profile, controllerRoot) {
  fs.mkdirSync(path.join(output,'inputs'),{recursive:true});
  const c=syntheticOwnedContext(profile,output);fs.mkdirSync(c.request.nativeRoot);
  const file=(name,bytes)=>{fs.writeFileSync(name,bytes);return name}, json=(name,value)=>file(name,JSON.stringify(value,null,2)+'\n');
  file(c.workerPath,'# Synthetic inert snapshot; never execute.\n');
  const sourceFiles=['owned-postflight.ps1',profile.startsWith('seven')?'seven-postflight.ps1':'table-postflight.ps1','run-reference-chart-profile.ps1']
    .map(name=>path.join(controllerRoot,'scripts/native-acceptance',name));
  c.request.controller={directory:controllerRoot,files:sourceFiles.map(name=>({path:path.relative(controllerRoot,name).split(path.sep).join('/'),...fileIdentity(name)}))};
  c.request.snapshots=[{path:path.relative(output,c.workerPath).split(path.sep).join('/'),...fileIdentity(c.workerPath)}];
  c.request.node={path:process.execPath,version:process.version,identity:fileIdentity(process.execPath)};
  const q=writeOwnedRequest(path.join(output,'execution-request.json'),makeOwnedRequest(c.request));
  c.report.requestSha256=q.identity.sha256;
  const native=c.request.nativeRoot;
  const files=[...sourceFiles,c.workerPath,path.join(output,'execution-request.json')];
  files.push(json(path.join(native,'worker.json'),c.terminal),file(path.join(native,'stages.jsonl'),c.stages.map(s=>JSON.stringify(s)).join('\n')+'\n'));
  if(profile.startsWith('seven'))files.push(json(path.join(native,'report.json'),c.report));
  else files.push(json(path.join(native,'native.json'),c.report),json(path.join(native,'progress.json'),c.progress),json(path.join(native,'generation.json'),c.generation));
  const ready=assertSyntheticContext(c);
  const admission=makeOwnedAdmission({profile,policy:c.request.policy,requestSha256:q.identity.sha256,files,ready});
  return writeOwnedAdmission(path.join(output,'postflight-admission.json'),admission);
}

if(process.argv[2]==='--emit-fixture') {
  const output=path.resolve(process.argv[3]),profile=process.argv[4],root=path.resolve(process.argv[5]);
  console.log(JSON.stringify(emitSyntheticAdmission(output,profile,root)));
} else {
  for(const profile of ['seven-chart-original-readonly-v2','table-colors-v3']) {
    test(profile+' exact synthetic operation stream',()=>assert.equal(assertSyntheticContext(syntheticOwnedContext(profile)).workerCleanupConfirmed,true));
    const mutations=[
      ['timeout',c=>{c.terminal.timedOut=true}],['exit code',c=>{c.terminal.exitCode=1}],['foreign profile',c=>{c.request.profile='unsupported'}],
      ['RunOffice false',c=>{c.request.runOfficeRequested=false}],['policy timing changed',c=>{c.request.policy={...c.request.policy,budgetMilliseconds:5001}}],
      ['cleanup false',c=>{c.report.cleanupConfirmed=false}],['stopped',c=>{c.report.officeOperationsStopped=true}],
      ['report error',c=>{c.report.error='synthetic failure'}],['missing report error',c=>{delete c.report.error}],
      ['missing complete',c=>{c.stages.pop()}],['missing close',c=>{c.stages=c.stages.filter(s=>!s.stage.endsWith('.close'))}],
      ['extra operation',c=>{c.stages.splice(1,0,{...c.stages[1]})}],['out of order',c=>{[c.stages[1],c.stages[3]]=[c.stages[3],c.stages[1]]}],
      ['wrong read-only',c=>{c.report.opens[0].readOnly=0}],['foreign owned path',c=>{c.report.opens[0].path=path.join(c.request.output,'foreign.pptx')}],
      ['nonempty final application',c=>{c.stages.find(s=>s.stage==='application.final.count'&&s.status==='success').value=1}],
    ];
    for(const [name,mutate] of mutations)test(profile+' refuses '+name,()=>{const c=syntheticOwnedContext(profile);mutate(c);assert.throws(()=>assertSyntheticContext(c))});
  }
  for(const error of [null,''])test('lossless successful error '+JSON.stringify(error),()=>{
    const c=syntheticOwnedContext('seven-chart-original-readonly-v2');for(const stage of c.stages)stage.error=error;
    const bytes=Buffer.from(c.stages.map(s=>JSON.stringify(s)).join('\n')+'\n'),before=digest(bytes);assertOwnedStageWire(bytes);assert.equal(digest(bytes),before);
  });
  for(const variant of ['missing','message','object','gap','clock','unknown-status'])test('raw wire refuses '+variant,()=>{
    const stages=syntheticOwnedContext('seven-chart-original-readonly-v2').stages;
    if(variant==='missing')delete stages[0].error;if(variant==='message')stages[0].error='failed';if(variant==='object')stages[0].error={};
    if(variant==='gap')stages[0].sequence=2;if(variant==='clock')stages[0].timestamp='invalid';if(variant==='unknown-status')stages[0].status='skipped';
    assert.throws(()=>assertOwnedStageWire(Buffer.from(stages.map(s=>JSON.stringify(s)).join('\n')+'\n')));
  });
  for(const variant of ['prefix','character getter','table dimensions','two phases','wrong actual RGB'])test('table exhaustive grammar refuses '+variant,()=>{
    const c=syntheticOwnedContext('table-colors-v3');
    if(variant==='prefix')c.report.edits.pop();
    if(variant==='character getter')c.stages=c.stages.filter(s=>s.stage!=='original.slide.1.cell.1.1.character.1.color');
    if(variant==='table dimensions')c.stages.find(s=>s.stage==='original.slide.1.rows'&&s.status==='success').value=3;
    if(variant==='two phases')c.report.edited=[];
    if(variant==='wrong actual RGB')c.stages.find(s=>s.stage==='original.slide.1.cell.1.1.character.1.color'&&s.status==='success').value=123;
    assert.throws(()=>assertSyntheticContext(c));
  });
}

