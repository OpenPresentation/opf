import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sourceRunStyles,validateSourceRunStyles,restoreSourceRunStyles,nativeRunStyleEvidence} from '../src/source-run-styles.js';
const hash = value => createHash('sha256').update(value).digest('hex');
const original = [{text:'Current text',fontSize:24}];
const spans = sourceRunStyles(original);
assert.deepEqual(spans,[{length:12,fontSize:24}]);
assert.equal(JSON.stringify(spans).includes('Current text'),false);
const observed = [{text:'Current text',fontSize:23.04,fontFamily:'Roboto',color:'#000000'}];
assert.deepEqual(restoreSourceRunStyles(observed,spans,{fontSize:true,fontFamily:true,color:true}),original);
for (const [key,edited] of [['fontSize',30],['fontFamily','Arial'],['color','#FF0000']]) {
 const current=[{...observed[0],[key]:edited}],intact={fontSize:true,fontFamily:true,color:true,[key]:false};
 const result=restoreSourceRunStyles(current,spans,intact);
 assert.equal(result[0][key],edited);
 for (const other of ['fontSize','fontFamily','color'].filter(k=>k!==key)) assert.equal(result[0][other],original[0][other]);
}
assert.equal(restoreSourceRunStyles(observed,spans,{}),observed);
assert.deepEqual(restoreSourceRunStyles([{...observed[0],text:'Changed word'}],spans,{fontSize:true}),[{text:'Changed word',fontSize:24,fontFamily:'Roboto',color:'#000000'}]);
const longer=[{...observed[0],text:'Changed longer text'}];assert.equal(restoreSourceRunStyles(longer,spans,{fontSize:true}),longer);
const rich=sourceRunStyles([{text:'First',fontSize:24},{text:' second',fontSize:18,color:'#123456'}]);
assert.deepEqual(restoreSourceRunStyles([{text:'First second',fontSize:17}],rich,{fontSize:true,color:true}),[{text:'First',fontSize:24},{text:' second',fontSize:18,color:'#123456'}]);
for(const bad of [[{length:0}],[{length:2,fontSize:-1}],[{length:2,text:'forbidden'}],[{length:2,fontFamily:{}}]]) assert.throws(()=>validateSourceRunStyles(bad));
const native = {r:[{rPr:{sz:'1728','a:latin':{typeface:'Roboto'},'a:solidFill':{'a:srgbClr':{val:'000000'}}},'a:t':'Current'}]};
const before=nativeRunStyleEvidence(native,hash);
for(const key of ['fontSize','fontFamily','color']){
 const changed=structuredClone(native);
 if(key==='fontSize')changed.r[0].rPr.sz='1800';
 if(key==='fontFamily')changed.r[0].rPr['a:latin'].typeface='Arial';
 if(key==='color')changed.r[0].rPr['a:solidFill']['a:srgbClr'].val='FF0000';
 const after=nativeRunStyleEvidence(changed,hash);assert.notEqual(after[key],before[key]);
 for(const other of ['fontSize','fontFamily','color'].filter(k=>k!==key))assert.equal(after[other],before[other]);
}
const textEdit=structuredClone(native);textEdit.r[0]['a:t']='Edited';assert.deepEqual(nativeRunStyleEvidence(textEdit,hash),before);
console.log('Source run style nominal/absence restoration, native edits, current words, rich spans and evidence controls PASS');
const mixedSource=['First',{text:' second',fontSize:24}];
assert.deepEqual(restoreSourceRunStyles([{text:'First sec',fontSize:23.04,fontFamily:'Roboto',color:'#000000'},{text:'ond',fontSize:23.04,fontFamily:'Roboto',color:'#000000'}],sourceRunStyles(mixedSource),{fontSize:true,fontFamily:true,color:true}),mixedSource);
assert.deepEqual(restoreSourceRunStyles([{text:'Current ',fontSize:23.04},{text:'text',fontSize:23.04}],spans,{fontSize:true,fontFamily:true,color:true}),original);
assert.doesNotThrow(()=>sourceRunStyles([{text:'Large',fontSize:2000}]));
for(const [key,attribute] of [['fontSize','sz'],['fontFamily','a:latin'],['color','a:solidFill']]){
 const first={r:[{rPr:{[attribute]:native.r[0].rPr[attribute]}},{rPr:{}}]};
 const moved={r:[{rPr:{}},{rPr:{[attribute]:native.r[0].rPr[attribute]}}]};
 assert.notEqual(nativeRunStyleEvidence(first,hash)[key],nativeRunStyleEvidence(moved,hash)[key],`${key} moved between runs`);
}
const referenced = sourceRunStyles([{text:'Word',color:'var:brand'}]);
assert.deepEqual(referenced,[{length:4,keepColor:true}]);
assert.deepEqual(restoreSourceRunStyles([{text:'Word',color:'#AA0000'}],referenced,{color:true}),[{text:'Word',color:'#AA0000'}]);
for(const forged of [[{length:4,color:'var:brand'}],[{length:4,color:'accent2'}],[{length:4,keepColor:false}],[{length:4,keepColor:true,color:'#FFFFFF'}]])assert.throws(()=>validateSourceRunStyles(forged));
