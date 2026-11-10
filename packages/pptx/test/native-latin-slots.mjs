import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {decodeTextTag,encodeTextTag} from '../dist/code-provenance.js';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {toPptx,fromPptx} from '../dist/index.js';
import {createNativeLatinSlots} from '../dist/native-latin-slots.js';
const decode=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const read=async(source,options={})=>{const diagnostics=[],bytes=await toPptx(source,{...options,onDiagnostic:d=>diagnostics.push(d)}),zip=unzipSync(new Uint8Array(bytes));const shapes=Object.entries(zip).filter(([p])=>/^ppt\/slides\/slide\d+\.xml$/.test(p)).flatMap(([path,b])=>[...strFromU8(b).matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(m=>({path,name:/<p:cNvPr\b[^>]*name="([^"]*)"/.exec(m[0])?.[1],xml:m[0],runs:[...m[0].matchAll(/<a:r>([\s\S]*?)<a:t>([\s\S]*?)<\/a:t><\/a:r>/g)].map(r=>({text:decode(r[2]),properties:r[1],latin:/<a:latin\b[^>]*typeface="([^"]*)"/.exec(r[1])?.[1],cs:/<a:cs\b[^>]*typeface="([^"]*)"/.exec(r[1])?.[1]}))})));return{bytes,zip,shapes,diagnostics,imported:await fromPptx(bytes)};};
const source={language:'ar-SA',slides:[{title:'لغة عربية صريحة',items:[['البند: ',{text:'Bonjour 1',lang:'ar-SA'}]],numbering:'arabic'}]};
const equalSlots=runs=>{assert(runs.length);for(const run of runs){assert.equal(run.cs,run.latin,run.text);assert.match(run.properties,/lang="ar-SA"/);assert.match(run.properties,/altLang="en-US"/);}};
test('original05 ASCII source without renderer',async()=>{
 const result=await read(source);equalSlots(result.shapes.flatMap(s=>s.runs).filter(r=>/Bonjour|^1$/.test(r.text)));assert.deepEqual(result.imported,source);assert(!result.diagnostics.some(d=>d.code==='native-latin-slot-unavailable'));});
test('wrapped explicit rich Latin family',async()=>{
 const rich={language:'ar-SA',slides:[{title:'عنوان',items:[[{text:'Bonjour 1 '.repeat(18),lang:'ar-SA',fontFamily:'Georgia',fontSize:24}]]}]};
 const result=await read(rich);const shapes=result.shapes.filter(s=>s.name?.startsWith('OPF list'));assert(shapes.length>1,'source is genuinely wrapped');equalSlots(shapes.flatMap(s=>s.runs));assert(shapes.flatMap(s=>s.runs).every(r=>r.latin==='Georgia'));assert.deepEqual(result.imported,rich);});
test('final safe Latin mapping',async()=>{
 const result=await read(source,{typefaces:'safe'});const runs=result.shapes.flatMap(s=>s.runs).filter(r=>/Bonjour/.test(r.text));equalSlots(runs);assert(runs.every(r=>r.latin==='Arial'),'copy FINAL safe Latin, not pre-safe Aptos');});
test('mixed source preserves Arabic-context digits and semantic source',async()=>{
 const mixed={language:'ar-SA',slides:[{title:'عنوان',items:[[{text:'العربية 1 Bonjour 2 العربية 3',lang:'ar-SA'}]]}]};
 const result=await read(mixed),runs=result.shapes.filter(s=>s.name?.startsWith('OPF list')).flatMap(s=>s.runs);equalSlots(runs.filter(r=>/[A-Za-z]/.test(r.text)));for(const run of runs.filter(r=>/[\u0600-\u06ff]/.test(r.text)))assert.notEqual(run.cs,run.latin,'Arabic and its contextual digits retain the script face');assert.deepEqual(result.imported,mixed);});
test('native body rich faces',async()=>{
 const rich={slides:[{title:'Title',text:[{text:'Bonjour 1 ',lang:'ar-SA',fontFamily:'Georgia'},{text:'Hello 2',lang:'ar-SA',fontFamily:'Times New Roman'}]}]};
 const result=await read(rich);const runs=result.shapes.filter(s=>s.name?.startsWith('OPF native body')||s.name?.startsWith('OPF text')).flatMap(s=>s.runs);equalSlots(runs);assert.deepEqual(new Set(runs.map(r=>r.latin)),new Set(['Georgia','Times New Roman']));assert.deepEqual(result.imported,rich);});
test('foreign language and symbol controls',async()=>{
 const foreign={language:'ar-SA',slides:[{title:'عنوان',items:[[{text:'Bonjour 1',lang:'fr-FR'}],[{text:'ABC 1',lang:'ar-SA',fontFamily:'Symbol'}],[{text:'العربية 1',lang:'ar-SA'}]]}]};
 const runs=(await read(foreign)).shapes.flatMap(s=>s.runs);assert(!runs.find(r=>r.text==='Bonjour 1')?.cs);assert.equal(runs.find(r=>r.text==='ABC 1')?.cs,'Arabic Typesetting');assert.equal(runs.find(r=>r.text==='العربية 1')?.cs,'Arabic Typesetting');});
test('exact current-text binding',async()=>{
 const diagnostics=[],profile={script:'Arab',scriptRole:'complexScript'},slots=createNativeLatinSlots({},()=>profile,d=>diagnostics.push(d));
 const shape='<p:sp><p:nvSpPr><p:cNvPr name="owned"/></p:nvSpPr><p:txBody><a:p><a:r><a:rPr lang="ar-SA"><a:latin typeface="Arial"/><a:cs typeface="Arabic Typesetting"/></a:rPr><a:t>Bonjour 1</a:t></a:r></a:p></p:txBody></p:sp>';
 slots.remember(0,'owned',[{source:'Bonjour 1',text:'Bonjour 1',style:{fontFamily:'Aptos'}}]);assert.match(slots.write(shape,0),/<a:cs typeface="Arial"/);const edited=shape.replace('Bonjour 1','Bonjour 2');assert.equal(slots.write(edited,0),edited);assert(diagnostics.some(d=>d.reason==='native-text'));assert.equal(slots.write(shape.replace('name="owned"','name="foreign"'),0),shape.replace('name="owned"','name="foreign"'));});

test('two authored identical mixed runs keep two source boundaries',async()=>{
 const run={text:'العربية 1 Bonjour 2 ',lang:'ar-SA',bold:true,color:'#123456'},source={language:'ar-SA',slides:[{title:'عنوان',items:[[run,{...run}]]}]};
 const result=await read(source);assert.deepEqual(result.imported,source);const body=result.shapes.find(shape=>shape.name?.startsWith('OPF list'));assert(body.runs.length>2);assert(Object.values(result.zip).some(bytes=>strFromU8(bytes).includes('OPF_NATIVE_LANGUAGE_V1')));
});

test('source-span ownership rejects edits, foreign, reordered and tampered groups',async()=>{
 const run={text:'العربية 1 Bonjour 2 ',lang:'ar-SA'},source={language:'ar-SA',slides:[{title:'عنوان',items:[[run,{...run}]]}]},original=await read(source);
 const slidePath='ppt/slides/slide1.xml',slide=strFromU8(original.zip[slidePath]);
 const body=original.shapes.find(shape=>shape.name?.startsWith('OPF list')),paragraph=[...body.xml.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)][0][0],native=[...paragraph.matchAll(/<a:r>[\s\S]*?<\/a:r>/g)].map(m=>m[0]);assert.equal(native.length,4);
 const tagPath=Object.keys(original.zip).find(path=>/^ppt\/tags\//.test(path)&&strFromU8(original.zip[path]).includes('OPF_NATIVE_LANGUAGE_V1'));assert(tagPath);
 const mutateTag=(entries,mutate)=>{const xml=strFromU8(entries[tagPath]);let count=0;entries[tagPath]=strToU8(xml.replace(/(<p:tag\b[^>]*name="OPF_NATIVE_LANGUAGE_V1"[^>]*val=")([^"]*)("[^>]*\/?>)/g,(whole,before,value,after)=>{count++;return before+encodeTextTag(mutate(decodeTextTag(value)))+after;}));assert.equal(count,1);};
 const variants=[
  ['current text edit',entries=>{entries[slidePath]=strToU8(slide.replace('Bonjour','Changed'));},'Changed'],
  ['current font edit',entries=>{const next=body.xml.replace('<a:latin typeface="Aptos"','<a:latin typeface="Georgia"');assert.notEqual(next,body.xml);entries[slidePath]=strToU8(slide.replace(body.xml,next));},null],
  ['foreign absent ownership',entries=>{entries[tagPath]=strToU8(strFromU8(entries[tagPath]).replace(/<p:tag\b[^>]*name="OPF_NATIVE_LANGUAGE_V1"[^>]*\/?>/g,''));},null],
  ['collapsed source boundary',entries=>mutateTag(entries,record=>{record.latinSlots[0].spans=[{start:0,count:4}];return record;}),null],
  ['invalid group index',entries=>mutateTag(entries,record=>{record.latinSlots[0].index=999;return record;}),null],
  ['reordered native members',entries=>{const reordered=[native[1],native[0],...native.slice(2)].join(''),next=paragraph.replace(native.join(''),reordered);assert.notEqual(next,paragraph);entries[slidePath]=strToU8(slide.replace(paragraph,next));},null],
  ['new native run boundary',entries=>{const split=native[1].replace(/<a:t>Bonjour 2 <\/a:t>/,'<a:t>Bon</a:t>')+native[1].replace(/<a:t>Bonjour 2 <\/a:t>/,'<a:t>jour 2 </a:t>');assert(!split.includes('<a:t>Bonjour 2 </a:t>'));entries[slidePath]=strToU8(slide.replace(native[1],split));},null],
 ];
 for(const[name,mutate,edited]of variants){const entries=Object.fromEntries(Object.entries(original.zip).map(([path,bytes])=>[path,new Uint8Array(bytes)]));mutate(entries);const diagnostics=[],doc=await fromPptx(zipSync(entries),{onDiagnostic:d=>diagnostics.push(d)}),runs=doc.slides[0].items[0];const expectedText=[...strFromU8(entries[slidePath]).matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].find(match=>match[0].includes(body.name))[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g);const currentText=[...expectedText].map(match=>decode(match[1])).join('');if(name==='foreign absent ownership'){assert.equal(runs,currentText,'Foreign native text stays observed plain text, never restored to the two authored rich runs');continue;}assert(Array.isArray(runs),name+' '+JSON.stringify({doc,diagnostics}));assert(runs.length>2,name+' must not coalesce uncertain spans');const text=runs.map(run=>typeof run==='string'?run:run.text).join('');assert.equal(text,currentText,name+' preserves every current native character');if(edited)assert(text.includes(edited),name);if(name==='current font edit')assert(runs.some(run=>run.fontFamily==='Georgia'),name);if(name!=='foreign absent ownership')assert(diagnostics.some(d=>d.code==='native-language-reference-changed'),name);}
});

test('measured real fonts keep source language, styles and boundaries',async()=>{
 const {loadFonts}=await import('@openpresentation/opf-render/fonts-node');
 const mixed={language:'ar-SA',slides:[{title:'عنوان',items:[[{text:'العربية 1 Bonjour 2 العربية 3',lang:'ar-SA',fontFamily:'Georgia'}]]}]},fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:mixed});
 try{const result=await read(mixed,{fonts});equalSlots(result.shapes.flatMap(s=>s.runs).filter(r=>/[A-Za-z]/.test(r.text)));assert.deepEqual(result.imported,mixed);}finally{fonts.dispose?.();}
});

test('unmeasured mixed public export never loads optional renderer or font packs',()=>{
 const mixed={language:'ar-SA',slides:[{title:'عنوان',items:[[{text:'العربية 1 Bonjour 2 العربية 3',lang:'ar-SA'}]]}]};
 const program=`import assert from 'node:assert/strict';import{registerHooks}from'node:module';let attempts=0;registerHooks({resolve(specifier,context,next){if(specifier.startsWith('@openpresentation/opf-render')||specifier.startsWith('@openpresentation/fonts-')){attempts++;throw Object.assign(new Error('Optional renderer/font package unavailable'),{code:'ERR_MODULE_NOT_FOUND'});}return next(specifier,context);}});const{toPptx,fromPptx}=await import(${JSON.stringify(new URL('../dist/index.js',import.meta.url).href)});const source=${JSON.stringify(mixed)};assert.deepEqual(await fromPptx(await toPptx(source)),source);assert.equal(attempts,0);console.log(JSON.stringify({rendererOrFontAttempts:attempts}));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',program],{encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout.trim()).rendererOrFontAttempts,0);
});