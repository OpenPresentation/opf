import assert from 'node:assert/strict';
import {test} from 'node:test';
import {partScriptFonts} from '../src/script-fonts.js';

const plan={deck:{lang:'ar-SA',rtl:true,direction:'rtl',body:{},heading:{}},slides:[]};
const shape=(text,{name='OPF list slides.0.items.0',rtl='0',lang='ar-SA',alternate,children='<a:latin typeface="Arial"/>'}={})=>`<p:sp><p:nvSpPr><p:cNvPr name="${name}"/></p:nvSpPr><p:txBody><a:p><a:pPr rtl="${rtl}"/><a:r><a:rPr lang="${lang}"${alternate?` altLang="${alternate}"`:''}>${children}</a:rPr><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
const adapted=xml=>partScriptFonts('ppt/slides/slide1.xml',xml,plan,0);

for(const [label,text,alternate] of [
 ['explicit Arabic','Item 1: Customers told us onboarding took too long.', 'en-US'],
 ['Arabic-Indic','Item ١: Arabic-Indic number'],
 ['Persian','Item ۱: Persian number'],
 ['NFD Latin','Cafe\u0301 ١: Keep every source codepoint.'],
])test(`${label} measured Latin numeric run has explicit LTR shaping without changing proofing`,()=>{
 const input=shape(text,{alternate}),output=adapted(input);
 assert.match(output,/<a:rtl val="0"\/>/,'native run direction must be explicit independently of proofing language');
 assert.ok(output.includes(`<a:t>${text}</a:t>`),'source words/codepoints stay exact');
 assert.match(output,/lang="ar-SA"/,'authored/effective proofing language survives');
 if(alternate)assert.match(output,/altLang="en-US"/);
 else assert.doesNotMatch(output,/altLang=/,'non-ASCII digits do not activate the language adapter');
 assert.match(output,/<a:pPr rtl="0"\/>/,'paragraph direction stays unchanged');
});

test('explicit French proofing is retained with a run direction child in schema order',()=>{
 const input=shape('Item 1: Keep the authored French proofing.',{lang:'fr-FR',alternate:'en-US',children:'<a:latin typeface="Arial"/><a:hlinkClick r:id="rId1"/><a:extLst><a:ext uri="test"/></a:extLst>'});
 const output=adapted(input);
 assert.match(output,/lang="fr-FR" altLang="en-US"/);
 assert.match(output,/<a:hlinkClick r:id="rId1"\/><a:rtl val="0"\/><a:extLst>/,'DrawingML order is links, rtl, extension list');
});

test('mixed and strong RTL text, ordinary LTR decks, foreign shapes and nonnumeric Latin remain unchanged',()=>{
 for(const input of [shape('البند ١: العربية',{rtl:'1'}),shape('البند 1: Release 2 remains available',{rtl:'1'}),shape('Item 1: العربية',{rtl:'0'}),shape('Item ١: French control',{name:'Foreign body'}),shape('Latin text without a number')]){
  assert.doesNotMatch(adapted(input),/<a:rtl\b/);
 }
 const ltr={deck:{lang:'en-US',rtl:false,direction:'ltr',body:{},heading:{}},slides:[]};
 const input=shape('Item 1: Existing LTR deck',{lang:'en-US'});
 assert.doesNotMatch(partScriptFonts('ppt/slides/slide1.xml',input,ltr,0),/<a:rtl\b/);
});

test('an existing native run direction is preserved without duplicate children',()=>{
 for(const value of ['0','1']){
  const input=shape('Item ١: Existing direction',{children:`<a:latin typeface="Arial"/><a:rtl val="${value}"/>`});
  const output=adapted(input);
  assert.equal([...output.matchAll(/<a:rtl\b/g)].length,1);
  assert.ok(output.includes(`<a:rtl val="${value}"/>`));
 }
});
