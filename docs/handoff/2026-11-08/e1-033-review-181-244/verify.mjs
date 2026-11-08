import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const dir=dirname(fileURLToPath(import.meta.url));
const b=JSON.parse(fs.readFileSync(join(dir,'bindings.json')));
const review=JSON.parse(fs.readFileSync(join(dir,'review.json')));
const raw=gunzipSync(fs.readFileSync(join(dir,'execution-receipt.json.gz')));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(raw.length,b.executionReceipt.bytes);
assert.equal(hash(raw),b.executionReceipt.sha256);
const receipt=JSON.parse(raw);
assert.equal(b.sourceCommit,'29ba0ae536b019ada68623d44850d6cb3b7a6350');
assert.equal(receipt.releaseCommit,b.releaseCommit);
assert.equal(review.reviewed,64);
assert.deepEqual(review.records.map(x=>x.ordinal),Array.from({length:64},(_,i)=>181+i));
let rows=0,warnedRows=0,findings=0,missingBefore=0,missingClaude=0,stress=0;
const judgments={};const decks=new Set();
for(const record of review.records){
 const bound=b.records.find(x=>x.ordinal===record.ordinal);
 assert.equal(record.sha256,bound.sha256);
 assert.equal(record.deck,bound.deck);
 assert.equal(record.localSheet,bound.localSheet);
 assert.equal(record.vetoable,true);
 assert.match(record.viewed,/Actual view_image original detail/);
 const png=fs.readFileSync(bound.localFile);
 assert.equal(png.length,bound.bytes);
 assert.equal(hash(png),bound.sha256);
 assert.equal(hash(execFileSync('git',['show',b.sourceCommit+':'+bound.sourceFile],{maxBuffer:16*1024*1024})),bound.sha256);
 const deck=receipt.decks.find(x=>x.id===bound.deck);
 assert.deepEqual(deck.sheets[bound.localSheet-1],{file:'sheets/review-'+String(bound.localSheet).padStart(2,'0')+'.png',bytes:bound.bytes,sha256:bound.sha256});
 const source=fs.readFileSync(bound.localFile.replace(/[/\\]sheets[/\\][^/\\]+$/,'/current-gallery.opf.json'));
 assert.equal(hash(source),bound.sourceDeck.sha256);
 assert.equal(source.length,bound.sourceDeck.bytes);
 assert.equal(deck.authoredSlidesSha256,bound.authoredSlidesSha256);
 decks.add(deck.id);
 assert.equal(record.slides.length,bound.panels.length);
 for(let i=0;i<record.slides.length;i++){
  const s=record.slides[i],p=bound.panels[i];rows++;
  assert.equal(s.id,p.id);assert.equal(s.ordinal,p.ordinal);
  assert.equal(s.missingBefore,!p.before);assert.equal(s.missingClaude,!p.claude);
  missingBefore+=Number(s.missingBefore);missingClaude+=Number(s.missingClaude);
  const expected=deck.findings.filter(f=>f.slideId ? f.slideId===p.id : Number(/^\/slides\/(\d+)(?:\/|$)/.exec(f.path??'')?.[1])===p.ordinal-1);
  assert.deepEqual(p.findings,expected.map(f=>({binding:f.slideId?'explicit-slideId':'zero-based-json-pointer',...f})));assert.deepEqual(s.findings,p.findings);
  warnedRows+=Number(expected.length>0);findings+=expected.length;
  if(expected.some(f=>['render/layout-unplaced','render/text-overflow'].includes(f.ruleId))){assert.ok(['stress-refusal-control','stress/refusal'].includes(s.judgment));stress++;}
  assert.ok(s.note.length>20);assert.ok(s.judgment);
  judgments[s.judgment]=(judgments[s.judgment]??0)+1;
 }
}
for(const id of decks){const d=receipt.decks.find(x=>x.id===id);assert.deepEqual(b.unassignedDocumentFindings[id],d.findings.filter(f=>!f.slideId&&!/^\/slides\/\d+(?:\/|$)/.test(f.path??'')));}
assert.equal(rows,244);assert.equal(warnedRows,23);assert.equal(missingBefore,2);assert.equal(missingClaude,0);
assert.equal(review.records.find(x=>x.ordinal===188).slides.find(x=>x.id==='s32').judgment,'known-reading-measure-hold');
assert.equal(review.records.find(x=>x.ordinal===217).slides[0].judgment,'usable-with-style-provenance-note');
assert.match(review.corrections[0].resolution,/Rejected candidate/);
const result={complete:true,node:process.version,reviewedSheets:64,slideRowComparisons:rows,actualPanels:rows*3-missingBefore-missingClaude,warnedRows,findings,stressRefusalRows:stress,missingBefore,missingClaude,judgments,sourceCommit:b.sourceCommit,releaseCommit:b.releaseCommit,executionReceiptSha256:hash(raw),bindingsSha256:hash(fs.readFileSync(join(dir,'bindings.json'))),reviewSha256:hash(fs.readFileSync(join(dir,'review.json'))),checks:'Every original PNG equals its execution receipt and committed source bytes; current JSON/authored binding exact; every review finding equals explicit slideId or zero-based slide-pointer matching; all render refusals remain unaccepted; missing history and rejected title candidate remain explicit.'};
fs.writeFileSync(join(dir,'checks.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
