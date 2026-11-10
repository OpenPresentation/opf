import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../../../..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const parse=b=>JSON.parse(b.toString('utf8').replace(/^\uFEFF/,''));
const r=parse(fs.readFileSync(path.join(here,'receipt.json'))),packed=fs.readFileSync(path.join(here,r.raw.path));
assert.equal(packed.length,r.raw.bytes);assert.equal(sha(packed),r.raw.sha256);
const expanded=zlib.gunzipSync(packed);assert.equal(expanded.length,r.raw.expandedBytes);
const records=parse(expanded).records;assert.equal(records.length,r.raw.recordCount);assert.equal(new Set(records.map(v=>v.key)).size,records.length);
assert.equal(records.reduce((n,v)=>n+v.bytes,0),r.raw.totalRecordBytes);
const files=new Map(),git=args=>execFileSync('git',['--no-optional-locks',...args],{cwd:repo,env:{...process.env,GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0'},maxBuffer:16*1024*1024});
for(let i=0;i<records.length;i++){
  const {base64,...identity}=records[i];assert.deepEqual(identity,r.files[i]);assert(!identity.key.split('/').includes('..'));
  assert(!/\.(?:ttf|otf|woff2?|wasm|exe|dll)$/i.test(identity.key),'No font/dependency/system binary is copied');
  const b=Buffer.from(base64,'base64');assert.equal(b.length,identity.bytes,identity.key);assert.equal(sha(b),identity.sha256,identity.key);files.set(identity.key,b);
  if(/^[a-f0-9]{40}:/.test(identity.source))assert.deepEqual(git(['show',identity.source]),b,'Historical source differs');
}
const get=key=>{assert(files.has(key),'Missing retained record '+key);return files.get(key);},json=key=>parse(get(key));
assert.equal(r.base,'57acc14a61c19cceab26d5bce7b3ce6c6aa745c2');assert.equal(r.source,'3042e83a23e785243812868d9dd565d9e9c043b6');
assert.equal(r.fixtureSource,'9e120cf3379286cba31df84f46a0987f7cde8eef');
for(const [p,oid]of Object.entries(r.protectedObjects)){assert.equal(git(['rev-parse',r.base+':'+p]).toString().trim(),oid);assert.equal(git(['rev-parse',r.fixtureSource+':'+p]).toString().trim(),oid);}
assert.equal(git(['rev-parse',r.source+':packages/render/src']).toString().trim(),r.runtimeTree);assert.equal(git(['rev-parse',r.fixtureSource+':packages/render/src']).toString().trim(),r.runtimeTree);
for(const p of r.sourcePaths)assert.deepEqual(git(['show',r.source+':'+p]),git(['show',r.fixtureSource+':'+p]),'Only the declared later fixtures/docs may change');
for(const b of r.buildBindings){assert.equal(b.byteIdentical,true);assert.equal(b.sourceSha256,b.distSha256);assert.equal(sha(git(['show',r.source+':packages/render/src/'+b.path])),b.sourceSha256);}
const baseline=json('raw/baseline/result.json'),prior=json('raw/candidate/result.json'),candidate=json('raw/candidate02/result.json');
assert.equal(baseline.source,r.base);assert.equal(prior.source,r.priorSource);assert.equal(candidate.source,r.source);
assert.equal(baseline.validation.valid,true);assert.equal(candidate.validation.valid,true);
assert.deepEqual(baseline.equal,{svg:true,png:false,pdf:false});assert.deepEqual(prior.equal,{svg:true,png:true,pdf:true});assert.deepEqual(candidate.equal,{svg:true,png:true,pdf:true});
for(const [dir,data]of [['baseline',baseline],['candidate',prior],['candidate02',candidate]])for(const mode of ['demand','whole'])for(const kind of ['svg','png','pdf']){const b=get('raw/'+dir+'/'+mode+'.'+kind);assert.equal(sha(b),data.runs[mode][kind].sha256);assert.equal(b.length,data.runs[mode][kind].bytes);}
assert.equal(baseline.runs.demand.fontFiles.length,2);assert.equal(candidate.runs.demand.fontFiles.length,3);assert.equal(candidate.runs.whole.fontFiles.length,133);
assert.equal(candidate.runs.demand.png.sha256,baseline.runs.whole.png.sha256);assert.equal(candidate.runs.demand.pdf.sha256,baseline.runs.whole.pdf.sha256);
const mono=candidate.runs.demand.fontFiles.filter(v=>v.file.replaceAll('\\','/').endsWith('/noto-emoji/400Regular/NotoEmoji_400Regular.ttf'));assert.equal(mono.length,1);assert.equal(mono[0].sha256,r.companion.faces[0].sha256);
const manifestText=git(['show',r.source+':packages/render/src/font-manifest.js']).toString(),marker='export const BUNDLED_FONT_MANIFEST=freeze(';
const manifest=JSON.parse(manifestText.slice(manifestText.indexOf(marker)+marker.length).trim().replace(/\);$/,''));
const companion=manifest.packages.find(pkg=>pkg.name===r.companion.package);for(const key of ['version','license','licenseSha256','faces'])assert.deepEqual(companion[key],r.companion[key]);
const final=json('raw/final-focused-terminal02.json');assert.equal(final.results.length,10);assert(final.results.every(v=>v.exitCode===0));assert.equal(final.sourceUnchanged,true);
for(const file of final.files)assert.equal(sha(git(['show',r.source+':'+file.path])),file.sha256);
for(const [key,count]of [['raw/final-new02.log',11],['raw/final-demand02.log',11],['raw/final-private02.log',7]]){const text=get(key).toString();assert.match(text,new RegExp('tests '+count+'(?:\\r?\\n|$)'));assert.match(text,/fail 0(?:\r?\n|$)/);}
assert.match(get('raw/final-host-family02.log').toString(),/35 families, 137 styles.*350 runs.*67 faces/);
assert.match(get('raw/final-host-name02.log').toString(),/23 proprietary names.*1509 run checks, 30 route faces/);
assert.match(get('raw/final-symbol02.log').toString(),/5 families, 1059 of 1120 codes.*61 placeholders/);
assert.match(get('raw/final-syntax02.log').toString(),/339 files checked, 0 failed/);
for(const fixture of [r.lazyFixture,r.rasterFixture]){
  const exit=json(fixture.exitRecord);assert.equal(exit.exitCode,0);assert.equal(exit.runtimeSource,r.source);assert.equal(exit.fixtureSha256,fixture.sha256);assert.equal(exit.runtimeBeforeSha256,exit.runtimeAfterSha256);assert.equal(exit.runtimeBeforeSha256,r.buildBindings.find(v=>v.path==='font-demand.js').sourceSha256);
  assert.equal(sha(git(['show',r.fixtureSource+':'+fixture.path])),fixture.sha256);
}
assert.match(get('raw/lazy-fixture.log').toString(),/59 renders/);assert.match(get('raw/raster-fixture.log').toString(),/five languages through toSvg \+ toPng \+ toPdf, Latin untouched/);
assert.equal(json('raw/baseline-exit.json').exitCode,1);assert.equal(json('raw/candidate-artifacts02-exit.json').exitCode,0);assert.equal(json('raw/normal-mapped-plan02-exit.json').exitCode,0);
assert.match(get('raw/normal-mapped-plan02.log').toString(),/run\s+tests render/);assert.equal(r.mapped.executedHere,false);assert.equal(r.mapped.state,'OWED_IN_ROOT_NORMAL_COHERENT_BATCH_AFTER_UNION');
const originalExits=records.filter(v=>v.key.startsWith('upstream/')&&v.key.endsWith('-exit.json'));assert.equal(originalExits.length,6);for(const entry of originalExits){const data=json(entry.key);assert.equal(data.exitCode??data.status??data.code,1,entry.key);}
for(const image of r.direct){const b=fs.readFileSync(path.join(here,image.path));assert.equal(b.length,image.bytes);assert.equal(sha(b),image.sha256);const retained=records.find(v=>v.source===image.source);assert(retained);assert.deepEqual(b,get(retained.key));}
for(const [key,value]of Object.entries(r.limits))assert.equal(value,false,key);
console.log(JSON.stringify({status:'PASS',records:records.length,rawBytes:r.raw.totalRecordBytes,directImages:r.direct.length,originalFailuresRetained:originalExits.length,newPublicGroups:11,existingDemandGroups:11,existingPrivateGroups:7,lazyRenders:59,realRasterLanguages:5,protectedObjects:Object.keys(r.protectedObjects).length,runtime:r.source,fixtureSource:r.fixtureSource,mappedExecuted:false,scope:'Offline evidence integrity and exact historical source/focused results only; no product/native/benchmark execution or full-gate acceptance.'}));
