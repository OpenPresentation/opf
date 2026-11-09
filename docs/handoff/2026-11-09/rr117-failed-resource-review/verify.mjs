import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const folder=new URL('./',import.meta.url),root=fileURLToPath(new URL('../../../../',folder));
const receipt=JSON.parse(readFileSync(new URL('receipt.json',folder)));
const hash=data=>createHash('sha256').update(data).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
assert.equal(git('rev-parse',receipt.source+'^{tree}'),receipt.sourceTree);
for(const item of receipt.protectedObjects){assert.equal(item.base,item.source);assert.equal(git('rev-parse',receipt.base+':'+item.file),item.base);assert.equal(git('rev-parse',receipt.source+':'+item.file),item.source);}
let currentRelevantMatches=true;
for(const item of receipt.files){assert.equal(git('rev-parse',receipt.source+':'+item.file),item.blob);if(git('rev-parse','HEAD:'+item.file)!==item.blob)currentRelevantMatches=false;}
const archive=readFileSync(new URL(receipt.raw.file,folder));assert.equal(archive.length,receipt.raw.size);assert.equal(hash(archive),receipt.raw.sha256);
const bundle=JSON.parse(gunzipSync(archive));assert.equal(bundle.format,'rr117-partial-resource-v1');assert.equal(bundle.entries.length,receipt.raw.entries.length);let total=0;
for(const [i,item] of bundle.entries.entries()){const bytes=Buffer.from(item.base64,'base64');assert.equal(bytes.length,item.size);assert.equal(hash(bytes),item.sha256);assert.deepEqual({name:item.name,size:item.size,sha256:item.sha256},receipt.raw.entries[i]);total+=bytes.length;}
assert.equal(total,receipt.raw.decodedBytes);
const before=JSON.parse(Buffer.from(bundle.entries.find(item=>item.name==='before-observed-exit.json').base64,'base64'));
const after=JSON.parse(Buffer.from(bundle.entries.find(item=>item.name==='after-browser.exit.json').base64,'base64'));
assert.equal(before.exitCode,1);assert.equal(after.exitCode,0);assert.equal(after.source,receipt.source);
for(const [name,revision,file] of [['workspace-before.js',receipt.base,'packages/editor/src/workspace.js'],['workspace-after.js',receipt.source,'packages/editor/src/workspace.js'],['browser-control.mjs',receipt.source,'packages/editor/test/review-hook-browser.mjs']])assert.equal(hash(execFileSync('git',['show',revision+':'+file],{cwd:root})),bundle.entries.find(item=>item.name===name).sha256);
console.log(JSON.stringify({verified:true,source:receipt.source,records:bundle.entries.length,rawBytes:total,currentRelevantMatches,scope:receipt.scope},null,2));
