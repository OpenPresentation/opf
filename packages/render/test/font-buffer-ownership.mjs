// Public Buffer callers and direct PDF fontData share the Uint8Array API but
// Buffer.slice returns a VIEW. Face ownership must preserve actual bytes across
// validation/subsetting and outlining, with no format/permission/shaping waiver.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadFonts} from '../dist/fonts-node.js';
import {outlineLibrary} from '../dist/text-paths.js';
import {FontLibrary} from '../dist/pdf-fonts.js';
import {fsTypeOf} from '../dist/font-fstype.js';
const hash=data=>createHash('sha256').update(data).digest('hex');
const snapshot=data=>({bytes:data.length,sha256:hash(data),signature:Buffer.from(data.subarray(0,4)).toString('hex'),tableCount:new DataView(data.buffer,data.byteOffset,data.byteLength).getUint16(4),fsType:fsTypeOf(data)});
const base=await loadFonts({pack:'base'}),described=base.registry.describeFaces(),at=described.findIndex(face=>face.family==='Roboto'&&face.weight===400&&!face.italic);assert(at>=0);
const original=base.registry.exportFaces()[at].data,expected=snapshot(original),rows=[];
const fail=(code,message)=>Object.assign(new Error(message),{code});
try{
 for(const kind of ['Buffer','Uint8Array']){
  const input=kind==='Buffer'?Buffer.from(original):new Uint8Array(original),before=snapshot(input),handle=await loadFonts({pack:'base',faces:[{data:input,family:'BufferOwnership',weight:400}]});
  try{
   assert.deepEqual(snapshot(input),before,kind+' unchanged after public loadFonts');
   const exported=handle.registry.exportFaces().find(face=>face.family==='BufferOwnership');assert(exported);assert.deepEqual(snapshot(exported.data),expected);
   input[0]^=0xff;assert.deepEqual(snapshot(exported.data),expected,kind+' registry owns independent face bytes');input[0]^=0xff;
   const library=outlineLibrary(handle),face=library.faces.find(face=>face.names.has('bufferownership'));assert(face);
   assert.deepEqual(snapshot(input),before,kind+' unchanged after outlineLibrary validation');assert.deepEqual(snapshot(exported.data),expected);assert.deepEqual(snapshot(face.data),expected);
   const diagnostics=[];handle.outlines.outlineSlideText(['<text x="20" y="40" font-family="BufferOwnership" font-size="20">1.</text>'],{fail,report:issue=>diagnostics.push(issue)});
   assert.deepEqual(snapshot(input),before,kind+' unchanged after actual shared outlining');assert.deepEqual(snapshot(exported.data),expected);assert.deepEqual(snapshot(face.data),expected);
   rows.push({route:'public registry/outlines',kind,bytesUnchanged:true,diagnostics});
  }finally{handle.dispose?.();}
 }
 for(const kind of ['Buffer','Uint8Array']){
  const input=kind==='Buffer'?Buffer.from(original):new Uint8Array(original),before=snapshot(input),library=new FontLibrary(),face=library.addData(input,'fontData ownership');assert(face);
  assert.deepEqual(snapshot(input),before,kind+' unchanged by direct FontLibrary.addData');assert.deepEqual(snapshot(face.data),expected);
  input[0]^=0xff;assert.deepEqual(snapshot(face.data),expected,kind+' fontData face owns independent bytes');input[0]^=0xff;
  rows.push({route:'direct FontLibrary/fontData',kind,bytesUnchanged:true});
 }
 console.log(JSON.stringify({passed:true,rows,sourceFont:expected,noPermissionOrShapingGuardChanged:true}));
}finally{base.dispose?.();}
