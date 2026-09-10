import assert from 'node:assert/strict';
import {resolvePresentation,renderSvg} from '../dist/svg.js';
import {loadOfficeFontRegistry} from '../dist/fonts-node.js';
import {validatePresentation} from '@openpresentation/opf';
const fonts=await loadOfficeFontRegistry();
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
let cases=0;
for (const dimensions of [{width:1280,height:720},{width:540,height:960}]) {
  for (const code of ['', '\r\n\r\n\n', 'a\tb\n\n', {source:'\tconst value = "two  spaces";\r\nreturn "<&>";  \n',filename:'src/CaseSensitive.ts',language:'TypeScript'},
    {source:'body',language:'Long-language-label-'.repeat(20)}]) {
    const deck={design:{dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96},fontScheme:'roboto'},slides:[{composition:{mode:'column',minFontSize:24},blocks:[{blocks:[{code}]}]}]};
    const before=structuredClone(deck);let calls=0,styles=0;
    const textMeasurement={measure:(...args)=>{calls++;return fonts.textMeasurement.measure(...args);},resolveStyle:style=>{styles++;return fonts.textMeasurement.resolveStyle(style);}};
    const bound=resolvePresentation(deck,{textMeasurement}).slides[0],expectedCalls=calls,expectedStyles=styles;
    calls=0;styles=0;
    const diagnostics=[],svg=renderSvg(deck,{textMeasurement,trace:true,onDiagnostic:item=>diagnostics.push(item)});
    assert.equal(calls,expectedCalls,'No code measurement after acceptance');assert.equal(styles,expectedStyles,'No repeated style resolution');
    assert.deepEqual(diagnostics,[]);assert.deepEqual(deck,before);
    const parts=bound.geometry.items[0].codeLayout.parts,groups=[...svg.matchAll(/<g\b([^>]*data-opf-code-role[^>]*)>/g)];
    assert.equal(groups.length,parts.length);
    groups.forEach(([,attrs],index)=>{
      const part=parts[index],attribute=name=>new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
      assert.equal(attribute('data-opf-path'),part.path);
      for(const dimension of ['x','y','width','height'])assert.equal(Number(attribute('data-opf-box-'+dimension)),part.box[dimension],`Accepted ${part.role} edit-target ${dimension}`);
    });
    const expected=bound.geometry.items[0].codeLayout.parts.flatMap(part=>part.fit.sourceLines.map((line,index)=>({part,line,index})));
    const lines=[...svg.matchAll(/<text\b([^>]*?)(?:\/>|>([\s\S]*?)<\/text>)/g)];
    assert.equal(lines.length,expected.length);
    lines.forEach(([,attrs,content=''],index)=>{
      const {part,line,index:lineIndex}=expected[index];
      const attribute=name=>new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
      assert.equal(attribute('data-opf-path'),part.path);assert.equal(attribute('data-opf-code-role'),part.role);
      assert.equal(attribute('xml:space'),'preserve');assert.equal(attribute('style'),'white-space:pre');assert.equal(attribute('text-rendering'),'geometricPrecision');
      assert.equal(Number(attribute('font-size')),part.fit.fontSize);assert.equal(Number(attribute('font-weight')),part.style.fontWeight);
      assert.equal(Number(attribute('data-opf-text-start')),line.start);assert.equal(Number(attribute('data-opf-text-end')),line.end);
      assert.equal(Number(attribute('data-opf-text-next-start')),line.nextStart);assert.equal(attribute('data-opf-line-boundary'),line.boundary);
      assert.ok(Math.abs(Number(attribute('x'))-part.box.x)<.002);assert.ok(Math.abs(Number(attribute('y'))-(part.box.y+part.fit.fontSize+lineIndex*part.fit.lineHeight))<.002);
      assert.equal(content.replace(/<\/?tspan\b[^>]*>/g,''),escape(part.text.slice(line.start,line.end)));
      const segments=[...content.matchAll(/<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/g)];assert.equal(segments.length,line.segments.length);
      segments.forEach(([,attrs,text],i)=>{
        const expected=line.segments[i],attribute=name=>new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
        assert.equal(text,escape(part.text.slice(expected.start,expected.end)));assert.equal(attribute('data-opf-segment'),expected.kind);
        assert.ok(Math.abs(Number(attribute('x'))-(part.box.x+expected.x))<.002);
        if(expected.kind==='tab'){assert.ok(Math.abs(Number(attribute('textLength'))-expected.width)<.002);assert.equal(attribute('lengthAdjust'),'spacingAndGlyphs');}
      });
    });
    cases++;
  }
}
const overflow={design:{fontScheme:'roboto'},slides:[{code:{source:'Unabridged body\n'.repeat(100),language:'Keep case'}}]},diagnostics=[];
renderSvg(overflow,{textMeasurement:fonts.textMeasurement,onDiagnostic:item=>diagnostics.push(item)});
assert.ok(diagnostics.some(item=>item.path==='slides.0.code.source'&&item.reason==='text-fit'));
overflow.slides[0].composition={overflow:'error'};
assert.throws(()=>renderSvg(overflow,{textMeasurement:fonts.textMeasurement}),{code:'layout-overflow'});
const tiny={design:{fontScheme:'roboto',dimensions:{widthInches:40/96,heightInches:40/96}},slides:[{composition:{padding:0},code:'Keep all text'}]};
assert.throws(()=>renderSvg(tiny,{textMeasurement:fonts.textMeasurement}),{code:'layout-overflow'});
const forbidden=[...Array.from({length:32},(_,i)=>i).filter(i=>![9,10,13].includes(i)),0xD800,0xDFFF,0xFFFE,0xFFFF];
let invalidCases=0;
for (const point of forbidden) for (const field of ['shorthand','source','filename','language']) {
  const value='A😀B'+String.fromCodePoint(point)+'Z',code=field==='shorthand'?value:{source:'Keep source',filename:'Keep.ts',language:'TypeScript',[field]:value};
  const deck={slides:[{blocks:[{code}]}]},before=structuredClone(deck);
  assert.equal(validatePresentation(deck).valid,true,'Schema validity is separate from XML representability');
  const path='slides.0.blocks.0.code'+(field==='shorthand'?'':'.'+field);
  assert.throws(()=>renderSvg(deck),error=>error.code==='invalid-code-text'&&error.path===path&&error.message.includes('UTF-16 offset 4'));
  assert.deepEqual(deck,before);invalidCases++;
}
// XML character boundaries, not a glyph-coverage or shaping claim.
const representable='\t\n\r\n\r <&>" \uD7FF\uE000\uFFFD\u{10000}\u{10FFFF}';
const accepted=renderSvg({slides:[{code:representable}]});
for (const character of ['\uD7FF','\uE000','\uFFFD','\u{10000}','\u{10FFFF}']) assert.ok(accepted.includes(character));
assert.ok(accepted.includes('&lt;&amp;&gt;'));
console.log(`Shared code SVG: ${cases} accepted layouts, source/whitespace/trace preservation, no extra measurement, strict/tiny-cell rejection, ${invalidCases} XML-boundary rejections and valid character boundaries.`);
