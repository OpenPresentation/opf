import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolvePresentation,toSvg} from '../dist/svg.js';
import {gallery} from '@openpresentation/gallery';
const deck={slides:[{layout:'text',title:'Region title',blocks:[{text:'Region alignment probe'}]}]};
const bound=resolvePresentation(deck,{catalogs:[gallery]}).slides[0];
assert.ok(!Object.hasOwn(bound,'titleBindings'),'v1 title bindings are not exposed');
assert.ok(bound.geometry.regions.some(region=>region.name==='body'),'v2 body region geometry remains available');
assert.deepEqual(bound.blocks,[{type:'text',field:'text',value:'Region alignment probe',path:'slides.0.blocks.0.text'}]);
for(const item of [...bound.contentItems,...bound.blocks]){
 assert.ok(!Object.hasOwn(item,'slot')&&!Object.hasOwn(item,'placeholderIndex'),'legacy binding metadata is absent');
}
assert.match(toSvg(deck,{catalogs:[gallery]})[0],/Region alignment probe/);
const rootDeck={slides:[{title:'Root',text:'Root text'}]};
assert.deepEqual(resolvePresentation(rootDeck).slides[0].contentItems,[{type:'text',field:'text',value:'Root text',path:'slides.0.text'}]);
const promotedDeck={slides:[{title:'Promoted',left:{text:'Left text'},right:{text:'Right text'}}]};
assert.deepEqual(resolvePresentation(promotedDeck).slides[0].contentItems,[
 {type:'text',field:'text',value:'Left text',path:'slides.0.left.text',regionKey:'left'},
 {type:'text',field:'text',value:'Right text',path:'slides.0.right.text',regionKey:'right'}
]);
const group={blocks:[{text:'First nested'},{text:'Second nested'}],composition:{mode:'column'}};
const richSlide={title:[{text:'Plain',bold:false},{text:' strong',bold:true,italic:true}],subtitle:[{text:'Sub',italic:true}],blocks:[group]};
const richDeck={slides:[richSlide]},richBound=resolvePresentation(richDeck).slides[0];
assert.deepEqual(richBound.slide,richSlide,'rich headings and nested source stay intact');
assert.deepEqual(richBound.blocks,[{type:'text',field:'text',value:JSON.stringify(group),path:'slides.0.blocks.0'}],'nested group metadata normalization stays intact');
const richSvg=toSvg(richDeck)[0];
for(const text of ['Plain',' strong','Sub','First nested','Second nested'])assert.ok(richSvg.includes(text),'SVG retains '+text);
assert.match(richSvg,/font-weight="700"/);
assert.match(richSvg,/font-style="italic"/);
assert.match(JSON.stringify(richBound.geometry),/First nested/,'nested content remains in drawn geometry');
for(const file of ['index.d.ts','svg.d.ts']){
 const types=await readFile(new URL('../dist/'+file,import.meta.url),'utf8');
 assert.doesNotMatch(types,/titleBindings|placeholderIndex|\bslot\?:/,'published declarations omit obsolete binding fields');
}
console.log('Public v2 binding metadata: removed title/slot/placeholder fields; authored body and actual region geometry retained.');
