import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const here=import.meta.dirname,receipt=JSON.parse(fs.readFileSync(path.join(here,'receipt.json'),'utf8'));
const archive=fs.readFileSync(path.join(here,'raw.json.gz'));
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(archive),receipt.archive.sha256);assert.equal(archive.length,receipt.archive.bytes);
const packet=JSON.parse(gunzipSync(archive)),seen=new Map();let total=0;
for(const entry of packet.records){assert.ok(!seen.has(entry.name));const bytes=Buffer.from(entry.base64,'base64');assert.equal(bytes.length,entry.bytes,entry.name);assert.equal(sha(bytes),entry.sha256,entry.name);seen.set(entry.name,bytes);total+=bytes.length;}
assert.equal(seen.size,receipt.records);assert.equal(total,receipt.rawBytes);
const json=name=>JSON.parse(seen.get(name).toString('utf8').replace(/^\uFEFF/,''));
for(const [name,status]of Object.entries(receipt.exits))assert.equal(json('own/'+name+'.exit.json').status,status,name);
assert.equal(receipt.nativeAcceptance,false);assert.equal(receipt.registryAcceptance,false);
assert.ok(seen.get('own/root519-render-contract.log').toString().includes('126 test(s) not run'));
assert.ok(seen.get('own/root519-pptx-contract.log').toString().includes('178 test(s) not run'));
assert.ok(seen.get('own/localized-cli-before-519.log').toString().includes('font-unavailable'));
assert.equal(json('own/localized-cli-after.log').ok,true);
for(const entry of receipt.protectedObjects)assert.equal(entry.base,entry.source,entry.path);
const root=path.resolve(here,'../../../..');
for(const entry of receipt.sourceBlobs){const current=execFileSync('git',['rev-parse','HEAD:'+entry.path],{cwd:root,encoding:'utf8'}).trim();assert.equal(current,entry.blob,entry.path);}
if(receipt.metadataCheck){const meta=receipt.metadataCheck,compressed=fs.readFileSync(path.join(here,meta.file));assert.equal(compressed.length,meta.bytes);assert.equal(sha(compressed),meta.sha256);const entries=JSON.parse(gunzipSync(compressed)).records;assert.equal(entries.length,meta.records);let rawBytes=0;const names=new Set();for(const entry of entries){assert.ok(!names.has(entry.name));names.add(entry.name);const b=Buffer.from(entry.base64,'base64');assert.equal(b.length,entry.bytes);assert.equal(sha(b),entry.sha256);rawBytes+=b.length;if(entry.name==='metadata.exit.json')assert.equal(JSON.parse(b.toString()).status,1);}assert.equal(rawBytes,meta.rawBytes);assert.equal(meta.status,'RED');}
console.log(JSON.stringify({ok:true,records:seen.size,rawBytes:total,source:receipt.source,sourceMatchesCurrent:true,required:receipt.required,nativeAcceptance:false,registryAcceptance:false}));
