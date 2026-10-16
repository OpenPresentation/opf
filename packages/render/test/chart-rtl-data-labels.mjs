import assert from 'node:assert/strict';
import {toSvg} from '../dist/svg.js';
const attrs=source=>Object.fromEntries([...source.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([,key,value])=>[key,value]));
for(const direction of ['ltr','rtl'])for(const type of ['line-with-markers','area','stacked-area']) {
  const deck={language:direction==='rtl'?'ar':'en',slides:[{chart:{type,dataLabels:true,data:{columns:['Category','Value'],rows:[['First',10],['Last',20]]}}}]};
  const svg=toSvg(deck,1,{trace:true});
  const labels=[...svg.matchAll(/<g\b([^>]*data-opf-source-text="true"[^>]*)>([\s\S]*?)<\/g>/g)]
    .map(([,group,body])=>({path:attrs(group)['data-opf-path'],x:Number(attrs(/<text\b([^>]*)>/.exec(body)?.[1]??'').x)})).filter(label=>/rows\.\d+\.1$/.test(label.path));
  assert.equal(labels.length,2);
  const xs=type==='line-with-markers'?[...svg.matchAll(/<circle\b([^>]*)\/>/g)].map(([,a])=>attrs(a)).filter(mark=>/rows\.\d+\.1$/.test(mark['data-opf-path'])).map(mark=>Number(mark.cx))
    :[...svg.matchAll(/<path\b([^>]*)\/>/g)].map(([,a])=>attrs(a)).filter(mark=>mark['data-opf-path']==='slides.0.chart.data.columns.1').flatMap(mark=>[...mark.d.matchAll(/(?:M|L) ([\d.-]+) [\d.-]+/g)].slice(0,2).map(match=>Number(match[1])));
  assert.equal(xs.length,2);
  assert.deepEqual(labels.map(label=>label.x),xs,`${type}/${direction}: data labels share actual category x with their marks`);
  assert.equal(xs[0]>xs[1],direction==='rtl','mark order follows direction');
}
console.log('Line/area data labels follow actual LTR/RTL category coordinates.');
