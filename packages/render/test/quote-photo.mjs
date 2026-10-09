// FA-12: a quote's photo is drawn as an image clipped to the core circle frame, beside the footer lines; the role is a footer line.
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import { resolvePresentation, toSvg } from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
import {loadFonts} from '../dist/fonts-node.js';

const fonts=await loadFonts({pack:'office'});
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=buffer=>{let c=0xffffffff;for(const byte of buffer)c=crcTable[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const chunk=(type,data)=>{const length=Buffer.alloc(4),checksum=Buffer.alloc(4),body=Buffer.concat([Buffer.from(type),data]);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(body));return Buffer.concat([length,body,checksum]);};
const png=(width,height)=>{
  const raw=Buffer.alloc((width*3+1)*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)raw.set([200,80,40],y*(width*3+1)+1+x*3);
  const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
  return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
};
const photo={src:`data:image/png;base64,${png(40,60).toString('base64')}`,alt:'Priya Raman at her desk'};
const quote={text:'We would rather spend a week on capacity than a month on an outage.',attribution:'Priya Raman',role:'Head of Platform, Acme',photo,source:'Interview'};
const deck=(value,extra={})=>({design:{fontScheme:'roboto'},...extra,slides:[{title:'Customers',quote:value}]});
const textMeasurement=fonts.textMeasurement;
const render=(document,options={})=>{const diagnostics=[];const svg=toSvg(document, 1,{fonts:{textMeasurement},trace:true,onDiagnostic:item=>diagnostics.push(item),...options});return {svg,diagnostics};};
const attr=(source,name)=>new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(source)?.[1];

// The photo: an <image> inside a clip group whose path is core's circle outline, at core's frame, cropped to cover.
const {svg,diagnostics}=render(deck(quote));
assert.deepEqual(diagnostics,[]);
const layout=resolvePresentation(deck(quote),{fonts:{textMeasurement}}).slides[0].geometry.items.find(item=>item.field==='quote').quoteLayout;
assert.ok(layout.photo,'core placed a photo');
const images=[...svg.matchAll(/<image\b([^>]*)\/?>/g)];
assert.equal(images.length,1);
const [,imageAttrs]=images[0];
assert.equal(Number(attr(imageAttrs,'x')),layout.photo.box.x);
assert.equal(Number(attr(imageAttrs,'y')),layout.photo.box.y);
assert.equal(Number(attr(imageAttrs,'width')),layout.photo.box.width);
assert.equal(Number(attr(imageAttrs,'height')),layout.photo.box.height);
assert.equal(attr(imageAttrs,'preserveAspectRatio'),'xMidYMid slice');
assert.equal(attr(imageAttrs,'aria-label'),'Priya Raman at her desk');
assert.equal(attr(imageAttrs,'role'),'img');
const clip=/<clipPath id="([^"]+)"><path d="([^"]+)"\/><\/clipPath>/.exec(svg);
assert.ok(clip,'a clip path');
assert.equal(clip[2],layout.photo.shape.path,'the clip is the core circle outline');
assert.ok(svg.includes(`clip-path="url(#${clip[1]})"`));
// The footer text carries the role line.
assert.ok(svg.includes('Head of Platform, Acme'));
assert.ok(svg.includes('Priya Raman'));

// Without a photo or a role nothing changes: no image, no clip path.
const plain=render(deck({text:quote.text,attribution:quote.attribution,source:quote.source}));
assert.equal(plain.svg.includes('<image'),false);
assert.equal(plain.svg.includes('clipPath'),false);

// A right-to-left deck mirrors the photo to the right edge.
const rtl=render(deck(quote,{language:'ar'}));
const rtlImage=[...rtl.svg.matchAll(/<image\b([^>]*)\/?>/g)][0][1];
assert.ok(Number(attr(rtlImage,'x'))>Number(attr(imageAttrs,'x')),'mirrored to the end side');

// Two quotes on one slide use distinct clip ids.
const two=render({design:{fontScheme:'roboto'},slides:[{title:'Two',blocks:[{quote},{quote:{...quote,attribution:'Second'}}]}]});
const ids=[...two.svg.matchAll(/<clipPath id="([^"]+)"/g)].map(match=>match[1]);
assert.equal(ids.length,2);
assert.equal(new Set(ids).size,2);

// An unresolved source draws the ordinary placeholder, unmasked, and reports it.
const missing=render(deck({...quote,photo:{src:'asset:nobody',alt:'Nobody'}}));
assert.ok(missing.diagnostics.some(item=>item.code==='unresolved-asset'&&item.path.endsWith('quote.photo')),JSON.stringify(missing.diagnostics));
assert.equal(missing.svg.includes('<image'),false);
assert.equal(missing.svg.includes('clipPath'),false);

console.log('Quote photo: circle clip at the core frame, cover crop, alt text, mirrored in a right-to-left deck, unique clip ids, placeholder for an unresolved source; no photo changes nothing.');
