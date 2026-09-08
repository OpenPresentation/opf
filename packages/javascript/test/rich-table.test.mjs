import assert from 'node:assert/strict';
import test from 'node:test';
import {validatePresentation} from '../dist/index.js';
import {composeSlide} from '../dist/composition.js';
import {paginateSlide} from '../dist/pagination.js';

test('rich table cells and headers use canonical runs while scalar values remain valid',()=>{
 const table={columns:[['Quarter ',{text:'growth',bold:true}],'Value'],rows:[[['Up ',{text:'12%',color:'#008800',italic:true}],12],[false,null]]};
 assert.equal(validatePresentation({slides:[{table}]}).valid,true);
 for(const cell of [[{text:12}],[[['nested']]],{text:'unsupported object'},[{text:'bad',fontSize:0}]]) assert.equal(validatePresentation({slides:[{table:{rows:[[cell]]}}]}).valid,false);
 assert.equal(validatePresentation({slides:[{table:{columns:[true],rows:[]}}]}).valid,false);
});

test('table overflow uses run metrics and pagination preserves whole rich cells',()=>{
 const textMeasurement={measure:(text,size,style)=>text.length*size*(style.fontWeight===700?.8:.5)};
 const styled={table:{rows:[[[{text:'W'.repeat(30),fontSize:120,bold:true}]]]}};
 assert.ok(composeSlide(styled,{textMeasurement}).diagnostics.some(d=>d.code==='text-overflow'));
 assert.equal(composeSlide({table:{rows:[['W'.repeat(30)]]}},{textMeasurement}).diagnostics.length,0);
 const table={columns:[['Rich ',{text:'header',bold:true}],'Number'],rows:Array.from({length:45},(_,i)=>[[{text:'Row '+i,bold:i%2===0,link:'https://example.com/'+i}],i])};
 const before=structuredClone(table),result=paginateSlide({table},{textMeasurement});
 assert.ok(result.slides.length>1);
 assert.deepEqual(result.slides.flatMap(slide=>slide.table.rows),table.rows);
 for(const slide of result.slides){assert.deepEqual(slide.table.columns,table.columns);assert.equal(composeSlide(slide,{textMeasurement}).diagnostics.length,0);}
 assert.deepEqual(table,before);
});
