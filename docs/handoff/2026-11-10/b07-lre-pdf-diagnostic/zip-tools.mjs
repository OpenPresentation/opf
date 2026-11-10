import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inflateRawSync,deflateRawSync} from 'node:zlib';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const table = Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=bytes=>{let c=0xffffffff;for(const n of bytes)c=table[(c^n)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
export function readZip(bytes){
 assert.ok(bytes.length<=16*1024*1024);let end=bytes.length-22;while(end>=Math.max(0,bytes.length-65557)&&bytes.readUInt32LE(end)!==0x06054b50)end--;assert.ok(end>=0);
 assert.equal(end+22+bytes.readUInt16LE(end+20),bytes.length);assert.equal(bytes.readUInt32LE(end+4),0);const count=bytes.readUInt16LE(end+10);assert.equal(bytes.readUInt16LE(end+8),count);assert.ok(count>0&&count<=4096);
 const centralOffset=bytes.readUInt32LE(end+16);assert.equal(centralOffset+bytes.readUInt32LE(end+12),end);let at=centralOffset,total=0;const entries=[],names=new Set();
 for(let i=0;i<count;i++){
  assert.equal(bytes.readUInt32LE(at),0x02014b50);const flags=bytes.readUInt16LE(at+8),method=bytes.readUInt16LE(at+10),crc=bytes.readUInt32LE(at+16),size=bytes.readUInt32LE(at+20),length=bytes.readUInt32LE(at+24),nl=bytes.readUInt16LE(at+28),xl=bytes.readUInt16LE(at+30),cl=bytes.readUInt16LE(at+32),offset=bytes.readUInt32LE(at+42);
  assert.equal(flags&9,0,'No encryption or data descriptor');assert.ok(method===0||method===8);assert.equal(bytes.readUInt16LE(at+34),0);assert.notEqual((bytes.readUInt32LE(at+38)>>>16)&0xf000,0xa000);assert.ok(size!==0xffffffff&&length!==0xffffffff&&offset!==0xffffffff);
  const name=bytes.subarray(at+46,at+46+nl).toString('utf8');assert.ok(name&&!name.startsWith('/')&&!name.includes('\\')&&!name.split('/').some(p=>p==='..'||p==='.')&&!names.has(name));names.add(name);
  assert.equal(bytes.readUInt32LE(offset),0x04034b50);assert.equal(bytes.readUInt16LE(offset+6),flags);assert.equal(bytes.readUInt16LE(offset+8),method);assert.equal(bytes.readUInt32LE(offset+14),crc);assert.equal(bytes.readUInt32LE(offset+18),size);assert.equal(bytes.readUInt32LE(offset+22),length);const localHeaderLength=30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28);assert.equal(bytes.subarray(offset+30,offset+30+bytes.readUInt16LE(offset+26)).toString('utf8'),name);
  const start=offset+localHeaderLength;assert.ok(start+size<=centralOffset);const compressed=bytes.subarray(start,start+size);const data=method===0?Buffer.from(compressed):inflateRawSync(compressed,{maxOutputLength:16*1024*1024});assert.equal(data.length,length);assert.equal(crc32(data),crc);total+=length;assert.ok(total<=64*1024*1024);
  entries.push({name,flags,method,crc,size,length,offset,data,compressed:Buffer.from(compressed),localHeader:Buffer.from(bytes.subarray(offset,start)),localRecord:Buffer.from(bytes.subarray(offset,start+size)),central:Buffer.from(bytes.subarray(at,at+46+nl+xl+cl))});at+=46+nl+xl+cl;
 }
 assert.equal(at,end);let cursor=0;for(const e of [...entries].sort((a,b)=>a.offset-b.offset)){assert.equal(e.offset,cursor,'No unaccounted local bytes');cursor+=e.localRecord.length;}assert.equal(cursor,centralOffset);
 return {entries,endRecord:Buffer.from(bytes.subarray(end)),centralOffset,total};
}
export function replaceMember(bytes,name,data){
 const zip=readZip(bytes),target=zip.entries.filter(e=>e.name===name);assert.equal(target.length,1);const locals=[],offsets=new Map();let offset=0;const changed=new Map();
 for(const e of [...zip.entries].sort((a,b)=>a.offset-b.offset)){
  let record=e.localRecord;if(e.name===name){const compressed=e.method===0?Buffer.from(data):deflateRawSync(data,{level:6});const header=Buffer.from(e.localHeader),crc=crc32(data);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(data.length,22);record=Buffer.concat([header,compressed]);changed.set(name,{crc,size:compressed.length,length:data.length});}offsets.set(e.name,offset);locals.push(record);offset+=record.length;
 }
 const centralOffset=offset,centrals=[];for(const e of zip.entries){const c=Buffer.from(e.central);c.writeUInt32LE(offsets.get(e.name),42);if(changed.has(e.name)){const v=changed.get(e.name);c.writeUInt32LE(v.crc,16);c.writeUInt32LE(v.size,20);c.writeUInt32LE(v.length,24);}centrals.push(c);offset+=c.length;}
 const end=Buffer.from(zip.endRecord);end.writeUInt32LE(offset-centralOffset,12);end.writeUInt32LE(centralOffset,16);const result=Buffer.concat([...locals,...centrals,end]);readZip(result);return result;
}
export const member=(zip,name)=>{const e=zip.entries.find(e=>e.name===name);assert.ok(e,name);return e.data;};
export const OLD='<a:cs typeface="Arabic Typesetting"/>';
export const NEW='<a:cs typeface="Aptos"/>';
export function csVariant(original){
 const zip=readZip(original),xml=member(zip,'ppt/slides/slide1.xml').toString('utf8');assert.equal(zip.entries.filter(e=>/^ppt\/slides\/slide\d+\.xml$/.test(e.name)).length,1);assert.equal([...xml.matchAll(/<p:sp>/g)].length,2);
 const runs=[...xml.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)],selected=runs.filter(m=>(/<a:t>([\s\S]*?)<\/a:t>/.exec(m[1])?.[1])==='Bonjour 1');assert.equal(selected.length,1,'Exactly one complete ASCII rich run');const run=selected[0][0];assert.match(run,/^<a:r><a:rPr\b/);assert.match(run,/ lang="ar-SA" altLang="en-US"/);assert.match(run,/ sz="2775"/);assert.match(run,/<a:latin typeface="Aptos"/);assert.equal(run.split(OLD).length,2);assert.equal([...run.matchAll(/<a:cs\b/g)].length,1);
 const nextRun=run.replace(OLD,NEW),next=xml.slice(0,selected[0].index)+nextRun+xml.slice(selected[0].index+run.length);assert.equal(next.replace(nextRun,run),xml);assert.equal(next.length,xml.length-(OLD.length-NEW.length));return replaceMember(original,'ppt/slides/slide1.xml',Buffer.from(next));
}
export function assertOnlyCsChange(original,variant){
 const a=readZip(original),b=readZip(variant);assert.deepEqual(a.entries.map(e=>e.name),b.entries.map(e=>e.name));const changes=[];for(let i=0;i<a.entries.length;i++){const x=a.entries[i],y=b.entries[i];if(!x.data.equals(y.data))changes.push(x.name);if(x.name!=='ppt/slides/slide1.xml')assert.ok(x.localRecord.equals(y.localRecord),x.name+' untouched local ZIP bytes');}
 assert.deepEqual(changes,['ppt/slides/slide1.xml']);const x=member(a,changes[0]).toString('utf8'),y=member(b,changes[0]).toString('utf8');const r=[...y.matchAll(/<a:r>[\s\S]*?<\/a:r>/g)].find(m=>m[0].includes('<a:t>Bonjour 1</a:t>'))?.[0];assert.ok(r&&r.includes(NEW));assert.equal(y.replace(r,r.replace(NEW,OLD)),x,'Whole XML differs ONLY target CS typeface');assert.equal([...y.matchAll(/<p:sp>/g)].length,2);return {parts:a.entries.length,changedParts:changes,untouchedLocalRecords:a.entries.length-1,sourceSlideSha256:sha(Buffer.from(x)),variantSlideSha256:sha(Buffer.from(y)),onlyChange:{part:changes[0],targetText:'Bonjour 1',element:'a:rPr/a:cs',attribute:'typeface',before:'Arabic Typesetting',after:'Aptos'}};
}
