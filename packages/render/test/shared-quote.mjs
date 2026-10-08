import assert from 'node:assert/strict';
// FA-23: the documents name gallery records, so they render with the gallery snapshot registered, as a host does. Core's
// packed-ecosystem checks copy this file and rewrite its relative imports, so it registers the catalog itself.
import {defaultCatalog} from '@openpresentation/opf/catalog';
import {resolvePresentation as resolvePresentationUnregistered, renderSlideSvg as renderSlideSvgUnregistered} from '../dist/svg.js';
const catalogs = [defaultCatalog];
const resolvePresentation = (deck, options = {}) => resolvePresentationUnregistered(deck, {catalogs, ...options});
const renderSlideSvg = (deck, index, options = {}) => renderSlideSvgUnregistered(deck, index, {catalogs, ...options});
import {loadFonts} from '../dist/fonts-node.js';
const fonts=(await loadFonts({pack: 'office'})).registry;
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
let cases=0;
for (const dimensions of [{width:1280,height:720},{width:540,height:960}]) {
  for (const value of ['Shorthand source',{text:'A quote with its original context.',attribution:'Author',source:'Citation'}]) {
    const deck={design:{dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96},fontScheme:'roboto'},slides:[{composition:{mode:'column',minFontSize:24},blocks:[{blocks:[{quote:value}]}]}]};
    let calls=0,styles=0;
    const textMeasurement={measure:(...args)=>{calls++;return fonts.textMeasurement.measure(...args);},resolveStyle:style=>{styles++;return fonts.textMeasurement.resolveStyle(style);}};
    const bound=resolvePresentation(deck,{ fonts: {textMeasurement}}).slides[0],expectedCalls=calls,expectedStyles=styles;
    calls=0;styles=0;
    const diagnostics=[];
    const svg=renderSlideSvg(deck, 0,{ fonts: {textMeasurement},trace:true,onDiagnostic:item=>diagnostics.push(item)});
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
renderSlideSvg(overflow, 0,{ fonts: {textMeasurement:fonts.textMeasurement},onDiagnostic:item=>diagnostics.push(item)});
assert.ok(diagnostics.some(item=>item.reason==='part-overlap'));
assert.ok(diagnostics.some(item=>item.reason==='text-fit'));
assert.equal(new Set(diagnostics.map(item=>`${item.code}:${item.path}:${item.reason}`)).size,diagnostics.length);
overflow.slides[0].composition={overflow:'error'};
assert.throws(()=>renderSlideSvg(overflow, 0,{ fonts: {textMeasurement:fonts.textMeasurement}}),{code:'layout-overflow'});
const tiny={design:{fontScheme:'roboto',dimensions:{widthInches:40/96,heightInches:40/96}},slides:[{composition:{padding:0},quote:{text:'Keep body',attribution:'Keep source'}}]};
assert.throws(()=>renderSlideSvg(tiny, 0,{ fonts: {textMeasurement:fonts.textMeasurement}}),{code:'layout-overflow'});
console.log(`Shared quote SVG: ${cases} exact accepted layouts/styles with no extra measurement, reasoned overflow, strict rejection and no tiny-cell omission.`);
