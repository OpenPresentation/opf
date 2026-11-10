import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const read=name=>readFileSync(new URL(name,import.meta.url)),sha=x=>createHash('sha256').update(x).digest('hex');
const receipt=JSON.parse(read('receipt.json')),compressed=read('raw.json.gz');assert.equal(compressed.length,receipt.compressedBytes);assert.equal(sha(compressed),receipt.archiveSha256);const raw=gunzipSync(compressed);assert.equal(raw.length,receipt.rawBytes);const packet=JSON.parse(raw),records=new Map();assert.equal(packet.source,receipt.source);assert.equal(packet.records.length,receipt.records);
for(const row of packet.records){assert(!records.has(row.name));const data=Buffer.from(row.base64,'base64');assert.equal(data.length,row.bytes);assert.equal(sha(data),row.sha256);records.set(row.name,data);}
for(const[key,count]of [['focused01',33],['demand-fault01',14],['native01',7]]){const log=records.get('logs/'+key+'.log').toString();assert.match(log,new RegExp('pass '+count));assert.match(log,/fail 0/);}
assert.match(records.get('logs/lazy01.log').toString(),/"resolutionsCompared":558/);assert.match(records.get('logs/analysis01.log').toString(),/each slide analyzed once/);assert.match(records.get('logs/syntax01.log').toString(),/337 files checked, 0 failed/);assert.match(records.get('logs/biome01.log').toString(),/No files were processed/);
const repository=new URL('../../../../',import.meta.url);let currentSourceMatches=true,currentBuildMatches=true;
for(const row of receipt.bindings){assert.equal(sha(records.get(row.file)),row.sha256);currentSourceMatches&&=sha(readFileSync(new URL(row.file,repository)))===row.sha256;if(row.file.includes('/src/')){const built=row.file.replace('/src/','/dist/');assert.equal(sha(records.get(built)),row.sha256);currentBuildMatches&&=sha(readFileSync(new URL(built,repository)))===row.sha256;}}
console.log(JSON.stringify({status:'PASS',source:receipt.source,records:records.size,rawBytes:raw.length,tests:receipt.tests,currentSourceMatches,currentBuildMatches,performance:'Unmeasured source; no gain claimed.'}));
