import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { renderSvg } from '@openpresentation/opf-render';
import { toPptx } from '../dist/index.js';
import { rasterDimensions } from '../dist/image-geometry.js';
const parser = new XMLParser({ignoreAttributes:false, parseTagValue:false});
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const find = (value, key) => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(v=>find(v,key)) : Object.entries(value).flatMap(([k,v])=>k===key ? array(v) : find(v,key));
const fixtures = [['wide.png',120,60],['tall.png',60,120],['square.png',80,80],['wide.jpg',120,60],['wide-progressive.jpg',120,60],['wide.gif',120,60],['wide.webp',120,60],['wide-lossy.webp',120,60],['wide-alpha.webp',120,60]];
let checked=0;
for (const [name,width,height] of fixtures) {
 const bytes=await readFile(new URL(`fixtures/images/${name}`,import.meta.url));
 assert.deepEqual(rasterDimensions(bytes),{width,height},name);
 const mime=name.endsWith('.jpg')?'jpeg':name.split('.').at(-1), uri=`data:image/${mime};base64,${bytes.toString('base64')}`;
 for (const [deckMode,slideMode] of [[undefined,undefined],['fit',undefined],['crop',undefined],['crop','fit'],['fit','crop']]) {
  const mode=slideMode??deckMode??'fit';
  const deck={design:{theme:'classic',...(deckMode?{imageFill:deckMode}:{})},slides:[{design:slideMode?{imageFill:slideMode}:{},image:{src:uri,alt:'Four quadrants and a circle'}}]};
  const svg=renderSvg(deck,{trace:true});
  const image=find(parser.parse(svg),'image')[0];
  assert.equal(image['@_preserveAspectRatio'],mode==='crop'?'xMidYMid slice':'xMidYMid meet');
  const bounds=Object.fromEntries(['x','y','width','height'].map(k=>[k,Number(image[`@_${k}`])]));
  const output=await toPptx(deck,{imageFormat:"preserve",strictAssets:true});
  const entries=unzipSync(output), xml=parser.parse(new TextDecoder().decode(entries['ppt/slides/slide1.xml']));
  const picture=find(xml,'p:pic')[0], xfrm=picture['p:spPr']['a:xfrm'];
  const x=Number(xfrm['a:off']['@_x'])/9525,y=Number(xfrm['a:off']['@_y'])/9525,w=Number(xfrm['a:ext']['@_cx'])/9525,h=Number(xfrm['a:ext']['@_cy'])/9525;
  const near=(a,b,label)=>assert.ok(Math.abs(a-b)<.002,`${name} ${mode} ${label}: ${a} vs ${b}`);
  near(x+w/2,bounds.x+bounds.width/2,'horizontal center');near(y+h/2,bounds.y+bounds.height/2,'vertical center');
  if (mode==='fit') {
   near(w/h,width/height,'aspect ratio');assert.ok(w<=bounds.width+.002&&h<=bounds.height+.002);assert.ok(Math.abs(w-bounds.width)<.002||Math.abs(h-bounds.height)<.002);
   assert.equal(find(picture,'a:srcRect').length,0);
  } else {
   near(x,bounds.x,'x');near(y,bounds.y,'y');near(w,bounds.width,'width');near(h,bounds.height,'height');
   const crop=find(picture,'a:srcRect')[0];assert.ok(crop);
   const l=Number(crop['@_l']),r=Number(crop['@_r']),t=Number(crop['@_t']),b=Number(crop['@_b']);
   assert.equal(l,r);assert.equal(t,b);assert.ok(l===0||t===0);assert.ok([l,r,t,b].every(v=>v>=0&&v<50000));
   near(width*(1-(l+r)/100000)/(height*(1-(t+b)/100000)),w/h,'visible source aspect ratio');
  }
  assert.equal(picture['p:nvPicPr']['p:cNvPr']['@_descr'],'Four quadrants and a circle');
  assert.ok(Object.entries(entries).some(([name,data])=>name.startsWith('ppt/media/')&&Buffer.from(data).equals(bytes)),'Original image bytes preserved');
  checked++;
 }
}
// Resolve once and size the bytes actually returned by the host, including
// an image whose aspect ratio differs from the resource's original content.
const png=await readFile(new URL('fixtures/images/tall.png',import.meta.url));
let resolved=0;
const hostDeck={assets:{photo:{src:'https://example.invalid/photo.jpg',mediaType:'image/png'}},slides:[{image:'asset:photo'}]};
const hostBytes=await toPptx(hostDeck,{imageFormat:"preserve",strictAssets:true,imageResolver:()=>{resolved++;return png;}});
assert.equal(resolved,1);
const hostXml=parser.parse(new TextDecoder().decode(unzipSync(hostBytes)['ppt/slides/slide1.xml']));
const hostFrame=find(hostXml,'p:pic')[0]['p:spPr']['a:xfrm']['a:ext'];
assert.ok(Math.abs(Number(hostFrame['@_cx'])/Number(hostFrame['@_cy'])-.5)<.00001);
// Local paths and host-returned paths use the same embedded bytes as data URIs.
for (const source of ['local','host-path','host-data']) {
 const local=new URL('fixtures/images/tall.png',import.meta.url).pathname;
 let calls=0;
 const result=await toPptx({slides:[{image:source==='local'?local:'https://example.invalid/image'}]},{imageFormat:"preserve",strictAssets:true,...(source==='local'?{}:{imageResolver:()=>{calls++;return source==='host-path'?{path:local}:{data:png,mediaType:'image/png'};}})});
 assert.equal(calls,source==='local'?0:1);
 const pic=find(parser.parse(new TextDecoder().decode(unzipSync(result)['ppt/slides/slide1.xml'])),'p:pic')[0];
 const ext=pic['p:spPr']['a:xfrm']['a:ext'];
 assert.ok(Math.abs(Number(ext['@_cx'])/Number(ext['@_cy'])-.5)<.00001);
}
// Malformed headers cannot cause out-of-bounds reads or non-advancing scans.
for(const data of [[],[0xff,0xd8,0xff,0xe0,0,0],[0xff,0xd8,0xff,0xff],[0xff,0xd8,0xff,0xe0,255,255]])assert.equal(rasterDimensions(new Uint8Array(data)),null);
for(const [name] of fixtures){const bytes=await readFile(new URL(`fixtures/images/${name}`,import.meta.url));for(let n=0;n<Math.min(bytes.length,32);n++)assert.doesNotThrow(()=>rasterDimensions(bytes.subarray(0,n)));}
await assert.rejects(()=>toPptx({slides:[{image:'data:image/png;base64,bm90LWEtcG5n'}]}),error=>error.code==='unsupported-image-dimensions'&&error.path==='slides.0.image');
console.log(`Image fitting passed: ${checked} SVG/native geometry cases, 9 raster fixtures, fit/crop, slide overrides, byte/alt preservation, host resolution and malformed headers.`);
