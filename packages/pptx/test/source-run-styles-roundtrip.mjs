import assert from 'node:assert/strict';
import {toPptx,fromPptx} from '../src/index.js';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
const source={slides:[{title:'Source styling',blocks:[{text:[{text:'A clear idea with room to breathe. This line should preserve authored styling.',fontSize:24}]}]}]};
const options={provenance:'full',seed:1,timestamp:'2026-10-13T00:00:00.000Z'};
const bytes=await toPptx(source,options);
const unchanged=await fromPptx(bytes);
assert.deepEqual(unchanged.slides[0].blocks,source.slides[0].blocks);
for(const [property,mutate,expected] of [
 ['fontSize',xml=>xml.replace(/sz="\d+"/g,'sz="3000"'),30],
 ['fontFamily',xml=>xml.replace(/typeface="[^"]+"/g,'typeface="Arial"'),'Arial'],
 ['color',xml=>xml.replace(/<a:(?:srgbClr|schemeClr) val="[^"]+"/g,'<a:srgbClr val="FF0000"'),'#FF0000']
]) {
 const entries=unzipSync(bytes);entries['ppt/slides/slide1.xml']=strToU8(mutate(strFromU8(entries['ppt/slides/slide1.xml'])));
 const imported=await fromPptx(zipSync(entries));
 const runs=imported.slides[0].blocks[0].text;
 assert.equal(runs.map(run=>typeof run==='string'?run:run.text).join(''),source.slides[0].blocks[0].text[0].text);
 assert.equal(runs[0][property],expected,property);
}
console.log('Actual unchanged rich text roundtrip + native size/font/color edits PASS');
for (const rich of [
 ['A plain string ',{text:'beside an object.',fontSize:24}],
 [{text:'This long styled sentence wraps while retaining one authored run. '.repeat(20),fontSize:24}]
]) {
 const document={slides:[{title:'Rich source spans',blocks:[{text:rich}]}]};
 const encoded=await toPptx(document,options);
 const decoded=await fromPptx(encoded);
 assert.deepEqual(decoded.slides[0].blocks,document.slides[0].blocks.map(block=>({...block,text:block.text.map(run=>typeof run==='string'?{text:run}:run)})));
}
// Actual source of the reported nominal 24 -> fitted 23.04 regression.
import {readFile} from 'node:fs/promises';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
const reported=JSON.parse(await readFile(new URL('./fixtures/source-style-timeline.opf.json',import.meta.url),'utf8'));
const fonts=await loadFonts({pack:'office'});await fonts.ensure(reported,{renderOptions:{}});
const reportedBytes=await toPptx(reported,{...options,fonts});
const restored=await fromPptx(reportedBytes);
assert.deepEqual(restored.slides[0].blocks,reported.slides[0].blocks);
console.log('Reported catalog timeline measured source blocks restore exactly, including nominal24');
const textRuns = deck => deck.slides.flatMap(slide => (slide.blocks ?? []).flatMap(block => Array.isArray(block.text) ? block.text : []));
for(const replacement of ['A fresh idea','Changed']){
 const entries=unzipSync(bytes),xml=strFromU8(entries['ppt/slides/slide1.xml']);assert.ok(xml.includes('A clear idea'));
 entries['ppt/slides/slide1.xml']=strToU8(xml.replace('A clear idea',replacement));
 const result=await fromPptx(zipSync(entries));
 assert.equal(textRuns(result).map(run=>typeof run==='string'?run:run.text).join(''),source.slides[0].blocks[0].text[0].text.replace('A clear idea',replacement));
}
for(const mode of ['missing','tampered']){
 const entries=unzipSync(reportedBytes);
 for(const path of Object.keys(entries).filter(path=>/ppt\/tags\/.*\.xml$/.test(path))){
  const xml=strFromU8(entries[path]);
  if(!/OPF_SLIDE_V1/i.test(xml))continue;
  if(mode==='missing')delete entries[path];
  else entries[path]=strToU8(xml.replace(/val="[A-F0-9]+"/, 'val="FF"'));
 }
 const result=await fromPptx(zipSync(entries));
 assert.ok(textRuns(result).some(run=>run.fontSize===23.04),`${mode} provenance keeps fitted native size23.04`);
}
for(const invalid of [{fontSize:-1},{color:42},{color:'var:brand'},{keepColor:false},{fontFamily:{}},{unexpected:true}]){
 const entries=unzipSync(reportedBytes);let changed=false;
 for(const path of Object.keys(entries).filter(path=>/ppt\/tags\/.*\.xml$/.test(path))){
  const xml=strFromU8(entries[path]);if(!/OPF_SLIDE_V1/i.test(xml))continue;
  entries[path]=strToU8(xml.replace(/val="([A-F0-9]+)"/g,(all,hex)=>{
   const record=JSON.parse(Buffer.from(hex,'hex').toString('utf8'));
   const leaf=record.content.blocks.find(block=>block.sourceStyles);
   Object.assign(leaf.sourceStyles[0],invalid);changed=true;
   return `val="${Buffer.from(JSON.stringify(record)).toString('hex').toUpperCase()}"`;
  }));
 }
 assert.ok(changed);const issues=[];
 const result=await fromPptx(zipSync(entries),{onDiagnostic:issue=>issues.push(issue)});
 assert.ok(issues.some(issue=>issue.code==='invalid-document-provenance'));
 assert.ok(textRuns(result).some(run=>run.fontSize===23.04));
}
console.log('Missing/tampered/malformed provenance retains valid native formatting PASS');
