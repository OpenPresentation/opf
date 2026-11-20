import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide,smartArtUnavailable} from '../dist/composition.js';
const layout=arrangement=>({name:'Measured arrangement',direction:'column',regions:[{name:'title'},{name:'nodes',accepts:['list'],role:'primary',flow:'none',...(arrangement?{arrangement}:{})}]});
const tree=[{text:'Root',level:0},{text:'Build',level:1},{text:'Web',level:2},{text:'App',level:2},{text:'Ship',level:1}];
test('SH21: template vocabulary selects actual tree/Venn geometry and never shrinks the authored list size',()=>{
 for(const kind of ['org-chart','hierarchy','venn']){
  const items=kind==='venn'?['One','Two','Three']:structuredClone(tree),before=structuredClone(items),slide={layout:kind,title:'A clear plan',items};
  const plain=composeSlide(slide,{layout:layout()}),composed=composeSlide(slide,{layout:layout(kind)}),a=composed.arrangements?.[0];
  assert.ok(a,kind);assert.equal(a.kind,kind);assert.equal(a.nodes.length,items.length);assert.ok(a.fontSize>=plain.items.find(i=>i.field==='items').text.fontSize);assert.deepEqual(items,before);
  assert.equal(a.connectors?.length,kind==='venn'?undefined:items.length-1);
  assert.match(smartArtUnavailable({kind,count:items.length,frame:a.frame,nodes:items.map(()=>({lines:1,stable:true})),rtl:false}),/awaiting native qualification/,'geometry helpers alone do not enable live text/edit eligibility');
 }
});
test('SH21: invalid trees and excess Venn counts retain every authored entry with a reported fallback',()=>{
 for(const [kind,items]of [['org-chart',[{text:'Root',level:0},{text:'Forest',level:0}]],['hierarchy',[{text:'Root',level:0},{text:'Jump',level:2}]],['venn',Array.from({length:8},(_,i)=>'Set '+i)]]){
  const c=composeSlide({layout:kind,title:'Keep all entries',items},{layout:layout(kind)});assert.equal(c.arrangements?.length??0,0);assert.ok(c.diagnostics.some(d=>d.code==='arrangement-adapted'));assert.deepEqual(c.items.find(i=>i.field==='items').value,items);
 }
});