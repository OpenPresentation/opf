import assert from 'node:assert/strict';
import {createDataContent,parseTabularData} from '../packages/javascript/dist/data.js';
import {renderSvg} from '../../opf-render/src/svg.js';
import {toPptx,fromPptx} from '../../opf-pptx/src/index.js';
const csv='Quarter,Revenue,Cost\nQ1,12,-4\nQ2,18,7';
const chart=createDataContent(csv,{as:'chart'}),table=createDataContent(csv,{as:'table'});
for(const type of ['column','bar','line','area']){
 const doc={slides:[{...chart,chart:{...chart.chart,type}}]},svg=renderSvg(doc,{trace:true});
 // Renderer 0.11.3+ traces every data cell of a column or bar chart and the category labels of a line or area chart (its marks are polylines).
 assert.match(svg,/Revenue/);assert.match(svg,/Cost/);assert.match(svg,type==='line'||type==='area'?/rows\.0\.0/:/rows\.0\.2/);assert.doesNotMatch(svg,/NaN|Infinity/);
 // One mark per series: a line chart draws a polyline per series and a legend key each (4), an area chart one filled path per series (2).
 if(type==='line')assert.equal((svg.match(/<polyline/g)??[]).length,4);
 if(type==='area')assert.equal((svg.match(/<path/g)??[]).length,2);
}
for(const type of ['pie','donut']){
 const content=createDataContent('Q,V\nA,2\nB,3',{as:'chart',chartType:type});
 const svg=renderSvg({slides:[content]},{trace:true});assert.match(svg,/<path/);// Renderer 0.11.3+ draws a doughnut as ring paths: an outer and an inner arc per slice (a pie slice has one arc).
 if(type==='donut')assert.equal((svg.match(/ A /g)??[]).length,4);else assert.equal((svg.match(/ A /g)??[]).length,2);
}
const numericCategory=createDataContent([{year:2025,sales:2},{year:2026,sales:-1}],{as:'chart'});
assert.match(renderSvg({slides:[numericCategory]}),/2025/);
const bytes=await toPptx({slides:[{title:'Data import',blocks:[table,chart]}]});assert.ok(bytes.length>1000);
const roundtrip=await fromPptx(bytes);const serialized=JSON.stringify(roundtrip);
assert.match(serialized,/Revenue/);assert.match(serialized,/-4/);
assert.deepEqual(parseTabularData(csv).rows[0],['Q1','12','-4']);
console.log('Data ecosystem passed: all series, signed measures, numeric categories, pie/donut, and PPTX export/import.');
