import assert from 'node:assert/strict';
import test from 'node:test';
import {browserFixture,BROWSER_TEXT as text} from './browser-fixture.mjs';
const inputs=schema=>({catalogSchema:schema,gallery:{layouts:{[schema===1?'code-1x':'code']:{} }},validate:()=>({valid:true,findings:[]})});
test('legacy1 fixture stays exact while schema2 preserves text/code with explicit regions',()=>{
 assert.deepEqual(browserFixture('consolas',inputs(1)).slides[1],{id:'b',layout:'code-1x',title:text.title,code:{source:text.code,language:'ts'},text:text.body});
 assert.deepEqual(browserFixture('consolas',inputs(2)).slides[1],{id:'b',layout:'code',title:text.title,blocks:[{region:'code',code:{source:text.code,language:'ts'}},{region:'notes',text:text.body}]});
});
test('unknown schema, missing loaded layout or invalid format/reference refuses',()=>{
 assert.throws(()=>browserFixture('consolas',inputs(3)),/actual catalog schema/);
 const absent=inputs(2);absent.gallery.layouts={};assert.throws(()=>browserFixture('consolas',absent),/loaded catalog/);
 const invalid=inputs(2);invalid.validate=()=>({valid:false,findings:['unresolved reference']});assert.throws(()=>browserFixture('consolas',invalid),/unresolved reference/);
});
