import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {unzipSync,zipSync} from 'fflate';
import sharp from 'sharp';
import {validatePresentation} from '@openpresentation/opf';
import {resolveCanvasDimensions} from '@openpresentation/opf/composition';
const {toPptx,fromPptx}=await import(process.env.OPF_TEST_PPTX_MODULE ?? '../dist/index.js');
import {rasterMetadata} from '../dist/image-geometry.js';
import {importImageOrientation} from '../dist/image-import.js';
const text=new TextDecoder(),encode=new TextEncoder();
const sourceImage=doc=>doc.slides[0].blocks.find(block=>block.image).image;
const imageBytes=doc=>Buffer.from(sourceImage(doc).src.split(',')[1],'base64');
const raw=bytes=>sharp(bytes).autoOrient().ensureAlpha().raw().toBuffer({resolveWithObject:true});
let cases=0;
for(const imageFill of ['fit','crop'])for(let orientation=1;orientation<=8;orientation++) {
 const source=await readFile(new URL(`fixtures/images/orientation-${orientation}.jpg`,import.meta.url));
 const deck={design:{imageFill},slides:[{image:{src:'data:image/jpeg;base64,'+source.toString('base64'),alt:'Orientation specimen'}}]};
 const native=await toPptx(deck),before=Buffer.from(native),reports=[];
 const imported=await fromPptx(native,{onDiagnostic:d=>reports.push(d)}),bytes=imageBytes(imported);
 assert.deepEqual(bytes,source,'Restore exact source JPEG metadata without recompressing pixels');
 assert.equal(sourceImage(imported).alt,'Orientation specimen');
 assert.deepEqual(resolveCanvasDimensions(imported.design.dimensions),{width:1280,height:720},'Native canvas dimensions must retain full precision');
 assert.deepEqual(await raw(bytes),await raw(source),'Decoded pixels retain source orientation');
 assert.equal(validatePresentation(imported).valid,true);assert.deepEqual(Buffer.from(native),before,'Input PPTX is unchanged');
 assert.deepEqual(imageBytes(await fromPptx(await toPptx(imported))),source,'Repeated image round-trip stays stable');
 assert.equal(reports.length,imageFill==='crop'?1:0);
 if(reports.length){assert.equal(reports[0].code,'unsupported-image-crop');assert.equal(reports[0].path,'slides.0.pictures.0');}
 cases++;
}
const source=await readFile(new URL('fixtures/images/orientation-1.jpg',import.meta.url));
const originalBuffer=Buffer.from(source);
const direct=importImageOrientation(source,{rot:'5400000'});
assert.deepEqual(source,originalBuffer,'Buffer input must not be mutated by metadata changes');
assert.equal(rasterMetadata(direct).orientation,6);
const base=await toPptx({slides:[{image:'data:image/jpeg;base64,'+source.toString('base64')}]});
// Edit actual native transforms. Pixel permutation is independent of EXIF
// matrix lookup: mirror integer source pixels, then place a quarter-turn.
const pixels=await raw(source);
for(const quarter of [0,1,2,3])for(const flipH of [false,true])for(const flipV of [false,true]) {
 const entries=unzipSync(base);
 // Target the picture rather than the preceding slide group transform.
 let xml=text.decode(entries['ppt/slides/slide1.xml']);
 xml=xml.replace(/<p:pic>[\s\S]*?<\/p:pic>/,pic=>pic.replace(/<a:xfrm[^>]*>/,`<a:xfrm rot="${quarter*5400000}" flipH="${flipH}" flipV="${flipV}">`));
 entries['ppt/slides/slide1.xml']=encode.encode(xml);
 const imported=await fromPptx(zipSync(entries)),actual=await raw(imageBytes(imported));
 const w=pixels.info.width,h=pixels.info.height,ow=quarter%2?h:w,oh=quarter%2?w:h,expected=Buffer.alloc(ow*oh*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
  const mx=flipH?w-1-x:x,my=flipV?h-1-y:y;
  const [u,v]=quarter===0?[mx,my]:quarter===1?[h-1-my,mx]:quarter===2?[w-1-mx,h-1-my]:[my,w-1-mx];
  pixels.data.copy(expected,(v*ow+u)*4,(y*w+x)*4,(y*w+x)*4+4);
 }
 assert.equal(actual.info.width,ow);assert.equal(actual.info.height,oh);assert.deepEqual(actual.data,expected);cases++;
}
// Remove APP1 while retaining all other JPEG bytes, including the scan.
function stripExif(bytes) {
 const parts=[bytes.subarray(0,2)];let at=2;
 while(at<bytes.length){const start=at,marker=bytes[at+1];if(marker===0xda||marker===0xd9){parts.push(bytes.subarray(at));break;}const length=bytes.readUInt16BE(at+2);at+=length+2;if(marker!==0xe1)parts.push(bytes.subarray(start,at));}
 return Buffer.concat(parts);
}
const plain=stripExif(source);
function metadataWithoutOrientation(little) {
 // IFD0: description (out-of-line ASCII), resolution unit, artist; linked
 // IFD1 has a width entry. Both the value offsets and next-IFD link must survive.
 const description=Buffer.from('OpenPresentation fixture\0'),artist=Buffer.from('MIT fixture author\0');
 const tiff=Buffer.alloc(120),view=new DataView(tiff.buffer,tiff.byteOffset,tiff.byteLength);
 tiff.set(little?[0x49,0x49]:[0x4d,0x4d]);view.setUint16(2,42,little);view.setUint32(4,8,little);view.setUint16(8,3,little);
 for(const [index,tag,type,count,value]of [[0,0x10e,2,description.length,50],[1,0x128,3,1,2],[2,0x13b,2,artist.length,76]]){
  const at=10+index*12;view.setUint16(at,tag,little);view.setUint16(at+2,type,little);view.setUint32(at+4,count,little);
  if(type===3)view.setUint16(at+8,value,little);else view.setUint32(at+8,value,little);
 }
 view.setUint32(46,100,little);tiff.set(description,50);tiff.set(artist,76);
 view.setUint16(100,1,little);view.setUint16(102,0x100,little);view.setUint16(104,4,little);view.setUint32(106,1,little);view.setUint32(110,120,little);
 const app=Buffer.concat([Buffer.from([0xff,0xe1,0,128]),Buffer.from('Exif\0\0'),tiff]);
 return Buffer.concat([plain.subarray(0,2),app,plain.subarray(2)]);
}
const replaceMedia=async bytes=>{
 const entries=unzipSync(base),media=Object.keys(entries).find(p=>/^ppt\/media\/.+\.jpe?g$/.test(p));entries[media]=bytes;
 entries['ppt/slides/slide1.xml']=encode.encode(text.decode(entries['ppt/slides/slide1.xml']).replace(/<p:pic>[\s\S]*?<\/p:pic>/,pic=>pic.replace(/<a:xfrm[^>]*>/,'<a:xfrm rot="5400000">')));
 return fromPptx(zipSync(entries));
};
for(const bytes of [plain,metadataWithoutOrientation(false),metadataWithoutOrientation(true)]) {
 const original=Buffer.from(bytes),imported=await replaceMedia(bytes),restored=imageBytes(imported);
 assert.equal(rasterMetadata(restored).orientation,6);assert.deepEqual(stripExif(restored),stripExif(bytes),'All non-EXIF bytes preserved');assert.deepEqual(bytes,original);
 if(bytes!==plain){
  const oldStart=bytes.indexOf(Buffer.from('Exif\0\0'))+6,newStart=restored.indexOf(Buffer.from('Exif\0\0'))+6,little=bytes[oldStart]===0x49;
  const view=new DataView(restored.buffer,restored.byteOffset,restored.byteLength),directory=newStart+view.getUint32(newStart+4,little);
  assert.equal(view.getUint16(directory,little),4);assert.equal(view.getUint32(directory+2+4*12,little),100);
  assert.deepEqual(restored.subarray(newStart+8,newStart+120),bytes.subarray(oldStart+8,oldStart+120),'Existing IFDs and referenced metadata bytes unchanged');
  const info=await sharp(restored).metadata();assert.equal(info.orientation,6);
 }
 cases++;
}
// Existing embedded EXIF orientation is applied before native transforms.
for (let orientation=2;orientation<=8;orientation++) {
 const bytes=await readFile(new URL(`fixtures/images/orientation-${orientation}.jpg`,import.meta.url));
 const imported=await replaceMedia(bytes),before=await raw(bytes),after=await raw(imageBytes(imported));
 const expected=Buffer.alloc(before.data.length),w=before.info.width,h=before.info.height;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)before.data.copy(expected,(x*h+(h-1-y))*4,(y*w+x)*4,(y*w+x)*4+4);
 assert.equal(after.info.width,h);assert.equal(after.info.height,w);assert.deepEqual(after.data,expected);cases++;
}
// Unsafe EXIF append fails conservatively with a diagnostic and no mutation.
const corrupt=metadataWithoutOrientation(false),start=corrupt.indexOf(Buffer.from('Exif\0\0'))+6;
corrupt.writeUInt32BE(0xffffffff,start+4);
const corruptParts=unzipSync(base),corruptMedia=Object.keys(corruptParts).find(p=>/^ppt\/media\/.+\.jpe?g$/.test(p));corruptParts[corruptMedia]=corrupt;
corruptParts['ppt/slides/slide1.xml']=encode.encode(text.decode(corruptParts['ppt/slides/slide1.xml']).replace(/<p:pic>[\s\S]*?<\/p:pic>/,pic=>pic.replace(/<a:xfrm[^>]*>/,'<a:xfrm rot="5400000">')));
const corruptReports=[],corruptImport=await fromPptx(zipSync(corruptParts),{onDiagnostic:d=>corruptReports.push(d)});
assert.equal(corruptReports[0].code,'unsupported-image-orientation');assert.deepEqual(imageBytes(corruptImport),corrupt);
// Crops and unsupported transforms are observable; original bytes survive.
for(const [rotation,usePng] of [[30,false],[90,true]]){
 const entries=unzipSync(base),key=Object.keys(entries).find(p=>/^ppt\/media\/.+\.jpe?g$/.test(p));
 if(usePng)entries[key]=await sharp(source).png().toBuffer();
 const original=Buffer.from(entries[key]);
 entries['ppt/slides/slide1.xml']=encode.encode(text.decode(entries['ppt/slides/slide1.xml']).replace(/<p:pic>[\s\S]*?<\/p:pic>/,pic=>pic.replace(/<a:xfrm[^>]*>/,`<a:xfrm rot="${rotation*60000}">`)));
 const reports=[],imported=await fromPptx(zipSync(entries),{onDiagnostic:d=>reports.push(d)});
 assert.equal(reports[0].code,'unsupported-image-orientation');assert.equal(reports[0].path,'slides.0.pictures.0');assert.deepEqual(imageBytes(imported),original);
}
await mkdir(new URL('../artifacts/image-import/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/image-import/after.json',import.meta.url),JSON.stringify({cases,verified:'JPEG source bytes, decoded pixels, 16 native quarter-turn/flip combinations, both EXIF byte orders, metadata offsets and import diagnostics'},null,2));
console.log(`Picture import passed: ${cases} orientation/native-edit/EXIF cases, exact source JPEG round-trips, independent pixel permutations, metadata preservation and crop/transform diagnostics.`);
