import assert from 'node:assert/strict';
import {test} from 'node:test';
import {gallery} from '@openpresentation/gallery';
import {resolveSlideContext} from '../dist/index.js';
import {composeSlide, layoutMetric, METRIC_TREND_ARROW_GAP, METRIC_UNIT_GAP, METRIC_TREND_ARROW_SIZE} from '../dist/composition.js';

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
  // LH-137: a delta pill beside the value is on the value's line, which is aligned as one with it.
  const pill=layout.deltaPill?.placement==='beside'?layout.deltaPill.box:undefined;
  if(pill) {
    const last=layout.arrangement==='inline-unit'?unit:value,start=Math.min(value.box.x,pill.x),end=Math.max(pill.x+pill.width,last.box.x+last.box.width);
    close(start,cell.x+(cell.width-(end-start))*factor);
    assert.ok(pill.x>=last.box.x+last.box.width,'the pill follows the value');
  }
  if(layout.arrangement==='inline-unit') {
    // LH-127: the gap is METRIC_UNIT_GAP of the value's size, at least 8.
    const gap=Math.max(8,METRIC_UNIT_GAP*value.fit.fontSize);
    if(!pill)close(value.box.x,cell.x+(cell.width-value.box.width-unit.box.width-gap)*factor);
    close(unit.box.x,value.box.x+value.box.width+gap);
    close(value.linePositions[0].baseline,unit.linePositions[0].baseline);
  }
  // LH-53: the trend arrow precedes its host line (the delta, else the label or description): the arrow, its gap and the line align as one.
  const host=layout.trendBox?['delta','label','description'].map(role=>layout.parts.find(part=>part.role===role&&part.visible)).find(Boolean):undefined;
  for(const part of layout.parts) {
    if(layout.arrangement==='inline-unit'&&(part.role==='value'||part.role==='unit'))continue;
    if(pill&&(part.role==='value'||part.role==='delta'))continue;
    const room=part===host?part.fit.fontSize*(METRIC_TREND_ARROW_SIZE+METRIC_TREND_ARROW_GAP):0;
    for(const [index,line] of part.fit.sourceLines.entries())close(part.linePositions[index].x,cell.x+room+(cell.width-room-line.width)*factor);
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
