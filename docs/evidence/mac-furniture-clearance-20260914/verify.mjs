import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const read=file=>readFile(new URL(file,import.meta.url));
const json=async file=>JSON.parse(await read(file));
const hash=data=>createHash('sha256').update(data).digest('hex');
for(const file of await json('SHA256SUMS.json'))assert.equal(hash(await read(file.file)),file.sha256,file.file);
const heads={
 'core-verify':'8a322c13884f2f1634fd3a207d1e0a662e3ad460',
 'core-cli':'8a322c13884f2f1634fd3a207d1e0a662e3ad460',
 'core-ecosystem':'8a322c13884f2f1634fd3a207d1e0a662e3ad460',
 renderer:'3d4fa8ce8172c2a6b38bf217d5f8d0ce5a1b62af',
 editor:'40023fb3b65611ada05de8a9860bc41733a415a9',
 pptx:'ee89b266527a954bb573aea00075db997c8a253a',
};
for(const [label,head]of Object.entries(heads)){
 const run=await json(`final-${label}.json`),log=(await read(`final-${label}.log`)).toString();
 assert.equal(run.headSha,head);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
 assert.ok(run.jobs.every(job=>job.conclusion==='success'));
 assert.doesNotMatch(log,/triggerUncaughtException|AssertionError \[|Process completed with exit code [1-9]/);
 if(['core-ecosystem','renderer'].includes(label))assert.match(log,/Golden passed: 805 slides, 126 decks; no skipped corpus\./);
 if(['core-ecosystem','renderer','editor','pptx'].includes(label))assert.match(log,/16 offline installed furniture workflows passed/);
}
const source=await json('mac-source/report.json');
for(const directory of ['mac-source','mac-installed','linux-installed','windows-installed']){
 const report=await json(`${directory}/report.json`),maskDirectory=directory==='mac-installed'?'mac-source':directory;
 assert.equal(report.results.length,16);assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);
 assert.equal(report.verifierSha256,source.verifierSha256);assert.deepEqual(report.fonts,source.fonts);
 assert.equal(report.fonts.length,9);assert.ok(report.paintControl.outsideCount>0);
 assert.equal(hash(await read(`${maskDirectory}/${report.paintControl.file}`)),report.paintControl.sha256);
 if(directory!=='mac-source')assert.equal(Object.keys(report.bundleInputs).length,220);
 let fields=0;
 for(const [index,result]of report.results.entries()){
  const reference=source.results[index],{actual,...geometry}=result.geometry,{actual:referenceActual,...referenceGeometry}=reference.geometry;
  assert.equal(geometry.furniture.algorithm,'furniture-flow-v2');assert.deepEqual(geometry,referenceGeometry);
  assert.deepEqual(result.imported,reference.imported);assert.equal(result.pptxSha256,reference.pptxSha256);
  for(const part of result.paint){
   fields++;assert.equal(part.outsideCount,0);assert.deepEqual(part.outside,[]);
   assert.equal(hash(await read(`${maskDirectory}/${part.file}`)),part.sha256);
  }
 }
 assert.equal(fields,40);
}
console.log('Verified retained CI heads/logs, four 16-workflow reports, 40 field masks per report, negative controls, font hashes, and identical accepted geometry/imports/PPTX across Mac/Linux/Windows. Native Office acceptance remains separate.');
