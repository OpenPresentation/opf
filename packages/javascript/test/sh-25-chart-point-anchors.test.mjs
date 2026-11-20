import assert from 'node:assert/strict';
import test from 'node:test';
import {overlayIssues,composeSlide}from'../dist/composition.js';
import {validate}from'../dist/index.js';
const chart={type:'column',data:{columns:['Country','Cost ($B)','Other'],rows:[['United States',20,30],['France',8,15]]}};
const slide=at=>({blocks:[{id:'costs',chart}],shapes:[{shape:'ellipse',fill:'none',at:{block:'costs',edge:'end',widthPx:80,heightPx:80,...at}}]});
const issues=(at,value=slide(at))=>overlayIssues(value,'/slides/0');
test('point references accept exact unique labels or zero-based indexes, with an omitted first series',()=>{
 for(const at of [{point:'United States'},{point:0,series:0},{point:'France',series:'Other'},{point:1,series:1}]){
  const value=slide(at);assert.equal(validate({slides:[value]},{only:['format']}).valid,true);assert.deepEqual(overlayIssues(value,'/slides/0'),[]);
 }
 for(const at of [{series:0},{point:-1},{point:1.5},{point:null},{point:''},{point:0,series:-1}])assert.equal(validate({slides:[slide(at)]},{only:['format']}).valid,false);
});
test('missing, duplicate and unplotted identities report the existing located missing-anchor code',()=>{
 for(const [at,path]of [[{point:'missing'},'point'],[{point:50},'point'],[{point:0,series:'missing'},'series']]){
  const found=issues(at);assert.equal(found.length,1);assert.equal(found[0].code,'shape-anchor-missing');assert.equal(found[0].path,`/slides/0/shapes/0/at/${path}`);
 }
 const duplicate=slide({point:'United States'});duplicate.blocks[0].chart=structuredClone(chart);duplicate.blocks[0].chart.data.rows[1][0]='United States';assert.match(issues({},duplicate)[0].message,/ambiguous/);duplicate.shapes[0].at.point=1;assert.deepEqual(issues({},duplicate),[]);
 const missing=slide({point:0});missing.blocks[0].chart=structuredClone(chart);missing.blocks[0].chart.data.rows[0][1]=null;assert.match(issues({},missing)[0].message,/no visible/);
 const unsupported=slide({point:0});unsupported.blocks[0].chart={...chart,type:'waterfall'};assert.match(issues({},unsupported)[0].message,/no qualified/);
});
test('ordinary block anchors retain their findings and inline negative pie values remain plotted',()=>{
 assert.deepEqual(issues({}),[]);
 const pie=slide({point:0});pie.blocks[0].chart={type:'pie',data:{columns:['Category','Value'],rows:[['Loss',-20],['Gain',30]]}};assert.deepEqual(issues({},pie),[]);
 const wrong=slide({point:0});delete wrong.blocks[0].chart;wrong.blocks[0].text='Plain text';assert.equal(issues({},wrong)[0].code,'shape-anchor-missing');
});

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5, a+' != '+b);
const composed=(slide,options={})=>composeSlide(slide,{width:1280,height:720,...options});
test('point centers use the real shared plot, series grouping, signed endpoints and scale',()=>{
 for(const type of ['column','bar','stacked-column','stacked-bar','100pct-stacked-column','100pct-stacked-bar'])for(const direction of ['ltr','rtl'])for(const scale of [.75,1,1.5]){
  const input=slide({point:1,series:1});input.blocks[0].chart={type,data:{columns:['Country','A','B'],rows:[['US',20,-5],['FR',-8,15],['JP',10,25]]}};
  const result=composed(input,{width:1280*scale,height:720*scale,direction}),item=result.items.find(item=>item.chart),overlay=result.overlayShapes?.[0];
  assert.ok(overlay,type+direction+scale);assert.equal(result.diagnostics.filter(d=>d.code==='shape-anchor-missing').length,0);
  const point=overlay.attachedTo.chartPoint;near(overlay.box.x+overlay.box.width/2,point.position.x);near(overlay.box.y+overlay.box.height/2,point.position.y);near(overlay.box.width,80*scale);assert.ok(item.chart.layer.plot);assert.deepEqual([point.series,point.row,point.column],[1,1,2]);
  const moved=structuredClone(input);moved.blocks[0].chart.data.rows[1][2]=8;const next=composed(moved,{width:1280*scale,height:720*scale,direction}).overlayShapes[0];assert.notDeepEqual(next.box,overlay.box,'data edits re-anchor');
 }
});
test('marker, scatter and arc points are shared/pinned, offsets follow the point normal',()=>{
 for(const type of ['line','line-with-markers','stacked-line','area','stacked-area','100pct-stacked-area','scatter','pie','doughnut']){
  const input=slide({point:1,series:0,offset:8});input.blocks[0].chart={type,data:{columns:['Category','A','B'],rows:[['First',10,20],['Second',25,8],['Third',15,25]]}};
  const result=composed(input),overlay=result.overlayShapes?.[0];assert.ok(overlay,type);const point=overlay.attachedTo.chartPoint;near(overlay.box.x+40,point.position.x+8*point.normal.x);near(overlay.box.y+40,point.position.y+8*point.normal.y);const layer=result.items.find(item=>item.chart).chart.layer;assert.ok(layer.plot??layer.doughnut?.pie??layer.valueList?.pie,type+': the point lies on a plot both engines draw');
 }
});
test('a missing runtime point is omitted with a located finding and does not pin an ordinary chart',()=>{
 const input=slide({point:'missing'}),plain=composed({...input,shapes:[]}),result=composed(input);assert.equal(result.overlayShapes,undefined);assert.deepEqual(result.items,plain.items);assert.equal(result.diagnostics.find(d=>d.code==='shape-anchor-missing').path,'slides.0.shapes.0.at.point');
 const findings=validate({language:'en-US',slides:[input]}).findings;assert.ok(findings.some(f=>f.ruleId==='opf/shape-anchor-missing'));
});
