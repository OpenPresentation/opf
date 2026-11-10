import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {createRequire,syncBuiltinESMExports} from 'node:module';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {createFontRegistry,OPFFontError} from '../dist/font-registry.js';
import {loadFonts,BUNDLED_FONT_MANIFEST} from '../dist/fonts-node.js';
import {fontCoverageProbe} from '../dist/script-fonts.js';
import {gallery} from '@openpresentation/gallery';
import {convert} from '@openpresentation/opf';
const require=createRequire(import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex'),packRoot=new URL('../',import.meta.url),loaded=new Map();
function entry(family,weight=400){const key=family+'/'+weight;if(loaded.has(key))return loaded.get(key);const pkg=BUNDLED_FONT_MANIFEST.packages.find(p=>p.faces.some(f=>f.family===family&&f.weight===weight&&!f.italic));assert(pkg,key);const face=pkg.faces.find(f=>f.family===family&&f.weight===weight&&!f.italic),dir=pkg.vendored?new URL(pkg.vendored+'/',packRoot):path.dirname(require.resolve(pkg.name+'/package.json')),file=dir instanceof URL?new URL(face.file,dir):path.join(dir,face.file),data=fs.readFileSync(file);assert.equal(sha(data),face.sha256);const value={family,weight,data:new Uint8Array(data)};loaded.set(key,value);return value;}
const style={fontFamily:'Roboto',fontWeight:400,path:'slides.0.text'},snapshot=fn=>{try{fn();return{ok:true};}catch(error){return{name:error.name,code:error.code,message:error.message,details:error.details};}};
function make(options={},entries=[entry('Roboto')]){const controls={},registry=createFontRegistry(entries,options,{controls});return{registry,controls};}
const base={slides:[{title:'Initial',text:'Body'}]},edit=word=>({slides:[{title:word,text:word+' body'}]}),renderOptions={catalogs:[gallery]},request=presentation=>({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation,renderOptions});

test('private probe preserves actual input/style/cmap errors and first located glyph details',()=>{
 const {registry:r,controls:c}=make();assert.equal(c.canProbeGlyphs(),true);assert.equal(Object.hasOwn(r.textMeasurement,fontCoverageProbe),false);
 for(const [text,size,wanted]of[[123,20,style],['x',0,style],['x',-1,style],['x',Infinity,style],['x',NaN,style],['x',20,{...style,fontFamily:''}],['x',20,{...style,fontWeight:0}],['x',20,{...style,fontWeight:1001}],['x',20,{...style,fontFamily:'+unknown'}],['x',20,{...style,fontFamily:'+mn-lt'}],['x',20,{...style,italic:true}],['x',20,{...style,fontFamily:'Wingdings 2'}],['😀',20,style],['\ud800',20,style],['x\u0301',20,style],['x\u200d',20,style]])assert.deepEqual(snapshot(()=>c.probeGlyphs(text,size,wanted)),snapshot(()=>r.textMeasurement.measure(text,size,wanted)),JSON.stringify([text,size,wanted]));
 const missing=snapshot(()=>c.probeGlyphs('😀Z',20,style));assert.equal(missing.code,'missing-glyph');assert.equal(missing.details.character,'😀');assert.equal(missing.details.path,style.path);assert.equal(missing.details.loadedFaceHasGlyph,false);
 const elsewhere=make({},[entry('Roboto'),entry('Noto Color Emoji')]);const e=snapshot(()=>elsewhere.controls.probeGlyphs('😀',20,style));assert.equal(e.code,'missing-glyph');assert.equal(Object.hasOwn(e.details,'loadedFaceHasGlyph'),false);
});

test('strictGlyphs false, aliases, theme lookup, fallback and encoded weight retain the original resolver',()=>{
 const loose=make({strictGlyphs:false});assert.deepEqual(snapshot(()=>loose.controls.probeGlyphs('😀\ud800',20,style)),{ok:true});
 for(const options of[{aliases:{'Owned Alias':'Roboto'}},{fallbackFamily:'Roboto'}]){const x=make(options),s={...style,fontFamily:'Owned Alias'};assert.deepEqual(snapshot(()=>x.controls.probeGlyphs('Alias',20,s)),snapshot(()=>x.registry.textMeasurement.measure('Alias',20,s)));}
 const themed=make({themeFonts:{minorLatin:'Roboto'}});assert.deepEqual(snapshot(()=>themed.controls.probeGlyphs('Theme',20,{...style,fontFamily:'+mn-lt'})),{ok:true});
 const encoded=make({substitutionPolicy:'visual'},[entry('Montserrat',900)]),s={fontFamily:'Arial Black',fontWeight:700,path:'slides.0.text'};assert.equal(encoded.registry.resolveFont(s).resolvedWeight,900);assert.deepEqual(snapshot(()=>encoded.controls.probeGlyphs('Ärger ü',20,s)),snapshot(()=>encoded.registry.textMeasurement.measure('Ärger ü',20,s)));
});

test('owned preparation probes do not shape; actual measurement/outline retain the exact shaping error boundary',()=>{
 const {registry:r,controls:c}=make();let calls=0;const failing={shape(){calls++;throw Error('owned backend shaping fault');}};r.setShaper(failing);assert.equal(c.canProbeGlyphs(),false);c.acceptOwnedShaper();assert.equal(c.canProbeGlyphs(),true);c.probeGlyphs('Complete',20,style);assert.equal(calls,0,'Preparation checks coverage only');
 const error=snapshot(()=>r.textMeasurement.measure('Complete',20,style)),outline=snapshot(()=>r.textMeasurement.outlineBounds('Complete',20,style));assert.equal(error.code,'font-shaping-failed');assert.equal(error.details.path,style.path);assert.equal(error.details.cause,'owned backend shaping fault');assert.deepEqual(outline,error);assert.equal(calls,2);r.setShaper(failing);assert.equal(c.canProbeGlyphs(),false,'Public same-identity attachment is not trusted');r.setShaper(undefined);assert.equal(c.canProbeGlyphs(),false,'Public fontkit reset remains conservative');
});

test('custom public shaper preserves eager ensure failure and real measure/outline errors',async()=>{
 const fonts=await loadFonts(request(base));let calls=0;fonts.registry.setShaper({shape(){calls++;throw Error('public custom shape fault');}});await assert.rejects(fonts.ensure(edit('Custom shaper'),{renderOptions}),e=>e.code==='font-shaping-failed'&&e.details.cause==='public custom shape fault');assert(calls>0);const family=fonts.registry.describeFaces().find(f=>f.weight===400).family,s={fontFamily:family,fontWeight:400,path:'slides.0.text'};const a=snapshot(()=>fonts.textMeasurement.measure('Actual',20,s)),b=snapshot(()=>fonts.textMeasurement.outlineBounds('Actual',20,s));assert.equal(a.code,'font-shaping-failed');assert.equal(a.details.cause,'public custom shape fault');assert.deepEqual(b,a);
});

test('replacement, accessor and replaced measurement objects retain full callback semantics and receiver',async()=>{
 for(const mode of['replacement','accessor','parent-accessor','object-proxy']){const fonts=await loadFonts(request(base)),original=fonts.textMeasurement;let calls=0,gets=0;const failure=new OPFFontError('owned-custom-measure','Owned custom callback',{mode});let receiver=original;const custom=function(){assert.equal(this,receiver);calls++;throw failure;};
 if(mode==='replacement')original.measure=custom;
 if(mode==='accessor')Object.defineProperty(original,'measure',{configurable:true,get(){gets++;return custom;}});
 if(mode==='parent-accessor'){original.measure=custom;Object.defineProperty(fonts.registry,'textMeasurement',{configurable:true,get(){gets++;return original;}});}
 if(mode==='object-proxy'){receiver=new Proxy(original,{get(target,key,proxy){if(key==='measure'){gets++;return custom;}return Reflect.get(target,key,proxy);}});fonts.registry.textMeasurement=receiver;}
 await assert.rejects(fonts.ensure(edit(mode),{renderOptions}),e=>e===failure);assert.equal(calls,2,mode);assert.equal(gets,mode==='replacement'?0:2,mode+': no accessor invoked by trust check');}
});

test('replacement installed during an awaited face read is not bypassed, and shared font bytes stay untouched',async()=>{
 const fonts=await loadFonts(request(base)),read=fsp.readFile;let enteredResolve,releaseResolve,armed=true,protectedFile,protectedHash;const entered=new Promise(r=>enteredResolve=r),release=new Promise(r=>releaseResolve=r);fsp.readFile=async function(file,...args){const b=await read.call(this,file,...args);if(armed&&String(file).includes('open-sans')&&String(file).endsWith('.ttf')){armed=false;protectedFile=file;protectedHash=sha(b);enteredResolve();await release;}return b;};syncBuiltinESMExports();let waiting,timer;
 try{waiting=fonts.ensure({design:{fontScheme:'open-sans'},slides:[{title:'New face',text:'New body'}]},{renderOptions});waiting.catch(()=>{});await Promise.race([entered,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Owned resource gate not reached')),10000))]);clearTimeout(timer);const failure=new OPFFontError('owned-after-await','After await callback');let calls=0;Object.defineProperty(fonts.textMeasurement,'measure',{configurable:true,get(){return function(){assert.equal(this,fonts.textMeasurement);calls++;throw failure;};}});releaseResolve();await assert.rejects(waiting,e=>e===failure);assert.equal(calls,2);assert.equal(sha(await read(protectedFile)),protectedHash);}finally{clearTimeout(timer);releaseResolve?.();if(waiting)await waiting.catch(()=>{});fsp.readFile=read;syncBuiltinESMExports();}
});


test('actual safe/native preparation keeps original-family900 weight, whole-pack output and preview bytes',async()=>{
 const doc={name:'Native selected weight',design:{fontScheme:'aptos'},slides:[{title:'Native role names',text:[{text:'Ärger ü Action',fontFamily:'Arial Black',bold:true},' plain body']}]};
 const demand=await loadFonts(request(doc)),whole=await loadFonts({pack:'office',substitutionPolicy:'visual'}),options={catalogs:[gallery],date:'2026-11-08'};
 const preview=await convert(doc,{...options,format:'svg',fonts:demand,text:'paths'});
 for(const typefaces of['selected','safe']){const a=await convert(doc,{...options,format:'pptx',fonts:demand,typefaces}),b=await convert(doc,{...options,format:'pptx',fonts:whole,typefaces});assert.deepEqual(a.files.map(f=>f.bytes),b.files.map(f=>f.bytes),typefaces+': all native bytes');}
 const after=await convert(doc,{...options,format:'svg',fonts:demand,text:'paths'});assert.deepEqual(after.files.map(f=>f.bytes),preview.files.map(f=>f.bytes));assert(demand.registry.describeFaces().some(f=>f.family==='Montserrat'&&f.weight===900));assert.deepEqual(demand.pending(doc,renderOptions),[]);
});
