import assert from 'node:assert/strict';
import {toSvg} from './catalog-harness.mjs';
const table={columns:['Team','Amount'],rows:[['A',5.8],['B',6.7]]};
const doc={design:{theme:'classic',fontScheme:'roboto',colorScheme:'cool-horizon'},slides:[{table}]};
const before=structuredClone(doc);const svg=toSvg(doc,1,{trace:true});
assert.match(svg,/stroke="#CCCCCC"/);assert.doesNotMatch(svg,/stroke="#3AC67A"/);assert.deepEqual(doc,before);
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const group=(s,path)=>[...s.matchAll(/<g\b([^>]*data-opf-source-text="true"[^>]*)>([\s\S]*?)<\/g>/g)].find(m=>attrs(m[1])['data-opf-path']===path)?.[2];
assert.match(group(svg,'slides.0.table.rows.0.1'),/text-anchor="end"/,'numeric right aligned');
assert.match(group(svg,'slides.0.table.rows.0.0'),/text-anchor="start"/,'text left aligned');
const explicit=structuredClone(doc);explicit.slides[0].table.rows[0][1]={value:5.8,style:{align:'center',borders:{bottom:{color:'accent5',width:2}}}};
const styled=toSvg(explicit,1,{trace:true});assert.match(styled,/stroke="#3AC67A"/);assert.match(group(styled,'slides.0.table.rows.0.1.value'),/text-anchor="middle"/);
const deck=structuredClone(doc);deck.design.contentAlignment='left';assert.match(group(toSvg(deck,1,{trace:true}),'slides.0.table.rows.0.1'),/text-anchor="start"/);
for(const type of ['column','bar'])for(const values of [[5.8,6.7],[-5.8,-6.7],[-2,3]]){
 const input={design:doc.design,slides:[{chart:{type,data:{columns:['Category','Value'],rows:values.map((v,i)=>[String(i),v])}}}]};
 const output=toSvg(input,1,{trace:true});const bars=[...output.matchAll(/<rect\b([^>]*data-opf-path="slides\.0\.chart\.data\.rows\.\d+\.1"[^>]*)\/>/g)].map(m=>attrs(m[1]));assert.equal(bars.length,2);
 if(values[0]*values[1]>0){const lengths=bars.map(b=>Number(b[type==='bar'?'width':'height']));assert.ok(Math.abs(lengths[1]/lengths[0]-Math.abs(values[1]/values[0]))<.001,'bar magnitudes reflect values from zero, not truncated domain');}
 assert.match(output,/stroke="#CCCCCC"/);assert.deepEqual(input.slides[0].chart.data.rows,values.map((v,i)=>[String(i),v]));
}
console.log('Neutral SVG rules, numeric/explicit alignment and positive/negative/mixed zero-baseline bars passed.');
