import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx} from '../dist/index.js';
import {rasterMetadata} from '../dist/image-geometry.js';
const parser=new XMLParser({ignoreAttributes:false});
const nativeTransform=({x,y,w,h,rotation,flipH,flipV},u,v)=>{
 let dx=(u-.5)*w,dy=(v-.5)*h;
 if(flipH)dx=-dx;if(flipV)dy=-dy;
 const a=rotation*Math.PI/180;
 return [x+w/2+dx*Math.cos(a)-dy*Math.sin(a),y+h/2+dx*Math.sin(a)+dy*Math.cos(a)];
};
// Expected orientation maps are independent of the exporter: normalized
// source coordinates to display coordinates for the eight EXIF orientations.
const expected=[null,(u,v)=>[u,v],(u,v)=>[1-u,v],(u,v)=>[1-u,1-v],(u,v)=>[u,1-v],(u,v)=>[v,u],(u,v)=>[1-v,u],(u,v)=>[1-v,1-u],(u,v)=>[v,1-u]];
for(let orientation=1;orientation<=8;orientation++)for(const mode of ['fit','crop']){
 const source=await readFile(new URL(`fixtures/images/orientation-${orientation}.jpg`,import.meta.url));
 const before=Buffer.from(source),meta=rasterMetadata(source);assert.equal(meta.orientation,orientation);
 const deck={design:{imageFill:mode},slides:[{image:'data:image/jpeg;base64,'+source.toString('base64')}]};
 const entries=unzipSync(await toPptx(deck)),xml=parser.parse(new TextDecoder().decode(entries['ppt/slides/slide1.xml']));
 const pic=xml['p:sld']['p:cSld']['p:spTree']['p:pic'],xf=pic['p:spPr']['a:xfrm'];
 const geom={x:Number(xf['a:off']['@_x']),y:Number(xf['a:off']['@_y']),w:Number(xf['a:ext']['@_cx']),h:Number(xf['a:ext']['@_cy']),rotation:Number(xf['@_rot']??0)/60000,flipH:xf['@_flipH']==='1',flipV:xf['@_flipV']==='1'};
 const points=[[0,0],[1,0],[0,1],[1,1]].map(([u,v])=>nativeTransform(geom,u,v));
 const minX=Math.min(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),width=Math.max(...points.map(p=>p[0]))-minX,height=Math.max(...points.map(p=>p[1]))-minY;
 for(let i=0;i<4;i++){
  const [u,v]=[[0,0],[1,0],[0,1],[1,1]][i],want=expected[orientation](u,v);
  assert.ok(Math.abs((points[i][0]-minX)/width-want[0])<1e-8);
  assert.ok(Math.abs((points[i][1]-minY)/height-want[1])<1e-8);
 }
 if(mode==='fit')assert.ok(Math.abs(width/height-(orientation>=5?.5:2))<1e-6);
 const embedded=Object.entries(entries).find(([name])=>name.startsWith('ppt/media/')&&name.endsWith('.jpeg'))?.[1]??Object.entries(entries).find(([name])=>name.startsWith('ppt/media/')&&name.endsWith('.jpg'))?.[1];
 assert.ok(embedded);assert.equal(rasterMetadata(embedded).orientation,1);
 const restored=embedded.slice();new DataView(restored.buffer,restored.byteOffset,restored.byteLength).setUint16(meta.orientationOffset,orientation,meta.littleEndian);
 assert.deepEqual(Buffer.from(restored),source,'Only EXIF orientation is normalized; compressed pixels and other metadata remain unchanged');
 assert.deepEqual(source,before);
}
// A corrupt EXIF offset cannot read outside the APP1 segment.
const corrupt=await readFile(new URL('fixtures/images/orientation-6.jpg',import.meta.url));
const signature=corrupt.indexOf(Buffer.from('Exif\0\0'));corrupt.writeUInt32BE(0xffffffff,signature+10);
assert.equal(rasterMetadata(corrupt).orientation,undefined);

// The same EXIF record in little-endian TIFF form must produce the same transform.
const little = await readFile(new URL('fixtures/images/orientation-6.jpg',import.meta.url));
const exifStart = little.indexOf(Buffer.from('Exif\0\0')) + 6;
const littleView = new DataView(little.buffer,little.byteOffset,little.byteLength);
little[exifStart]=0x49;little[exifStart+1]=0x49;
littleView.setUint16(exifStart+2,42,true);littleView.setUint32(exifStart+4,8,true);
littleView.setUint16(exifStart+8,1,true);littleView.setUint16(exifStart+10,0x112,true);
littleView.setUint16(exifStart+12,3,true);littleView.setUint32(exifStart+14,1,true);littleView.setUint16(exifStart+18,6,true);
assert.equal(rasterMetadata(little).orientation,6);assert.equal(rasterMetadata(little).littleEndian,true);
const littleDeck={slides:[{image:'data:image/jpeg;base64,'+little.toString('base64')}]};
assert.deepEqual(await toPptx(littleDeck),await toPptx(littleDeck),'Image export remains byte-stable');

console.log('Image orientation passed: all 8 EXIF orientations in fit/crop, native corner transforms, normalized metadata, unchanged pixels and bounded EXIF offsets.');
