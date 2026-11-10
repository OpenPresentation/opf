// Pure review metadata construction; this module does not export or promote an archive.
import assert from 'node:assert/strict';

export const RR54_EXPORT_CALLER=Object.freeze({api:'toPptx',input:'structuredClone(entry.deck)',options:'omitted',catalogs:'not registered'});
const digest=value=>assert.match(value,/^[a-f0-9]{64}$/u);
const commit=value=>assert.match(value,/^[a-f0-9]{40}$/u);
export function makeRr54ArchiveCandidate(fixture,review,sourceEvidence){
  assert.ok(fixture?.source&&fixture?.entries&&review&&sourceEvidence);
  for(const key of['baselineHead','baselineExportRef','candidateHead'])commit(review[key]);
  assert.ok(typeof review.scope==='string'&&review.scope.length>0);
  assert.ok(typeof sourceEvidence.directory==='string'&&sourceEvidence.directory.length>0);
  for(const key of['baselineSourceTrees','candidateSourceTrees'])assert.ok(typeof sourceEvidence[key]==='string'&&sourceEvidence[key].length>0);
  for(const key of['fixtureSha256','reviewerSha256','candidateHelperSha256'])digest(sourceEvidence[key]);
  assert.deepEqual(review.entries.map(row=>row.name),Object.keys(fixture.entries),'Complete fixture/report entry order required');
  const previousReviews=fixture.source.rr54ArchiveReviews??[];assert.ok(Array.isArray(previousReviews),'Source review history must be an array');
  const next=structuredClone(fixture),reviewIndex=previousReviews.length;
  for(const row of review.entries){
    const entry=fixture.entries[row.name];digest(row.baseline);digest(row.candidate);
    assert.equal(row.baseline,entry.sha256,row.name+': baseline hash differs from current lock');
    assert.equal(row.baselineBytes,entry.rr20Bytes,row.name+': baseline size differs');
    assert.equal(row.baselineParts,entry.rr20PartCount,row.name+': baseline part count differs');
    assert.ok(Number.isSafeInteger(row.candidateBytes)&&row.candidateBytes>0);
    assert.ok(Number.isSafeInteger(row.candidateParts)&&row.candidateParts>0);
    assert.ok(Array.isArray(row.changedParts)&&row.changedParts.every(file=>typeof file==='string'&&file.length>0));
    assert.equal(new Set(row.changedParts).size,row.changedParts.length,'Duplicate changed part');
    if(!row.changedParts.length){
      assert.equal(row.candidate,row.baseline,'Unchanged archive hash must be identical');
      assert.equal(row.candidateBytes,row.baselineBytes);assert.equal(row.candidateParts,row.baselineParts);
      if(entry.nativeSlideSha256)assert.equal(row.candidateNativeSlideSha256,entry.nativeSlideSha256);
      continue;
    }
    assert.notEqual(row.candidate,row.baseline,'Changed raw parts must change the archive hash');
    const history=entry.rr54ArchivePrevious??[];assert.ok(Array.isArray(history),'Entry lock history must be an array');
    const updated=next.entries[row.name];
    updated.rr54ArchivePrevious=[...structuredClone(history),{sha256:entry.sha256,bytes:entry.rr20Bytes,partCount:entry.rr20PartCount,...(entry.nativeSlideSha256?{nativeSlideSha256:entry.nativeSlideSha256}:{}),reviewIndex}];
    updated.sha256=row.candidate;updated.rr20Bytes=row.candidateBytes;updated.rr20PartCount=row.candidateParts;
    if(entry.nativeSlideSha256){digest(row.candidateNativeSlideSha256);updated.nativeSlideSha256=row.candidateNativeSlideSha256;}
  }
  next.source.rr54ArchiveReviews=[...structuredClone(previousReviews),{baselineExportRef:review.baselineExportRef,baselineBuildHead:review.baselineHead,candidateHead:review.candidateHead,exportCaller:structuredClone(RR54_EXPORT_CALLER),evidence:{directory:sourceEvidence.directory,reviewFile:'review.json'},sourceEvidence:structuredClone(sourceEvidence),scope:review.scope}];
  return next;
}
