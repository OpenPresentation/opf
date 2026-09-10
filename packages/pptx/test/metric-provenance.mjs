import assert from 'node:assert/strict';
import {unzipSync,zipSync} from 'fflate';
import {toPptx,fromPptx} from '../dist/index.js';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
const enc=new TextEncoder(),dec=new TextDecoder(),fonts=await loadOfficeFontRegistry();
const original={value:42,unit:'ms',label:'Left\tRight  ',description:'Unchanged\r\n\r\ncontext',delta:0,trend:'flat'};
const deck={design:{fontScheme:'roboto'},slides:[{metric:original}]},bytes=await toPptx(deck,{textMeasurement:fonts.textMeasurement});
const slide=(entries,mutate)=>entries['ppt/slides/slide1.xml']=enc.encode(mutate(dec.decode(entries['ppt/slides/slide1.xml'])));
const modify=mutate=>{const entries=unzipSync(bytes);mutate(entries);return zipSync(entries);};
const metric=async bytes=>(await fromPptx(bytes)).slides[0].blocks[0].metric;
assert.deepEqual(await metric(bytes),original);
const changed=modify(entries=>slide(entries,xml=>xml.replace('>42</a:t>','>43</a:t>').replace('>flat</a:t>','>down</a:t>').replace('>Unchanged</a:t>','>Changed</a:t>')));
assert.deepEqual(await metric(changed),{...original,value:43,trend:'down',description:original.description.replace('Unchanged','Changed')});
for(const literal of ['0.00',' 1 ','9007199254740993','']){
  const diagnostics=[],result=await fromPptx(modify(entries=>slide(entries,xml=>xml.replace('>0</a:t>',`>${literal}</a:t>`))),{onDiagnostic:d=>diagnostics.push(d)});
  assert.equal(result.slides[0].blocks[0].metric.delta,literal);assert.ok(diagnostics.some(d=>d.code==='metric-value-type-changed'));
}
assert.deepEqual(await metric(modify(entries=>slide(entries,xml=>xml.replace(/name="OPF metric [^"]+"/g,'name="Renamed native shape"')))),original);
assert.deepEqual(await metric(modify(entries=>slide(entries,xml=>{
  const shapes=[...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(m=>m[0]);let i=shapes.length;
  return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,()=>shapes[--i]);
}))),original);
const corruptions={
  deletedAnchor:entries=>slide(entries,xml=>xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/,'')),
  deletedLine:entries=>slide(entries,xml=>xml.replace(/<p:sp>(?:(?!<p:sp>)[\s\S])*?name="OPF metric 1 unit line 1"[\s\S]*?<\/p:sp>/,'')),
  duplicate:entries=>slide(entries,xml=>xml.replace('</p:spTree>',xml.match(/<p:sp>[\s\S]*?<\/p:sp>/)[0]+'</p:spTree>')),
  missingTag:entries=>{delete entries['ppt/tags/opfMetric2.xml'];},
  badEncoding:entries=>{entries['ppt/tags/opfMetric2.xml']=enc.encode(dec.decode(entries['ppt/tags/opfMetric2.xml']).replace(/val="[^"]+"/,'val="invalid"'));},
  staleRange:entries=>{
    const file='ppt/tags/opfMetric1.xml',xml=dec.decode(entries[file]),hex=xml.match(/val="([^"]+)"/)[1],manifest=JSON.parse(Buffer.from(hex,'hex').toString());
    manifest.parts[0].lines[0].nextStart++;entries[file]=enc.encode(xml.replace(hex,Buffer.from(JSON.stringify(manifest)).toString('hex').toUpperCase()));
  },
  invalidTrend:entries=>slide(entries,xml=>xml.replace('>flat</a:t>','>sideways</a:t>')),
  mixedIdentity:entries=>{
    const file='ppt/tags/opfMetric1.xml',xml=dec.decode(entries[file]),tag=xml.match(/<p:tag\s[^>]+\/>/)[0].replace('OPF_METRIC_V1','OPF_CODE_V1');
    entries[file]=enc.encode(xml.replace('</p:tagLst>',tag+'</p:tagLst>'));
  },
};
for(const [name,mutate] of Object.entries(corruptions)){
  const diagnostics=[],result=await fromPptx(modify(mutate),{onDiagnostic:d=>diagnostics.push(d)});
  assert.ok(!result.slides[0].blocks?.some(b=>b.type==='metric'),name+' must not restore stale metric source');
  assert.ok(diagnostics.some(d=>d.code==='invalid-metric-provenance'),name+' explains fallback');
  if(name==='invalidTrend')assert.ok(JSON.stringify(result).includes('sideways'));
}
// Source tags of either payload cannot simultaneously claim the same native shape.
const code=unzipSync(await toPptx({slides:[{code:'Current visible code'}]}));
const codeTag='ppt/tags/opfCode1.xml',xml=dec.decode(code[codeTag]),extra=xml.match(/<p:tag\s[^>]+\/>/)[0].replace('OPF_CODE_V1','OPF_METRIC_V1');
code[codeTag]=enc.encode(xml.replace('</p:tagLst>',extra+'</p:tagLst>'));
const diagnostics=[],fallback=await fromPptx(zipSync(code),{onDiagnostic:d=>diagnostics.push(d)});
assert.ok(!fallback.slides[0].blocks?.some(b=>b.type==='code'));assert.ok(diagnostics.some(d=>d.code==='invalid-code-provenance'));assert.ok(JSON.stringify(fallback).includes('Current visible code'));
console.log('Metric provenance: numeric/literal edits, CRLF, role edits, renamed/reordered shapes, eight damaged or ambiguous groups and cross-code identity guards pass.');
