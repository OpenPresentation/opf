// Pure review metadata construction; this module does not export or promote an archive.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const deckHash=deck=>createHash('sha256').update(JSON.stringify(deck)).digest('hex');

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
    let projectedDeck;
    const projection=row.inputProjection??undefined;
    if(projection){
      assert.equal(row.name,'styled-table','Only the reviewed styled-table deck may be projected');
      assert.deepEqual(Object.keys(projection).sort(),['path','before','after','scope','originalDeckSha256','currentDeckSha256'].sort(),'Only the closed input projection descriptor is accepted');
      assert.equal(projection.path,'/slides/0/table/columns/1/style/align');
      assert.equal(projection.before,'right');assert.equal(projection.after,'end');
      assert.ok(typeof projection.scope==='string'&&projection.scope.length>0);
      digest(projection.originalDeckSha256);digest(projection.currentDeckSha256);
      assert.equal(deckHash(entry.deck),projection.originalDeckSha256);
      assert.equal(entry.deck.language,undefined,'Closed default-LTR fixture only');
      assert.equal(entry.deck.slides[0].table.columns[1].style.align,'right');
      projectedDeck=structuredClone(entry.deck);projectedDeck.slides[0].table.columns[1].style.align='end';
      assert.equal(deckHash(projectedDeck),projection.currentDeckSha256);
      const inverse=structuredClone(projectedDeck);inverse.slides[0].table.columns[1].style.align='right';assert.deepEqual(inverse,entry.deck);
      assert.ok(row.changedParts.length,'A projected input requires an actual changed archive review');
    }
    if(!row.changedParts.length){
      assert.equal(row.candidate,row.baseline,'Unchanged archive hash must be identical');
      assert.equal(row.candidateBytes,row.baselineBytes);assert.equal(row.candidateParts,row.baselineParts);
      if(entry.nativeSlideSha256)assert.equal(row.candidateNativeSlideSha256,entry.nativeSlideSha256);
      continue;
    }
    assert.notEqual(row.candidate,row.baseline,'Changed raw parts must change the archive hash');
    const history=entry.rr54ArchivePrevious??[];assert.ok(Array.isArray(history),'Entry lock history must be an array');
    const updated=next.entries[row.name];
    updated.rr54ArchivePrevious=[...structuredClone(history),{sha256:entry.sha256,bytes:entry.rr20Bytes,partCount:entry.rr20PartCount,...(projection?{deck:structuredClone(entry.deck),inputProjection:structuredClone(projection)}:{}),...(entry.nativeSlideSha256?{nativeSlideSha256:entry.nativeSlideSha256}:{}),reviewIndex}];
    if(projectedDeck)updated.deck=projectedDeck;
    updated.sha256=row.candidate;updated.rr20Bytes=row.candidateBytes;updated.rr20PartCount=row.candidateParts;
    if(entry.nativeSlideSha256){digest(row.candidateNativeSlideSha256);updated.nativeSlideSha256=row.candidateNativeSlideSha256;}
  }
  next.source.rr54ArchiveReviews=[...structuredClone(previousReviews),{baselineExportRef:review.baselineExportRef,baselineBuildHead:review.baselineHead,candidateHead:review.candidateHead,exportCaller:structuredClone(RR54_EXPORT_CALLER),evidence:{directory:sourceEvidence.directory,reviewFile:'review.json'},sourceEvidence:structuredClone(sourceEvidence),scope:review.scope}];
  return next;
}
