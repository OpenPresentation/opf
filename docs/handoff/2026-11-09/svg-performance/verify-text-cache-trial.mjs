import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const own=import.meta.dirname,hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(own,'text-cache-01.manifest.json'))),archive=fs.readFileSync(path.join(own,manifest.archive));assert.equal(archive.length,manifest.bytes);assert.equal(hash(archive),manifest.sha256);
const raw=JSON.parse(gunzipSync(archive)).files;assert.deepEqual(raw.map(f=>f.file),manifest.files.map(f=>f.file));const files=new Map();
for(const f of raw){const b=Buffer.from(f.data,'base64');assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256);assert.deepEqual({file:f.file,bytes:f.bytes,sha256:f.sha256},manifest.files.find(m=>m.file===f.file));assert.ok(!files.has(f.file));files.set(f.file,b);}
const read=file=>JSON.parse(files.get(file).toString('utf8').replace(/^\uFEFF/u,''));
const summary=read('results/summary.json');assert.equal(summary.status,'PASS');assert.equal(summary.rows.length,8);assert.deepEqual(summary,JSON.parse(fs.readFileSync(path.join(own,'text-cache-01.summary.json'))));assert.equal(summary.childSha256,hash(fs.readFileSync(path.join(own,'text-cache-case.mjs'))));
const baselineManifest=JSON.parse(fs.readFileSync(path.join(own,'server-baseline-01.manifest.json'))),baselineBytes=fs.readFileSync(path.join(own,baselineManifest.archive));assert.equal(hash(baselineBytes),baselineManifest.sha256);
const baseline=JSON.parse(gunzipSync(baselineBytes)).files;
let comparisons=0;
for(const [index,row]of summary.rows.entries()){
 assert.equal(row.order,index+1);assert.equal(row.exitCode,0);assert.equal(row.allSvgEquivalent,true);
 const name=String(index+1).padStart(2,'0')+'-'+row.size+'-'+row.variant;
 const r=read('results/'+name+'.json'),b=JSON.parse(Buffer.from(baseline.find(f=>f.file==='results/server-baseline-01/'+row.size+'-batch-fonts.json').data,'base64'));
 assert.equal(r.fontVariant,row.variant);assert.equal(r.runs,2);assert.equal(r.samples.length,3);assert.equal(r.node,'v24.20.0');assert.deepEqual(r.storage.perSlide.map(s=>s.sha256),b.storage.perSlide.map(s=>s.sha256));comparisons+=r.size;
 if(index)assert.ok(Date.parse(row.started)>=Date.parse(summary.rows[index-1].finished));
}
assert.equal(comparisons,208);
const control=read('control/receipt.json'),git=(revision,file)=>execFileSync('git',['show',revision+':'+file],{encoding:'utf8'});
const sourceFile='packages/render/src/font-registry.js',nodeFile='packages/render/src/fonts-node.js';
const strip=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/^export \{.*\} from .*;\r?\n/gm,'');
for(const m of control.modules){
 const registry=files.get('control/font-registry-'+m.variant+'.mjs').toString('utf8'),node=files.get('control/fonts-node-'+m.variant+'.mjs').toString('utf8');
 const original=git(m.variant==='before'?control.base:control.revision,sourceFile);
 assert.equal(hash(original),m.registryOriginalSha256);assert.equal(hash(registry),m.registryAdaptedSha256);assert.equal(hash(node),m.fontsAdaptedSha256);
 assert.equal(strip(registry),strip(original),'Only imports are adapted in the registry');assert.equal(strip(node),strip(git(control.revision,nodeFile)),'Only imports are adapted in the loader');
 assert.ok(node.includes(pathToFileURL(m.registry).href));
}
for(const name of ['text-cache-build01','text-cache-focused01','text-cache-existing01'])assert.equal(read('checks/'+name+'-exit.json').exitCode,0);
assert.equal(read('checks/text-cache-focused01-exit.json').runtimeFileSHA256,hash(git(control.revision,sourceFile)));
assert.match(files.get('checks/text-cache-existing01.log').toString('utf8'),/99 pinned/);assert.match(files.get('checks/text-cache-existing01.log').toString('utf8'),/127 pinned/);
console.log(JSON.stringify({status:'PASS',members:raw.length,cases:8,baselineSlideComparisons:comparisons,source:control.revision,onlyImportAdaptation:true,memoryImprovementClaimed:false}));
