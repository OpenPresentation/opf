// Offline evidence verification only. No archived program, test, build, render or Office action is executed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const folder=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(folder,'../../../..');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const local=name=>fs.readFileSync(path.join(folder,name));
const manifest=JSON.parse(local('manifest.json'));
const git=(...args)=>execFileSync('git',['--no-optional-locks','-C',root,...args],{env:{...process.env,GIT_NO_LAZY_FETCH:'1'},maxBuffer:16*1024*1024});
for(const item of [manifest.tailManifest,manifest.prerequisite,...manifest.proofFiles]){
 const bytes=local(item.path);assert.equal(bytes.length,item.bytes,item.path);assert.equal(sha(bytes),item.sha256,item.path);
}
const compressed=local(manifest.archive.path);assert.equal(compressed.length,manifest.archive.bytes);assert.equal(sha(compressed),manifest.archive.sha256);
const expanded=gunzipSync(compressed,{maxOutputLength:8*1024*1024});assert.equal(expanded.length,manifest.archive.expandedBytes);
const payload=JSON.parse(expanded),records=payload.records;assert.equal(payload.schema,1);assert.equal(records.length,393);
const seen=new Set(),bytesByName=new Map();let logicalBytes=0;
for(const row of records){
 assert.equal(typeof row.path,'string');assert.ok(row.path&&!path.isAbsolute(row.path)&&!row.path.split(/[\\/]/).includes('..'));assert.equal(seen.has(row.path),false,row.path);seen.add(row.path);
 const bytes=Buffer.from(row.base64,'base64');assert.equal(bytes.toString('base64'),row.base64,row.path);assert.equal(bytes.length,row.bytes,row.path);assert.equal(sha(bytes),row.sha256,row.path);logicalBytes+=bytes.length;bytesByName.set(row.path,bytes);
}
assert.equal(logicalBytes,332869);assert.equal(logicalBytes,manifest.archive.logicalBytes);
const retained=JSON.parse(local('tail-manifest.json'));assert.deepEqual(records.map(({path:filename,bytes,sha256})=>({path:filename,bytes,sha256})),retained.records);
const read=name=>{assert.ok(bytesByName.has(name),name);return JSON.parse(bytesByName.get(name));};
const plan=read('tail-plan.json'),before=read('before.json'),terminal=read('terminal.json'),outer=read('outer.exit.json');
assert.equal(plan.bound,manifest.source);assert.equal(before.head,manifest.source);assert.equal(before.tree,manifest.sourceTree);assert.equal(before.dirty,'');assert.equal(terminal.bound,manifest.source);
assert.equal(plan.suite,'contract');assert.equal(plan.scriptCount,297);assert.equal(plan.tailCount,128);assert.deepEqual(plan.omittedPrefixOrdinals,[1,169]);assert.equal(plan.retries,0);assert.equal(plan.singleSharedSlot,true);
assert.equal(plan.driver.sha256,sha(bytesByName.get('run-tail.mjs')));assert.equal(terminal.status,'PASS');assert.equal(terminal.visited,128);assert.equal(terminal.pass,128);assert.equal(outer.exit,0);assert.equal(terminal.failed,null);assert.deepEqual(terminal.unvisited,[]);assert.equal(terminal.guardError,undefined);assert.equal(terminal.sourceIndexRuntimeBuildInputsExact,true);assert.deepEqual(terminal.after,before);
assert.equal(before.buildFiles.length,295);assert.equal(before.buildFiles.reduce((sum,row)=>sum+row.bytes,0),25582875);assert.equal(new Set(before.buildFiles.map(row=>row.path)).size,295);
for(const row of before.buildFiles){assert.match(row.sha256,/^[a-f0-9]{64}$/);assert.ok(Number.isInteger(row.bytes)&&row.bytes>=0);assert.match(row.path,/^packages[\\/](javascript|gallery|render|pptx)[\\/]dist[\\/]/);}
assert.equal(retained.indexSha256,before.indexSha256);assert.equal(retained.stageSha256,before.stageSha256);assert.deepEqual(retained.sourceObjects,before.sourceObjects);
assert.equal(git('rev-parse',manifest.source+'^{tree}').toString().trim(),before.tree);
for(const row of before.sourceObjects)assert.equal(git('rev-parse',manifest.source+':'+row.path).toString().trim(),row.object,row.path);
const runner=git('show',manifest.source+':scripts/run-tests.mjs');assert.equal(sha(runner),manifest.maintained.runnerSHA256);assert.equal(git('rev-parse',manifest.source+':scripts/run-tests.mjs').toString().trim(),manifest.maintained.runnerBlob);
assert.equal(git('rev-parse',manifest.source+':packages/pptx/test/suites.json').toString().trim(),manifest.maintained.suitesBlob);
const suites=JSON.parse(git('show',manifest.source+':packages/pptx/test/suites.json'));
const files=git('ls-tree',manifest.source+':packages/pptx/test').toString().trim().split('\n').map(line=>/^\d+ blob [a-f0-9]+\t(.+)$/.exec(line)?.[1]).filter(name=>name?.endsWith('.mjs')).sort();
// Recheck the recorded selection against the maintained runner's source-described data policy; do not execute that source.
const excluded=new Set(suites.exclude??[]),included=new Set(suites.include??[]),nodeTest=new Set(suites.nodeTest??[]),contract=suites.contractExclude??{},browser=/(^|-)browser(-|\.)/;
for(const name of [...excluded,...included,...nodeTest,...Object.keys(contract)])assert.ok(files.includes(name),name);
const scripts=files.filter(name=>!name.endsWith('.test.mjs')&&!excluded.has(name)&&(!browser.test(name)||included.has(name))&&!Object.hasOwn(contract,name));
const batch=files.filter(name=>name.endsWith('.test.mjs')&&!Object.hasOwn(contract,name));assert.equal(scripts.length,297);assert.deepEqual(batch,plan.batchFilesNotRerun);assert.equal(scripts[168],'node-demand-native-fallback.mjs');
const commands=scripts.map((name,index)=>({ordinal:index+1,name,args:[...(nodeTest.has(name)?['--test']:[]),'test/'+name]}));assert.deepEqual(plan.allCommands,commands);assert.deepEqual(plan.selectedTail,commands.slice(169));
assert.deepEqual(terminal.results.map(({ordinal,name,args})=>({ordinal,name,args})),plan.selectedTail);
for(const row of terminal.results){
 const stem=String(row.ordinal).padStart(3,'0')+'-'+row.name;assert.deepEqual(read(stem+'.exit.json'),row);assert.equal(row.status,0);assert.equal(row.signal,null);assert.equal(row.error,null);assert.ok(row.ordinal>=170&&row.ordinal<=297);assert.ok(bytesByName.has(stem+'.stdout.log'));assert.ok(bytesByName.has(stem+'.stderr.log'));
}
assert.equal([...seen].filter(name=>/^\d{3}-.*\.exit\.json$/.test(name)).length,128);
for(const name of ['packages','spec','examples','scripts','package.json','pnpm-lock.yaml','pnpm-workspace.yaml'])assert.equal(git('rev-parse','HEAD:'+name).toString().trim(),git('rev-parse',manifest.base+':'+name).toString().trim(),name+' evidence-only source unchanged');
const prerequisite=JSON.parse(local('prerequisite.json'));assert.equal(prerequisite.oid,'2bb264bd47d1382c5cf50c9b7c4f75e2750be7f6');assert.equal(prerequisite.bytes,16102);assert.equal(prerequisite.sha256,'0b7ef1b73bbd4f31c5ac67716bea08f22a64df066f4ad343765c0d3d74511e56');assert.equal(prerequisite.indexBefore,prerequisite.indexAfter);assert.equal(prerequisite.stageBefore,prerequisite.stageAfter);assert.equal(prerequisite.absentBefore,true);assert.equal(prerequisite.exclusiveWrite,true);assert.equal(prerequisite.noFilters,true);assert.equal(prerequisite.noOverwrite,true);
console.log(JSON.stringify({status:'PASS',records:393,logicalBytes,contractScripts:297,selectedRange:[170,297],passed:128,unvisited:0,buildFiles295Exact:true,sourceIndexSnapshotsExact:true,fullSuite:false,office:false}));