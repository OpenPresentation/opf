import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {assertReviewedFallbackArchive} from './chart-modes.mjs';

test('source-candidate fallback references retain both published histories and exact theme-only review',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/chartex-fallback-main.json',import.meta.url)));
  const review=JSON.parse(await readFile(new URL('../../docs/evidence/rr-68-native-chart-master-name-2026-10-15/comparison.json',import.meta.url)));
  const candidate=JSON.parse(await readFile(new URL('../../docs/evidence/rr-68-native-chart-master-name-2026-10-15/source-candidate-theme-category.json',import.meta.url)));
  const current=candidate.cases.slice(0,9);
  assert.equal(fixture.source.sourceCandidateDefaultThemeReview.sourceCandidate.commit,'560571c7ced447484c55c673c8fbeb8f69f838a4');
  assert.equal(fixture.source.sourceCandidateDefaultThemeReview.sourceCandidate.registryAcceptance,false);
  assert.equal(candidate.publishedPptx.gitHead,'9690abd12af8d7a4d6f29a28709517f0b6569301');
  assert.deepEqual(current.map(item=>item.name),Object.keys(fixture.entries));
  assert.equal(review.archives.length,9);
  assert.equal(review.partsCompared,1079);
  assert.equal(review.changedParts,9);
  assert.deepEqual(review.archives.map(item=>item.name),Object.keys(fixture.entries));
  for(const item of review.archives){
    const next=current.find(entry=>entry.name===item.name);
    assert.equal(next.oldSha256,item.currentArchiveSha256);
    assert.equal(next.oldBytes,item.currentBytes);
    assert.equal(fixture.entries[item.name].sha256,next.currentSha256);
    assert.equal(fixture.entries[item.name].bytes,next.currentBytes);
    assert.equal(next.allOtherPartsByteIdentical,true);
    assert.equal(next.diagnosticsByteIdentical,true);
    assert.deepEqual(next.changedParts.map(part=>part.part).sort(),['docProps/app.xml','ppt/theme/theme1.xml','ppt/theme/theme2.xml']);
    assert.ok(next.changedParts.every(part=>part.onlyDefaultThemeDisplayIdentityChanged));
    assert.notEqual(item.currentArchiveSha256,item.oldArchiveSha256);
    assert.equal(item.diagnosticsByteEqual,true);
    assert.equal(item.changedParts.length,1);
    assert.match(item.changedParts[0].part,/^ppt\/slideMasters\/slideMaster\d+\.xml$/);
    assert.equal(item.changedParts[0].onlyMissingMasterNameAdded,true);
    assert.equal(item.changedParts[0].currentBytes-item.changedParts[0].oldBytes,20);
  }
  assert.equal(review.archives[0].oldArchiveSha256,'b69933578667102cc1b2ffa59e97574aa90d6e27442c5e59677ff1a0c16a71f2');
});

test('whole-archive reference guard rejects any byte drift and unknown references',()=>{
  const bytes=Buffer.from('archive bytes: chart, master, ZIP metadata');
  const entry={sha256:createHash('sha256').update(bytes).digest('hex')};
  assert.doesNotThrow(()=>assertReviewedFallbackArchive(bytes,entry,'control'));
  for(let index=0;index<bytes.length;index++){
    const changed=Buffer.from(bytes);changed[index]^=1;
    assert.throws(()=>assertReviewedFallbackArchive(changed,entry,'changed'),/reviewed fallback archive changed/);
  }
  assert.throws(()=>assertReviewedFallbackArchive(bytes,{sha256:'unknown'},'unknown'),/reviewed fallback archive changed/);
});
