import assert from 'node:assert/strict';
import {test} from 'node:test';
import {layoutCode,OPFCompositionError} from '../dist/composition.js';
import {layoutCode as rootLayoutCode} from '../dist/index.js';

const cell={x:40,y:60,width:800,height:400};
const restore=part=>part.fit.sourceLines.map(line=>part.text.slice(line.start,line.nextStart)).join('');
function assertSource(part) {
  assert.equal(restore(part),part.text);
  assert.deepEqual(part.fit.lines,part.fit.sourceLines.map(line=>part.text.slice(line.start,line.end)));
  let cursor=0;
  for (const line of part.fit.sourceLines) {
    assert.equal(line.start,cursor);
    assert.ok(line.start<=line.end&&line.end<=line.nextStart);
    if (line.boundary==='hard') assert.match(part.text.slice(line.end,line.nextStart),/^(\r\n|\r|\n)$/);
    else assert.equal(line.end,line.nextStart);
    assert.equal(line.segments.map(segment=>part.text.slice(segment.start,segment.end)).join(''),part.text.slice(line.start,line.end));
    let x=0,position=line.start;
    for (const segment of line.segments) {
      assert.equal(segment.start,position);assert.equal(segment.x,x);
      if (segment.kind==='tab') assert.equal(part.text.slice(segment.start,segment.end),'\t');
      position=segment.end;x+=segment.width;
    }
    assert.equal(position,line.end);assert.ok(Math.abs(x-line.width)<1e-8);
    cursor=line.nextStart;
  }
  assert.equal(cursor,part.text.length);
}

test('complete code parts preserve exact filename, language, body, whitespace and hard line boundaries',()=>{
  const source='def check():\r\n    value = "two  spaces"\n\treturn value  \r\n';
  const value=Object.freeze({source,filename:'src/CaseSensitive.py',language:'Python'});
  const result=layoutCode(value,cell,{path:'slides.2.left.code'});
  assert.deepEqual(rootLayoutCode(value,cell,{path:'slides.2.left.code'}),result);
  assert.equal(result.algorithm,'code-flow-v1');
  assert.equal(result.overflow,false);
  assert.equal(result.textMeasurement,'estimated');
  assert.deepEqual(result.parts.map(part=>[part.role,part.text]),[['filename',value.filename],['language','Python'],['body',source]]);
  for (const part of result.parts) {
    assert.equal(part.generated,false);
    assert.deepEqual(part.sources,[{path:part.path,start:0,end:part.text.length}]);
    assertSource(part);
  }
  assert.equal(result.parts[2].path,'slides.2.left.code.source');
  assert.deepEqual(result.parts[2].fit.lines,['def check():','    value = "two  spaces"','\treturn value  ','']);
});

test('shorthand, empty source and absent metadata retain their source and generated-label distinction',()=>{
  for (const value of ['', '  source  ', {source:'',filename:'',language:''}, {source:'',filename:'file.txt'}]) {
    const result=layoutCode(value,cell,{path:'slides.0.code'}),body=result.parts.at(-1);
    assert.equal(body.text,typeof value==='string'?value:value.source);
    assert.equal(body.path,typeof value==='string'?'slides.0.code':'slides.0.code.source');
    assertSource(body);
    if (typeof value==='string'||!value.filename) {
      assert.equal(result.parts[0].text,'code');assert.equal(result.parts[0].generated,true);assert.deepEqual(result.parts[0].sources,[]);
    } else assert.deepEqual(result.parts.map(part=>part.role),['filename','body']);
  }
});

test('long language labels and filenames are measured within their cell before allocating the body',()=>{
  const result=layoutCode({source:'const value = 42;',filename:'path/to/long-name/'.repeat(12),language:'very-long-language-label-'.repeat(20)},
    {x:0,y:0,width:1200,height:650});
  assert.equal(result.overflow,false);
  for (const part of result.parts) {
    assertSource(part);
    assert.ok(part.fit.sourceLines.every(line=>line.width<=part.box.width+.01));
    assert.ok(part.box.y+part.fit.lines.length*part.fit.lineHeight<=650);
  }
  assert.ok(result.parts[1].fit.lines.length>1);
  assert.ok(result.parts[2].box.y>result.parts[1].box.y+result.parts[1].box.height);
});

test('wrapped whitespace and graphemes retain contiguous source offsets, including CRLF and blank final lines',()=>{
  const text='  e\u0301👩‍🔬  \t abcdefghijklmnop\r\n\r\nlast  \n';
  const segmenter=new Intl.Segmenter('und',{granularity:'grapheme'});
  const boundaries=new Set([0,text.length,...[...segmenter.segment(text)].flatMap(item=>[item.index,item.index+item.segment.length])]);
  const result=layoutCode(text,{x:0,y:0,width:95,height:800},{minFontSize:8});
  const body=result.parts.at(-1);assert.equal(result.overflow,false);assertSource(body);
  for (const line of body.fit.sourceLines) {assert.ok(boundaries.has(line.start));assert.ok(boundaries.has(line.end));}
  assert.ok(body.fit.sourceLines.some(line=>line.boundary==='soft'));
  assert.equal(body.fit.lines.at(-1),'');
});

test('tabs use measured space stops and never send control tabs to the font-width provider',()=>{
  const seen=[],resolved=[];
  const measurement={resolveStyle:style=>{resolved.push(style);return {...style,fontFamily:'Resolved Code'};},
    measure:(text,size,style)=>{assert.equal(text.includes('\t'),false);seen.push(style);return [...text].length*size*.5;}};
  const result=layoutCode({source:'a\tb\naaaa\tb',language:'ts'},cell,{fonts:{code:'Requested Code'},textMeasurement:measurement,path:'slides.1.code'});
  const body=result.parts.at(-1);
  assert.equal(result.textMeasurement,'provided');
  assert.equal(resolved.length,result.parts.length);
  assert.ok(result.parts.every(part=>part.requestedStyle.fontFamily==='Requested Code'&&part.style.fontFamily==='Resolved Code'));
  assert.ok(seen.every(style=>style.fontFamily==='Resolved Code'));
  assert.equal(body.fit.tabWidth,36);
  assert.deepEqual(body.fit.sourceLines.map(line=>line.width),[45,81]);
  assert.deepEqual(body.fit.sourceLines[0].segments,[
    {kind:'text',start:0,end:1,x:0,width:9},
    {kind:'tab',start:1,end:2,x:9,width:27},
    {kind:'text',start:2,end:3,x:36,width:9},
  ]);
  assertSource(body);
  assert.throws(()=>layoutCode('\t',cell,{textMeasurement:{measure:()=>0}}),/positive finite measured space/);
  assert.throws(()=>layoutCode('x',cell,{textMeasurement:{measure:()=>1e308}}),/positive finite measured space/);
});

test('readability floors scale once and body shrinking preserves all code content',()=>{
  for (const scale of [.75,1,1.5]) {
    const result=layoutCode({source:'value',filename:'file',language:'lang'},cell,{scale,minFontSize:32});
    assert.equal(result.overflow,false);
    for (const part of result.parts) {assert.equal(part.fit.fontSize,32*scale);assert.equal(part.minFontSize,32*scale);assertSource(part);}
  }
  const result=layoutCode('line\n'.repeat(8),{x:0,y:0,width:300,height:250});
  assert.equal(result.overflow,false);
  assert.ok(result.parts.at(-1).fit.fontSize<18);
  assert.ok(result.parts.every(part=>part.fit.fontSize>=16));
  assertSource(result.parts.at(-1));
});

test('irreducible body and metadata failures remain explicit; strict mode does not return partial output',()=>{
  for (const value of [{source:'many lines\n'.repeat(150),language:'kept'}, {source:'kept',filename:'long filename '.repeat(200)}]) {
    const result=layoutCode(value,{x:0,y:0,width:300,height:200},{path:'slides.0.code'});
    assert.equal(result.overflow,true);assert.ok(result.diagnostics.length);
    assert.equal(result.parts.at(-1).text,value.source);
    assert.throws(()=>layoutCode(value,{x:0,y:0,width:300,height:200},{path:'slides.0.code',overflow:'error'}),error=>{
      assert.ok(error instanceof OPFCompositionError);assert.deepEqual(error.diagnostics,result.diagnostics);return true;
    });
    for (const part of result.parts) if (part.fit) assertSource(part);
  }
});

test('invalid inner boxes never become invented one-pixel fits; malformed options reject',()=>{
  let calls=0;
  const result=layoutCode('retained',{x:0,y:0,width:30,height:30},{textMeasurement:{measure:()=>{calls++;return 1;}}});
  assert.equal(calls,0);assert.equal(result.overflow,true);assert.ok(result.parts.every(part=>part.box.width===-6&&!part.fit));
  for (const value of [null,[],{},{source:42},{source:'x',filename:null}]) assert.throws(()=>layoutCode(value,cell),TypeError);
  for (const options of [{scale:0},{scale:1e308},{minFontSize:NaN},{minFontSize:1.7e308},{overflow:'ignore'}]) assert.throws(()=>layoutCode('x',cell,options),RangeError);
  for (const box of [{...cell,x:NaN},{...cell,width:0},{...cell,x:1e308,width:1e308}]) assert.throws(()=>layoutCode('x',box),RangeError);
});

test('font trials stay bounded independently of canvas scale',()=>{
  for (const scale of [.25,1,10]) {
    let trials=0;
    const textMeasurement={measure:(text,size)=>{if(text===' ')trials++;return text.length*size*.5;}};
    layoutCode({source:'x\n'.repeat(100),filename:'file',language:'lang'},cell,{scale,minFontSize:8,textMeasurement});
    // At most four metadata combinations, each with two header fits and 19
    // body sizes. This provider sees one measured-space request per fit trial.
    assert.ok(trials>0&&trials<=84,`Unexpected trial count at scale ${scale}: ${trials}`);
  }
});
