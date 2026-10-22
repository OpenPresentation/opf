import assert from 'node:assert/strict';
import {createEditorSession} from '../dist/index.js';
import {applyCrop,loadImagePixels} from '../dist/image-crop.js';
const bytes=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
const src='data:image/png;base64,'+Buffer.from(bytes).toString('base64');
const loaded={image:{},width:1,height:1},rect={x:0,y:0,width:1,height:1};
const original=globalThis.document;
let finish,images=[];
class Image {
 naturalWidth=1;naturalHeight=1;
 constructor(){images.push(this);}
 set src(value){this.source=value;}
}
const doc={defaultView:{Image,DOMException},createElement:()=>({getContext:()=>({drawImage(){}}),toBlob:callback=>{finish=()=>callback(new Blob([bytes],{type:'image/png'}));}})};
globalThis.document=doc;
try {
 for(const phase of ['load','encode'])for(const mutation of ['replace','unrelated']) {
  const editor=createEditorSession({slides:[{title:'Original',image:src}]});
  images=[];
  const pending=applyCrop(editor,'slides.0.image',rect,phase==='encode'?{loaded}:{});
  const rejected=assert.rejects(pending,error=>error.code==='stale-image-crop');
  editor.set(mutation==='replace'?'slides.0.image':'slides.0.title',mutation==='replace'?'new.png':'New title');
  const expected=editor.snapshot();
  if(phase==='load')images[0].onload();else finish();
  await rejected;
  assert.equal(editor.snapshot(),expected,'stale crop adds no assets/history or changes');
  assert.equal(editor.get('assets'),undefined);
 }
 for(const phase of ['load','encode']) {
  const editor=createEditorSession({slides:[{image:src}]});
  const before=editor.snapshot(),controller=new AbortController();images=[];
  const pending=applyCrop(editor,'slides.0.image',rect,{signal:controller.signal,...(phase==='encode'?{loaded}:{})});
  const rejected=assert.rejects(pending,error=>error.name==='AbortError');
  controller.abort();if(phase==='encode')finish();await rejected;
  assert.equal(editor.snapshot(),before);
  assert.equal(editor.get('assets'),undefined);
 }
 const controller=new AbortController();images=[];
 const pending=loadImagePixels('https://example.invalid/photo.png',{document:doc,signal:controller.signal});
 const rejected=assert.rejects(pending,error=>error.name==='AbortError');controller.abort();await rejected;
 assert.equal(images.length,1,'abort never starts the anonymous fallback request');
 assert.equal(images[0].onload,null);assert.equal(images[0].onerror,null);
 const editor=createEditorSession({slides:[{image:src}]});const before=editor.presentation;
 const success=applyCrop(editor,'slides.0.image',rect,{loaded});finish();const result=await success;
 assert.equal(editor.get('slides.0.image'),result.reference);assert.equal(editor.snapshot().undoDepth,1);
 editor.undo();assert.deepEqual(editor.presentation,before);editor.redo();assert.equal(editor.get('slides.0.image'),result.reference);
} finally {globalThis.document=original;}
console.log('Actual session crop load/encode races, abort cleanup and one-undo success passed (controlled encoder; no pixel/native claim).');
