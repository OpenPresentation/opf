import assert from 'node:assert/strict';
import {renderSvg,resolvePresentation} from '../dist/index.js';
import {loadOfficeFontRegistry} from '../dist/fonts-node.js';
import {acceptedTextFixtures} from './accepted-text-fixtures.mjs';
const fonts=await loadOfficeFontRegistry({substitutionPolicy:'visual'});
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
let cases=0;
for(const outlines of [false,true])for(const {id,deck} of acceptedTextFixtures()) {
  const source=JSON.stringify(deck);
  let calls=0,styles=0,inkCalls=0;
  const options={trace:true,textMeasurement:{measure(...args){calls++;return fonts.textMeasurement.measure(...args);},
    resolveStyle(style){styles++;return fonts.textMeasurement.resolveStyle(style);},
    ...(outlines?{outlineBounds(...args){inkCalls++;return fonts.textMeasurement.outlineBounds(...args);}}:{})}};
  const bound=resolvePresentation(deck,options).slides[0],expectedCalls=calls,expectedStyles=styles,expectedInkCalls=inkCalls;
  calls=0;styles=0;inkCalls=0;
  const diagnostics=[],svg=renderSvg(deck,{...options,onDiagnostic:issue=>diagnostics.push(issue)});
  assert.equal(calls,expectedCalls,`${id}: painting must not measure accepted text again`);
  assert.equal(styles,expectedStyles,`${id}: painting must consume resolved styles`);
  assert.equal(inkCalls,expectedInkCalls,`${id}: painting must consume accepted outlines`);
  assert.deepEqual(diagnostics,bound.geometry.diagnostics);
  assert.equal(JSON.stringify(deck),source);
  const nodes=[...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)];let cursor=0;
  for(const item of bound.geometry.items) {
    const fit=item.text,align=item.field==='title'?bound.design.titleAlignment:bound.design.contentAlignment;
    const lines=fit.richLines?fit.richLines.flatMap((line,index)=>line.fragments.map(fragment=>({line,fragment,index}))):fit.lines.map((text,index)=>({text,index}));
    for(const entry of lines) {
      const [,attrs,text]=nodes[cursor++],attr=name=>new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
      const fragment=entry.fragment,style=fragment?.style??item.textStyle;
      const placed=fit.placement?.lines[entry.index],factor=align==='right'?1:align==='center'?.5:0;
      const x=placed?placed.x+(fragment?fragment.x:placed.width*factor):fragment?item.box.x+(align==='right'?item.box.width-entry.line.width:align==='center'?(item.box.width-entry.line.width)/2:0)+fragment.x:
        item.box.x+(align==='right'?item.box.width:align==='center'?item.box.width/2:0);
      const y=placed?placed.baseline+(fragment?.baselineShift??0):item.box.y+(fragment?entry.line.baseline+fragment.baselineShift:fit.fontSize+entry.index*fit.lineHeight);
      assert.equal(text,escape(fragment?.text??entry.text),id);
      assert.ok(Math.abs(Number(attr('x'))-x)<.001,id);
      assert.ok(Math.abs(Number(attr('y'))-y)<.001,id);
      assert.ok(Math.abs(Number(attr('font-size'))-(fragment?.fontSize??fit.fontSize))<.001,id);
      assert.equal(Number(attr('font-weight')),style.fontWeight,id);
      assert.ok(attr('font-family').startsWith(style.fontFamily+','),id);
      assert.equal(attr('font-style'),style.italic?'italic':undefined,id);
      if(!fragment)assert.equal(attr('data-opf-path'),item.path,id);
    }
  }
  assert.equal(cursor,nodes.length,id);cases++;
}
for(const text of ['Unabridged content. '.repeat(400),[{text:'Unabridged rich content. '.repeat(400),bold:true}]]) {
  const deck={design:{fontScheme:'roboto'},slides:[{text}]},issues=[];
  renderSvg(deck,{textMeasurement:fonts.textMeasurement,onDiagnostic:issue=>issues.push(issue)});
  assert.equal(issues.filter(issue=>issue.code==='text-overflow'&&issue.path==='slides.0.text').length,1);
  deck.slides[0].composition={overflow:'error'};
  assert.throws(()=>renderSvg(deck,{textMeasurement:fonts.textMeasurement}),{code:'layout-overflow'});
}
console.log(`Accepted text: ${cases} wide/portrait/card/alignment/scalar/rich cases consume exact accepted fits and styles; overflow diagnostics and strict rejection pass.`);
