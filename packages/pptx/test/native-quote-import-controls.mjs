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
// FF-57: the restored form. The comparator requires the exact source quote payload, in a slide holding nothing else.
const expectedQuote={text:'Keep the complete source visible.',attribution:'Long attribution',source:'Recorded interview'};
const restoredSlide={title,blocks:[{type:'quote',quote:structuredClone(expectedQuote)}]};
assert.equal(assertNativeQuoteImport(restoredSlide,lines,title,expectedQuote),'quote');positive++;
assert.equal(assertNativeQuoteImport({title,blocks:[{type:'quote',quote:'Shorthand'}]},lines,title,'Shorthand'),'quote');positive++;
assert.equal(assertNativeQuoteImport(structuredClone(scalar),lines,title),'text');positive++;
const quoteCorruptions={
  changedText:slide=>slide.blocks[0].quote.text='Keep the complete source hidden.',
  changedWhitespace:slide=>slide.blocks[0].quote.text+=' ',
  droppedAttribution:slide=>delete slide.blocks[0].quote.attribution,
  droppedSource:slide=>delete slide.blocks[0].quote.source,
  swappedFields:slide=>[slide.blocks[0].quote.attribution,slide.blocks[0].quote.source]=[slide.blocks[0].quote.source,slide.blocks[0].quote.attribution],
  extraField:slide=>slide.blocks[0].quote.note='unexpected',
  shorthand:slide=>slide.blocks[0].quote=slide.blocks[0].quote.text,
  looseTextBlock:slide=>slide.blocks.push({type:'text',text:'Keep the complete source visible.'}),
  textBlocksInstead:slide=>slide.blocks=[{type:'text',text:'"Keep the complete source visible."'},{type:'text',text:'Long attribution - Recorded interview'}],
  duplicateQuote:slide=>slide.blocks.push(structuredClone(slide.blocks[0])),
  wrongType:slide=>slide.blocks[0].type='text',
  extraStructuralKey:slide=>slide.blocks[0].id='unexpected-id',
  wrongTitle:slide=>slide.title='Other title',
};
for(const [name,change] of Object.entries(quoteCorruptions)) {
  const slide=structuredClone(restoredSlide);change(slide);
  assert.throws(()=>assertNativeQuoteImport(slide,lines,title,expectedQuote),name);negative++;
}
console.log(`Native quote import comparator: ${positive} positive and ${negative} corruption controls pass; schema, exact current characters, block order/multiplicity and titles, and the exact restored quote payload (FF-57), without native acceptance.`);
