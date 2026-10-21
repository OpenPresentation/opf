import assert from 'node:assert/strict';
import test from 'node:test';
import {browserFixture,BROWSER_TEXT as text} from './browser-fixture.mjs';
const inputs=schema=>({catalogSchema:schema,coreVersion:({1:'0.18.4',2:'0.19.0',3:'0.20.1',4:'0.25.0'})[schema],gallery:{layouts:{[schema===1?'code-1x':'code']:{} }},validate:()=>({valid:true,findings:[]})});
test('legacy1 fixture stays exact while reviewed generations2/3/4 preserve text/code with explicit regions',()=>{
 assert.deepEqual(browserFixture('consolas',inputs(1)).slides[1],{id:'b',layout:'code-1x',title:text.title,code:{source:text.code,language:'ts'},text:text.body});
 for(const generation of [2,3,4]) assert.deepEqual(browserFixture('consolas',inputs(generation)).slides[1],{id:'b',layout:'code',title:text.title,blocks:[{region:'code',code:{source:text.code,language:'ts'}},{region:'notes',text:text.body}]});
});
test('unknown schema, missing loaded layout or invalid format/reference refuses',()=>{
 assert.throws(()=>browserFixture('consolas',inputs(5)),/actual catalog schema/);
 const absent=inputs(2);absent.gallery.layouts={};assert.throws(()=>browserFixture('consolas',absent),/loaded catalog/);
 const invalid=inputs(2);invalid.validate=()=>({valid:false,findings:['unresolved reference']});assert.throws(()=>browserFixture('consolas',invalid),/unresolved reference/);
});

test('catalog/core tuple mismatch, missing core and unknown future core refuse',()=>{
 for(const [generation,coreVersion] of [[3,'0.19.0'],[2,'0.20.1'],[3,'0.25.0'],[4,'0.24.2'],[3,'0.26.0'],[3,undefined]]) assert.throws(()=>browserFixture('consolas',{...inputs(generation),coreVersion}));
});
