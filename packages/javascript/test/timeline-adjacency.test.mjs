import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutTimeline,OPFCompositionError} from '../dist/composition.js';

const events=[{when:'Q1',what:'Discover',description:'Listen to customers.'},{when:'Q2',what:'Design',description:'Test the proposed direction.'},{when:'Q3',what:'Deliver',description:'Share what we learned.'}];
const bottom=part=>part.box.y+part.box.height;

test('tall alternating timelines keep measured labels adjacent to markers with readable hierarchy',()=>{
  for(const height of [360,960]){
    const result=layoutTimeline(events,{x:30,y:20,width:960,height});
    assert.equal(result.overflow,false);assert.equal(result.arrangement,'alternating');assert.equal(result.attempts,1);
    for(const [index,marker] of result.markers.entries()){
      const fields=result.parts.filter(part=>part.eventIndex===index);
      if(index%2===0)assert.ok(Math.abs(marker.y-bottom(fields.at(-1))-24)<.001);
      else assert.equal(fields[0].box.y-marker.y,24);
      assert.deepEqual(fields.map(part=>part.fit.fontSize),[18,22,18]);
      assert.deepEqual(fields.map(part=>part.style.fontWeight),[500,600,400]);
      for(let i=1;i<fields.length;i++)assert.equal(fields[i].box.y-bottom(fields[i-1]),4);
    }
    const first=Math.min(...result.parts.map(part=>part.box.y));
    const last=Math.max(...result.parts.map(bottom));
    assert.ok(Math.abs((first+last)/2-(20+height/2))<.001);
  }
});

test('single and RTL timelines retain event order, status geometry and compact adjacency',()=>{
  for(const value of [events.slice(0,1),events.map((event,index)=>({...event,status:['done','current','planned'][index]}))]){
    const ltr=layoutTimeline(value,{x:0,y:0,width:960,height:600});
    const rtl=layoutTimeline(value,{x:0,y:0,width:960,height:600},{direction:'rtl'});
    assert.equal(rtl.overflow,false);
    assert.deepEqual(rtl.parts.map(part=>part.text),ltr.parts.map(part=>part.text));
    for(const [index,marker] of rtl.markers.entries()){
      assert.equal(marker.x,960-ltr.markers[index].x);assert.equal(marker.y,ltr.markers[index].y);
      assert.equal(marker.status,value[index].status);
    }
  }
});

test('narrow and dense timelines preserve complete long fields and explicit floors',()=>{
  const value=Array.from({length:6},(_,index)=>({when:`Phase ${index+1}`,what:`Milestone ${index+1}`,description:'Keep every detail, including the long explanation and its original whitespace.\nNext line.'}));
  const copy=structuredClone(value);
  const result=layoutTimeline(value,{x:0,y:0,width:220,height:1500},{minFontSize:18});
  assert.equal(result.overflow,false);assert.equal(result.arrangement,'vertical');assert.equal(result.attempts,2);
  assert.deepEqual(result.parts.map(part=>part.text),value.flatMap(event=>[event.when,event.what,event.description]));
  for(const part of result.parts){assert.ok(part.fit.fontSize>=18);assert.equal(part.fit.sourceLines.map(line=>part.text.slice(line.start,line.nextStart)).join(''),part.text);}
  assert.deepEqual(value,copy);
  assert.throws(()=>layoutTimeline(value,{x:0,y:0,width:100,height:100},{minFontSize:18,overflow:'error'}),OPFCompositionError);
});


test('seven narrow milestones prefer whole words over a fitted alternating grapheme wrap',()=>{
  const value=Array.from({length:7},(_,index)=>({when:`Phase ${index+1}`,what:['Understand the user need','Test a focused prototype','Measure outcomes and learn'][index%3]}));
  const result=layoutTimeline(value,{x:0,y:0,width:680,height:500});
  assert.equal(result.overflow,false);assert.equal(result.arrangement,'vertical');
  for(const part of result.parts)for(const line of part.fit.sourceLines){
    if(line.boundary==='soft')assert.ok(!/[A-Za-z]$/.test(part.text.slice(0,line.nextStart))||!/[A-Za-z]/.test(part.text[line.nextStart]));
  }
  assert.deepEqual(result.parts.map(part=>part.text),value.flatMap(event=>[event.when,event.what]));
});
