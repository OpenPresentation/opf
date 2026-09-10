import assert from 'node:assert/strict';
import {unzipSync,zipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx,fromPptx} from '../dist/index.js';
import {resolvePresentation} from '@openpresentation/opf-render';
import {loadBundledFontRegistry} from '@openpresentation/opf-render/fonts-node';
const fonts=await loadBundledFontRegistry(),options={textMeasurement:fonts.textMeasurement};
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false}),list=v=>v===undefined?[]:Array.isArray(v)?v:[v];
let cases=0;
for(const dimensions of [{width:1280,height:720},{width:540,height:960}])for(const cards of [true,false])for(const alpha of [false,true]){
  const metric={value:42,unit:'ms',label:'Latency',trend:'up'};
  const deck={design:{contentBox:cards,fontScheme:'roboto',background:'#FFFFFF',colorScheme:{id:'cool-horizon',light2:alpha?'#F8FAFC80':'#F8FAFC',accent5:alpha?'#64748B80':'#64748B'},dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96}},slides:[{title:'Editable cards',composition:{mode:'row'},blocks:[{text:'Exact body text'},{metric}]}]},before=structuredClone(deck);
  const geometry=resolvePresentation(deck,options).slides[0].geometry;
  const bytes=await toPptx(deck,options),zip=unzipSync(bytes),xml=new TextDecoder().decode(zip['ppt/slides/slide1.xml']);
  const shapes=list(parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']);
  const panels=shapes.filter(s=>s['p:nvSpPr']['p:cNvPr'].name.startsWith('OPF card '));
  assert.equal(panels.length,cards?2:0);
  for(const panel of panels){
    const item=geometry.items.find(i=>`OPF card ${i.path}`===panel['p:nvSpPr']['p:cNvPr'].name),box=item.frameBox,style=panel['p:spPr'],position=style['a:xfrm'];
    for(const [actual,expected]of [[position['a:off'].x,box.x],[position['a:off'].y,box.y],[position['a:ext'].cx,box.width],[position['a:ext'].cy,box.height]])assert.ok(Math.abs(Number(actual)/9525-expected)<.001);
    assert.equal(style['a:prstGeom'].prst,'roundRect');
    const radius=8*Math.min(dimensions.width,dimensions.height)/720,adjust=Number(style['a:prstGeom']['a:avLst']['a:gd'].fmla.split(' ')[1]);
    assert.ok(Math.abs(adjust/100000*Math.min(box.width,box.height)-radius)<.003);
    assert.equal(style['a:solidFill']['a:srgbClr'].val,'F8FAFC');assert.equal(style['a:ln']['a:solidFill']['a:srgbClr'].val,'64748B');
    if(alpha)for(const paint of [style['a:solidFill'],style['a:ln']['a:solidFill']])assert.ok(Math.abs(Number(paint['a:srgbClr']['a:alpha'].val)-128/255*100000)<1);
  }
  const body=shapes.find(s=>JSON.stringify(s['p:txBody']??{}).includes('Exact body text')),item=geometry.items.find(i=>i.field==='text'&&i.value==='Exact body text'),box=item.box,placed=item.text.placement.lines[0],position=body['p:spPr']['a:xfrm'];
  // Native text now uses one accepted line box; the card keeps its entire allocation.
  for(const [actual,expected]of [[position['a:off'].x,placed.x],[position['a:off'].y,placed.baseline-item.text.fontSize],[position['a:ext'].cx,box.width],[position['a:ext'].cy,placed.height]])assert.ok(Math.abs(Number(actual)/9525-expected)<.001);
  const diagnostics=[],imported=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});assert.deepEqual(imported.slides[0].blocks.filter(b=>b.type==='metric'),[{type:'metric',metric}]);
  assert.ok(!JSON.stringify(imported).includes('PowerPoint shape: OPF card'));
  assert.equal(diagnostics.filter(d=>d.code==='content-card-reflow').length,panels.length);
  assert.deepEqual(deck,before);cases++;
}
const localFalse={design:{contentBox:true},slides:[{design:{contentBox:false},text:'No frame'}]};
const off=unzipSync(await toPptx(localFalse));assert.ok(!new TextDecoder().decode(off['ppt/slides/slide1.xml']).includes('OPF card '));
const tagged=unzipSync(await toPptx({design:{contentBox:true},slides:[{metric:{value:42,label:'Native source'}}]}));
const originalXml=new TextDecoder().decode(tagged['ppt/slides/slide1.xml']);
for(const [name,edit,expected]of [
  ['name-only',shape=>shape.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/,''),'PowerPoint shape: OPF card'],
  ['changed-fill',shape=>shape.replace(/<a:solidFill>[\s\S]*?<\/a:solidFill>/,'<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>'),'PowerPoint shape: OPF card'],
  ['native-text',shape=>shape.replace('</p:sp>','<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Keep native edit</a:t></a:r></a:p></p:txBody></p:sp>'),'Keep native edit'],
  ['native-alt',shape=>shape.replace(/(<p:cNvPr\b)/,'$1 descr="Keep native description"'),'PowerPoint shape: OPF card'],
  ['changed-geometry',shape=>shape.replace(/(<a:off\b[^>]*x=")\d+/,'$112345'),'PowerPoint shape: OPF card'],
]){
  const modified={...tagged,'ppt/slides/slide1.xml':new TextEncoder().encode(originalXml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,shape=>shape.includes('OPF card ')?edit(shape):shape))};
  assert.notEqual(new TextDecoder().decode(modified['ppt/slides/slide1.xml']),originalXml,name);
  const diagnostics=[],imported=await fromPptx(zipSync(modified),{onDiagnostic:d=>diagnostics.push(d)});
  assert.ok(JSON.stringify(imported).includes(expected),name);
  assert.ok(!diagnostics.some(d=>d.code==='content-card-reflow'),name);
  if(name!=='name-only')assert.ok(diagnostics.some(d=>d.code==='invalid-card-provenance'),name);
}
console.log(`Content cards: ${cases} wide/portrait/on/off/alpha exports preserve source, shared frame and body bounds, radius and native metric fields; slide false overrides deck true. Native raster fidelity and frame reimport are not established.`);
