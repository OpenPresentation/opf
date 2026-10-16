// Actual font parser/bytes with controlled browser bookkeeping, never external fetches.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {loadFonts} from '../dist/fonts-browser.js';
const require=createRequire(import.meta.url);
const data=new Uint8Array(readFileSync(require.resolve('@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf')));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function browser({faceGate,ready=Promise.resolve()}={}){
 const added=deferred(),faces=new Set();faces.ready=ready;
 const add=faces.add.bind(faces);faces.add=face=>{add(face);added.resolve();return faces;};
 class Face{async load(){await faceGate;return this;}}
 return {document:{fonts:faces,defaultView:{FontFace:Face}},faces,added};
}
for(const option of ['shapeWasm','subsetWasm']){
 for(const order of ['registry-first','wasm-first']){
  const gate=deferred(),wasm=deferred(),env=browser({faceGate:order==='wasm-first'?gate.promise:undefined});
  const error=new Error(`${option}/${order}`);
  const pending=loadFonts({faces:[{data}],document:env.document,[option]:'/controlled.wasm',fetch:()=>wasm.promise});
  const rejected=assert.rejects(pending,actual=>actual===error,'original WASM error identity is preserved');
  if(order==='registry-first'){await env.added.promise;assert.equal(env.faces.size,1);}
  wasm.reject(error);await rejected;assert.equal(env.faces.size,0,'already registered faces are removed promptly');
  gate.resolve();await tick();assert.equal(env.faces.size,0,'a late face cannot register after rejection');
 }
 // A never-settling font fetch must not delay an unrelated WASM failure.
 const env=browser(),error=new Error(`${option}/pending-font`);
 await assert.rejects(loadFonts({faces:[{url:'/pending-font'}],document:env.document,[option]:'/failed.wasm',fetch:url=>url==='/pending-font'?new Promise(()=>{}):Promise.reject(error)}),actual=>actual===error);
 assert.equal(env.faces.size,0);
 // Also remove faces while the host's fonts.ready promise remains unresolved.
 const ready=deferred(),wasm=deferred(),pendingEnv=browser({ready:ready.promise}),readyError=new Error(`${option}/pending-ready`);
 const pending=loadFonts({faces:[{data}],document:pendingEnv.document,[option]:'/controlled.wasm',fetch:()=>wasm.promise});
 const rejected=assert.rejects(pending,actual=>actual===readyError);await pendingEnv.added.promise;
 wasm.reject(readyError);await rejected;assert.equal(pendingEnv.faces.size,0);ready.resolve();await tick();assert.equal(pendingEnv.faces.size,0);
}
{
 const env=browser();
 const handle=await loadFonts({faces:[{data}],document:env.document});
 assert.equal(env.faces.size,1);assert.ok(handle.textMeasurement.measure('Actual font bytes',20,{fontFamily:'Roboto'})>0);
 handle.dispose();handle.dispose();assert.equal(env.faces.size,0);
}
console.log('Font startup cleanup passed: both WASM failures/orderings, pending font and ready promises, preserved error identity, successful measurement/disposal.');
