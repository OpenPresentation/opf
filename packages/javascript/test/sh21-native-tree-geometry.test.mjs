import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {nativeTreeGeometry} from '../dist/composition.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/sh21-native-tree-rectangles.json',import.meta.url),'utf8'));
const PT=.75;
test('SH21: bounded binary fit reproduces all420 observed native tree node and connector rectangle measurements',()=>{
 assert.equal(fixture.cases.length,420);let maximum=0;
 for(const item of fixture.cases){
  const [width,height]=item.frame.split('x').map(n=>Number(n)/PT),entries=structuredClone(item.entries),before=structuredClone(entries),frame={x:0,y:0,width,height};
  const actual=nativeTreeGeometry(item.kind,frame,entries);assert.equal(actual.ok,true,item.kind+'/'+item.set);assert.deepEqual(entries,before,'tree geometry never edits authored content');assert.equal(actual.nodes.length,entries.length);
  for(const[index,node]of actual.nodes.entries()){
   assert.equal(node.index,index);assert.equal(node.level,entries[index].level);
   for(const field of ['box','background']){const wanted=item.expected[index][field],box=node[field];if(!wanted){assert.equal(box,undefined);continue;}assert.ok(box);for(const[key,value]of ['x','y','width','height'].entries()){const error=Math.abs(box[value]*PT-wanted[key]);maximum=Math.max(maximum,error);assert.ok(error<=.1,`${item.kind}/${item.set}/${item.frame}/${index}/${field}/${value}: ${error}pt`);}}
  }
  assert.equal(actual.connectors.length,entries.length-1);assert.equal(actual.connectors.length,item.connectors.length);
  const unused=[...item.connectors];for(const edge of actual.connectors){assert.equal(actual.nodes[edge.child].parent,edge.parent);const box=[edge.box.x,edge.box.y,edge.box.width,edge.box.height].map(n=>n*PT);const index=unused.findIndex(expected=>expected.every((n,k)=>Math.abs(n-box[k])<=.1));assert.ok(index>=0,item.kind+'/'+item.set+'/'+item.frame+': every semantic connector matches one native rectangle');const expected=unused.splice(index,1)[0];maximum=Math.max(maximum,...box.map((n,k)=>Math.abs(n-expected[k])));}
  const moved=nativeTreeGeometry(item.kind,{...frame,x:23,y:17},entries);assert.equal(moved.ok,true);for(const[index,node]of moved.nodes.entries()){const old=actual.nodes[index];assert.ok(Math.abs(node.box.x-old.box.x-23)<1e-8);assert.ok(Math.abs(node.box.y-old.box.y-17)<1e-8);assert.equal(node.parent,old.parent);}
 }
 assert.ok(maximum<.00015,`model inference residual ${maximum}pt`);
});
test('SH21: tree geometry refuses malformed topology/frames without silently reparenting or clamping',()=>{
 const frame={x:0,y:0,width:600,height:400};for(const kind of ['org-chart','hierarchy']){
  for(const entries of [[],[{text:'Child',level:1}],[{text:'Root',level:0},{text:'Jump',level:2}],[{text:'Root',level:0},{text:'Forest',level:0}]]){const result=nativeTreeGeometry(kind,frame,entries);assert.equal(result.ok,false);assert.ok(result.reason);}
  for(const invalid of [{...frame,width:0},{...frame,height:-1},{...frame,x:Infinity}])assert.equal(nativeTreeGeometry(kind,invalid,[{text:'Root'}]).ok,false);
 }
});