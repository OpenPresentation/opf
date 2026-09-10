import assert from 'node:assert/strict';
import {XMLParser} from 'fast-xml-parser';
import {unzipSync} from 'fflate';
import {resolvePresentation} from '@openpresentation/opf-render/svg';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
import {toPptx,fromPptx} from '../dist/index.js';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const all=(node,name)=>!node||typeof node!=='object'?[]:Object.entries(node).flatMap(([key,value])=>[...(key===name?[value].flat():[]),...all(value,name)]);
const text=value=>typeof value==='string'?value:value?.['#text']??'';
const fonts=await loadOfficeFontRegistry();
let cases=0,lines=0;
for (const dimensions of [{width:1280,height:720},{width:540,height:960}]) {
  for (const quote of ['Shorthand source',{text:'A quote with its original context.',attribution:'Author',source:'Citation'}]) {
    const deck={design:{dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96},fontScheme:'roboto'},slides:[{composition:{mode:'column',minFontSize:24},blocks:[{blocks:[{quote}]}]}]};
    let calls=0;
    const textMeasurement={...fonts.textMeasurement,measure:(...args)=>{calls++;return fonts.textMeasurement.measure(...args);}};
    const bound=resolvePresentation(deck,{textMeasurement}).slides[0],expectedCalls=calls;
    calls=0;
    const diagnostics=[];
    const bytes=await toPptx(deck,{textMeasurement,onDiagnostic:item=>diagnostics.push(item)});
    assert.equal(calls,expectedCalls,'Native export must not re-fit accepted quote parts');
    assert.deepEqual(diagnostics,[]);
    const entries=unzipSync(bytes),native=parser.parse(new TextDecoder().decode(entries['ppt/slides/slide1.xml']));
    const size=all(parser.parse(new TextDecoder().decode(entries['ppt/presentation.xml'])),'p:sldSz')[0];
    assert.equal(Number(size.cx),dimensions.width*9525);
    assert.equal(Number(size.cy),dimensions.height*9525);
    const shapes=all(native,'p:sp').filter(shape=>all(shape,'a:t').length);
    const expected=bound.geometry.items[0].quoteLayout.parts.flatMap(part=>part.fit.lines.flatMap((line,index)=>line?[{part,line,index}]:[]));
    assert.equal(shapes.length,expected.length);
    shapes.forEach((shape,index)=>{
      const {part,line,index:lineIndex}=expected[index];
      assert.equal(all(shape,'a:t').map(text).join(''),line);
      const run=all(shape,'a:rPr')[0],transform=all(shape,'a:xfrm')[0];
      assert.equal(all(run,'a:latin')[0].typeface,part.style.fontFace.family);
      assert.equal(run.b==='1',part.style.fontFace.bold);
      assert.equal(run.i==='1',part.style.fontFace.italic);
      assert.ok(Math.abs(Number(run.sz)/100-part.fit.fontSize*.75)<.02);
      assert.ok(Math.abs(Number(transform['a:off'].x)/9525-part.box.x)<.002);
      assert.ok(Math.abs(Number(transform['a:off'].y)/9525-(part.box.y+lineIndex*part.fit.lineHeight))<.002);
      assert.ok(Math.abs(Number(transform['a:ext'].cx)/9525-part.box.width)<.002);
      assert.ok(Math.abs(Number(transform['a:ext'].cy)/9525-part.fit.lineHeight)<.002);
      lines++;
    });
    const imported=await fromPptx(bytes);
    assert.equal(imported.slides.length,1);
    assert.ok(JSON.stringify(imported).includes(typeof quote==='string'?'Shorthand source':'Author - Citation'));
    cases++;
  }
}
const strict={design:{fontScheme:'roboto'},slides:[{composition:{overflow:'error'},blocks:[{quote:{text:'Keep body',attribution:'Unabridged attribution. '.repeat(1000)}}]}]};
await assert.rejects(()=>toPptx(strict,{textMeasurement:fonts.textMeasurement}),{code:'layout-overflow'});
const tiny={design:{fontScheme:'roboto',dimensions:{widthInches:40/96,heightInches:40/96}},slides:[{composition:{padding:0},quote:{text:'Keep body',attribution:'Keep source'}}]};
await assert.rejects(()=>toPptx(tiny,{textMeasurement:fonts.textMeasurement}),{code:'layout-overflow'});
console.log(`Shared quote PPTX: ${cases} wide/portrait decks and ${lines} native lines match accepted geometry/styles without re-fitting; reimport and strict/unusable-space rejection pass.`);
