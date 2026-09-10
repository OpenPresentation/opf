import assert from 'node:assert/strict';
import {unzipSync,zipSync} from 'fflate';
import {toPptx,fromPptx} from '../dist/index.js';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
const fonts=await loadOfficeFontRegistry(),enc=new TextEncoder(),dec=new TextDecoder();
const deck={design:{fontScheme:'roboto',dimensions:{widthInches:5.625,heightInches:10}},slides:[{tag:'Source',title:'A complete heading with enough words to wrap across lines',subtitle:'Supporting text',text:'Body remains present'}]};
const bytes=await toPptx(deck,{textMeasurement:fonts.textMeasurement}),initial=(await fromPptx(bytes)).slides[0];
assert.ok(initial.title.includes('\n'));
const subtitleOnly=await fromPptx(await toPptx({design:{fontScheme:'roboto'},slides:[{subtitle:'Keep the subtitle role'}]},{textMeasurement:fonts.textMeasurement}));
assert.equal(subtitleOnly.slides[0].title,undefined);assert.equal(subtitleOnly.slides[0].subtitle,'Keep the subtitle role');
const modify=mutate=>{const entries=unzipSync(bytes);mutate(entries);return zipSync(entries);};
const slide=(entries,mutate)=>entries['ppt/slides/slide1.xml']=enc.encode(mutate(dec.decode(entries['ppt/slides/slide1.xml'])));
const tags=entries=>Object.keys(entries).filter(file=>file.startsWith('ppt/tags/opfHeading'));
const data=bytes=>JSON.parse(Buffer.from(dec.decode(bytes).match(/val="([^"]+)"/)[1],'hex').toString());
const tagFile=entries=>tags(entries).find(file=>data(entries[file]).field==='title');
const editTag=(entries,mutate)=>{const file=tagFile(entries),xml=dec.decode(entries[file]),hex=xml.match(/val="([^"]+)"/)[1],value=data(entries[file]);mutate(value);entries[file]=enc.encode(xml.replace(hex,Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase()));};
const changed=await fromPptx(modify(entries=>slide(entries,xml=>xml.replace('A complete','An edited'))));
assert.equal(changed.slides[0].title,initial.title.replace('A complete','An edited'),'Current native text wins over authoring source');
const reordered=await fromPptx(modify(entries=>slide(entries,xml=>{const shapes=[...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(m=>m[0]);return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,()=>shapes.pop());})));
for(const field of ['title','subtitle','tag'])assert.equal(reordered.slides[0][field],initial[field]);
const renamed=await fromPptx(modify(entries=>slide(entries,xml=>xml.replace(/name="OPF heading [^"]+"/g,'name="Renamed heading"'))));
assert.equal(renamed.slides[0].title,initial.title);
// Clearing a complete tagged heading in Office must not become an unknown-shape
// description or promote the body into its role. Tags never restore old text.
for(const field of ['title','subtitle','tag']) {
 const cleared=await fromPptx(modify(entries=>slide(entries,xml=>xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,shape=>shape.includes(`name="OPF heading slides.0.${field} line `)?shape.replace(/<a:t>[\s\S]*?<\/a:t>/g,'<a:t></a:t>'):shape))));
 assert.equal(cleared.slides[0][field].trim(),'');
 assert.ok(!JSON.stringify(cleared).includes('PowerPoint shape:'));
 assert.ok(JSON.stringify(cleared).includes('Body remains present'));
 for(const other of ['title','subtitle','tag'].filter(value=>value!==field))assert.equal(cleared.slides[0][other],initial[other]);
}
const corruptions={
  duplicate:entries=>slide(entries,xml=>xml.replace(/(<p:sp>(?:(?!<p:sp>)[\s\S])*?name="OPF heading slides\.0\.title line 0"[\s\S]*?<\/p:sp>)/,'$1$1')),
  missingTag:entries=>{delete entries[tagFile(entries)];},
  badCount:entries=>editTag(entries,value=>value.count++),
  badIndex:entries=>editTag(entries,value=>value.line=-1),
  badGroup:entries=>editTag(entries,value=>value.group='slides.99.title'),
  badField:entries=>editTag(entries,value=>value.field='constructor'),
  badEncoding:entries=>{const file=tagFile(entries);entries[file]=enc.encode(dec.decode(entries[file]).replace(/val="[^"]+"/,'val="invalid"'));},
  mixedIdentity:entries=>{const file=tagFile(entries),xml=dec.decode(entries[file]),tag=xml.match(/<p:tag\s[^>]+\/>/)[0].replace('OPF_HEADING_V1','OPF_CODE_V1');entries[file]=enc.encode(xml.replace('</p:tagLst>',tag+'</p:tagLst>'));},
};
for(const [name,mutate] of Object.entries(corruptions)) {
  const issues=[],result=await fromPptx(modify(mutate),{onDiagnostic:item=>issues.push(item)});
  assert.ok(issues.some(item=>item.code==='invalid-heading-provenance'),name);
  const text=JSON.stringify(result);for(const word of ['complete','heading','enough','words','wrap','across','lines'])assert.ok(text.includes(word),`${name}: retain native ${word}`);
}
console.log(`Heading provenance: native edits, shape renaming/reordering and ${Object.keys(corruptions).length} damaged/ambiguous group fallbacks preserve visible words.`);
