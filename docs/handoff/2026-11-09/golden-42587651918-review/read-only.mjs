import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inflateRawSync, inflateSync} from 'node:zlib';

export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const crcTable = Array.from({length:256}, (_,i) => {let x=i;for(let n=0;n<8;n++)x=x&1?0xedb88320^(x>>>1):x>>>1;return x>>>0;});
const crc = bytes => {let x=0xffffffff;for(const b of bytes)x=crcTable[(x^b)&255]^(x>>>8);return (x^0xffffffff)>>>0;};

// Read and validate original service ZIP bytes in memory; never extract or rewrite them.
export function zipEntries(bytes) {
  let eocd=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(bytes.readUInt32LE(p)===0x06054b50){eocd=p;break;}
  assert(eocd>=0,'ZIP EOCD');
  assert.equal(bytes.readUInt16LE(eocd+4),0);assert.equal(bytes.readUInt16LE(eocd+6),0);
  const count=bytes.readUInt16LE(eocd+10), entries=new Map();let p=bytes.readUInt32LE(eocd+16);
  for(let i=0;i<count;i++) {
    assert.equal(bytes.readUInt32LE(p),0x02014b50);
    const flags=bytes.readUInt16LE(p+8),method=bytes.readUInt16LE(p+10),checksum=bytes.readUInt32LE(p+16),packed=bytes.readUInt32LE(p+20),size=bytes.readUInt32LE(p+24),nameLength=bytes.readUInt16LE(p+28),extraLength=bytes.readUInt16LE(p+30),commentLength=bytes.readUInt16LE(p+32),offset=bytes.readUInt32LE(p+42);
    const name=bytes.subarray(p+46,p+46+nameLength).toString('utf8');
    assert(!name.startsWith('/')&&!name.includes('\\')&&!name.split('/').includes('..'),'safe ZIP member');assert(!entries.has(name),'unique ZIP member');assert.equal(flags&1,0,'unencrypted ZIP');
    assert.equal(bytes.readUInt32LE(offset),0x04034b50);const start=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28),data=bytes.subarray(start,start+packed);
    assert(method===0||method===8,'supported ZIP compression');const raw=method===8?inflateRawSync(data):Buffer.from(data);assert.equal(raw.length,size);assert.equal(crc(raw),checksum);
    entries.set(name,raw);p+=46+nameLength+extraLength+commentLength;
  }
  return entries;
}

// Decode the actual 8-bit RGBA PNG pixels for a narrow objective nonblank-body check.
// This does not OCR text, measure type or qualify visual design.
export function pngPixels(bytes) {
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');let p=8,w,h,packed=[];
  while(p<bytes.length){const size=bytes.readUInt32BE(p),kind=bytes.subarray(p+4,p+8).toString(),data=bytes.subarray(p+8,p+8+size);assert.equal(crc(bytes.subarray(p+4,p+8+size)),bytes.readUInt32BE(p+8+size));
    if(kind==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);assert.equal(data[8],8);assert.equal(data[9],6);assert.equal(data[12],0);}
    if(kind==='IDAT')packed.push(data);p+=size+12;if(kind==='IEND')break;
  }
  const raw=inflateSync(Buffer.concat(packed)),stride=w*4,pixels=Buffer.alloc(w*h*4);assert.equal(raw.length,(stride+1)*h);
  const paeth=(a,b,c)=>{const p=a+b-c,aa=Math.abs(p-a),bb=Math.abs(p-b),cc=Math.abs(p-c);return aa<=bb&&aa<=cc?a:bb<=cc?b:c;};
  for(let y=0;y<h;y++){const filter=raw[y*(stride+1)];assert(filter<=4);for(let x=0;x<stride;x++){const at=y*stride+x,a=x>=4?pixels[at-4]:0,b=y?pixels[at-stride]:0,c=y&&x>=4?pixels[at-stride-4]:0,v=raw[y*(stride+1)+1+x];pixels[at]=(v+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}}
  return {w,h,pixels};
}
export function bodyObservation(bytes) {
  const {w,h,pixels}=pngPixels(bytes);assert.equal(w,320);assert.equal(h,180);const rgb=Buffer.alloc(w*(h-48)*3);let n=0,bright=0;
  for(let y=48;y<h;y++)for(let x=0;x<w;x++){const at=(y*w+x)*4;for(let c=0;c<3;c++)rgb[n++]=pixels[at+c];if(pixels[at]>100&&pixels[at+1]>100&&pixels[at+2]>100)bright++;}
  return {width:w,height:h,roi:{x:0,y:48,width:w,height:h-48},rgbSha256:sha(rgb),brightPixels:bright};
}