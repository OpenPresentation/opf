import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import {unzipSync,zipSync}from'fflate';
import {XMLParser}from'fast-xml-parser';
import {toPptx,fromPptx,resolvePresentation,defaultCatalog}from'./helpers/default-catalog.mjs';
import {loadFonts}from'@openpresentation/opf-render/fonts-node';
const src='data:image/png;base64,'+readFileSync(new URL('fixtures/images/wide.png',import.meta.url)).toString('base64'),fonts=await loadFonts();
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false}),decode=b=>new TextDecoder().decode(b),encode=t=>new TextEncoder().encode(t),array=v=>v===undefined?[]:Array.isArray(v)?v:[v];
for(const language of ['en','ar'])for(const dimensions of [[1280,720],[540,960]])for(const fit of ['contain','cover']){
 const callouts=[{text:'Original label\nSecond line',x:-.12,y:-.1,width:.9,height:.35},{text:'',x:.1,y:.6,width:.8,height:.3}];
 const deck={language,design:{fontScheme:'roboto',variant:fit==='cover'?'dark1':'light1',dimensions:{widthInches:dimensions[0]/96,heightInches:dimensions[1]/96}},slides:[{title:'Callout labels',blocks:[{image:{src,alt:'A scene',callouts},fit,shape:'roundRect',overlay:{color:'#000000',opacity:.4}}]}]},options={fonts};
 const image=resolvePresentation(deck,options).slides[0].geometry.items.find(item=>item.image).image;
 const entries=unzipSync(await toPptx(deck,options)),xml=decode(entries['ppt/slides/slide1.xml']),shapes=array(parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']);
 const panels=shapes.filter(shape=>/^OPF image callout OPF image \d+ \d+$/.test(shape['p:nvSpPr']['p:cNvPr'].name));assert.equal(panels.length,2);
 for(const [index,shape]of panels.entries()){
  assert.equal(shape['p:spPr']['a:prstGeom'].prst,'rect');const frame=shape['p:spPr']['a:xfrm'],box=image.callouts[index].box;
  for(const [actual,wanted]of [[frame['a:off'].x,box.x],[frame['a:off'].y,box.y],[frame['a:ext'].cx,box.width],[frame['a:ext'].cy,box.height]])assert.equal(Number(actual),Math.round(wanted/96*914400));
 }
 const native=await fromPptx(zipSync(entries)),imageBlock=native.slides[0].blocks?.find(block=>block.image)??native.slides[0];assert.deepEqual(imageBlock.image.callouts,callouts);
 if(language==='en'&&dimensions[0]===1280&&fit==='cover'){
  const edited=structuredClone(entries);edited['ppt/slides/slide1.xml']=encode(xml.replace('<a:t>Original label</a:t>','<a:t>Current edited words</a:t>'));
  const current=await fromPptx(zipSync(edited)),block=current.slides[0].blocks?.find(item=>item.image)??current.slides[0];assert.equal(block.image.callouts[0].text,'Current edited words\nSecond line');assert.equal(block.image.callouts[0].x,-.12);assert.equal(block.image.callouts[0].y,-.1);
  for(const patch of [frame=>({...frame,text:'Injected old words'}),frame=>({...frame,x:null}),frame=>({...frame,width:1.1})]){
   const damaged=structuredClone(edited),part=Object.keys(damaged).find(key=>/^ppt\/tags\/opfImageCallout\d+\.xml$/.test(key));
   const tag=decode(damaged[part]),value=/val="([A-F0-9]+)"/.exec(tag)[1],data=JSON.parse(Buffer.from(value,'hex').toString('utf8'));data.frame=patch(data.frame);damaged[part]=encode(tag.replace(value,Buffer.from(JSON.stringify(data)).toString('hex').toUpperCase()));
   const findings=[],fallback=await fromPptx(zipSync(damaged),{onDiagnostic:item=>findings.push(item)});assert.ok(findings.some(item=>item.code==='invalid-image-callout-provenance'));assert.ok(JSON.stringify(fallback).includes('Current edited words'));assert.ok(!JSON.stringify(fallback).includes('Injected old words'));
  }
  for(const mutate of [shape=>'',shape=>shape.replace('prst="rect"','prst="ellipse"'),shape=>shape.replace(/(<a:off\b[^>]*\bx=")(-?\d+)(")/,(_,a,n,b)=>a+(Number(n)-914400)+b)]){
   const damaged=structuredClone(entries);damaged['ppt/slides/slide1.xml']=encode(decode(edited['ppt/slides/slide1.xml']).replace(/<p:sp>[\s\S]*?<\/p:sp>/g,shape=>shape.includes('name="'+panels[0]['p:nvSpPr']['p:cNvPr'].name+'"')?mutate(shape):shape));
   const findings=[],fallback=await fromPptx(zipSync(damaged),{onDiagnostic:item=>findings.push(item)});assert.ok(findings.some(item=>item.code==='invalid-image-callout-provenance'));assert.ok(JSON.stringify(fallback).includes('Current edited words'));assert.ok(!JSON.stringify(fallback).includes('Original label'));const restored=fallback.slides[0].blocks?.find(item=>item.image)??fallback.slides[0];assert.equal(restored.image.callouts,undefined,'changed panel geometry never restores a stale signed callout');
  }
 }
}
console.log('image callout PPTX: native panels at shared coordinates, editable lines/current words, empty fields and damaged provenance controls passed');

const unavailable={design:{fontScheme:'roboto'},slides:[{image:{src:'unavailable.png',callouts:[{text:'Original unavailable label',x:0,y:0,width:1,height:.5}]}}]};
const missing=unzipSync(await toPptx(unavailable,{fonts,provenance:'full'}));missing['ppt/slides/slide1.xml']=encode(decode(missing['ppt/slides/slide1.xml']).replace('<a:t>Original unavailable label</a:t>','<a:t>Current unavailable label</a:t>'));const fallback=await fromPptx(zipSync(missing));assert.ok(JSON.stringify(fallback).includes('Current unavailable label'));assert.ok(!JSON.stringify(fallback).includes('Original unavailable label'));

for(const [language,text]of [['ar','نقطة الفحص'],['zh-CN','检查位置']]){const deck={language,design:{fontScheme:'roboto'},slides:[{image:{src,callouts:[{text,x:.05,y:.15,width:.9,height:.65}]}}]};await fonts.ensure(deck,{renderOptions:{catalogs:[defaultCatalog]}});const native=await fromPptx(await toPptx(deck,{fonts}));assert.ok(JSON.stringify(native).includes(text));}
