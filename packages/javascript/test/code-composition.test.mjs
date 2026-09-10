import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide,layoutCode,OPFCompositionError} from '../dist/composition.js';
import {paginateSlide,OPFPaginationError} from '../dist/pagination.js';

test('accepted code uses rounded cells and preserves body compatibility without repeated explanation measurements',()=>{
  const code={source:'  const value = "two  spaces";\r\n\treturn value;  \n',filename:'src/CaseSensitive.ts',language:'TypeScript'};
  const slide={composition:{mode:'column',minFontSize:24},blocks:[{blocks:[{code}]}]},before=structuredClone(slide);
  let calls=0;
  const options={width:731.2345678,height:1280,fonts:{code:'Source Code'},textMeasurement:{measure:(text,size)=>{calls++;assert.ok(!text.includes('\t'));return text.length*size*.5;}}};
  const ordinary=composeSlide(slide,options),count=calls;
  calls=0;
  const {explanation,...explained}=composeSlide(slide,{...options,explain:true});
  assert.deepEqual(explained,ordinary);assert.equal(calls,count);assert.deepEqual(slide,before);
  assert.equal(explanation.algorithm,'grid-score-v3');assert.deepEqual(explanation.unmeasuredPayloads,[]);
  const item=ordinary.items[0],body=item.codeLayout.parts.find(part=>part.role==='body');
  assert.equal(item.text,body.fit);assert.equal(item.textStyle,body.style);
  assert.equal(item.codeLayout.parts[0].role,'filename');assert.notEqual(item.text,item.codeLayout.parts[0].fit);
  assert.deepEqual(item.codeLayout,layoutCode(code,item.box,{...options,scale:options.width/720,minFontSize:24,path:item.path}));
  assert.equal(body.fit.sourceLines.map(line=>body.text.slice(line.start,line.nextStart)).join(''),code.source);
  assert.ok(item.codeLayout.parts.every(part=>part.fit.fontSize>=24*options.width/720));
});

test('candidate penalties include complete code metadata and charge overflowing leaves once',()=>{
  const slide={composition:{minFontSize:24},blocks:[
    {code:{source:'a',filename:'file'.repeat(120),language:'long-language-'.repeat(8)}},
    {code:{source:'b',filename:'file'.repeat(120),language:'long-language-'.repeat(8)}},
  ]};
  const result=composeSlide(slide,{explain:true}),decision=result.explanation.decisions[0];
  assert.equal(decision.selectedColumns,2);
  assert.equal(decision.candidates[0].penalties.textOverflow,2000);
  assert.equal(decision.candidates[1].penalties.textOverflow,0);
  assert.deepEqual(result.diagnostics,[]);
});

test('strict ancestors reject code metadata paths and cannot be weakened by descendants',()=>{
  for (const field of ['source','filename','language']) {
    const code={source:'Keep the body',filename:'Keep the file',language:'Keep the language',[field]:'Overflow '.repeat(2000)};
    const slide={composition:{overflow:'error'},blocks:[{composition:{overflow:'warn'},blocks:[{code}]}]},before=structuredClone(slide);
    assert.throws(()=>composeSlide(slide,{explain:true}),error=>{
      assert.ok(error instanceof OPFCompositionError);
      assert.ok(error.diagnostics.some(item=>item.path===`slides.0.blocks.0.blocks.0.code.${field}`));
      assert.equal(error.explanation.algorithm,'grid-score-v3');return true;
    });
    assert.deepEqual(slide,before);
  }
});

test('explicit code placement and weights remain authoritative even when metadata overflows',()=>{
  const code={source:'source',language:'irreducible '.repeat(2000)};
  const slide={composition:{mode:'row',weights:[2,1]},blocks:[{code},{text:'Keep the other cell'}]};
  const result=composeSlide(slide,{explain:true});
  assert.equal(result.explanation.decisions[0].reason,'configured-mode');
  assert.deepEqual(result.explanation.decisions[0].candidates,[]);
  assert.ok(Math.abs(result.items[0].box.width/result.items[1].box.width-2)<1e-5);
  assert.ok(result.diagnostics.some(item=>item.path==='slides.0.blocks.0.code.language'));
});

test('pagination preserves exact code bytes, metadata, ranges and floors across wide and portrait slides',()=>{
  const code={source:'\tconst value = "two  spaces";  \r\n\r\n'.repeat(30)+'final\n',filename:'src/CaseSensitive.ts',language:'TypeScript'};
  for (const dimensions of [{width:1280,height:720},{width:540,height:960}]) {
    const slide={id:'code-pages',notes:'Original notes',code},before=structuredClone(slide);
    const result=paginateSlide(slide,{...dimensions,minFontSize:24});
    assert.ok(result.slides.length>1);assert.deepEqual(slide,before);
    assert.equal(result.slides.map(page=>page.code.source).join(''),code.source);
    let offset=0;
    for (const [index,page] of result.slides.entries()) {
      assert.equal(page.code.filename,code.filename);assert.equal(page.code.language,code.language);
      assert.equal(page.composition.minFontSize,24);assert.equal(page.notes,index===0?'Original notes':undefined);
      const geometry=composeSlide(page,dimensions),body=geometry.items[0].codeLayout.parts.at(-1);
      assert.deepEqual(geometry.diagnostics,[]);
      assert.equal(body.fit.sourceLines.map(line=>body.text.slice(line.start,line.nextStart)).join(''),page.code.source);
      const mapping=result.pages[index].mappings.find(item=>item.sourcePath==='slides.0.code');
      assert.equal(mapping.range.start,offset);offset=mapping.range.end;
      assert.equal(page.code.source,code.source.slice(mapping.range.start,mapping.range.end));
      assert.deepEqual(paginateSlide(page,{...dimensions,minFontSize:24}).slides,[page]);
    }
    assert.equal(offset,code.source.length);
  }
});

test('irreducible code metadata rejects pagination even after earlier content or with an empty body',()=>{
  for (const source of ['', 'Short body']) for (const field of ['filename','language']) {
    const slide={blocks:[{text:'Keep this earlier block'},{code:{source,[field]:'Unabridged metadata '.repeat(300)}}]},before=structuredClone(slide);
    assert.throws(()=>paginateSlide(slide,{minFontSize:24}),error=>error instanceof OPFPaginationError&&error.diagnostics.some(item=>item.path.endsWith(`.code.${field}`)));
    assert.deepEqual(slide,before);
  }
});
