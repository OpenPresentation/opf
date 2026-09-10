import assert from 'node:assert/strict';
import {resolvePresentation,renderSvg} from '../dist/svg.js';
import {loadOfficeFontRegistry} from '../dist/fonts-node.js';
const fonts=await loadOfficeFontRegistry();
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
let cases=0;
for (const dimensions of [{width:1280,height:720},{width:540,height:960}]) {
  for (const value of ['Shorthand source',{text:'A quote with its original context.',attribution:'Author',source:'Citation'}]) {
    const deck={design:{dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96},fontScheme:'roboto'},slides:[{composition:{mode:'column',minFontSize:24},blocks:[{blocks:[{quote:value}]}]}]};
    let calls=0,styles=0;
    const textMeasurement={measure:(...args)=>{calls++;return fonts.textMeasurement.measure(...args);},resolveStyle:style=>{styles++;return fonts.textMeasurement.resolveStyle(style);}};
    const bound=resolvePresentation(deck,{textMeasurement}).slides[0],expectedCalls=calls,expectedStyles=styles;
    calls=0;styles=0;
    const diagnostics=[];
    const svg=renderSvg(deck,{textMeasurement,trace:true,onDiagnostic:item=>diagnostics.push(item)});
    assert.equal(calls,expectedCalls,'Rendering must not repeat accepted quote measurements');
    assert.equal(styles,expectedStyles,'Rendering must consume the accepted resolved styles');
    assert.deepEqual(diagnostics,[]);
    assert.ok(svg.includes(`viewBox="0 0 ${dimensions.width} ${dimensions.height}"`));
    const lines=[...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)];
    const expected=bound.geometry.items[0].quoteLayout.parts.flatMap(part=>part.fit.lines.map((line,index)=>({part,line,index})));
    assert.equal(lines.length,expected.length);
    lines.forEach(([,attrs,value],index)=>{
      const {part,line,index:lineIndex}=expected[index];
      const attribute=name=>new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
      assert.equal(value,escape(line));
      assert.equal(attribute('data-opf-path'),part.path);
      assert.equal(Number(attribute('font-size')),part.fit.fontSize);
      assert.equal(Number(attribute('font-weight')),part.style.fontWeight);
      assert.ok(Math.abs(Number(attribute('x'))-part.box.x)<.002);
      assert.ok(Math.abs(Number(attribute('y'))-(part.box.y+part.fit.fontSize+lineIndex*part.fit.lineHeight))<.002);
    });
    cases++;
  }
}
const overflow={design:{fontScheme:'roboto'},slides:[{quote:{text:'Unabridged body. '.repeat(500),attribution:'Footer'}}]};
const diagnostics=[];
renderSvg(overflow,{textMeasurement:fonts.textMeasurement,onDiagnostic:item=>diagnostics.push(item)});
assert.ok(diagnostics.some(item=>item.reason==='part-overlap'));
assert.ok(diagnostics.some(item=>item.reason==='text-fit'));
assert.equal(new Set(diagnostics.map(item=>`${item.code}:${item.path}:${item.reason}`)).size,diagnostics.length);
overflow.slides[0].composition={overflow:'error'};
assert.throws(()=>renderSvg(overflow,{textMeasurement:fonts.textMeasurement}),{code:'layout-overflow'});
const tiny={design:{fontScheme:'roboto',dimensions:{widthInches:40/96,heightInches:40/96}},slides:[{composition:{padding:0},quote:{text:'Keep body',attribution:'Keep source'}}]};
assert.throws(()=>renderSvg(tiny,{textMeasurement:fonts.textMeasurement}),{code:'layout-overflow'});
console.log(`Shared quote SVG: ${cases} exact accepted layouts/styles with no extra measurement, reasoned overflow, strict rejection and no tiny-cell omission.`);
