import './verify.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(readFileSync(path.join(root,'manifest.json'),'utf8'));
const validation=manifest.metadataValidation;
const zipped=readFileSync(path.join(root,validation.path));
assert.equal(zipped.length,validation.bytes);assert.equal(sha(zipped),validation.sha256);
const plain=gunzipSync(zipped);
assert.equal(plain.length,validation.rawBytes);assert.equal(sha(plain),validation.rawSha256);
const data=JSON.parse(plain);
assert.equal(data.members.length,validation.members.length);
for(const [index,member] of data.members.entries()){
 const bytes=Buffer.from(member.data,'base64');
 assert.equal(bytes.length,member.bytes);assert.equal(sha(bytes),member.sha256);
 const {data:ignored,...record}=member;assert.deepEqual(record,validation.members[index]);
}
console.log(JSON.stringify({metadataValidationPassed:true,members:data.members.length}));
