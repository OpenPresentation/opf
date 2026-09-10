import assert from 'node:assert/strict';
import {test} from 'node:test';
import {layoutMetric,OPFCompositionError} from '../dist/composition.js';
import {layoutMetric as rootLayoutMetric} from '../dist/index.js';

const box={x:40,y:60,width:800,height:400};
const restored=part=>part.fit.sourceLines.map(line=>part.text.slice(line.start,line.nextStart)).join('');
function sourceIsComplete(result) {
  for(const part of result.parts) {
    assert.equal(part.text,String(part.sources[0].value));
    assert.deepEqual(part.sources.map(({path,start,end})=>({path,start,end})),[{path:part.path,start:0,end:part.text.length}]);
    if(part.fit) {
      assert.equal(restored(part),part.text);
      assert.deepEqual(part.fit.lines,part.fit.sourceLines.map(line=>part.text.slice(line.start,line.end)));
      for(const line of part.fit.sourceLines)assert.equal(line.segments.map(segment=>part.text.slice(segment.start,segment.end)).join(''),part.text.slice(line.start,line.end));
      assert.ok(part.fit.fontSize>=part.minFontSize);
    }
  }
}

test('metric value, unit, labels, zero delta and trend retain their own editable source paths',()=>{
  const value=Object.freeze({value:42,unit:'ms',label:'Latency',description:'  Exact  supporting context\r\nretained. ',delta:0,trend:'flat'});
  const result=layoutMetric(value,box,{path:'slides.2.left.metric'});
  assert.deepEqual(rootLayoutMetric(value,box,{path:'slides.2.left.metric'}),result);
  assert.equal(result.algorithm,'metric-flow-v1');assert.equal(result.overflow,false);
  assert.equal(result.textMeasurement,'estimated');
  assert.deepEqual(Object.fromEntries(result.parts.map(part=>[part.role,part.sources[0].value])),value);
  assert.equal(result.parts.find(part=>part.role==='delta').text,'0');
  assert.ok(result.parts.every(part=>part.visible&&part.path==='slides.2.left.metric.'+part.role));
  sourceIsComplete(result);
  for(const scalar of [0,-12.5,'0','  42  ','42\r\npercent']) {
    const single=layoutMetric(scalar,box,{path:'slides.1.metric'});
    assert.equal(single.parts.length,1);assert.equal(single.parts[0].path,'slides.1.metric');
    assert.equal(single.parts[0].sources[0].value,scalar);sourceIsComplete(single);
  }
});

test('short units stay next to the value on the same baseline; long units and values stack',()=>{
  const result=layoutMetric({value:42,unit:'ms',label:'Latency'},box);
  assert.equal(result.arrangement,'inline-unit');
  const [value,unit]=result.parts;
  assert.ok(Math.abs(value.box.y+value.fit.fontSize-unit.box.y-unit.fit.fontSize)<1e-8);
  assert.ok(unit.box.x-value.box.x<box.width/2,'Unit follows the actual value, not the far cell edge');
  assert.equal(unit.box.x,value.box.x+value.box.width+8);
  for(const metric of [{value:42,unit:'milliseconds across all production requests'}, {value:'A long primary value '.repeat(6),unit:'ms'}]) {
    const stacked=layoutMetric(metric,box);
    assert.equal(stacked.arrangement,'stacked');assert.equal(stacked.overflow,false);
    assert.equal(stacked.parts[1].box.y,stacked.parts[0].box.y+stacked.parts[0].box.height+12);
    sourceIsComplete(stacked);
  }
});

test('inline fitting tries a smaller single-line value before rejecting a compact readable metric',()=>{
  const metric={value:'1234567890',unit:'ms',label:'L'},cell={x:0,y:0,width:104,height:72};
  const result=layoutMetric(metric,cell,{minFontSize:16,overflow:'error',textMeasurement:{measure:(text,size)=>text.length*size*.5}});
  assert.equal(result.overflow,false);assert.equal(result.arrangement,'inline-unit');
  assert.deepEqual(result.parts[0].fit.lines,['1234567890']);assert.equal(result.parts[0].fit.fontSize,16);
  for(const part of result.parts)assert.ok(part.box.y+part.box.height<=cell.height);
  sourceIsComplete(result);
});

test('metric alignment positions the inline pair together and records exact origins for every source line',()=>{
  const cell={x:17,y:23,width:400,height:300};
  const metric={value:1,unit:'%',label:'First\nSecond line'};
  const measurement={measure:(text,size)=>text.length*size*.5};
  for(const align of ['left','center','right']) {
    const layout=layoutMetric(metric,cell,{align,textMeasurement:measurement}),factor=align==='center'?.5:align==='right'?1:0;
    assert.equal(layout.alignment,align);assert.equal(layout.overflow,false);
    const [value,unit,label]=layout.parts;
    const width=value.fit.sourceLines[0].width;
    assert.equal(value.box.width,width,'A narrow digit does not reserve an extra font-size-wide gap');
    assert.equal(unit.box.x,value.box.x+width+8);
    assert.equal(value.linePositions[0].baseline,unit.linePositions[0].baseline);
    assert.equal(value.box.x,cell.x+(cell.width-width-8-unit.box.width)*factor);
    for(const part of [value,unit,label])for(const [index,line] of part.fit.sourceLines.entries()) {
      assert.equal(part.linePositions[index].x,part.box.x+(part.box.width-line.width)*factor);
      assert.equal(part.linePositions[index].baseline,part.box.y+part.fit.fontSize+index*part.fit.lineHeight);
    }
    sourceIsComplete(layout);
  }
  assert.throws(()=>layoutMetric(metric,cell,{align:'justify'}),RangeError);
});

test('metadata borrows spare primary space before reducing type and exposes resolved style paths',()=>{
  const seen=[];
  const options={fonts:{heading:'Requested Heading',body:'Requested Body'},textMeasurement:{
    resolveStyle:style=>({...style,fontFamily:style.fontFamily.replace('Requested','Resolved')}),
    measure:(text,size,style)=>{seen.push(style);return [...text].length*size*.5;},
  }};
  const value={value:42,label:'Long label '.repeat(50)};
  const result=layoutMetric(value,box,options);
  assert.equal(result.overflow,false);assert.equal(result.textMeasurement,'provided');
  const primary=result.parts[0],label=result.parts[1];
  assert.equal(primary.fit.fontSize,primary.requestedFontSize);assert.equal(label.fit.fontSize,label.requestedFontSize);
  assert.ok(label.box.y<box.y+box.height*.45);assert.ok(label.box.height>box.height*.55);
  assert.ok(result.parts.every(part=>part.requestedStyle.fontFamily.startsWith('Requested ')&&part.style.fontFamily.startsWith('Resolved ')));
  assert.ok(seen.some(style=>style.path==='metric.value'&&style.fontWeight===800));
  assert.ok(seen.some(style=>style.path==='metric.label'&&style.fontWeight===500));
});

test('explicit readability floors raise nominal labels and remain invariant across canvas scales',()=>{
  const metric={value:42,unit:'ms',label:'Latency',description:'Complete source',delta:-4.2,trend:'down'};
  const reference=layoutMetric(metric,{x:20,y:40,width:800,height:600},{minFontSize:32});
  assert.equal(reference.overflow,false);
  for(const scale of [.01,.75,1,1.5,100]) {
    const result=layoutMetric(metric,{x:20*scale,y:40*scale,width:800*scale,height:600*scale},{scale,minFontSize:32});
    assert.equal(result.overflow,false);assert.equal(result.arrangement,reference.arrangement);
    for(const [index,part] of result.parts.entries()) {
      assert.ok(part.requestedFontSize>=32*scale);assert.ok(part.fit.fontSize>=32*scale);
      assert.deepEqual(part.fit.lines,reference.parts[index].fit.lines);
      for(const key of ['x','y','width','height'])assert.ok(Math.abs(part.box[key]/scale-reference.parts[index].box[key])<1e-7,key);
    }
  }
});

test('irreducible metadata retains all source and strict rejection reports its actual path',()=>{
  const metric={value:42,unit:'ms',label:'Long supporting label. '.repeat(100),delta:0,trend:'flat'};
  const cell={x:0,y:0,width:300,height:180};
  const options={path:'slides.0.blocks.2.metric',minFontSize:32};
  const result=layoutMetric(metric,cell,options);
  assert.equal(result.overflow,true);sourceIsComplete(result);
  assert.ok(result.diagnostics.some(d=>d.path.endsWith('.label')));
  assert.ok(result.parts.find(part=>part.role==='label').fit.fontSize>=32);
  assert.equal(result.parts.find(part=>part.role==='label').text,metric.label);
  assert.throws(()=>layoutMetric(metric,cell,{...options,overflow:'error'}),error=>{
    assert.ok(error instanceof OPFCompositionError);assert.deepEqual(error.diagnostics,result.diagnostics);return true;
  });
});

test('empty optional fields retain source without blank spacing and an empty value stays targetable',()=>{
  const metric={value:'',unit:'',label:'',description:'',delta:'',trend:'flat'};
  const result=layoutMetric(metric,box);
  assert.equal(result.overflow,false);assert.equal(result.parts.length,6);
  for(const part of result.parts.filter(part=>!part.visible)) {
    assert.equal(part.text,'');assert.equal(part.box.height,0);assert.deepEqual(part.fit.lines,[]);
  }
  assert.equal(result.parts[0].visible,true);assert.ok(result.parts[0].box.height>0);assert.ok(result.parts[0].box.width>0);
  sourceIsComplete(result);
  const noEmpty=layoutMetric({value:'',trend:'flat'},box);
  assert.deepEqual(result.parts.filter(part=>part.visible),noEmpty.parts);
});

test('metric whitespace, tabs and Unicode retain exact line and segment boundaries',()=>{
  const metric={value:'  e\u0301 👩‍🔬  42\r\n',unit:'\tms  ',label:'Original  label\n\nretained',description:'Left\tRight\rTail  ',delta:0};
  const result=layoutMetric(metric,{x:0,y:0,width:540,height:960},{minFontSize:24});
  assert.equal(result.overflow,false);sourceIsComplete(result);
  assert.ok(result.parts.some(part=>part.fit.sourceLines.some(line=>line.segments.some(segment=>segment.kind==='tab'))));
});

test('invalid input, failed measurement and non-finite geometry reject without plausible substitute fits',()=>{
  for(const value of [null,[],{},Infinity,NaN,{value:42,unit:null},{value:42,label:1},{value:42,delta:NaN},{value:42,trend:'sideways'}])assert.throws(()=>layoutMetric(value,box),TypeError);
  for(const options of [{scale:0},{scale:1e308},{minFontSize:0},{minFontSize:NaN},{minFontSize:1.7e308},{overflow:'ignore'}])assert.throws(()=>layoutMetric(42,box,options),RangeError);
  for(const cell of [{...box,width:0},{...box,x:NaN},{...box,x:1e308,width:1e308}])assert.throws(()=>layoutMetric(42,cell),RangeError);
  for(const width of [-1,NaN,Infinity])assert.throws(()=>layoutMetric(42,box,{textMeasurement:{measure:()=>width}}),RangeError);
  assert.throws(()=>layoutMetric({value:0,unit:'a',label:'b',description:'c',delta:0,trend:'flat'},
    {x:0,y:0,width:1e308,height:1e308},{minFontSize:4e307,textMeasurement:{measure:()=>1}}),RangeError);
  const tiny=layoutMetric({value:42,label:'Keep this'}, {x:0,y:0,width:1,height:1});
  assert.equal(tiny.overflow,true);assert.equal(tiny.parts[0].fit,undefined);
  assert.ok(tiny.diagnostics.some(d=>d.reason==='invalid-part-box'));
  assert.ok(tiny.parts[0].box.height<0,'Invalid available height remains visible');
});

test('difficult metrics use a bounded deterministic candidate search independent of canvas scale',()=>{
  const metric={value:'A long value '.repeat(12),unit:'long units',label:'Label '.repeat(20),description:'Context '.repeat(20),delta:0,trend:'up'};
  for(const scale of [.1,1,10]) {
    const cell={x:0,y:0,width:300*scale,height:180*scale};
    const first=layoutMetric(metric,cell,{scale,minFontSize:8}),second=layoutMetric(metric,cell,{scale,minFontSize:8});
    assert.deepEqual(first,second);assert.ok(first.attempts>1&&first.attempts<=48);sourceIsComplete(first);
  }
  // 23 * .1 / .1 rounds above 23; the public bound still applies near a zero floor.
  const nearZero=layoutMetric(metric,{x:0,y:0,width:30,height:18},{scale:.1,minFontSize:1e-300});
  assert.ok(nearZero.attempts<=48);sourceIsComplete(nearZero);
});
