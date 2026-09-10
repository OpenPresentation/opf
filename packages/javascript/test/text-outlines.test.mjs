import assert from 'node:assert/strict';
import {test} from 'node:test';
import {measureTextOutline,placeTextLines,composeSlide,OPFCompositionError} from '../dist/composition.js';
import {paginatePresentation} from '../dist/pagination.js';
const style={fontFamily:'Host font',fontWeight:400};
test('optional outline providers distinguish unknown measurement from no ink',()=>{
  assert.equal(measureTextOutline('Words',20,style),undefined);
  assert.equal(measureTextOutline(' ',20,style,{measure:()=>5,outlineBounds:()=>null}),null);
  const bounds={x:-2,y:-25,width:30,height:33};
  const actual=measureTextOutline('Áj',20,style,{measure:()=>25,outlineBounds:(text,size,passedStyle)=>{
    assert.equal(text,'Áj');assert.equal(size,20);assert.equal(passedStyle,style);return bounds;
  }});
  assert.deepEqual(actual,bounds);actual.x=123;assert.equal(bounds.x,-2,'The caller cannot mutate the provider cache');
});
const box={x:10,y:20,width:100,height:100};
const line={width:40,y:0,baseline:20,height:25,outline:{x:-2,y:-15,width:45,height:18}};
test('shared placement respects alignment and contains negative bearings and right overhangs',()=>{
  for(const [align,x] of [['left',13],['center',40],['right',66]]) {
    const source=structuredClone(line),fit=placeTextLines([line],box,align,1);
    assert.equal(fit.lines[0].x,x);assert.equal(fit.lines[0].baseline,40);assert.equal(fit.overflow,false);
    assert.ok(fit.lines[0].outline.x>=11);assert.ok(fit.lines[0].outline.x+fit.lines[0].outline.width<=109);
    assert.deepEqual(line,source);assert.deepEqual(placeTextLines([line],box,align,1),fit);
  }
});
test('tall outlines move following baselines as a group without intersecting',()=>{
  const tall={...line,baseline:10,outline:{x:0,y:-12,width:40,height:30}};
  const fitted=placeTextLines([tall,{...line,y:25,baseline:35},{...line,y:50,baseline:60}],box,'left',1);
  assert.equal(fitted.lines[0].outline.y,21);
  for(let i=1;i<fitted.lines.length;i++)assert.ok(fitted.lines[i].outline.y>=fitted.lines[i-1].outline.y+fitted.lines[i-1].outline.height+2);
  assert.equal(fitted.lines[2].baseline-fitted.lines[1].baseline,25);
  assert.equal(fitted.overflow,false);
  assert.equal(placeTextLines([tall],{...box,height:20},'left',1).overflow,true);
});
test('missing ink preserves empty lines; irreducible width or height remains overflow',()=>{
  const blank={width:0,y:0,baseline:20,height:25,outline:null};
  assert.deepEqual(placeTextLines([blank],box).lines[0],{...blank,x:10,y:20,baseline:40});
  assert.equal(placeTextLines([] ,box).height,0);
  assert.equal(placeTextLines([{...line,width:101}],box).overflow,true);
  assert.equal(placeTextLines([{...line,outline:{...line.outline,width:101}}],box).overflow,true);
  assert.equal(placeTextLines([line],{...box,height:20}).overflow,true);
});
test('malformed placements and providers reject invalid numeric claims',()=>{
  for(const invalid of [null,undefined,{...line,outline:undefined},{...line,outline:{}},{...line,width:NaN},{...line,y:-1},{...line,baseline:-1},{...line,height:0}])assert.throws(()=>placeTextLines([invalid],box),RangeError);
  for(const invalid of [null,{...box,width:0},{...box,height:Infinity}])assert.throws(()=>placeTextLines([line],invalid),RangeError);
  for(const padding of [-1,Infinity,NaN])assert.throws(()=>placeTextLines([line],box,'left',padding),RangeError);
  assert.throws(()=>placeTextLines([line],box,'justify'),RangeError);
  assert.throws(()=>measureTextOutline('Text',20,style,{measure:()=>5,outlineBounds:0}),TypeError);
});
const measurement={measure:(text,size)=>text.length*size*.5,outlineBounds:(text,size)=>text.trim()?{x:-size*.1,y:-size*.8,width:text.length*size*.5+size*.2,height:size}:null};
test('composition preserves width-only behavior and exposes the actual outline policy',()=>{
  const slide={title:'Heading',text:'Complete text',composition:{mode:'column'}},source=structuredClone(slide);
  const legacy=composeSlide(slide,{textMeasurement:{measure:measurement.measure},explain:true});
  assert.equal(legacy.items[0].text.placement,undefined);
  assert.equal(legacy.explanation.textOutlines,'unavailable');
  const result=composeSlide(slide,{textMeasurement:measurement,titleAlignment:'right',contentAlignment:'center',explain:true});
  assert.deepEqual(slide,source);assert.equal(result.explanation.algorithm,'grid-score-v6');
  assert.equal(result.explanation.textOutlines,'provided');assert.equal(result.explanation.textRasterPadding,1);
  assert.equal(result.items[0].text.placement.alignment,'right');assert.equal(result.items[1].text.placement.alignment,'center');
  assert.equal(composeSlide({...slide,design:{titleAlignment:'left'}},{textMeasurement:measurement,titleAlignment:'right'}).items[0].text.placement.alignment,'left');
  const scaled=composeSlide(slide,{width:640,height:360,textMeasurement:measurement,textRasterPadding:2,explain:true});
  assert.equal(scaled.explanation.textRasterPadding,1);
});
test('outline failures participate in bounded fitting, candidate scores and strict errors',()=>{
  let calls=0;
  const tooWide={measure:measurement.measure,outlineBounds:()=>{calls++;return {x:0,y:-10,width:10000,height:20};}};
  const slide={composition:{mode:'auto',minFontSize:24},blocks:[{text:'Keep every word'},{text:'Also keep this'}]};
  const result=composeSlide(slide,{textMeasurement:tooWide,explain:true});
  assert.equal(result.diagnostics.filter(issue=>issue.code==='text-overflow').length,2);
  assert.ok(result.items.every(item=>item.text.fontSize>=24&&item.text.placement.overflow));
  assert.ok(result.explanation.decisions[0].candidates.every(item=>item.penalties.textOverflow>=2000));
  assert.ok(calls<2000,'The search is bounded even when outlines cannot fit');
  assert.throws(()=>composeSlide({...slide,composition:{...slide.composition,overflow:'error'}},{textMeasurement:tooWide}),OPFCompositionError);
});
test('presentation pagination forwards outline padding and effective title alignment',()=>{
  // A synthetic provider leaves no space for positive clearance around a title.
  // The zero-padding presentation must pass the same constraint as direct composition.
  const design={titleAlignment:'right',contentAlignment:'center'},slide={title:'T',text:'Body'};
  const width=composeSlide(slide).items[0].box.width;
  const edge={measure:(text,size,s)=>s.path.endsWith('.title')?width:measurement.measure(text,size),outlineBounds:(text,size,s)=>s.path.endsWith('.title')?{x:0,y:-size*.8,width,height:size}:measurement.outlineBounds(text,size,s)};
  const deck={design,slides:[slide]};
  assert.doesNotThrow(()=>paginatePresentation(deck,{textMeasurement:edge,textRasterPadding:0}));
  assert.throws(()=>paginatePresentation(deck,{textMeasurement:edge,textRasterPadding:1}));
});
test('invalid outline coordinates fail instead of silently claiming fit',()=>{
  for(const bounds of [undefined,{},0,{x:0,y:0,width:NaN,height:1},{x:Infinity,y:0,width:1,height:1},{x:0,y:0,width:1,height:-1}]){
    assert.throws(()=>measureTextOutline('Text',20,style,{measure:()=>5,outlineBounds:()=>bounds}),RangeError);
  }
});
