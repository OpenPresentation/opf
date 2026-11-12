import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide,horizontalBarPlot,resolveChartData} from '../dist/composition.js';
const data={columns:['Region','Actual'],rows:[['North',12],['South',18],['East',16]]};
const ref={value:20,label:'Target 20',stroke:{color:'#C44900',width:2,dash:'dash'}};
const chart=(options={})=>({type:'bar',data,legend:'none',dataLabels:false,referenceLines:[ref],...options});
const item=(c,extra={})=>composeSlide({chart:c,...extra},{width:1280,height:720}).items.find(x=>x.field==='chart');
test('captured suite03 active bar retains its explicit target beyond ordinary data bounds',()=>{
 const c=chart(),i=item(c);assert.deepEqual(i.chart.valueAxis,{min:0,max:25,majorUnit:5});assert.equal(i.chart.layer?.references?.lines.length,1);
 const l=i.chart.layer.references.lines[0],p=i.chart.layer.plot;assert.equal(l.native,false);assert.equal(l.strokeWidth,2);assert.equal(l.label,'Target 20');assert.ok(l.x1>i.box.x+p.left&&l.x1<i.box.x+i.box.width-p.right);assert.equal(l.x1,l.x2);assert.equal(l.y1,i.box.y+p.top);assert.equal(l.y2,i.box.y+i.box.height-p.bottom);
 // Keep the legacy helper's options guard; explicit references use the shared active-option plot instead.
 assert.equal(horizontalBarPlot(c,resolveChartData(c),undefined,i.chart.valueAxis,i.box,{scale:1,measure:t=>t.length*10}),undefined);
});
test('active bar legends and axis titles reserve their real edges while targets remain in the plotted value scale',()=>{
 for(const legend of ['none','top','bottom','left','right']){
  const base=item(chart({legend})),titled=item(chart({legend,axisTitles:{category:'Region',value:'Revenue'}})),p=base.chart.layer?.plot,q=titled.chart.layer?.plot;assert.ok(p&&q,legend);assert.ok(q.left>p.left,legend);assert.ok(q.bottom>p.bottom,legend);assert.equal(titled.chart.layer.references.lines.length,1);
 }
});
test('fixed-frame bar references and plot do not depend on title or subtitle prose',()=>{
 const c=chart(),snapshot=(title,subtitle)=>{const s=composeSlide({title,subtitle,chart:c},{width:1280,height:720,layout:{name:'Fixed chart',regions:[{name:'title',size:.2},{name:'body',size:.8,accepts:['chart'],flow:'none'}]},recompose:false,fill:false}),i=s.items.find(x=>x.field==='chart');return {box:i.box,chart:i.chart};};
 const before=snapshot('Actual above 99%','North below 1000 in 2023'),neutral=snapshot('Neutral title','Neutral subtitle');assert.equal(before.chart.layer?.references?.lines.length,1);
 // A reference never changes emphasis: the prose that names North focuses it, exactly as on the same chart without references.
 // Everything else (box, axis, plot, references and their labels) is the same as under neutral prose.
 const {referenceLines:_lines,...plain}=c,unreferenced=composeSlide({title:'Actual above 99%',subtitle:'North below 1000 in 2023',chart:plain},{width:1280,height:720,layout:{name:'Fixed chart',regions:[{name:'title',size:.2},{name:'body',size:.8,accepts:['chart'],flow:'none'}]},recompose:false,fill:false}).items.find(x=>x.field==='chart');
 assert.ok(before.chart.layer.focus);assert.deepEqual(before.chart.layer.focus,unreferenced.chart.layer.focus);assert.equal(neutral.chart.layer.focus,undefined);
 const {focus:_focus,...layer}=before.chart.layer;assert.deepEqual({...before,chart:{...before.chart,layer}},neutral);
});

test('bare and simple option bars retain references without relaxing the legacy geometry guard',()=>{
 for(const options of [{},{legend:'none'},{dataLabels:false},{legend:'right',dataLabels:true}]){
  const c={type:'bar',data,referenceLines:[ref],...options},i=item(c);assert.equal(i.chart.layer?.references?.lines.length,1,JSON.stringify(options));assert.equal(i.chart.layer.references.lines[0].native,false);
 }
});
