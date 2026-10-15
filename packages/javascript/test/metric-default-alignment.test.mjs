import assert from 'node:assert/strict';
import {test} from 'node:test';
import {gallery} from '@openpresentation/gallery';
import {resolveSlideContext} from '../dist/index.js';
import {composeSlide, layoutMetric} from '../dist/composition.js';

const metric={value:42,unit:'ms',label:'Latency\nProduction',description:'All requests',delta:'-3',trend:'down'};
const box={x:40,y:60,width:800,height:500};
const textMeasurement={measure:(text,size)=>text.length*size*.5};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
const metrics=geometry=>geometry.items.filter(item=>item.metricLayout);

function aligned(layout,cell,alignment='center') {
  assert.equal(layout.alignment,alignment);
  assert.equal(layout.overflow,false);
  const factor=alignment==='center'?.5:alignment==='right'?1:0;
  const [value,unit]=layout.parts;
  if(layout.arrangement==='inline-unit') {
    close(value.box.x,cell.x+(cell.width-value.box.width-unit.box.width-8)*factor);
    close(unit.box.x,value.box.x+value.box.width+8);
    close(value.linePositions[0].baseline,unit.linePositions[0].baseline);
  }
  for(const part of layout.parts) {
    if(layout.arrangement==='inline-unit'&&(part.role==='value'||part.role==='unit'))continue;
    for(const [index,line] of part.fit.sourceLines.entries())close(part.linePositions[index].x,cell.x+(cell.width-line.width)*factor);
  }
}

test('omitted API alignment centers the value/unit pair and every metadata line',()=>{
  for(const value of [42,{...metric}, {...metric,unit:'milliseconds across all production requests'}]) {
    const layout=layoutMetric(value,box,{textMeasurement});
    aligned(layout,box);
    assert.deepEqual(layout,layoutMetric(value,box,{textMeasurement,align:'center'}));
  }
});

test('shorthand, blocks, nested groups and template regions use the same centered fallback',()=>{
  const slides=[
    {metric},
    {blocks:[{metric}]},
    {composition:{mode:'column'},blocks:[{blocks:[{blocks:[{metric}]}]}]},
    {layout:'metrics',title:'Results',blocks:[{metric},{metric:7}]},
  ];
  for(const slide of slides) {
    const layout=slide.layout?{...gallery.layouts[slide.layout],design:{}}:undefined;
    const geometry=composeSlide(slide,{layout,textMeasurement});
    assert.equal(metrics(geometry).length,slide.layout?2:1);
    for(const item of metrics(geometry)) {
      assert.equal(item.alignment,'center',item.path);
      aligned(item.metricLayout,item.box);
    }
    assert.equal(geometry.design.contentAlignment,undefined,'The metric fallback is not a deck design override');
  }
});

test('explicit left, center and right survive at every supported alignment source',()=>{
  for(const align of ['left','center','right']) {
    const variants=[
      [{metric,design:{contentAlignment:align}},{}],
      [{metric},{presentation:{design:{contentAlignment:align}}}],
      [{metric},{contentAlignment:align}],
      [{metric},{themeDesign:{contentAlignment:align}}],
      [{metric},{layout:{...gallery.layouts.metrics,design:{contentAlignment:align}}}],
    ];
    for(const [slide,options] of variants) {
      const item=metrics(composeSlide(slide,{...options,textMeasurement}))[0];
      assert.equal(item.alignment,align);
      aligned(item.metricLayout,item.box,align);
    }
  }
});

test('slide, host, deck, theme and layout precedence remains explicit for metrics',()=>{
  const slide={metric,design:{contentAlignment:'left'}};
  const options={contentAlignment:'right',presentation:{design:{contentAlignment:'center'}},themeDesign:{contentAlignment:'right'},layout:{...gallery.layouts.metrics,design:{contentAlignment:'left'}}};
  const alignment=()=>metrics(composeSlide(slide,options))[0].metricLayout.alignment;
  assert.equal(alignment(),'left');
  delete slide.design;
  assert.equal(alignment(),'right');
  delete options.contentAlignment;
  assert.equal(alignment(),'center');
  delete options.presentation.design.contentAlignment;
  assert.equal(alignment(),'right');
  delete options.themeDesign.contentAlignment;
  assert.equal(alignment(),'left');
  delete options.layout.design.contentAlignment;
  assert.equal(alignment(),'center');
});

test('deck context retains alignment from referenced theme and layout records',()=>{
  for(const align of ['left','center','right'])for(const source of ['theme','layout']) {
    const deck={design:{theme:'house'},catalogs:{custom:{themes:{house:{name:'House',design:source==='theme'?{contentAlignment:align}:{}}},layouts:{house:{...gallery.layouts.metrics,design:source==='layout'?{contentAlignment:align}:{}}}}},slides:[{layout:'house',metric}]};
    const {slide,options,diagnostics}=resolveSlideContext(deck,0,{catalogs:[gallery],fonts:{textMeasurement}});
    assert.deepEqual(diagnostics,[]);
    const geometry=composeSlide(slide,options);
    assert.equal(geometry.design.sources.contentAlignment,source);
    assert.equal(metrics(geometry)[0].metricLayout.alignment,align);
  }
});

test('ordinary prose, lists and tables retain their previous alignment and geometry',()=>{
  const blocks=[{text:'Ordinary prose'},{items:['First','Second']},{table:{columns:['Text','Value'],rows:[['Apples',42]]}}];
  const slide={composition:{mode:'column'},blocks};
  const geometry=composeSlide(slide,{textMeasurement});
  const explicit=composeSlide({...slide,design:{contentAlignment:'left'}},{textMeasurement});
  assert.ok(geometry.items.every(item=>item.alignment==='left'));
  assert.deepEqual(geometry.items,explicit.items);
  for(const align of ['center','right']) {
    assert.ok(composeSlide(slide,{contentAlignment:align,textMeasurement}).items.every(item=>item.alignment===align));
  }
});
