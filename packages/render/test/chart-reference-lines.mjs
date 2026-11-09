import assert from 'node:assert/strict';
import {test} from 'node:test';
import {toSvg,resolvePresentation} from './catalog-harness.mjs';
import {chartAxisFraction} from '@openpresentation/opf/composition';
const attrs=text=>Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([,k,v])=>[k,v]));
const tags=(svg,name)=>[...svg.matchAll(new RegExp('<'+name+'\\b([^>]*)>','g'))].map(([,a])=>attrs(a));
const refs=svg=>tags(svg,'line').filter(a=>/^slides\.0\.chart\.referenceLines\.\d+$/.test(a['data-opf-path']??''));
const data={columns:['Quarter','Actual'],rows:[['Q1',10],['Q2',20],['Q3',30]]};
const deck=(chart,extra={})=>({design:{fontScheme:'roboto',colorScheme:'cool-horizon'},slides:[{title:'Explicit reference lines',chart:{type:'line',data,...chart},...extra}]});
const near=(a,b)=>assert.ok(Math.abs(Number(a)-Number(b))<.02,String(a)+' ~ '+String(b));
test('main line stays solid while independent reference styles, optional labels and width zero render explicitly',()=>{
 const doc=deck({referenceLines:[{value:20,label:'Target',stroke:{color:'#A01234',width:2,dash:'dash'}},{value:25,stroke:{color:'accent2',width:3,dash:'solid'}},{value:15,label:'Dotted',stroke:{color:{color:'accent3',lighten:.2},width:1,dash:'dot'}},{value:12,label:'Label only',stroke:{width:0}}]});const svg=toSvg(doc,1,{trace:true});const lines=refs(svg);assert.equal(lines.length,3);assert.equal(lines[0].stroke.toUpperCase(),'#A01234');assert.equal(lines[0]['stroke-width'],'2');assert.equal(lines[0]['stroke-dasharray'],'8 6');assert.equal(lines[1]['stroke-dasharray'],undefined);assert.equal(lines[2]['stroke-dasharray'],'1 2');
 const main=tags(svg,'polyline').find(a=>a['data-opf-path']==='slides.0.chart.data.columns.1');assert.ok(main);assert.equal(main['stroke-dasharray'],undefined);
 assert.ok(svg.includes('Target')&&svg.includes('Dotted')&&svg.includes('Label only'));assert.ok(!svg.includes('undefined'));
 const resolved=resolvePresentation(doc),item=resolved.slides[0].geometry.items.find(i=>i.field==='chart'),placed=item.chart.layer.references.lines;for(let i=0;i<3;i++){near(lines[i].x1,placed[i].x1);near(lines[i].x2,placed[i].x2);near(lines[i].y1,placed[i].y1);near(lines[i].y2,placed[i].y2);}
});
test('multiple raw percentage targets remain distinct and title/subtitle edits change no traced reference geometry',()=>{
 const chart={data:{columns:['Quarter',{name:'Actual',format:'0%'}],rows:[['Q1',.1],['Q2',.3],['Q3',.5]]},referenceLines:[{value:.25,label:'25%'},{value:.4,label:'40%'},{value:.25,label:'Duplicate'}]};const fixed=extra=>{const doc=deck(chart,extra);doc.catalogs={custom:{layouts:{fixed:{name:'Fixed chart',regions:[{name:'title',size:.2},{name:'body',size:.8,accepts:['chart'],flow:'none'}]}}}};doc.slides[0].layout='fixed';return doc;};const a=toSvg(fixed({title:'Actual exceeded ninety-two percent in 2023',subtitle:'Target 100'}),1,{trace:true}),b=toSvg(fixed({title:'A neutral reading',subtitle:'Another caption'}),1,{trace:true});assert.equal(refs(a).length,3);assert.ok(a.includes('25%')&&a.includes('40%'));assert.notEqual(refs(a)[0].y1,refs(a)[1].y1);assert.equal(refs(a)[0].y1,refs(a)[2].y1);
 // The authored layout fixes the frame, so reference coordinates are exactly invariant.
 const normalized=svg=>refs(svg).map(l=>({x1:l.x1,x2:l.x2,y1:l.y1,y2:l.y2}));assert.deepEqual(normalized(a),normalized(b));
});
test('secondary combo target uses composed secondary bounds and shared plot, independent of primary units',()=>{
 const doc=deck({type:'combo',data:{columns:['Quarter','Revenue',{name:'Margin',format:'0%'}],rows:[['Q1',100,.2],['Q2',200,.3],['Q3',300,.4]]},line:['Margin'],secondaryAxis:['Margin'],referenceLines:[{value:200,label:'Revenue goal'},{value:1.25,axis:'secondary',label:'125%'}]});const svg=toSvg(doc,1,{trace:true}),resolved=resolvePresentation(doc),item=resolved.slides[0].geometry.items.find(i=>i.field==='chart'),lines=refs(svg);assert.equal(lines.length,2);assert.ok(item.chart.secondaryValueAxis.max>=1.25);const plot=item.chart.layer.plot,top=item.box.y+plot.top,height=item.box.height-plot.top-plot.bottom;near(lines[1].y1,top+chartAxisFraction(1.25,item.chart.secondaryValueAxis,true)*height);assert.equal(lines[0].x1,lines[1].x1);assert.equal(lines[0].x2,lines[1].x2);
});
test('bar and singleton fallback draw full-plot references; prose without properties draws none',()=>{
 for(const chart of [{type:'bar',referenceLines:[{value:20,label:'Target'}]},{data:{columns:data.columns,rows:[data.rows[0]]},referenceLines:[{value:20,label:'Target'}]}]){const doc=deck(chart),svg=toSvg(doc,1,{trace:true}),item=resolvePresentation(doc).slides[0].geometry.items.find(i=>i.field==='chart'),line=refs(svg)[0],plot=item.chart.layer.plot;assert.ok(line);if(chart.type==='bar'){near(line.y1,item.box.y+plot.top);near(line.y2,item.box.y+item.box.height-plot.bottom);near(line.x1,line.x2);}else{near(line.x1,item.box.x+plot.left);near(line.x2,item.box.x+item.box.width-plot.right);}}
 const plain=toSvg(deck({}, {title:'Actual above ninety-two percent in 2023',subtitle:'At least 500 in March'}),1,{trace:true});assert.equal(refs(plain).length,0);assert.equal(tags(plain,'rect').filter(a=>a['data-opf-path']==='slides.0.chart.data.rows.1.0').length,0);
});
