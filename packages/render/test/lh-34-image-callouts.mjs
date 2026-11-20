import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import {toSvg,resolvePresentation,defaultCatalog}from'./catalog-harness.mjs';
import {loadFonts}from'../dist/fonts-node.js';
const src='data:image/png;base64,'+readFileSync(new URL('../../pptx/test/fixtures/images/wide.png',import.meta.url)).toString('base64'),fonts=await loadFonts();
for(const language of ['en','ar'])for(const dimensions of [[1280,720],[540,960]])for(const fit of ['contain','cover']){
  const callouts=[{text:'Readable text',x:-.12,y:-.1,width:.84,height:.28},{text:'Second label',x:.1,y:.6,width:.8,height:.3}];
  const deck={language,design:{fontScheme:'roboto',variant:fit==='cover'?'dark1':'light1',dimensions:{widthInches:dimensions[0]/96,heightInches:dimensions[1]/96}},slides:[{title:'Labels over an image',blocks:[{image:{src,alt:'A scene',callouts},fit,shape:'roundRect',overlay:{color:'#000000',opacity:.7}}]}]},options={fonts,trace:true};
  const bound=resolvePresentation(deck,options).slides[0],image=bound.geometry.items.find(item=>item.image).image,svg=toSvg(deck,1,options);
  assert.equal((svg.match(/data-opf-image-callout=/g)??[]).length,2);
  for(const label of image.callouts){
    const start=svg.indexOf('data-opf-image-callout="'+label.path+'"'),end=svg.indexOf('</g>',start),part=svg.slice(start,end);
    for(const key of ['x','y','width','height']){const drawn=Number(new RegExp('<rect[^>]* '+key+'="([^"]+)"').exec(part)?.[1]);assert.ok(Math.abs(drawn-label.box[key])<.0005,key+' shares geometry');}
    assert.ok(part.includes(label.text));assert.ok(!part.includes('clip-path='),'text is above the image mask');
  }
  assert.ok(svg.indexOf('data-opf-image-callout=')>svg.indexOf('clip-path='));
}
const missing=toSvg({design:{fontScheme:'roboto'},slides:[{image:{src:'unavailable.png',callouts:[{text:'Still visible',x:0,y:0,width:1,height:.5}]}}]},1,{fonts});assert.ok(missing.includes('Still visible'));
console.log('image callout SVG: exact physical frame geometry, text above mask/overlay, unavailable pixels preserve labels');

for(const [language,text]of [['ar','نقطة الفحص'],['zh-CN','检查位置']]){const deck={language,design:{fontScheme:'roboto'},slides:[{image:{src,callouts:[{text,x:.05,y:.15,width:.9,height:.65}]}}]};await fonts.ensure(deck,{renderOptions:{catalogs:[defaultCatalog]}});const svg=toSvg(deck,1,{fonts});assert.ok(svg.includes(text));}

const outside={design:{fontScheme:'roboto'},slides:[{image:{src,callouts:[{text:'Offslide annotation',x:-2,y:-2,width:.5,height:.4}]},composition:{overflow:'error'}}]};
const outsideGeometry=resolvePresentation(outside,{fonts}).slides[0].geometry,outsideLabel=outsideGeometry.items.find(item=>item.image).image.callouts[0],outsideSvg=toSvg(outside,1,{fonts,trace:true});
assert.ok(outsideLabel.box.x<0&&outsideLabel.box.y<0);assert.ok(outsideSvg.includes('Offslide annotation'));assert.match(outsideSvg,/<svg[^>]+viewBox="0 0 1280 720"/);assert.equal(outsideGeometry.diagnostics.some(d=>d.code==='text-overflow'),false);
