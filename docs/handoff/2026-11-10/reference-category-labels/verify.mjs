import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(root,'../../../..'),sha=b=>createHash('sha256').update(b).digest('hex');
const m=JSON.parse(await readFile(root+'/qualification.json')),archive=await readFile(root+'/'+m.raw.path);
assert.equal(archive.length,m.raw.bytes);assert.equal(sha(archive),m.raw.sha256);const decoded=gunzipSync(archive,{maxOutputLength:8*1024*1024});assert.equal(decoded.length,m.raw.decodedBytes);const payload=JSON.parse(decoded),records=new Map();assert.equal(payload.records.length,m.records.length);
for(const r of payload.records){assert.ok(!records.has(r.path)&&!r.path.includes('..'));const b=Buffer.from(r.base64,'base64');assert.equal(b.toString('base64'),r.base64);assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);const expected=m.records.find(x=>x.path===r.path);assert.ok(expected);assert.equal(expected.bytes,r.bytes);assert.equal(expected.sha256,r.sha256);records.set(r.path,b);}
const read=p=>{assert.ok(records.has(p),p);return JSON.parse(records.get(p).toString('utf8'));},log=p=>{assert.ok(records.has(p),p);return records.get(p).toString('utf8');};
assert.equal(m.base,'b5a57bc86aba4de3e1ea28dcc38e47cfb46827f1');assert.equal(m.OfficeCalls,0);assert.equal(m.nativeAcceptance,false);assert.match(m.normalUnionMapper,/HELD/);
assert.equal(sha(await readFile(path.join(repo,m.runtimeSource))),m.runtimeSha256);assert.equal(sha(await readFile(path.join(repo,m.test))),m.testSha256);
for(const name of ['install','baseline-build','candidate-pptx-build','candidate-new-test','existing-reference-test'])assert.equal(read('checks/'+name+'-exit.json').exitCode,0,name);
assert.equal(read('checks/baseline-new-test-exit.json').exitCode,1);assert.match(log('checks/baseline-new-test.log'),/Unknown validate option "level"/);
assert.equal(read('checks/baseline-actual03-exit.json').exitCode,1);assert.equal(read('checks/baseline-actual03-exit.json').runtimePatched,false);assert.match(log('checks/baseline-actual03.log'),/ℹ pass 6\r?\nℹ fail 5/);assert.match(log('checks/baseline-actual03.log'),/'nextTo' !== 'low'/);
assert.match(log('checks/candidate-new-test.log'),/ℹ tests 12\r?\nℹ suites 0\r?\nℹ pass 12\r?\nℹ fail 0/);assert.match(log('checks/existing-reference-test.log'),/ℹ tests 43\r?\nℹ suites 0\r?\nℹ pass 43\r?\nℹ fail 0/);
for(const name of ['candidate-pptx-build','candidate-new-test','existing-reference-test']){const r=read('checks/'+name+'-exit.json');assert.equal(r.source.indexSha256,m.runtimeSha256);assert.equal(r.source.testSha256,m.testSha256);assert.equal(r.OfficeCalls,0);assert.equal(r.fullPptxSuite,false);assert.equal(r.normalUnionMapperRun,false);}
assert.equal(read('checks/focused-format-exit.json').exitCode,1);assert.match(log('checks/focused-format.stderr.log'),/Checked 0 files/);assert.match(log('checks/focused-format.stderr.log'),/provided but ignored/);
console.log(JSON.stringify({passed:true,records:m.records.length,rawBytes:m.records.reduce((s,r)=>s+r.bytes,0),base:m.base,baseline:m.actualBaseline,candidate:m.actualCandidate,existing:m.existingReferenceGroups,sourceHashesMatch:true,normalUnionMapper:m.normalUnionMapper,OfficeCalls:0,nativeAcceptance:false,newBuild:false,newTest:false},null,2));