import assert from 'node:assert/strict';
import test from 'node:test';
import {layoutTimeline, OPFCompositionError} from '../dist/composition.js';
import {fromMarkdown, toMarkdown} from '../dist/markdown.js';
import {check} from './support/validation.mjs';

const events=[{when:'Week 1',what:'Scope',duration:1,status:'done'},{when:'Weeks 2–5',what:'Build',duration:4,status:'current'},{when:'Week 6',what:'Launch',status:'planned'}];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7, `${a} = ${b}`);

test('duration is a positive numeric period, not a guessed display label',()=>{
  assert.equal(check({slides:[{timeline:events}]}).valid,true);
  for(const duration of [0,-1,null,'4',NaN,Infinity])assert.equal(check({slides:[{timeline:[{what:'Build',duration}]}]}).valid,false,String(duration));
  for(const duration of [0,-1,NaN,Infinity])assert.throws(()=>layoutTimeline([{what:'Build',duration}],{x:0,y:0,width:800,height:400}),/finite positive/);
  assert.throws(()=>layoutTimeline([{what:'First',duration:1e-300},{what:'Second',duration:1e300}],{x:0,y:0,width:800,height:400}),/finite layout precision/);
});

test('horizontal and vertical ranges preserve 1:4:1 in both directions and at every canvas scale',()=>{
  for(const scale of [.5,1,2])for(const direction of ['ltr','rtl'])for(const dimensions of [[1200,500],[300,700]]){
    const box={x:13,y:27,width:dimensions[0]*scale,height:dimensions[1]*scale},before=structuredClone(events);
    const out=layoutTimeline(events,box,{scale,direction,statusWords:true});
    assert.equal(out.overflow,false);assert.deepEqual(events,before);
    const axis=out.arrangement==='vertical'?'height':'width',ranges=out.ranges;
    assert.equal(ranges.length,3);near(ranges[1].box[axis],4*ranges[0].box[axis]);near(ranges[2].box[axis],ranges[0].box[axis]);
    assert.deepEqual(out.parts.map(part=>part.text),events.flatMap(event=>[event.when,event.what]));
    for(const part of out.parts)assert.ok(part.fit.fontSize>=part.requestedFontSize,'a readable arrangement keeps the requested type');
    assert.equal(out.markers[1].status,'current');assert.ok(out.progress);assert.equal(out.statusLabels.length,3);
    for(const {box:r} of ranges)assert.ok(r.x>=box.x-1e-7&&r.y>=box.y-1e-7&&r.x+r.width<=box.x+box.width+1e-7&&r.y+r.height<=box.y+box.height+1e-7);
    if(out.arrangement!=='vertical')assert.equal(out.markers[0].x<out.markers[1].x,direction==='ltr');
  }
});

test('one through nine periods keep every label and the exact duration proportions',()=>{
  for(let count=1;count<=9;count++)for(const direction of ['ltr','rtl']){
    const value=Array.from({length:count},(_,index)=>({what:`Phase ${index+1}`,duration:index%3+1}));
    const out=layoutTimeline(value,{x:0,y:0,width:1200,height:1600},{direction});
    assert.equal(out.overflow,false);assert.equal(out.markers.length,count);assert.equal(out.ranges.length,count);
    const axis=out.arrangement==='vertical'?'height':'width';
    for(let index=0;index<count;index++)near(out.ranges[index].box[axis]/out.ranges[0].box[axis],value[index].duration/value[0].duration);
    assert.deepEqual(out.parts.map(part=>part.text),value.map(event=>event.what));
  }
});

test('omitted durations retain ordinary milestone output and arbitrary time labels',()=>{
  const value=events.map(({duration,...event})=>event),box={x:0,y:0,width:1200,height:500};
  const ordinary=layoutTimeline(value,box),explicitUndefined=layoutTimeline(value.map(event=>({...event,duration:undefined})),box);
  assert.deepEqual(ordinary,explicitUndefined);assert.equal(ordinary.ranges,undefined);
  assert.equal(layoutTimeline([{when:'Weeks 2–5',what:'Build'},{when:'Week 1',what:'Scope'}],box).ranges,undefined);
});

test('intrinsic measurement stays finite while retaining relative vertical periods',()=>{
  const out=layoutTimeline(events,{x:0,y:0,width:180,height:1e6},{intrinsic:true});
  assert.equal(out.arrangement,'vertical');assert.equal(out.overflow,false);assert.ok(out.bounds.height<1000);
  near(out.ranges[1].box.height,4*out.ranges[0].box.height);
});

test('an unreadable proportional interval reports overflow instead of dropping content or changing its duration',()=>{
  const value=[{when:'Brief',what:'All of these source words remain here',duration:.001},{when:'Long',what:'Build',duration:100}],before=structuredClone(value),box={x:0,y:0,width:280,height:160};
  const out=layoutTimeline(value,box);
  assert.equal(out.overflow,true);assert.ok(out.diagnostics.length);assert.deepEqual(value,before);
  assert.deepEqual(out.parts.map(part=>part.text),value.flatMap(event=>[event.when,event.what]));
  assert.throws(()=>layoutTimeline(value,box,{overflow:'error'}),OPFCompositionError);
});

test('Markdown uses a lossless embedded block for numeric periods',()=>{
  const deck={slides:[{timeline:events}]},text=toMarkdown(deck).markdown;
  assert.deepEqual(fromMarkdown(text).presentation.slides[0].timeline,events);
});
