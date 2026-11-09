import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const directory=fileURLToPath(new URL('./',import.meta.url)),root=fileURLToPath(new URL('../../../../',import.meta.url));
const {unzipSync}=createRequire(path.resolve(process.argv[2]??path.join(root,'packages/pptx/package.json')))('fflate');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'))),zip=fs.readFileSync(path.join(directory,manifest.zip.name));
assert.equal(zip.length,manifest.zip.bytes);assert.equal(hash(zip),manifest.zip.sha256);
const files=unzipSync(zip),get=name=>{assert(files[name],name);return Buffer.from(files[name]);},json=name=>JSON.parse(get(name));
assert.equal(Object.keys(files).length,manifest.rawFiles);
for(const row of manifest.files){assert(!row.name.startsWith('/')&&!row.name.split('/').includes('..'));assert.equal(get(row.name).length,row.bytes);assert.equal(hash(get(row.name)),row.sha256);}
assert.equal(manifest.files.reduce((sum,row)=>sum+row.bytes,0),manifest.rawBytes);
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:16*1024*1024});
assert(git('diff','--name-only',manifest.candidate,'HEAD').toString().trim().split(/\r?\n/).filter(Boolean).every(file=>file.startsWith('docs/handoff/2026-11-09/rr54-current-archive-review/')));
const report=json('outputs/review.json'),candidate=json('outputs/candidate-fixture.json'),audit=json('run/twenty-one-audit.json');
const fixturePath='packages/pptx/test/fixtures/rr-54-unchanged.json',fixtureBytes=git('show',manifest.candidate+':'+fixturePath),fixture=JSON.parse(fixtureBytes);
assert.equal(hash(fixtureBytes),'d62b991a3772856d812296cf12582be2ede6850e39d644d3414ab39a89a06e27');
assert.equal(report.baselineHead,manifest.baseline);assert.equal(report.baselineExportRef,manifest.baseline);assert.equal(report.candidateHead,manifest.candidate);
assert.deepEqual(report.entries.map(row=>row.name),Object.keys(fixture.entries));assert.equal(report.entries.length,21);
assert.deepEqual(candidate.entries,fixture.entries);
const oldReviews=fixture.source.rr54ArchiveReviews??[],newReviews=candidate.source.rr54ArchiveReviews;
assert.equal(newReviews.length,oldReviews.length+1);assert.deepEqual(newReviews.slice(0,-1),oldReviews);
assert.deepEqual({...candidate.source,rr54ArchiveReviews:null},{...fixture.source,rr54ArchiveReviews:null});
const last=newReviews.at(-1);assert.equal(last.baselineExportRef,manifest.baseline);assert.equal(last.baselineBuildHead,manifest.baseline);assert.equal(last.candidateHead,manifest.candidate);
assert.deepEqual(last.exportCaller,{api:'toPptx',input:'structuredClone(entry.deck)',options:'omitted',catalogs:'not registered'});
assert.equal(last.sourceEvidence.fixtureSha256,hash(fixtureBytes));
const sourcePaths=["packages/javascript","packages/gallery","packages/render","packages/pptx","spec","pnpm-lock.yaml","pnpm-workspace.yaml","package.json"];
for(const [ref,key]of[[manifest.baseline,"baselineSourceTrees"],[manifest.candidate,"candidateSourceTrees"]])assert.equal(git("ls-tree",ref,"--",...sourcePaths).toString().trim(),last.sourceEvidence[key]);
for(const [file,key]of[['review-rr54-archives.mjs','reviewerSha256'],['rr54-archive-candidate.mjs','candidateHelperSha256']])assert.equal(hash(git('show',manifest.candidate+':packages/pptx/scripts/'+file)),last.sourceEvidence[key]);
const exit=json('run/review.exit.json');assert.equal(exit.exitCode,0);assert.equal(exit.invocation,1);assert.equal(exit.decision,'RR54-MAINTAINED-INTERLEAVE');assert.match(exit.order,/interleaved/);
assert.match(get('run/review.log').toString(),/21 exact baselines reproduced; 0 archive candidates require review/);
const provenance=json('run/producer-provenance-from-nine.json');assert.equal(provenance.node,'v24.20.0');assert.equal(provenance.platform,'win32');assert.equal(provenance.baseline.head,manifest.baseline);assert.equal(provenance.candidate.head,manifest.candidate);
for(const side of['baseline','current'])assert.equal(json('run/'+side+'-build.exit.json').exitCode,0);
assert.equal(audit.generation,undefined);assert.equal(audit.maintainedInvocations,1);assert.equal(audit.baselineExports,21);assert.equal(audit.candidateExports,21);
assert.equal(audit.changedArchives,0);assert.equal(audit.generatedNewPptxFiles,0);assert.equal(audit.fixturePromoted,false);assert.equal(audit.officeCalls,0);
let partCount=0,workbooks=0,workbookParts=0,nativeCount=0;
const nativeHash=parts=>hash(JSON.stringify(Object.entries(parts).filter(([file])=>/^ppt\/slides\/slide\d+\.xml$/.test(file)).map(([file,data])=>[file,Buffer.from(data).toString().replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g,'')])));
for(const row of report.entries){
 const entry=fixture.entries[row.name];assert.equal(row.baseline,entry.sha256);assert.equal(row.candidate,row.baseline);
 assert.equal(row.baselineBytes,entry.rr20Bytes);assert.equal(row.candidateBytes,row.baselineBytes);assert.equal(row.baselineParts,entry.rr20PartCount);assert.equal(row.candidateParts,row.baselineParts);assert.deepEqual(row.changedParts,[]);
 const recorded=audit.rows.find(item=>item.name===row.name);assert(recorded);
 const container=git('show',manifest.previous+':'+recorded.publishedControl.path);assert.equal(hash(container),recorded.publishedControl.containerSha256);
 const control=Buffer.from(unzipSync(container)['after.pptx']);assert.equal(hash(control),row.candidate);assert.equal(control.length,row.candidateBytes);
 const parts=unzipSync(control),names=Object.keys(parts).sort();assert.equal(names.length,row.candidateParts);partCount+=names.length;
 assert.equal(recorded.parts.length,names.length);
 for(const name of names){const actual=recorded.parts.find(item=>item.file===name);assert(actual);assert.equal(hash(parts[name]),actual.sha256);assert.equal(parts[name].length,actual.bytes);}
 if(entry.nativeSlideSha256){nativeCount++;assert.equal(nativeHash(parts),entry.nativeSlideSha256);assert.equal(row.candidateNativeSlideSha256,entry.nativeSlideSha256);}
 for(const embedded of recorded.embeddedWorkbooks){workbooks++;assert.equal(hash(parts[embedded.file]),embedded.sha256);const wb=unzipSync(parts[embedded.file]);assert.equal(Object.keys(wb).length,embedded.parts.length);for(const part of embedded.parts){workbookParts++;assert.equal(wb[part.file].length,part.bytes);assert.equal(hash(wb[part.file]),part.sha256);}}
}
assert.equal(partCount,652);assert.equal(workbooks,19);assert.equal(workbookParts,228);assert.equal(nativeCount,3);
assert.equal(hash(get('outputs/candidate-fixture.json')),'3d9ff329dba6aac7e0f9d4c2c3136277944c97e3e1dd86300634efc270877f24');
console.log(JSON.stringify({verified:true,rawFiles:manifest.rawFiles,rawBytes:manifest.rawBytes,decks:21,baseline:manifest.baseline,candidate:manifest.candidate,changedArchives:0,fullArchiveBaselineChecks:21,applicableNativeXmlDigestChecks:3,immutableControlParts:partCount,embeddedWorkbooks:workbooks,nestedParts:workbookParts,newUnchangedPptxFilesRetained:0,promoted:false,nativeApplicationAcceptance:false}));
