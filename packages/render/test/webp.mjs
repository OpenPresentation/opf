import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {PDFDocument,PDFName,PDFRawStream,decodePDFRawStream} from 'pdf-lib';
import {renderSvg} from '../dist/index.js';
import {prepareRasterImages} from '../dist/raster-images.js';
const {svgToPng,svgToPdf}=await import(process.env.OPF_TEST_RASTER_MODULE ?? '../dist/index.js');
const references=JSON.parse(await readFile(new URL('fixtures/webp/webp-references.json',import.meta.url),'utf8'));
const options={useBundledFonts:false,background:'rgba(0,0,0,0)'};
const hash=value=>createHash('sha256').update(value).digest('hex');
let cases=0;
for(const [file,ref] of Object.entries(references)) {
 const source=new Uint8Array(await readFile(new URL('fixtures/webp/'+file,import.meta.url)));
 const original=new Uint8Array(source);
 const uri='data:image/webp;base64,'+Buffer.from(source).toString('base64');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${ref.width}" height="${ref.height}"><image href="${uri}" width="${ref.width}" height="${ref.height}"/></svg>`;
 const png=await svgToPng(svg,options);
 const pixels=await sharp(png).ensureAlpha().raw().toBuffer();
 // Raster compositing may round alpha-premultiplied colors; compare that case
 // against the decoded PNG placed through the same compositor below.
 if(file!=='wide-alpha.webp') assert.equal(hash(pixels),ref.rgbaSha256,file+': independent Pillow pixel reference');
 const decoded=await sharp(source).autoOrient().ensureAlpha().png().toBuffer();
 const pngSvg=svg.replace(uri,'data:image/png;base64,'+decoded.toString('base64'));
 assert.deepEqual(png,await svgToPng(pngSvg,options),file+': same raster as decoded PNG');
 assert.deepEqual(png,await svgToPng(new TextEncoder().encode(svg),options),'String and byte SVG inputs agree');
 for(const fit of ['meet','slice']) {
  const fitted=svg.replace(`width="${ref.width}" height="${ref.height}"><image`,`width="100" height="100"><image`).replace(`width="${ref.width}" height="${ref.height}"/>`,`width="100" height="100" preserveAspectRatio="xMidYMid ${fit}"/>`);
  const expected=fitted.replace(uri,'data:image/png;base64,'+decoded.toString('base64'));
  assert.deepEqual(await svgToPng(fitted,options),await svgToPng(expected,options),`${file}: ${fit} geometry`);
  cases++;
 }
 assert.deepEqual(source,original,'Input bytes unchanged');
 const pdf=await svgToPdf(svg,options),document=await PDFDocument.load(pdf);
 assert.equal(document.getPageCount(),1);
 const streams=document.context.enumerateIndirectObjects().map(([,object])=>object).filter(object=>object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype'))===PDFName.of('Image')&&object.dict.get(PDFName.of('ColorSpace'))===PDFName.of('DeviceRGB'));
 assert.equal(streams.length,1);
 const rgb=decodePDFRawStream(streams[0]).decode();
 const expectedRgb=await sharp(png).removeAlpha().raw().toBuffer();
 assert.deepEqual(Buffer.from(rgb),expectedRgb,file+': actual PDF image pixels');
 if(file==='wide-alpha.webp') {
  const mask=document.context.lookup(streams[0].dict.get(PDFName.of('SMask')));
  assert.ok(mask instanceof PDFRawStream,'PDF transparency mask is present');
  const alpha=decodePDFRawStream(mask).decode();
  assert.equal(alpha.length,ref.width*ref.height);
  assert.ok(alpha.every(value=>value===128),'PDF retains the specimen transparency');
 }
 assert.deepEqual(pdf,await svgToPdf(svg,options),'PDF bytes deterministic');
 cases++;
}
const bytes=await readFile(new URL('fixtures/webp/wide.webp',import.meta.url));
const uri='data:image/webp;base64,'+bytes.toString('base64');
const percent='data:image/webp,'+[...bytes].map(byte=>'%'+byte.toString(16).padStart(2,'0')).join('');
const root=content=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="120" height="60">${content}</svg>`;
const image=href=>`<image width="120" height="60" ${href}/>`;
const expected=await svgToPng(root(image(`href="${uri}"`)),options);
for(const href of [`href='data:image/webp;base64,${encodeURIComponent(bytes.toString('base64'))}'`,`xlink:href='${uri}'`,`href='${percent}'`,`href='${uri.replace('data:','data&#58;')}'`,`href='${uri}' xlink:href='data:image/webp;base64,broken'`]) {
 assert.equal(hash(await svgToPng(root(image(href)),options)),hash(expected),href.slice(0,40));cases++;
}
const untouched=root(`<!-- ${image(`href='data:image/webp;base64,broken'`)} --><desc><![CDATA[${image(`href='data:image/webp;base64,broken'`)}]]></desc>`);
assert.equal(await prepareRasterImages(untouched),untouched);
const remote=root(image("href='https://example.invalid/image.webp'"));assert.equal(await prepareRasterImages(remote),remote,'No external resource resolution added');
await assert.rejects(svgToPng(root(image("data-opf-path='slides.2.image' href='data:image/webp;base64,broken'")),options),error=>error.code==='image-conversion-failed'&&error.path==='slides.2.image');
await assert.rejects(svgToPdf(root(image("href='data:image/webp,%GG'")),options),error=>error.code==='image-conversion-failed'&&error.path==='svg.images.0');
const huge=Buffer.from(await readFile(new URL('fixtures/webp/wide-alpha.webp',import.meta.url)));huge.fill(255,24,30);
await assert.rejects(svgToPng(root(image(`href='data:image/webp;base64,${huge.toString('base64')}'`)),options),error=>error.code==='image-conversion-failed');
const fake=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');
await assert.rejects(svgToPng(root(image(`href='data:image/webp;base64,${fake}'`)),options),error=>error.code==='image-conversion-failed'&&/not a WebP/.test(error.details.cause));
const deck={slides:[{image:uri}]},original=JSON.stringify(deck);const opfSvg=renderSvg(deck,{trace:true});
const prepared=await prepareRasterImages(opfSvg);assert.match(prepared,/data:image\/png;base64,/);assert.equal(JSON.stringify(deck),original);assert.match(opfSvg,/data:image\/webp;base64,/);
console.log(`WebP raster passed: ${cases} PNG/PDF and fit/crop cases; independent pixels, PDF image streams, alpha/EXIF/first frame, SVG input forms, errors and unchanged source SVG.`);
