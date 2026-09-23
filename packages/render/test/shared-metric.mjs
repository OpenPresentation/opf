import assert from 'node:assert/strict';
import {resolvePresentation,renderSvg} from '../dist/svg.js';
import {loadOfficeFontRegistry} from '../dist/fonts-node.js';
import {validatePresentation} from '@openpresentation/opf';
const fonts=await loadOfficeFontRegistry(),escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
let cases=0,anchored=0;
for(const dimensions of [{width:1280,height:720},{width:540,height:960}])for(const align of ['left','center','right'])for(const metric of [0,'',
  {value:1,unit:'%',label:'Completion'},
  {value:42,unit:'ms',label:'Left\tRight  ',description:'Exact\r\n\r\ncontext',delta:0,trend:'flat'},
  {value:'42\n-0.5',unit:'milliseconds across all completed production requests',label:'Latency'},
  {value:'',unit:'',label:'',description:'',delta:'',trend:'up'}]) {
  const deck={design:{fontScheme:'roboto',contentAlignment:align,dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96}},slides:[{composition:{minFontSize:32},metric}]},before=structuredClone(deck);
  let calls=0,styles=0;const textMeasurement={measure:(...args)=>{calls++;return fonts.textMeasurement.measure(...args);},resolveStyle:style=>{styles++;return fonts.textMeasurement.resolveStyle(style);}};
  const bound=resolvePresentation(deck,{textMeasurement}).slides[0],expectedCalls=calls,expectedStyles=styles;calls=0;styles=0;
  const diagnostics=[],svg=renderSvg(deck,{textMeasurement,trace:true,onDiagnostic:d=>diagnostics.push(d)});
  assert.equal(calls,expectedCalls);assert.equal(styles,expectedStyles);assert.deepEqual(diagnostics,[]);assert.deepEqual(deck,before);
  const layout=bound.geometry.items[0].metricLayout;assert.equal(layout.alignment,align);
  const parts=layout.parts.filter(p=>p.visible),groups=[...svg.matchAll(/<g\b([^>]*data-opf-metric-role[^>]*)>/g)];
  assert.equal(groups.length,parts.length);
  const attribute=(attrs,name)=>new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
  groups.forEach(([,attrs],i)=>{
    assert.equal(attribute(attrs,'data-opf-path'),parts[i].path);
    for(const dim of ['x','y','width','height'])assert.equal(Number(attribute(attrs,'data-opf-box-'+dim)),parts[i].box[dim]);
  });
  const expected=parts.flatMap(part=>part.fit.sourceLines.map((line,index)=>({part,line,origin:part.linePositions[index]})));
  const lines=[...svg.matchAll(/<text\b([^>]*?)(?:\/>|>([\s\S]*?)<\/text>)/g)];assert.equal(lines.length,expected.length);
  lines.forEach(([,attrs,content=''],i)=>{
    const {part,line,origin}=expected[i];
    // Untabbed centered/right lines anchor at the accepted alignment edge, as native PPTX
    // metric paragraphs do; tabbed and left lines keep their accepted segment origins.
    const factor=align==='right'?1:align==='center'?.5:0,edge=factor>0&&!line.segments.some(segment=>segment.kind==='tab');
    assert.equal(attribute(attrs,'data-opf-path'),part.path);assert.equal(attribute(attrs,'data-opf-metric-role'),part.role);
    assert.equal(attribute(attrs,'text-anchor'),edge?(factor===1?'end':'middle'):'start');assert.equal(attribute(attrs,'text-rendering'),'geometricPrecision');
    assert.equal(Number(attribute(attrs,'font-size')),part.fit.fontSize);assert.equal(Number(attribute(attrs,'font-weight')),part.style.fontWeight);
    assert.ok(Math.abs(Number(attribute(attrs,'x'))-(origin.x+(edge?line.width*factor:0)))<.002);assert.ok(Math.abs(Number(attribute(attrs,'y'))-origin.baseline)<.002);
    if(edge)anchored++;
    assert.equal(Number(attribute(attrs,'data-opf-text-start')),line.start);assert.equal(Number(attribute(attrs,'data-opf-text-end')),line.end);assert.equal(Number(attribute(attrs,'data-opf-text-next-start')),line.nextStart);
    assert.equal(content.replace(/<\/?tspan\b[^>]*>/g,''),escape(part.text.slice(line.start,line.end)));
    const segments=[...content.matchAll(/<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/g)];assert.equal(segments.length,line.segments.length);
    segments.forEach(([,attrs,text],j)=>{
      const segment=line.segments[j];assert.equal(text,escape(part.text.slice(segment.start,segment.end)));
      if(edge)assert.equal(attribute(attrs,'x'),undefined);else assert.ok(Math.abs(Number(attribute(attrs,'x'))-origin.x-segment.x)<.002);
      if(segment.kind==='tab')assert.ok(Math.abs(Number(attribute(attrs,'textLength'))-segment.width)<.002);
    });
  });cases++;
}
assert.ok(anchored>0,'centered and right-aligned metrics exercise edge anchoring');
const strict={slides:[{composition:{overflow:'error',minFontSize:32},blocks:[{metric:{value:42,label:'Unabridged label '.repeat(300)}}]}]};
assert.throws(()=>renderSvg(strict),e=>e.code==='layout-overflow'&&e.diagnostics.some(d=>d.path.endsWith('.metric.label')));
let invalidCases=0;
const forbidden=[...Array.from({length:32},(_,i)=>i).filter(i=>![9,10,13].includes(i)),0xD800,0xDFFF,0xFFFE,0xFFFF];
for(const point of forbidden)for(const field of ['shorthand','value','unit','label','description','delta']){
  const value='A😀B'+String.fromCodePoint(point)+'Z',metric=field==='shorthand'?value:{value:0,[field]:value},deck={slides:[{metric}]},before=structuredClone(deck);
  assert.equal(validatePresentation(deck).valid,true);
  assert.throws(()=>renderSvg(deck),e=>e.code==='invalid-metric-text'&&e.path==='slides.0.metric'+(field==='shorthand'?'':'.'+field)&&e.message.includes('UTF-16 offset 4'));
  assert.deepEqual(deck,before);invalidCases++;
}
console.log(`Shared metric SVG: ${cases} accepted aligned layouts (${anchored} edge-anchored lines), exact zero/source/trace/line origins, no repeated measurement, strict rejection and ${invalidCases} XML boundary cases.`);
