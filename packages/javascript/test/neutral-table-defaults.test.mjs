import assert from 'node:assert/strict';
import {test} from 'node:test';
import {layoutTable, resolveColorRoles} from '../dist/composition.js';
const box={x:0,y:0,width:600,height:240};
test('structural rules are neutral and follow slide luminance without changing accents',()=>{
 const scheme={accent5:'#3AC67A',accent1:'#2874A6'};
 assert.equal(resolveColorRoles(scheme,{background:'#FFFFFF'}).border,'#CBD5E1');
 assert.equal(resolveColorRoles(scheme,{background:'#000000'}).border,'#475569');
 assert.equal(resolveColorRoles(scheme).primary,'#2874A6');assert.equal(scheme.accent5,'#3AC67A');
});
test('typed numeric alignment survives formatting, headers, explicit controls and RTL without changing source',()=>{
 const table={columns:['Name',{name:'Amount',format:'0.00'}],rows:[['A',5.8],['B',{value:6.7,style:{align:'center'}}]]}; const before=structuredClone(table);
 const rows=layoutTable(table,box).rows;
 assert.deepEqual(rows.map(r=>r.cells.map(c=>c.alignment)),[['left','right'],['left','right'],['left','center']]);
 assert.equal(rows[1].cells[1].value,'5.80');assert.deepEqual(table,before);
 assert.deepEqual(layoutTable(table,box,{alignment:'left'}).rows.map(r=>r.cells.map(c=>c.alignment)),[['left','left'],['left','left'],['left','center']]);
 assert.equal(layoutTable({rows:[['52',52]]},box).rows[0].cells[0].alignment,'left','numeric-looking strings are text');
 assert.equal(layoutTable({rows:[['52',52]]},box,{direction:'rtl'}).rows[0].cells[1].alignment,'left','logical left becomes physical right in RTL');
 const mixed=layoutTable({columns:['Mixed'],rows:[[1],['note']]},box);assert.equal(mixed.rows[0].cells[0].alignment,'left');assert.equal(mixed.rows[1].cells[0].alignment,'right');
});
