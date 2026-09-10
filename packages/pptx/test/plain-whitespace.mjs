import assert from 'node:assert/strict';
import {unzipSync,zipSync} from 'fflate';
import {toPptx,fromPptx} from '../dist/index.js';
import {prepareNodeFonts} from '@openpresentation/opf-render/fonts-node';
import {resolvePresentation,renderSvg} from '@openpresentation/opf-render/svg';
const {options:measured}=await prepareNodeFonts(),enc=new TextEncoder(),dec=new TextDecoder();
const sources=['  A  B\tC\u00a0D\r\n\r\ntrail  \r','\t\t  ','Line one\n\nLine three\r\n','A long string of ordinary words that must retain every separator across soft wrapping. '.repeat(3),''];
let cases=0;
for(const options of [{},measured])for(const [width,height]of [[1280,720],[720,1280]])for(const text of sources) {
 const headings={title:'  Exact  title\tend  ',subtitle:'Subtitle  with spaces\r\nNext',tag:'  Tag  '};
 const document={design:{fontScheme:'roboto',dimensions:{widthInches:width/96,heightInches:height/96}},slides:[{...headings,blocks:[{text}]}]},source=structuredClone(document);
 const bytes=await toPptx(document,options),actual=(await fromPptx(bytes)).slides[0];assert.deepEqual(document,source);
 for(const field of ['title','subtitle','tag'])assert.equal(actual[field],headings[field]);
 assert.deepEqual(actual.blocks,[{type:'text',text}]);
 const entries=unzipSync(bytes),geometry=resolvePresentation(document,options).slides[0].geometry;
 const xml=dec.decode(entries['ppt/slides/slide1.xml']);
 for(const item of geometry.items)for(const [index,line]of item.text.sourceLines.entries()) {
  const name=`OPF ${item.field==='text'?'text':'heading'} ${item.path} line ${index}`;
  const shape=[...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(m=>m[0]).find(s=>s.includes(`name="${name}"`));assert.ok(shape,name);
  const stops=[...shape.matchAll(/<a:tab\b[^>]*pos="(\d+)"/g)].map(m=>+m[1]);
  assert.deepEqual(stops,line.segments.filter(s=>s.kind==='tab').map(s=>Math.round((s.x+s.width)*9525)));
 }
 cases++;
}
const deck={design:{fontScheme:'roboto',dimensions:{widthInches:5.625,heightInches:10}},slides:[{title:'Current title',text:sources[0]+sources[3]}]};
const bytes=await toPptx(deck,measured),baseline=(await fromPptx(bytes)).slides[0];
const mutate=fn=>{const entries=unzipSync(bytes);fn(entries);return zipSync(entries);};
const slide=(entries,fn)=>entries['ppt/slides/slide1.xml']=enc.encode(fn(dec.decode(entries['ppt/slides/slide1.xml'])));
const tagFiles=entries=>Object.keys(entries).filter(p=>p.startsWith('ppt/tags/opfText'));
const changeTag=(entries,fn)=>{const file=tagFiles(entries)[0],xml=dec.decode(entries[file]),hex=xml.match(/val="([^"]+)"/)[1],data=JSON.parse(Buffer.from(hex,'hex').toString());fn(data);entries[file]=enc.encode(xml.replace(hex,Buffer.from(JSON.stringify(data)).toString('hex').toUpperCase()));};
const edited=await fromPptx(mutate(entries=>slide(entries,xml=>xml.replace('A  B','Native  edit'))));
assert.equal(edited.slides[0].blocks[0].text,baseline.blocks[0].text.replace('A  B','Native  edit'));
const reordered=await fromPptx(mutate(entries=>slide(entries,xml=>{const shapes=[...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(m=>m[0]);return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,()=>shapes.pop());})));
assert.deepEqual(reordered.slides[0],baseline);
const cleared=await fromPptx(mutate(entries=>slide(entries,xml=>xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,shape=>shape.includes('name="OPF text ')?shape.replace(/<a:t>[\s\S]*?<\/a:t>/g,'<a:t></a:t>'):shape))));
assert.equal(cleared.slides[0].blocks[0].text,'\r\n\r\n\r');
for(const [name,fn]of Object.entries({
 missing:entries=>{delete entries[tagFiles(entries)[0]];},
 badCount:entries=>changeTag(entries,d=>d.count++),
 badIndex:entries=>changeTag(entries,d=>d.line=-1),
 injectedWords:entries=>changeTag(entries,d=>d.separator='Old source must never replace an edit'),
 mixedBoundary:entries=>changeTag(entries,d=>{delete d.boundary;}),
 duplicate:entries=>slide(entries,xml=>xml.replace(/(<p:sp>(?:(?!<p:sp>)[\s\S])*?name="OPF text [^"]+"[\s\S]*?<\/p:sp>)/,'$1$1')),
 bullets:entries=>slide(entries,xml=>xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,shape=>shape.includes('name="OPF text ')?shape.replace(/<a:pPr([^>]*)>/,'<a:pPr$1><a:buChar char="•"/>'):shape)),
})) {
 const diagnostics=[];const result=await fromPptx(mutate(fn),{onDiagnostic:d=>diagnostics.push(d)});
 assert.ok(diagnostics.some(d=>d.code==='invalid-text-provenance'),name);
 const text=JSON.stringify(result);assert.ok(text.includes('ordinary words'),name);assert.ok(!text.includes('Old source must'),name);
}
const bodyOnly=(await fromPptx(await toPptx({design:{fontScheme:'roboto'},slides:[{text:'Body without a heading'}]},measured))).slides[0];
assert.equal(bodyOnly.title,undefined);assert.deepEqual(bodyOnly.blocks,[{type:'text',text:'Body without a heading'}]);
for(const character of ['\u0000','\u000b','\u000c','\ud800','\uffff']) {
 const invalid={slides:[{text:'Before'+character+'After'}]};
 await assert.rejects(()=>toPptx(invalid),e=>e.code==='invalid-text'&&e.path==='slides.0.text');
 assert.throws(()=>renderSvg(invalid),e=>e.code==='invalid-text'&&e.path==='slides.0.text');
}
console.log(`${cases} wide/portrait measured/estimated source exports preserve whitespace, tab-stop XML and exact reimport; native edits, clearing, reordering and seven damaged-group fallbacks pass.`);
