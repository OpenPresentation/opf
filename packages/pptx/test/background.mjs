import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {unzipSync,zipSync} from 'fflate';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {renderSvg} from '@openpresentation/opf-render';
import {validatePresentation} from '@openpresentation/opf';
const {toPptx,fromPptx}=await import(process.env.OPF_TEST_PPTX_MODULE ?? '../dist/index.js');
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:''});
const utf8=new TextDecoder(),encode=new TextEncoder();
const native=bytes=>parser.parse(utf8.decode(unzipSync(bytes)['ppt/slides/slide1.xml']))['p:sld']['p:cSld']['p:bg']['p:bgPr'];
const close=(a,b,tolerance=2e-5)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
let cases=0,samples=0;
for(const [width,height] of [[1280,720],[720,1280],[960,960]]) {
 for(const angle of [0,30,45,90,120,180,225,270,315,-30,405]) {
  const background={type:'gradient',gradient:{angle,stops:[{position:0,color:'#123456'},{position:.37,color:'#F08040'},{position:1,color:'#ABCDEF'}]},opacity:.4};
  const document={design:{dimensions:{widthInches:width/96,heightInches:height/96},background},slides:[{}]};
  const source=JSON.stringify(document),bytes=await toPptx(document),props=native(bytes),gradient=props['a:gradFill'];
  assert.ok(gradient,'Gradient must remain an editable native fill');
  assert.equal(JSON.stringify(document),source,'Source unchanged');
  assert.ok(!Object.keys(unzipSync(bytes)).some(p=>p.startsWith('ppt/media/') && !p.endsWith('/')),'No rasterized slide or background');
  const svg=renderSvg(document),svgDoc=parser.parse(svg).svg;
  const defs=Array.isArray(svgDoc.defs)?svgDoc.defs:[svgDoc.defs];
  const g=defs.find(def=>def?.linearGradient)?.linearGradient;
  assert.ok(g);
  const x1=parseFloat(g.x1)/100,y1=parseFloat(g.y1)/100,x2=parseFloat(g.x2)/100,y2=parseFloat(g.y2)/100;
  const dx=x2-x1,dy=y2-y1;
  const radians=Number(gradient['a:lin'].ang)/60000*Math.PI/180;
  const nx=Math.cos(radians),ny=Math.sin(radians);
  const corner=[0,width*nx,height*ny,width*nx+height*ny];
  const low=Math.min(...corner),high=Math.max(...corner);
  const gs=gradient['a:gsLst']['a:gs'];
  assert.equal(gs.length,3);
  for(let i=0;i<3;i++){assert.equal(gs[i]['a:srgbClr'].val,background.gradient.stops[i].color.slice(1));assert.equal(gs[i]['a:srgbClr']['a:alpha'].val,'40000');}
  const first=Number(gs[0].pos)/100000,last=Number(gs.at(-1).pos)/100000;
  // Independently sample the SVG endpoint projection and DrawingML's
  // physical normal/corner interval, using only the serialized artifacts.
  for(const u of [0,.1,.3,.5,.9,1])for(const v of [0,.2,.5,.8,1]){
   const expected=((u-x1)*dx+(v-y1)*dy)/(dx*dx+dy*dy);
   const nativePosition=((u*width*nx+v*height*ny-low)/(high-low)-first)/(last-first);
   close(nativePosition,expected);samples++;
  }
  const imported=await fromPptx(bytes),restored=imported.slides[0].design.background;
  assert.equal(validatePresentation(imported).valid,true);
  assert.equal(restored.type,'gradient');close(restored.opacity,.4);
  close(((restored.gradient.angle-angle)%360+540)%360-180,0,.00003);
  restored.gradient.stops.forEach((stop,i)=>{close(stop.position,background.gradient.stops[i].position);assert.equal(stop.color,background.gradient.stops[i].color);});
  assert.deepEqual(bytes,await toPptx(document),'Deterministic native fill');
  const twice=await fromPptx(await toPptx(imported));
  twice.slides[0].design.background.gradient.stops.forEach((stop,i)=>close(stop.position,background.gradient.stops[i].position,.00004));
  cases++;
 }
}
for(const opacity of [0,.25,1]) {
 const doc={design:{background:{type:'solid',color:'#369',opacity}},slides:[{}]};
 const bytes=await toPptx(doc),fill=native(bytes)['a:solidFill']['a:srgbClr'];
 assert.equal(fill.val,'336699');close(Number(fill['a:alpha']?.val??100000)/100000,opacity);
 const imported=await fromPptx(bytes);close(imported.slides[0].design.background.opacity??1,opacity);cases++;
}
const shorthand=await fromPptx(await toPptx({slides:[{design:{background:'#12345680'}}]}));
close(shorthand.slides[0].design.background.opacity,128/255);
const themeFill={type:'gradient',gradient:{angle:90,stops:[{position:0,color:'#000000'},{position:1,color:'#FFFFFF'}]}};
const themed=await fromPptx(await toPptx({design:{theme:{id:'minimal',background:themeFill}},slides:[{}, {design:{background:'#FF0000'}}]}));
assert.equal(themed.slides[0].design.background.type,'gradient');assert.equal(themed.slides[1].design.background.color,'#FF0000');
const rgba={type:'gradient',gradient:{angle:45,stops:[{position:0,color:'#FF000080'},{position:1,color:'#0000FF'}]},opacity:.5};
const rgbaBytes=await toPptx({slides:[{design:{background:rgba}}]});
const rgbaStops=native(rgbaBytes)['a:gradFill']['a:gsLst']['a:gs'];
close(Number(rgbaStops[0]['a:srgbClr']['a:alpha'].val)/100000,128/255*.5);
assert.equal(rgbaStops[1]['a:srgbClr']['a:alpha'].val,'50000');
const alphaImport=await fromPptx(rgbaBytes);assert.match(alphaImport.slides[0].design.background.gradient.stops[0].color,/40$/);
const base={type:'gradient',gradient:{stops:[{position:.7,color:'#123456'},{position:.3,color:'#654321'},{position:1,color:'#FF0000'}]}};
const overrides=await toPptx({design:{background:base},slides:[{}, {design:{background:{type:'solid',color:'#112233',opacity:.2}}}]});
assert.equal(native(overrides)['a:gradFill']['a:gsLst']['a:gs'][0].pos,native(overrides)['a:gradFill']['a:gsLst']['a:gs'][1].pos,'Descending stops follow SVG clamping');
const importedOverrides=await fromPptx(overrides);assert.equal(importedOverrides.slides[1].design.background.color,'#112233');
const entries=unzipSync(overrides);
entries['ppt/slides/slide1.xml']=encode.encode(utf8.decode(entries['ppt/slides/slide1.xml']).replace('val="123456"','val="00FF00"'));
assert.equal((await fromPptx(zipSync(entries))).slides[0].design.background.gradient.stops[0].color,'#00FF00','Native edits drive import');
for(const stops of [[],[{position:.4,color:'#F00'}]]) {
 const bytes=await toPptx({slides:[{design:{background:{type:'gradient',gradient:{stops}}}}]});
 assert.ok(native(bytes)[stops.length?'a:solidFill':'a:noFill']!==undefined);assert.equal(validatePresentation(await fromPptx(bytes)).valid,true);cases++;
}
for (const bad of ['red', '\"/><evil/>']) {
 const bytes=await toPptx({slides:[{design:{background:{type:'solid',color:bad}}}]});
 assert.equal(native(bytes)['a:solidFill']['a:srgbClr'].val,'FFFFFF');
 assert.equal(XMLValidator.validate(utf8.decode(unzipSync(bytes)['ppt/slides/slide1.xml'])),true);
}
const unsupported=unzipSync(rgbaBytes);
unsupported['ppt/slides/slide1.xml']=encode.encode(utf8.decode(unsupported['ppt/slides/slide1.xml']).replace(/<a:lin[^>]*\/>/,'<a:path path="circle"/>'));
const diagnostics=[];const result=await fromPptx(zipSync(unsupported),{onDiagnostic:d=>diagnostics.push(d)});
assert.ok(!result.slides[0].design?.background);assert.equal(diagnostics[0].code,'unsupported-background-gradient');assert.equal(diagnostics[0].path,'slides.0.design.background');
// Unsupported native geometry must be observable, not mistaken for an OPF gradient.
for (const transform of [
 xml=>xml.replace(/<a:gs pos="[0-9]+"/, '<a:gs pos="0"'),
 xml=>xml.replace('rotWithShape="0"', 'rotWithShape="0" flip="x"'),
 xml=>xml.replace('<a:lin', '<a:tileRect l="10000"/><a:lin'),
 xml=>xml.replace('<a:alpha val="25098"/>', '<a:tint val="50000"/>'),
]) {
 const parts=unzipSync(rgbaBytes),original=utf8.decode(parts['ppt/slides/slide1.xml']);
 const changed=transform(original);assert.notEqual(changed,original);
 parts['ppt/slides/slide1.xml']=encode.encode(changed);
 const reports=[];await fromPptx(zipSync(parts),{onDiagnostic:d=>reports.push(d)});
 assert.equal(reports[0]?.code,'unsupported-background-gradient');
}
const scaledParts=unzipSync(overrides);
scaledParts['ppt/slides/slide1.xml']=encode.encode(utf8.decode(scaledParts['ppt/slides/slide1.xml']).replace('scaled="0"','scaled="true"').replace('<a:lin','<a:tileRect/><a:lin'));
assert.equal((await fromPptx(zipSync(scaledParts))).slides[0].design.background.type,'gradient','A cardinal scaled gradient with a default tile rectangle remains representable');
await mkdir(new URL('../artifacts/backgrounds/',import.meta.url),{recursive:true});
const overview={slides:[0,30,45,90,180,270].map(angle=>({design:{background:{type:'gradient',gradient:{angle,stops:[{position:0,color:'#1E40AF'},{position:.6,color:'#22D3EE'},{position:1,color:'#FFFFFF'}]}}}}))};
const overviewBytes=await toPptx(overview);
for(const [path,bytes]of Object.entries(unzipSync(overviewBytes)))if(path.endsWith('.xml'))assert.equal(XMLValidator.validate(utf8.decode(bytes)),true,path);
await writeFile(new URL('../artifacts/backgrounds/gradients.pptx',import.meta.url),overviewBytes);
await writeFile(new URL('../artifacts/backgrounds/gradients.opf.json',import.meta.url),JSON.stringify(overview,null,2));
console.log(`Backgrounds passed: ${cases} gradient/solid cases, ${samples} independently compared SVG/native samples, alpha, overrides, round-trips, native edits, empty/single/descending stops and unsupported-import diagnostics.`);
