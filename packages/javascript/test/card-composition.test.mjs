import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide,layoutMetric,OPFCompositionError} from '../dist/composition.js';
import {paginate} from '../dist/pagination.js';

test('cards preserve outer tracks, regions and headings while measuring a rounded inner box',()=>{
  for(const dimensions of [{width:1280,height:720},{width:540,height:960},{width:731.2345678,height:1280}]){
    const slide={title:'Unchanged title',composition:{mode:'row',weights:[2,1]},blocks:[{metric:{value:42,unit:'ms',label:'Latency',trend:'up'}},{bullets:['First','Second']}]};
    const before=structuredClone(slide),plain=composeSlide(slide,dimensions),boxed=composeSlide(slide,{...dimensions,contentBox:true});
    assert.deepEqual(boxed.flows,plain.flows);assert.deepEqual(boxed.items[0],plain.items[0]);assert.deepEqual(slide,before);
    for(const [index,item]of boxed.items.entries())if(index){
      assert.deepEqual(item.frameBox,plain.items[index].box);
      // A sixteenth of the card's shorter side, between 12 and CARD_INSET (24) px at 720, at most a quarter of the card; down, at most a
      // tenth of its height.
      const frame=item.frameBox,unit=Math.min(dimensions.width,dimensions.height)/720,side=Math.max(12*unit,Math.min(frame.width,frame.height)/16);
      const pad=Math.min(24*unit,side,frame.width/4,frame.height/4),down=Math.min(pad,frame.height/10);
      assert.ok(Math.abs(item.box.x-frame.x-pad)<1e-3);
      assert.ok(Math.abs(item.box.y-frame.y-down)<1e-3);
      assert.ok(Math.abs(item.box.width+2*pad-frame.width)<1e-3);
    }
    const metric=boxed.items[1];
    assert.deepEqual(metric.metricLayout,layoutMetric(metric.value,metric.box,{scale:Math.min(dimensions.width,dimensions.height)/720,path:metric.path}));
    assert.ok(boxed.items[2].text.listEntries.every(entry=>entry.marker.x>=boxed.items[2].box.x&&entry.textBox.x>entry.marker.x));
    const regions={'top:left':{text:'A'},'bottom:right':{text:'B'}};
    assert.deepEqual(composeSlide(regions,{...dimensions,contentBox:true}).items.map(i=>i.frameBox),composeSlide(regions,dimensions).items.map(i=>i.box));
  }
});

test('slide false overrides host cards; nested leaves receive one inset and preserve group geometry',()=>{
  // Explicit weights keep the column's tracks (WI-1 stacks an unweighted column at its blocks' natural heights).
  const slide={blocks:[{composition:{padding:.1,mode:'column',weights:[1,1]},blocks:[{text:'A'},{text:'B'}]}]};
  const plain=composeSlide(slide),boxed=composeSlide(slide,{contentBox:true});
  assert.deepEqual(boxed.groups,plain.groups);assert.deepEqual(boxed.flows,plain.flows);
  assert.deepEqual(boxed.items.map(i=>i.frameBox),plain.items.map(i=>i.box));
  // The effective design hints differ by construction (they record which level supplied contentBox); the geometry must not.
  const geometry=({design,...rest})=>rest;
  assert.deepEqual(geometry(composeSlide({...slide,design:{contentBox:false}},{contentBox:true})),geometry(plain));
  assert.deepEqual(geometry(composeSlide({...slide,design:{contentBox:true}})),geometry(boxed));
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
  const result=paginate(document,{fonts:{textMeasurement:measurement},minFontSize:25});
  assert.ok(result.presentation.slides.length>1);assert.deepEqual(document,before);
  assert.equal(result.presentation.slides.map(s=>s.text).join(''),document.slides[0].text);
  for(const page of result.presentation.slides)assert.deepEqual(composeSlide(page,{...options,contentBox:true}).diagnostics,[]);
  assert.deepEqual(paginate(result.presentation,{fonts:{textMeasurement:measurement},minFontSize:25}).presentation,result.presentation);
});
