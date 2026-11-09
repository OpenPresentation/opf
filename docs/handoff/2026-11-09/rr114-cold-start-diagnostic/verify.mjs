import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const own=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(own,'../../../..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',['-C',repo,...args],{maxBuffer:4*1024*1024});
const text=(...args)=>git(...args).toString('utf8').trim();
const m=JSON.parse(readFileSync(path.join(own,'manifest.json'),'utf8'));
assert.equal(m.evidenceOnly,true);assert.equal(m.neverMerge,true);assert.equal(m.source,'6e862542059efacffcd45b1ffa44e71011b18a74');
assert.equal(text('rev-parse',m.source+'^{tree}'),m.tree);
for(const item of m.sourceFiles){const bytes=git('show',m.source+':'+item.file);assert.equal(bytes.length,item.bytes);assert.equal(sha(bytes),item.sha256);assert.equal(text('rev-parse',m.source+':'+item.file),item.blob);}
for(const item of m.protectedObjects){assert.equal(item.runtime,item.tested);assert.equal(text('rev-parse',m.runtimeSource+':'+item.file),item.runtime);assert.equal(text('rev-parse',m.source+':'+item.file),item.tested);assert.equal(text('rev-parse','HEAD:'+item.file),item.tested,'no later product changes');}
const bytes=readFileSync(path.join(own,m.raw.file));assert.equal(bytes.length,m.raw.bytes);assert.equal(sha(bytes),m.raw.sha256);
const expanded=gunzipSync(bytes,{maxOutputLength:2*1024*1024});assert.equal(expanded.length,m.raw.expandedBytes);
const body=JSON.parse(expanded);assert.equal(body.format,m.format);assert.equal(body.entries.length,m.raw.members);
const entries=new Map();let decoded=0;
for(const[index,item]of body.entries.entries()){
 assert.match(item.name,/^[a-zA-Z0-9./-]+$/);assert.ok(!item.name.includes('..'));assert.ok(!entries.has(item.name));
 const value=Buffer.from(item.base64,'base64');assert.equal(value.length,item.size);assert.equal(sha(value),item.sha256);
 const{base64,...meta}=item;assert.deepEqual(meta,m.entries[index]);decoded+=value.length;entries.set(item.name,value);
}
assert.equal(decoded,m.raw.decodedBytes);
const json=name=>JSON.parse(entries.get(name)),s=json('results/summary.json'),exit=json('execution/process-exit.json'),expected=json('results/expected-svg-hashes.json');
assert.equal(s.status,'PASS');assert.equal(s.runtimeHead,m.source);assert.equal(s.runtimeTree,m.tree);assert.equal(exit.exitCode,0);assert.equal(exit.source,m.source);assert.equal(exit.tree,m.tree);
assert.deepEqual(s.rows.map(row=>[row.size,row.variant]),[[16,'whole'],[16,'demand'],[36,'whole'],[36,'demand']]);
let hashes=0;const actual=[];
for(const row of s.rows){
 assert.equal(row.exitCode,0);assert.equal(row.status,'PASS');
 const name=String(row.order).padStart(2,'0')+'-'+row.size+'-'+row.variant,r=json('results/'+name+'.json');
 actual.push(r);assert.equal(r.status,'PASS');assert.equal(r.faceCount,row.variant==='demand'?3:131);assert.deepEqual(r.pending,[]);
 assert.equal(r.samples.length,3);assert.deepEqual(r.diagnostic.incompleteSpanIds,[]);
 for(const sample of r.samples){assert.deepEqual(sample.hashes,expected[row.size]);hashes+=sample.hashes.length;}
 assert.equal(r.moduleTransforms.length,6);
 for(const item of r.moduleTransforms){const src=git('show',m.runtimeSource+':packages/render/src/'+item.file);assert.equal(sha(src),item.beforeSha256);assert.ok(item.anchors.length>0);}
}
assert.equal(hashes,312);assert.equal(s.verifiedSlideHashes,312);
const facts=readFileSync(path.join(own,m.facts.file));assert.equal(facts.length,m.facts.bytes);assert.equal(sha(facts),m.facts.sha256);
const f=JSON.parse(facts);assert.equal(f.verifiedRenderHashes,312);
for(const size of [16,36]){
 const whole=f.rows.find(row=>row.size===size&&row.variant==='whole'),demand=f.rows.find(row=>row.size===size&&row.variant==='demand');
 assert.deepEqual(whole.firstRenderMetrics,demand.firstRenderMetrics);
 assert.equal(whole.shaperHandoff.cachedEntries,0);
 assert.equal(demand.contexts.length,2);assert.deepEqual(demand.contexts.map(item=>item.generation),[0,1]);
 assert.deepEqual(demand.analysisCache.map(item=>item.missing),[size,size]);
 assert.equal(demand.contexts[1].analysisStats.slides,2*size);
 assert.equal(demand.contexts[0].scriptStats.strings,demand.contexts[1].scriptStats.strings);
 assert.ok(demand.shaperHandoff.cachedEntries>0);
}
console.log(JSON.stringify({status:'PASS',members:body.entries.length,decodedBytes:decoded,sourceFiles:m.sourceFiles.length,children:4,exactRenderHashes:hashes,source:m.source,scope:'Instrumented source-bound attribution; not optimization/native/release acceptance'}));
