// SH-04 with SH-25: an overlay never moves content. A chart drawn with a shape anchored to one of its points has exactly the marks, labels
// and axes it has without the shape (the anchor is placed on the plot the chart is drawn in, never on a plot of its own).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolvePresentation,toSvg} from './catalog-harness.mjs';

const base=JSON.parse(await readFile(new URL('../../../examples/technical/chart-point-overlays.opf.json',import.meta.url),'utf8'));
// Every drawn element of the chart (its marks, labels, ticks and legend), in order, its numbers to the thousandth the SVG draws them at
// (the trace attributes carry unrounded floats, which a plot pinned as an inset reproduces only to about 1e-12).
const chartMarks=svg=>[...svg.matchAll(/<(?:rect|circle|path|line|polyline|text|g)\b[^>]*data-opf-path="slides\.0\.blocks\.0[^"]*"[^>]*>/g)].map(match=>match[0].replace(/-?\d+\.\d+/g,number=>String(Math.round(Number(number)*1000)/1000)));
const data={columns:['Region','Share'],rows:[['North',42],['South',28],['East',18],['West',12]]};
const scatter={columns:['Spend','Revenue','Margin'],rows:[[1200,31000,4],[2500,42000,9],[4100,58000,12],[6100,61000,15]]};
const charts=[
 ['pie',{type:'pie',data}],
 ['pie, two series as rings',{type:'pie',data:{columns:['Region','2025','2026'],rows:[['North',42,40],['South',28,30],['East',18,20]]}}],
 ['pie, legend at the bottom',{type:'pie',data,legend:'bottom'}],
 ['pie, legend at the left',{type:'pie',data,legend:'left'}],
 ['doughnut',{type:'doughnut',data}],
 ['scatter',{type:'scatter',data:scatter}],
 ['scatter, formatted X axis',{type:'scatter',data:{...scatter,columns:[{name:'Spend',format:'$#,##0'},'Revenue','Margin']}}],
 ['scatter, legend at the top and axis titles',{type:'scatter',data:scatter,legend:'top',axisTitles:{category:'Spend',value:'Revenue'}}],
 ['column',{type:'column',data}],
];
let compared=0,anchoredCount=0;
for(const [name,chart] of charts)for(const language of ['en-US','ar']){
 const slide=shapes=>({...base,language,slides:[{title:'Where the revenue comes from',blocks:[{id:'chart',chart}],...(shapes?{shapes}:{})}]});
 const anchored=slide([{shape:'ellipse',fill:'none',at:{block:'chart',point:1,series:0,edge:'center',widthPx:40,heightPx:40}}]);
 const geometry=resolvePresentation(anchored).slides[0].geometry;
 // A chart composition gives no layer (a pie with a legend of the author's) takes no anchor and reports it; it still never moves.
 const placed=Boolean(geometry.overlayShapes?.[0]?.attachedTo?.chartPoint);
 assert.ok(placed||geometry.diagnostics.some(entry=>entry.code==='shape-anchor-missing'),`${name} (${language}): the anchor is placed or reported`);
 if(placed)anchoredCount++;
 const without=chartMarks(toSvg(slide(),1,{trace:true})),with_=chartMarks(toSvg(anchored,1,{trace:true}));
 assert.ok(without.length>3,`${name} (${language}): the chart draws marks`);
 assert.deepEqual(with_,without,`${name} (${language}): the anchored overlay leaves the chart where it is drawn without it`);
 compared++;
}
assert.ok(anchoredCount>=14,`${anchoredCount} anchors placed`);
console.log(`SH-25 keeps the chart: ${compared} charts draw the same marks with and without an anchored overlay.`);
