import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const directory=fileURLToPath(new URL('./',import.meta.url)),repo=fileURLToPath(new URL('../../../../',import.meta.url));
const receipt=JSON.parse(fs.readFileSync(path.join(directory,'receipt.json'),'utf8'));
const files=JSON.parse(fs.readFileSync(path.join(directory,receipt.files),'utf8')).files;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:repo});
assert.equal(git('rev-parse',receipt.source+'^{tree}').toString().trim(),receipt.sourceTree);
for(const row of files){
 assert.equal(path.basename(row.file),row.file);
 const packed=fs.readFileSync(path.join(directory,row.file)),raw=gunzipSync(packed);
 assert.equal(packed.length,row.storedBytes,row.file);assert.equal(hash(packed),row.storedSha256,row.file);
 assert.equal(raw.length,row.rawBytes,row.file);assert.equal(hash(raw),row.rawSha256,row.file);
}
for(const row of receipt.sourceBindings){
 assert.equal(hash(git('show',receipt.source+':'+row.file)),row.sha256,row.file);
 assert.equal(git('rev-parse',receipt.source+':'+row.file).toString().trim(),row.gitBlob,row.file);
}
for(const row of receipt.runtimeInputs){
 const raw=fs.readFileSync(path.join(repo,row.file));assert.equal(hash(raw),row.rawSha256,row.file);
 assert.equal(git('hash-object','--path='+row.file,row.file).toString().trim(),row.gitBlob,row.file);
}
for(const file of receipt.protectedFiles)assert.ok(git('show',receipt.base+':'+file).equals(git('show',receipt.source+':'+file)),file);
assert.equal(receipt.results.mapped.exitCode,1);
assert.equal(receipt.results.mappedFailure.test,'codemirror-guard.mjs');
assert.equal(receipt.results.mappedFailure.code,'EPERM');
assert.equal(receipt.results.remainingContract.remainingPassed,124);
assert.equal(receipt.results.remainingContract.remainingFailed.length,1);
assert.equal(receipt.results.remainingContract.remainingFailed[0].name,'native-playground-controls.mjs');
assert.equal(receipt.results.remainingContract.aggregateMappedGreen,false);
assert.equal(receipt.results.browserControls.exitCode,0);
assert.equal(receipt.results.focusedForwardPhases,12);
assert.equal(receipt.scope.cacheConstructionUnchanged,true);
assert.equal(receipt.scope.apiOrProviderCalls,0);assert.equal(receipt.scope.pushes,0);
const later=git('diff','--name-only',receipt.source,'HEAD').toString().trim().split('\n').filter(Boolean);
for(const file of later)assert.ok(file.startsWith('docs/handoff/2026-11-08/ce20-unused-thumbnail-cache')||file==='docs/programs/cloud-editor/burndown.md',file);
console.log(JSON.stringify({verified:true,source:receipt.source,artifacts:files.length,runtimeInputs:receipt.runtimeInputs.length,protectedFiles:receipt.protectedFiles.length,aggregateMappedGreen:false,browserControlSuites:receipt.results.browserControls.results.length,remainingContractPassed:124}));
