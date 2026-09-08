import {toPptx} from '@openpresentation/opf-pptx';
import {unzipSync} from 'fflate';
const out=document.querySelector('pre');
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const bitmap=createImageBitmap;
async function pixels(bytes,type) {
 const image=await bitmap(new Blob([bytes],{type}));
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const context=canvas.getContext('2d');context.drawImage(image,0,0);image.close();
 return {width:canvas.width,height:canvas.height,bytes:context.getImageData(0,0,canvas.width,canvas.height).data};
}
try {
 let cases=0;
 for(const file of ['wide.webp','wide-lossy.webp','wide-alpha.webp','webp-orientation-6.webp','webp-orientation-7.webp','wide-animated.webp']) {
  const source=new Uint8Array(await (await fetch('/test/fixtures/images/'+file)).arrayBuffer());
  const expected=await pixels(source,'image/webp');
  for(const mode of ['fit','crop']) {
   const deck={design:{imageFill:mode},slides:[{image:'https://example.invalid/'+file}]};
   let calls=0;
   const pptx=await toPptx(deck,{imageResolver:()=>{calls++;return source;}});
   check(calls===1,'Resolver called more than once');
   const media=Object.entries(unzipSync(pptx)).filter(([name])=>name.startsWith('ppt/media/')&&!name.endsWith('/'));
   check(media.length===1&&media[0][0].endsWith('.png'),'Expected native PNG');
   const actual=await pixels(media[0][1],'image/png');
   check(actual.width===expected.width&&actual.height===expected.height,file+' dimensions');
   let difference=0;for(let i=0;i<actual.bytes.length;i++)difference=Math.max(difference,Math.abs(actual.bytes[i]-expected.bytes[i]));
   check(difference<=1,file+' pixel mismatch '+difference);
   cases++;
  }
 }
 // Exercise HTMLCanvasElement.toBlob when OffscreenCanvas is unavailable.
 const saved=globalThis.OffscreenCanvas;
 try {
  globalThis.OffscreenCanvas=undefined;
  const source=new Uint8Array(await (await fetch('/test/fixtures/images/wide-alpha.webp')).arrayBuffer());
  const output=unzipSync(await toPptx({slides:[{image:'https://example.invalid/image'}]},{imageResolver:()=>source}));
  check(Object.keys(output).some(name=>name.startsWith('ppt/media/')&&name.endsWith('.png')),'DOM canvas PNG missing');cases++;
 } finally {globalThis.OffscreenCanvas=saved;}
 out.textContent=JSON.stringify({passed:true,cases,checks:'PPTX PNG embedding, source pixels, alpha, EXIF, first animation frame, fit/crop, resolver once, DOM canvas'},null,2);
 document.title='PASS: WebP fallback';
} catch(error) {out.textContent=error.stack;document.title='FAIL: WebP fallback';}
