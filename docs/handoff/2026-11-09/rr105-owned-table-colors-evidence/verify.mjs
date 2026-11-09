import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=fileURLToPath(new URL('../../../../',import.meta.url));
const {unzipSync}=createRequire(path.join(root,'packages/pptx/package.json'))('fflate');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const receipt=JSON.parse(fs.readFileSync(path.join(here,'receipt.json'),'utf8'));
assert.equal(receipt.nativeAcceptance,false);assert.equal(receipt.officeInvoked,false);assert.equal(receipt.neverMerge,true);
const archive=fs.readFileSync(path.join(here,'raw.zip'));assert.equal(archive.length,receipt.raw.bytes);assert.equal(hash(archive),receipt.raw.sha256);
const parts=unzipSync(archive);assert.deepEqual(Object.keys(parts).sort(),[...new Set(receipt.files.map(file=>file.blob))].sort());
const logical=new Map(receipt.files.map(file=>[file.path,parts[file.blob]]));
for(const file of receipt.files){assert.ok(!file.path.includes('\\')&&!path.isAbsolute(file.path)&&file.path.split('/').every(p=>p&&p!=='.'&&p!=='..'));assert.equal(parts[file.blob].length,file.bytes);assert.equal(hash(parts[file.blob]),file.sha256);}
const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',maxBuffer:8*1024*1024}).trim();
for(const record of receipt.alignment.source){assert.equal(git('rev-parse',receipt.sources.approved+':'+record.file),record.approved);assert.equal(git('rev-parse',receipt.sources.aligned+':'+record.file),record.aligned);assert.equal(record.approved,record.aligned);}
for(const record of receipt.alignment.protectedMatches){assert.equal(git('rev-parse',receipt.sources.integration+':'+record.file),record.base);assert.equal(git('rev-parse',receipt.sources.aligned+':'+record.file),record.aligned);assert.equal(record.base,record.aligned);}
for(const prepared of receipt.prepared){const prefix=prepared.prefix;const profile=JSON.parse(Buffer.from(logical.get(prefix+'/table-profile.json')).toString('utf8'));assert.equal(hash(logical.get(prefix+'/table-profile.json')),prepared.sha256);assert.equal(profile.controller.revision,prepared.revision);assert.equal(profile.nativeAcceptance,false);for(const record of profile.snapshots){const file=logical.get(prefix+'/'+record.path);assert.ok(file,'Missing original prepared snapshot');assert.equal(file.length,record.bytes);assert.equal(hash(file),record.sha256);}}
for(const control of receipt.controls){const record=JSON.parse(Buffer.from(logical.get(control.path)).toString('utf8').replace(/^\uFEFF/u,''));assert.equal(record.passed,true);assert.equal(record.cases.length,control.cases);assert.equal(record.sourceWorkerSha256,control.sourceWorkerSha256);assert.ok(record.cases.every(item=>item.passed));}
assert.ok(receipt.finalControls.length>0);for(const control of receipt.finalControls){assert.equal(control.cases,79);assert.ok(receipt.controls.some(item=>item.path===control.path&&item.sourceWorkerSha256===control.sourceWorkerSha256));}
console.log(JSON.stringify({passed:true,files:receipt.files.length,source:receipt.sources.aligned,officeInvoked:false,nativeAcceptance:false,scope:'Lossless source/pure-control evidence only; not physical/native qualification'}));
