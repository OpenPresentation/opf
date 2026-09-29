// Pure comparator controls. No PowerPoint, fonts, raster or native process.
import assert from 'node:assert/strict';
import {assertNativeQuoteImport} from './native-quote-import-contract.mjs';
const lines=[' repeated ',' repeated ','','\tline\r\n  '],title='Exact native title';
const scalar={title,blocks:lines.map(text=>({type:'text',text}))};
const rich={title,blocks:lines.map(text=>({type:'text',text:[{text,bold:false,fontFamily:'Current font',fontSize:13.5,color:'#12345680',underline:true}]}))};
let positive=0,negative=0;
for(const slide of [scalar,rich,{...rich,title:'Native edit quote-1280 slide 1'}]) {
  const before=structuredClone(slide);
  assertNativeQuoteImport(slide,lines,slide.title);assert.deepEqual(slide,before);positive++;
}
// Native formatting may legitimately change; this comparator still validates
// it as OPF. Exact property fidelity has separate current-body fixture oracles.
const restyled=structuredClone(rich);restyled.blocks[0].text=[{text:' repeated ',italic:true,link:'https://example.com/current'}];
assertNativeQuoteImport(restyled,lines,title);positive++;
const corruptions={
  changedCharacter:slide=>slide.blocks[0].text[0].text='repeated ',
  changedWhitespace:slide=>slide.blocks[3].text[0].text='\tline\n  ',
  missingBlock:slide=>slide.blocks.splice(0,1),
  duplicateBlock:slide=>slide.blocks.push(structuredClone(slide.blocks[0])),
  reorderedBlock:slide=>slide.blocks.reverse(),
  mergedBlocks:slide=>slide.blocks.splice(0,2,{type:'text',text:' repeated  repeated '}),
  missingEmpty:slide=>slide.blocks.splice(2,1),
  wrongTitle:slide=>slide.title='Other title',
  nonTextBlock:slide=>slide.blocks[0]={type:'code',code:' repeated '},
  extraStructuralKey:slide=>slide.blocks[0].id='unexpected-id',
  invalidRun:slide=>slide.blocks[0].text=[{text:' repeated ',bold:'yes'}],
  invalidText:slide=>slide.blocks[0].text=[{text:null}],
};
for(const [name,change] of Object.entries(corruptions)) {
  const slide=structuredClone(rich);change(slide);
  assert.throws(()=>assertNativeQuoteImport(slide,lines,title),name);negative++;
}
console.log(`Native quote import comparator: ${positive} positive and ${negative} corruption controls pass; schema, exact current characters, block order/multiplicity and titles, without native acceptance.`);
