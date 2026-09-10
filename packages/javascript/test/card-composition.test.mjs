import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide,layoutMetric,OPFCompositionError} from '../dist/composition.js';
import {paginatePresentation} from '../dist/pagination.js';

test('cards preserve outer tracks, regions and headings while measuring a rounded inner box',()=>{
  for(const dimensions of [{width:1280,height:720},{width:540,height:960},{width:731.2345678,height:1280}]){
    const slide={title:'Unchanged title',composition:{mode:'row',weights:[2,1]},blocks:[{metric:{value:42,unit:'ms',label:'Latency',trend:'up'}},{bullets:['First','Second']}]};
    const before=structuredClone(slide),plain=composeSlide(slide,dimensions),boxed=composeSlide(slide,{...dimensions,contentBox:true});
    assert.deepEqual(boxed.flows,plain.flows);assert.deepEqual(boxed.items[0],plain.items[0]);assert.deepEqual(slide,before);
    for(const [index,item]of boxed.items.entries())if(index){
      assert.deepEqual(item.frameBox,plain.items[index].box);
      const pad=12*Math.min(dimensions.width,dimensions.height)/720;
      assert.ok(Math.abs(item.box.x-item.frameBox.x-pad)<1e-6);
      assert.ok(Math.abs(item.box.y-item.frameBox.y-pad)<1e-6);
      assert.ok(Math.abs(item.box.width+2*pad-item.frameBox.width)<1e-6);
    }
    const metric=boxed.items[1];
    assert.deepEqual(metric.metricLayout,layoutMetric(metric.value,metric.box,{scale:Math.min(dimensions.width,dimensions.height)/720,path:metric.path}));
    assert.ok(boxed.items[2].text.listEntries.every(entry=>entry.marker.x>=boxed.items[2].box.x&&entry.textBox.x>entry.marker.x));
    const regions={'top:left':{text:'A'},'bottom:right':{text:'B'}};
    assert.deepEqual(composeSlide(regions,{...dimensions,contentBox:true}).items.map(i=>i.frameBox),composeSlide(regions,dimensions).items.map(i=>i.box));
  }
});

test('slide false overrides host cards; nested leaves receive one inset and preserve group geometry',()=>{
  const slide={blocks:[{composition:{padding:.1,mode:'column'},blocks:[{text:'A'},{text:'B'}]}]};
  const plain=composeSlide(slide),boxed=composeSlide(slide,{contentBox:true});
  assert.deepEqual(boxed.groups,plain.groups);assert.deepEqual(boxed.flows,plain.flows);
  assert.deepEqual(boxed.items.map(i=>i.frameBox),plain.items.map(i=>i.box));
  assert.deepEqual(composeSlide({...slide,design:{contentBox:false}},{contentBox:true}),plain);
  assert.deepEqual(composeSlide({...slide,design:{contentBox:true}}),boxed);
  const tiny=composeSlide({composition:{mode:'row',gap:.1},blocks:Array.from({length:12},()=>({text:'Irreducible'}))},{contentBox:true});
  assert.ok(tiny.items[0].box.width>0&&tiny.items[0].box.height>0);
  assert.ok(tiny.diagnostics.some(d=>d.code==='small-cell'));
});

test('card padding participates in automatic score, strict overflow and whole-document pagination',()=>{
  const measurement={measure:(text,size)=>text.length*size*.5};
  const slide={composition:{minFontSize:25,overflow:'error'},text:'A'.repeat(3430)};
  const options={width:600,height:180,textMeasurement:measurement};
  assert.equal(composeSlide(slide,options).diagnostics.length,0);
  assert.throws(()=>composeSlide(slide,{...options,contentBox:true}),e=>e instanceof OPFCompositionError);
  const auto={blocks:[{text:'Long content '.repeat(50)},{text:'More content '.repeat(20)}]};
  assert.notDeepEqual(composeSlide(auto,{...options,explain:true}).explanation.decisions,composeSlide(auto,{...options,contentBox:true,explain:true}).explanation.decisions);
  const document={design:{contentBox:true,dimensions:{widthInches:6.25,heightInches:1.875}},slides:[{text:'Exact content and spacing.\n'.repeat(30),notes:'Source notes'}]},before=structuredClone(document);
  const result=paginatePresentation(document,{textMeasurement:measurement,minFontSize:25});
  assert.ok(result.presentation.slides.length>1);assert.deepEqual(document,before);
  assert.equal(result.presentation.slides.map(s=>s.text).join(''),document.slides[0].text);
  for(const page of result.presentation.slides)assert.deepEqual(composeSlide(page,{...options,contentBox:true}).diagnostics,[]);
  assert.deepEqual(paginatePresentation(result.presentation,{textMeasurement:measurement,minFontSize:25}).presentation,result.presentation);
});
