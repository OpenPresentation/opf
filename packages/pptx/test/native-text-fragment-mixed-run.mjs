// Measured fonts are required here: unmeasured export cannot exercise the new
// planner's predicate or prove its separation from original W03 run ownership.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {XMLParser} from 'fast-xml-parser';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {toPptx,fromPptx} from '../dist/index.js';
import {convert} from '@openpresentation/opf';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {decodeTextTag,encodeTextTag} from '../dist/code-provenance.js';
import {nativeFragmentPropertiesHash} from '../dist/native-text-fragments.js';

const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const historicalBytes=readFileSync(new URL('../../../scripts/native-acceptance/test-fixtures/b07-current/original-06.opf.json',import.meta.url));
const historical=JSON.parse(historicalBytes),source=structuredClone(historical),authored=source.slides[0].items[0][0];
authored.language=authored.lang;delete authored.lang;
const currentBytes=Buffer.from(JSON.stringify(source,null,2)+'\n'),sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const slidePath='ppt/slides/slide1.xml',prefix=authored.text.slice(0,7),phrase=authored.text.slice(7);
const split={...source,slides:[{...source.slides[0],items:[[{text:prefix,language:'ar-SA'},{text:phrase,language:'ar-SA'}]]}]};
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
  // Both real public exports share one actual prepared fonts handle. Authored
  // boundaries are independent of the identical current native properties.
  const bytes=await toPptx(source,{fonts}),contrast=await toPptx(split,{fonts});
  const preview=await convert(source,{format:'svg',fonts});
  assert.deepEqual(source,original);
  const zip=unzipSync(new Uint8Array(bytes)),other=unzipSync(new Uint8Array(contrast));
  return {bytes,zip,xml:strFromU8(zip[slidePath]),contrast,other,contrastXml:strFromU8(other[slidePath]),svg:strFromU8(preview.files[0].bytes)};
 }finally{fonts.dispose?.();}
}

test('one measured authored mixed run and two identical-style authored runs retain exact source boundaries',async()=>{
 assert.equal(historicalBytes.length,269);assert.equal(sha256(historicalBytes),'c91b4632baf1f35fbe3e5e9c28ecb4e22588ed6d52c3d35b92d0b6abe5ff6923');
 assert.equal(currentBytes.length,273);assert.equal(sha256(currentBytes),'1077885b435004706270c8251a8b2d37c6b3d3e3350003625e8cffd0f991f03f');
 const inverse=structuredClone(source);inverse.slides[0].items[0][0].lang=inverse.slides[0].items[0][0].language;delete inverse.slides[0].items[0][0].language;assert.deepEqual(inverse,historical);assert.deepEqual(Buffer.from(JSON.stringify(inverse,null,2)+'\n'),historicalBytes);
 assert.equal(prefix.length,7);assert.equal(phrase.length,9);assert.equal(authored.text.charCodeAt(14),0x20);assert.equal(authored.text.charCodeAt(15),0x31);assert.equal(source.slides[0].title.length,12);
 const result=await actual(),body=readShapes(result.xml).filter(shape=>shape.name.startsWith('OPF list '));
 assert.equal(body.length,1,'The original list carrier retains paragraph and numbering ownership');
 assert.equal(body[0].runs.map(run=>run.text).join(''),prefix);
 assert.equal(readShapes(result.xml).length,4,'Heading plus carrier, word and digit');
 assert.equal(readShapes(result.xml).flatMap(shape=>shape.runs).map(run=>run.text).join('').length,28);
 const members=readShapes(result.xml).filter(shape=>shape.name.startsWith('OPF native fragment '));
 assert.deepEqual(members.flatMap(shape=>shape.runs).map(run=>run.text),['Bonjour ','1']);
 assert.equal(nativeTags(result.zip,'OPF_NATIVE_FRAGMENTS_V1').length,3);
 const latin=members[0].runs;
 assert.match(latin[0].properties,/lang="ar-SA" altLang="en-US"/);
 assert.equal(attr(/<a:cs\b[^>]*\/>/.exec(latin[0].properties)?.[0]??'','typeface'),attr(/<a:latin\b[^>]*\/>/.exec(latin[0].properties)?.[0]??'','typeface'));
 const ownership=nativeTags(result.zip,'OPF_NATIVE_LANGUAGE_V1');
 assert(!ownership.some(record=>record.name===body[0].name),'Shortened carrier cannot retain overlapping whole-line W03 ownership');
 assert.equal((result.xml.match(/<a:buAutoNum\b/g)??[]).length,1);
 assert(!/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(result.xml));
 const tail=/<a:endParaRPr\b[^>]*\/>|<a:endParaRPr\b[^>]*>[\s\S]*?<\/a:endParaRPr>/.exec(body[0].xml)?.[0];assert(tail);
 for(const member of members){assert(member.xml.includes(tail));assert.match(member.xml,/lang="ar-SA" altLang="en-US"/);assert(!member.xml.includes('<a:buAutoNum'));}
 const nativeFrame=xml=>{const match=/<a:xfrm><a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/><\/a:xfrm>/.exec(xml);assert(match);return match.slice(1).map(Number);};
 const latinSpan=[...result.svg.matchAll(/<tspan\b([^>]*)>([^<]*Bonjour[^<]*)<\/tspan>/gu)][0];assert(latinSpan,'Actual mixed-run SVG supplies the script interval origin');
 const [word,digit]=members.map(member=>nativeFrame(member.xml)),carrier=nativeFrame(body[0].xml);
 assert.equal(Number((word[0]/9525).toFixed(3)),Number(attr(latinSpan[1],'x')));
 assert.equal(word[0]+word[2],digit[0]);
 for(const frame of [word,digit]){assert.equal(frame[1],carrier[1]);assert.equal(frame[3],carrier[3]);assert(frame[0]>=carrier[0]&&frame[0]+frame[2]<=carrier[0]+carrier[2]);}
 const restored=await fromPptx(result.bytes);
 assert.deepEqual(restored,source,'One authored TextRun remains one exact TextRun; do not replace this with character-only equality');
 assert.equal(restored.slides[0].items[0].length,1);
 assert.equal(textOf(restored).length,(prefix+phrase).length);
 assert.equal(nativeTags(result.other,'OPF_NATIVE_FRAGMENTS_V1').length,3);
 assert.equal(readShapes(result.contrastXml).length,4);
 assert.deepEqual(await fromPptx(result.contrast),split,'Two authored source parts retain their own strict identity');
});

test('measured one-source-run native text and style edits survive without stale source reconstruction',async()=>{
 const result=await actual(),body=readShapes(result.xml).find(shape=>shape.name.startsWith('OPF native fragment ')&&shape.runs.some(run=>run.text.includes('Bonjour'))),latin=body.runs[0];
 assert(latin);
 const originalSize=Number(attr(/<a:rPr\b[^>]*>/.exec(latin.properties)?.[0]??'','sz'));
 assert(Number.isSafeInteger(originalSize)&&originalSize>0);
 for(const [name,change,expectedText,check]of [
  ['longer native text',xml=>xml.replace('<a:t>Bonjour </a:t>','<a:t>Edited current text 234 </a:t>'),prefix+'Edited current text 234 1',doc=>assert.equal(itemRuns(doc).length,1,'Intact source-owned properties permit arbitrary-length current text to remain one authored run')],
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
  assert(diagnostics.some(diagnostic=>diagnostic.code==='native-fragment-reflow'),name+' retains current native edits with a reflow finding');
  if(name==='longer native text')assert(!textOf(restored).includes(phrase));
 }
});

test('same-source missing, terminal, unknown and native-boundary edits never qualify for owned property normalization',async()=>{
 const result=await actual(),word=readShapes(result.xml).find(shape=>shape.name.startsWith('OPF native fragment ')&&shape.runs.some(run=>run.text.includes('Bonjour')));
 const record=nativeTags(result.zip,'OPF_NATIVE_FRAGMENTS_V1').find(record=>record.name===word.name),binding=Object.fromEntries(['v','group','count','length','source','index','name','id','from','to','role'].map(key=>[key,record[key]]));
 assert.equal(nativeFragmentPropertiesHash(word.xml,binding),record.properties);
 for(const [name,change]of [
  ['missing run properties',xml=>xml.replace(/<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>/,'')],
  ['changed CS font',xml=>xml.replace(/(<a:cs\b[^>]*\btypeface=")[^"]*"/,'$1Georgia"')],
  ['changed terminal size',xml=>xml.replace(/(<a:endParaRPr\b[^>]*\bsz=")\d+"/,(_match,before)=>before+'1800"')],
  ['unknown terminal metadata',xml=>xml.replace(/(<a:endParaRPr\b)/,'$1 kumimoji="1"')],
  ['new native boundary',xml=>xml.replace(word.runs[0].xml,word.runs[0].xml.replace('<a:t>Bonjour </a:t>','<a:t>Bon</a:t>')+word.runs[0].xml.replace('<a:t>Bonjour </a:t>','<a:t>jour </a:t>'))],
 ]){
  const changed=change(word.xml);assert.notEqual(changed,word.xml,name);assert.notEqual(nativeFragmentPropertiesHash(changed,binding),record.properties,name+' changes complete current property evidence');
  const zip={...result.zip,[slidePath]:strToU8(result.xml.replace(word.xml,changed))},diagnostics=[],doc=await fromPptx(zipSync(zip),{onDiagnostic:diagnostic=>diagnostics.push(diagnostic)});
  assert.equal(textOf(doc),prefix+phrase,name+' retains all current UTF16');
  assert(diagnostics.some(diagnostic=>diagnostic.code==='native-fragment-reflow'),name+' is retained as current native divergence');
  if(name==='new native boundary')assert(itemRuns(doc).some(run=>run.text==='Bon'),'A new current native run boundary is not joined by old source ownership');
 }
});

test('foreign or incomplete mixed-source ownership refuses without restoring deleted native content',async()=>{
 const result=await actual(),digit=readShapes(result.xml).find(shape=>shape.name.startsWith('OPF native fragment ')&&shape.runs.map(run=>run.text).join('')==='1');
 for(const [name,change]of [
  ['missing property receipt',record=>{const next={...record};delete next.properties;return next;}],
  ['foreign source boundary',record=>({...record,source:[{run:1,start:0,end:15}]})],
  ['unknown ownership field',record=>({...record,foreign:true})],
 ]){
  const zip={...result.zip,[slidePath]:strToU8(result.xml.replace(digit.xml,digit.xml.replace('<a:t>1</a:t>','<a:t>2345</a:t>')))};let changed=0;
  for(const [path,bytes]of Object.entries(zip).filter(([path])=>/^ppt\/tags\//.test(path))){
   const xml=strFromU8(bytes).replace(/(<p:tag name="OPF_NATIVE_FRAGMENTS_V1" val=")([^"]+)("\/>)/g,(whole,before,value,after)=>{changed++;return before+encodeTextTag(change(decodeTextTag(value)))+after;});zip[path]=strToU8(xml);
  }
  assert.equal(changed,3);const diagnostics=[],doc=await fromPptx(zipSync(zip),{onDiagnostic:diagnostic=>diagnostics.push(diagnostic)});
  const current=JSON.stringify(doc);assert(current.includes('Bonjour'),name);assert(current.includes('2345'),name+' keeps the actual edited current digit text');assert(diagnostics.some(diagnostic=>diagnostic.code==='invalid-native-fragments'),name);
 }
 const zip={...result.zip,[slidePath]:strToU8(result.xml.replace(digit.xml,''))},diagnostics=[];
 const doc=await fromPptx(zipSync(zip),{onDiagnostic:diagnostic=>diagnostics.push(diagnostic)});assert(!JSON.stringify(doc).includes(phrase),'Deleted digit is never replayed from old authored text');assert(diagnostics.some(diagnostic=>diagnostic.code==='invalid-native-fragments'));
});
