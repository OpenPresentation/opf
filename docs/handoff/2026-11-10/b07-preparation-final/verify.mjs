import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const folder=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(folder,'../../../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(args,options={})=>execFileSync('git',['--no-optional-locks','-C',root,...args],{maxBuffer:96*1024*1024,...options});
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
assert.equal(manifest.format,'b07-preparation-final-v1');
for(const p of manifest.previousPackets)assert.equal(sha(fs.readFileSync(path.join(folder,p.path))),p.sha256);
const raw=fs.readFileSync(path.join(folder,manifest.transport.path));assert.equal(raw.length,manifest.transport.bytes);assert.equal(sha(raw),manifest.transport.sha256);
const payload=JSON.parse(gunzipSync(raw,{maxOutputLength:4*1024*1024}));assert.equal(payload.format,manifest.format);assert.equal(payload.entries.length,42);assert.equal(manifest.entries.length,42);
const entries=new Map();let rawBytes=0;
for(let i=0;i<payload.entries.length;i++){const e=payload.entries[i];assert.ok(e.path.split('/').every(p=>p&&p!=='.'&&p!=='..'));assert.ok(!path.isAbsolute(e.path)&&!e.path.includes('\\'));assert.equal(entries.has(e.path),false);const b=Buffer.from(e.base64,'base64');assert.equal(b.toString('base64'),e.base64);assert.equal(b.length,e.bytes);assert.equal(sha(b),e.sha256);assert.deepEqual(manifest.entries[i],{path:e.path,bytes:e.bytes,sha256:e.sha256});entries.set(e.path,b);rawBytes+=b.length;}
assert.equal(rawBytes,2045855);const text=p=>{assert.ok(entries.has(p),p);return entries.get(p).toString('utf8').replace(/^\uFEFF/,'');};const json=p=>JSON.parse(text(p));
assert.equal(json('exact-source/mapped01.exit.json').exitCode,1);
assert.equal(json('exact-source/recovery01-gallery-tracker.exit.json').exitCode,1);
assert.equal(json('exact-source/recovery02-gallery-tracker.exit.json').exitCode,1);
assert.equal(json('exact-source/recovery01-text.exit.json').exitCode,0);
assert.equal(json('exact-source/recovery03-gallery-tracker.exit.json').exitCode,0);
assert.match(text('exact-source/recovery03-gallery-tracker.log'),/pass 18/);assert.match(text('exact-source/recovery03-gallery-tracker.log'),/Gallery tracker is up to date/);
assert.equal(json('adapter/mapped01.exit.json').exitCode,0);assert.equal(json('adapter/mapped01.exit.json').source,manifest.testedHead);assert.match(text('adapter/mapped01.log'),/check-changed: passed/);assert.match(text('adapter/mapped01.log'),/typecheck\s+skipped/);assert.equal(json('adapter/install01.exit.json').exitCode,0);
assert.equal(json('adapter/pure01.exit.json').exitCode,0);assert.match(text('adapter/pure01.log'),/pass 15/);assert.equal(json('adapter/actual-inspect01.exit.json').exitCode,0);assert.equal(json('adapter/actual-inspect01.exit.json').source,manifest.adapterCodeHead);
const check=json('exact-source/closure01-raw-verification02.json');assert.equal(check.count,1805);assert.equal(check.bytes,44606102);assert.deepEqual(check.mismatches,[]);assert.equal(check.fullIndexHeadEntriesEqual,true);assert.equal(check.indexEntryCount,22186);assert.equal(check.rawIndexBytesUnchanged,false);assert.equal(check.clean,true);assert.equal(check.restorationRepeated,false);
assert.equal(json('exact-source/setup-error-reconciliation.json').errors.length,2);
const copy=json('adapter/closure01-receipt.json');assert.equal(copy.source,manifest.testedHead);assert.equal(copy.count,1806);assert.equal(copy.bytes,44622204);assert.equal(copy.indexBefore,copy.indexAfter);assert.equal(copy.clean,true);assert.equal(copy.exclusiveWrites,true);assert.equal(copy.perPathHeadObjectEquality,true);assert.equal(copy.rawBlobIdentityVerified,true);
const required=new Map(copy.files.map(f=>[f.path,f]));assert.equal(required.size,1806);
for(const prefix of['exact-source','adapter']){const proof=json(prefix+'/catalog-proof01.json');assert.equal(proof.files.length,2);assert.equal(proof.indexBefore,proof.indexAfter);assert.equal(proof.clean,true);assert.equal(proof.exclusiveWrites,true);assert.equal(proof.files.reduce((n,r)=>n+r.bytes,0),3560);for(const f of proof.files){const prior=required.get(f.path);if(prior)assert.deepEqual({oid:prior.oid,bytes:prior.bytes,sha256:prior.sha256},{oid:f.oid,bytes:f.bytes,sha256:f.sha256});required.set(f.path,f);}}
assert.equal(required.size,1808);assert.equal([...required.values()].reduce((n,r)=>n+r.bytes,0),44625764);
for(const f of check.files){const r=required.get(f.path);assert.ok(r,f.path);assert.equal(r.oid,f.oid);assert.equal(r.bytes,f.bytes);assert.equal(r.sha256,f.sha256);}
const treeRows=git(['ls-tree','-rl',manifest.testedHead,'--','docs/evidence']).toString().trim().split(/\r?\n/).map(line=>{const m=line.match(/^\d+ blob ([a-f0-9]{40})\s+(\d+)\t(.+)$/);assert.ok(m);return{oid:m[1],bytes:Number(m[2]),path:m[3]};});const tree=new Map(treeRows.map(r=>[r.path,r]));
const objects=new Map();for(const r of required.values()){assert.deepEqual(tree.get(r.path),{oid:r.oid,bytes:r.bytes,path:r.path});const previous=objects.get(r.oid);if(previous)assert.equal(previous.sha256,r.sha256);else objects.set(r.oid,r);}
const packed=git(['cat-file','--batch'],{input:[...objects.keys()].join('\n')+'\n'});let offset=0;
for(const[oid,r]of objects){const end=packed.indexOf(10,offset);assert.ok(end>offset);const header=packed.subarray(offset,end).toString('ascii').split(' ');assert.deepEqual(header,[oid,'blob',String(r.bytes)]);offset=end+1;const b=packed.subarray(offset,offset+r.bytes);assert.equal(sha(b),r.sha256,r.path);offset+=r.bytes;assert.equal(packed[offset++],10);}assert.equal(offset,packed.length);
for(const r of manifest.protectedObjects)for(const ref of[manifest.base,manifest.testedHead,'HEAD'])assert.equal(git(['rev-parse',ref+':'+r.path]).toString().trim(),r.oid,r.path);
const source=JSON.parse(fs.readFileSync(path.join(folder,'../b07-preparation-checkpoint/manifest.json'),'utf8'));for(const r of source.source.filter(r=>r.path.startsWith('tools/'))){for(const ref of[manifest.adapterCodeHead,manifest.testedHead,'HEAD']){const b=git(['show',ref+':'+r.path]);assert.equal(b.length,r.bytes,r.path);assert.equal(sha(b),r.sha256,r.path);}}
assert.equal(manifest.outcome.workerInitialAggregateExit,1);assert.equal(manifest.outcome.adapterStockExit,0);for(const key of['actualSuitePrepared','controllerValidateOnly','OfficeRun','nativeAcceptance','registryAcceptance'])assert.equal(manifest.outcome[key],false);
console.log(JSON.stringify({verified:true,entries:entries.size,rawBytes,exactHeadPrerequisiteFiles:required.size,exactHeadPrerequisiteBytes:44625764,adapterStock:'PASS',originalWorkerAggregate:'RED retained; only failed steps recovered',actualSuitePrepared:false,OfficeRun:false}));
