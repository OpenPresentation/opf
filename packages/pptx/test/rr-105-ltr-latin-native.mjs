import assert from 'node:assert/strict';
import {test} from 'node:test';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {gallery} from '@openpresentation/gallery';
import {toPptx,fromPptx} from '../dist/index.js';

const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@',parseTagValue:false,trimValues:false});
const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const sentence='Item 1: Customers told us onboarding took too long, so we rebuilt it around the customer journey.';
const native=async (document,options={})=>{
 const bytes=await toPptx(document,{catalogs:[gallery],...options});
 const zip=unzipSync(bytes),xml=strFromU8(zip['ppt/slides/slide1.xml']);
 const shapes=array(parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']);
 const paragraphs=shapes.flatMap(shape=>array(shape['p:txBody']?.['a:p']).map(p=>({name:shape['p:nvSpPr']?.['p:cNvPr']?.['@name'],pPr:p['a:pPr'],runs:array(p['a:r']).map(r=>({text:String(r['a:t']??''),properties:r['a:rPr']}))})));
 return {bytes,xml,paragraphs};
};
const runsOf=result=>result.paragraphs.flatMap(p=>p.runs);
for(const language of ['ar-SA','he-IL'])for(const slideLanguage of [false,true]){
 test(`inherited Latin numbered list with ASCII digits is protected on ${slideLanguage?'slide':'deck'} ${language}`,async()=>{
  const slide={title:'Qualification',items:[sentence,sentence.replace('Item 1:','Item 2:')],numbering:'arabic',...(slideLanguage?{language}:{})};
  const document={language:slideLanguage?'en-US':language,slides:[slide]};
  const result=await native(document);
  const paragraphs=result.paragraphs.filter(p=>p.runs.some(r=>/Item [12]:/.test(r.text)));
  assert.equal(paragraphs.length,2,'both numbered entries remain native text');
  for(const paragraph of paragraphs){
   assert.equal(paragraph.pPr['@rtl'],'0','Latin paragraph direction remains LTR');
   assert.ok(paragraph.pPr['a:buAutoNum'],'numbering stays native');
   for(const run of paragraph.runs){
    assert.equal(run.properties['@lang'],'en-US','native shaping must not inherit Arabic/Hebrew proofing for Latin digits');
    assert.equal(run.properties['@altLang'],language,'automatic shaping records the effective RTL base language');
   }
  }
  assert.doesNotMatch(result.xml,/<a:(?:normAutofit|spAutoFit)\b/,'no text shrinking is introduced');
  const restored=await fromPptx(result.bytes,{catalogs:[gallery]});
  assert.equal(restored.language,document.language,'automatic shaping cannot change the authored deck language');
  if(slideLanguage)assert.equal(restored.slides[0].language,language);
  assert.deepEqual(restored.slides[0].items,slide.items,'automatic shaping must not turn source strings into authored foreign-language runs');
 });
}
test('plain and styled Latin paragraph fragments share protected numeric shaping on an RTL slide',async()=>{
 for(const text of [sentence,[{text:'Item ',bold:true},{text:'1: '},{text:'Customers keep the delivery order.',italic:true}]]){
  const result=await native({language:'ar-SA',slides:[{text}]});
  const paragraph=result.paragraphs.find(p=>p.runs.map(r=>r.text).join('').includes('Item '));
  assert.ok(paragraph);
  assert.equal(paragraph.pPr['@rtl'],'0');
  for(const run of paragraph.runs){assert.equal(run.properties['@lang'],'en-US');assert.equal(run.properties['@altLang'],'ar-SA');}
 }
});
test('explicit run proofing languages win, including an override equal to the Arabic base',async()=>{
 for(const [lang,nativeTag]of [['ar-SA','ar-SA'],['fr','fr-FR'],['en-US','en-US']]){
  const result=await native({language:'ar-SA',slides:[{items:[{text:[{text:'Item 1: authored proofing choice.',lang}]}],numbering:'arabic'}]});
  const run=runsOf(result).find(r=>r.text.includes('authored proofing'));
  assert.ok(run);assert.equal(run.properties['@lang'],nativeTag,'the automatic fallback never replaces an explicit run language');
  const restored=await fromPptx(result.bytes,{catalogs:[gallery]});
  assert.equal(restored.language,'ar-SA');
  assert.ok(everyRun(restored).some(value=>value.lang===nativeTag&&value.text.includes('authored proofing')),'authored language survives import as its explicit native BCP-47 identity');
 }
});
test('Arabic and mixed-script content retain their native direction and Arabic runs',async()=>{
 for(const text of ['البند 1: نحافظ على ترتيب النص','البند 1: Release 2 remains available']){
  const result=await native({language:'ar-SA',slides:[{items:[text],numbering:'arabic'}]});
  const paragraph=result.paragraphs.find(p=>p.runs.some(r=>r.text.includes('البند')));
  assert.ok(paragraph);assert.equal(paragraph.pPr['@rtl'],'1');
  assert.equal(paragraph.runs.find(r=>r.text.includes('البند')).properties['@lang'],'ar-SA');
 }
});
test('unqualified non-ASCII digits and Latin text without digits retain their existing proofing route',async()=>{
 for(const text of ['Item ١: Arabic-Indic number','Item ۱: Persian number','Only Latin words remain']){
  const result=await native({language:'ar-SA',slides:[{text}]});
  const run=runsOf(result).find(r=>r.text.includes('Item')||r.text.includes('Only Latin'));
  assert.ok(run);assert.equal(run.properties['@lang'],'ar-SA');assert.equal(run.properties['@altLang'],undefined);
 }
});
test('ordinary LTR source keeps its default native language without an automatic override',async()=>{
 const result=await native({language:'en-US',slides:[{items:[sentence],numbering:'arabic'}]});
 const run=runsOf(result).find(r=>r.text.includes('Item 1:'));
 assert.ok(run);assert.equal(run.properties['@lang'],'en-US');assert.equal(run.properties['@altLang'],undefined);
});
const everyRun=value=>Array.isArray(value)?value.flatMap(everyRun):value&&typeof value==='object'?[...(typeof value.text==='string'?[value]:[]),...Object.values(value).filter(x=>x&&typeof x==='object').flatMap(everyRun)]:[];
const proofDeck={language:'ar-SA',slides:[{title:'شريحة عربية',items:['Item 1: Keep the current native characters.'],numbering:'arabic'}]};
const removeMarkers=(entries,all=false)=>{
 const out={...entries};
 for(const file of Object.keys(out))if(/^ppt\/tags\//.test(file)&&(all||strFromU8(out[file]).includes('OPF_NATIVE_LANGUAGE_V1')))delete out[file];
 for(const file of Object.keys(out))if(/\.xml$/.test(file))out[file]=strToU8(strFromU8(out[file]).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g,''));
 for(const file of Object.keys(out))if(/\.rels$/.test(file))out[file]=strToU8(strFromU8(out[file]).replace(/<Relationship\b[^>]*Type="[^"]*\/tags"[^>]*\/>/g,''));
 return out;
};
test('automatic proofing ownership is available in full, references-only and provenance-disabled exports',async()=>{
 for(const provenance of ['full','references-only',false]){
  const result=await native(proofDeck,{provenance}),parts=unzipSync(result.bytes);
  assert.ok(Object.entries(parts).some(([p,v])=>/^ppt\/tags\//.test(p)&&strFromU8(v).includes('OPF_NATIVE_LANGUAGE_V1')),'structural ownership is distinct from full source provenance');
  const restored=await fromPptx(result.bytes,{catalogs:[gallery]});
  assert.equal(restored.language,'ar-SA');
  assert.ok(!everyRun(restored).some(run=>run.lang==='en-US'&&run.text.includes('Item 1:')),'automatic shaping is not an authored English run');
 }
});
test('stripped and foreign untagged proofing pairs preserve observed English instead of guessing author intent',async()=>{
 const result=await native(proofDeck),original=unzipSync(result.bytes);
 for(const foreign of [false,true]){
  const parts=removeMarkers(original,true);
  if(foreign)parts['ppt/slides/slide1.xml']=strToU8(strFromU8(parts['ppt/slides/slide1.xml']).replaceAll('OPF list ','Foreign body '));
  const findings=[],restored=await fromPptx(zipSync(parts),{catalogs:[gallery],onDiagnostic:x=>findings.push(x)});
  assert.ok(everyRun(restored).some(run=>run.lang==='en-US'&&run.text.includes('Item 1:')),'an unowned native proofing choice remains visible');
  assert.ok(findings.some(x=>x.code==='native-language-unowned'));
 }
});
test('changed native words or a changed primary proofing language invalidate automatic ownership',async()=>{
 const result=await native(proofDeck),original=unzipSync(result.bytes);
 for(const edit of ['text','language','alternate']){
  const parts={...original};
  parts['ppt/slides/slide1.xml']=strToU8(strFromU8(parts['ppt/slides/slide1.xml']).replace(edit==='text'?'Keep the current':edit==='language'?'lang="en-US" altLang="ar-SA"':'altLang="ar-SA"',edit==='text'?'Observe the edited':edit==='language'?'lang="fr-FR" altLang="ar-SA"':'altLang="he-IL"'));
  const findings=[],restored=await fromPptx(zipSync(parts),{catalogs:[gallery],onDiagnostic:x=>findings.push(x)});
  assert.ok(everyRun(restored).some(run=>run.lang===(edit==='language'?'fr-FR':'en-US')&&run.text.includes(edit==='text'?'Observe the edited':'Keep the current')));
  assert.ok(findings.some(x=>x.code==='native-language-reference-changed'));
 }
});
test('language observation/import reads leave every input ZIP byte untouched',async()=>{
 const result=await native(proofDeck),copy=Uint8Array.from(result.bytes);
 await fromPptx(result.bytes,{catalogs:[gallery]});
 assert.deepEqual(result.bytes,copy,'a derived read view must not rewrite evidence or fingerprint inputs');
});
test('automatic language and source-boundary tags share one native custom-data list',async()=>{
 for(const text of ['Item 1: A short first line.\nItem 2: A short second line.','First: Item 1 keeps the order.']){
  const document={language:'ar-SA',slides:[{text}]},result=await native(document);
  assert.ok(result.xml.includes('rIdOpfText'),'control includes generated run-in source-boundary ownership');
  for(const [shape]of result.xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)){assert.ok([...shape.matchAll(/<p:custDataLst>/g)].length<=1,'DrawingML allows one custom-data list per shape');assert.ok([...shape.matchAll(/<p:tags\b/g)].length<=1,'the custom-data list permits one tags reference');}
  const findings=[],restored=await fromPptx(result.bytes,{catalogs:[gallery],onDiagnostic:x=>findings.push(x)});
  assert.equal(restored.slides[0].text,text,'both ownership layers preserve the authored primitive and hard line boundaries');
  assert.ok(!findings.some(x=>x.code==='native-language-unowned'||x.code==='invalid-text-provenance'));
 }
});

test('canonical explicit list-language fixtures preserve complete authored rich items',async()=>{
 for(const lang of ['ar-SA','fr-FR','en-US']){
  const document={language:'ar-SA',slides:[{items:[[{text:'Item 1: authored proofing choice.',lang}]],numbering:'arabic'}]};
  const result=await native(document),restored=await fromPptx(result.bytes,{catalogs:[gallery]});
  assert.deepEqual(restored.slides[0].items,document.slides[0].items,'canonical authored run identity and characters survive unchanged');
  assert.equal(restored.language,'ar-SA');
 }
});

test('canonically equivalent Latin accents have equal numeric-shaping eligibility without changing source text',async()=>{
 for(const word of ['Café','Cafe\u0301']){
  const text='Item 1: '+word+' keeps its original Unicode.',document={language:'ar-SA',slides:[{text}]},result=await native(document);
  const selected=runsOf(result).filter(run=>run.text.includes('Item ')||run.text.includes(word));
  assert.ok(selected.length);for(const run of selected)assert.equal(run.properties['@lang'],'en-US','NFC and NFD Latin text use the same shaping protection');
  const restored=await fromPptx(result.bytes,{catalogs:[gallery]});assert.equal(restored.slides[0].text,text,'eligibility never normalizes or rewrites the authored characters');
 }
});

test('mixed RTL paragraphs retain explicit French, English and same-base Arabic run languages',async()=>{
 const examples=[
  ['fr-FR',['البند: ',{text:'Bonjour 1',lang:'fr-FR'}]],
  ['fr-FR',['البند: ',{text:'Bonjour',lang:'fr-FR'}]],
  ['en-US',['البند: ',{text:'Hello 1',lang:'en-US'}]],
  ['ar-SA',['البند: ',{text:'Bonjour 1',lang:'ar-SA'}]],
  ['ar-SA',[{text:'البند: Bonjour 1',lang:'ar-SA'}]],
 ];
 for(const [lang,text]of examples){
  const document={language:'ar-SA',slides:[{items:[text],numbering:'arabic'}]},result=await native(document);
  const explicit=runsOf(result).find(run=>/Bonjour|Hello/.test(run.text));assert.ok(explicit);assert.equal(explicit.properties['@lang'],lang,'the generic bidi splitter never replaces an authored proofing language');
  assert.equal(explicit.properties['@altLang'],'en-US','authored override stays distinct from inherited shaping');
  const restored=await fromPptx(result.bytes,{catalogs:[gallery]});assert.deepEqual(restored.slides[0].items,document.slides[0].items,'all mixed-run source identities and characters survive');assert.equal(restored.language,'ar-SA');
 }
});
