import assert from 'node:assert/strict';
import {unzipSync,zipSync} from 'fflate';
import {toPptx,fromPptx} from './helpers/default-catalog.mjs';
const decoder=new TextDecoder(),encoder=new TextEncoder();
const source={slides:[{title:'Title',text:[{text:'Body',footnote:'Note'}]}]};
const original=await toPptx(source,{seed:1});
const inspect=async bytes=>{
 const diagnostics=[];
 const doc=await fromPptx(bytes,{onDiagnostic:value=>diagnostics.push(value)});
 return {doc,diagnostics};
};
const baseline=await inspect(original);
assert.equal(baseline.doc.slides[0].text[0].footnote,'Note');
assert.ok(!baseline.diagnostics.some(d=>d.code==='invalid-footnote-provenance'));
const edit=mutate=>{
 const entries=unzipSync(original);let count=0;
 entries['ppt/slides/slide1.xml']=encoder.encode(decoder.decode(entries['ppt/slides/slide1.xml']).replace(/<p:sp>[\s\S]*?<\/p:sp>/g,shape=>{
  if(!shape.includes('name="OPF footnotes 0 rule"'))return shape;
  count++;return mutate(shape);
 }));
 assert.equal(count,1);
 return zipSync(entries);
};
const withText=await inspect(edit(shape=>shape.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/,'').replace('</p:sp>','<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Current native separator text</a:t></a:r></a:p></p:txBody></p:sp>')));
assert.ok(JSON.stringify(withText.doc).includes('Current native separator text'));
assert.ok(withText.diagnostics.some(d=>d.code==='invalid-footnote-provenance'));
for(const change of [shape=>shape.replace('prst="line"','prst="rect"'),shape=>shape.replace('name="OPF footnotes 0 rule"','name="Unrelated native shape"')]) {
 const actual=await inspect(edit(change));
 assert.ok(actual.diagnostics.some(d=>d.code==='invalid-footnote-provenance'));
 assert.ok(JSON.stringify(actual.doc).includes('PowerPoint shape:'), 'incompatible tagged shape reaches ordinary importer');
}
// A valid tag moved from another slide cannot consume this slide's separator.
for(const mode of ['slide','malformed']) {
 const entries=unzipSync(original);
 for(const path of Object.keys(entries).filter(path=>path.startsWith('ppt/tags/opfFootnotes'))) {
  const xml=decoder.decode(entries[path]);
  entries[path]=encoder.encode(xml.replace(/val="([A-F0-9]+)"/, (match,hex)=>{
   const value=JSON.parse(decoder.decode(Uint8Array.from(hex.match(/../g),v=>parseInt(v,16))));
   if(value.role!=='rule')return match;
   if(mode==='malformed')return 'val="NOT-HEX"';
   value.slide=1;
   return `val="${Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase()}"`;
  }));
 }
 const actual=await inspect(zipSync(entries));
 assert.ok(actual.diagnostics.some(d=>d.code==='invalid-footnote-provenance'));
}
console.log('Unchanged separator roundtrip and current text/shape/name/slide/malformed provenance controls passed.');
