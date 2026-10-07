// FA-12: a quote's `role` and `photo`. The export writes the role as its own footer line and the headshot as a native picture with the
// `ellipse` geometry and the alt text as its description; import restores both; an edited or deleted picture degrades with a diagnostic.
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {unzipSync,zipSync} from 'fflate';
import {toPptx,fromPptx} from '../dist/index.js';
import {decodeTextTag} from '../dist/code-provenance.js';

const decode=bytes=>new TextDecoder().decode(bytes),encode=text=>new TextEncoder().encode(text);
const OPTIONS={seed:1,timestamp:'2026-01-01T00:00:00Z',zipDate:'2026-01-01T00:00:00Z'};

const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=buffer=>{let c=0xffffffff;for(const byte of buffer)c=crcTable[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const chunk=(type,data)=>{const length=Buffer.alloc(4),checksum=Buffer.alloc(4),body=Buffer.concat([Buffer.from(type),data]);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(body));return Buffer.concat([length,body,checksum]);};
// A 40 x 60 portrait PNG: a non-square source, so the circle crop is exercised.
const png=(width,height,rgb)=>{
  const raw=Buffer.alloc((width*3+1)*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)raw.set(rgb,y*(width*3+1)+1+x*3);
  const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
  return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
};
const uri=`data:image/png;base64,${png(40,60,[200,80,40]).toString('base64')}`;
const photo={src:uri,alt:'Priya Raman at her desk'};

const importBytes=async bytes=>{const diagnostics=[],imported=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});return {imported,diagnostics};};
const slideXml=entries=>decode(entries['ppt/slides/slide1.xml']);
const pictures=xml=>[...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].map(match=>match[0]);
const quoteBlocks=slide=>slide.quote!==undefined?[{quote:slide.quote}]:(slide.blocks??[]).filter(block=>block.quote!==undefined);
let cases=0;

// 1. Exact round trip: every combination of role, photo, attribution and source.
const base='Make the important point easy to understand.';
const fixtures=[
 {text:base,attribution:'Priya Raman',role:'Head of Platform, Acme'},
 {text:base,role:'Head of Platform'},
 {text:base,attribution:'Priya Raman',role:'Head of Platform',source:'Customer interview, March 2026'},
 {text:base,role:'Head - of Platform',source:'S - T'},
 {text:base,attribution:'Priya Raman',photo},
 {text:base,attribution:'Priya Raman',role:'Head of Platform, Acme',photo,source:'Interview'},
 {text:base,photo},
 {text:'A long testimonial that wraps across several native lines because the cell is only so wide. '.repeat(3),attribution:'Priya Raman',role:'Head of Platform, Acme '.repeat(2).trim(),photo},
];
for(const direction of ['ltr','rtl'])for(const quote of fixtures){
  const source={language:direction==='rtl'?'ar':'en',design:{fontScheme:'roboto'},slides:[{title:'Customers',composition:{overflow:'warn'},quote}]},before=structuredClone(source);
  const bytes=await toPptx(source,OPTIONS),entries=unzipSync(bytes),{imported,diagnostics}=await importBytes(bytes);
  assert.deepEqual(source,before,'export must not mutate its input');
  const imagePictures=pictures(slideXml(entries));
  assert.equal(imagePictures.length,quote.photo?1:0,JSON.stringify(quote));
  assert.deepEqual(imported.slides[0].quote,quote,`${direction} ${JSON.stringify(quote).slice(0,120)}`);
  assert.equal(imported.slides[0].blocks,undefined);
  assert.equal(imported.slides[0].image,undefined,'the headshot is not a loose image block');
  assert.ok(diagnostics.some(d=>d.code==='quote-import-reflow'));
  assert.ok(!diagnostics.some(d=>['quote-photo-missing','invalid-quote-provenance','quote-footer-merged'].includes(d.code)),JSON.stringify(diagnostics));
  cases++;
}

// 2. The native picture: ellipse geometry, the alt text as its description, cropped to fill the circle, at the core frame.
const source={design:{fontScheme:'roboto'},slides:[{title:'Customers',quote:{text:base,attribution:'Priya Raman',role:'Head of Platform, Acme',photo}}]};
const bytes=await toPptx(source,OPTIONS),entries=unzipSync(bytes),xml=slideXml(entries);
const [picture]=pictures(xml);
assert.ok(picture,'one native picture');
assert.match(picture,/<a:prstGeom prst="ellipse">/);
assert.match(picture,/descr="Priya Raman at her desk"/);
assert.match(picture,/name="OPF quote photo \d+"/);
assert.match(picture,/<a:srcRect\b/,'a portrait photo is cropped to fill the circle');
const ext=picture.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
assert.equal(ext[1],ext[2],'the circle frame is square');
// The footer role is its own native line.
assert.ok(xml.includes('Priya Raman'));
assert.ok(xml.includes('Head of Platform, Acme'));
assert.ok(/OPF quote \d+ part 1 line 1/.test(xml),'the role is the footer\'s second line');
// The photo's tag sits in the quote group and holds no words.
const tagParts=Object.entries(entries).filter(([name])=>name.startsWith('ppt/tags/')&&decode(entries[name]).includes('OPF_QUOTE_V1'));
const tags=tagParts.map(([,tagBytes])=>decode(tagBytes).match(/val="([0-9a-f]+)"/i)[1]).map(value=>decodeTextTag(value));
assert.equal(tags.filter(tag=>tag.role==='photo').length,1);
assert.ok(!JSON.stringify(tags).includes('Priya')&&!JSON.stringify(tags).includes('Head'),'tags hold topology only');
assert.equal(tags.find(tag=>tag.anchor).anchor.photo,true);
// Determinism.
assert.deepEqual(await toPptx(source,OPTIONS),bytes);
// A quote without a photo writes no picture and no photo flag: the export is as before.
const plain=await toPptx({design:{fontScheme:'roboto'},slides:[{title:'Customers',quote:{text:base,attribution:'Priya Raman',source:'Interview'}}]},OPTIONS);
assert.equal(pictures(slideXml(unzipSync(plain))).length,0);
assert.ok(!decode(unzipSync(plain)['ppt/slides/slide1.xml']).includes('OPF quote photo'));

// 3. Edits stay authoritative and damage degrades with a diagnostic.
const rebuilt=async mutate=>{const copy=structuredClone(entries);await mutate(copy);return importBytes(zipSync(copy));};
const edit=(copy,change)=>{copy['ppt/slides/slide1.xml']=encode(change(slideXml(copy)));};
const edited=await rebuilt(copy=>edit(copy,value=>value.replace('Head of Platform, Acme','VP Operations')));
assert.equal(quoteBlocks(edited.imported.slides[0])[0].quote.role,'VP Operations');
assert.deepEqual(quoteBlocks(edited.imported.slides[0])[0].quote.photo,photo);
const deleted=await rebuilt(copy=>edit(copy,value=>value.replace(/<p:pic>[\s\S]*?<\/p:pic>/,'')));
assert.equal(quoteBlocks(deleted.imported.slides[0])[0].quote.photo,undefined);
assert.equal(quoteBlocks(deleted.imported.slides[0])[0].quote.role,'Head of Platform, Acme');
assert.ok(deleted.diagnostics.some(d=>d.code==='quote-photo-missing'));
const renamed=await rebuilt(copy=>edit(copy,value=>value.replace(/name="OPF quote photo \d+"/,'name="Picture 9"')));
assert.ok(renamed.diagnostics.some(d=>d.code==='invalid-quote-provenance'),'a renamed headshot breaks the group, which imports as ordinary content');
assert.ok(!quoteBlocks(renamed.imported.slides[0]).length);

// 4. An unresolvable photo draws the ordinary image placeholder and the quote still exports.
const missing=await toPptx({design:{fontScheme:'roboto'},assets:{},slides:[{title:'Customers',quote:{text:base,attribution:'Priya Raman',photo:{src:'asset:nobody',alt:'Nobody'}}}]},OPTIONS);
const missingXml=slideXml(unzipSync(missing));
assert.ok(missingXml.includes('OPF image placeholder'),'an unresolved photo draws the ordinary image placeholder');
assert.equal(pictures(missingXml).length,0);

console.log(`Quote photo: ${cases} role/photo combinations round trip exactly in both directions; native ellipse picture with alt text, topology-only tags, edits and deleted-picture degradation.`);
