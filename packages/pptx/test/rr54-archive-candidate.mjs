import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {makeRr54ArchiveCandidate,RR54_EXPORT_CALLER} from '../scripts/rr54-archive-candidate.mjs';

const bytes=readFileSync(new URL('./fixtures/rr-54-unchanged.json',import.meta.url));
const fixture=JSON.parse(bytes),original=structuredClone(fixture);
const command=readFileSync(new URL('../scripts/review-rr54-archives.mjs',import.meta.url),'utf8');
assert.match(command,/const next=makeRr54ArchiveCandidate\(fixture,review,sourceEvidence\)/u,'Actual reviewer must use the tested pure constructor');
assert.doesNotMatch(command,/\.rr105033(?:Previous|ArchiveReview)\s*=/u,'Reviewer must never overwrite legacy release history');
assert.match(command,/await baseline\.toPptx\(structuredClone\(entry\.deck\)\)/u);
assert.match(command,/await candidate\.toPptx\(structuredClone\(entry\.deck\)\)/u);
assert.equal(Object.keys(fixture.entries).length,21);
assert.ok(fixture.source.rr105033ArchiveReview,'Actual fixture must retain033 source history');
assert.ok(Object.values(fixture.entries).some(entry=>entry.rr105033Previous),'Actual033 entry histories are exercised');
const rows=Object.entries(fixture.entries).map(([name,entry])=>({name,baseline:entry.sha256,candidate:entry.sha256,baselineBytes:entry.rr20Bytes,candidateBytes:entry.rr20Bytes,baselineParts:entry.rr20PartCount,candidateParts:entry.rr20PartCount,changedParts:[],...(entry.nativeSlideSha256?{candidateNativeSlideSha256:entry.nativeSlideSha256}:{})}));
const report={baselineHead:'1'.repeat(40),baselineExportRef:'2'.repeat(40),candidateHead:'3'.repeat(40),scope:'Exact bare caller, metadata-only controls',entries:rows};
const evidence={directory:'review-output',baselineSourceTrees:'baseline tree objects',candidateSourceTrees:'candidate tree objects',fixtureSha256:createHash('sha256').update(bytes).digest('hex'),reviewerSha256:'4'.repeat(64),candidateHelperSha256:'5'.repeat(64)};
const changedNames=['bar','table'];
for(const name of changedNames){const row=rows.find(value=>value.name===name);row.candidate=(row.baseline[0]==='a'?'b':'a').repeat(64);row.candidateBytes++;row.changedParts=['ppt/slides/slide1.xml'];if(row.candidateNativeSlideSha256)row.candidateNativeSlideSha256='f'.repeat(64);}
const result=makeRr54ArchiveCandidate(fixture,report,evidence);assert.deepEqual(fixture,original,'Pure construction never mutates source');
assert.deepEqual(result.source.rr105033ArchiveReview,fixture.source.rr105033ArchiveReview);
assert.deepEqual(result.source.rr54ArchiveReviews.at(-1).exportCaller,RR54_EXPORT_CALLER);
assert.deepEqual(result.source.rr54ArchiveReviews.at(-1).sourceEvidence,evidence);
for(const[name,entry]of Object.entries(fixture.entries)){
  if(!changedNames.includes(name)){assert.deepEqual(result.entries[name],entry,'Unchanged entry must remain entirely exact');continue;}
  const next=result.entries[name];assert.deepEqual(next.rr105033Previous,entry.rr105033Previous);
  assert.deepEqual(next.rr54ArchivePrevious.at(-1),{sha256:entry.sha256,bytes:entry.rr20Bytes,partCount:entry.rr20PartCount,...(entry.nativeSlideSha256?{nativeSlideSha256:entry.nativeSlideSha256}:{}),reviewIndex:(fixture.source.rr54ArchiveReviews??[]).length});
  for(const key of Object.keys(entry).filter(key=>!['sha256','rr20Bytes','rr20PartCount','nativeSlideSha256','rr54ArchivePrevious'].includes(key)))assert.deepEqual(next[key],entry[key]);
}
const secondReport=structuredClone(report);for(const row of secondReport.entries){const entry=result.entries[row.name];row.baseline=entry.sha256;row.baselineBytes=entry.rr20Bytes;row.baselineParts=entry.rr20PartCount;row.candidate=entry.sha256;row.candidateBytes=entry.rr20Bytes;row.candidateParts=entry.rr20PartCount;row.changedParts=[];if(entry.nativeSlideSha256)row.candidateNativeSlideSha256=entry.nativeSlideSha256;}
const secondChanged=secondReport.entries.find(row=>row.name==='bar');secondChanged.candidate='c'.repeat(64);secondChanged.changedParts=['ppt/charts/chart1.xml'];
const second=makeRr54ArchiveCandidate(result,secondReport,evidence);
assert.deepEqual(second.source.rr54ArchiveReviews.slice(0,-1),result.source.rr54ArchiveReviews);
assert.deepEqual(second.entries.bar.rr54ArchivePrevious.slice(0,-1),result.entries.bar.rr54ArchivePrevious);
assert.equal(second.entries.bar.rr54ArchivePrevious.at(-1).sha256,result.entries.bar.sha256,'Second review appends actual latest lock');
assert.deepEqual(second.entries.table,result.entries.table,'Previously changed but now unchanged entry gets no extra history');
for(const change of[
  value=>{value.entries[0].baseline='0'.repeat(64);},value=>{value.entries[0].baselineBytes++;},value=>{value.entries[0].baselineParts++;},
  value=>{value.entries.pop();},value=>{value.entries.reverse();},value=>{value.entries[0].candidate='d'.repeat(64);},
  value=>{value.entries[0].changedParts=['x'];},value=>{value.entries.find(row=>row.name==='table').candidateNativeSlideSha256=undefined;},
]){const invalid=structuredClone(report);change(invalid);assert.throws(()=>makeRr54ArchiveCandidate(fixture,invalid,evidence));}
for(const mutate of[value=>{value.source.rr54ArchiveReviews={};},value=>{value.entries.bar.rr54ArchivePrevious={};}]){const invalid=structuredClone(fixture);mutate(invalid);assert.throws(()=>makeRr54ArchiveCandidate(invalid,report,evidence));}
console.log('RR54 candidate metadata: actual21 fixture histories preserved, changed-only append, repeat-review continuity and malformed-report/history refusal controls pass; no archives serialized/promoted.');
