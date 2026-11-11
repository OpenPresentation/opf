// Measured fonts are required here: unmeasured export cannot exercise the new
// planner's predicate or prove its separation from original W03 run ownership.
import assert from 'node:assert/strict';
import test from 'node:test';
import {XMLParser} from 'fast-xml-parser';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {toPptx,fromPptx} from '../dist/index.js';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {decodeTextTag} from '../dist/code-provenance.js';

const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const slidePath='ppt/slides/slide1.xml',prefix='البند: ',phrase='Bonjour 1';
const source={language:'ar-SA',slides:[{title:'عنوان',items:[[{text:prefix+phrase,language:'ar-SA'}]],numbering:'arabic'}]};
const split={...source,slides:[{...source.slides[0],items:[[prefix,{text:phrase,language:'ar-SA'}]]}]};
const decode=text=>String(parser.parse('<t>'+text+'</t>').t??'');
const attr=(xml,name)=>new RegExp('\\b'+name+'="([^"]*)"').exec(xml)?.[1];
const readShapes=xml=>[...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape])=>({xml:shape,name:attr(/<p:cNvPr\b[^>]*>/.exec(shape)?.[0]??'','name'),runs:[...shape.matchAll(/<a:r>([\s\S]*?)<a:t>([^<]*)<\/a:t><\/a:r>/g)].map(([xml,properties,text])=>({xml,properties,text:decode(text)}))}));
const nativeTags=(zip,name)=>Object.entries(zip).filter(([path])=>/^ppt\/tags\//.test(path)).flatMap(([,bytes])=>[...strFromU8(bytes).matchAll(/<p:tag\b([^>]*)\/>/g)].map(match=>({name:attr(match[1],'name'),val:attr(match[1],'val')}))).filter(tag=>tag.name===name).map(tag=>decodeTextTag(tag.val));
const itemRuns=doc=>{const value=doc.slides[0].items[0];return (Array.isArray(value)?value:[value]).map(run=>typeof run==='string'?{text:run}:run);};
const textOf=doc=>itemRuns(doc).map(run=>run.text).join('');

let prepared;
const actual=()=>prepared??=prepare();
async function prepare(){
 const original=structuredClone(source),fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:source});
 try{
  // Both real public exports share one actual prepared fonts handle. The split
  // spelling is an activation control, not an alternative expected source.
  const bytes=await toPptx(source,{fonts}),contrast=await toPptx(split,{fonts});
  assert.deepEqual(source,original);
  const zip=unzipSync(new Uint8Array(bytes)),other=unzipSync(new Uint8Array(contrast));
  return {bytes,zip,xml:strFromU8(zip[slidePath]),contrast,other,contrastXml:strFromU8(other[slidePath])};
 }finally{fonts.dispose?.();}
}

test('one measured authored mixed run keeps exact JSON while the two-run spelling really activates fragments',async()=>{
 const result=await actual(),body=readShapes(result.xml).filter(shape=>shape.name.startsWith('OPF list '));
 assert.equal(body.length,1,'The small mixed authored run is one actual measured native list line');
 assert.equal(body[0].runs.map(run=>run.text).join(''),prefix+phrase);
 assert.equal(nativeTags(result.zip,'OPF_NATIVE_FRAGMENTS_V1').length,0,'A mixed original fragment is not a wholly selected ASCII fragment');
 assert.equal(readShapes(result.xml).filter(shape=>shape.name.startsWith('OPF native fragment ')).length,0);
 const latin=body[0].runs.filter(run=>run.text.includes('Bonjour'));
 assert.equal(latin.length,1,'W03 actually partitions current script font members');
 assert.match(latin[0].properties,/lang="ar-SA" altLang="en-US"/);
 assert.equal(attr(/<a:cs\b[^>]*\/>/.exec(latin[0].properties)?.[0]??'','typeface'),attr(/<a:latin\b[^>]*\/>/.exec(latin[0].properties)?.[0]??'','typeface'));
 const ownership=nativeTags(result.zip,'OPF_NATIVE_LANGUAGE_V1');
 assert(ownership.some(record=>record.latinSlots?.some(group=>group.spans.some(span=>span.count>1))),'Actual original-source CS partition has its own intact W03 boundary ownership');
 const restored=await fromPptx(result.bytes);
 assert.deepEqual(restored,source,'One authored TextRun remains one exact TextRun; do not replace this with character-only equality');
 assert.equal(restored.slides[0].items[0].length,1);
 assert.equal(textOf(restored).length,(prefix+phrase).length);
 assert(nativeTags(result.other,'OPF_NATIVE_FRAGMENTS_V1').length>0,'Measured positive control must activate the new independent fragment writer');
 assert.equal(readShapes(result.contrastXml).length,4);
 assert.deepEqual(await fromPptx(result.contrast),split,'Two authored source parts retain their own strict identity');
});

test('measured one-source-run native text and style edits survive without stale source reconstruction',async()=>{
 const result=await actual(),body=readShapes(result.xml).find(shape=>shape.name.startsWith('OPF list ')),latin=body.runs.find(run=>run.text.includes('Bonjour'));
 assert(latin);
 const originalSize=Number(attr(/<a:rPr\b[^>]*>/.exec(latin.properties)?.[0]??'','sz'));
 assert(Number.isSafeInteger(originalSize)&&originalSize>0);
 for(const [name,change,expectedText,check]of [
  ['longer native text',xml=>xml.replace('<a:t>'+phrase+'</a:t>','<a:t>Edited current text 234</a:t>'),prefix+'Edited current text 234',()=>{}],
  ['bold on current Latin member',xml=>xml.replace(/<a:rPr\b/,'<a:rPr b="1"'),prefix+phrase,doc=>{assert(itemRuns(doc).some(run=>run.text.includes('Bonjour')&&run.bold===true));assert(itemRuns(doc).filter(run=>run.text.includes('البند')).every(run=>run.bold!==true),'A current style edit is not spread across the old authored run');}],
  ['current Latin font',xml=>xml.replace(/(<a:latin\b[^>]*\btypeface=")[^"]*"/,'$1Georgia"'),prefix+phrase,doc=>{assert(itemRuns(doc).some(run=>run.text.includes('Bonjour')&&run.fontFamily==='Georgia'));assert(itemRuns(doc).filter(run=>run.text.includes('البند')).every(run=>run.fontFamily!=='Georgia'));}],
  ['current Latin proofing',xml=>xml.replace('lang="ar-SA"','lang="fr-FR"'),prefix+phrase,doc=>assert(itemRuns(doc).some(run=>run.text.includes('Bonjour')&&run.language==='fr-FR'))],
  ['current Latin point size',xml=>xml.replace(/\bsz="\d+"/,'sz="'+(originalSize+100)+'"'),prefix+phrase,doc=>assert(itemRuns(doc).some(run=>run.text.includes('Bonjour')&&run.fontSize===(originalSize+100)/100))],
 ]){
  const member=change(latin.xml);assert.notEqual(member,latin.xml,name+' must mutate the actual selected native member');
  const nextBody=body.xml.replace(latin.xml,member),zip={...result.zip,[slidePath]:strToU8(result.xml.replace(body.xml,nextBody))},diagnostics=[];
  const restored=await fromPptx(zipSync(zip),{onDiagnostic:diagnostic=>diagnostics.push(diagnostic)});
  assert.equal(textOf(restored),expectedText,name+' keeps exact CURRENT native UTF16, not stored source text');
  assert.equal(textOf(restored).length,expectedText.length);
  check(restored);
  assert(diagnostics.some(diagnostic=>diagnostic.code==='native-language-reference-changed'),name+' invalidates old W03 paragraph membership rather than replaying authored boundaries');
  if(name==='longer native text')assert(!textOf(restored).includes(phrase));
 }
});
