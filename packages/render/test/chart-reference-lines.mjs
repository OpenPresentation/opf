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
 const doc=deck({referenceLines:[{value:20,label:'Target',stroke:{color:'#A01234',width:2,dash:'dash'}},{value:25,stroke:{color:'accent2',width:3,dash:'solid'}},{value:15,label:'Dotted',stroke:{color:{color:'accent3',lighten:.2},width:1,dash:'dot'}},{value:12,label:'Label only',stroke:{width:0}}]});const svg=toSvg(doc,1,{trace:true});const lines=refs(svg);assert.equal(lines.length,3);assert.equal(lines[0].stroke.toUpperCase(),'#A01234');assert.equal(lines[0]['stroke-width'],'2');assert.equal(lines[0]['stroke-dasharray'],'8 6');assert.equal(lines[1]['stroke-dasharray'],undefined);assert.equal(lines[2]['stroke-dasharray'],'1 3');
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

test('explicit author highlight still controls data colors with reference lines',()=>{
 const chart={type:'column',data:{columns:['Quarter','Actual','Other'],rows:[['Q1',10,12],['Q2',20,18],['Q3',30,23]]},colors:['#123456','#123456'],highlight:{series:['Actual']},referenceLines:[{value:25,label:'Target'}]};const svg=toSvg(deck(chart,{title:'Other above 1000'}),1,{trace:true});const bars=tags(svg,'rect');const actual=bars.find(r=>r['data-opf-path']==='slides.0.chart.data.rows.0.1'),other=bars.find(r=>r['data-opf-path']==='slides.0.chart.data.rows.0.2');assert.ok(actual&&other);assert.notEqual(actual.fill,other.fill);assert.notEqual(actual.fill.toUpperCase(),'#123456');assert.equal(refs(svg).length,1);
});

test('table-aligned bars draw their reference on the final row plot',()=>{
 const chart={type:'bar',data:{columns:['Product line','Cost ($K)'],rows:[['Controllers',7.4],['Pumps',3.3],['Valves',1.3],['Sensors',.7]]},referenceLines:[{value:5,label:'Target'}]},table={columns:['Product line','Claims per 1,000','Main cause'],rows:[['Controllers',24,'Firmware faults'],['Pumps',18,'Seal wear'],['Valves',11,'Corrosion'],['Sensors',7,'Calibration drift']]};const doc={design:{fontScheme:'roboto'},slides:[{title:'Warranty claims by product line',blocks:[{chart},{table}]}]};const svg=toSvg(doc,1,{trace:true}),item=resolvePresentation(doc).slides[0].geometry.items.find(i=>i.field==='chart'),line=tags(svg,'line').find(l=>l['data-opf-path']==='slides.0.blocks.0.chart.referenceLines.0'),rows=item.chart.layer.rows;assert.ok(line&&rows);near(line.y1,item.box.y+rows.top);near(line.y2,item.box.y+rows.bottom);const plot=item.chart.layer.plot,axis=item.chart.valueAxis;near(line.x1,item.box.x+plot.left+chartAxisFraction(5,axis)*(item.box.width-plot.left-plot.right));
});
test('area and markerful line references retain normal data marks and category-center spans',()=>{
 for(const type of ['area','line-with-markers']){const doc=deck({type,referenceLines:[{value:20,label:'Target'}]}),svg=toSvg(doc,1,{trace:true}),line=refs(svg)[0];assert.ok(line);assert.ok(Number(line.x1)<Number(line.x2));assert.ok(tags(svg,type==='area'?'path':'circle').some(mark=>mark['data-opf-path']?.includes('.data.')));}
});

test('reference ColorRefs preserve alpha, transforms, variables and the textSecondary role',()=>{
 const doc=deck({referenceLines:[{value:11,stroke:{color:'#A0123480'}},{value:15,stroke:{color:{color:'#808080',lighten:.5}}},{value:19,stroke:{color:'var:target'}},{value:23,stroke:{color:'textSecondary'}}]});doc.variables={target:{type:'color',value:'#123456'}};const svg=toSvg(doc,1,{trace:true}),lines=refs(svg),design=resolvePresentation(doc).slides[0].design;assert.equal(lines.length,4);assert.equal(lines[0].stroke.toUpperCase(),'#A0123480');assert.equal(lines[1].stroke.toUpperCase(),'#C0C0C0');assert.equal(lines[2].stroke.toUpperCase(),'#123456');assert.equal(lines[3].stroke.toUpperCase(),design.colors.mutedText.toUpperCase());
});

test('finite extreme references and data share composed scales instead of disappearing or falling back to ordinary bounds',()=>{
 for(const type of ['column','bar','line','line-with-markers','area','combo'])for(const values of [[Number.MAX_VALUE],[-Number.MAX_VALUE],[-Number.MAX_VALUE,Number.MAX_VALUE]]){
  const chart={type,...(type==='combo'?{data:{columns:['Q','Actual','Rate'],rows:[['Q1',1,.2],['Q2',2,.3]]},line:['Rate'],secondaryAxis:['Rate']}:{}),referenceLines:values.map(value=>({value,label:'Target'}))};
  const doc=deck(chart),svg=toSvg(doc,1,{trace:true}),item=resolvePresentation(doc).slides[0].geometry.items.find(i=>i.field==='chart'),lines=refs(svg);assert.equal(lines.length,values.length,type+' '+values);assert.ok(!/NaN|Infinity/.test(svg));
  for(let i=0;i<values.length;i++){const line=item.chart.layer.references.lines[i];near(lines[i].x1,line.x1);near(lines[i].x2,line.x2);near(lines[i].y1,line.y1);near(lines[i].y2,line.y2);}
  // Ordinary line points near zero must use the same huge composed axis, not the old data-only fallback.
  if(type==='line'&&values.length===2){const main=tags(svg,'polyline').find(a=>a['data-opf-path']==='slides.0.chart.data.columns.1'),ys=main.points.split(' ').map(point=>Number(point.split(',')[1]));assert.ok(Math.max(...ys)-Math.min(...ys)<.02);}
 }
 const doc=deck({type:'combo',data:{columns:['Q','Actual','Rate'],rows:[['Q1',1,.2],['Q2',2,.3]]},line:['Rate'],secondaryAxis:['Rate'],referenceLines:[{value:-Number.MAX_VALUE,axis:'secondary'},{value:Number.MAX_VALUE,axis:'secondary'}]}),svg=toSvg(doc,1,{trace:true});assert.equal(refs(svg).length,2);assert.ok(!/NaN|Infinity/.test(svg));
});
test('a bar chart with chart options draws its reference inside the plot the options leave, with its label',()=>{
 const bars={type:'bar',data:{columns:['Region','Bookings'],rows:[['North America',42],['EMEA',31],['APAC',18]]},referenceLines:[{value:35,label:'Plan'}]};
 for(const extra of [{},{legend:'bottom'},{legend:'right'},{dataLabels:true},{axisTitles:{value:'USD m'}},{legend:'top',dataLabels:true,axisTitles:{category:'Region',value:'USD m'}}]){
  const doc=deck({...bars,...extra}),svg=toSvg(doc,1,{trace:true}),lines=refs(svg),label=JSON.stringify(extra);
  assert.equal(lines.length,1,label);assert.ok(svg.includes('Plan'),label);
  const item=resolvePresentation(doc).slides[0].geometry.items.find(i=>i.field==='chart'),placed=item.chart.layer.references.lines[0],plot=item.chart.layer.plot;
  near(lines[0].x1,placed.x1);near(lines[0].x2,placed.x1);near(lines[0].y1,item.box.y+plot.top);near(lines[0].y2,item.box.y+item.box.height-plot.bottom);
  // The bars are drawn in the same pinned plot: every bar starts at the plot's left edge.
  const barRects=tags(svg,'rect').filter(a=>/^slides\.0\.chart\.data\.rows\.\d+\.1$/.test(a['data-opf-path']??''));assert.equal(barRects.length,3,label);
  for(const rect of barRects)near(rect.x,item.box.x+plot.left);
 }
});
test('stacked charts draw their references on the stack total; a stroke of none draws the label alone',()=>{
 const stacked={columns:['Quarter','New','Renewal'],rows:[['Q1',40,60],['Q2',55,70],['Q3',60,90]]};
 for(const type of ['stacked-column','stacked-bar','stacked-area','stacked-line']){
  const doc=deck({type,data:stacked,referenceLines:[{value:200,label:'Plan'},{value:120,label:'Floor',stroke:'none'}]}),svg=toSvg(doc,1,{trace:true}),lines=refs(svg);
  assert.equal(lines.length,1,type+': the line of no width is not drawn');assert.ok(svg.includes('Plan')&&svg.includes('Floor'),type);
  const item=resolvePresentation(doc).slides[0].geometry.items.find(i=>i.field==='chart'),placed=item.chart.layer.references.lines[0],axis=item.chart.valueAxis;
  assert.ok(axis.max>=200,type);near(lines[0].x1,placed.x1);near(lines[0].y1,placed.y1);near(lines[0].x2,placed.x2);near(lines[0].y2,placed.y2);
 }
});
test('title-derived emphasis is the same with and without reference lines',()=>{
 const multi={columns:['Quarter','Enterprise','Consumer'],rows:[['Q1',10,18],['Q2',15,13],['Q3',25,20]]};
 const fills=chart=>{const svg=toSvg({design:{fontScheme:'roboto',colorScheme:'cool-horizon'},slides:[{title:'Enterprise pulled ahead',chart}]},1,{trace:true});return tags(svg,'rect').filter(a=>/^slides\.0\.chart\.data\.rows\.\d+\.\d+$/.test(a['data-opf-path']??'')).map(a=>a.fill);};
 const plain=fills({type:'column',data:multi}),withReference=fills({type:'column',data:multi,referenceLines:[{value:12,label:'Target'}]});
 assert.equal(plain.length,6);assert.deepEqual(withReference,plain);assert.ok(new Set(plain).size>1,'the title focuses one series');
 // An explicit empty highlight switches the derived emphasis off.
 const off=fills({type:'column',data:multi,highlight:{series:[]}});assert.notDeepEqual(off,plain);
});
