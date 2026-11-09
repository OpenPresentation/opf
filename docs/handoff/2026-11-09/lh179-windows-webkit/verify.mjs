import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const folder=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(process.argv[2]??fileURLToPath(new URL('../../../../',import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const expected={
  "raw-files.json": "e05ca1b5ff09190d5c6ae9d696239eb70277b0d8b61a12f679f50173bbd6123f",
  "source-proof.json": "edbe83d878ea566261282564f6c274941142645e4a8e67c38d91a3ad980b3656",
  "diagnosis.json": "563130d4aec113352e221e279d8efc15307e4c9f3d6bb3c1cb419b9e73457030",
  "approval-review.json": "b17eb8ebcc6f81cec0f0ac10372d8134ac7076b9a189244cbe29abb9402e2cb4"
};
for(const [name,hash] of Object.entries(expected))assert.equal(sha(fs.readFileSync(path.join(folder,name))),hash,name);
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'raw-files.json'),'utf8'));
const wanted=new Set(['source-proof.json','diagnosis.json','approval-review.json','before-contract.exit.json','before-contract.log','after-contract.exit.json','after-contract.log','mapped-01.exit.json','mapped-01.log','source-worker-diagnostic-01.exit.json','source-worker-diagnostic-01.log','source-worker-diagnostic-02.exit.json','studio-diagnostic-01.exit.json']);
const raw=new Map();let total=0,compressed=0;const names=new Set(),archives=new Set();
for(const item of manifest.files){
  assert.ok(!path.isAbsolute(item.path)&&!item.path.split('/').includes('..'),item.path);
  assert.match(item.archive,/^raw\/\d{3}\.gz$/u);
  assert.ok(!names.has(item.path)&&!archives.has(item.archive),'unique names');names.add(item.path);archives.add(item.archive);
  const zipped=fs.readFileSync(path.join(folder,item.archive));assert.equal(zipped.length,item.compressedBytes);assert.equal(sha(zipped),item.compressedSha256,item.archive);
  assert.ok(item.bytes<=48*1024*1024,'48MiB entry bound');const bytes=gunzipSync(zipped,{maxOutputLength:item.bytes+1});
  assert.equal(bytes.length,item.bytes);assert.equal(sha(bytes),item.sha256,item.path);total+=bytes.length;compressed+=zipped.length;
  if(wanted.has(item.path))raw.set(item.path,bytes);
}
assert.equal(manifest.count,53);assert.equal(names.size,manifest.count);assert.equal(total,manifest.bytes);assert.ok(total<=128*1024*1024);assert.equal(compressed,manifest.compressedBytes);
for(const name of ['source-proof.json','diagnosis.json','approval-review.json'])assert.ok(raw.get(name).equals(fs.readFileSync(path.join(folder,name))),name);
const status=name=>JSON.parse(raw.get(name+'.exit.json').toString()).status;
assert.equal(status('before-contract'),1);assert.match(raw.get('before-contract.log').toString(),/provision default mobile engine webkit/u);
assert.equal(status('after-contract'),0);assert.match(raw.get('after-contract.log').toString(),/pass 21/u);
assert.equal(status('mapped-01'),1);assert.match(raw.get('mapped-01.log').toString(),/1 of 12 steps failed: pnpm run check:gallery-tracker/u);
assert.equal(status('source-worker-diagnostic-01'),1);assert.match(raw.get('source-worker-diagnostic-01.log').toString(),/ERR_UNSUPPORTED_ESM_URL_SCHEME/u);
assert.equal(status('source-worker-diagnostic-02'),0);assert.equal(status('studio-diagnostic-01'),0);
const proof=JSON.parse(raw.get('source-proof.json').toString());
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8',env:{...process.env,GIT_NO_LAZY_FETCH:'1'},maxBuffer:4*1024*1024}).trim();
assert.equal(proof.source,'83ea32fb115f533d0fc105eac8e4764b3736dafd');assert.equal(git('rev-parse',proof.source+'^{tree}'),proof.sourceTree);
execFileSync('git',['merge-base','--is-ancestor',proof.source,'HEAD'],{cwd:repo,stdio:'pipe',env:{...process.env,GIT_NO_LAZY_FETCH:'1'}});
for(const [file,object] of Object.entries({...proof.sourceObjects,...proof.protectedObjects}))assert.equal(git('rev-parse','HEAD:'+file),object,file);
execFileSync('git',['diff','--exit-code','HEAD','--',...Object.keys(proof.sourceObjects),...Object.keys(proof.protectedObjects)],{cwd:repo,stdio:'pipe',env:{...process.env,GIT_NO_LAZY_FETCH:'1'}});
assert.equal(Object.keys(proof.sourceObjects).length,2);assert.equal(Object.keys(proof.protectedObjects).length,12);
console.log(JSON.stringify({verified:true,source:proof.source,rawFiles:manifest.count,rawBytes:total,shippingObjects:2,protectedObjects:12,qualification:'Original aggregate remains RED; local profiles are nonreproductions, not timing acceptance'}));
