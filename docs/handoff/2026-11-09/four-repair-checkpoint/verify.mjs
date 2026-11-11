import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const base=new URL('./',import.meta.url),root=fileURLToPath(new URL('../../../../',base));
const r=JSON.parse(fs.readFileSync(new URL('receipt.json',base))),hash=b=>createHash('sha256').update(b).digest('hex');
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_NO_LAZY_FETCH:'1'}}).trim();
assert.equal(git('rev-parse',r.source+'^{tree}'),r.sourceTree);
for(const leaf of r.leaves){assert.equal(git('rev-parse',leaf.head+'^{tree}'),leaf.tree);assert.equal(git('rev-parse',leaf.merge+'^{tree}'),leaf.mergeTree);assert.deepEqual(git('show','-s','--format=%P',leaf.merge).split(' '),leaf.parents);}
assert.deepEqual(git('diff','--name-only',r.base,r.source).split('\n').sort(),[...r.changedPaths.map(x=>x.file),r.controlledBurndown].sort());
for(const p of r.changedPaths)assert.equal(git('rev-parse',r.source+':'+p.file),p.oid,p.file);
for(const p of r.protectedObjects){assert.equal(git('rev-parse',r.base+':'+p.file),p.oid);assert.equal(git('rev-parse',r.source+':'+p.file),p.oid);}
for(const f of r.raw){assert.match(f.file,/^raw\/[0-9]{3}[.]gz$/);const gz=fs.readFileSync(new URL(f.file,base));assert.equal(gz.length,f.gzipBytes);assert.equal(hash(gz),f.gzipSHA256);const b=gunzipSync(gz);assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256);}
assert.equal(r.mapped.exitCode,1);assert.equal(r.mapped.failedSteps,6);assert.equal(r.recovery.originalAggregateStillRed,true);
console.log(JSON.stringify({verified:true,source:r.source,sourcePRs:r.leaves.map(x=>x.pr),exactChangedPaths:r.changedPaths.length+1,retainedRawFiles:r.raw.length,originalMappedRed:true,nativeOrReleaseAcceptance:false}));
