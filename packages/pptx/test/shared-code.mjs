import assert from 'node:assert/strict';
import {XMLParser} from 'fast-xml-parser';
import {unzipSync} from 'fflate';
import {resolvePresentation} from '@openpresentation/opf-render/svg';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
import {validatePresentation} from '@openpresentation/opf';
import {toPptx,fromPptx} from '../dist/index.js';
import PptxGenJS from '../vendor/pptxgenjs/pptxgen.es.js';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const all=(node,name)=>!node||typeof node!=='object'?[]:Object.entries(node).flatMap(([key,value])=>[...(key===name?[value].flat():[]),...all(value,name)]);
const text=value=>typeof value==='string'?value:value?.['#text']??'';
const fonts=await loadOfficeFontRegistry();let cases=0,lines=0,tabs=0;
for(const dimensions of [{width:1280,height:720},{width:540,height:960}]) for(const code of [
  '', '\t\t', {source:'  const value = "two  spaces";\r\n\treturn value;  \n',language:'TypeScript',filename:'src\tCaseSensitive.ts'},
  {source:'body',language:'long-language-label-'.repeat(20)},
]) {
  const deck={design:{dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96},fontScheme:'roboto'},slides:[{composition:{minFontSize:24},code}]};
  const before=structuredClone(deck);let calls=0;
  const textMeasurement={...fonts.textMeasurement,measure:(...args)=>{calls++;return fonts.textMeasurement.measure(...args);}};
  const bound=resolvePresentation(deck,{textMeasurement}).slides[0],expectedCalls=calls;calls=0;
  const bytes=await toPptx(deck,{textMeasurement});assert.equal(calls,expectedCalls,'Export must consume accepted code fits');assert.deepEqual(deck,before);
  const entries=unzipSync(bytes),native=parser.parse(new TextDecoder().decode(entries['ppt/slides/slide1.xml']));
  const shapes=all(native,'p:sp').filter(shape=>all(shape,'p:cNvPr').some(item=>/^OPF code \d+ .+ line \d+$/.test(item.name)));
  const expected=bound.geometry.items[0].codeLayout.parts.flatMap(part=>part.fit.sourceLines.map((line,index)=>({part,line,index})));
  assert.equal(shapes.length,expected.length,'Blank accepted lines remain native shapes');
  for(const [index,shape] of shapes.entries()) {
    const {part,line,index:lineIndex}=expected[index];
    assert.equal(all(shape,'a:t').map(text).join(''),part.text.slice(line.start,line.end));
    const transform=all(shape,'a:xfrm')[0],run=all(shape,'a:rPr')[0]??all(shape,'a:defRPr')[0];
    assert.ok(Math.abs(Number(transform['a:off'].x)/9525-part.box.x)<.002);assert.ok(Math.abs(Number(transform['a:off'].y)/9525-(part.box.y+lineIndex*part.fit.lineHeight))<.002);
    if(run){assert.equal(all(run,'a:latin')[0].typeface,part.style.fontFamily);assert.ok(Math.abs(Number(run.sz)/100-part.fit.fontSize*.75)<.02);}
    const stops=all(shape,'a:tab'),expectedStops=line.segments.filter(segment=>segment.kind==='tab');assert.equal(stops.length,expectedStops.length);
    stops.forEach((stop,i)=>{assert.equal(stop.algn,'l');assert.ok(Math.abs(Number(stop.pos)/9525-expectedStops[i].x-expectedStops[i].width)<.002);tabs++;});
    lines++;
  }
  cases++;
  const diagnostics=[];
  const imported=await fromPptx(bytes,{onDiagnostic:issue=>diagnostics.push(issue)});
  assert.deepEqual(imported.slides[0].blocks,[{type:'code',code}],'Source, metadata and hard/soft boundaries round-trip exactly');
  assert.deepEqual(diagnostics.map(issue=>issue.code),['code-import-reflow']);
}
for(const source of ['a\tb','  indentation  ','\t\t','a\t','\nfirst\n\nlast\n',' \t \tkeep  ']) {
  const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.addSlide().addText(source,{x:1,y:2,w:10,h:3,fontSize:13.5,fontFace:'Courier New',margin:0});
  const imported=await fromPptx(await pptx.write({outputType:'uint8array'}));
  assert.equal(imported.slides[0].blocks[0].text,source,'Native shape import preserves meaningful whitespace and unbulleted paragraphs');
}
for(const code of [{source:'Body\n'.repeat(500)}, {source:'',filename:'Metadata '.repeat(1000)}]) {
  await assert.rejects(()=>toPptx({design:{fontScheme:'roboto'},slides:[{composition:{overflow:'error'},code}]},{textMeasurement:fonts.textMeasurement}),{code:'layout-overflow'});
}
const forbidden=[...Array.from({length:32},(_,i)=>i).filter(i=>![9,10,13].includes(i)),0xD800,0xDFFF,0xFFFE,0xFFFF];
let invalidCases=0;
for (const point of forbidden) for (const field of ['shorthand','source','filename','language']) {
  const value='A😀B'+String.fromCodePoint(point)+'Z',code=field==='shorthand'?value:{source:'Keep source',filename:'Keep.ts',language:'TypeScript',[field]:value};
  const deck={slides:[{blocks:[{code}]}]},before=structuredClone(deck);
  assert.equal(validatePresentation(deck).valid,true,'Schema validity is separate from XML representability');
  const path='slides.0.blocks.0.code'+(field==='shorthand'?'':'.'+field);
  await assert.rejects(()=>toPptx(deck),error=>error.code==='invalid-code-text'&&error.path===path&&error.message.includes('UTF-16 offset 4'));
  assert.deepEqual(deck,before);invalidCases++;
}
// XML character boundaries, not a glyph-coverage or shaping claim.
const representable='\t\n\r\n\r <&>" \uD7FF\uE000\uFFFD\u{10000}\u{10FFFF}';
assert.equal((await fromPptx(await toPptx({slides:[{code:representable}]}))).slides[0].blocks[0].code,representable);
console.log(`Shared code PPTX: ${cases} decks, ${lines} accepted native lines, ${tabs} tab stops, six whitespace imports, strict failures, ${invalidCases} XML-boundary rejections and valid character boundaries verified.`);
