import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const parse = (b) => JSON.parse(b.toString('utf8').replace(/^\uFEFF/, ''));
const receipt = parse(fs.readFileSync(path.join(here, 'receipt.json')));
const packed = fs.readFileSync(path.join(here, receipt.raw.path));
assert.equal(packed.length, receipt.raw.bytes);
assert.equal(sha(packed), receipt.raw.sha256);
const raw = zlib.gunzipSync(packed);
assert.equal(raw.length, receipt.raw.expandedBytes);
const records = parse(raw).records;
assert.equal(records.length, receipt.raw.records);
assert.equal(new Set(records.map((r) => r.key)).size, records.length);
assert.equal(records.reduce((n,r)=>n+r.bytes,0), receipt.raw.totalRecordBytes);
const files = new Map();
for (let i=0;i<records.length;i++) {
  const {base64,...identity}=records[i];
  assert.deepEqual(identity,receipt.files[i]);
  assert(!identity.key.split('/').includes('..'));
  const b=Buffer.from(base64,'base64');
  assert.equal(b.length,identity.bytes,identity.key);
  assert.equal(sha(b),identity.sha256,identity.key);
  files.set(identity.key,b);
  if(process.argv.includes('--check-originals')&&!identity.source.startsWith(receipt.sourceRevision+':')) assert.deepEqual(fs.readFileSync(identity.source),b,'Live original changed: '+identity.source);
}
const get=(key)=>{assert(files.has(key),'Missing record: '+key);return files.get(key);};
const json=(key)=>parse(get(key));
const git=(a)=>execFileSync('git',a,{cwd:repo,maxBuffer:32*1024*1024});
assert.equal(receipt.sourceRevision,'08976a2f12544d92f1135d9fe827c39b438373ee');
for(const [p,oid]of Object.entries(receipt.sourceObjectIdentities)) {
  assert.equal(git(['rev-parse','HEAD:'+p]).toString().trim(),oid,'Protected tree changed: '+p);
  assert.equal(git(['rev-parse',receipt.sourceRevision+':'+p]).toString().trim(),oid);
}
const e=json('native-run/execution-envelope.json');
const o=json('native-run/reference-chart-observation.json');
const report=json('native-run/native/report.json');
const supervisor=json('native-run/native/supervisor.json');
const runner=json('native-run/runner.json');
assert.equal(sha(get('native-run/execution-envelope.json')),receipt.envelopeSha256);
assert.equal(receipt.envelopeSha256,'f2631c0f195674f43f1942d63a730d5f5d6927d5f973cb19fe5be740970425ef');
for(const j of [e,o,report,runner]) assert.equal(j.controllerRepository.revision,receipt.sourceRevision);
for(const j of [e,o,report,runner,supervisor]) {assert.equal(j.nativeAcceptance??false,false);assert.equal(j.registryAcceptance??false,false);}
assert.equal(e.generation.provenance.suiteRepository.revision,receipt.sourceRevision);
assert.equal(o.runtimeRoutes.binding.packagesSha256,receipt.consumerIdentitySha256);
assert.equal(receipt.consumerIdentitySha256,'0663f619edf784067ecd8152704d2400507cf507efeb27ae20bea38e8ca49ff8');
assert.deepEqual(json('admission-envelopes/reference-native-lines.json'),e);
for(const code of e.controllerRepository.files) {
  const key='code/'+code.path;
  assert.equal(sha(get(key)),code.sha256);
  assert.deepEqual(git(['show',receipt.sourceRevision+':'+code.path]),get(key));
}
assert.equal(sha(get('native-run/inputs/reference-chart-worker.ps1')),receipt.workerSha256);
assert.equal(receipt.workerSha256,'642cbe4b9d9a770a30a61bce804b68f87b5f083fca16e4feff2d9246972e2cda');
assert.equal(sha(get('native-run/inputs/native-process.ps1')),receipt.supervisorSha256);
assert.equal(receipt.supervisorSha256,'b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c');
assert.deepEqual(json('native-run/inputs/action-plan.json'),[]);
assert.equal(sha(get('native-run/inputs/case.pptx')),receipt.inputSha256);
assert.equal(sha(get('native-run/native/saved.pptx')),receipt.savedSha256);
assert.equal(receipt.inputSha256,'77305632e835d3fbf4e5348ec29eaddf916f0894896ac06988e431e7f575f748');
assert.equal(receipt.savedSha256,'850f10044211acaed135951c6730a5a63e178091f2cd5389833b837273aa56c0');
assert.equal(sha(get('generation/'+e.generation.selectedCase.source)),receipt.sourceSha256);
assert.equal(sha(get('generation/suite.json')),e.generation.manifestSha256);
assert.equal(report.opens.length,2);assert.equal(report.closes,2);assert.equal(report.saveCopies,1);assert.equal(report.quits,1);assert.equal(report.actions.length,0);
assert(report.opens.every((r)=>r.readOnly===-1),'Recorded MsoTriState msoTrue must remain literal -1');
assert.equal(report.cleanupConfirmed,true);assert.equal(report.error,null);assert.equal(report.lastStage,'worker.complete');
assert.equal(report.probes.length,163);assert(report.probes.every((r)=>r.matched===true));
assert.equal(supervisor.exitCode,0);assert.equal(supervisor.timedOut,false);assert.equal(supervisor.cleanupConfirmed,true);assert.equal(supervisor.workerCleanupConfirmed,true);
assert.equal(supervisor.postflight.sampleCount,1);assert.equal(supervisor.postflight.initialCount,0);assert.equal(supervisor.postflight.finalCount,0);assert.equal(supervisor.postflight.observedZero,true);assert.equal(supervisor.postflight.officeActions,0);
assert(supervisor.postflight.elapsedMilliseconds<5000);assert(supervisor.postflight.finishedElapsedMilliseconds<5000);
assert.equal(runner.timeoutSeconds,45);assert.equal(runner.runOfficeRequested,true);
for(const phase of ['original','saved-reopened']) {assert.equal(report.phases[phase].slideCount,3);assert.equal(report.phases[phase].slides.length,3);}
for(let i=1;i<=3;i++) {
  const a=get('native-run/native/original-0'+i+'.png'),b=get('native-run/native/saved-reopened-0'+i+'.png');
  assert.deepEqual(a,b,'Original/reopened raster bytes differ');
  assert.equal(sha(a),o.pngs.find((r)=>r.phase==='original'&&r.slide===i).sha256);
}
assert.equal(new Set(o.pngs.map((r)=>r.sha256)).size,3);
for(const r of receipt.direct) {const b=fs.readFileSync(path.join(here,r.path));assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);const source=records.find((v)=>v.source===r.source);assert(source);assert.deepEqual(b,get(source.key));}
assert.deepEqual(o.findings.map((finding)=>Object.fromEntries(['code','slide','phase'].filter((key)=>Object.hasOwn(finding,key)).map((key)=>[key,finding[key]]))),receipt.facts.findings);
assert.equal(o.findings.length,7);
assert.deepEqual(o.imported.original.document.slides.map((s)=>s.chart.referenceLines?.length??0),[2,1,0]);
assert.deepEqual(o.imported['saved-reopened'].document.slides.map((s)=>s.chart.referenceLines?.length??0),[0,1,0]);
assert.equal(o.imported.original.diagnostics.length,2);
assert.equal(o.imported['saved-reopened'].diagnostics.length,4);
const beforeCharts=o.before.flatMap(s=>s.shapes.filter(x=>x.chart).map(x=>x.chart));
const afterCharts=o.after.flatMap(s=>s.shapes.filter(x=>x.chart).map(x=>x.chart));
assert.equal(beforeCharts.length,3);assert.equal(afterCharts.length,3);
for(let i=0;i<3;i++) assert.deepEqual(beforeCharts[i].ownership,afterCharts[i].ownership,'Ownership changed');
assert.equal(beforeCharts[2].ownership,null);
const owned=(chart)=>chart.groups.flatMap(g=>g.series).filter(s=>s.owner);
assert.equal(owned(beforeCharts[0]).length,2);assert.equal(owned(afterCharts[0]).length,2);
for(const s of owned(afterCharts[0])) {assert.equal(s.labels['c:dLbl']['c:showPercent'].val,'1');assert.equal(s.labels['c:dLbl']['c:showBubbleSize'].val,'1');}
for(const id of ['reference-native-lines','reference-native-axes','reference-overlays-markers']) {
  const result=json('pure-external/n034-cmap-ref-pure01-'+id+'-exit.json');
  assert.equal(result.status??result.code??result.exitCode,0,'Pure validation must have actual exit0');
  assert.equal(result.runOfficeRequested,false);assert.equal(result.officeActivated,false);
}
assert.equal(receipt.neverMerge,true);
for(const [k,v]of Object.entries(receipt.acceptance))if(k!=='rootVisualFacetReviewed')assert.equal(v,false,k);
console.log(JSON.stringify({status:'PASS',records:records.length,rawBytes:receipt.raw.totalRecordBytes,directImages:receipt.direct.length,wholeNativePngPairs:3,findingsRetained:7,oldImportReferenceCounts:{original:[2,1,0],saved:[0,1,0]},protectedObjects:Object.keys(receipt.sourceObjectIdentities).length,nativeAcceptance:false,scope:'Offline integrity and historical facts only; root visual judgment attributed, no native replay.'}));
