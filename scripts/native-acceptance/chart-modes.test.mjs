import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {assertReviewedFallbackArchive} from './chart-modes.mjs';

test('current fallback references retain all nine historical identities and exact master-only review',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/chartex-fallback-main.json',import.meta.url)));
  const review=JSON.parse(await readFile(new URL('../../docs/evidence/rr-68-native-chart-master-name-2026-10-15/comparison.json',import.meta.url)));
  assert.equal(review.archives.length,9);
  assert.equal(review.partsCompared,1079);
  assert.equal(review.changedParts,9);
  assert.deepEqual(review.archives.map(item=>item.name),Object.keys(fixture.entries));
  for(const item of review.archives){
    assert.equal(fixture.entries[item.name].sha256,item.currentArchiveSha256);
    assert.equal(fixture.entries[item.name].bytes,item.currentBytes);
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
