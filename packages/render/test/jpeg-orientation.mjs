import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {PDFDocument,PDFName,PDFRawStream,decodePDFRawStream} from 'pdf-lib';
import {prepareRasterImages} from '../dist/raster-images.js';
const {svgToPng,svgToPdf}=await import(process.env.OPF_TEST_RASTER_MODULE ?? '../dist/index.js');
const options={useBundledFonts:false,background:'transparent'};
const raw=async png=>sharp(png).ensureAlpha().raw().toBuffer();
let cases=0,maxDifference=0;
for(let orientation=1;orientation<=8;orientation++) {
 const jpeg=await readFile(new URL(`fixtures/jpeg/orientation-${orientation}.jpg`,import.meta.url));
 const expected=await readFile(new URL(`fixtures/jpeg/expected-${orientation}.png`,import.meta.url));
 const uri='data:image/jpeg;base64,'+jpeg.toString('base64');
 const {width,height}=await sharp(expected).metadata();
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image data-opf-path="slides.0.image" href="${uri}" width="${width}" height="${height}"/></svg>`;
 const prepared=await prepareRasterImages(svg);
 if(orientation===1) assert.equal(prepared,svg,'Orientation 1 retains original SVG and compressed JPEG bytes');
 else assert.match(prepared,/href="data:image\/png;base64,/);
 const png=await svgToPng(svg,options),actual=await raw(png),reference=await raw(expected);
 assert.equal(actual.length,reference.length);
 let difference=0;for(let i=0;i<actual.length;i++) difference=Math.max(difference,Math.abs(actual[i]-reference[i]));
 maxDifference=Math.max(maxDifference,difference);
 assert.ok(difference<=2,`Orientation ${orientation}: pixel difference ${difference} against independent Pillow reference`);
 assert.deepEqual(png,await svgToPng(svg,options),'Stable repeated PNG export');
 for(const fit of ['meet','slice']) {
  const fitted=svg.replace(`width="${width}" height="${height}"><image`,`width="100" height="100"><image`).replace(`width="${width}" height="${height}"/>`,`width="100" height="100" preserveAspectRatio="xMidYMid ${fit}"/>`);
  const expectedSvg=fitted.replace(uri,'data:image/png;base64,'+expected.toString('base64'));
  const a=await raw(await svgToPng(fitted,options)),b=await raw(await svgToPng(expectedSvg,options));
  let error=0;for(let i=0;i<a.length;i++)error=Math.max(error,Math.abs(a[i]-b[i]));
  assert.ok(error<=2,`Orientation ${orientation} ${fit}: difference ${error}`);cases++;
 }
 const pdf=await PDFDocument.load(await svgToPdf(svg,options));
 assert.equal(pdf.getPage(0).getWidth(),width);assert.equal(pdf.getPage(0).getHeight(),height);
 const streams=pdf.context.enumerateIndirectObjects().map(([,o])=>o).filter(o=>o instanceof PDFRawStream&&o.dict.get(PDFName.of('Subtype'))===PDFName.of('Image')&&o.dict.get(PDFName.of('ColorSpace'))===PDFName.of('DeviceRGB'));
 assert.equal(streams.length,1);
 assert.deepEqual(Buffer.from(decodePDFRawStream(streams[0]).decode()),await sharp(png).removeAlpha().raw().toBuffer(),'PDF contains the correctly oriented raster');
 cases++;
}
const plain=await sharp(await readFile(new URL('fixtures/jpeg/orientation-1.jpg',import.meta.url))).jpeg().toBuffer();
const plainUri='data:image/jpeg;base64,'+plain.toString('base64');
const plainSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><image href="${plainUri.replace('data:','data&#58;')}" width="120" height="60"/></svg>`;
assert.equal(await prepareRasterImages(plainSvg),plainSvg,'Unoriented JPEG and original XML entity spelling remain untouched');
const invalid='<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><image data-opf-path="slides.3.image" href="data:image/jpeg;base64,YmFk" width="10" height="10"/></svg>';
await assert.rejects(svgToPng(invalid,options),e=>e.code==='image-conversion-failed'&&e.path==='slides.3.image');
console.log(`JPEG orientation passed: ${cases} raster/PDF and fit/crop cases across all eight orientations; independent Pillow pixels (max channel difference ${maxDifference}), original orientation-1 bytes and path-specific errors.`);
