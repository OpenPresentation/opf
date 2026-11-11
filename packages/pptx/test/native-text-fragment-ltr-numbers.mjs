// Numeric-triggered native character-direction leakage is a hypothesis. These
// genuine public API checks prove source/placement/edit authority, not pixels.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {XMLParser} from 'fast-xml-parser';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {convert} from '@openpresentation/opf';
import {resolvePresentation} from '@openpresentation/opf-render';
import {textWidthMeasurer} from '@openpresentation/opf/composition';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx,fromPptx} from '../dist/index.js';
import {decodeTextTag} from '../dist/code-provenance.js';
import {nativeFragmentPropertiesHash} from '../dist/native-text-fragments.js';

const oldBytes=readFileSync(new URL('../../../scripts/native-acceptance/test-fixtures/b07-current/original-09.opf.json',import.meta.url));
const old=JSON.parse(oldBytes),source=structuredClone(old),run=source.slides[0].items[0][0];run.language=run.lang;delete run.lang;
const currentBytes=Buffer.from(JSON.stringify(source,null,2)+'\n'),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),slidePath='ppt/slides/slide1.xml';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const attr=(xml,name)=>new RegExp('\\b'+name+'="([^"]*)"').exec(xml)?.[1];
const decode=text=>String(parser.parse('<t>'+text+'</t>').t??'');
const shapes=xml=>[...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([xml])=>({xml,name:attr(/<p:cNvPr\b[^>]*>/.exec(xml)?.[0]??'','name'),runs:[...xml.matchAll(/<a:r>([\s\S]*?)<a:t>([^<]*)<\/a:t><\/a:r>/g)].map(([xml,properties,text])=>({xml,properties,text:decode(text)}))}));
const text=shape=>shape.runs.map(run=>run.text).join('');
const frame=shape=>{const found=/<a:xfrm><a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/><\/a:xfrm>/.exec(shape.xml);assert(found);return found.slice(1).map(Number);};
const tags=zip=>Object.entries(zip).filter(([path])=>/^ppt\/tags\//.test(path)).flatMap(([,bytes])=>[...strFromU8(bytes).matchAll(/<p:tag name="OPF_NATIVE_FRAGMENTS_V1" val="([^"]*)"\/>/g)].map(match=>decodeTextTag(match[1])));
const itemRuns=doc=>{const value=(doc.slides[0].items??doc.slides[0].blocks?.find(block=>block.type==='list')?.items)[0];return (Array.isArray(value)?value:[value]).map(run=>typeof run==='string'?{text:run}:run);};
const bodyText=doc=>itemRuns(doc).map(run=>run.text).join('');
let prepared;
const actual=()=>prepared??=prepare();
async function prepare(){
 const original=structuredClone(source),fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:source});
 try{
  const bytes=await toPptx(source,{fonts}),preview=await convert(source,{format:'svg',fonts}),geometry=resolvePresentation(source,{fonts,validate:false}).slides[0].geometry;
  assert.deepEqual(source,original);const entry=geometry.items.find(item=>item.field==='items').text.listEntries[0],lines=entry.text.richLines;
  assert.equal(lines.length,2);assert.equal(lines[0].fragments.length,1);assert.equal(lines[1].fragments.length,1);
  const first=lines[0].fragments[0],next=lines[1].fragments[0],measure=textWidthMeasurer(first.style,fonts.textMeasurement);
  const zip=unzipSync(new Uint8Array(bytes));
  return {bytes,zip,xml:strFromU8(zip[slidePath]),svg:strFromU8(preview.files[0].bytes),origin:entry.textBox.x,first:{text:first.text,start:first.start,end:first.end,width:first.width},next:{text:next.text,start:next.start,end:next.end,width:next.width},advances:[measure(first.text,first.fontSize),measure(first.text.slice(0,5),first.fontSize),measure(first.text.slice(0,6),first.fontSize)]};
 }finally{fonts.dispose?.();}
}

test('pinned whole-ASCII Arabic-proofed source isolates only the numeric interval at genuine measured origins',async()=>{
 assert.equal(oldBytes.length,371);assert.equal(hash(oldBytes),'16064a74fd25c95544df46dc4f340829280caef7ef7324d117f492bb4284f15c');
 assert.equal(currentBytes.length,375);assert.equal(hash(currentBytes),'06be411c44847acac56f90b67baa318469b2206661de5a76ed315555513bc8c6');
 const inverse=structuredClone(source);inverse.slides[0].items[0][0].lang=inverse.slides[0].items[0][0].language;delete inverse.slides[0].items[0][0].language;assert.deepEqual(Buffer.from(JSON.stringify(inverse,null,2)+'\n'),oldBytes);
 assert.equal(run.text.length,97);assert.equal(source.slides[0].title.length,26);
 const result=await actual(),all=shapes(result.xml),carrier=all.find(shape=>/^OPF list .+ line 0$/.test(shape.name)),continuation=all.find(shape=>/^OPF list .+ line 1$/.test(shape.name)),members=all.filter(shape=>shape.name.startsWith('OPF native fragment '));
 assert.equal(result.first.text,run.text.slice(0,69));assert.equal(result.first.text.length,69);assert.equal(result.first.text.charCodeAt(68),0x20);
 assert.equal(result.next.text,run.text.slice(69));assert.equal(result.next.text.length,28);assert.equal(result.next.start,69);
 assert.equal(all.length,5,'Actual shape count, not an assumed qualification result');
 assert.equal(text(carrier),'Item ');assert.deepEqual(members.map(text),['1',run.text.slice(6,69)]);assert.equal(text(continuation),run.text.slice(69));
 assert.equal(all.map(text).join('').length,123);assert.equal((result.xml.match(/<a:buAutoNum\b/g)??[]).length,1);assert.equal(tags(result.zip).length,3);
 const rows=[carrier,...members,continuation];for(const shape of rows){assert.match(shape.xml,/<a:pPr\b[^>]*\brtl="0"/);assert.match(shape.xml,/<a:bodyPr\b[^>]*\brtlCol="0"/);for(const member of shape.runs){assert.match(member.properties,/lang="ar-SA" altLang="en-US"/);assert.equal(attr(/<a:cs\b[^>]*\/>/.exec(member.properties)?.[0]??'','typeface'),attr(/<a:latin\b[^>]*\/>/.exec(member.properties)?.[0]??'','typeface'));assert(!/<a:rtl\b/.test(member.properties));}}
 const tail=/<a:endParaRPr\b[^>]*\/>|<a:endParaRPr\b[^>]*>[\s\S]*?<\/a:endParaRPr>/.exec(carrier.xml)?.[0];assert(tail);for(const member of members){assert.equal(member.runs[0].properties,carrier.runs[0].properties);assert(member.xml.includes(tail));assert(!member.xml.includes('<a:buAutoNum'));}
 const svgLine=[...result.svg.matchAll(/<text\b([^>]*)>([^<]*Item 1:[^<]*)<\/text>/g)][0];assert(svgLine,'Actual unchanged SVG measured line supplies its LTR origin');
 const origin=result.origin;assert(Number.isFinite(origin));assert.equal(Number(origin.toFixed(3)),Number(attr(svgLine[1],'x')),'Current SVG and core agree on the unchanged LTR origin at existing SVG precision');assert(Math.abs(result.advances[0]-result.first.width)<=1e-7);
 const [number,suffix]=members.map(frame),original=frame(carrier);assert.equal(number[0],Math.round((origin+result.advances[1])*9525));assert.equal(suffix[0],Math.round((origin+result.advances[2])*9525));assert.equal(number[0]+number[2],suffix[0]);assert.equal(suffix[0]+suffix[2],Math.round((origin+result.advances[0])*9525));
 for(const member of [number,suffix]){assert.equal(member[1],original[1]);assert.equal(member[3],original[3]);}
 assert(!/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(result.xml));
 assert.deepEqual(await fromPptx(result.bytes),source,'One original authored run survives all generated numeric paragraphs and measured wrapping');
});

test('current arbitrary-length suffix and numeric edits remain current without old-length slicing',async()=>{
 const result=await actual(),all=shapes(result.xml),suffix=all.find(shape=>shape.name.startsWith('OPF native fragment ')&&text(shape)!=='1'),numeric=all.find(shape=>shape.name.startsWith('OPF native fragment ')&&text(shape)==='1');
 for(const [member,replacement,expected]of [[suffix,': Edited current text ',run.text.slice(0,6)+': Edited current text '+run.text.slice(69)],[numeric,'2345',run.text.slice(0,5)+'2345'+run.text.slice(6)]]){
  const changed=member.xml.replace(member.runs[0].xml,member.runs[0].xml.replace(/<a:t>[^<]*<\/a:t>/,'<a:t>'+replacement+'</a:t>')),diagnostics=[],zip={...result.zip,[slidePath]:strToU8(result.xml.replace(member.xml,changed))};
  const imported=await fromPptx(zipSync(zip),{onDiagnostic:issue=>diagnostics.push(issue)});assert.equal(bodyText(imported),expected);assert.equal(bodyText(imported).length,expected.length);assert(diagnostics.some(issue=>issue.code==='native-fragment-reflow'));
 }
});

test('current suffix style and native-boundary edits are not spread across the old authored run',async()=>{
 const result=await actual(),suffix=shapes(result.xml).find(shape=>shape.name.startsWith('OPF native fragment ')&&text(shape)!=='1');
 const record=tags(result.zip).find(record=>record.name===suffix.name),binding=Object.fromEntries(['v','group','count','length','source','index','name','id','from','to','role'].map(key=>[key,record[key]]));
 assert.equal(nativeFragmentPropertiesHash(suffix.xml,binding),record.properties);
 for(const [name,change,check]of [
  ['font',xml=>xml.replace(/(<a:latin\b[^>]*\btypeface=")[^"]*"/,'$1Georgia"'),runs=>{assert(runs.some(run=>run.text.includes('Customers')&&run.fontFamily==='Georgia'));assert(runs.filter(run=>run.text.includes('Item')||run.text.includes('around')).every(run=>run.fontFamily!=='Georgia'));}],
  ['proofing',xml=>xml.replace('lang="ar-SA"','lang="fr-FR"'),runs=>assert(runs.some(run=>run.text.includes('Customers')&&run.language==='fr-FR'))],
  ['boundary',xml=>xml.replace(suffix.runs[0].xml,suffix.runs[0].xml.replace(/<a:t>[^<]*<\/a:t>/,'<a:t>: </a:t>')+suffix.runs[0].xml.replace(/<a:t>[^<]*<\/a:t>/,'<a:t>'+run.text.slice(8,69)+'</a:t>')),runs=>assert(runs.some(run=>run.text===': '))],
 ]){
  const changed=change(suffix.xml);assert.notEqual(changed,suffix.xml,name);assert.notEqual(nativeFragmentPropertiesHash(changed,binding),record.properties,name+' must disable old complete-property joining');const diagnostics=[],zip={...result.zip,[slidePath]:strToU8(result.xml.replace(suffix.xml,changed))},imported=await fromPptx(zipSync(zip),{onDiagnostic:issue=>diagnostics.push(issue)});
  assert.equal(bodyText(imported),run.text);check(itemRuns(imported));assert(diagnostics.some(issue=>issue.code==='native-fragment-reflow'));
 }
});

test('current interior boundaries survive continuation, removed-continuation and new-entry joins',async()=>{
 const result=await actual(),all=shapes(result.xml),carrier=all.find(shape=>/^OPF list .+ line 0$/.test(shape.name)),continuation=all.find(shape=>/^OPF list .+ line 1$/.test(shape.name)),suffix=all.find(shape=>shape.name.startsWith('OPF native fragment ')&&text(shape)!=='1'),native=suffix.runs[0];
 const left=native.xml.replace(/<a:t>[^<]*<\/a:t>/,'<a:t>: </a:t>'),right=native.xml.replace(/<a:t>[^<]*<\/a:t>/,'<a:t>'+run.text.slice(8,69)+'</a:t>'),changed=result.xml.replace(suffix.xml,suffix.xml.replace(native.xml,left+right)),pPr=/<a:pPr\b[^>]*\/>|<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>/.exec(carrier.xml)[0];
 const newEntry=continuation.xml.replace(/<a:pPr\b[^>]*\/>|<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>/,pPr);
 for(const [name,xml,expectedTail,bold]of [
  ['continuation',changed,run.text.slice(8),false],
  ['removed continuation',changed.replace(continuation.xml,''),run.text.slice(8,69),false],
  ['new entry',changed.replace(continuation.xml,newEntry),run.text.slice(8,69),false],
  ['style divergence',changed.replace(left,left.replace('<a:rPr ','<a:rPr b="1" ')),run.text.slice(8),true],
 ]){
  const diagnostics=[],zip={...result.zip,[slidePath]:strToU8(xml)},imported=await fromPptx(zipSync(zip),{onDiagnostic:issue=>diagnostics.push(issue)});
  assert.deepEqual(itemRuns(imported),[{text:'Item 1',language:'ar-SA'},{text:': ',...(bold?{bold:true}:{}),language:'ar-SA'},{text:expectedTail,language:'ar-SA'}],name+' retains every current interior run while only the line seam joins');
  assert(diagnostics.some(issue=>issue.code==='native-fragment-reflow'),name);
  if(name==='new entry'){assert.equal(imported.slides[0].items.length,2);assert.deepEqual(imported.slides[0].items[1],{text:[{text:run.text.slice(69),language:'ar-SA'}],start:1});}
  if(name==='removed continuation')assert(!JSON.stringify(imported).includes(run.text.slice(69)),'Deleted current content is not replayed from provenance');
 }
});

test('a continuation retains its own interior boundaries on the right side of the seam',async()=>{
 const document=structuredClone(source);document.slides[0].items[0][0].text=run.text.replace('around the','around 2 the');
 const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:document});
 try{
  const bytes=await toPptx(document,{fonts}),zip=unzipSync(new Uint8Array(bytes)),xml=strFromU8(zip[slidePath]);assert.deepEqual(await fromPptx(bytes),document,'The intact one-authored-run paragraph still joins only its artificial wraps');
  const suffix=shapes(xml).find(shape=>shape.name.startsWith('OPF native fragment ')&&text(shape).endsWith('journey.'));assert(suffix);assert.equal(suffix.runs.length,1);assert.equal(text(suffix),' the customer journey.');
  const native=suffix.runs[0],left=native.xml.replace(/<a:t>[^<]*<\/a:t>/,'<a:t> the </a:t>'),right=native.xml.replace(/<a:t>[^<]*<\/a:t>/,'<a:t>customer journey.</a:t>'),changed=suffix.xml.replace(native.xml,left+right),diagnostics=[];
  const imported=await fromPptx(zipSync({...zip,[slidePath]:strToU8(xml.replace(suffix.xml,changed))}),{onDiagnostic:issue=>diagnostics.push(issue)});
  assert.equal(bodyText(imported),document.slides[0].items[0][0].text);assert(itemRuns(imported).some(run=>run.text===' the '));assert(itemRuns(imported).some(run=>run.text==='customer journey.'));assert(diagnostics.some(issue=>issue.code==='native-fragment-reflow'));
 }finally{fonts.dispose?.();}
});

test('inherited proofing and non-ASCII digits keep their existing measured routes',async()=>{
 const inherited=structuredClone(source);delete inherited.slides[0].items[0][0].language;
 const nonAscii=JSON.parse(readFileSync(new URL('../../../scripts/native-acceptance/test-fixtures/b07-current/original-10.opf.json',import.meta.url)));
 for(const [name,document]of [['inherited',inherited],['non-ASCII',nonAscii]]){
  const before=structuredClone(document),fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:document});
  try{
   const bytes=await toPptx(document,{fonts}),zip=unzipSync(new Uint8Array(bytes)),xml=strFromU8(zip[slidePath]);assert.deepEqual(document,before);assert.equal(tags(zip).length,0,name+' cannot acquire numeric fragment ownership');
   if(name==='inherited'){
    const all=shapes(xml),body=all.filter(shape=>shape.name.startsWith('OPF list '));assert.equal(all.length,3);
    const expected=new Map([
     ['OPF list slides.0.items line 0',{text:run.text.slice(0,69),utf16:69,lang:'en-US',altLang:'ar-SA'}],
     ['OPF list slides.0.items line 1',{text:run.text.slice(69),utf16:28,lang:'ar-SA',altLang:undefined}],
    ]);
    assert.deepEqual(body.map(shape=>shape.name),[...expected.keys()],'Every original inherited line has one exact identity');
    for(const shape of body){assert.equal(shape.runs.length,1);const member=shape.runs[0];assert.deepEqual({text:member.text,utf16:member.text.length,lang:attr(member.properties,'lang'),altLang:attr(member.properties,'altLang')},expected.get(shape.name),'Proofing follows this original line, not a blanket language assumption');}
    assert.deepEqual(await fromPptx(bytes),{...inherited,slides:[{...inherited.slides[0],items:[run.text]}]},'The existing inherited route returns the exact scalar canonical source without an authored language override');
   }
   else{assert(xml.includes('١'));assert(xml.includes('۱'));assert(!xml.includes('Item 1:'),'Arabic/Persian source digits cannot be coerced to ASCII');}
  }finally{fonts.dispose?.();}
 }
});

test('the honest native-body fixture remains two editable paragraphs without measured fallback',async()=>{
 const document={slides:[{title:'Title',text:[{text:'Bonjour 1\nWelcome 2 ',language:'ar-SA',fontFamily:'Georgia'},{text:'Hello 2',language:'ar-SA',fontFamily:'Times New Roman'}]}]};
 const bytesOfSource=Buffer.from(JSON.stringify(document,null,2)+'\n');assert.equal(bytesOfSource.length,333);assert.equal(hash(bytesOfSource),'8385a562944abb5578b4c0cd6bb15628dcf1dfb82e904c702b58b99e820cf078');
 const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:document});
 try{
  const diagnostics=[],bytes=await toPptx(document,{fonts,bodyText:'native',onDiagnostic:issue=>diagnostics.push(issue)}),zip=unzipSync(new Uint8Array(bytes)),body=shapes(strFromU8(zip[slidePath])).filter(shape=>shape.name.startsWith('OPF native body '));
  assert.equal(body.length,1);assert.equal((body[0].xml.match(/<a:p>/g)??[]).length,2);assert.equal(tags(zip).length,0);assert(!diagnostics.some(issue=>issue.code==='native-body-fallback'));
  assert.deepEqual(await fromPptx(bytes),{slides:[{title:'Title',text:[{text:'Bonjour 1',bold:false,italic:false,underline:false,fontFamily:'Georgia',language:'ar-SA'},{text:'\n',fontFamily:'Georgia'},{text:'Welcome 2 ',bold:false,italic:false,underline:false,fontFamily:'Georgia',language:'ar-SA'},{text:'Hello 2',bold:false,italic:false,underline:false,fontFamily:'Times New Roman',language:'ar-SA'}]}]},'Retain the existing current-native-body canonical form and reflow path');
 }finally{fonts.dispose?.();}
});
