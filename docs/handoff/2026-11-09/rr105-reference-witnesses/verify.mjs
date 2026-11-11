import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const folder=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(folder,'../../../..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),git=(...a)=>cp.execFileSync('git',['-C',repo,...a],{maxBuffer:4*1024*1024}),text=(...a)=>git(...a).toString('utf8').trim();
const m=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
assert.equal(m.status,'INCOMPLETE_SOURCE_WIP');assert.equal(text('rev-parse',m.source+'^{tree}'),m.tree);
for(const item of m.sourceFiles){const b=git('show',m.source+':'+item.file);assert.equal(b.length,item.bytes);assert.equal(hash(b),item.sha256);assert.equal(text('rev-parse',m.source+':'+item.file),item.blob);}
for(const item of m.originalProducerFiles){assert.equal(text('rev-parse',m.base+':'+item.file),item.blob);assert.equal(text('rev-parse',m.source+':'+item.file),item.blob);}
const gz=fs.readFileSync(path.join(folder,m.raw.file));assert.equal(gz.length,m.raw.bytes);assert.equal(hash(gz),m.raw.sha256);
const raw=gunzipSync(gz,{maxOutputLength:64*1024*1024});assert.equal(raw.length,m.raw.expandedBytes);const archive=JSON.parse(raw);assert.equal(archive.format,m.format);assert.equal(archive.entries.length,m.entries.length);
let bytes=0;const records=new Map();
for(const[i,e]of archive.entries.entries()){assert.ok(!e.name.startsWith('/')&&!e.name.includes('\\')&&!e.name.split('/').some(x=>x==='..'));assert.ok(!records.has(e.name));const b=Buffer.from(e.base64,'base64');assert.equal(b.length,e.size);assert.equal(hash(b),e.sha256);const{base64,...meta}=e;assert.deepEqual(meta,m.entries[i]);bytes+=b.length;records.set(e.name,b);}
assert.equal(bytes,m.raw.decodedBytes);const log=n=>records.get('checks/'+n).toString('utf8');
assert.match(log('pure-01.log'),/pass 4/);assert.match(log('pure-01.log'),/fail 1/);assert.match(log('pure-02.log'),/pass 5/);
assert.match(log('managed-01.log'),/Get-FileHash/);assert.match(log('managed-02.log'),/pass 3/);
const managed=JSON.parse(records.get('managed-pass/mock-results.json').toString('utf8').replace(/^\uFEFF/u,''));assert.equal(managed.officeInvoked,false);assert.equal(managed.mockOnly,true);assert.equal(managed.cases,55);assert.ok(managed.results.every(item=>item.passed===true));
assert.equal(m.outcomes.exportedShapeCounts,'UNMEASURED');assert.equal(m.outcomes.nativeProfileAdmission,'NOT_IMPLEMENTED');assert.equal(m.outcomes.currentConsumerGeneration,false);assert.equal(m.outcomes.officeInvoked,false);
console.log(JSON.stringify({verified:true,status:m.status,source:m.source,records:records.size,decodedBytes:bytes,sourceFiles:m.sourceFiles.length,sourceTests:5,workerSourceTests:3,managedCases:55,officeInvoked:false,scope:m.limitation}));
