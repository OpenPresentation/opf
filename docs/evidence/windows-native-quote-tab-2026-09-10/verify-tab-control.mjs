import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const here=new URL('./',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=f=>readFile(new URL(f,here)),json=async f=>JSON.parse((await bytes(f)).toString().replace(/^\uFEFF/,''));
for(const f of await readdir(here,{recursive:true}))assert.ok(!f.toLowerCase().endsWith('.pdf'),'Private PDF must not enter portable evidence');
for(const attempt of ['01','02','03']){
 const root=`raw/tab-native-created-${attempt}/`,worker=await json(root+'worker.json');
 assert.equal(worker.timedOut,false);assert.equal(worker.timeoutSeconds,45);assert.equal(worker.exitCode,attempt==='02'?1:0);
 if(attempt==='02'){const failure=await json(root+'failure.json');assert.equal(failure.stage,'export-private-proof');assert.equal(failure.observations.length,2);continue;}
 const control=await json(root+'control.json');
 assert.equal(sha(await bytes(root+'native-created-tabs.pptx')),control.pptxSha256);
 assert.equal(sha(await bytes(root+'verifiers/native-tab-control.ps1')),control.verifierSha256);
 assert.equal(sha(await bytes(root+'verifiers/native-process.ps1')),control.workerVerifierSha256);
 const [created,reopened]=control.observations;assert.equal(created.phase,'created');assert.equal(reopened.phase,'reopened');assert.equal(created.records.length,9);
 assert.deepEqual(created.records,reopened.records);assert.equal(created.pngSha256,reopened.pngSha256);
 for(const phase of control.observations)assert.equal(sha(await bytes(root+phase.phase+'.png')),phase.pngSha256);
 if(attempt==='03'){
  const pdf=await json(root+'pdf-control-comparison.json');assert.equal(pdf.pdfSha256,control.privatePdfSha256);assert.equal(pdf.pptxSha256,control.pptxSha256);
  assert.equal(pdf.extractorSha256,sha(await bytes(root+'verifiers/native-tab-pdf.py')));assert.equal(pdf.rasterSha256,sha(await bytes(root+'pdf-render.png')));
  assert.equal(pdf.records.length,9);assert.equal(pdf.nativeTabTolerancePoints,.02);assert.equal(pdf.nativeTabGatePassed,false);
  for(const [index,record]of pdf.records.entries()){
   const native=created.records[index];assert.equal(record.targetPoints,native.targetPoints);
   assert.equal(record.nativeTabOffsetPoints,native.tabTextBoundLeft-native.leadingTabBoundLeft);
   assert.equal(record.nativeTabErrorPoints,Math.abs(record.nativeTabOffsetPoints-record.targetPoints));
   assert.ok(Math.abs(record.drawingMlTabPoints-record.targetPoints)<=1/12700);
  }
  const retained=pdf.records.find(r=>r.targetPoints===16.27734375);assert.ok(retained.nativeTabErrorPoints>.02);assert.ok(Math.abs(retained.pdfTabMinusLiteralPoints-.024)<1e-9);
 }
}
console.log('Three native-created controls retain all attempts, exact source/raster/verifier hashes and the failed 0.02 pt tab gate; private PDFs excluded.');
