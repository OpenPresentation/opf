// One line style: table cell borders and chart reference lines share Line ('none' or { color, width, dash }, every part optional).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {tableGrid} from '../dist/composition.js';
import {check,errorsOf} from './support/validation.mjs';
const table=borders=>({columns:['Region','Bookings'],rows:[[{value:'North',style:{borders}},42],['South',31]]});
const deck=borders=>({slides:[{title:'Bookings',table:table(borders)}]});
test('a cell border is a Line: none, a partial line or a whole one',()=>{
 for(const borders of [{bottom:'none'},{top:{width:2}},{top:{dash:'dash'}},{left:{color:'accent1'}},{top:{}},{top:{color:'#00000000',width:0}},{top:{color:'accent2',width:2,dash:'dot'},right:'none',bottom:{width:64}}])
  assert.deepEqual(errorsOf(check(deck(borders))),[],JSON.stringify(borders));
 for(const borders of [{bottom:'hidden'},{top:{width:-1}},{top:{width:65}},{top:{dash:'longDash'}},{top:{cap:'round'}},{top:false},{middle:'none'}])
  assert.ok(errorsOf(check(deck(borders))).length,JSON.stringify(borders));
});
test("the table grid gives engines 'none' as a border of no width and leaves partial lines for the table rule's defaults",()=>{
 const style=borders=>tableGrid(table(borders)).rows[1][0].style;
 assert.deepEqual(style({bottom:'none',top:{width:2,dash:'dash'}}).borders,{bottom:{color:'#00000000',width:0},top:{width:2,dash:'dash'}});
 assert.deepEqual(style({left:{color:'accent1'}}).borders,{left:{color:'accent1'}});
 // A style without 'none' is passed through untouched, and the document itself is never rewritten.
 const authored={right:'none'},value=table(authored);tableGrid(value);assert.equal(value.rows[0][0].style.borders.right,'none');
});
