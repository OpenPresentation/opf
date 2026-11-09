import assert from 'node:assert/strict';
import {test} from 'node:test';
import {chartReferences,placeReferences,chartValueAxis,chartComboAxes,chartAxisScale,composeSlide,resolveChartData} from '../dist/composition.js';
import {check,errorsOf,warningsOf} from './support/validation.mjs';
const data={columns:['Quarter','Actual'],rows:[['Q1',10],['Q2',20],['Q3',30]]};
const chart=(extra={})=>({type:'line',data,...extra});
const deck=c=>({slides:[{chart:c}]});
const geometry={width:900,height:500,scale:1};
const box={x:100,y:50,width:900,height:500},inset={left:80,top:50,right:40,bottom:60};
const measure=(text,size)=>text.length*size*0.5;
const place=(c,opts={})=>{const d=resolveChartData(c);return placeReferences(chartReferences(c),d,{value:chartValueAxis(c,d,geometry),...opts.axes},box,inset,{scale:1,measure,...opts});};
test('schema: clustered, stacked and combo types, optional empty array, finite values, labels, styles and located axis errors',()=>{
 for(const type of ['column','bar','line','line-with-markers','area','combo','stacked-column','stacked-bar','stacked-line','stacked-line-with-markers','stacked-area'])assert.deepEqual(errorsOf(check(deck(chart({type,referenceLines:[{value:25,label:'Target',stroke:{color:{color:'accent1',lighten:0.2},width:64,dash:'dot'}}]})))),[],type);
 for(const referenceLines of [undefined,[]])assert.deepEqual(errorsOf(check(deck(chart({type:'pie',referenceLines})))),[]);
 for(const referenceLines of [[{value:'25'}],[{value:NaN}],[{value:Infinity}],[{}],[{value:25,label:''}],[{value:25,label:'  '}],[{value:25,labelPosition:'start'}],[{value:25,stroke:{width:-1}}],[{value:25,stroke:{width:65}}],[{value:25,stroke:{dash:'dashed'}}],[{value:25,axis:'primary'}]])assert.ok(errorsOf(check(deck(chart({referenceLines})))).length,JSON.stringify(referenceLines));
 // An unsupported type is one located error that names the property and the types that can draw it, never a silent drop.
 for(const type of ['pie','100pct-stacked-column','scatter','histogram','radar']){
  const found=errorsOf(check(deck(chart({type,referenceLines:[{value:25}]}))));
  assert.equal(found.length,1,type+JSON.stringify(found));assert.equal(found[0].ruleId,'opf/chart-reference-unsupported-type');assert.equal(found[0].path,'/slides/0/chart/referenceLines');
  assert.match(found[0].message,new RegExp(`a '${type}' chart has none`));assert.match(found[0].message,/stacked-column/);
 }
 // 'none' and an empty object are lines; a line is not a shape outline.
 for(const stroke of ['none',{},{width:0}])assert.deepEqual(errorsOf(check(deck(chart({referenceLines:[{value:25,label:'Plan',stroke}]})))),[],JSON.stringify(stroke));
 for(const stroke of ['hidden',{dash:'longDash'},{cap:'round'}])assert.ok(errorsOf(check(deck(chart({referenceLines:[{value:25,stroke}]})))).length,JSON.stringify(stroke));
 const bad=errorsOf(check(deck(chart({referenceLines:[{value:25,axis:'secondary'}]}))));
 assert.ok(bad.some(f=>f.ruleId==='opf/chart-reference-axis-unavailable'&&JSON.stringify(f).includes('/slides/0/chart/referenceLines/0/axis')),JSON.stringify(bad));
 const missing=warningsOf(check({...deck(chart({referenceLines:[{value:25,stroke:{color:'var:missing'}}]})),variables:{}},{only:['format','references']}));
 assert.ok(missing.some(f=>f.ruleId==='opf/variable-reference-unknown'&&JSON.stringify(f).includes('/stroke/color')));
});
test('normalization retains ordered duplicate/data-equal values, defaults and width zero',()=>{
 const c=chart({referenceLines:[{value:20},{value:20,label:'Second',stroke:{width:0}},{value:-1000,label:'Low',stroke:{color:'accent2',width:3,dash:'solid'}}]});
 const refs=chartReferences(c);assert.equal(refs.length,3);assert.deepEqual(refs.map(r=>r.value),[20,20,-1000]);
 assert.deepEqual(refs[0],{value:20,axis:'value',labelPosition:'end',stroke:{width:4/3,dash:'dash'}});
 const result=place(c);assert.equal(result.lines.length,3);assert.equal(result.lines[1].strokeWidth,0);assert.equal(result.lines[1].label,'Second');
 assert.ok(chartValueAxis(c,resolveChartData(c),geometry).min<=-1000);
 assert.equal(place(chart()),undefined);
});
test('all explicit values expand own-axis bounds; percentages are raw units without clamping or label inference',()=>{
 const c=chart({type:'combo',data:{columns:['Quarter','Revenue',{name:'Margin',format:'0%'}],rows:[['Q1',100,.2],['Q2',200,.3],['Q3',300,.4]]},line:['Margin'],secondaryAxis:['Margin'],referenceLines:[{value:-50},{value:1000},{value:1.25,axis:'secondary',label:'125%'},{value:-.2,axis:'secondary',label:'-20%'}]});
 const resolved=resolveChartData(c),axes=chartComboAxes(c,resolved,geometry);assert.ok(axes.value.min<=-50&&axes.value.max>=1000);assert.ok(axes.secondary.min<=-.2&&axes.secondary.max>=1.25);assert.ok(axes.secondary.max<10);
 const primaryOnly=chartComboAxes({...c,referenceLines:[{value:5000}]},resolved,geometry);assert.deepEqual(primaryOnly.secondary,chartComboAxes({...c,referenceLines:[]},resolved,geometry).secondary);
 const secondaryOnly=chartComboAxes({...c,referenceLines:[{value:2,axis:'secondary'}]},resolved,geometry);assert.deepEqual(secondaryOnly.value,chartComboAxes({...c,referenceLines:[]},resolved,geometry).value);
 const pct=chart({data:{columns:['Q',{name:'Rate',format:'0%'}],rows:[['Q1',.4],['Q2',.5]]},referenceLines:[{value:.25,label:'25%'},{value:25,label:'A literal 25 units'}]});assert.deepEqual(chartReferences(pct).map(r=>r.value),[.25,25]);assert.ok(chartValueAxis(pct,resolveChartData(pct),geometry).max>=25);
});
test('null-only valid data still includes explicit bounds and combo zero anchoring follows only bars on the same axis',()=>{
 const c=chart({data:{columns:data.columns,rows:[['Q1',null],['Q2',null]]},referenceLines:[{value:200}]});assert.deepEqual(errorsOf(check(deck(c))),[]);assert.ok(chartValueAxis(c,resolveChartData(c),geometry).max>=200);
 const combo=chart({type:'combo',data:{columns:['Quarter','Amount','Rate'],rows:[['Q1',1000,101],['Q2',2000,102]]},line:['Rate'],secondaryAxis:['Rate']});const resolved=resolveChartData(combo);const axes=chartComboAxes(combo,resolved,geometry);assert.equal(axes.value.min,0);assert.ok(axes.secondary.min>0);
 const invalid=chart({...combo,line:['Amount'],secondaryAxis:['Rate'],referenceLines:[{value:10,axis:'secondary'}]});assert.ok(errorsOf(check(deck(invalid))).length,'secondary bars are rejected by the current format');
 const defensive={...resolved,combo:resolved.combo.map(e=>({...e,axis:e.axis==='primary'?'secondary':'primary'}))};const defensiveAxes=chartComboAxes(combo,defensive,geometry);assert.equal(defensiveAxes.secondary.min,0);assert.ok(defensiveAxes.value.min>0);
});
test('native span matches category centers; horizontal and singleton references span full plot',()=>{
 const c=chart({referenceLines:[{value:20,label:'End'},{value:25,label:'Start',labelPosition:'start'}]});
 const result=place(c);const [end,start]=result.lines;assert.equal(end.x1,310);assert.equal(end.x2,830);assert.equal(end.native,true);assert.equal(end.endpoint,2);assert.equal(start.endpoint,0);
 assert.ok(end.labelBox.x>start.labelBox.x);
 const rtl=place(c,{direction:'rtl'});assert.ok(rtl.lines[0].labelBox.x<rtl.lines[1].labelBox.x);assert.equal(rtl.lines[0].endpoint,2);
 const bar=place({...c,type:'bar'},{horizontal:true});assert.equal(bar.lines[0].native,false);assert.equal(bar.lines[0].y1,100);assert.equal(bar.lines[0].y2,490);assert.equal(bar.lines[0].x1,bar.lines[0].x2);
 const single=place({...c,data:{columns:data.columns,rows:[data.rows[0]]}});assert.equal(single.lines[0].native,false);assert.equal(single.lines[0].x1,180);assert.equal(single.lines[0].x2,960);assert.equal(single.lines[0].labelAlign,'right');assert.equal(single.lines[1].labelAlign,'left');assert.ok(single.lines.every(r=>r.labelBox.x>=box.x&&r.labelBox.x+r.labelBox.width<=box.x+box.width));
});
test('labels use opposite adjacent side before diagnosing unresolved collisions, without dropping text or numeric lines',()=>{
 const c=chart({referenceLines:Array.from({length:3},()=>({value:20,label:'Same'}))});const result=place(c);assert.equal(result.lines[0].labelSide,'above');assert.equal(result.lines[1].labelSide,'below');assert.equal(result.lines[2].labelSide,'above');assert.ok(result.diagnostics.some(f=>f.code==='chart-reference-label-collision'));assert.equal(result.lines.length,3);assert.equal(new Set(result.lines.map(r=>r.y1)).size,1);
 const long=place(chart({referenceLines:[{value:20,label:'Long text '.repeat(200)}]}));assert.equal(long.lines[0].label.length,2000);assert.ok(long.diagnostics.some(f=>f.code==='chart-reference-label-overflow'));
});
test('titles/subtitles never synthesize lines or period bands in any language',()=>{
 for(const [language,title]of [['en','Above ninety-two percent in 2023'],['fr','au moins cinq en 2023'],['es','al menos cinco en 2023'],['de','über zweiundneunzig Prozent seit März'],['ja','定時配達率は92%を上回った']]){
  const item=composeSlide({title,subtitle:'Target 100 in 2023',chart:chart()},{width:1280,height:720,presentation:{language,slides:[]}}).items.find(i=>i.field==='chart');assert.equal(item.chart.layer?.references,undefined,title);
 }
});
test('fixed chart/data/frame keeps reference/plot/end-label geometry when prose matches a series',()=>{
 const c=chart({data:{columns:['Quarter','Enterprise','Consumer'],rows:[['Q1',10,18],['Q2',15,13],['Q3',25,20]]},referenceLines:[{value:12,label:'Target'}]});
 // Explicit layout tracks fix the chart frame while only title/subtitle prose changes.
 // The title may repaint the chart (its focus and the bold name), but the plot, the reference and every label box stay where they are.
 const compose=(title,subtitle,value=c)=>{const s=composeSlide({title,subtitle,chart:value},{width:1280,height:720,layout:{name:'Fixed chart',regions:[{name:'title',size:.2},{name:'body',size:.8,accepts:['chart'],flow:'none'}]},recompose:false,fill:false});return s.items.find(i=>i.field==='chart');};
 const snapshot=i=>({box:i.box,axis:i.chart.valueAxis,plot:i.chart.layer.plot,refs:i.chart.layer.references,ends:i.chart.layer.endLabels&&{...i.chart.layer.endLabels,entries:i.chart.layer.endLabels.entries.map(({bold:_bold,...entry})=>entry)}});
 const named=compose('Enterprise above 100','Consumer below 5 in 2023'),neutral=compose('Neutral title','Neutral subtitle');
 assert.deepEqual(snapshot(named),snapshot(neutral));
 // A reference never changes which marks a chart emphasizes: the title's focus is the one the same chart has without the reference.
 const {referenceLines:_lines,...plain}=c;
 assert.deepEqual(named.chart.layer.focus,compose('Enterprise above 100','Consumer below 5 in 2023',plain).chart.layer.focus);assert.ok(named.chart.layer.focus);assert.equal(neutral.chart.layer.focus,undefined);
 // An explicit empty highlight switches the derived emphasis off, on a chart as on a table.
 assert.equal(compose('Enterprise above 100','Consumer below 5 in 2023',{...c,highlight:{series:[]}}).chart.layer.focus,undefined);
 assert.deepEqual(errorsOf(check(deck({...c,highlight:{categories:[]}}))),[]);

});
test('sibling scale sharing includes every explicit target and refreshes line placement against final plot',()=>{
 const a=chart({referenceLines:[{value:200,label:'Target'}]}),b=chart();const items=composeSlide({blocks:[{chart:a},{chart:b}]},{width:1280,height:720}).items.filter(i=>i.field==='chart');assert.equal(items.length,2);assert.deepEqual(items[0].chart.valueAxis,items[1].chart.valueAxis);assert.ok(items[1].chart.valueAxis.max>=200);
 const line=items[0].chart.layer.references.lines[0],axis=items[0].chart.valueAxis,plot=items[0].chart.layer.plot;assert.ok(Math.abs(line.y1-(items[0].box.y+plot.top+(axis.max-200)/(axis.max-axis.min)*(items[0].box.height-plot.top-plot.bottom)))<1e-6);
});

test('table-aligned bars recompute references against final row plot and publish final label diagnostics once',()=>{
 const bars={type:'bar',data:{columns:['Product line','Cost ($K)'],rows:[['Controllers',7.4],['Pumps',3.3],['Valves',1.3],['Sensors',.7]]},referenceLines:[{value:5,label:'Target'}]},table={columns:['Product line','Claims per 1,000','Main cause'],rows:[['Controllers',24,'Firmware faults'],['Pumps',18,'Seal wear'],['Valves',11,'Corrosion'],['Sensors',7,'Calibration drift']]};
 const result=composeSlide({title:'Warranty claims by product line',blocks:[{chart:bars},{table}]},{width:1280,height:720}),item=result.items.find(i=>i.field==='chart'),rows=item.chart.layer.rows,line=item.chart.layer.references.lines[0];assert.ok(rows);assert.ok(Math.abs(line.y1-item.box.y-rows.top)<1e-6);assert.ok(Math.abs(line.y2-item.box.y-rows.bottom)<1e-6);assert.equal(item.chart.layer.plot.left,rows.left);
 const overflow=composeSlide({blocks:[{chart:chart({referenceLines:[{value:20,label:'Very long label '.repeat(100)}]})},{chart:chart()}]},{width:1280,height:720});for(const item of overflow.items.filter(i=>i.field==='chart'&&i.chart.layer.references)){const actual=overflow.diagnostics.filter(d=>d.path.startsWith(item.path+'.referenceLines.'));assert.equal(actual.length,item.chart.layer.references.diagnostics.length);}
});

test('reference labels choose the other adjacent side when an ordinary data line crosses the preferred box',()=>{
 const c=chart({referenceLines:[{value:28,label:'Target'}]});const placed=place(c);assert.equal(placed.lines[0].labelSide,'below');assert.equal(placed.diagnostics.length,0);
});

test('wide reference strokes leave their own labels clear without moving numeric lines',()=>{
 const c=chart({referenceLines:[{value:20,label:'Target',stroke:{width:64}}]}),line=place(c).lines[0];assert.ok(line.labelBox.y+line.labelBox.height<=line.y1-line.strokeWidth/2);assert.equal(line.y1,line.y2);
 const bar=place({...c,type:'bar'},{horizontal:true}).lines[0];assert.ok(bar.labelBox.x>=bar.x1+bar.strokeWidth/2);assert.equal(bar.x1,bar.x2);
 const hidden=place(chart({referenceLines:[{value:20,label:'Target',stroke:{width:0}}]})).lines[0];assert.ok(hidden.labelBox);assert.equal(hidden.strokeWidth,0);assert.equal(hidden.y1,line.y1);
});

test('finite endpoint references survive real composition on every supported chart and own combo axis',()=>{
 for(const value of [-Number.MAX_VALUE,Number.MAX_VALUE])assert.deepEqual(errorsOf(check(deck(chart({referenceLines:[{value}]})))),[]);
 for(const type of ['column','bar','line','line-with-markers','area','combo'])for(const values of [[Number.MAX_VALUE],[-Number.MAX_VALUE],[-Number.MAX_VALUE,Number.MAX_VALUE]]){
  const c=chart({type,...(type==='combo'?{data:{columns:['Q','Amount','Rate'],rows:[['Q1',1,.2],['Q2',2,.3]]},line:['Rate'],secondaryAxis:['Rate']}:{}),referenceLines:values.map(value=>({value,label:'Target'}))});
  const item=composeSlide({chart:c},{width:1280,height:720}).items.find(i=>i.field==='chart');
  assert.equal(item.chart.layer.references.lines.length,values.length,type+' '+values);
  const axis=item.chart.valueAxis;assert.ok(axis.min<=Math.min(...values)&&axis.max>=Math.max(...values));
  assert.ok(item.chart.layer.references.lines.flatMap(l=>[l.x1,l.y1,l.x2,l.y2,...Object.values(l.labelBox??{})]).every(Number.isFinite));
  const ticks=chartAxisScale(axis).ticks;assert.ok(ticks.length>1&&ticks.length<=1001&&ticks.every(Number.isFinite));
 }
 const c=chart({type:'combo',data:{columns:['Q','Amount','Rate'],rows:[['Q1',1,.2],['Q2',2,.3]]},line:['Rate'],secondaryAxis:['Rate'],referenceLines:[{value:-Number.MAX_VALUE,axis:'secondary'},{value:Number.MAX_VALUE,axis:'secondary'}]});
 const item=composeSlide({chart:c},{width:1280,height:720}).items.find(i=>i.field==='chart');assert.equal(item.chart.layer.references.lines.length,2);assert.equal(item.chart.secondaryValueAxis.min,-Number.MAX_VALUE);assert.equal(item.chart.secondaryValueAxis.max,Number.MAX_VALUE);assert.ok(item.chart.valueAxis.max<10);
 const siblings=composeSlide({blocks:[{chart:chart({referenceLines:[{value:-Number.MAX_VALUE},{value:Number.MAX_VALUE}]})},{chart:chart()}]},{width:1280,height:720}).items.filter(i=>i.field==='chart');assert.deepEqual(siblings[0].chart.valueAxis,siblings[1].chart.valueAxis);assert.equal(siblings[0].chart.layer.references.lines.length,2);
});

test('shared axis reconstruction keeps ordinary ticks and bounds overflow-sized tick work',()=>{
 assert.deepEqual(chartAxisScale({min:0,max:45,majorUnit:10}),{min:0,max:45,step:10,ticks:[0,10,20,30,40]});
 const scale=chartAxisScale({min:-Number.MAX_VALUE,max:Number.MAX_VALUE,majorUnit:1e308});assert.equal(scale.ticks.length,4);assert.ok(scale.ticks.every(Number.isFinite));assert.ok(scale.ticks.every((v,i)=>i===0||v>scale.ticks[i-1]));
 assert.equal(chartAxisScale({min:0,max:2000,majorUnit:1}),undefined);assert.equal(chartAxisScale({min:0,max:1,majorUnit:0}),undefined);assert.equal(chartAxisScale({min:0,max:Infinity,majorUnit:1}),undefined);
});

test('a bar chart with chart options still draws its references, in the plot the options leave',()=>{
 const base={type:'bar',data:{columns:['Region','Bookings'],rows:[['North America',42],['EMEA',31],['APAC',18]]},referenceLines:[{value:35,label:'Plan'}]};
 const lines=extra=>{const item=composeSlide({title:'Bookings by region',chart:{...base,...extra}},{width:1280,height:720}).items.find(i=>i.field==='chart');return {item,lines:item.chart.layer?.references?.lines??[]};};
 const plain=lines({});assert.equal(plain.lines.length,1);
 for(const extra of [{legend:'bottom'},{legend:'top'},{legend:'left'},{legend:'right'},{legend:'none'},{dataLabels:true},{dataLabels:false},{axisTitles:{value:'USD m'}},{axisTitles:{category:'Region',value:'USD m'}},{legend:'bottom',dataLabels:true,axisTitles:{value:'USD m'}}]){
  const {item,lines:placed}=lines(extra),label=JSON.stringify(extra);
  assert.equal(placed.length,1,label);const [line]=placed,plot=item.chart.layer.plot;assert.ok(plot,label);
  // A vertical line across the pinned plot, inside the chart box, with its label.
  assert.equal(line.x1,line.x2,label);assert.ok(Math.abs(line.y1-(item.box.y+plot.top))<1e-6&&Math.abs(line.y2-(item.box.y+item.box.height-plot.bottom))<1e-6,label);
  assert.ok(line.x1>item.box.x+plot.left&&line.x1<item.box.x+item.box.width-plot.right,label);assert.equal(line.label,'Plan');assert.ok(line.labelBox,label);
 }
 // A legend takes its band off the plot on the side it is on.
 const bottom=lines({legend:'bottom'}).item.chart.layer.plot,left=lines({legend:'left'}).item.chart.layer.plot,none=lines({legend:'none'}).item.chart.layer.plot;
 assert.ok(bottom.bottom>none.bottom);assert.ok(left.left>none.left);
});
test('stacked charts take references on the stack total, drawn over the chart rather than as a native helper series',()=>{
 const stackedData={columns:['Quarter','New','Renewal'],rows:[['Q1',40,60],['Q2',55,70],['Q3',60,90]]};
 for(const type of ['stacked-column','stacked-bar','stacked-line','stacked-line-with-markers','stacked-area']){
  const c={type,data:stackedData,referenceLines:[{value:200,label:'Plan'},{value:120}]};
  assert.deepEqual(errorsOf(check(deck(c))),[],type);
  const item=composeSlide({title:'Bookings',chart:c},{width:1280,height:720}).items.find(i=>i.field==='chart'),refs=item.chart.layer?.references;
  assert.equal(refs?.lines.length,2,type);assert.ok(item.chart.valueAxis.max>=200,type);
  assert.ok(refs.lines.every(line=>line.native===false),type);
  const horizontal=type==='stacked-bar';for(const line of refs.lines)assert.equal(horizontal?line.x1===line.x2:line.y1===line.y2,true,type);
  // With options the plot is laid out for the references as well.
  const optioned=composeSlide({title:'Bookings',chart:{...c,legend:'bottom'}},{width:1280,height:720}).items.find(i=>i.field==='chart');assert.equal(optioned.chart.layer?.references?.lines.length,2,type+' with a legend');
 }
 // A vertical stacked chart spans its category centers like a clustered one; an edge-to-edge stacked area spans the plot.
 const column=composeSlide({chart:{type:'stacked-column',data:stackedData,referenceLines:[{value:120}]}},{width:1280,height:720}).items.find(i=>i.field==='chart'),plot=column.chart.layer.plot,line=column.chart.layer.references.lines[0];
 const plotX=column.box.x+plot.left,plotWidth=column.box.width-plot.left-plot.right;assert.ok(Math.abs(line.x1-(plotX+plotWidth/6))<1e-6);assert.ok(Math.abs(line.x2-(plotX+plotWidth*5/6))<1e-6);
});
test("a stroke of 'none' keeps the value, the bounds and the label, and the authored stroke travels with the reference",()=>{
 const c=chart({referenceLines:[{value:500,label:'Stretch',stroke:'none'},{value:15,stroke:{color:'accent2'}},{value:16}]});const refs=chartReferences(c);
 assert.equal(refs[0].stroke.width,0);assert.equal(refs[0].authoredStroke,'none');assert.deepEqual(refs[1].authoredStroke,{color:'accent2'});assert.equal(Object.hasOwn(refs[2],'authoredStroke'),false);
 assert.ok(chartValueAxis(c,resolveChartData(c),geometry).max>=500);const placed=place(c);assert.equal(placed.lines[0].strokeWidth,0);assert.ok(placed.lines[0].labelBox);
});
