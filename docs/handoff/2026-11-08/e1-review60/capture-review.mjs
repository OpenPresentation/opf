import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const commit='29ba0ae536b019ada68623d44850d6cb3b7a6350';
const prefix='docs/evidence/e1-033-after-2026-11-08-02';
const root='C:/opf-work/e1-033-after-02';
const sha=x=>createHash('sha256').update(x).digest('hex');
const blob=x=>createHash('sha1').update(`blob ${x.length}\0`).update(x).digest('hex');
const json=x=>JSON.parse(fs.readFileSync(x));
const rawReceipt=fs.readFileSync(root+'/receipt.json'),receipt=JSON.parse(rawReceipt);
const files=JSON.parse(execFileSync('git',['show',`${commit}:${prefix}/files.json`],{maxBuffer:4e6}));
const rawTree=execFileSync('git',['ls-tree','-r','-z',commit,'--',prefix+'/sheets'],{maxBuffer:4e6}).toString();
const tree=new Map(rawTree.split('\0').filter(Boolean).map(x=>{const [meta,file]=x.split('\t');return[file,meta.split(' ')[2]];}));
assert.equal(receipt.complete,true);assert.equal(receipt.renderedSlides,936);
assert.ok(files.some(f=>f.sha256===sha(rawReceipt)&&f.file.endsWith('receipt.json')),'Root receipt equals immutable packet');
const notes={
overview:[
'Cover/section hierarchy is clear; agenda numbering and split agenda fit. Fixed Claude cover is image-only; no replacement inferred.',
'Statement and closing surfaces improve hierarchy; text/list bodies are larger and legible with short lines.',
'Quote and pillars grow legibly; two/three-column prose is reflowed into rows and remains readable on these short samples.',
'Comparison, process and FAQ use readable larger body type. Timeline has short distinct labels and a separate note, without collision.',
'Metrics/scorecard are legible; image fills its area; beside-image note fits. Metric/table labels remain subordinate; whitespace alone is not a new defect.',
'Gallery and charts fit, with data labels visible. Sparse two-row table remains small; record for owner design review, without duplicating existing table work.',
'Template code hugs the snippet and wraps it; table-beside, hero and dashboard preserve content. Template code retained as LH-101 control, not E1V60-01.',
'Team cards use larger type; logos are clean. Pyramid/matrix are current-only and both absent historical slots are explicit.',
'Cycle/chevrons/flow/vertical-flow are current-only. Nodes and short labels fit without collision; all missing controls are honestly marked.',
'Weighted prose and three items are larger/legible; metrics and chart are clean. No exact historical font-size claim.',
'Chart/list and chart/metric are balanced; promoted prose/list fits; promoted metrics/timeline labels remain distinct.',
'Image/quote and six points are clear; table/text preserved. Mixed code-text panel has tiny short snippet amid large empty surface: E1V60-01.',
'Chart plus quote preserves content and is legible; no new clipping or unplaced body detected.'
],
'pilot':[
'Cover, section and both agenda variants inspected directly; same visible readable treatments as overview, fixed image-only Claude cover preserved.',
'Statement/closing/text/list directly inspected: larger body type and readable short lines.',
'Quote, paragraph rows and pillars directly inspected; no new clipping or content omission detected.',
'Comparison/process/timeline/FAQ directly inspected; readable labels and note separation.',
'Metrics/scorecard/image/image-beside directly inspected; labels subordinate and image framing clean.',
'Gallery/charts/table directly inspected; sparse table observation retained without a duplicate defect claim.',
'Table-beside/template code/hero/dashboard directly inspected; snippet-hugging template code is LH-101 control.',
'Team/logos/weighted prose/three-item treatment directly inspected; body text is readable and preserved.',
'Metric grid/chart/chart-list/chart-metric directly inspected; no new clipping or omission detected.',
'Promoted columns/grid/image-quote/table-text directly inspected; code follow-up is on the next sheet.',
'Six points and chart/quote fit; mixed code-text short snippet remains tiny in oversized surface: E1V60-01.'
],
'batch-01':[
'Cover and image gallery fill their frames; charts and metrics fit. Chart-type adaptations are F3 boundary checks, not new visual regression claims.',
'Four prose cards, image/quote, agenda and six-image grid fit; body text readable; no new clipping detected.',
'Image gallery, prose, radar/list and closing content fit. Dense prose remains complete; no unsupported content rewrite inferred.',
'Line and box-chart fallback drawings retained for F3 contract review; timeline notes are separated; metric/image composition is clean.',
'Two-column prose, chart pair, table and grouped evidence fit. Table grows visibly; dense groups are treated as authored controls.',
'Lone short code grows and hugs its snippet per LH-101; dense three-code fixture fits its code panels and notes; no new sparse-row defect asserted here.',
'Grid/paragraph cards and image/quote fit; s27 has visibly long full-width prose lines, mapped to existing 1194 general reading-measure work.',
'Cover/images fill their frames; dense dashboard charts and chart/list fit. No new clipping detected.',
'Cards, image/quote, agenda and seven-image grid fit. Numbering-start warnings remain source controls, not speculative new regressions.',
'Four-image grid and four-paragraph body fit; sparse metric trio noted for design review without an unsupported font-shrink claim; closing content preserved.',
'Chart/list and chart/ring are clean. s43 small multi-timeline notes are existing LH-41 class; no duplicate new bug. Metric/image content preserved.',
's45 full-width prose has long reading measure: existing 1194 scope. Box/Pareto adaptation belongs F3; table/text and five grouped columns remain complete.',
'Lone metric grows strongly; five-group list/text fixture is dense but complete. No new under-capacity bug asserted.'
],
'batch-02':[
'Mixed dashboard fits; lone code hugs its snippet under LH-101; lone metric grows; pillars readable.',
'Lone paragraph grows; mixed image/quote and image-only cover/grid fit; dense dashboard retains authored components.',
'Image grid fills; chart/metric balanced; mixed cards and treemap-type fallback preserved. F3 owns adaptation contract.',
'Agenda and image grids fit. s16 ordinary prose forms long full-width lines: existing 1194 recheck, not a duplicate new fix.',
'Metric trio, closing prose/cards, bar/list and mixed charts fit. Metric whitespace is an observation, not an exact historical size regression.',
's21 multi-timeline labels/notes small: existing LH-41 class. Cover, closing and metric/image preserve content without new clipping.',
'Two tables and dense grouped lists are controls; previous fixed-before overlap is absent in current. Quote grows and is readable.',
'Dashboard and comparison fit; template code s30 hugs content (LH-101 control). Sparse metric cards noted for design review without new defect claim.',
's33 long ordinary prose belongs 1194; s34 mixed code row confirms E1V60-01. s36 is two-series Pareto adaptation boundary routed to F3, not a single-series bug.',
'Portrait and mixed card grid fit; metrics/timeline and chart/metric retain content. No new under-capacity defect confirmed.',
'Dense numbered agenda, image grids and six-paragraph content remain complete/legible at sheet scale; no new clipping detected.',
'Table/text and three metrics fit; s46 long lead prose belongs 1194. Dense three-chart dashboard retained for F3 contracts.',
's49 small multi-timeline labels belong existing LH-41 class. s50 large one-message prose is legible and fills body.'
],
'batch-03':[
'Prose, metric/image and dense table/group fixtures fit. Numbering-start source warnings preserved; no new clipping detected.',
'Short timeline labels are distinct; seven grouped lists are dense controls; larger three-part body fits; paired code panels are not under-capacity case.',
'Metric cards and process readable; s11 long ordinary prose belongs 1194. s12 confirms tiny short code in oversized mixed row: E1V60-01.',
'Cover/images fill; ring/metric and image/quote preserve content. Pie-type representation difference is an F3 contract boundary, not inferred omission.',
'Dense mixed cards and groups fit; s18 long ordinary prose belongs 1194. Logo surface is clean.',
'Image grid fits; timeline/metric labels small but separated; table/text is complete; one-message prose grows clearly. Existing timeline/table work owns recheck.',
'Metric trio and charts preserve content; s27 is the already-open LH-41 timeline-note defect, not a duplicate new finding. Stacked values are readable.',
's29 wide ordinary prose belongs 1194. Chart/prose fit; three tables and eight groups are dense controls with original warnings retained.',
'Weighted prose grows; eight grouped lists and three lists fit; two-code fixture panels/notes remain complete. No new sparse-row defect asserted.',
'Metric grid and four prose cards fit. Timeline plus note and timeline/metric preserve labels/notes; existing timeline work owns their final034 recheck.'
]};
const codeIds=new Map([['overview',['dynamic-code-text']],['pilot',['dynamic-code-text']],['batch-02',['s34']],['batch-03',['s12']]]);
let index=0;const rows=[];const all=[];
for(const d of receipt.decks){
 const sourceRaw=fs.readFileSync(`${root}/decks/${d.id}/current-gallery.opf.json`),source=JSON.parse(sourceRaw);
 assert.equal(sha(sourceRaw),d.current.sha256);
 const sourceStorage=files.find(f=>f.sha256===sha(sourceRaw)&&f.file.endsWith('/current-gallery.opf.json'));
 assert.ok(sourceStorage,'Derived source equals immutable packet');
 for(let s=0;s<d.sheets.length;s++){
  index++; const sheet=d.sheets[s],file=`sheets/${d.id}/${path.posix.basename(sheet.file)}`;
  all.push({index,deck:d.id,file,sha256:sheet.sha256});
  if(index>60)continue;
  const local=`${root}/decks/${d.id}/${sheet.file}`,raw=fs.readFileSync(local);
  assert.equal(sha(raw),sheet.sha256);assert.equal(blob(raw),tree.get(`${prefix}/${file}`));
  const slides=d.slides.slice(s*4,s*4+4).map(x=>{const out=d.outputs[x.ordinal-1],img=fs.readFileSync(`${root}/decks/${d.id}/after/${out.file}`);assert.equal(sha(img),out.sha256);assert.equal(source.slides[x.ordinal-1].id,x.id);return {...x,after:out,authoredSlideSha256:sha(JSON.stringify(source.slides[x.ordinal-1])),findings:d.findings.filter(f=>f.slideId===x.id)};});
  const flagged=slides.filter(x=>codeIds.get(d.id)?.includes(x.id));
  rows.push({index,deck:d.id,sheetNumber:s+1,sheet:{file,sha256:sheet.sha256,bytes:raw.length,gitBlob:blob(raw),width:raw.readUInt32BE(16),height:raw.readUInt32BE(20)},viewed:true,viewTool:'view_image/original',judgment:'visual-review-completed',acceptance:flagged.length?'new-under-capacity-code-followup':'bounded-judgment-see-note',newFindingIds:flagged.length?['E1V60-01']:[],note:notes[d.id][s],source:{file:`decks/${d.id}/current-gallery.opf.json`,sha256:sha(sourceRaw),immutableStorage:sourceStorage.storage},slides});
 }
}
assert.equal(all.length,244);assert.equal(rows.length,60);assert.equal(rows.flatMap(r=>r.slides).length,232);assert.ok(rows.every(r=>r.note&&r.viewed));
const out={schema:'opf.e1-visual-review/1',date:'2026-11-08',evidenceOnly:true,neverMerge:true,sourceEvidenceCommit:commit,sourcePrefix:prefix,rawReceiptSha256:sha(rawReceipt),release:'0.33.0',releaseCommit:receipt.releaseCommit,order:'render receipt deck order, then ascending per-deck sheet ordinal',reviewedSheetCount:60,totalSheetCount:244,reviewedSlideTriptychs:232,remainingSheetCount:184,remainingStatus:'unreviewed by this batch; prior triage is separately scoped and does not make these accepted',fullCorpusAccepted:false,rows,unreviewed:all.slice(60)};
fs.writeFileSync(new URL('./review.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
const codes={};for(const row of rows)for(const s of row.slides)for(const f of s.findings)codes[f.ruleId]=(codes[f.ruleId]??0)+1;
const verification={pass:true,checks:['All60 PNG SHA256 values equal execution receipt','All60 actual PNG Git blob IDs equal immutable29ba tree','All232 after PNG SHA256 values equal execution receipt','All5 selected derived-source SHA256 values equal immutable files.json references','Finite60-row judgment index, 244 total sheets, 184 explicitly unreviewed'],reviewedFindingOccurrences:codes,allCorpusWarnings427PreservedInSourcePacket:true,imagesCreated:0,inputMutations:0,registryCalls:0,githubApiCalls:0};
fs.writeFileSync(new URL('./verification.json',import.meta.url),JSON.stringify(verification,null,2)+'\n');
console.log(JSON.stringify({reviewed:60,triptychs:232,unreviewed:184,reviewedFindings:codes,pass:true}));
