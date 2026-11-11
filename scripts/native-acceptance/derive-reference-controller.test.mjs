import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {referenceControllerBaseDerivation,referenceControllerDerivation,applyExactReferenceEdits,deriveReferencePostflight} from './derive-reference-controller.mjs';
const folder=path.dirname(fileURLToPath(import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const plan=JSON.parse(fs.readFileSync(path.join(folder,'reference-postflight-derivation.json'),'utf8'));
const base=()=>referenceControllerBaseDerivation().find(item=>item.file==='run-reference-chart-profile.ps1').source;

test('approved postflight is an exact second stage after the immutable whole-seven shell derivation',()=>{
  assert.equal(plan.reviewedRevision,'f3f04183c2d38ffe3e5755a23b571b6b9ce8155e');
  assert.equal(plan.baseBytes,11352);assert.equal(plan.reviewedBytes,19206);
  assert.equal(plan.reviewedSourceSha256,'8902c341911dd9711872b4745d8ac3fe6524b9f5dcaa6d7ccd17b7f1f1116ee3');
  const before=referenceControllerBaseDerivation(),after=referenceControllerDerivation();
  assert.deepEqual(after.map(item=>item.file),before.map(item=>item.file));
  for(let i=0;i<3;i++){
    if(after[i].file==='run-reference-chart-profile.ps1'){
      assert.equal(after[i].source,deriveReferencePostflight(before[i].source));
      assert.equal(after[i].prePostflightSha256,sha(Buffer.from(before[i].source)));
      assert.equal(sha(Buffer.from(after[i].source)),plan.reviewedSourceSha256);
    }else assert.deepEqual(after[i],before[i]);
    assert.deepEqual(fs.readFileSync(path.join(folder,after[i].file)),Buffer.from(after[i].source),after[i].file);
  }
});

test('missing actual insertion and legacy-confirmation anchors refuse instead of skipping a stage',()=>{
  for(const edit of plan.edits){const source=base();assert.equal(source.split(edit.before).length-1,1,edit.name);const missing=source.replace(edit.before,'');assert.throws(()=>applyExactReferenceEdits(missing,plan.edits),/Unique postflight policy anchor/);}
});

test('duplicated actual insertion and legacy-confirmation anchors refuse instead of picking one',()=>{
  for(const edit of plan.edits){const duplicated=base()+'\n'+edit.before;assert.throws(()=>applyExactReferenceEdits(duplicated,plan.edits),/Unique postflight policy anchor/);}
});

test('changed actual anchors and any changed base byte refuse rather than broadening a pattern',()=>{
  for(const edit of plan.edits){const changed=base().replace(edit.before,edit.before.slice(0,-1)+'!');assert.throws(()=>applyExactReferenceEdits(changed,plan.edits),/Unique postflight policy anchor/);assert.throws(()=>deriveReferencePostflight(changed),/Exact pre-postflight derivative/);}
  assert.throws(()=>deriveReferencePostflight(base()+'\n'),/Exact pre-postflight derivative/);
});

test('changed postflight budget or replacement bytes cannot silently define the expected wrapper',()=>{
  const changed=structuredClone(plan);assert(changed.edits[0].after.includes('$budget=5000;'));
  changed.edits[0].after=changed.edits[0].after.replace('$budget=5000;','$budget=5001;');
  assert.throws(()=>deriveReferencePostflight(base(),changed),/Exact reviewed postflight derivative/);
  const tail=structuredClone(plan);tail.edits[1].after+='\n# unexpected derivation\n';
  assert.throws(()=>deriveReferencePostflight(base(),tail),/Exact reviewed postflight derivative/);
});

test('review identity, base identity, stage count and canonical order are explicit refusal boundaries',()=>{
  for(const change of [p=>p.reviewedRevision='0'.repeat(40),p=>p.reviewedFile='other.ps1',p=>p.reviewedSourceSha256='0'.repeat(64),p=>p.baseSourceSha256='0'.repeat(64),p=>p.baseBytes++,p=>p.reviewedBytes++,p=>p.edits.pop(),p=>p.edits.push(p.edits[0]),p=>p.edits.reverse()]){const altered=structuredClone(plan);change(altered);assert.throws(()=>deriveReferencePostflight(base(),altered));}
  for(const edits of [[{name:'empty',before:'',after:'x'}],[{name:'empty',before:'x',after:''}]])assert.throws(()=>applyExactReferenceEdits('x',edits));
});

test('actual public check CLI validates all three complete sources without writing or activating Office',()=>{
  const files=referenceControllerDerivation().map(item=>path.join(folder,item.file)),before=files.map(file=>sha(fs.readFileSync(file)));
  const child=spawnSync(process.execPath,[path.join(folder,'derive-reference-controller.mjs'),'--check'],{encoding:'utf8',timeout:10000});
  assert.equal(child.status,0,child.stderr);const report=JSON.parse(child.stdout);
  assert.equal(report.scope,'mechanical source derivation only; no Office/native acceptance');assert.equal(report.files.length,3);
  assert.equal(report.files.find(item=>item.file==='run-reference-chart-profile.ps1').sha256,plan.reviewedSourceSha256);
  assert.deepEqual(files.map(file=>sha(fs.readFileSync(file))),before);
});
