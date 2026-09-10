import assert from 'node:assert/strict';
import {XMLParser} from 'fast-xml-parser';
import JSZip from 'jszip';
import {toPptx,fromPptx} from '../dist/index.js';
import {composeSlide} from '@openpresentation/opf/composition';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
const fonts=await loadOfficeFontRegistry(),parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const array=x=>x===undefined?[]:Array.isArray(x)?x:[x];
let cases=0;
for(const dimensions of [{width:1280,height:720},{width:540,height:960}])for(const align of ['left','center','right'])for(const metric of [0,'',
  {value:1,unit:'%',label:'Completion'},
  {value:42,unit:'ms',label:'Left\tRight  ',description:'Exact\r\n\r\ncontext',delta:0,trend:'flat'},
  {value:'42\n-0.5',unit:'milliseconds across all completed production requests',label:'Latency'},
  {value:'',unit:'',label:'',description:'',delta:'',trend:'up'}]) {
  const deck={design:{fontScheme:'roboto',contentAlignment:align,dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96}},slides:[{composition:{minFontSize:32},metric}]},before=structuredClone(deck);
  const layout=composeSlide(deck.slides[0],{...dimensions,fonts:{heading:'Roboto',body:'Roboto'},contentAlignment:align,textMeasurement:fonts.textMeasurement}).items[0].metricLayout;
  const bytes=await toPptx(deck,{textMeasurement:fonts.textMeasurement}),zip=await JSZip.loadAsync(bytes),xml=await zip.file('ppt/slides/slide1.xml').async('string');
  const shapes=array(parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']);
  const expected=layout.parts.flatMap(part=>part.visible?part.fit.sourceLines.map((line,i)=>({part,line,origin:part.linePositions[i]})):[]);
  assert.equal(shapes.length,expected.length,'Metrics add no hidden panel or flattened duplicate text');
  for(const [i,shape] of shapes.entries()){
    const {part,line,origin}=expected[i],position=shape['p:spPr']['a:xfrm'];
    assert.ok(Math.abs(Number(position['a:off'].x)/9525-(line.width?origin.x:part.box.x))<.001);
    assert.ok(Math.abs(Number(position['a:off'].y)/9525-(origin.baseline-part.fit.fontSize))<.001);
    assert.ok(Math.abs(Number(position['a:ext'].cx)/9525-(line.width||part.box.width))<.001);
    const paragraphs=array(shape['p:txBody']['a:p']);
    const text=paragraphs.map(p=>array(p['a:r']).map(r=>r['a:t']??'').join('')).join('\n');
    assert.equal(text,part.text.slice(line.start,line.end));
    for(const run of paragraphs.flatMap(p=>array(p['a:r'])))assert.ok(Math.abs(Number(run['a:rPr'].sz)/100-part.fit.fontSize*.75)<=.011);
    const stops=paragraphs.flatMap(p=>array(p['a:pPr']?.['a:tabLst']?.['a:tab']));
    assert.equal(stops.length,line.segments.filter(s=>s.kind==='tab').length);
  }
  const diagnostics=[],imported=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});
  assert.deepEqual(imported.slides[0].blocks,[{type:'metric',metric}]);assert.deepEqual(deck,before);
  assert.ok(diagnostics.some(d=>d.code==='metric-import-reflow'));assert.ok(!diagnostics.some(d=>d.code==='invalid-metric-provenance'));cases++;
}
const strict={slides:[{composition:{overflow:'error',minFontSize:32},metric:{value:42,label:'Unabridged '.repeat(1000)}}]};
await assert.rejects(()=>toPptx(strict),{code:'layout-overflow'});
let invalidCases=0;
for(const point of [...Array.from({length:32},(_,i)=>i).filter(i=>![9,10,13].includes(i)),0xD800,0xDFFF,0xFFFE,0xFFFF])for(const field of ['shorthand','value','unit','label','description','delta']){
  const value='A😀B'+String.fromCodePoint(point)+'Z',metric=field==='shorthand'?value:{value:0,[field]:value},deck={slides:[{metric}]},before=structuredClone(deck);
  await assert.rejects(()=>toPptx(deck),e=>e.code==='invalid-metric-text'&&e.path==='slides.0.metric'+(field==='shorthand'?'':'.'+field)&&e.message.includes('UTF-16 offset 4'));
  assert.deepEqual(deck,before);invalidCases++;
}
console.log(`Shared metric PPTX: ${cases} exact aligned geometry/source/type round trips with editable native lines, strict rejection and ${invalidCases} XML boundary cases.`);
