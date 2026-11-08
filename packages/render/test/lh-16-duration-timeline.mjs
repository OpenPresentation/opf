import assert from 'node:assert/strict';
import {toSvg, resolvePresentation} from './catalog-harness.mjs';
import {loadFonts} from '../dist/fonts-node.js';
const fonts=await loadFonts();
for(const direction of ['ltr','rtl'])for(const dimensions of [{width:1280,height:720},{width:540,height:960}]){
  const document={language:direction==='rtl'?'ar':'en',design:{dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96},fontScheme:'roboto'},slides:[{layout:'timeline',title:'Six-week delivery',timeline:[{when:'Week 1',what:'Scope',duration:1},{when:'Weeks 2–5',what:'Build',duration:4},{when:'Week 6',what:'Launch'}]}]};
  const options={fonts,trace:true},layout=resolvePresentation(document,options).slides[0].geometry.items.find(item=>item.timelineLayout).timelineLayout;
  assert.equal(layout.overflow,false);
  const svg=toSvg(document,1,options),ranges=[...svg.matchAll(/<rect\b([^>]*data-opf-timeline-range="\d+"[^>]*)/g)];
  assert.equal(ranges.length,3);
  for(const [index,match] of ranges.entries())for(const key of ['x','y','width','height']){
    const actual=Number(new RegExp('(?:^|\\s)'+key+'="([^"]+)"').exec(match[1])[1]);
    assert.ok(Math.abs(actual-layout.ranges[index].box[key])<.001);
  }
  for(const label of ['Week 1','Weeks 2–5','Build','Launch'])assert.ok(svg.includes(label));
}
console.log('duration ranges share exact SVG geometry in both directions and canvas shapes');
