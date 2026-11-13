// Current authored sources only. Historical sources/archives remain immutable.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {digest} from './identity.mjs';

export const B07_HISTORY = '07406627197535f77fb98fed27e601fb1a71832a';
const pins = [
  ['05','mixed-explicit-arabic',289,'7346e9ed1f79c4cbf125b52138a80382bfa744c33554bfa9cffc0a9eebbf0dcc',1,'196fb0e0d2e64cafa63612b09805d5b738ecaa1cce8b32fb947f0f59cd9c8653',100906,'36eed20266a3bd72cb540dae927e90f4a633bd2725eafd568c6e7e34cc881197'],
  ['06','whole-explicit-arabic',269,'c91b4632baf1f35fbe3e5e9c28ecb4e22588ed6d52c3d35b92d0b6abe5ff6923',0,'1077885b435004706270c8251a8b2d37c6b3d3e3350003625e8cffd0f991f03f',100900,'f9e5031acd60439a34a08744b853a822c098493d071c7a2c2f8f4b0882c0e331'],
  ['09','long-explicit-arabic',371,'16064a74fd25c95544df46dc4f340829280caef7ef7324d117f492bb4284f15c',0,'06be411c44847acac56f90b67baa318469b2206661de5a76ed315555513bc8c6',101027,'4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2'],
  ['10','non-ascii-digits',519,'69ad66eae58f2d7d7a075a78d8cc64d70b8900032f31e97d9e87748ecf85ecbb',null,'69ad66eae58f2d7d7a075a78d8cc64d70b8900032f31e97d9e87748ecf85ecbb',102481,'cafc2b51654e5e64d2a4ce5d173a23dad5efa16d34edcb2cd38331128bc442a2'],
];
export const B07_CASES = Object.freeze(pins.map(([number,name,bytes,sha256,run,currentSha256,archiveBytes,archiveSha256]) => Object.freeze({
  id:`rtl-contrast-${number}-${name}`, file:`original-${number}.opf.json`, bytes, sha256, run,
  currentSha256, currentBytes:bytes+(run===null?0:4), archiveBytes, archiveSha256,
  historicalPath:`docs/handoff/2026-11-10/b07-native-segment-feasibility/files/rtl-contrast-${number}-${name}`,
  projection:run===null?null:`/slides/0/items/0/${run}/lang`,
})));
export const B07_NATIVE_BODY_ID = 'b07-current-native-body-two-paragraphs';
const json = value => Buffer.from(JSON.stringify(value,null,2)+'\n');
const body = () => ({slides:[{title:'Title',text:[
  {text:'Bonjour 1\nWelcome 2 ',language:'ar-SA',fontFamily:'Georgia'},
  {text:'Hello 2',language:'ar-SA',fontFamily:'Times New Roman'},
]}]});
export const B07_NATIVE_BODY_SHA256 = '8385a562944abb5578b4c0cd6bb15628dcf1dfb82e904c702b58b99e820cf078';
// The existing strict native-body reader contract: current native runs, not authored run-boundary restoration.
export const b07NativeBodyExpectedImport = () => ({slides:[{title:'Title',text:[
  {text:'Bonjour 1',bold:false,italic:false,underline:false,fontFamily:'Georgia',language:'ar-SA'},
  {text:'\n',fontFamily:'Georgia'},
  {text:'Welcome 2 ',bold:false,italic:false,underline:false,fontFamily:'Georgia',language:'ar-SA'},
  {text:'Hello 2',bold:false,italic:false,underline:false,fontFamily:'Times New Roman',language:'ar-SA'},
]}]});

/** An explicit typed path, never a recursive rewrite of strings, keys, data or extensions. */
export function projectB07Source(id, input) {
  const pin=B07_CASES.find(row=>row.id===id);assert.ok(pin,'Unknown B07 source');
  const originalBytes=Buffer.from(input);
  assert.equal(originalBytes.length,pin.bytes,'Historical source length changed');
  assert.equal(digest(originalBytes),pin.sha256,'Historical source SHA256 changed');
  const original=JSON.parse(originalBytes),document=structuredClone(original);
  if(pin.run!==null){
    const run=document.slides[0].items[0][pin.run];
    assert.deepEqual(Object.keys(run).sort(),['lang','text'],'Only this known authored TextRun is projected');
    assert.equal(run.lang,'ar-SA');assert.equal(Object.hasOwn(run,'language'),false,'No proofing override collision');
    const language=run.lang;delete run.lang;run.language=language;
    const inverse=structuredClone(document),restored=inverse.slides[0].items[0][pin.run];
    delete restored.language;restored.lang=language;
    assert.deepEqual(inverse,original,'Projection must change only the known authored key');
    // Every literal value has exactly its original UTF16 code units (no NFC/NFD or bidi insertion).
    const strings=(value,out=[])=>{if(typeof value==='string')out.push(Buffer.from(value,'utf16le'));else if(value&&typeof value==='object')for(const entry of Object.values(value))strings(entry,out);return out;};
    assert.deepEqual(strings(document),strings(original),'Literal UTF16 values changed');
  }
  const currentBytes=pin.run===null?Buffer.from(originalBytes):json(document);
  assert.equal(currentBytes.length,pin.currentBytes);assert.equal(digest(currentBytes),pin.currentSha256);
  return {id,pin,original,originalBytes,document,currentBytes,bodyText:'measured'};
}

export function readB07Sources() {
  const sources=B07_CASES.map(pin=>projectB07Source(pin.id,fs.readFileSync(new URL(`./test-fixtures/b07-current/${pin.file}`,import.meta.url))));
  const document=body(),currentBytes=json(document);assert.equal(digest(currentBytes),B07_NATIVE_BODY_SHA256);
  return [...sources,{id:B07_NATIVE_BODY_ID,document,currentBytes,bodyText:'native'}];
}

/** Read sealed Git blobs, never execute a historical producer or alter its checkout. */
export function readB07HistoricalArchive(pin, repository) {
  assert.ok(B07_CASES.includes(pin),'Use a closed historical case pin');
  const bytes=execFileSync('git',['-C',repository,'cat-file','blob',`${B07_HISTORY}:${pin.historicalPath}/original.pptx`],{maxBuffer:16*1024*1024});
  assert.equal(bytes.length,pin.archiveBytes);assert.equal(digest(bytes),pin.archiveSha256,'Historical archive changed');return bytes;
}

export function b07SourceSummary() {
  return readB07Sources().map(source=>({id:source.id,bodyText:source.bodyText,
    current:{bytes:source.currentBytes.length,sha256:digest(source.currentBytes)},
    ...(source.pin?{historical:{revision:B07_HISTORY,path:source.pin.historicalPath,bytes:source.pin.bytes,sha256:source.pin.sha256,archiveBytes:source.pin.archiveBytes,archiveSha256:source.pin.archiveSha256},typedProjection:source.pin.projection}:{}),
    nativeAcceptance:false,registryAcceptance:false}));
}

// This is an exact current-source qualification bound, never a caller cap.
export const B07_CASE10_ID='rtl-contrast-10-non-ascii-digits';
export function b07CurrentShapeBound(source){
 if(source===undefined)return 16;
 const known=readB07Sources().find(row=>row.id===source?.id);assert.ok(known,'Unknown B07 shape-admission source');assert.deepEqual(source,known,'Exact closed B07 source required; no caller cap/policy');
 if(source.id!==B07_CASE10_ID)return 16;
 assert.equal(source.currentBytes.length,519);assert.equal(digest(source.currentBytes),'69ad66eae58f2d7d7a075a78d8cc64d70b8900032f31e97d9e87748ecf85ecbb');return 22;
}
export function assertB07Case10Topology(source,shapes,groups){
 assert.equal(b07CurrentShapeBound(source),22);assert.equal(shapes.length,22);
 const title=source.document.slides[0].title,blocks=source.document.slides[0].blocks,expected=new Map([['slides.0.blocks.0.text',blocks[0].text],['slides.0.blocks.1.text',blocks[1].text],...blocks[2].items.map((text,index)=>['slides.0.blocks.2.items.'+index,text])]);
 assert.equal(title.length,19);assert.equal([...expected.values()].join('').length,98);assert.equal(shapes.map(shape=>shape.text).join('').length,117);assert.equal(shapes.filter(shape=>shape.text===':').length,4);assert.equal(shapes.filter(shape=>/^ +$/.test(shape.text)).length,2);assert(!shapes.some(shape=>/[\u0660-\u0669\u06f0-\u06f9]/u.test(shape.text)&&shape.text.includes(':')),'Combined digit/neutral ownership is not the reviewed topology');
 assert.equal(groups.length,4);assert.deepEqual(groups.map(group=>group.header.group).sort(),[...expected.keys()].sort());assert.equal(groups.flatMap(group=>group.header.lines).length,7);
 const claimed=new Set();for(const group of groups){assert.equal(group.exact,true,'Original current V2 proof must be exact');assert.equal(group.text,expected.get(group.header.group));assert.equal(group.header.kind,group.header.group.endsWith('.text')?'text':'list-item');
  for(const member of group.header.members){const key=member.id+'|'+member.name;assert(!claimed.has(key));claimed.add(key);const matches=shapes.filter(shape=>shape.id===member.id&&shape.name===member.name);assert.equal(matches.length,1);assert.equal(matches[0].text,group.text.slice(member.from,member.to),'Exact source-bound physical member required');}
 }
 assert.equal(claimed.size,21);const unowned=shapes.filter(shape=>!claimed.has(shape.id+'|'+shape.name));assert.equal(unowned.length,1);assert.equal(unowned[0].text,title);return{shapes:22,textUtf16:117,groups:4,lines:7,colonOnly:4,spaceOnly:2};
}
