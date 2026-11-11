// Offline generation from the reviewed actual archives. No exporter or fixture write.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {sha256,validateFixture,summarizeArchive} from '../../../../../packages/pptx/scripts/chartex-fallback-archives.mjs';
const require=createRequire(new URL('../../../../../packages/pptx/package.json',import.meta.url)),{unzipSync}=require('fflate');
const output=process.argv[2];assert.ok(output,'Supply a fresh external candidate JSON path');
const root=new URL('../../../../../',import.meta.url),local=file=>new URL(file,import.meta.url);
const manifest=JSON.parse(readFileSync(local('manifest.json'))),zip=readFileSync(local(manifest.zip.file));assert.equal(sha256(zip),manifest.zip.sha256);
const files=unzipSync(zip);
for(const record of manifest.rawFiles){assert.equal(files[record.path].length,record.bytes);assert.equal(sha256(files[record.path]),record.sha256);}
const audit=JSON.parse(Buffer.from(files['audit.json']).toString()),cause=JSON.parse(Buffer.from(files['layout-hash-cause.json']).toString());assert.equal(audit.source,manifest.source);assert.equal(cause.currentProducer,manifest.source);assert.equal(cause.rows.length,4);assert.ok(cause.rows.every(row=>row.onlyApprovedDesignAlignmentRenames));
const oldZip=execFileSync('git',['show',`${manifest.oldEvidence.commit}:docs/handoff/2026-11-09/rr20-current-nine-archive-review/actual-nine-review.zip`],{cwd:root,maxBuffer:10e6});assert.equal(sha256(oldZip),manifest.oldEvidence.zipSha256);const oldFiles=unzipSync(oldZip);
const inputLock=new URL('packages/pptx/test/fixtures/chartex-fallback-main.json',root),inputLockBytes=readFileSync(inputLock);
const originalBytes=execFileSync('git',['show',`${manifest.source}:packages/pptx/test/fixtures/chartex-fallback-main.json`],{cwd:root,maxBuffer:2e6}),original=JSON.parse(originalBytes);validateFixture(original);const next=structuredClone(original);assert.deepEqual(audit.reports.map(row=>row.name),Object.keys(original.entries));let changedCount=0;
for(const row of audit.reports){
 const entry=original.entries[row.name],before=oldFiles[`outputs/${row.name}/after.pptx`],after=files[`${row.name}.pptx`];
 const baseline=summarizeArchive(before,entry.diagnostics),diagnostics=row.diagnostics.map(d=>d.code+(d.adaptation?'/'+d.adaptation:'')),candidate=summarizeArchive(after,diagnostics);
 assert.deepEqual(baseline,Object.fromEntries(Object.keys(baseline).map(key=>[key,entry[key]])));assert.equal(candidate.sha256,row.after.sha256);assert.equal(candidate.bytes,row.after.bytes);for(const key of ['diagnostics','layoutParts','layoutTagParts'])assert.deepEqual(candidate[key],baseline[key]);
 const a=unzipSync(before),b=unzipSync(after);assert.deepEqual(Object.keys(a),Object.keys(b));const changes=Object.keys(a).filter(p=>!Buffer.from(a[p]).equals(Buffer.from(b[p])));assert.deepEqual(changes,row.changes.map(d=>d.part));
 for(const part of changes){assert.match(part,/^ppt\/tags\/(?:opfDocument|opfSlide\d+|opfData\d+|opfLayout(?:1|2|5|6))\.xml$/);assert.deepEqual(Buffer.from(a[part]),Buffer.from(files[`${row.name}__before__${part.replaceAll('/','__')}`]));assert.deepEqual(Buffer.from(b[part]),Buffer.from(files[`${row.name}__after__${part.replaceAll('/','__')}`]));}changedCount+=changes.length;
 next.entries[row.name].rr20ArchivePrevious=[...(entry.rr20ArchivePrevious??[]),structuredClone(baseline)];Object.assign(next.entries[row.name],candidate);
}
assert.equal(changedCount,65);next.source.rr20SchemaVocabularyReviews=[...(next.source.rr20SchemaVocabularyReviews??[]),{baseline:{head:manifest.oldEvidence.producer,archivedEvidence:manifest.oldEvidence},candidate:{head:manifest.source,boundary:audit.boundary},evidence:{file:'docs/handoff/2026-11-10/schema-decision-packet/nine-archive-review/actual-nine-audit.zip',sha256:manifest.zip.sha256},scope:'Owner-approved schema vocabulary/provenance metadata:65 tag-only changes; all native slide/chart/workbook/theme/relationship bytes and ordered diagnostics unchanged. Independent four-record/eight-hash FNV proof. No native or registry acceptance.',review:manifest.rootReview}];
assert.deepEqual(readFileSync(inputLock),inputLockBytes,'Current input lock remains untouched');assert.deepEqual(JSON.parse(originalBytes),original,'Historical lock remains untouched');writeFileSync(output,JSON.stringify(next,null,2)+'\n',{flag:'wx'});console.log('Generated nine-only candidate from exact reviewed archives; current input lock unchanged.');
