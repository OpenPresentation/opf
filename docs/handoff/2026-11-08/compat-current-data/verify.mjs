import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const receipt=JSON.parse(readFileSync(new URL('receipt.json',import.meta.url),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
for(const item of receipt.source){const bytes=readFileSync(new URL(item.file,new URL('../../../../',import.meta.url)));assert.equal(bytes.length,item.bytes);assert.equal(hash(bytes),item.sha256);assert.equal(git(['rev-parse','HEAD:'+item.file]),item.gitBlob);}
for(const item of receipt.protectedTrees)assert.equal(git(['rev-parse','HEAD:'+item.file]),item.gitObject);
for(const item of receipt.artifacts){const bytes=readFileSync(new URL(item.file,new URL('../../../../',import.meta.url)));assert.equal(bytes.length,item.bytes);assert.equal(hash(bytes),item.sha256);const raw=item.file.endsWith('.gz')?gunzipSync(bytes):bytes;assert.equal(raw.length,item.rawBytes);assert.equal(hash(raw),item.rawSha256);}
assert.equal(receipt.mapped[1].failed,1);assert.equal(receipt.tail.passed,15);
console.log(JSON.stringify({source:receipt.source.length,protectedTrees:receipt.protectedTrees.length,artifacts:receipt.artifacts.length,mapped:'12pass/1studiofail/1skip',tail:'15pass',fullCandidateGreen:false}));
