// Current native body formatting, independent of cached OPF authoring text.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {unzipSync, zipSync, strFromU8, strToU8} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {validate} from '@openpresentation/opf';
import {toPptx, fromPptx} from './helpers/default-catalog.mjs';

const output = path.resolve(process.env.OPF_NATIVE_BODY_ARTIFACTS ?? 'artifacts/native-body-rich-text/source');
const baseline = process.env.OPF_NATIVE_BODY_BASELINE;
const options = {seed:932, timestamp:'2026-09-29T12:00:00Z', zipDate:'2026-09-29T12:00:00Z', strictAssets:true};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const report = {node:process.version,options,cases:[],exports:[],limits:'Current ordinary native body blocks only. No original cross-shape boundaries, master/layout inheritance, arbitrary native geometry, cached source recovery, or Office acceptance.'};
await mkdir(output,{recursive:true});
async function check(id, callback) {
  try {await callback(); report.cases.push({id,passed:true});}
  catch(error) {report.cases.push({id,passed:false,message:error.message,stack:error.stack});}
}
async function save(name, bytes) {await writeFile(path.join(output,name),bytes);return {file:name,bytes:bytes.length,sha256:sha(bytes)};}
const plain = value => Array.isArray(value) ? value.map(run => typeof run === 'string' ? run : run.text).join('') : value;
const blocks = deck => deck.slides[0].blocks?.filter(block => block.type === 'text').map(block => block.text) ?? [];
const allText = deck => blocks(deck).map(plain).join('\n');
const at = (value, text) => {assert.ok(Array.isArray(value),'Current native formatting remains rich runs'); const result=value.find(run => run.text===text); assert.ok(result,`Run ${JSON.stringify(text)} retained`); return result;};
const r = (text, props='') => `<a:r><a:rPr ${props}/><a:t>${text}</a:t></a:r>`;
const body = (content, list='') => `<p:txBody><a:bodyPr/><a:lstStyle>${list}</a:lstStyle>${content}</p:txBody>`;
const p = text => `<a:p>${r(text)}</a:p>`;
const part='ppt/slides/slide1.xml';
function changeBody(entries, replacement, remove=false) {
  let count=0;
  entries[part]=strToU8(strFromU8(entries[part]).replace(/<p:sp\b[^>]*>[\s\S]*?<\/p:sp>/g, shape => {
    if (!shape.includes('SOURCE_BODY')) return shape;
    assert.ok(!shape.includes('<p:tags '),'The tested native body is untagged'); count++;
    return remove ? '' : shape.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/,replacement);
  }));
  assert.equal(count,1,'Exactly one current native body changed');
}
async function imported(bytes,id) {
  const before=sha(bytes),diagnostics=[],deck=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});
  assert.equal(sha(bytes),before,'Import does not mutate current input bytes');
  assert.equal(validate(deck, {only: ['format']}).valid,true,'Imported public OPF validates');
  await save(id+'.imported.json',JSON.stringify({deck,diagnostics},null,2)+'\n');
  assert.equal(deck.slides[0].notes,' exact\r\n notes\t ');assert.equal(deck.description,' exact\r\n description ');
  return {deck,diagnostics,value:blocks(deck)[0]};
}
async function current(base,id,replacement,edit=()=>{}) {
  const entries=unzipSync(base); changeBody(entries,replacement);edit(entries);
  for(const [name,data] of Object.entries(entries)) if(/\.(xml|rels)$/.test(name)) assert.equal(XMLValidator.validate(strFromU8(data)),true,name);
  const bytes=zipSync(entries,{mtime:new Date('2000-01-01T00:00:00Z'),level:0});
  await save(id+'.pptx',bytes); await save(id+'.xml.txt',entries[part]);
  const result=await imported(bytes,id);
  assert.ok(!allText(result.deck).includes('SOURCE_BODY'),'Old current text is never restored');
  return {...result,bytes};
}
const modes=[['full',undefined],['references-only','references-only'],['off',false]];
try {
 for(const [mode,provenance] of modes) {
  const source={name:'Native body',description:' exact\r\n description ',design:{fontScheme:'roboto'},slides:[{title:'Anchor title',notes:' exact\r\n notes\t ',blocks:[{type:'text',text:[{text:'SOURCE_BODY',bold:true}]},{type:'text',text:[{text:'SECOND_BODY',italic:true}]}]}]};
  const original=JSON.stringify(source),base=new Uint8Array(await toPptx(source,{...options,provenance}));
  assert.equal(JSON.stringify(source),original,'Authored source remains immutable');
  report.exports.push(await save(`ordinary-${mode}.pptx`,base));
  await check(`${mode}/unchanged-export`,async()=>{
    if(baseline)assert.deepEqual(base,new Uint8Array(await readFile(path.join(baseline,`ordinary-${mode}.pptx`))));
    else assert.deepEqual(base,new Uint8Array(await toPptx(source,{...options,provenance})));
  });
  await check(`${mode}/inherited-and-explicit-normal`,async()=>{
    const {value,deck}=await current(base,`${mode}-normal`,body(`<a:p><a:pPr><a:defRPr b="1" i="1"/></a:pPr>${r(' CURRENT ','sz="2200"')}${r('normal','b="0" i="0" u="none" strike="noStrike"')}</a:p>`));
    const first=at(value,' CURRENT '),normal=at(value,'normal');
    assert.equal(first.bold,true);assert.equal(first.italic,true);assert.equal(first.fontSize,22);
    for(const key of ['bold','italic','underline','strikethrough']) assert.equal(normal[key],false,key);
    assert.equal(deck.slides[0].title,'Anchor title','Body enrichment does not change heading selection');
  });
  await check(`${mode}/ordered-field-break-empty-paragraphs`,async()=>{
    const {value}=await current(base,`${mode}-ordered`,body(`<a:p/><a:p>${r(' A ','b="1"')}<a:fld id="{00000000-0000-0000-0000-000000000001}" type="datetime"><a:rPr u="sng"/><a:t>NOW</a:t></a:fld><a:br/>${r('\t B ','i="1"')}</a:p><a:p/>`));
    assert.equal(plain(value),'\n A NOW\n\t B \n');assert.equal(at(value,'NOW').underline,true);
  });
  await check(`${mode}/native-font-alpha-baseline`,async()=>{
    const {value}=await current(base,`${mode}-font`,body('<a:p><a:r><a:rPr b="0" sz="2100" baseline="30000" strike="sngStrike"><a:latin typeface="Cousine"/><a:solidFill><a:srgbClr val="123456"><a:alpha val="50000"/></a:srgbClr></a:solidFill></a:rPr><a:t> changed style </a:t></a:r></a:p>'));
    assert.deepEqual(at(value,' changed style '),{text:' changed style ',bold:false,strikethrough:true,fontSize:21,superscript:true,subscript:false,fontFamily:'Cousine',color:'#12345680'});
  });
  await check(`${mode}/list-defaults-theme-link-and-resets`,async()=>{
    const list='<a:defPPr><a:defRPr i="1"/></a:defPPr><a:lvl2pPr><a:defRPr b="1" sz="1900"><a:latin typeface="+mn-lt"/><a:solidFill><a:schemeClr val="accent1"><a:alpha val="50000"/></a:schemeClr></a:solidFill></a:defRPr></a:lvl2pPr>';
    const text=body('<a:p><a:pPr lvl="1"><a:defRPr i="0"/></a:pPr><a:r><a:t>THEMED</a:t></a:r><a:r><a:rPr baseline="-30000"><a:noFill/><a:hlinkClick r:id="currentLink"/></a:rPr><a:t>LINK</a:t></a:r><a:r><a:rPr baseline="0" b="false"/><a:t>RESET</a:t></a:r></a:p>',list);
    const {value,diagnostics}=await current(base,`${mode}-theme`,text,entries=>{
      const theme=Object.keys(entries).find(name=>/^ppt\/theme\/theme\d+\.xml$/.test(name));
      entries[theme]=strToU8(strFromU8(entries[theme]).replace(/(<a:minorFont>[\s\S]*?<a:latin typeface=")[^"]*/,'$1Current Minor').replace(/<a:accent1>[\s\S]*?<\/a:accent1>/,'<a:accent1><a:srgbClr val="2468AC"/></a:accent1>'));
      const rel='ppt/slides/_rels/slide1.xml.rels';entries[rel]=strToU8(strFromU8(entries[rel]).replace('</Relationships>','<Relationship Id="currentLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="mailto:current@example.com" TargetMode="External"/></Relationships>'));
    });
    assert.deepEqual(at(value,'THEMED'),{text:'THEMED',bold:true,italic:false,fontSize:19,fontFamily:'Current Minor',color:'#2468AC80'});
    const link=at(value,'LINK');assert.equal(link.link,'mailto:current@example.com');assert.equal(link.color,'#00000000');assert.equal(link.subscript,true);
    const reset=at(value,'RESET');assert.equal(reset.bold,false);assert.equal(reset.superscript,false);assert.equal(reset.subscript,false);
    assert.ok(!diagnostics.some(d=>d.code.startsWith('unsupported-body')));
  });
  await check(`${mode}/plain-numeric-entities-and-whitespace`,async()=>{
    const {value}=await current(base,`${mode}-plain`,body(p(' plain&#13;\n&#9; &amp;#13; &lt;&amp;&gt;  ')+'<a:p/>'));
    assert.equal(value,' plain\r\n\t &#13; <&>  \n','Unformatted body remains a string with exact current characters');
  });
  await check(`${mode}/current-cleared-body`,async()=>{
    const {deck,value}=await current(base,`${mode}-cleared`,body('<a:p/>'));
    assert.equal(value,'');assert.ok(!allText(deck).includes('PowerPoint shape:'));assert.equal(deck.slides[0].title,'Anchor title');
  });
  await check(`${mode}/current-deleted-body`,async()=>{
    const entries=unzipSync(base);changeBody(entries,'',true);const bytes=zipSync(entries,{mtime:new Date('2000-01-01T00:00:00Z')});
    const {deck}=await imported(bytes,`${mode}-deleted`);assert.equal(blocks(deck).length,1);assert.equal(plain(blocks(deck)[0]),'SECOND_BODY');
  });
  await check(`${mode}/current-position-order`,async()=>{
    const {deck}=await current(base,`${mode}-reordered`,body(p('MOVED')),entries=>{
      entries[part]=strToU8(strFromU8(entries[part]).replace(/<p:sp\b[^>]*>[\s\S]*?<\/p:sp>/g,shape=>shape.includes('MOVED')?shape.replace(/(<a:off\b[^>]*\by=")[^"]*/,(_,prefix)=>prefix+'90000000'):shape));
    });
    assert.deepEqual(blocks(deck).map(plain),['SECOND_BODY','MOVED'],'Current native positions determine ordinary body reading order');
  });
  await check(`${mode}/unsupported-properties-diagnostic`,async()=>{
    const {value,diagnostics}=await current(base,`${mode}-unsupported`,body('<a:p><a:r><a:rPr b="garbage" u="wavy" strike="dblStrike" baseline="12000" sz="bad"><a:solidFill><a:schemeClr val="missing"/></a:solidFill><a:latin typeface="+mn-cs"/><a:hlinkClick r:id="missing"/></a:rPr><a:t> CURRENT UNSUPPORTED </a:t></a:r></a:p>'));
    assert.equal(plain(value),' CURRENT UNSUPPORTED ');assert.equal(at(value,' CURRENT UNSUPPORTED ').underline,undefined);
    for(const code of ['unsupported-body-text-style','approximate-body-text-baseline','unsupported-body-font','unsupported-body-text-color','unsupported-body-link'])assert.ok(diagnostics.some(d=>d.code===code),code);
    assert.ok(diagnostics.filter(d=>d.code.includes('body')).every(d=>/^slides\.0\.shapes\.\d+\.paragraphs\.0\.runs\.0$/.test(d.path)));
  });
  await check(`${mode}/nontext-shape-fallback-unchanged`,async()=>{
    const entries=unzipSync(base);let changed=0;
    entries[part]=strToU8(strFromU8(entries[part]).replace(/<p:sp\b[^>]*>[\s\S]*?<\/p:sp>/g,shape=>{if(!shape.includes('SOURCE_BODY'))return shape;changed++;return shape.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/,'');}));
    assert.equal(changed,1);const {deck}=await imported(zipSync(entries,{mtime:new Date('2000-01-01T00:00:00Z')}),`${mode}-nontext`);
    assert.match(plain(blocks(deck)[0]),/^PowerPoint shape: /,'A non-text shape keeps the prior explicit fallback');
  });
  await check(`${mode}/explicit-title-remains-scalar`,async()=>{
    const {deck}=await current(base,`${mode}-explicit-title`,body(p('PROMOTED')),entries=>{
      // All export modes still emit structural heading tags. Remove those
      // from this deliberately native-only control before testing placeholders.
      let count=0;
      entries[part]=strToU8(strFromU8(entries[part]).replace(/<p:sp\b[^>]*>[\s\S]*?<\/p:sp>/g,shape=>{
        shape=shape.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g,'').replace(/<p:ph type="title"\/>/g, '');
        // The control promotes exactly one body shape, replacing the exported native title role.
        if(!shape.includes('PROMOTED'))return shape;count++;return shape.replace('<p:nvPr>','<p:nvPr><p:ph type="title"/>');
      }));
      assert.equal(count,1);
    });
    assert.equal(typeof deck.slides[0].title,'string');assert.equal(deck.slides[0].title,'PROMOTED');
  });
  await check(`${mode}/break-style-and-current-link-removal`,async()=>{
    const {value,diagnostics}=await current(base,`${mode}-break-style`,body('<a:p><a:pPr><a:defRPr b="1"/></a:pPr>'+r('BEFORE')+'<a:br><a:rPr b="0" i="1"/></a:br><a:r><a:rPr><a:hlinkClick r:id="missing" action="ppaction://hlinkshowjump"/></a:rPr><a:t>AFTER</a:t></a:r></a:p>'));
    assert.equal(plain(value),'BEFORE\nAFTER');assert.equal(at(value,'\n').bold,false);assert.equal(at(value,'\n').italic,true);assert.equal(at(value,'AFTER').link,undefined);
    assert.ok(diagnostics.some(d=>d.code==='unsupported-body-link'));
  });
  await check(`${mode}/current-rich-list`,async()=>{
    const {deck}=await current(base,`${mode}-bullets`,body('<a:p><a:pPr lvl="1"><a:buChar char="•"/><a:defRPr b="1"/></a:pPr>'+r(' Item ','i="1"')+'</a:p>'));
    const list=deck.slides[0].blocks.find(block=>block.type==='list');assert.equal(list.items[0].level,1);assert.equal(at(list.items[0].text,' Item ').bold,true);assert.equal(at(list.items[0].text,' Item ').italic,true);
  });
 }
} finally {
 report.passed=report.cases.filter(c=>c.passed).length;report.failed=report.cases.length-report.passed;
 await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,failed:report.failed,output}));
}
if(report.failed)process.exitCode=1;
