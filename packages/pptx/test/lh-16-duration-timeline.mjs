import assert from 'node:assert/strict';
import {unzipSync,zipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx,fromPptx,resolvePresentation} from './helpers/default-catalog.mjs';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false}),decode=bytes=>new TextDecoder().decode(bytes),encode=text=>new TextEncoder().encode(text),array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const events=[{when:'Week 1',what:'Scope',duration:1,status:'done'},{when:'Weeks 2–5',what:'Build',duration:4,status:'current'},{when:'Week 6',what:'Launch',status:'planned'}],fonts=await loadFonts();
for(const language of ['en','ar'])for(const dimensions of [{width:1280,height:720},{width:540,height:960}]){
  const document={language,design:{dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96},fontScheme:'roboto'},slides:[{layout:'timeline',title:'Six-week delivery',timeline:events}]},options={fonts};
  const layout=resolvePresentation(document,options).slides[0].geometry.items.find(item=>item.timelineLayout).timelineLayout;
  const bytes=await toPptx(document,options),entries=unzipSync(bytes),xml=decode(entries['ppt/slides/slide1.xml']),shapes=array(parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']);
  const ranges=shapes.filter(shape=>/OPF timeline \d+ range \d+/.test(shape['p:nvSpPr']['p:cNvPr'].name));assert.equal(ranges.length,3);
  for(const [index,shape] of ranges.entries()){
    assert.equal(shape['p:spPr']['a:prstGeom'].prst,'rect');const xfrm=shape['p:spPr']['a:xfrm'],box=layout.ranges[index].box;
    for(const [actual,expected] of [[xfrm['a:off'].x,box.x],[xfrm['a:off'].y,box.y],[xfrm['a:ext'].cx,box.width],[xfrm['a:ext'].cy,box.height]])assert.equal(Number(actual),Math.round(expected/96*914400));
  }
  const imported=await fromPptx(bytes);assert.deepEqual(imported.slides[0].timeline,events);
  entries['ppt/slides/slide1.xml']=encode(xml.replace('<a:t>Build</a:t>','<a:t>Edited work</a:t>'));
  const edited=await fromPptx(zipSync(entries));assert.equal(edited.slides[0].timeline[1].what,'Edited work');assert.equal(edited.slides[0].timeline[1].duration,4);
}
console.log('native proportional timeline ranges, duration roundtrip and current text edits passed');
