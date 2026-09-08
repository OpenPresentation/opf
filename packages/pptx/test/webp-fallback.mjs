import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {unzipSync} from 'fflate';
import {toPptx,fromPptx} from '../dist/index.js';
import {rasterMetadata} from '../dist/image-geometry.js';
const references=JSON.parse(await readFile(new URL('fixtures/images/webp-references.json',import.meta.url),'utf8'));
let cases=0;
for(const [file,reference] of Object.entries(references)) {
 const path=fileURLToPath(new URL('fixtures/images/'+file,import.meta.url));
 const bytes=new Uint8Array(await readFile(path));
 const original=new Uint8Array(bytes);
 for(const mode of ['fit','crop']) for(const source of ['uri','path','resolver']) {
  const uri='data:image/webp;base64,'+Buffer.from(bytes).toString('base64');
  const deck={design:{imageFill:mode},slides:[{image:{src:source==='uri'?uri:source==='path'?path:'https://example.invalid/image',alt:file}}]};
  let calls=0;
  const options={strictAssets:true,...(source==='resolver'?{imageResolver:()=>{calls++;return bytes;}}:{})};
  const output=await toPptx(deck,options),entries=unzipSync(output);
  assert.equal(calls,source==='resolver'?1:0);
  const media=Object.entries(entries).filter(([name])=>name.startsWith('ppt/media/')&&!name.endsWith('/'));
  assert.equal(media.length,1); assert.ok(media[0][0].endsWith('.png'));
  const png=media[0][1],metadata=rasterMetadata(png);
  assert.equal(metadata.mediaType,'image/png');assert.equal(metadata.width,reference.width);assert.equal(metadata.height,reference.height);
  const rgba=await sharp(png).ensureAlpha().raw().toBuffer();
  assert.equal(createHash('sha256').update(rgba).digest('hex'),reference.rgbaSha256,file+': independent Pillow decoded-pixel reference');
  const imported=await fromPptx(output),image=imported.slides[0].blocks.find(b=>b.image).image;
  assert.equal(image.src,'data:image/png;base64,'+Buffer.from(png).toString('base64')); assert.equal(image.alt,file);
  assert.deepEqual(bytes,original,'Input bytes remain unchanged');
  if(source==='uri') assert.deepEqual(output,await toPptx(deck,options),'Compatible image export is deterministic');
  cases++;
 }
}
const corrupt=new Uint8Array(await readFile(new URL('fixtures/images/wide.webp',import.meta.url)));
corrupt.fill(0,25);
await assert.rejects(toPptx({slides:[{image:'https://example.invalid/broken'}]},{imageResolver:()=>corrupt}),error=>error.code==='image-conversion-failed'&&error.path==='slides.0.image');
const huge=new Uint8Array(await readFile(new URL('fixtures/images/wide-alpha.webp',import.meta.url)));
huge.fill(255,24,30);
await assert.rejects(toPptx({slides:[{image:'https://example.invalid/huge'}]},{imageResolver:()=>huge}),error=>error.code==='image-conversion-failed'&&/40 megapixel/.test(error.details.cause));
await assert.rejects(toPptx({slides:[{text:'Invalid option'}]},{imageFormat:'jpeg'}),error=>error.code==='invalid-image-format');
console.log(`WebP fallback passed: ${cases} fit/crop and input-form cases, Pillow pixel references, alpha, EXIF, first animation frame, deterministic output, errors and unchanged source bytes.`);
