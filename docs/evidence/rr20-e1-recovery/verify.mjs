// Verify immutable E1 transport bytes and exact corpus/pilot order without rendering or extracting files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const [root,dependencyRoot]=process.argv.slice(2).map(value=>path.resolve(value));
const {unzipSync}=createRequire(path.join(dependencyRoot,'packages/pptx/package.json'))('fflate');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),recordBytes=fs.readFileSync(path.join(root,'recovery.json')),record=JSON.parse(recordBytes),seal=JSON.parse(fs.readFileSync(path.join(root,'seal.json')));
assert.equal(sha(recordBytes),seal.recoverySha256);
const executed=gunzipSync(fs.readFileSync(path.join(root,'../capture-executed.mjs.gz')));assert.equal(sha(executed),seal.captureScriptSha256,'Exact executed collector is preserved, independent of Git line-ending transport');
const archives=new Map();for(const packet of seal.packets){const bytes=fs.readFileSync(path.join(root,packet.file));assert.equal(sha(bytes),packet.sha256);assert.equal(bytes.length,packet.bytes);const parts=unzipSync(bytes);assert.equal(Object.keys(parts).length,packet.entries);archives.set(packet.file,parts);}
const data=new Map();let reused=0;
for(const asset of record.assets){const bytes=asset.storage.kind==='git'?(reused++,execFileSync('git',['show',asset.storage.commit+':'+asset.storage.path],{maxBuffer:8*1024*1024})):archives.get(asset.storage.file)?.[asset.storage.entry];assert.ok(bytes,asset.id);assert.equal(sha(bytes),asset.sha256,asset.id);assert.equal(bytes.length,asset.bytes);const object=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');assert.equal(object,asset.gitObject);if(asset.id.endsWith('.png')){assert.equal(Buffer.from(bytes).readUInt32BE(16),asset.width);assert.equal(Buffer.from(bytes).readUInt32BE(20),asset.height);}data.set(asset.id,Buffer.from(bytes));}
const parse=id=>JSON.parse(data.get(id)),evidence=path.dirname(root);
for(const batch of record.corpus.batches){const expected={...batch,sourceAsset:record.assets.find(a=>a.id===batch.source),panelAssets:batch.slides.flatMap(slide=>[slide.before,slide.claude].filter(Boolean).map(id=>record.assets.find(a=>a.id===id)))};assert.deepEqual(JSON.parse(fs.readFileSync(path.join(evidence,'inventories',batch.batch+'.json'))),expected,'Derived batch inventory');}
const brief=JSON.parse(fs.readFileSync(path.join(evidence,'brief-provenance.json'))),originalBrief=fs.readFileSync(path.join(evidence,brief.pilot.originalControl.file));assert.equal(sha(originalBrief),brief.pilot.originalControl.sha256);assert.equal(sha(gunzipSync(originalBrief)),brief.pilot.originalControl.rawSha256);assert.equal(brief.pilot.normalizedLineDifferences.length,13);assert.ok(brief.corpus.every(row=>row.byteIdentical));
let before=0,claude=0,published=0;
for(const batch of record.corpus.batches){const deck=parse(batch.source);assert.deepEqual(deck.slides.map(slide=>slide.id),batch.slides.map(slide=>slide.id));assert.deepEqual(batch.claudeProjectOrder,batch.slides.map(slide=>slide.id));for(const [index,slide]of batch.slides.entries()){assert.equal(slide.ordinal,index+1);assert.equal(sha(Buffer.from(JSON.stringify(deck.slides[index]))),slide.sourceSlideSha256);if(slide.before){assert.ok(data.has(slide.before));before++;}assert.ok(data.has(slide.claude));claude++;if(batch.publishedBatch){assert.ok(slide.before&&slide.claude);published++;}}}
assert.equal(before,841);assert.equal(claude,844);assert.equal(published,550);assert.deepEqual(record.corpus.missing.map(row=>row.batch+'/'+row.id),['batch-11/s27','batch-13/s29','batch-17/s04']);
const mapping=parse(record.pilot.mapping),candidateDecks=record.pilot.sourceCandidates.map(row=>parse(row.source));assert.deepEqual(candidateDecks[0].slides,candidateDecks[1].slides);assert.deepEqual(Object.values(mapping),candidateDecks[0].slides.map(slide=>slide.id));assert.equal(record.pilot.slides.length,43);for(const [index,slide]of record.pilot.slides.entries()){assert.equal(Object.entries(mapping)[index][0],slide.neutral);assert.equal(Object.entries(mapping)[index][1],slide.id);assert.ok(data.has(slide.before)&&data.has(slide.claude));}
for(const current of record.currentSamplers){const deck=parse(current.source);assert.equal(deck.slides.length,current.slideCount);assert.deepEqual(deck.slides.map(slide=>slide.id),current.ids);assert.deepEqual(current.fixed43Order,Object.values(mapping));}
assert.equal(record.artifacts.publishedBatchRoster,null);assert.equal(record.pilot.exactBeforeProducer,null);assert.equal(record.capture.rendererExecuted,false);
console.log(JSON.stringify({valid:true,assets:data.size,reusedGitAssets:reused,packets:archives.size,corpusSlides:844,publishedSubset:550,beforePanels:before,claudePanels:claude,pilotBefore:43,pilotClaude:43,missingBefore:record.corpus.missing,rendererExecuted:false},null,2));
