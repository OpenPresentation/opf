// Full actual pre-observer function body, real filesystem/hash/path guards,
// synthetic source-authority boundary. No product build/export, Office or
// process observation; no injectable bypass is added to production APIs.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,realpathSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {verifyB07Postflight,assertB07Case10Phases,B07_PROFILE} from './b07-current-profile.mjs';
import {B07_POSTFLIGHT_POLICY,B07_COMPLETED_LIFECYCLE,assertB07PostflightReady} from './b07-postflight.mjs';
import {digest} from './identity.mjs';
import {plainLocalPath} from './reference-chart-profile.mjs';
import {assertTableOutputSeparate,tableAsset,tableFileRecords} from './table-profile.mjs';

test('full pre-observer verifier refuses changed source/runtime/snapshots/request/report/stages before observation',async()=>{
  const scratch=realpathSync(mkdtempSync(path.join(os.tmpdir(),'opf-b07-preobserver-')));
  const files=new Map(),changed=new Set();
  const put=(file,bytes)=>{bytes=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,bytes);files.set(file,bytes);return bytes;};
  const json=value=>Buffer.from(JSON.stringify(value));
  const record=(relative,bytes)=>({path:relative,bytes:bytes.length,sha256:digest(bytes)});
  const mutateFile=(file,bytes)=>{changed.add(file);writeFileSync(file,bytes);};
  const mutateJson=(file,mutate)=>{const value=JSON.parse(readFileSync(file));mutate(value);mutateFile(file,json(value));};
  const root=path.join(scratch,'controller'),output=path.join(scratch,'run'),prepared=path.join(scratch,'prepared'),worker=path.join(scratch,'worker'),consumer=path.join(scratch,'consumer');
  try {
    const sourceFile=path.join(root,'source.txt'),runtimeFile=path.join(consumer,'dist/runtime.js');
    const sourceBytes=put(sourceFile,'Synthetic pinned controller; not a prepared native authority\n'),runtimeBytes=put(runtimeFile,'// synthetic runtime identity; never imported\n');
    const input=Buffer.from('Synthetic input, not an Office archive'),saved=Buffer.from('Synthetic saved bytes, not an Office archive');
    const snapshotData={'inputs/suite.json':json({synthetic:true}),'inputs/case.pptx':input,'inputs/source.opf.json':json({synthetic:true}),'inputs/action-plan.json':json([]),'inputs/text-probe-plan.json':json({synthetic:true}),'inputs/source-mapping.json':json({synthetic:true})};
    const snapshots=Object.entries(snapshotData).map(([name,bytes])=>{put(path.join(output,name),bytes);return record(name,bytes);});
    const workerFiles=['native-furniture-control.ps1','native-process.ps1'].map(name=>{const bytes=put(path.join(worker,'packages/pptx/test',name),'# Synthetic '+name+'; never executed\n');put(path.join(output,'native/inputs',name),bytes);return record('packages/pptx/test/'+name,bytes);});
    const envelope={output:prepared,spec:{suiteDirectory:path.join(scratch,'suite'),producerRepository:path.join(scratch,'producer'),consumer,workerRepository:worker,probeSha256:digest(snapshotData['inputs/text-probe-plan.json'])},snapshots,workerRepository:{files:workerFiles}};
    for(const directory of [prepared,envelope.spec.suiteDirectory,envelope.spec.producerRepository])mkdirSync(directory,{recursive:true});
    const envelopeFile=path.join(prepared,'execution-envelope.json'),envelopeBytes=put(envelopeFile,json({synthetic:true,scope:'Not native qualification'})),sha=digest(envelopeBytes);
    put(path.join(output,'execution-envelope.json'),envelopeBytes);
    const metadata=(original,snapshot,bytes)=>({path:path.join(output,original),sha256:digest(bytes),snapshotPath:path.join(output,snapshot),snapshotSha256:digest(bytes)});
    const request={captureTextFonts:true,readOnlySurvey:false,source:metadata('inputs/case.pptx','native/inputs/input.pptx',input),actionPlan:{...metadata('inputs/action-plan.json','native/inputs/action-plan.json',snapshotData['inputs/action-plan.json']),count:0},textProbePlan:metadata('inputs/text-probe-plan.json','native/inputs/text-probe-plan.json',snapshotData['inputs/text-probe-plan.json'])};
    put(request.source.snapshotPath,input);put(request.actionPlan.snapshotPath,snapshotData['inputs/action-plan.json']);put(request.textProbePlan.snapshotPath,snapshotData['inputs/text-probe-plan.json']);
    for(const [index,key]of ['verifier','processHelper'].entries()){const file=workerFiles[index];request[key]={path:path.join(worker,file.path),sha256:file.sha256,snapshotPath:path.join(output,'native/inputs',path.basename(file.path)),snapshotSha256:file.sha256};}
    const terminal={timedOut:false,exitCode:0,cleanupConfirmed:true,lastDurableStage:'worker.complete',lastDurableStatus:'success'};
    const savedPath=path.join(output,'native/native-furniture-control.pptx');put(savedPath,saved);
    const report={cleanupConfirmed:true,officeOperationsStopped:false,error:null,lastStage:'worker.complete',lastStatus:'success',captureTextFonts:true,readOnlySurvey:false,phases:{original:{},edited:{},reopened:{}},source:{path:request.source.path,sha256:request.source.sha256,openedPath:request.source.snapshotPath,openedSha256:request.source.snapshotSha256},actionPlan:{...request.actionPlan,actions:[],completed:[]},textProbePlan:request.textProbePlan,inputs:{verifier:request.verifier,processHelper:request.processHelper},saved:{path:savedPath,sha256:digest(saved)},reopened:{path:savedPath,sha256:digest(saved)}};
    const stages=B07_COMPLETED_LIFECYCLE.map((stage,index)=>({sequence:index+1,stage,status:'success',error:index%2?'':null,officeOperationsStopped:false,cleanupConfirmed:true,ownedPresentationPath:null}));
    const runner={schemaVersion:1,profile:B07_PROFILE,postflightPolicy:B07_POSTFLIGHT_POLICY,envelopeSha256:sha,caseId:'synthetic-no-native',runOfficeRequested:true,status:'native-worker-completed; bounded-postflight-pending',nativeAcceptance:false,registryAcceptance:false,timeoutSeconds:45,snapshots:[record('execution-envelope.json',envelopeBytes),...snapshots]};
    const runnerFile=path.join(output,'runner.json'),requestFile=path.join(output,'native/request.json'),reportFile=path.join(output,'native/report.json'),stageFile=path.join(output,'native/stages.jsonl');
    put(runnerFile,json(runner));put(requestFile,json(request));put(reportFile,json(report));put(stageFile,stages.map(stage=>JSON.stringify(stage)).join('\n')+'\n');put(path.join(output,'native/supervisor.json'),json(terminal));
    let bindingCalls=0,beforeSecondBinding;
    const bindB07Profile=async(file,expectedSha)=>{
      bindingCalls++;if(bindingCalls===2&&beforeSecondBinding)beforeSecondBinding();
      assert.equal(file,envelopeFile);assert.equal(expectedSha,sha);assert.equal(digest(readFileSync(envelopeFile)),sha);
      // Actual maintained hash/regular-path guards over synthetic source inputs.
      await tableFileRecords(root,[record('source.txt',sourceBytes)]);
      await tableFileRecords(consumer,[record('dist/runtime.js',runtimeBytes)]);
      await tableFileRecords(worker,workerFiles);
      return {envelope,source:{selected:{id:runner.caseId,archiveSha256:digest(input)}}};
    };
    const dependencies={bindB07Profile,plainLocalPath,assertTableOutputSeparate,root,tableAsset,digest,nativeJson:bytes=>JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u,'')),assert,path,B07_PROFILE,B07_POSTFLIGHT_POLICY,integer:(value,min,max)=>assert.ok(Number.isSafeInteger(value)&&value>=min&&value<=max),tableFileRecords,assertB07PostflightReady,assertB07Case10Phases};
    // The production function has no options/test bypass. Evaluate its exact
    // exported body in an isolated authority context; all payload guards below
    // that existing expensive preparation boundary are the production code.
    const invoke=new Function(...Object.keys(dependencies),`'use strict';return (${verifyB07Postflight.toString()});`)(...Object.values(dependencies));
    const positive=await invoke(envelopeFile,sha,output);assert.equal(positive.ready.workerCleanupConfirmed,true);assert.equal(bindingCalls,2);await tableFileRecords(output,positive.rows);
    const mutations=[
      ()=>mutateFile(sourceFile,Buffer.concat([sourceBytes,Buffer.from('changed')])),
      ()=>mutateFile(runtimeFile,Buffer.concat([runtimeBytes,Buffer.from('changed')])),
      ()=>mutateFile(path.join(worker,workerFiles[0].path),Buffer.from('changed worker source')),
      ()=>mutateJson(runnerFile,value=>{value.status='failed; preserve-output; no-retry';}),
      ()=>mutateJson(runnerFile,value=>{value.postflightPolicy.budgetMilliseconds=5001;}),
      ()=>mutateFile(path.join(output,'execution-envelope.json'),Buffer.concat([envelopeBytes,Buffer.from(' ')])),
      ()=>mutateFile(path.join(output,'inputs/case.pptx'),Buffer.from('changed original snapshot')),
      ()=>mutateJson(requestFile,value=>{value.source.path=path.join(output,'foreign.pptx');}),
      ()=>mutateJson(requestFile,value=>{value.source.snapshotPath=path.join(output,'native/foreign.pptx');}),
      ()=>mutateJson(requestFile,value=>{value.source.sha256='0'.repeat(64);}),
      ()=>mutateFile(request.source.snapshotPath,Buffer.from('changed native input snapshot')),
      ()=>mutateJson(reportFile,value=>{value.source.openedSha256='0'.repeat(64);}),
      ()=>mutateJson(requestFile,value=>{value.verifier.path+='-foreign';}),
      ()=>mutateJson(requestFile,value=>{value.verifier.snapshotSha256='0'.repeat(64);}),
      ()=>mutateFile(request.verifier.snapshotPath,Buffer.from('changed verifier snapshot')),
      ()=>{mutateJson(requestFile,value=>{value.verifier.path+='-foreign';});mutateJson(reportFile,value=>{value.inputs.verifier.path+='-foreign';});},
      ()=>{const forged=Buffer.from('self-consistent foreign verifier snapshot'),hash=digest(forged);mutateFile(request.verifier.snapshotPath,forged);mutateJson(requestFile,value=>{value.verifier.sha256=hash;value.verifier.snapshotSha256=hash;});mutateJson(reportFile,value=>{value.inputs.verifier.sha256=hash;value.inputs.verifier.snapshotSha256=hash;});},
      ()=>mutateJson(reportFile,value=>{value.inputs.processHelper.sha256='0'.repeat(64);}),
      ()=>mutateFile(savedPath,Buffer.concat([saved,Buffer.from('changed')])),
      ()=>mutateJson(reportFile,value=>{value.saved.path+='-foreign';}),
      ()=>{const changedStages=structuredClone(stages);changedStages[1].error='failure';mutateFile(stageFile,changedStages.map(stage=>JSON.stringify(stage)).join('\n')+'\n');},
      ()=>mutateJson(path.join(output,'native/supervisor.json'),value=>{value.timedOut=true;}),
      ()=>{beforeSecondBinding=()=>mutateFile(sourceFile,Buffer.from('source changed before final rebind'));},
    ];
    for(const mutate of mutations){
      bindingCalls=0;beforeSecondBinding=undefined;let observationStarts=0;mutate();
      try { await assert.rejects(async()=>{await invoke(envelopeFile,sha,output);observationStarts++;});assert.equal(observationStarts,0); }
      finally {for(const file of changed)writeFileSync(file,files.get(file));changed.clear();}
    }
    bindingCalls=0;beforeSecondBinding=undefined;assert.equal((await invoke(envelopeFile,sha,output)).ready.workerCleanupConfirmed,true);assert.equal(bindingCalls,2);
    for(const [file,bytes]of files)assert.deepEqual(readFileSync(file),bytes);
  } finally {assert.ok(path.basename(scratch).startsWith('opf-b07-preobserver-'));rmSync(scratch,{recursive:true,force:true});}
});
