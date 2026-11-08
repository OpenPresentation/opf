// Evidence-only capture of one completed genuine E1 run. Does not render, mutate a consumer or publish a UI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const req=createRequire('C:/opf-work/core033-office-consumer-01/node_modules/@openpresentation/opf-pptx/package.json');
const {zipSync,unzipSync}=req('fflate');
const run='C:/opf-work/e1-033-after-02',out=process.argv[2];
assert.ok(out&&!fs.existsSync(out),'Fresh evidence directory required');
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(p),parse=p=>JSON.parse(read(p)),fact=p=>{const b=read(p);return {bytes:b.length,sha256:sha(b)};};
const receipt=parse(run+'/receipt.json'),plan=parse('C:/opf-work/e1-033-office-plan-01/receipt.json');
assert.equal(receipt.complete,true);assert.equal(receipt.mode,'render');assert.equal(receipt.renderedSlides,936);assert.equal(receipt.decks.length,20);
assert.equal(receipt.release,'0.33.0');assert.equal(receipt.releaseCommit,'26fd4de9cee7e57f9e0620eddcad2dcef04e00e3');
assert.equal(receipt.tool.sha256,'666fb06c36d3b73153e64e319b6235d414c3f67325fb336921f4cdf8c59951c7');
assert.equal(receipt.consumer.runtimeInventorySha256,'ac66346c83c892099be5d05714b3583a12af2d07508969732a11db7d94f4bea6');
assert.deepEqual(receipt.decks.map(d=>d.id),plan.decks.map(d=>d.id));
const recovery=parse('C:/opf-work/rr-20-e1-recovery/docs/evidence/rr20-e1-recovery/payload/recovery.json');
assert.equal(sha(read('C:/opf-work/rr-20-e1-recovery/docs/evidence/rr20-e1-recovery/payload/recovery.json')),receipt.recovery.sha256);
const recovered=new Map(recovery.assets.map(a=>[a.id,a]));
const manifest={schema:'opf-e1-current-after-evidence/v1',evidenceOnly:true,neverMerge:true,producer:'34ae758d71abb77845d6b3feb08d2d53308f3a99',producerSha256:receipt.tool.sha256,release:receipt.release,releaseCommit:receipt.releaseCommit,options:receipt.options,recovery:receipt.recovery,renderComplete:true,slides:936,corpusSlides:844,publishedSubset:550,missingBefore:receipt.scope.missingBefore,oldProducer:null,publicBatchRoster:null,nativeAcceptance:false,publicArtifactWrites:0,visualAcceptance:'Pending coordinator review',packets:[],decks:[],reusedFixedFiles:[],counts:{error:0,warning:0,info:0},findingCodes:{},fontSubstitutions:[]};
fs.mkdirSync(out,{recursive:true});
const save=(relative,bytes)=>{const p=path.join(out,relative);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes,{flag:'wx'});return fact(p);};
const inventory=[];
function packet(name,items){
  const entry=Object.fromEntries(items.map(i=>[i.path,[i.bytes,{mtime:new Date('2026-11-08T00:00:00Z')}]]));
  const bytes=zipSync(entry,{level:9});assert.ok(bytes.length<=8*1024*1024,'Manageable packet');
  const file='packets/'+name+'.zip',proof=save(file,bytes),round=unzipSync(bytes);
  for(const item of items){assert.ok(Buffer.from(round[item.path]).equals(item.bytes),item.path);inventory.push({file: name+'/'+item.path,bytes:item.bytes.length,sha256:sha(item.bytes),storage:{kind:'archive',file,entry:item.path}});}
  const row={file,...proof,entries:items.length,rawBytes:items.reduce((n,i)=>n+i.bytes.length,0)};manifest.packets.push(row);return row;
}
function boundedPackets(id,items){let group=[],sum=0,index=1,rows=[];for(const item of items){if(group.length&&sum+item.bytes.length>6*1024*1024){rows.push(packet(id+'-'+String(index++).padStart(2,'0'),group));group=[];sum=0;}group.push(item);sum+=item.bytes.length;}if(group.length)rows.push(packet(id+'-'+String(index).padStart(2,'0'),group));return rows;}
function list(root,relative=''){const files=[];for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){assert.ok(!entry.isSymbolicLink());const next=relative?relative+'/'+entry.name:entry.name;if(entry.isDirectory())files.push(...list(root,next));else files.push(next);}return files;}
const substitutions=new Map();
for(const deck of receipt.decks){
  assert.equal(deck.complete,true);assert.equal(deck.outputs.length,deck.slides.length);
  const dir=run+'/decks/'+deck.id,cli=parse(dir+'/cli.stdout.json');assert.equal(cli.ok,true);
  assert.deepEqual(fact(dir+'/original.opf.json'),deck.original);assert.deepEqual(fact(dir+'/current-gallery.opf.json'),deck.current);
  for(const key of ['error','warning','info'])manifest.counts[key]+=cli.counts[key];
  for(const f of cli.findings??[])manifest.findingCodes[f.code]=(manifest.findingCodes[f.code]??0)+1;
  for(const f of cli.fonts.substitutions??[])substitutions.set(JSON.stringify(f),f);
  for(const output of deck.outputs)assert.deepEqual(fact(dir+'/after/'+output.file),{bytes:output.bytes,sha256:output.sha256});
  const fixed=[];
  for(const slide of deck.slides)for(const role of ['before','claude'])if(slide[role]){
    const ref=slide[role],p=dir+'/fixed/'+role+'-'+slide.id+'.png',asset=recovered.get(ref.asset);assert.ok(asset);
    assert.equal(sha(read(p)),ref.sha256);assert.equal(ref.sha256,asset.sha256);assert.equal(read(p).length,asset.bytes);
    const row={deck:deck.id,slide:slide.id,role,asset:ref.asset,bytes:asset.bytes,sha256:asset.sha256,recoveryCommit:receipt.recovery.commit,storage:asset.storage};fixed.push(row);manifest.reusedFixedFiles.push(row);
  }
  assert.equal(list(dir).filter(p=>p.startsWith('fixed/')).length,fixed.length,'No unmatched fixed files may be omitted');
  const sheets=[];
  for(const sheet of deck.sheets){const p=dir+'/'+sheet.file;assert.deepEqual(fact(p),{bytes:sheet.bytes,sha256:sheet.sha256});const file='sheets/'+deck.id+'/'+path.basename(sheet.file),proof=save(file,read(p));sheets.push({file,...proof});inventory.push({file, ...proof,storage:{kind:'individual',file}});}
  const items=list(dir).filter(p=>!p.startsWith('fixed/')&&!(p.startsWith('sheets/')&&p.endsWith('.png'))).map(p=>({path:p,bytes:read(dir+'/'+p)}));
  const packets=boundedPackets(deck.id,items);
  const row={id:deck.id,slides:deck.slides.length,publishedBatch:deck.publishedBatch,sourceCommit:deck.sourceCommit,original:deck.original,current:deck.current,authoredSlidesSha256:deck.authoredSlidesSha256,cliCounts:cli.counts,fontRoute:cli.fonts,sheets,packets:packets.map(p=>p.file),fixedFileReuse:fixed.length};manifest.decks.push(row);
  save('inventories/'+deck.id+'.json',JSON.stringify({...row,slides:deck.slides,fixedReuse:fixed},null,2)+'\n');
}
manifest.fontSubstitutions=[...substitutions.values()];
const rootItems=list(run).filter(p=>!p.startsWith('decks/')).map(p=>({path:'run/'+p,bytes:read(run+'/'+p)}));
for(const p of list('C:/opf-work/e1-033-after02-checks'))rootItems.push({path:'launch/'+p,bytes:read('C:/opf-work/e1-033-after02-checks/'+p)});
for(const p of list('C:/opf-work/e1-033-office-plan-01').filter(p=>!p.startsWith('decks/')))rootItems.push({path:'office-plan/'+p,bytes:read('C:/opf-work/e1-033-office-plan-01/'+p)});
boundedPackets('run-root',rootItems);
const consumerItems=['package.json','package-lock.json'].map(p=>({path:p,bytes:read('C:/opf-work/core033-office-consumer-01/'+p)}));
for(const p of list('C:/opf-work/e1-office-consumer-checks'))consumerItems.push({path:'checks/'+p,bytes:read('C:/opf-work/e1-office-consumer-checks/'+p)});
const setup=parse('C:/opf-work/e1-office-consumer-checks/setup.json');
for(const spec of setup.extraPeers){const name=spec.slice(0,spec.lastIndexOf('@'));for(const p of ['package.json','LICENSE','LICENSE_FONT'])consumerItems.push({path:'font-peer/'+name+'/'+p,bytes:read('C:/opf-work/core033-office-consumer-01/node_modules/'+name+'/'+p)});}
boundedPackets('office-consumer',consumerItems);
manifest.consumerUnchanged=parse('C:/opf-work/e1-033-after02-checks/render-02-runtime-unchanged.json');
manifest.unmatched=[];for(const deck of receipt.decks)for(const slide of deck.slides)if(!slide.before||!slide.claude)manifest.unmatched.push({deck:deck.id,ordinal:slide.ordinal,id:slide.id,before:!!slide.before,claude:!!slide.claude,sheet:'sheets/'+deck.id+'/review-'+String(Math.floor((slide.ordinal-1)/4)+1).padStart(2,'0')+'.png'});
manifest.individualSheets=manifest.decks.reduce((n,d)=>n+d.sheets.length,0);manifest.archivedFiles=inventory.filter(f=>f.storage.kind==='archive').length;manifest.fixedFilesReused=manifest.reusedFixedFiles.length;
manifest.actualOutputInventory='files.json';save('files.json',JSON.stringify(inventory,null,2)+'\n');save('manifest.json',JSON.stringify(manifest,null,2)+'\n');
const script=read(new URL(import.meta.url));save('capture-executed.mjs',script);
console.log(JSON.stringify({slides:manifest.slides,decks:manifest.decks.length,sheets:manifest.individualSheets,packets:manifest.packets.length,fixedFilesReused:manifest.fixedFilesReused,counts:manifest.counts,archiveBytes:manifest.packets.reduce((n,p)=>n+p.bytes,0)},null,2));