import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide,layoutMetric,OPFCompositionError} from '../dist/composition.js';
import {paginateSlide,OPFPaginationError} from '../dist/pagination.js';

test('composition accepts complete metric geometry against its rounded cell and aliases the value fit',()=>{
  for (const metric of [0,{value:42,unit:'ms',label:'Latency',description:'All source',delta:0,trend:'flat'}]) {
    const slide={composition:{mode:'column',minFontSize:32},blocks:[{blocks:[{metric}]}]},before=structuredClone(slide);
    let calls=0;
    const options={width:731.2345678,height:1280,fonts:{heading:'Heading',body:'Body'},textMeasurement:{measure:(text,size)=>{calls++;return text.length*size*.5;}}};
    const ordinary=composeSlide(slide,options),count=calls;calls=0;
    const {explanation,...explained}=composeSlide(slide,{...options,explain:true});
    assert.deepEqual(explained,ordinary);assert.equal(calls,count);assert.deepEqual(slide,before);
    assert.equal(explanation.algorithm,'grid-score-v6');assert.deepEqual(explanation.unmeasuredPayloads,[]);
    const item=ordinary.items[0],value=item.metricLayout.parts.find(part=>part.role==='value');
    assert.equal(item.text,value.fit);assert.equal(item.textStyle,value.style);
    assert.deepEqual(item.metricLayout,layoutMetric(metric,item.box,{...options,path:item.path,minFontSize:32,scale:options.width/720}));
    assert.ok(item.metricLayout.parts.every(part=>part.fit.fontSize>=32*options.width/720));
    assert.deepEqual(ordinary.diagnostics,[]);
  }
});

test('metric scoring includes long metadata and charges each failing leaf once',()=>{
  const metric={value:42,label:'Evidence '.repeat(81)};
  const result=composeSlide({composition:{minFontSize:24},blocks:[{metric},{metric}]},{explain:true});
  const decision=result.explanation.decisions[0];
  assert.equal(decision.selectedColumns,2);
  assert.equal(decision.candidates[0].penalties.textOverflow,2000);
  assert.equal(decision.candidates[1].penalties.textOverflow,0);
  assert.deepEqual(result.diagnostics,[]);
  for(const candidate of decision.candidates)assert.ok(Math.abs(candidate.score-Object.values(candidate.penalties).reduce((a,b)=>a+b,0))<1e-8);
});

test('slide alignment overrides host alignment for complete metric parts',()=>{
  const metric={value:1,unit:'%',label:'Completion'};
  assert.equal(composeSlide({metric},{contentAlignment:'center'}).items[0].metricLayout.alignment,'center');
  const item=composeSlide({design:{contentAlignment:'right'},metric},{contentAlignment:'center'}).items[0];
  assert.equal(item.metricLayout.alignment,'right');
  assert.ok(Math.abs(item.metricLayout.parts[1].box.x+item.metricLayout.parts[1].box.width-item.box.x-item.box.width)<1e-8);
});

test('strict ancestors reject complete metric field paths without changing source',()=>{
  for (const field of ['value','unit','label','description','delta']) {
    const metric={value:42,unit:'ms',label:'Latency',delta:0,trend:'flat',[field]:'Unabridged '.repeat(1000)};
    const slide={composition:{overflow:'error',minFontSize:32},blocks:[{composition:{overflow:'warn'},blocks:[{metric}]}]},before=structuredClone(slide);
    assert.throws(()=>composeSlide(slide,{explain:true}),error=>{
      assert.ok(error instanceof OPFCompositionError);assert.equal(error.explanation.algorithm,'grid-score-v6');
      assert.ok(error.diagnostics.some(d=>d.path===`slides.0.blocks.0.blocks.0.metric.${field}`));return true;
    });
    assert.deepEqual(slide,before);
  }
});

test('explicit metric placement and weights remain authoritative despite overflowing metadata',()=>{
  const metric={value:42,unit:'Unabridged units '.repeat(1000)};
  const result=composeSlide({composition:{mode:'row',weights:[2,1]},blocks:[{metric},{text:'Other content'}]},{explain:true});
  assert.equal(result.explanation.decisions[0].reason,'configured-mode');assert.deepEqual(result.explanation.decisions[0].candidates,[]);
  assert.ok(Math.abs(result.items[0].box.width/result.items[1].box.width-2)<1e-5);
  assert.ok(result.diagnostics.some(d=>d.path==='slides.0.blocks.0.metric.unit'));
});

test('atomic metric pagination preserves scalar/metadata types and persists its readable floor',()=>{
  for(const dimensions of [{width:1280,height:720},{width:540,height:960}])for(const metric of [0,{value:-12.5,unit:'ms',label:'Latency',description:'Complete source',delta:0,trend:'flat'}]){
    const slide={metric,notes:'Original notes'},before=structuredClone(slide);
    const result=paginateSlide(slide,{...dimensions,minFontSize:32});
    assert.equal(result.slides.length,1);assert.deepEqual(result.slides[0].metric,metric);assert.deepEqual(slide,before);
    assert.equal(result.slides[0].composition.minFontSize,32);assert.equal(result.slides[0].notes,slide.notes);
    assert.deepEqual(result.pages[0].mappings,[{sourcePath:'slides.0.metric',outputPath:'slides.0.metric'}]);
    assert.deepEqual(composeSlide(result.slides[0],dimensions).diagnostics,[]);
    assert.deepEqual(paginateSlide(result.slides[0],{...dimensions,minFontSize:32}).slides,result.slides);
  }
});

test('irreducible atomic metrics reject all pagination output including empty values after earlier content',()=>{
  for(const value of ['',0])for(const field of ['unit','label','description','delta']){
    const slide={blocks:[{text:'Earlier content'},{metric:{value,[field]:'Unabridged metadata '.repeat(300)}}]},before=structuredClone(slide);
    assert.throws(()=>paginateSlide(slide,{minFontSize:24}),error=>error instanceof OPFPaginationError&&error.diagnostics.some(d=>d.path.endsWith(`.metric.${field}`)));
    assert.deepEqual(slide,before);
  }
});
