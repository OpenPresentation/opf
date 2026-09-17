// Original abstract demonstration artwork, MIT licensed with this repository.
// Build-time only: embedded PNGs need no renderer, font, account or network.
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const rgb=hex=>[1,3,5].map(offset=>Number.parseInt(hex.slice(offset,offset+2),16));
const palettes=[['#2563EB','#14B8A6'],['#0F766E','#F59E0B'],['#7C3AED','#DB2777'],['#0369A1','#22C55E'],['#B45309','#EF4444'],['#4338CA','#06B6D4']];
const mix=(a,b,t)=>a.map((value,i)=>Math.round(value+(b[i]-value)*t));
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xEDB88320^(n>>>1):n>>>1;return n>>>0;});
const crc=bytes=>{let value=0xFFFFFFFF;for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);return (value^0xFFFFFFFF)>>>0;};
function chunk(type,data){const label=Buffer.from(type),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([label,data])));return Buffer.concat([length,label,data,checksum]);}
function encodePng(width,height,pixels){
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const scanlines=Buffer.alloc(height*(1+width*4));
 for(let y=0;y<height;y++)pixels.copy(scanlines,y*(width*4+1)+1,y*width*4,(y+1)*width*4);
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(scanlines,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
function canvas(width,height){
 const pixels=Buffer.alloc(width*height*4);
 const paint=(x,y,color,alpha=1)=>{
  if(x<0||y<0||x>=width||y>=height)return;
  const at=(y*width+x)*4,old=pixels[at+3]/255,a=Math.min(1,Math.max(0,alpha)),combined=a+old*(1-a);if(!combined)return;
  for(let c=0;c<3;c++)pixels[at+c]=Math.round((color[c]*a+pixels[at+c]*old*(1-a))/combined);
  pixels[at+3]=Math.round(combined*255);
 };
 const shape=(x0,y0,x1,y1,coverage,color,opacity=1)=>{
  for(let y=Math.max(0,Math.floor(y0));y<Math.min(height,Math.ceil(y1));y++)for(let x=Math.max(0,Math.floor(x0));x<Math.min(width,Math.ceil(x1));x++)paint(x,y,color,coverage(x+.5,y+.5)*opacity);
 };
 const roundRect=(x,y,w,h,r,color,opacity=1)=>shape(x,y,x+w,y+h,(px,py)=>{
  const dx=Math.max(x+r-px,0,px-(x+w-r)),dy=Math.max(y+r-py,0,py-(y+h-r));return Math.min(1,Math.max(0,r+.5-Math.hypot(dx,dy)));
 },color,opacity);
 const line=(x1,y1,x2,y2,stroke,color,opacity=1)=>{
  const dx=x2-x1,dy=y2-y1,squared=dx*dx+dy*dy;
  shape(Math.min(x1,x2)-stroke,Math.min(y1,y2)-stroke,Math.max(x1,x2)+stroke,Math.max(y1,y2)+stroke,(x,y)=>{
   const t=squared?Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/squared)):0;return Math.min(1,Math.max(0,stroke/2+.5-Math.hypot(x-x1-t*dx,y-y1-t*dy)));
  },color,opacity);
 };
 return {width,height,pixels,paint,roundRect,line,png:()=>encodePng(width,height,pixels)};
}
function symbol(image,x,y,size,first,second,seed){
 const gap=size*.09,cell=(size-gap)/2;
 for(let row=0;row<2;row++)for(let column=0;column<2;column++){
  const inset=((seed>>(row*2+column))&1)*cell*.15;
  image.roundRect(x+column*(cell+gap)+inset,y+row*(cell+gap)+inset,cell-inset*2,cell-inset*2,cell*.18,(row+column)%2?second:first);
 }
}
export function galleryArtwork(name,index,{dark=false}={}){
 const seed=createHash('sha256').update(name).digest()[0],palette=palettes[index%palettes.length].map(rgb),white=rgb('#FFFFFF');
 const result={};
 for(const [kind,width,height]of [['brand-logo',320,96],['brand-logo-light',320,96],['brand-icon',128,128],['cover-bg',640,360],['watermark',256,256]]){
  const image=canvas(width,height);
  if(kind==='cover-bg'){
   for(let y=0;y<height;y++)for(let x=0;x<width;x++)image.paint(x,y,mix(mix(palette[0],palette[1],(x+y)/(width+height)),white,.88));
   for(let band=0;band<3;band++)image.line(-50,70+band*125,690,-80+band*125,32,palette[band%2],.1);
   image.roundRect(360,46,225,260,24,white,.6);symbol(image,414,110,120,palette[0],palette[1],seed);
   image.roundRect(66,112,210,12,6,palette[0],.2);image.roundRect(66,144,154,12,6,palette[0],.12);
  }else if(kind==='watermark'){
   const ink=dark?white:rgb('#334155');symbol(image,26,26,204,ink,ink,seed);
  }else if(kind==='brand-icon'){
   image.roundRect(4,4,120,120,28,palette[0]);symbol(image,29,29,70,white,mix(palette[1],white,.68),seed);
  }else{
   const light=kind==='brand-logo-light',ink=light?white:rgb('#0F172A');
   symbol(image,8,10,76,light?white:palette[0],light?white:palette[1],seed);
   // Abstract wordmark bars, not a fabricated company name or logotype.
   image.roundRect(110,23,188,13,6,ink);image.roundRect(110,49,132,11,5,ink,light?.75:.62);
  }
  result[kind]=image.png();
 }
 return result;
}
