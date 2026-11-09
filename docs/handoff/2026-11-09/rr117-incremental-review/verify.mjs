import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const folder=new URL('./',import.meta.url), repo=fileURLToPath(new URL('../../../../',import.meta.url));
const receipt=JSON.parse(readFileSync(new URL('receipt.json',folder)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',['-C',repo,...args],{encoding:'utf8'}).trim();
assert.equal(git('rev-parse',`${receipt.source}^{tree}`),receipt.sourceTree);
for(const item of receipt.protectedObjects){
  assert.equal(item.base,item.source,`protected ${item.path}`);
  assert.equal(git('rev-parse',`${receipt.base}:${item.path}`),item.base);
  assert.equal(git('rev-parse',`${receipt.source}:${item.path}`),item.source);
  assert.equal(git('rev-parse',`HEAD:${item.path}`),item.source);
}
for(const item of receipt.files){
  assert.equal(git('rev-parse',`${receipt.source}:${item.path}`),item.blob);
  assert.equal(git('rev-parse',`HEAD:${item.path}`),item.blob);
}
for(const file of git('diff','--name-only',receipt.source,'HEAD').split('\n').filter(Boolean)) assert.ok(file.startsWith('docs/handoff/2026-11-09/rr117-incremental-review/'),`non-evidence descendant ${file}`);
const archive=readFileSync(new URL(receipt.raw.file,folder));
assert.equal(archive.length,receipt.raw.size);
assert.equal(sha(archive),receipt.raw.sha256);
const bundle=JSON.parse(gunzipSync(archive));
assert.equal(bundle.format,'rr117-raw-v1');
assert.equal(bundle.entries.length,receipt.raw.members);
const names=new Set();let total=0;
for(const [i,item] of bundle.entries.entries()){
  assert.match(item.name,/^[a-z0-9][a-z0-9.-]*$/);
  assert.ok(!names.has(item.name));names.add(item.name);
  const bytes=Buffer.from(item.base64,'base64');
  assert.equal(bytes.length,item.size);assert.equal(sha(bytes),item.sha256);
  assert.deepEqual({name:item.name,size:item.size,sha256:item.sha256},receipt.raw.entries[i]);
  total+=bytes.length;
}
assert.equal(total,receipt.raw.decodedBytes);
for(const file of ['core-focused-06.exit.json','review-browser-02.exit.json','core-lazy-existing-01.exit.json','build-core-05.exit.json','build-render-01.exit.json','lint-final-01.exit.json']){
  const item=bundle.entries.find(entry=>entry.name===file);assert.ok(item,file);
  assert.equal(JSON.parse(Buffer.from(item.base64,'base64')).exitCode,0,file);
}
console.log(`PASS RR117 evidence: ${bundle.entries.length} lossless raw files, ${total} bytes, ${receipt.protectedObjects.length} protected objects; focused source only, combined/paired CPU/heap gates pending.`);
