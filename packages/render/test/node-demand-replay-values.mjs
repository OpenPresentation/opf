// Value lookup must observe fresh owned snapshots; incoming object identity is never authority.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPreparationReplay} from '../dist/font-preparation-replay.js';
const base=()=>({fontFamily:'Roboto',fontWeight:400,italic:false});
function capture(run){
 const replay=createPreparationReplay(),observed=[],entries=[{family:'Roboto',weight:400,italic:false}],keys={context:'owned-context',slides:['owned-slide']};
 const registry={preparationContext:'plain-owned-content',faces:[{family:'Roboto',weight:400,italic:false},{family:'Roboto',weight:700,italic:false}],policy:'none',aliases:new Map(),coverage(text,size,style){observed.push({text,size,style:structuredClone(style),keys:Reflect.ownKeys(style).filter(k=>k!=='path')});}};
 assert.equal(replay.begin(keys,'options',registry,true),true);
 const record=(style,size=20)=>replay.coverage('measure','same owned text',size,style,()=>{});
 run(record);replay.finish(entries);assert.equal(replay.replay(keys,'options',registry,()=>{throw Error('No selection event was authored');}),entries);return observed;
}
test('same incoming style object mutations preserve every full field and each first path/size',()=>{
 const style={...base(),tracking:'first',path:'trace.first'},expected=[];
 const seen=capture(record=>{for(const mutate of [()=>{},()=>{style.tracking='second';style.path='trace.second';},()=>{style.fontWeight=700;style.path='trace.bold';},()=>{delete style.tracking;style.path='trace.absent';},()=>{style.tracking=undefined;style.path='trace.undefined';}]){mutate();expected.push(structuredClone(style));record(style,20+expected.length);}});
 assert.deepEqual(seen.map(x=>x.style),expected);assert.deepEqual(seen.map(x=>x.size),[21,22,23,24,25]);
});
test('absent, own undefined and null encoding stay distinct while duplicate returns retain original event metadata',()=>{
 const style={...base(),path:'trace.absent'};
 const seen=capture(record=>{record(style,20);style.symbolEncoding=undefined;style.path='trace.undefined';record(style,21);style.symbolEncoding=null;style.path='trace.null';record(style,22);delete style.symbolEncoding;style.path='trace.later-duplicate';record(style,99);});
 assert.equal(seen.length,3);assert.equal(Object.hasOwn(seen[0].style,'symbolEncoding'),false);assert.equal(Object.hasOwn(seen[1].style,'symbolEncoding'),true);assert.equal(seen[1].style.symbolEncoding,undefined);assert.equal(seen[2].style.symbolEncoding,null);assert.deepEqual(seen.map(x=>[x.size,x.style.path]),[[20,'trace.absent'],[21,'trace.undefined'],[22,'trace.null']]);
});
test('nested native fontFace values are copied and compared after same-object mutations, including optional presence',()=>{
 const style={...base(),path:'trace.no-face'},face={family:'Roboto',bold:false,italic:false};
 const seen=capture(record=>{record(style);style.fontFace=undefined;style.path='trace.undefined-face';record(style);style.fontFace=null;style.path='trace.null-face';record(style);style.fontFace=face;style.path='trace.face';record(style);face.bold=true;style.path='trace.bold-face';record(style);face.italic=true;style.path='trace.italic-face';record(style);face.family='Roboto Mono';style.path='trace.other-face';record(style);});
 assert.equal(seen.length,7);assert.equal(Object.hasOwn(seen[0].style,'fontFace'),false);assert.equal(Object.hasOwn(seen[1].style,'fontFace'),true);assert.equal(seen[1].style.fontFace,undefined);assert.equal(seen[2].style.fontFace,null);assert.deepEqual(seen.slice(3).map(x=>x.style.fontFace),[{family:'Roboto',bold:false,italic:false},{family:'Roboto',bold:true,italic:false},{family:'Roboto',bold:true,italic:true},{family:'Roboto Mono',bold:true,italic:true}]);
});
test('equal outer values in a different own-key order retain the existing full-signature distinction',()=>{
 const first={...base(),first:1,second:2,path:'trace.first-order'},second={...base(),second:2,first:1,path:'trace.second-order'};
 const seen=capture(record=>{record(first);record(second);});assert.equal(seen.length,2);assert.deepEqual(seen.map(x=>x.keys),[Reflect.ownKeys(first).filter(k=>k!=='path'),Reflect.ownKeys(second).filter(k=>k!=='path')]);
});
test('a newly introduced accessor after an eligible previous style still declines replay without invoking it',()=>{
 const replay=createPreparationReplay(),style={...base(),path:'trace.first'},keys={context:'context',slides:['slide']};let getterReads=0,live=0,replayed=0;
 const registry={preparationContext:'plain-content',faces:[{family:'Roboto',weight:400,italic:false}],policy:'none',aliases:new Map(),coverage(){replayed++;}};
 assert.equal(replay.begin(keys,'options',registry,true),true);replay.coverage('measure','owned',20,style,()=>{live++;});Object.defineProperty(style,'fontWeight',{enumerable:true,configurable:true,get(){getterReads++;return 400;}});replay.coverage('measure','owned',20,style,()=>{live++;});replay.finish([{family:'Roboto'}]);assert.equal(replay.replay(keys,'options',registry,()=>{}),undefined);assert.equal(live,2);assert.equal(getterReads,0);assert.equal(replayed,0);
});