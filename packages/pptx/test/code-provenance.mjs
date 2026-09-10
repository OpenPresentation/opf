import assert from 'node:assert/strict';
import {unzipSync,zipSync} from 'fflate';
import {toPptx,fromPptx} from '../dist/index.js';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
import PptxGenJS from '../vendor/pptxgenjs/pptxgen.es.js';
const enc=new TextEncoder(),dec=new TextDecoder(),fonts=await loadOfficeFontRegistry();
const deck=code=>({design:{fontScheme:'roboto',dimensions:{widthInches:540/96,heightInches:960/96}},slides:[{code}]});
const source='  const word = "two  spaces";\r\n'+ 'longtoken'.repeat(25)+'\n\r\n\treturn word;  \r';
const original={source,filename:'Case.ts',language:'TypeScript'};
const bytes=await toPptx(deck(original),{textMeasurement:fonts.textMeasurement});
const modify=mutate=>{const entries=unzipSync(bytes);mutate(entries);return zipSync(entries);};
const slide=(entries,mutate)=>entries['ppt/slides/slide1.xml']=enc.encode(mutate(dec.decode(entries['ppt/slides/slide1.xml'])));
const importCode=async bytes=>(await fromPptx(bytes)).slides[0].blocks[0].code;
assert.deepEqual(await importCode(bytes),original);
for(const code of ['', '\t\t', 'é\t<&>\r\n\n', {source:'',filename:'',language:''}, {source:'x',filename:'only.ts'}, {source:'x',language:'ts'}]) {
  assert.deepEqual(await importCode(await toPptx(deck(code),{textMeasurement:fonts.textMeasurement})),code);
}
// Astral UTF-16 provenance only: the bundled monospace pack lacks this emoji.
// Do not describe this heuristic serialization check as glyph support.
assert.equal(await importCode(await toPptx(deck('😀\r\n'))),'😀\r\n');
const edited=modify(entries=>slide(entries,xml=>xml.replace('two  spaces','THREE   spaces').replace('Case.ts','Renamed.ts')));
assert.deepEqual(await importCode(edited),{...original,source:source.replace('two  spaces','THREE   spaces'),filename:'Renamed.ts'});
// Source restoration is identity-based, not shape names or native XML order.
assert.deepEqual(await importCode(modify(entries=>slide(entries,xml=>xml.replace(/name="OPF code [^"]+"/g,'name="Renamed shape"')))),original);
assert.deepEqual(await importCode(modify(entries=>slide(entries,xml=>{
  const shapes=[...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match=>match[0]);
  let index=shapes.length;return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,()=>shapes[--index]);
}))),original);
assert.deepEqual(await importCode(modify(entries=>slide(entries,xml=>{
  const shapes=[...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match=>match[0]).join('');
  return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,'').replace('</p:spTree>',`<p:grpSp><p:nvGrpSpPr><p:cNvPr id="999" name="Grouped code"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shapes}</p:grpSp></p:spTree>`);
}))),original,'Grouping does not silently discard code text');

const corruptions={
  deletedLine: entries=>slide(entries,xml=>xml.replace(/<p:sp>(?:(?!<p:sp>)[\s\S])*?name="OPF code 1 body line 1"[\s\S]*?<\/p:sp>/,'')),
  duplicate: entries=>slide(entries,xml=>{const shape=xml.match(/<p:sp>[\s\S]*?<\/p:sp>/)[0];return xml.replace('</p:spTree>',shape+'</p:spTree>');}),
  missingTag: entries=>{delete entries['ppt/tags/opfCode2.xml'];},
  badEncoding: entries=>{entries['ppt/tags/opfCode2.xml']=enc.encode(dec.decode(entries['ppt/tags/opfCode2.xml']).replace(/val="[^"]+"/,'val="invalid"'));},
  staleRange: entries=>{
    const file='ppt/tags/opfCode1.xml',xml=dec.decode(entries[file]);
    const hex=xml.match(/val="([^"]+)"/)[1],manifest=JSON.parse(Buffer.from(hex,'hex').toString());manifest.parts.at(-1).lines[0].nextStart++;
    entries[file]=enc.encode(xml.replace(hex,Buffer.from(JSON.stringify(manifest)).toString('hex').toUpperCase()));
  },
};
for(const [name,mutate] of Object.entries(corruptions)) {
  const diagnostics=[],result=await fromPptx(modify(mutate),{onDiagnostic:issue=>diagnostics.push(issue)});
  assert.ok(!result.slides[0].blocks.some(block=>block.type==='code'),name+' must not resurrect the old code');
  assert.ok(diagnostics.some(issue=>issue.code==='invalid-code-provenance'),name+' must explain fallback');
}
const shorthand=await toPptx(deck('body'),{textMeasurement:fonts.textMeasurement}),entries=unzipSync(shorthand);
slide(entries,xml=>xml.replace('>code</a:t>','>Edited label</a:t>'));
const diagnostics=[];const changed=await fromPptx(zipSync(entries),{onDiagnostic:issue=>diagnostics.push(issue)});
assert.ok(diagnostics.some(issue=>issue.code==='invalid-code-provenance'));
assert.ok(JSON.stringify(changed).includes('Edited label'));

// Native fields and Shift+Enter breaks interleaved with runs retain XML order.
const native=new PptxGenJS();native.addSlide().addText('placeholder',{x:1,y:2,w:8,h:2});
const generic=unzipSync(await native.write({outputType:'uint8array'}));
slide(generic,xml=>xml.replace(/<a:p>[\s\S]*?<\/a:p>/,'<a:p><a:r><a:t> first </a:t></a:r><a:fld id="{D139E475-7F3C-4C0B-9038-F3C6C7B57D67}"><a:t>field</a:t></a:fld><a:br/><a:r><a:t> last </a:t></a:r></a:p>'));
assert.equal((await fromPptx(zipSync(generic))).slides[0].blocks[0].text,' first field\n last ');
console.log('Code provenance: exact source/metadata, native edits, ordering, empty/Unicode values, five damaged groups and edited generated label verified.');
