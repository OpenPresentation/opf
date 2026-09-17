import assert from 'node:assert/strict';
import {test} from 'node:test';
import {layoutMetric,composeSlide} from '../dist/composition.js';

const measure=(text,size)=>text.length*size*.5;
const outlines={measure,outlineBounds:(text,size)=>text.trim()?{x:-size*.12,y:-size*1.15,width:measure(text,size)+size*.24,height:size*1.6}:null};
const content={value:'f\t1',unit:'ms',label:'  Tall\r\n\tlabel  ',description:'\t  ',delta:0,trend:'flat'};
function completeAndContained(layout,cell,padding){
  assert.equal(layout.overflow,false);
  for(const part of layout.parts){
    assert.equal(part.fit.sourceLines.map(line=>part.text.slice(line.start,line.nextStart)).join(''),part.text);
    assert.ok(part.fit.fontSize>=part.minFontSize);
    assert.equal(part.linePositions.length,part.fit.sourceLines.length);
    for(const [i,line]of part.fit.placement.lines.entries()){
      assert.deepEqual(part.linePositions[i],{x:line.x,baseline:line.baseline});
      if(!line.outline)continue;
      const ink=line.outline;
      for(const area of [cell,part.box]){
        assert.ok(ink.x>=area.x+padding-1e-8,'Left ink plus clearance stays inside');
        assert.ok(ink.x+ink.width<=area.x+area.width-padding+1e-8,'Right ink plus clearance stays inside');
        assert.ok(ink.y>=area.y+padding-1e-8,'Top ink plus clearance stays inside');
        assert.ok(ink.y+ink.height<=area.y+area.height-padding+1e-8,'Bottom ink plus clearance stays inside');
      }
      if(i>0){const previous=part.fit.placement.lines[i-1].outline;if(previous)assert.ok(previous.y+previous.height+2*padding<=ink.y+1e-8);}
    }
  }
}
test('metric outlines preserve exact tabs and whitespace while containing overhangs, tall ink and inline baselines',()=>{
  for(const align of ['left','center','right'])for(const scale of [.75,1,2]){
    const cell={x:10*scale,y:20*scale,width:500*scale,height:600*scale};
    const config={align,scale,textMeasurement:outlines},before=JSON.stringify(content);
    const layout=layoutMetric(content,cell,config);
    assert.equal(layout.arrangement,'inline-unit');completeAndContained(layout,cell,scale);
    assert.equal(layout.parts[0].linePositions[0].baseline,layout.parts[1].linePositions[0].baseline);
    assert.equal(JSON.stringify(content),before);assert.deepEqual(layoutMetric(content,cell,config),layout);
    assert.equal(layout.parts.find(part=>part.role==='description').fit.placement.lines[0].outline,null);
  }
});
test('metric outline-aware fitting retains the readability floor and rejects irreducible ink',()=>{
  const cell={x:0,y:0,width:110,height:90},value={value:'Wide',label:'L'};
  const layout=layoutMetric(value,cell,{minFontSize:16,textMeasurement:outlines});
  assert.ok(layout.parts.every(part=>part.fit.fontSize>=16));
  const impossible={measure,outlineBounds:()=>({x:0,y:-20,width:1000,height:40})};
  const failure=layoutMetric(value,cell,{minFontSize:16,textMeasurement:impossible});
  assert.equal(failure.overflow,true);assert.ok(failure.diagnostics.some(d=>d.reason==='text-fit'));
  assert.equal(failure.parts[0].text,value.value);
  assert.throws(()=>layoutMetric(value,cell,{minFontSize:16,textMeasurement:impossible,overflow:'error'}),{code:'layout-overflow'});
  assert.throws(()=>composeSlide({composition:{overflow:'error'},metric:value},{width:540,height:960,textMeasurement:impossible}),{code:'layout-overflow'});
});
test('zero outline clearance is explicit and width-only providers retain prior geometry',()=>{
  const cell={x:10,y:10,width:300,height:200},ink={measure,outlineBounds:(text,size)=>({x:0,y:-size,width:measure(text,size),height:size})};
  const value={value:'42',label:'Edge'};
  const zero=layoutMetric(value,cell,{align:'right',textMeasurement:ink,textRasterPadding:0});
  const padded=layoutMetric(value,cell,{align:'right',textMeasurement:ink,textRasterPadding:2});
  const last=layout=>layout.parts[1].fit.placement.lines[0].outline;
  assert.equal(last(zero).x+last(zero).width,310);
  assert.equal(last(padded).x+last(padded).width,308);
  const widths={measure};
  assert.deepEqual(layoutMetric(value,cell,{textMeasurement:widths,textRasterPadding:0}),layoutMetric(value,cell,{textMeasurement:widths,textRasterPadding:100}));
  assert.equal(layoutMetric(value,cell,{textMeasurement:widths}).parts[0].fit.placement,undefined);
  const empty=layoutMetric({value:'',unit:'ms'},cell,{textMeasurement:outlines}).parts[0];
  assert.ok(empty.box.width>=empty.fit.fontSize,'Empty values retain a usable nominal editor target');
});
test('invalid metric outline providers and padding reject instead of silently accepting width-only fits',()=>{
  const cell={x:0,y:0,width:300,height:200};
  for(const bounds of [undefined,{x:NaN,y:0,width:2,height:2},{x:0,y:0,width:-1,height:2}])assert.throws(()=>layoutMetric(42,cell,{textMeasurement:{measure,outlineBounds:()=>bounds}}),RangeError);
  assert.throws(()=>layoutMetric(42,cell,{textMeasurement:{measure,outlineBounds:true}}),TypeError);
  for(const textRasterPadding of [-1,NaN,Infinity])assert.throws(()=>layoutMetric(42,cell,{textRasterPadding}),RangeError);
});
