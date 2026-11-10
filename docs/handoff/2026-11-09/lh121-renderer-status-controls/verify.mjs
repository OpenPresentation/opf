import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../..');
const {unzipSync}=createRequire(path.join(root,'packages/pptx/package.json'))('fflate');
const read=name=>JSON.parse(fs.readFileSync(path.join(here,name),'utf8'));
const receipt=read('qualification.json'),manifest=read('qualification.files.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root});
assert.equal(receipt.base,'b8fdd1cb88273a4f9963c9c01b89fbf1d5d5cc1b');
assert.equal(receipt.source,'2fe3cc0c539dcb001b89bd3cfe2f705ac7e4ed7e');
assert.equal(git('rev-parse',receipt.source+'^{tree}').toString().trim(),receipt.sourceTree);
git('merge-base','--is-ancestor',receipt.base,receipt.source);
assert.equal(receipt.bindings.length,4);
for(const item of receipt.bindings){const bytes=git('show',receipt.source+':'+item.file);assert.equal(bytes.length,item.bytes);assert.equal(sha(bytes),item.sha256);assert.equal(git('rev-parse','HEAD:'+item.file).toString().trim(),item.oid);assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256);}
for(const [file,oid]of Object.entries(receipt.protectedTrees))assert.equal(git('rev-parse','HEAD:'+file).toString().trim(),oid,'Unchanged '+file);
for(const file of git('diff','--name-only',receipt.source,'HEAD').toString().trim().split('\n').filter(Boolean))assert.ok(file.startsWith('docs/handoff/2026-11-09/lh121-renderer-status-controls/'),'Metadata only '+file);
const archive=fs.readFileSync(path.join(here,manifest.file));assert.equal(archive.length,manifest.bytes);assert.equal(sha(archive),manifest.sha256);assert.equal(sha(archive),receipt.archive.sha256);
const entries=unzipSync(archive);assert.deepEqual(Object.keys(entries).sort(),manifest.files.map(item=>item.file).sort());
for(const item of manifest.files){assert.equal(entries[item.file].length,item.bytes);assert.equal(sha(entries[item.file]),item.sha256);}
const text=name=>Buffer.from(entries[name]).toString('utf8'),json=name=>JSON.parse(text(name));
assert.equal(entries['ci/original-renderer3.log'].length,93545);assert.equal(sha(entries['ci/original-renderer3.log']),'73dc2390f8a0b8c808409d080482550cdfe997f8e34bb09cd5348e9ec79b4ae1');
assert.equal(json('local/install.exit.json').exitCode,0);assert.equal(json('local/build-before.exit.json').exitCode,0);
assert.equal(json('local/focused-before.exit.json').exitCode,1);assert.ok(text('local/focused-before.log').includes('383.9398632812499'));assert.ok(text('local/focused-before.log').includes('402.1503124999999'));
for(const name of ['focused-after','focused-final']){assert.equal(json('local/'+name+'.exit.json').exitCode,0);assert.ok(text('local/'+name+'.log').includes('no-vocabulary control remains byte-identical'));}
assert.equal(json('local/mapped-01.exit.json').exitCode,1);assert.ok(text('mapped-01-steps/pnpm_run_check_text.log').includes('ENOENT'));assert.ok(text('mapped-01-steps/pnpm_run_check_text.log').includes('painting-Linux.json.gz'));
assert.equal(json('local/mapped-02.exit.json').exitCode,0);assert.ok(text('local/mapped-02.log').includes('check-changed: passed.'));assert.ok(text('mapped-02-steps/tests_render.log').includes('all marker geometry match their own light/dark layouts'));
const recovered=receipt.exactInputRecovery,bytes=git('show',receipt.base+':'+recovered.file);assert.equal(bytes.length,16102);assert.equal(sha(bytes),recovered.sha256);assert.equal(git('rev-parse',receipt.base+':'+recovered.file).toString().trim(),recovered.blob);assert.equal(recovered.actual,recovered.blob);
assert.equal(json('local/seal-setup.json').error,'MODULE_NOT_FOUND: fflate');
for(const key of ['runtimeChanges','schemaChanges','goldenChanges','toleranceChanges','officeCalls','ciDispatches','networkVerifierCalls'])assert.equal(receipt[key],0);
console.log(JSON.stringify({valid:true,source:receipt.source,sourcePaths:receipt.bindings.length,protectedTrees:Object.keys(receipt.protectedTrees).length,rawMembers:manifest.files.length,originalCIAndLocalFailuresRetained:true,mappedRecoveryPassed:true,runtimeChanged:false,nativeAccepted:false}));
