import assert from 'node:assert/strict';
import {toSvg,OPFRenderError} from '../dist/svg.js';
const routes=[
 {path:'slides.0.title',slide:text=>({title:[{text,bold:true}]})},
 {path:'slides.0.text',slide:text=>({text:[{text,italic:true}]})},
 {path:'slides.0.items.0',slide:text=>({items:[[{text,bold:true}]]})},
 {path:'slides.0.table.rows.0.0',slide:text=>({table:{columns:['Value'],rows:[[[{text,italic:true}]]]}})},
];
for(const {path,slide}of routes){
 for(const invalid of ['\u0000','\u000b','\ud800','\udc00','\ufffe']){
  const deck={slides:[slide(`A${invalid}B`)]},before=structuredClone(deck);
  assert.throws(()=>toSvg(deck,1),error=>error instanceof OPFRenderError&&error.code==='invalid-text'&&error.path===path&&error.message.includes('offset 1'),path);
  assert.deepEqual(deck,before,'refusal never edits authored text');
 }
 const legal='A\tB\nC\rD\r\nE😀 <>&';
 const deck={slides:[slide(legal)]},before=structuredClone(deck),svg=toSvg(deck,1);
 assert.ok(svg.includes('😀'),'valid non-BMP pair is retained');
 assert.ok(svg.includes('&lt;&gt;&amp;'),'markup stays escaped');
 assert.deepEqual(deck,before,'legal tabs/newline/CR and supplementary characters are not normalized in source');
}
assert.throws(()=>toSvg({slides:[{text:'A\u0000B'}]},1),error=>error.code==='invalid-text'&&error.path==='slides.0.text','plain-string contract remains unchanged');
console.log('Rich XML character guards passed: heading/body/list/table, controls/surrogates/noncharacters rejected with path; legal whitespace/non-BMP/escaping retained.');
