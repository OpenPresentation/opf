import assert from 'node:assert/strict';
import {test} from 'node:test';
import {chartReferences,placeReferences,chartValueAxis,chartComboAxes,composeSlide,resolveChartData} from '../dist/composition.js';
import {check,errorsOf,warningsOf} from './support/validation.mjs';
const data={columns:['Quarter','Actual'],rows:[['Q1',10],['Q2',20],['Q3',30]]};
const chart=(extra={})=>({type:'line',data,...extra});
const deck=c=>({slides:[{chart:c}]});
const geometry={width:900,height:500,scale:1};
const box={x:100,y:50,width:900,height:500},inset={left:80,top:50,right:40,bottom:60};
const measure=(text,size)=>text.length*size*0.5;
const place=(c,opts={})=>{const d=resolveChartData(c);return placeReferences(chartReferences(c),d,{value:chartValueAxis(c,d,geometry),...opts.axes},box,inset,{scale:1,measure,...opts});};
test('schema: six types, optional empty array, finite values, labels, styles and located axis errors',()=>{
 for(const type of ['column','bar','line','line-with-markers','area','combo'])assert.deepEqual(errorsOf(check(deck(chart({type,referenceLines:[{value:25,label:'Target',stroke:{color:{color:'accent1',lighten:0.2},width:64,dash:'dot'}}]})))),[],type);
 for(const referenceLines of [undefined,[]])assert.deepEqual(errorsOf(check(deck(chart({type:'pie',referenceLines})))),[]);
 for(const referenceLines of [[{value:'25'}],[{value:NaN}],[{value:Infinity}],[{}],[{value:25,label:''}],[{value:25,label:'  '}],[{value:25,labelPosition:'start'}],[{value:25,stroke:{width:-1}}],[{value:25,stroke:{width:65}}],[{value:25,stroke:{dash:'dashed'}}],[{value:25,axis:'primary'}]])assert.ok(errorsOf(check(deck(chart({referenceLines})))).length,JSON.stringify(referenceLines));
 for(const type of ['pie','stacked-column','scatter','histogram'])assert.ok(errorsOf(check(deck(chart({type,referenceLines:[{value:25}]})))).length,type);
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
 const single=place({...c,data:{columns:data.columns,rows:[data.rows[0]]}});assert.equal(single.lines[0].native,false);assert.equal(single.lines[0].x1,180);assert.equal(single.lines[0].x2,960);
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
 const snapshot=(title,subtitle)=>{const s=composeSlide({title,subtitle,chart:c},{width:1280,height:720,layout:{name:'Fixed chart',regions:[{name:'title',size:.2},{name:'body',size:.8,accepts:['chart'],flow:'none'}]},recompose:false,fill:false});const i=s.items.find(i=>i.field==='chart');assert.equal(i.chart.layer.focus,undefined);return {box:i.box,axis:i.chart.valueAxis,plot:i.chart.layer.plot,refs:i.chart.layer.references,ends:i.chart.layer.endLabels};};
 assert.deepEqual(snapshot('Enterprise above 100','Consumer below 5 in 2023'),snapshot('Neutral title','Neutral subtitle'));
 const authored={...c,highlight:{series:['Enterprise']}};assert.deepEqual(authored.highlight,{series:['Enterprise']});assert.equal(chartReferences(authored).length,1);
});
test('sibling scale sharing includes every explicit target and refreshes line placement against final plot',()=>{
 const a=chart({referenceLines:[{value:200,label:'Target'}]}),b=chart();const items=composeSlide({blocks:[{chart:a},{chart:b}]},{width:1280,height:720}).items.filter(i=>i.field==='chart');assert.equal(items.length,2);assert.deepEqual(items[0].chart.valueAxis,items[1].chart.valueAxis);assert.ok(items[1].chart.valueAxis.max>=200);
 const line=items[0].chart.layer.references.lines[0],axis=items[0].chart.valueAxis,plot=items[0].chart.layer.plot;assert.ok(Math.abs(line.y1-(items[0].box.y+plot.top+(axis.max-200)/(axis.max-axis.min)*(items[0].box.height-plot.top-plot.bottom)))<1e-6);
});
