import assert from 'node:assert/strict';
import {test} from 'node:test';
import {XMLParser} from 'fast-xml-parser';
import {gallery} from '@openpresentation/gallery';
import {partScriptFonts,planScriptFonts} from '../src/script-fonts.js';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@',parseTagValue:false,trimValues:false}),array=x=>x===undefined?[]:Array.isArray(x)?x:[x];
const properties=(lang,alternate)=>`<a:rPr lang="${lang}"${alternate?` altLang="${alternate}"`:''} sz="2775"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr>`;
const shape=(text,{lang='ar-SA',alternate='en-US',rtl='0',name='OPF list slides.0.items line 0'}={})=>`<p:sp><p:nvSpPr><p:cNvPr name="${name}"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="123" y="456"/><a:ext cx="789" cy="987"/></a:xfrm></p:spPr><p:txBody><a:p><a:pPr rtl="${rtl}"><a:buAutoNum type="arabicPeriod" startAt="1"/></a:pPr><a:r>${properties(lang,alternate)}<a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
const adapt=xml=>{const plan=planScriptFonts({language:'ar-SA',slides:[{}]},()=>{},{catalogs:[gallery]});return partScriptFonts('ppt/slides/slide1.xml',xml,plan,0);};
const runs=xml=>array(parser.parse(xml)['p:sp']['p:txBody']['a:p']['a:r']);
for(const [text,rtl,expected]of [
 ['Item 1: Customers keep the source order.','0',['Item ','1: ','Customers keep the source order.']],
 ['Bonjour 1','1',['Bonjour ','1']],
 ['البند: Bonjour 1','1',['البند: ','Bonjour ','1']],
 ['Item ١: Arabic-Indic number','0',['Item ','١: ','Arabic-Indic number']],
 ['Item ۱: Persian number','0',['Item ','۱: ','Persian number']],
 ['Cafe\u0301 ١: Exact NFD characters.','0',['Cafe\u0301 ','١: ','Exact NFD characters.']],
])test(`same-proofing boundaries preserve ${JSON.stringify(text)} in paragraph ${rtl}`,()=>{
 const input=shape(text,{rtl}),output=adapt(input),result=runs(output);
 assert.deepEqual(result.map(r=>r['a:t']),expected,'numeric and strong-script transitions are separate native runs');
 assert.equal(result.map(r=>r['a:t']).join(''),text,'logical text/codepoints stay exact');
 assert.ok(result.every(r=>r['a:rPr']['@lang']==='ar-SA'&&r['a:rPr']['@altLang']==='en-US'));
 assert.ok(result.every(r=>JSON.stringify(r['a:rPr'])===JSON.stringify(result[0]['a:rPr'])),'each piece retains identical native styling');
 assert.match(output,new RegExp(`<a:pPr rtl="${rtl}"(?:>| )`));assert.ok(output.includes('<a:buAutoNum type="arabicPeriod" startAt="1"/>'));
 assert.ok(output.includes('<a:off x="123" y="456"/><a:ext cx="789" cy="987"/>'));
 assert.doesNotMatch(output,/<a:rtl\b|[\u200e\u200f\u202a-\u202e\u2066-\u2069]/u,'no new native direction metadata or Unicode controls');
});
test('inherited non-ASCII proofing remains inherited on every new piece',()=>{
 const output=adapt(shape('Item ١: Arabic-Indic number',{alternate:null})),result=runs(output);
 assert.equal(result.length,3);assert.ok(result.every(r=>r['a:rPr']['@lang']==='ar-SA'&&r['a:rPr']['@altLang']===undefined));
});
test('D3 English, French, number-free and strong-RTL-only runs retain their existing boundaries',()=>{
 for(const [text,options]of [['Item 1: English',{lang:'en-US'}],['Bonjour 1',{lang:'fr-FR'}],['البند: نحافظ على النص',{rtl:'1'}],['Only Latin words',{}],['Item ١: Foreign',{name:'Foreign body'}]]){
  const output=adapt(shape(text,options));assert.equal(runs(output).length,1,text);assert.equal(runs(output)[0]['a:t'],text);
 }
});

test('same-proofing native export preserves exact owned scalar/rich source topology and languages',async()=>{
 const {toPptx,fromPptx}=await import('../src/index.js');
 const slides=[
  {items:[[{text:'Item 1: Customers keep the exact source order.',lang:'ar-SA'}]],numbering:'arabic'},
  {items:[['البند: ',{text:'Bonjour 1',lang:'ar-SA'}]],numbering:'arabic'},
  {items:[[{text:'البند: Bonjour 1',lang:'ar-SA'}]],numbering:'arabic'},
  {items:['Item ١: Arabic-Indic number','Item ۱: Persian number'],numbering:'arabic'},
  {text:'Item ١: Arabic-Indic number'},
 ];
 for(const slide of slides){
  const document={language:'ar-SA',slides:[slide]},bytes=await toPptx(document,{catalogs:[gallery],provenance:'full',date:'2026-11-08'}),restored=await fromPptx(bytes,{catalogs:[gallery]});
  assert.equal(restored.language,'ar-SA');
  if(slide.items)assert.deepEqual(restored.slides[0].items,slide.items,'owned native segmentation must preserve the authored scalar/rich topology');
  if(slide.text)assert.deepEqual(restored.slides[0].text,slide.text);
 }
});
