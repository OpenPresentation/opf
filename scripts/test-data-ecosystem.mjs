import assert from 'node:assert/strict';
import {createDataContent,parseTabularData} from '../packages/javascript/dist/data.js';
import {renderSvg} from '../../opf-render/src/svg.js';
import {toPptx,fromPptx} from '../../opf-pptx/src/index.js';
const csv='Quarter,Revenue,Cost\nQ1,12,-4\nQ2,18,7';
const chart=createDataContent(csv,{as:'chart'}),table=createDataContent(csv,{as:'table'});
for(const type of ['column','bar','line','area']){
 const doc={slides:[{...chart,chart:{...chart.chart,type}}]},svg=renderSvg(doc,{trace:true});
 assert.match(svg,/Revenue/);assert.match(svg,/Cost/);assert.match(svg,/rows\.0\.2/);assert.doesNotMatch(svg,/NaN|Infinity/);
 if(type==='line'||type==='area')assert.equal((svg.match(/<polyline/g)??[]).length,2);
}
for(const type of ['pie','donut']){
 const content=createDataContent('Q,V\nA,2\nB,3',{as:'chart',chartType:type});
 const svg=renderSvg({slides:[content]},{trace:true});assert.match(svg,/<path/);if(type==='donut')assert.match(svg,/<circle/);
}
const numericCategory=createDataContent([{year:2025,sales:2},{year:2026,sales:-1}],{as:'chart'});
assert.match(renderSvg({slides:[numericCategory]}),/2025/);
const bytes=await toPptx({slides:[{title:'Data import',blocks:[table,chart]}]});assert.ok(bytes.length>1000);
const roundtrip=await fromPptx(bytes);const serialized=JSON.stringify(roundtrip);
assert.match(serialized,/Revenue/);assert.match(serialized,/-4/);
assert.deepEqual(parseTabularData(csv).rows[0],['Q1','12','-4']);
console.log('Data ecosystem passed: all series, signed measures, numeric categories, pie/donut, and PPTX export/import.');
