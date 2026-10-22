import assert from 'node:assert/strict';
import {zipSync,unzipSync,Zip,ZipDeflate} from 'fflate';
import {fromPptx,toPptx,OPFPptxError,inventoryTypefaces} from '../dist/index.js';
import {INPUT_LIMITS,readInputZip,readNestedInputZip} from '../dist/input-safety.js';
import {readChartCategoryHeading} from '../dist/chart-workbook.js';
const enc=new TextEncoder(),text=s=>enc.encode(s),zip=entries=>zipSync(entries,{level:9});
const rejects=(f,code,limit)=>assert.throws(f,e=>e instanceof OPFPptxError&&e.code===code&&(!limit||e.details.limit===limit));
function changeSizes(bytes,size,which='both'){
 const copy=bytes.slice(),v=new DataView(copy.buffer);
 for(let i=0;i<copy.length-30;i++){
  const sig=v.getUint32(i,true);
  if(sig===0x04034b50&&which!=='central')v.setUint32(i+22,size,true);
  if(sig===0x02014b50&&which!=='local')v.setUint32(i+24,size,true);
 }
 return copy;
}
rejects(()=>readInputZip(new Uint8Array(INPUT_LIMITS.compressedBytes+1)),'pptx-limit-exceeded','compressedBytes');
const small=zip({'a.bin':text('Payload')});
rejects(()=>readInputZip(changeSizes(small,INPUT_LIMITS.memberBytes+1)),'pptx-limit-exceeded','memberBytes');
rejects(()=>readInputZip(changeSizes(zip({'a.xml':text('<a/>')}),INPUT_LIMITS.xmlBytes+1)),'pptx-limit-exceeded','xmlBytes');
rejects(()=>readInputZip(changeSizes(zip(Object.fromEntries(Array.from({length:5},(_,i)=>[`${i}.bin`,text('x')]))),INPUT_LIMITS.memberBytes)),'pptx-limit-exceeded','expandedBytes');
const tooMany=zip(Object.fromEntries(Array.from({length:INPUT_LIMITS.members+1},(_,i)=>[`${i}`,new Uint8Array()])));
rejects(()=>readInputZip(tooMany),'pptx-limit-exceeded','members');
for(const method of [0,9]){
 const bytes=zipSync({'a.bin':new Uint8Array(4096)},{level:method});
 rejects(()=>readInputZip(changeSizes(bytes,1)),'invalid-pptx');
 rejects(()=>readInputZip(changeSizes(bytes,1,'central')),'invalid-pptx');
}
const duplicate=zip({'a':text('x'),'b':text('y')});
for(let i=0;i<duplicate.length-1;i++)if(duplicate[i]===0x61&&((duplicate[i-30]===0x50&&duplicate[i-29]===0x4b)||(duplicate[i-46]===0x50&&duplicate[i-45]===0x4b)))duplicate[i]=0x62;
rejects(()=>readInputZip(duplicate),'invalid-pptx');
for(const path of ['../a.xml','/a.xml','a/../b.xml','a\\b.xml','a//b.xml'])rejects(()=>readInputZip(zip({[path]:text('<a/>')})),'invalid-pptx');
for(const name of ['a','é','名','n:é']){
 rejects(()=>readInputZip(zip({'a.xml':text(`<${name}>`.repeat(257)+`</${name}>`.repeat(257))})),'pptx-limit-exceeded','xmlDepth');
}
for(const leaf of ['<é/>','<n:名 xmlns:n="urn:test"/>']){
 assert.ok(readInputZip(zip({'a.xml':text('<a>'.repeat(255)+leaf+'</a>'.repeat(255))}))['a.xml']);
 rejects(()=>readInputZip(zip({'a.xml':text('<a>'.repeat(256)+leaf+'</a>'.repeat(256))})),'pptx-limit-exceeded','xmlDepth');
}
rejects(()=>readInputZip(zip({'a.xml':text('<!DOCTYPE a [<!ENTITY x "value">]><a>&x;</a>')})),'invalid-pptx');
rejects(()=>readInputZip(zip({'a.xml':text('<a><b></a></b>')})),'invalid-pptx');
const literal=zip({'a.xml':text('<a><![CDATA[<!DOCTYPE harmless>]]><!-- <!ENTITY harmless> --></a>')});
assert.ok(readInputZip(literal)['a.xml']);
let nested=zip({'x.xml':text('<a/>')});
for(let i=0;i<17;i++)nested=zip({'child.xlsx':nested});
rejects(()=>inventoryTypefaces(nested),'pptx-limit-exceeded','nestedDepth');
const inner=zip({'x.bin':text('abc')});
const shared={members:0,expanded:INPUT_LIMITS.expandedBytes-inner.length-2};
const outer=readInputZip(zip({'child.xlsx':inner}),{budget:shared});
rejects(()=>readNestedInputZip(outer,'child.xlsx'),'pptx-limit-exceeded','expandedBytes');
const withWorkbook=readInputZip(zip({'child.xlsx':inner}));const first=readNestedInputZip(withWorkbook,'child.xlsx');
assert.strictEqual(readNestedInputZip(withWorkbook,'child.xlsx'),first,'a reused workbook consumes the shared budget once');
withWorkbook['child.xlsx']=zip({'x.bin':text('replacement')});
assert.equal(new TextDecoder().decode(readNestedInputZip(withWorkbook,'child.xlsx')['x.bin']),'replacement','a rewritten workbook invalidates its cached bytes');
const headingEntries={
 'ppt/charts/chart1.xml':text('<c:chartSpace><c:externalData r:id="book"/></c:chartSpace>'),
 'ppt/charts/_rels/chart1.xml.rels':text('<Relationships><Relationship Id="book" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="../embeddings/data.xlsx"/></Relationships>'),
 'ppt/embeddings/data.xlsx':changeSizes(zip({'xl/sharedStrings.xml':text('<sst/>')}),INPUT_LIMITS.xmlBytes+1)
};
rejects(()=>readChartCategoryHeading(headingEntries,'ppt/charts/chart1.xml'),'pptx-limit-exceeded','xmlBytes');
// Streaming fflate ZIP writes a real flag-8 data descriptor rather than zipSync's known sizes.
const streamChunks=[];const streamingZip=new Zip((error,chunk)=>{if(error)throw error;streamChunks.push(chunk);});
const streamFile=new ZipDeflate('descriptor.xml',{level:6});streamingZip.add(streamFile);streamFile.push(text('<n:é xmlns:n="urn:test"/>'),true);streamingZip.end();
const descriptorZip=new Uint8Array(streamChunks.reduce((size,chunk)=>size+chunk.length,0));let streamAt=0;for(const chunk of streamChunks){descriptorZip.set(chunk,streamAt);streamAt+=chunk.length;}
assert.equal(new DataView(descriptorZip.buffer).getUint16(6,true)&8,8,'fixture uses a ZIP data descriptor');
assert.deepEqual(readInputZip(descriptorZip)['descriptor.xml'],text('<n:é xmlns:n="urn:test"/>'));
const doc={slides:[{title:'Ordinary package',text:'No font/network/native requirement'}]};const bytes=await toPptx(doc);
const before=unzipSync(bytes);const after=readInputZip(bytes);assert.deepEqual(Object.keys(after).sort(),Object.keys(before).sort());
for(const name of Object.keys(before))assert.deepEqual(after[name],before[name],name);
assert.equal((await fromPptx(bytes)).slides[0].title,doc.slides[0].title);
const bad=changeSizes(zip({'ppt/presentation.xml':text('<p:presentation/>')}),INPUT_LIMITS.xmlBytes+1);
await assert.rejects(()=>fromPptx(bad),e=>e instanceof OPFPptxError&&e.code==='pptx-limit-exceeded');
console.log('PPTX input safety passed: allocation policy, actual output, dishonest headers, duplicates/paths, XML bounds, shared nested budgets, unchanged ordinary bytes/import.');
