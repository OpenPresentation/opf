import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),prefix='docs/handoff/2026-11-08/centered-track-data/';
const receipt=JSON.parse(readFileSync(new URL('./receipt.json',import.meta.url),'utf8')),ref=process.argv[2]??'HEAD';
const git=args=>execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024}),blob=(path,revision=ref)=>git(['show',revision+':'+path]),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(blob(prefix+'verify.mjs')),receipt.verifierSha256);
for(const item of receipt.source){assert.equal(hash(blob(item.path)),item.sha256,item.path);assert.equal(hash(blob(item.path,receipt.testedSource)),item.sha256,item.path+' tested source');}
for(const item of receipt.protected){for(const revision of [receipt.base,receipt.testedSource,ref])assert.equal(git(['rev-parse',revision+':'+item.path]).toString().trim(),item.gitObject,item.path+' protected '+revision);}
for(const item of receipt.artifacts){assert.ok(item.path.startsWith(prefix));const bytes=blob(item.path);assert.equal(bytes.length,item.bytes,item.path);assert.equal(hash(bytes),item.sha256,item.path);if(item.path.endsWith('.gz')){const raw=gunzipSync(bytes);assert.equal(hash(raw),item.rawSha256,item.path+' exact raw bytes');}}
const json=path=>JSON.parse(blob(prefix+path).toString()),before=json('mode-before/receipt.json'),after=json('mode-after/receipt.json'),intermediate=json('mode-after-predicate-only/receipt.json');
for(const [phase,data]of[['mode-before',before],['mode-after',after],['mode-after-predicate-only',intermediate]]){assert.equal(data.records.length,9);for(const row of data.records){assert.equal(hash(blob(prefix+phase+'/'+row.id+'.svg')),row.svgSha256);assert.equal(hash(blob(prefix+phase+'/'+row.id+'.png')),row.pngSha256);}}
for(const row of after.records){const old=before.records.find(item=>item.id===row.id);assert.deepEqual(json('mode-after/'+row.id+'.opf.json'),json('mode-before/'+row.id+'.opf.json'));assert.ok(row.body.every(item=>item.fontSize===56&&!item.overflow));if(row.unchanged){assert.equal(row.svgSha256,old.svgSha256);assert.equal(row.pngSha256,old.pngSha256);}else assert.ok(intermediate.records.find(item=>item.id===row.id).body.every(item=>item.fontSize===37));}
const visual=json('visual-receipt.json');assert.equal(hash(blob(prefix+'review-sheet.png')),visual.sheetSha256);assert.equal(visual.records.length,4);
for(const row of visual.records){assert.equal(row.atRestExact,true);assert.deepEqual(row.before.map(item=>item.value),row.after.map(item=>item.value));assert.ok([...row.before,...row.after].every(item=>item.fontSize===56));assert.ok(Math.abs(row.after[0].box.y-row.before[0].box.y+130.98)<1e-6);for(const side of row.images){assert.equal(hash(blob(prefix+row.id+'-'+side.side+'.svg')),side.svgSha256);assert.equal(hash(blob(prefix+row.id+'-'+side.side+'.png')),side.pngSha256);}}
const templates=json('template-baseline.json');assert.equal(templates.count,480);assert.equal(templates.allSourceSummariesEqual,true);assert.equal(templates.allCompiledCandidateSummariesEqual,true);assert.equal(templates.fixtureChanged,false);assert.equal(templates.inheritedFixtureDifferences.length,10);assert.deepEqual(templates.inputs.baseline.dependencyInputs,templates.inputs.candidate.dependencyInputs);
for(const label of['baseline','candidate']){assert.equal(hash(gunzipSync(blob(prefix+'template-'+label+'.mjs.gz'))),templates.inputs[label].bundleSha256);assert.equal(hash(blob('packages/javascript/src/composition.ts',templates.inputs[label].ref)),templates.inputs[label].sourceSha256);}
assert.equal(hash(blob('packages/javascript/test/fixtures/template-goldens-0.19.json')),templates.fixtureSha256);
const mapped=gunzipSync(blob(prefix+'mapped-37eb56ce2.log.gz')).toString();assert.match(mapped,/1 of 15 steps failed: tests opf/);assert.match(mapped,/tests editor\s+passed/);assert.match(mapped,/total\s+394\.1 s/);
console.log(JSON.stringify({verified:true,ref,source:receipt.source.length,protected:receipt.protected.length,artifacts:receipt.artifacts.length,modeRenders:27,resizePairs:4,unchangedTemplateSummaries:480,mapped:'14 pass; 1 inherited pinned-fixture failure'}));
