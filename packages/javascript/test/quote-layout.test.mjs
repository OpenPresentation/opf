import assert from 'node:assert/strict';
import {test} from 'node:test';
import {layoutQuote,fitText,OPFCompositionError} from '../dist/composition.js';

const cell = {x:40,y:60,width:800,height:400};

test('complete quote layout preserves source ranges, requested/resolved styles and legacy readable geometry', () => {
  const value = Object.freeze({text:'Original “quote” — 日本語 👩‍🔬',attribution:'Name  with spaces',source:'Original source'});
  const fonts = {heading:'Requested Heading',body:'Requested Body'};
  const seen = [];
  const measurement = {
    resolveStyle: style => ({...style,fontFamily:style.fontFamily.replace('Requested','Resolved')}),
    measure:(text,size,style)=>{seen.push({...style});return [...text].length*size*.5;},
  };
  const result = layoutQuote(value,cell,{fonts,textMeasurement:measurement,path:'slides.3.quote'});
  assert.equal(result.overflow,false);
  assert.equal(result.textMeasurement,'provided');
  assert.deepEqual(result.parts.map(part=>part.box),[
    {x:58,y:78,width:764,height:306},{x:58,y:402,width:764,height:40},
  ]);
  for (const part of result.parts) {
    assert.match(part.requestedStyle.fontFamily,/^Requested /);
    assert.match(part.style.fontFamily,/^Resolved /);
    for (const range of part.sources) {
      const original=value[range.path.split('.').at(-1)];
      assert.equal(part.text.slice(range.outputStart,range.outputEnd),original.slice(range.start,range.end));
    }
  }
  assert.deepEqual(result.parts[0].fit,fitText(`"${value.text}"`,result.parts[0].box,28,16,(text,size)=>[...text].length*size*.5));
  assert.deepEqual(result.parts[1].fit,fitText(`${value.attribution} - ${value.source}`,result.parts[1].box,17,16,(text,size)=>[...text].length*size*.5));
  assert.ok(seen.some(style=>style.fontWeight===600&&style.path==='slides.3.quote.text'));
  assert.ok(seen.some(style=>style.fontWeight===500&&style.path==='slides.3.quote'));
  assert.ok(seen.every(style=>style.fontFamily.startsWith('Resolved ')));
});

test('shorthand and empty metadata preserve schema paths without an invented footer', () => {
  for (const value of ['  Original\ntext  ',{text:'',attribution:'',source:''}]) {
    const result=layoutQuote(value,cell,{path:'slides.2.left.quote'});
    assert.equal(result.parts.length,1);
    assert.equal(result.parts[0].box.height,364);
    assert.equal(result.parts[0].sources[0].path,typeof value==='string'?'slides.2.left.quote':'slides.2.left.quote.text');
    assert.equal(result.parts[0].text,`"${typeof value==='string'?value:value.text}"`);
    assert.equal(result.textMeasurement,'estimated');
  }
});

test('long footer, body/footer collision and strict rejection remain explicit without source truncation', () => {
  const value={text:'A short quote',attribution:'Long attribution '.repeat(100)};
  const result=layoutQuote(value,cell,{path:'slides.0.quote'});
  assert.ok(result.diagnostics.some(item=>item.reason==='text-fit'&&item.parts[0]==='footer'));
  assert.equal(result.parts[1].text,value.attribution);
  assert.equal(result.parts[1].fit.fontSize,16);
  assert.throws(()=>layoutQuote(value,cell,{path:'slides.0.quote',overflow:'error'}),error=>{
    assert.ok(error instanceof OPFCompositionError);
    assert.deepEqual(error.diagnostics,result.diagnostics);
    return true;
  });
  const overlap=layoutQuote({text:'Long body '.repeat(400),attribution:'Retained footer'},cell);
  assert.ok(overlap.diagnostics.some(item=>item.reason==='part-overlap'));
  assert.ok(overlap.diagnostics.some(item=>item.reason==='text-fit'&&item.parts[0]==='body'));
});

test('tiny cells retain invalid available dimensions and never measure an invented fitting box', () => {
  let calls=0;
  const textMeasurement={measure:()=>{calls++;return 0;}};
  const result=layoutQuote({text:'Keep body',attribution:'Keep footer'},{x:0,y:0,width:30,height:30},{textMeasurement});
  assert.equal(calls,0);
  assert.equal(result.overflow,true);
  assert.ok(result.parts.every(part=>part.box.width===-6&&part.fit===undefined));
  assert.equal(result.diagnostics.filter(item=>item.reason==='invalid-part-box').length,2);
  const short=layoutQuote({text:'Q',source:'S'},{x:0,y:0,width:500,height:45});
  assert.ok(short.diagnostics.some(item=>item.reason==='part-outside-cell'));
});

test('explicit readability floors are respected after scaling, including above nominal footer size', () => {
  for (const scale of [.75,1,1.5]) {
    const result=layoutQuote({text:'Body',attribution:'Footer'},cell,{scale,minFontSize:32});
    for (const part of result.parts) {
      assert.equal(part.minFontSize,32*scale);
      assert.ok(part.requestedFontSize>=32*scale);
      assert.ok(part.fit.fontSize>=32*scale);
    }
    // Insets intentionally preserve the published reference-pixel geometry at every scale.
    assert.equal(result.parts[0].box.x,58);
  }
});

test('invalid content, geometry, scales and policies fail before reporting a usable layout', () => {
  for (const value of [null,[],{},{text:12},{text:'Body',attribution:null}]) assert.throws(()=>layoutQuote(value,cell),TypeError);
  for (const box of [{...cell,x:NaN},{...cell,width:0},{...cell,height:Infinity}]) assert.throws(()=>layoutQuote('Body',box),RangeError);
  for (const options of [{scale:0},{scale:Infinity},{minFontSize:-1},{minFontSize:NaN},{overflow:'ignore'}]) assert.throws(()=>layoutQuote('Body',cell,options),RangeError);
});
