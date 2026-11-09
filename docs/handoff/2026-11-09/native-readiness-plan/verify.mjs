import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../..');
const receipt=JSON.parse(fs.readFileSync(path.join(here,'receipt.json'),'utf8'));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(receipt.base,'b8fdd1cb88273a4f9963c9c01b89fbf1d5d5cc1b');assert.equal(receipt.plan,'555f7fa40fcec7e99b7e8faf222489b30df3fa19');
assert.equal(git('rev-parse','HEAD:docs/handoff/2026-11-09/native-readiness-plan/README.md'),receipt.readmeOID);
for(const [file,oid]of Object.entries(receipt.protectedTrees))assert.equal(git('rev-parse','HEAD:'+file),oid);
for(const file of git('diff','--name-only',receipt.base,'HEAD').split('\n').filter(Boolean))assert.ok(file.startsWith('docs/handoff/2026-11-09/native-readiness-plan/'));
for(const item of receipt.files){assert.ok(item.file.startsWith('raw/')&&!item.file.includes('..'));const stored=fs.readFileSync(path.join(here,item.file));assert.equal(stored.length,item.storedBytes);assert.equal(sha(stored),item.storedSHA256);const bytes=gunzipSync(stored);assert.equal(bytes.length,item.bytes);assert.equal(sha(bytes),item.sha256);}
for(const key of ['officeCalls','nativeScriptsExecuted','witnessExports','fontRegistration','networkRequests','providerActions','ciDispatches'])assert.equal(receipt[key],0);
assert.equal(receipt.nativeAcceptance,false);assert.equal(receipt.branchPolicy,'NEVER MERGE');
console.log(JSON.stringify({valid:true,base:receipt.base,plan:receipt.plan,protectedTrees:Object.keys(receipt.protectedTrees).length,rawFiles:receipt.files.length,nativeAcceptance:false,branchPolicy:receipt.branchPolicy}));
