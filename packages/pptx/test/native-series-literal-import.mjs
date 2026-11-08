import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import {unzipSync,zipSync,strFromU8,strToU8} from'fflate';
import {toPptx,fromPptx} from'./helpers/default-catalog.mjs';
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
let controls=0;
for(const type of ['column','scatter']){
 const chart={type,data:type==='scatter'?{columns:['Point','X','Current','Expansion'],rows:[['A',1,20,10],['B',2,15,8]]}:{columns:['Country','Current','Expansion'],rows:[['US',20,10],['France',15,8]]}},bytes=await toPptx({slides:[{chart}]},{provenance:false}),original=unzipSync(bytes),chartPart='ppt/charts/chart1.xml',xml=strFromU8(original[chartPart]),first=/<c:ser>[\s\S]*?<\/c:ser>/.exec(xml)[0],tx=/<c:tx>[\s\S]*?<\/c:tx>/.exec(first)[0],baseline=await fromPptx(bytes),read=deck=>deck.slides[0].chart??deck.slides[0].blocks.find(b=>b.chart).chart,nativeBefore=read(baseline),nameIndex=type==='scatter'?2:1;
 const changed=raw=>{const parts={...original};parts[chartPart]=strToU8(xml.replace(first,first.replace(tx,'<c:tx>'+raw+'</c:tx>')));return zipSync(parts);};
 for(const value of ['Native renamed','  Δ 日本 العربية  ','0012','','A & <B> "quoted"','\tName\nLine']){
  const input=changed('<c:v xml:space="preserve">'+escape(value)+'</c:v>'),before=input.slice(),current=read(await fromPptx(input));
  assert.equal(current.data.columns[nameIndex],value,type+': literal c:tx/c:v preserves exact current native string');assert.deepEqual(current.data.columns.slice(nameIndex+1),nativeBefore.data.columns.slice(nameIndex+1),type+': other cached names unchanged');assert.deepEqual(current.data.rows,nativeBefore.data.rows,type+': numeric data/categories unchanged');assert.deepEqual(input,before,'import must not mutate input archive');controls++;
 }
 for(const raw of ['<c:v>One</c:v><c:v>Two</c:v>','<c:v>One</c:v>'+tx.slice('<c:tx>'.length,-'</c:tx>'.length),'<c:v><c:v>Nested</c:v></c:v>']){
  await assert.rejects(fromPptx(changed(raw)),error=>error.code==='invalid-chart-cache'&&error.path.startsWith(chartPart+'#c:ser[0]/c:tx'),type+': malformed or competing literal name refuses explicitly');controls++;
 }
}
console.log('Current literal series-name import: '+controls+' exact-string/classic/scatter/source-integrity/refusal controls PASS.');

// Exact coordinator-owned PowerPoint edit/SaveCopyAs/read-only-reopen witness.
const actual=readFileSync(new URL('./fixtures/native-series-name-saved.pptx',import.meta.url));
assert.equal(createHash('sha256').update(actual).digest('hex'),'eaa03f837aad1e13e53d9fc7afe5d5f9c4098b8992dff200b35798253ffbc2e3');
const actualBefore=actual.slice(),findings=[],current=await fromPptx(actual,{onDiagnostic:d=>findings.push(d)}),slide=current.slides[0],actualChart=slide.blocks.find(b=>b.chart).chart;
assert.deepEqual(actualChart.data.columns,['Country','Native renamed','Expansion'],'actual saved literal name beats original OPF/workbook header');
assert.deepEqual(actualChart.data.rows,[['US',20,10],['France',15,8]],'actual native values and categories stay complete');
assert.equal(slide.shapes[0].at.series,0,'actual numeric selector remains attached');assert.equal(slide.shapes[1].at,undefined,'actual stale named selector refuses');assert.ok(Number.isFinite(slide.shapes[1].x)&&Number.isFinite(slide.shapes[1].y),'actual native overlay position preserved');assert.ok(findings.some(d=>d.code==='shape-property-dropped'&&d.property==='chart point anchor'&&d.path==='slides.0.shapes.1'),'actual stale-name refusal is explicit');assert.deepEqual(actual,actualBefore,'actual saved fixture remains immutable');
console.log('Actual PowerPoint saved literal series name, unchanged current data/index anchor and explicit stale-name refusal PASS.');
