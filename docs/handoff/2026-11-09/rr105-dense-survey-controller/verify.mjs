import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const folder=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(process.argv[2]??fileURLToPath(new URL('../../../../',import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),expected={
  "raw-files.json": "3fc2ee74762fe31ac3134704d77ce1492919ffb04b1a8d340b8eae6e6efff8f2",
  "source-proof.json": "669beba63669660e185c23aa65d9aa5360335262c88fd6f1e7209ac94a97aa6e",
  "qualification.json": "b221640531209ed0184728d1865a70a065aae60b00243a1c385dd0af041d724b"
};
for(const [name,digest]of Object.entries(expected))assert.equal(sha(fs.readFileSync(path.join(folder,name))),digest,name);
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'raw-files.json'),'utf8'));let bytes=0,compressed=0;const seen=new Set(),archives=new Set(),small=new Map();
for(const item of manifest.files){assert.ok(item.path&&!path.isAbsolute(item.path)&&!item.path.split('/').includes('..'));assert.match(item.archive,/^raw\/\d{3}\.gz$/u);assert.ok(!seen.has(item.path)&&!archives.has(item.archive));seen.add(item.path);archives.add(item.archive);const zipped=fs.readFileSync(path.join(folder,item.archive));assert.equal(zipped.length,item.compressedBytes);assert.equal(sha(zipped),item.compressedSha256);assert.ok(item.bytes<=16*1024*1024);const raw=gunzipSync(zipped,{maxOutputLength:item.bytes+1});assert.equal(raw.length,item.bytes);assert.equal(sha(raw),item.sha256,item.path);bytes+=raw.length;compressed+=zipped.length;small.set(item.path,raw);}
assert.equal(manifest.count,28);assert.equal(seen.size,manifest.count);assert.equal(bytes,manifest.bytes);assert.equal(compressed,manifest.compressedBytes);assert.ok(bytes<=64*1024*1024);
for(const file of ['source-proof.json','qualification.json'])assert.ok(small.get(file).equals(fs.readFileSync(path.join(folder,file))));
const status=prefix=>JSON.parse(small.get(prefix+'.exit.json')).status;
assert.equal(status('focused-01'),1);assert.match(small.get('focused-01.log').toString(),/pass 12/u);assert.match(small.get('focused-01.log').toString(),/Join-Path : Cannot bind argument/u);
assert.equal(status('focused-ps-02'),0);assert.equal(status('focused-03'),0);assert.equal(status('focused-final-04'),0);assert.match(small.get('focused-final-04.log').toString(),/pass 19/u);assert.equal(status('mapped-01'),1);assert.match(small.get('mapped-01.log').toString(),/3 of 11 steps failed/u);
assert.match(small.get('mapped-original-steps/pnpm_run_check_native-acceptance.log').toString(),/pass 80/u);assert.match(small.get('mapped-original-steps/pnpm_run_check_native-acceptance.log').toString(),/fail 4/u);assert.match(small.get('mapped-original-steps/pnpm_run_check_text.log').toString(),/ENOENT/u);
const proof=JSON.parse(small.get('source-proof.json')),git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8',env:{...process.env,GIT_NO_LAZY_FETCH:'1'},maxBuffer:4*1024*1024}).trim();
assert.equal(proof.source,'ad00d5cad0b80b63237dc1bd377cf773e4060186');assert.equal(git('rev-parse',proof.source+'^{tree}'),proof.sourceTree);assert.equal(Object.keys(proof.owned).length,14);assert.equal(Object.keys(proof.protectedObjects).length,14);
for(const [file,object]of Object.entries(proof.owned))assert.equal(git('rev-parse',proof.source+':'+file),object,file);
const payload=Object.fromEntries(Object.entries(proof.owned).filter(([file])=>file!=='docs/handoff/2026-11-09/rr105-dense-survey-controller/README.md'));
for(const [file,object]of Object.entries({...payload,...proof.protectedObjects}))assert.equal(git('rev-parse','HEAD:'+file),object,file);
execFileSync('git',['merge-base','--is-ancestor',proof.source,'HEAD'],{cwd:repo,stdio:'pipe',env:{...process.env,GIT_NO_LAZY_FETCH:'1'}});
execFileSync('git',['diff','--exit-code','HEAD','--',...Object.keys(payload),...Object.keys(proof.protectedObjects)],{cwd:repo,stdio:'pipe',env:{...process.env,GIT_NO_LAZY_FETCH:'1'}});
const q=JSON.parse(small.get('qualification.json'));assert.equal(q.source,proof.source);assert.equal(q.focused.tests,19);assert.equal(q.mapped.exit,1);assert.equal(q.mapped.native.failed,4);assert.equal(proof.frozenInputs.selectedCase.automaticControlEligible,false);
console.log(JSON.stringify({verified:true,source:proof.source,rawFiles:manifest.count,rawBytes:bytes,sourcePaths:14,unchangedPayloadPaths:Object.keys(payload).length,protectedObjects:14,qualifiedScope:'19Office-freecontrols; original mapped RED remains; no actual controller or Office run'}));
