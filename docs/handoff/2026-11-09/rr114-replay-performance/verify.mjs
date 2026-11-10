import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const read=name=>readFileSync(new URL(name,import.meta.url));
const sha=data=>createHash('sha256').update(data).digest('hex');
const manifest=JSON.parse(read('formal-receipt.json')),compressed=read('formal-evidence.json.gz');
assert.equal(compressed.length,manifest.compressedBytes);assert.equal(sha(compressed),manifest.archiveSha256);
const raw=gunzipSync(compressed);assert.equal(raw.length,manifest.rawBytes);
const packet=JSON.parse(raw),records=new Map();assert.equal(packet.records.length,manifest.records);
for(const row of packet.records){assert(!records.has(row.name),row.name);const data=Buffer.from(row.base64,'base64');assert.equal(data.length,row.bytes);assert.equal(sha(data),row.sha256);records.set(row.name,data);}
const bytes=name=>{assert(records.has(name),name);return records.get(name);};
const json=name=>JSON.parse(bytes(name));
const p=json('artifacts/replay-preflight-05.json'),trial=json('artifacts/replay-paired-formal-02/receipt.json');
assert.equal(p.driverSourceHead,manifest.driverSource);assert.equal(trial.driverHead,p.driverSourceHead);assert.equal(trial.driverTree,p.driverSourceTree);assert.equal(trial.preflightSha256,sha(bytes('artifacts/replay-preflight-05.json')));
assert.equal(trial.status,'PASS');assert.equal(trial.rows.length,8);assert.equal(trial.exactSvgChecks,624);assert.equal(trial.protocol.childTimeoutMs,60000);assert.equal(trial.protocol.retries,0);assert.equal(trial.protocol.rendersPerChild,3);assert.equal(trial.protocol.firstAndFinalHwmBeforeHash,true);
assert.deepEqual(trial.protocol.order,[[16,'control'],[16,'candidate'],[36,'control'],[36,'candidate'],[36,'candidate'],[36,'control'],[16,'candidate'],[16,'control']]);
const previous=json('artifacts/replay-paired-formal-01/receipt.json');assert.equal(previous.status,'FAIL');assert.equal(previous.rows.length,1);assert.equal(previous.rows[0].exitCode,1);
assert.equal(json('artifacts/root-formal-01-exit.json').exitCode,1);assert.equal(json('artifacts/root-formal-02-exit.json').exitCode,0);
const canonical=data=>data.toString('utf8').replace(/\r\n/g,'\n');
let currentDriverMatches=true;
for(const row of p.driverFiles){assert.equal(sha(bytes('executed-driver/'+row.name)),row.sha256);assert.equal(canonical(bytes('executed-driver/'+row.name)),canonical(bytes('git-driver/'+row.name)));currentDriverMatches&&=sha(read(row.name))===row.sha256;}
for(const row of p.inputs.files){assert.equal(sha(bytes('inputs/'+row.name)),row.sha256);assert.equal(bytes('inputs/'+row.name).length,row.bytes);}
assert.equal(sha(bytes('inputs/manifest.json')),p.inputs.manifestSha256);
assert.equal(p.runtimes.control.head,manifest.control);assert.equal(p.runtimes.candidate.head,manifest.candidate);
const cases=[],hashes=new Map();let baselineFonts,baselineFaces;
const delta=/^packages\/render\/dist\/(font-demand|lazy-fonts|font-preparation-context|font-preparation-replay)\.js$/;
let sharedModules;
for(const [i,row]of trial.rows.entries()){
 assert.equal(row.exitCode,0);assert.equal(row.error,null);assert.equal(row.signal,null);assert.equal(row.hashesEquivalent,true);assert.deepEqual([row.size,row.variant],trial.protocol.order[i]);
 const item=json('artifacts/replay-paired-formal-02/'+String(row.order).padStart(2,'0')+'-'+row.size+'-'+row.variant+'.json');cases.push(item);assert.equal(item.status,'PASS');assert.equal(item.size,row.size);assert.equal(item.variant,row.variant);assert.equal(item.faceCount,3);assert.equal(item.samples.length,3);assert.equal(item.hashes.length,item.size);assert.equal(item.preflightSha256,trial.preflightSha256);assert.equal(item.inputSha256,p.inputs.files.find(x=>x.size===row.size).sha256);
 const rt=p.runtimes[row.variant];for(const key of ['root','head','tree','runtime'])assert.equal(item.runtime[key],rt[key]);
 assert.deepEqual(item.dependencyAssets,rt.backendAssets);assert.equal(item.dependencyAssets.length,2);
 baselineFonts??=item.fontRecords;baselineFaces??=item.faces;assert.deepEqual(item.fontRecords,baselineFonts);assert.deepEqual(item.faces,baselineFaces);
 const modules=item.loadedModules.filter(x=>!delta.test(x.file));sharedModules??=modules;assert.deepEqual(modules,sharedModules);
 hashes.has(item.size)?assert.deepEqual(item.hashes,hashes.get(item.size)):hashes.set(item.size,item.hashes);
 for(const n of [item.preparationMs,item.prepPlusFirstMs,item.continuousPreparationToFirstMs,item.preparationCpu.totalMs,item.prepPlusFirstCpuMs,...item.samples.flatMap(x=>[x.elapsedMs,x.cpu.totalMs]),...['firstRenderMemory','finalRenderMemory','postDropGc'].flatMap(k=>Object.values(item[k]))])assert(Number.isFinite(n)&&n>=0);
 assert(item.finalRenderMemory.maxRssBytes>=item.firstRenderMemory.maxRssBytes);
}
const summary=JSON.parse(read('summary.json'));assert.equal(sha(read('summary.json')),manifest.summarySha256);assert.equal(sha(bytes('derived/summary.json')),manifest.summarySha256);
const measures={preparationMs:x=>[x.preparationMs],firstMs:x=>[x.samples[0].elapsedMs],prepPlusFirstMs:x=>[x.prepPlusFirstMs],continuousPreparationToFirstMs:x=>[x.continuousPreparationToFirstMs],warmMs:x=>x.samples.slice(1).map(s=>s.elapsedMs),preparationCpuMs:x=>[x.preparationCpu.totalMs],prepPlusFirstCpuMs:x=>[x.prepPlusFirstCpuMs],warmCpuMs:x=>x.samples.slice(1).map(s=>s.cpu.totalMs),firstMaxRssMiB:x=>[x.firstRenderMemory.maxRssBytes/1048576],finalRenderMaxRssMiB:x=>[x.finalRenderMemory.maxRssBytes/1048576],postDropHeapMiB:x=>[x.postDropGc.heapUsed/1048576],postDropRssMiB:x=>[x.postDropGc.rss/1048576]};
for(const cell of summary.cells){const data=cases.filter(x=>x.size===cell.size&&x.variant===cell.variant);assert.equal(data.length,2);for(const[key,get]of Object.entries(measures)){const values=data.flatMap(get),mean=values.reduce((a,b)=>a+b,0)/values.length;assert.deepEqual(cell[key],{values,mean,min:Math.min(...values),max:Math.max(...values)});}}
for(const row of summary.changes){const c=summary.cells.find(x=>x.size===row.size&&x.variant==='control'),r=summary.cells.find(x=>x.size===row.size&&x.variant==='candidate');for(const key of Object.keys(measures))assert.equal(row[key],(r[key].mean/c[key].mean-1)*100);}
const parity=JSON.parse(read('functional-formal-parity.json'));assert.equal(sha(read('functional-formal-parity.json')),manifest.paritySha256);assert.equal(parity.passed,true);assert.equal(parity.records.reduce((n,x)=>n+x.exactSvgPairs,0),104);
for(const row of parity.records){const functional=json('functional-reference/'+row.size+'-active.json'),item=cases.find(x=>x.size===row.size&&x.variant==='candidate');assert.equal(row.inputSha256,item.inputSha256);assert.equal(row.functionalBindCount,row.size);assert.equal(row.formalBindCount,'not instrumented');assert.equal(row.builtReplayModules,4);assert.equal(row.exactFaces,3);assert.equal(functional.inputSha256,item.inputSha256);assert.equal(functional.binds,row.size);assert.deepEqual(functional.hashes,item.hashes);assert.deepEqual(functional.faces,item.faces);assert.deepEqual(functional.files.map(x=>x.sha256).sort(),item.fontRecords.map(x=>x.sha256).sort());for(const binding of functional.bindings)assert.equal(binding.sha256,p.runtimes.candidate.copies.find(x=>x.file===binding.name).sha256);}
const after=json('artifacts/root-background-normalizer-20261110/after.json');assert.equal(after.exactTargetId,30616);assert.equal(after.remains,false);assert.equal(after.otherProcessTargeted,false);assert.equal(sha(bytes('artifacts/root-background-normalizer-20261110/norm.mjs')),'da9c25b55e27bbca8248535a1fe6810b2955c8886164fe672b016518746744f0');
console.log(JSON.stringify({status:'PASS',records:records.size,rawBytes:raw.length,children:cases.length,exactSvgChecks:624,functionalCrossChecks:104,currentDriverMatches,result:'No latency improvement demonstrated; formal01 preserved as failed setup. Historical verification only.'}));

