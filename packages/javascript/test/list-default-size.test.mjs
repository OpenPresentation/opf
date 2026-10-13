import test from 'node:test';
import assert from 'node:assert/strict';
import {composeSlide,fitList} from '../dist/composition.js';
const box={x:0,y:0,width:1160,height:500};
const values=['Discover','Design','Build','Test','Learn','Deliver'];
test('unspecified short lists start at32, with numbering and nested entries intact',()=>{
  for(const options of [{},{numbering:'arabic'}]){
    const fit=fitList(values,box,undefined,undefined,{style:{fontFamily:'sans-serif',fontWeight:400},...options});
    assert.equal(fit.fontSize,32);assert.equal(fit.overflow,false);assert.deepEqual(fit.listEntries.map(entry=>entry.text.lines.join('')),values);
  }
  for(const field of ['items','bullets']){
    const result=composeSlide({[field]:values});const item=result.items.find(item=>item.field===field);
    assert.equal(item.text.fontSize,32);
  }
});
test('authored rich18pt remains18pt (24 referencepixels) under larger default',()=>{
  const fit=fitList([{text:[{text:'Explicit size',fontSize:18}]}],box);
  assert.equal(fit.listEntries[0].text.richLines[0].fragments[0].fontSize,24);
  assert.equal(fit.listEntries[0].text.richLines[0].fragments[0].run.fontSize,18);
  assert.equal(fitList(values,box,24).fontSize,24);
});
test('dense list columns fit at an explicit floor without losing entries or numbering',()=>{
  const values=Array.from({length:18},(_,i)=>({text:`Entry ${i+1}: preserve its words`,level:i%3===1?1:0}));
  const slide={blocks:[{items:values,numbering:'arabic',columns:3}],composition:{minFontSize:20}};
  const result=composeSlide(slide);const item=result.items.find(item=>item.field==='items');
  assert.ok(item.listColumns?.length===3);assert.equal(item.listColumns.flatMap(column=>column.text.listEntries).length,18);
  assert.ok(item.listColumns.every(column=>column.text.fontSize>=20&&!column.text.overflow));
  assert.deepEqual(item.listColumns.flatMap(column=>column.text.listEntries).map(entry=>entry.index),Array.from({length:18},(_,i)=>i));
});

test('dense one-column fitting honors floors and preserves nested source instead of truncating',()=>{
  const input=Array.from({length:12},(_,i)=>({text:`Preserve entry ${i+1} and its complete explanation`,level:i===3?1:0}));
  const before=structuredClone(input),fit=fitList(input,{x:0,y:0,width:360,height:500},undefined,20);
  assert.ok(fit.fontSize>=20&&fit.fontSize<32);
  assert.equal(fit.listEntries.length,input.length);assert.equal(fit.listEntries[3].level,1);
  assert.deepEqual(fit.listEntries.map(entry=>entry.value),input.map(entry=>entry.text));assert.deepEqual(input,before);
});
