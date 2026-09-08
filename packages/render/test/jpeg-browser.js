import {renderSvg} from '@openpresentation/opf-render';
const out=document.querySelector('pre');
async function pixels(svg) {
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 try {
  const image=new Image();image.src=url;await image.decode();
  const canvas=new OffscreenCanvas(image.naturalWidth,image.naturalHeight),context=canvas.getContext('2d');
  context.drawImage(image,0,0);return context.getImageData(0,0,canvas.width,canvas.height).data;
 } finally {URL.revokeObjectURL(url);}
}
try {
 let cases=0,maxDifference=0;const measurements=[];let controlMean;
 for(let orientation=1;orientation<=8;orientation++) {
  const toUri=async(name,type)=>{const bytes=new Uint8Array(await(await fetch('/test/fixtures/jpeg/'+name)).arrayBuffer());return 'data:'+type+';base64,'+btoa(String.fromCharCode(...bytes));};
  const jpeg=await toUri(`orientation-${orientation}.jpg`,'image/jpeg');
  const png=await toUri(`expected-${orientation}.png`,'image/png');
  for(const imageFill of ['fit','crop']) {
   const svg=renderSvg({design:{imageFill},slides:[{image:jpeg}]});
   const a=await pixels(svg),b=await pixels(svg.replace(jpeg,png));
   let difference=0,total=0,large=0;for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);difference=Math.max(difference,delta);total+=delta;if(delta>10)large++;}measurements.push({orientation,imageFill,max:difference,mean:total/a.length,largePercent:large/a.length*100});
   maxDifference=Math.max(maxDifference,difference);
   // JPEG and PNG decoding/scaling can differ at sharp color boundaries.
   // Bound aggregate error and prove this criterion rejects wrong orientation.
   if(total/a.length>1||large/a.length>.02)throw new Error(`Orientation ${orientation} ${imageFill}: excessive image mismatch`);
   if(orientation===6&&imageFill==='fit') {
    const wrong=await toUri('orientation-1.jpg','image/jpeg');
    const c=await pixels(svg.replace(jpeg,wrong));let error=0;
    for(let i=0;i<c.length;i++)error+=Math.abs(c[i]-b[i]);
    controlMean=error/c.length;if(controlMean<=1)throw new Error('The wrong-orientation control was not rejected');
   }
   
   cases++;
  }
 }
 out.textContent=JSON.stringify({passed:true,cases,maxDifference,controlMean,measurements,checks:'Browser-rendered OPF SVG JPEG orientation and fit/crop against independent Pillow PNGs'},null,2);
 document.title='PASS: JPEG browser orientation';
} catch(error) {out.textContent=error.stack;document.title='FAIL: JPEG browser orientation';}
