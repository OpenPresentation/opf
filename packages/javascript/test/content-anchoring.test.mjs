import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide,layoutQuote,layoutMetric,OPFCompositionError} from '../dist/composition.js';
const box={x:40,y:50,width:600,height:500};
const quote={text:'Keep the quote and source together.',attribution:'Example author',role:'Example role',source:'Illustrative'};
const measurement={measure:(text,size)=>[...text].length*size*.5};
const make=(anchor,flow='column',accepts=['quote','metric','text'])=>({name:'Measured',areas:['body'],columns:[1],rows:[1],regions:{body:{accepts,flow,anchor,max:flow==='none'?1:12}}});
const compose=(anchor,blocks,flow='column',extra={})=>composeSlide({blocks,...(extra.contentDirection?{design:{contentDirection:extra.contentDirection}}:{}),...(extra.minFontSize?{composition:{minFontSize:extra.minFontSize}}:{})},{width:960,height:720,layout:make(anchor,flow),textMeasurement:measurement,...extra});
test('successful quotes keep attribution immediately after measured body and include photo in compact bounds',()=>{
 for(const value of [quote,{...quote,text:[{text:'Rich words',bold:true},' remain intact.']},{...quote,photo:'person.png'}]){
  const result=layoutQuote(value,box,{textMeasurement:measurement});assert.equal(result.overflow,false);
  const body=result.parts[0],footer=result.parts[1];const bodyBottom=body.box.y+body.box.height;
  const footerTop=Math.min(footer.box.y,result.photo?.box.y??Infinity);
  assert.ok(Math.abs(footerTop-bodyBottom-18)<.01);assert.ok(result.bounds.height<box.height/2);
  for(const part of result.parts)assert.ok(part.box.y+part.box.height<=box.y+box.height);
  assert.equal(footer.text,'Example author\nExample role - Illustrative');
 }
});
test('metric occupied bounds include value and every visible metadata part without reserving the whole cell',()=>{
 const result=layoutMetric({value:52,unit:'users',label:'Trial participants',description:'Illustrative pilot',delta:3,trend:'up'},box,{textMeasurement:measurement});
 assert.equal(result.overflow,false);assert.ok(result.bounds.height<box.height);
 for(const part of result.parts.filter(p=>p.visible))assert.ok(part.box.y+part.box.height<=box.y+result.bounds.height+.01);
});
test('single and stacked quotes/metrics anchor as compact units without shrinking fonts',()=>{
 for(const blocks of [[{quote}],[{metric:{value:52,label:'Trial users'}}],[{quote},{metric:{value:52,label:'Trial users'}}]]){
  const top=compose('top',blocks),middle=compose('middle',blocks),bottom=compose('bottom',blocks);
  for(const result of [middle,bottom]){
   assert.equal(result.diagnostics.length,0);const region=result.regions[0];const first=result.items[0],last=result.items.at(-1);
   assert.ok(first.box.y>top.items[0].box.y);assert.ok(last.box.y+last.box.height<=region.box.y+region.box.height+.01);
   const occupiedBottom=last.box.y+last.box.height;
   if(result===middle)assert.ok(Math.abs((first.box.y+occupiedBottom)/2-(region.box.y+region.box.height/2))<.01);
   else assert.ok(Math.abs(occupiedBottom-region.box.y-region.box.height)<.01);
   for(let i=0;i<result.items.length;i++){const internal=result.items[i].quoteLayout??result.items[i].metricLayout;const original=top.items[i].quoteLayout??top.items[i].metricLayout;assert.deepEqual(internal.parts.map(p=>p.fit.fontSize),original.parts.map(p=>p.fit.fontSize));}
  }
 }
});
test('grid anchors each measured cell, including one-item flow none, while charts and tables retain allocation',()=>{
 for(const flow of ['none','grid']){
  const blocks=flow==='none'?[{quote}]:[{quote},{metric:{value:52,label:'Trial users'}}];
  const top=compose('top',blocks,flow),middle=compose('middle',blocks,flow);assert.equal(middle.diagnostics.length,0);
  middle.items.forEach((item,i)=>{assert.ok(item.box.y>top.items[i].box.y);});
 }
 for(const field of ['chart','table']){
  const value=field==='chart'?{type:'column',data:{columns:['x','y'],rows:[['a',1]]}}:{columns:['x'],rows:[['a']]};
  const options={width:960,height:720,textMeasurement:measurement};
  const top=composeSlide({blocks:[{[field]:value}]},{...options,layout:make('top','column',[field])});
  const middle=composeSlide({blocks:[{[field]:value}]},{...options,layout:make('middle','column',[field])});assert.deepEqual(middle.items.map(i=>i.box),top.items.map(i=>i.box));
 }
});
test('strict quote overflow still refuses and complete text survives failed compact fitting',()=>{
 const value={text:'Long quoted words '.repeat(200),attribution:'Retained author'};
 const failed=layoutQuote(value,{x:0,y:0,width:100,height:80});assert.equal(failed.overflow,true);assert.equal(failed.parts[0].text,`"${value.text}"`);
 assert.throws(()=>layoutQuote(value,{x:0,y:0,width:100,height:80},{overflow:'error'}),OPFCompositionError);
});

test('six metrics share value and label baselines within two grid rows despite unequal descriptions',()=>{
 const blocks=Array.from({length:6},(_,i)=>({metric:{value:String(i+1),label:'Pilot '+(i+1),description:i%3===0?'Short.':i%3===1?'Two lines of supporting detail for this pilot.':'More supporting detail that wraps into additional lines for this illustrative pilot.'}}));
 const top=compose('top',blocks,'grid'),middle=compose('middle',blocks,'grid'),bottom=compose('bottom',blocks,'grid');
 const rows=new Map();top.items.forEach((item,i)=>{const indices=rows.get(item.box.y)??[];indices.push(i);rows.set(item.box.y,indices);});assert.equal(rows.size,2);
 for(const result of [middle,bottom]){
  assert.equal(result.diagnostics.length,0);
  for(const indices of rows.values())for(const role of ['value','label']){
   const baselines=indices.map(i=>result.items[i].metricLayout.parts.find(p=>p.role===role).linePositions[0].baseline);
   assert.ok(baselines.every(y=>Math.abs(y-baselines[0])<.01));
  }
  result.items.forEach((item,i)=>{assert.deepEqual(item.metricLayout.parts.map(p=>p.fit.fontSize),top.items[i].metricLayout.parts.map(p=>p.fit.fontSize));assert.ok(item.metricLayout.bounds.height<=item.box.height+.01);});
 }
});
test('explicit readability floor and card insets remain respected by anchored quote and metric fits',()=>{
 for(const flow of ['column','grid']){
  const result=compose('middle',[{quote},{metric:{value:52,label:'Trial users'}}],flow,{minFontSize:24,contentBox:true});
  assert.equal(result.diagnostics.length,0);
  for(const item of result.items){const internal=item.quoteLayout??item.metricLayout;assert.ok(internal.parts.every(p=>p.fit.fontSize>=24));assert.ok(internal.bounds.y+internal.bounds.height<=item.box.y+item.box.height+.01);assert.ok(item.box.y>=item.frameBox.y);assert.ok(item.box.y+item.box.height<=item.frameBox.y+item.frameBox.height+.01);}
 }
});

test('horizontal content direction retains shared-row anchoring for grid regions',()=>{
 const blocks=[{metric:{value:1,label:'First',description:'Short'}},{metric:{value:2,label:'Second',description:'A longer supporting description that takes more lines'}}];
 const top=compose('top',blocks,'grid',{contentDirection:'horizontal'}),middle=compose('middle',blocks,'grid',{contentDirection:'horizontal'});
 assert.equal(middle.regions[0].arrangement,'row');assert.equal(middle.diagnostics.length,0);
 assert.ok(middle.items[0].box.y>top.items[0].box.y);assert.ok(Math.abs(middle.items[0].box.y-middle.items[1].box.y)<.01);
 for(const role of ['value','label'])assert.ok(Math.abs(middle.items[0].metricLayout.parts.find(p=>p.role===role).linePositions[0].baseline-middle.items[1].metricLayout.parts.find(p=>p.role===role).linePositions[0].baseline)<.01);
});
