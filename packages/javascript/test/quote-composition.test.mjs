import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide,layoutQuote,OPFCompositionError} from '../dist/composition.js';
import {paginateSlide,OPFPaginationError} from '../dist/pagination.js';

test('accepted quote geometry includes all parts without changing source or re-measuring for explanations', () => {
  const slide={composition:{mode:'column',minFontSize:24},blocks:[{blocks:[{quote:{text:'Original body',attribution:'Author',source:'Citation'}}]}]};
  const before=structuredClone(slide);
  let calls=0;
  const textMeasurement={measure:(text,size)=>{calls++;return text.length*size*.5;}};
  const options={width:731.2345678,height:1280,fonts:{heading:'Heading',body:'Body'},textMeasurement};
  const ordinary=composeSlide(slide,options),count=calls;
  calls=0;
  const {explanation,...explained}=composeSlide(slide,{...options,explain:true});
  assert.deepEqual(explained,ordinary);
  assert.equal(calls,count);
  assert.deepEqual(slide,before);
  assert.deepEqual(explanation.unmeasuredPayloads,[]);
  const item=ordinary.items[0];
  assert.equal(item.text,item.quoteLayout.parts[0].fit);
  assert.equal(item.textStyle,item.quoteLayout.parts[0].style);
  assert.deepEqual(item.quoteLayout,layoutQuote(item.value,item.box,{...options,scale:options.width/720,minFontSize:24,path:item.path}));
  assert.ok(item.quoteLayout.parts.every(part=>part.fit.fontSize>=24*options.width/720));
});

test('automatic candidates account for footer fit and choose the arrangement that keeps it readable', () => {
  // Retained trailing spaces now contribute to line widths. At 68 repetitions
  // the column candidate fits; the row candidate's shorter cells do not.
  const slide={composition:{minFontSize:24},blocks:[{quote:{text:'A',attribution:'Evidence '.repeat(68)}},{quote:{text:'B',attribution:'Evidence '.repeat(68)}}]};
  const result=composeSlide(slide,{explain:true});
  const decision=result.explanation.decisions[0];
  assert.equal(result.explanation.algorithm,'grid-score-v8');
  assert.equal(decision.selectedColumns,2);
  assert.equal(decision.candidates[0].penalties.textOverflow,2000);
  assert.equal(decision.candidates[1].penalties.textOverflow,0);
  assert.deepEqual(result.diagnostics,[]);
  for(const item of result.items)assert.equal(item.quoteLayout.parts[1].fit.lines.join(''),'Evidence '.repeat(68));
  const tooLong=structuredClone(slide);
  for(const block of tooLong.blocks)block.quote.attribution='Evidence '.repeat(70);
  assert.equal(composeSlide(tooLong).diagnostics.length,2,'The former normalized fixture must report retained-space overflow.');
});

test('strict ancestors reject a quote body diagnostic below the leaf path', () => {
  const source='Unchanged source. '.repeat(500);
  const slide={composition:{overflow:'error'},blocks:[{composition:{overflow:'warn'},blocks:[{quote:{text:source}}]}]};
  assert.throws(()=>composeSlide(slide,{explain:true}),error=>{
    assert.ok(error instanceof OPFCompositionError);
    assert.ok(error.diagnostics.every(item=>item.path==='slides.0.blocks.0.blocks.0.quote.text'));
    assert.ok(error.diagnostics.some(item=>item.reason==='text-fit'));
    assert.equal(error.explanation.algorithm,'grid-score-v8');
    return true;
  });
});

test('strict path matching respects component boundaries rather than numeric prefixes', () => {
  const blocks=Array.from({length:12},()=>({text:'Short text'}));
  blocks[1]={composition:{overflow:'error'},blocks:[{quote:'Short quote'}]};
  blocks[10]={quote:{text:'Long but explicitly warning-only quote. '.repeat(500)}};
  const result=composeSlide({composition:{mode:'grid',columns:3},blocks},{height:2000});
  assert.ok(result.diagnostics.some(item=>item.path==='slides.0.blocks.10.quote.text'));
});

test('pagination preserves quote body, repeated metadata, ranges and the accepted readability floor', () => {
  const quote={text:'Preserve each word and space. '.repeat(250),attribution:'Author',source:'Citation'};
  const slide={id:'quote-pages',notes:'Original notes',quote};
  const before=structuredClone(slide);
  const result=paginateSlide(slide,{minFontSize:24});
  assert.ok(result.slides.length>1);
  assert.deepEqual(slide,before);
  assert.equal(result.slides.map(page=>page.quote.text).join(''),quote.text);
  let offset=0;
  result.slides.forEach((page,index)=>{
    assert.equal(page.quote.attribution,quote.attribution);
    assert.equal(page.quote.source,quote.source);
    assert.equal(page.composition.minFontSize,24);
    assert.equal(page.notes,index===0?'Original notes':undefined);
    const geometry=composeSlide(page);
    assert.deepEqual(geometry.diagnostics,[]);
    assert.ok(geometry.items[0].quoteLayout.parts.every(part=>part.fit.fontSize>=24));
    const mapping=result.pages[index].mappings.find(item=>item.sourcePath==='slides.0.quote');
    assert.equal(mapping.range.start,offset);
    offset=mapping.range.end;
  });
  assert.equal(offset,quote.text.length);
  assert.deepEqual(paginateSlide(result.slides[0],{minFontSize:24}).slides,[result.slides[0]]);
  const nested=paginateSlide({composition:{minFontSize:32},blocks:[{composition:{mode:'column'},blocks:[{quote:'Short quote'}]}]},{minFontSize:24}).slides[0];
  assert.equal(nested.blocks[0].composition.minFontSize,32);
});

test('irreducible footer overflow rejects pagination without mutating or returning partial content', () => {
  for (const text of ['', 'Short body']) {
    const source={blocks:[{text:'Keep this earlier block'},{quote:{text,attribution:'Unabridged attribution. '.repeat(100)}}]};
    const before=structuredClone(source);
    assert.throws(()=>paginateSlide(source,{minFontSize:24}),error=>error instanceof OPFPaginationError&&error.diagnostics.some(item=>item.reason==='text-fit'&&item.parts.includes('footer')));
    assert.deepEqual(source,before);
  }
});
