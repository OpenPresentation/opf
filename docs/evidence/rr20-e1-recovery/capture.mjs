// Read-only E1 preservation. Packages existing bytes; never executes a historical renderer or fetches fonts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const [harvest,claude,out,dependencyRoot]=process.argv.slice(2).map(value=>path.resolve(value));
assert.ok(harvest&&claude&&out&&dependencyRoot);assert.ok(!fs.existsSync(out),'Use a fresh packet directory');
const {zipSync,unzipSync}=createRequire(path.join(dependencyRoot,'packages/pptx/package.json'))('fflate');
const git=(...args)=>execFileSync('git',args,{maxBuffer:64*1024*1024});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const oid=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const references=['origin/main','origin/codex/integration-034','origin/handoff/review-sheets-2026-11-07'].map(name=>({name,commit:git('rev-parse',name).toString().trim()}));
const available=new Map();
for(const ref of references)for(const line of git('ls-tree','-r','--format=%(objectname)\t%(path)',ref.commit).toString().trim().split('\n')){
 const [object,...parts]=line.split('\t'),file=parts.join('\t');if(!/\.(png|json|md|html|mjs|txt)$/.test(file))continue;
 if(!available.has(object))available.set(object,{commit:ref.commit,path:file,object});
}
const assets=[],packets=new Map(),localChecks=[];
function add(packet,id,bytes,extra={},forcedGit){
 assert.ok(!assets.some(row=>row.id===id),'Unique asset ID');assert.ok(!id.split('/').includes('..'));
 const object=oid(bytes),stored=forcedGit??available.get(object),asset={id,bytes:bytes.length,sha256:sha(bytes),gitObject:object,...extra};
 if(id.endsWith('.png')){assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));asset.width=bytes.readUInt32BE(16);asset.height=bytes.readUInt32BE(20);}
 if(stored){assert.equal(stored.object,object);asset.storage={kind:'git',...stored};}
 else {const entries=packets.get(packet)??{};assert.ok(!Object.hasOwn(entries,id));entries[id]=bytes;packets.set(packet,entries);asset.storage={kind:'zip',file:'packets/'+packet+'.zip',entry:id};}
 assets.push(asset);return id;
}
function local(packet,id,file,extra={}){const bytes=fs.readFileSync(file);localChecks.push({file,sha256:sha(bytes)});return add(packet,id,bytes,extra);}
function tree(packet,prefix,directory){
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){assert.ok(!entry.isSymbolicLink(),'No linked assets');const file=path.join(directory,entry.name),id=prefix+'/'+entry.name;if(entry.isDirectory())tree(packet,id,file);else local(packet,id,file,{role:'immutable-source-control'});}
}
function fromGit(id,commit,file,extra={}){const bytes=git('show',commit+':'+file);return add('sources',id,bytes,extra,{commit,path:file,object:git('rev-parse',commit+':'+file).toString().trim()});}
const manifestBytes=fs.readFileSync(path.join(harvest,'corpus/manifest.json')),manifest=JSON.parse(manifestBytes);
assert.ok(manifestBytes.equals(fs.readFileSync(path.join(harvest,'corpus-v2/manifest.json'))),'Both corpus manifests are byte-identical');
const corpusManifest=local('sources','sources/corpus-manifest.json',path.join(harvest,'corpus/manifest.json'),{role:'source-manifest'});
const published=new Set([1,2,3,4,5,6,7,8,14,15,16].map(n=>'batch-'+String(n).padStart(2,'0'))),batches=[],missing=[];
for(const batch of manifest){
 const directory=path.join(harvest,'corpus',batch.batch),deckFile=path.join(directory,'deck.opf.json'),bytes=fs.readFileSync(deckFile),deck=JSON.parse(bytes),mirror=fs.readFileSync(path.join(harvest,'corpus-v2',batch.batch,'deck.opf.json'));
 assert.ok(bytes.equals(mirror),batch.batch+' source mirrors are byte-identical');assert.deepEqual(deck.slides.map(slide=>slide.id),batch.slides.map(slide=>slide.id));
 const source=local(batch.batch,batch.batch+'/source/deck.opf.json',deckFile,{role:'exact-opf-source'});
 tree(batch.batch,batch.batch+'/source/brief',path.join(directory,'brief'));
 const project=path.join(claude,'corpus',batch.batch,'deck/project'),projectDeck=JSON.parse(fs.readFileSync(path.join(project,'deck.json')));
 assert.deepEqual(projectDeck.order,batch.slides.map(slide=>slide.id),batch.batch+' Claude project order');tree(batch.batch,batch.batch+'/source/claude-project',project);
 const slides=batch.slides.map((entry,index)=>{
   const row={ordinal:index+1,id:entry.id,tags:entry.tags,sourceSlideSha256:sha(Buffer.from(JSON.stringify(deck.slides[index])))};
   for(const[folder,role]of[['ours','before'],['claude','claude']]){const file=path.join(directory,folder,entry.id+'.png');if(fs.existsSync(file))row[role]=local(batch.batch,batch.batch+'/'+role+'/'+entry.id+'.png',file,{role:'fixed-'+role});else {row[role]=null;missing.push({batch:batch.batch,id:entry.id,role,publishedBatch:published.has(batch.batch)});}}
   return row;
 });
 batches.push({batch:batch.batch,theme:batch.theme,publishedBatch:published.has(batch.batch),source,sourceCommit:null,sourceCommitStatus:'unrecovered; exact raw source and semantic slide hashes preserved',mirror:{path:'corpus-v2/'+batch.batch+'/deck.opf.json',sha256:sha(mirror),byteIdentical:true},claudeProjectOrder:projectDeck.order,slides});
}
assert.equal(batches.reduce((n,b)=>n+b.slides.length,0),844);assert.equal(batches.filter(b=>b.publishedBatch).reduce((n,b)=>n+b.slides.length,0),550);
assert.deepEqual(missing.map(row=>row.batch+'/'+row.id+'/'+row.role),['batch-11/s27/before','batch-13/s29/before','batch-17/s04/before']);
assert.ok(missing.every(row=>!row.publishedBatch));
const candidateRefs=['febec90df','c3e7196ac'].map(short=>git('rev-parse',short).toString().trim()),candidates=[];
let firstDeck;
for(const commit of candidateRefs){const file='examples/technical/layout-sampler.opf.json',bytes=git('show',commit+':'+file),deck=JSON.parse(bytes);assert.equal(deck.slides.length,43);if(firstDeck)assert.deepEqual(deck.slides,firstDeck.slides,'Both historical sources have identical authored slide objects/order');else firstDeck=deck;const source=fromGit('pilot/source-candidate-'+commit.slice(0,9)+'.opf.json',commit,file,{role:'historical-opf-source-candidate'});candidates.push({commit,source,slideCount:43,sha256:sha(bytes)});}
const mappingBytes=fs.readFileSync(path.join(harvest,'mapping.json')),mapping=JSON.parse(mappingBytes);assert.ok(mappingBytes.equals(fs.readFileSync(path.join(harvest,'brief/mapping.json'))));assert.deepEqual(Object.values(mapping),firstDeck.slides.map(slide=>slide.id));
const mappingAsset=local('pilot','pilot/mapping.json',path.join(harvest,'mapping.json'),{role:'exact-neutral-to-opf-order-map'});
tree('pilot','pilot/source/brief',path.join(harvest,'brief'));tree('pilot','pilot/source/claude-project',path.join(claude,'deck/project'));
const pilotProject=JSON.parse(fs.readFileSync(path.join(claude,'deck/project/deck.json')));assert.deepEqual(pilotProject.order,Object.keys(mapping));
const pilotSlides=Object.entries(mapping).map(([neutral,id],index)=>({ordinal:index+1,neutral,id,sourceSlideSha256:sha(Buffer.from(JSON.stringify(firstDeck.slides[index]))),before:local('pilot','pilot/before/'+id+'.png',path.join(harvest,'before',id+'.png'),{role:'fixed-before'}),claude:local('pilot','pilot/claude/'+id+'.png',path.join(harvest,'claude',id+'.png'),{role:'fixed-claude'})}));
const currentSamplers=references.slice(0,2).map(ref=>{const file='examples/technical/layout-sampler.opf.json',bytes=git('show',ref.commit+':'+file),deck=JSON.parse(bytes),id='sources/'+(ref.name==='origin/main'?'main':'integration-034')+'-sampler.opf.json';return {ref:ref.name,commit:ref.commit,source:fromGit(id,ref.commit,file,{role:'current-source-only-not-rendered'}),slideCount:deck.slides.length,ids:deck.slides.map(slide=>slide.id),newIdsComparedWithFixed43:deck.slides.map(slide=>slide.id).filter(id=>!Object.values(mapping).includes(id)),fixed43Order:deck.slides.filter(slide=>Object.values(mapping).includes(slide.id)).map(slide=>slide.id)};});
for(const current of currentSamplers)assert.deepEqual(current.fixed43Order,Object.values(mapping));
for(const file of ['build-sampler.mjs','render-claude-slides.mjs','build-brief.mjs','prep-batch.mjs','design-prompt.md'])local('controls','controls/'+file,path.join(harvest,file),{role:'historical-source-never-executed'});
fromGit('controls/original-sites-docs-inventory.md',references[0].commit,'docs/handoff/2026-11-07/sites-docs-inventory.md',{role:'original-task-and-artifact-scope'});
fs.mkdirSync(path.join(out,'packets'),{recursive:true});const packetRows=[];
for(const[name,entries]of packets){const packed=zipSync(Object.fromEntries(Object.entries(entries).map(([file,bytes])=>[file,[bytes,{level:file.endsWith('.png')?0:6,mtime:new Date('2026-11-08T00:00:00Z')}]]))),file='packets/'+name+'.zip';assert.ok(packed.length<16*1024*1024,'Bounded per-batch packet');fs.writeFileSync(path.join(out,file),packed);const restored=unzipSync(packed);for(const[entry,bytes]of Object.entries(entries))assert.ok(Buffer.from(restored[entry]).equals(bytes),entry+' archive byte round trip');packetRows.push({file,bytes:packed.length,sha256:sha(packed),entries:Object.keys(entries).length});}
for(const row of localChecks)assert.equal(sha(fs.readFileSync(row.file)),row.sha256,'Local source changed during preservation');
const record={schema:'opf-e1-recovery/v1',capture:{date:'2026-11-08',node:process.version,evidenceOnly:true,rendererExecuted:false,fontsFetched:false,registryQueried:false,nativeRun:false,published:false,producerStatus:'Old fixed-panel exact producer unrecovered; this does not block refreshing current after from the exact preserved source while keeping fixed panel hashes.'},references,corpus:{manifest:corpusManifest,manifestSha256:sha(manifestBytes),mirrorManifest:'corpus-v2/manifest.json',mirrorByteIdentical:true,slideCount:844,publishedSubsetSlides:550,publishedBatchNames:[...published],beforePanels:841,claudePanels:844,missing,batches},pilot:{mapping:mappingAsset,mirrorMapping:'brief/mapping.json',mirrorByteIdentical:true,sourceCandidates:candidates,authoredSlidesIdenticalAcrossCandidates:true,exactBeforeProducer:null,exactBeforeProducerStatus:'Unrecovered: candidates differ in four embedded layout variant fields; neither is asserted as the old image producer.',claudeProjectOrder:pilotProject.order,slides:pilotSlides},currentSamplers,artifacts:{overview:{id:'KMaetkTJ9D9HUcen1SZ1iu',source:'original inventory'},pilotStory:{id:'VKdZMT6xh8wyyhN95SWJTY',source:'original inventory'},batchExample:{id:'X9283LmzzkyqTU91ELn82M',batch:null,status:'Unmapped exemplar; do not assign it to an invented batch'},publishedBatchRoster:null,rosterStatus:'Eleven batch01–08/14–16 labels recovered; exact public artifact IDs/version mappings unrecovered. The broader E1 row says01–16; preserve all18 local batches without inventing publication.'},provenanceLimits:['Corpus source commits unrecovered; raw decks and both corpus copies are byte-bound.','Old fixed-before exact engine/catalog/font provider and exact release commit unrecovered.','Fixed Claude comparison PNGs and original project/brief bytes retained; no claim they were rendered by the current Claude runtime.','Historical helper code is opaque evidence only, not a supported invocation; stale builder and approximate/hotlinked Claude renderer must not run.','Current source-only sampler inputs are captured by Git commit and exact IDs; no new after images are produced here.'],slideHashAlgorithm:'SHA256 of UTF-8 JSON.stringify of each authored source slide; raw full-deck byte hashes are separate assets.',assets,packets:packetRows,totals:{assets:assets.length,gitReused:assets.filter(a=>a.storage.kind==='git').length,newPacketAssets:assets.filter(a=>a.storage.kind==='zip').length,newPacketBytes:packetRows.reduce((n,p)=>n+p.bytes,0),corpusFixedPanels:1685,pilotFixedPanels:86}};
fs.writeFileSync(path.join(out,'recovery.json'),json(record));fs.writeFileSync(path.join(out,'seal.json'),json({recoverySha256:sha(Buffer.from(json(record))),packets:packetRows,captureScriptSha256:sha(fs.readFileSync(new URL(import.meta.url)))}));console.log(json({totals:record.totals,missing,packetCount:packetRows.length,maxPacketBytes:Math.max(...packetRows.map(p=>p.bytes)),samplers:currentSamplers.map(x=>({ref:x.ref,slides:x.slideCount,newIds:x.newIdsComparedWithFixed43}))}));
