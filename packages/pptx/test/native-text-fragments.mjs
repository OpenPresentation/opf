import assert from 'node:assert/strict';
import test from 'node:test';
import {XMLParser} from 'fast-xml-parser';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {convert} from '@openpresentation/opf';
import {toPptx,fromPptx} from '../dist/index.js';
import {planNativeTextFragments,createNativeTextFragments,NATIVE_FRAGMENT_TAG,adoptNativeFragmentGroups,nativeFragmentPropertiesHash} from '../dist/native-text-fragments.js';
import {decodeTextTag,encodeTextTag} from '../dist/code-provenance.js';

const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const attr=(xml,key)=>new RegExp('\\b'+key+'="([^"]*)"').exec(xml)?.[1];
const shapes=xml=>[...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match=>({xml:match[0],name:attr(/<p:cNvPr\b[^>]*>/.exec(match[0])?.[0]??'','name'),text:[...match[0].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match=>String(parser.parse('<t>'+match[1]+'</t>').t??'')).join('')}));
const style={fontFamily:'Aptos',fontWeight:400,lang:'ar-SA'};
const fragment=(text,runIndex,x)=>({text,runIndex,start:0,end:text.length,x,width:text.length*8,fontSize:37,baselineShift:0,style,run:{text,language:'ar-SA'}});
const line={fragments:[fragment('البند: ',0,0),fragment('Bonjour 1',1,56)],width:128,y:0,baseline:37,height:45.14};
const request={rtl:true,originX:200,measurement:{measure:text=>text.length*8},profile:language=>({script:language==='ar-SA'?'Arab':'Latn'})};

test('source planner partitions word and number advances without changing UTF16 or source styles',()=>{
 const input=structuredClone(line),plan=planNativeTextFragments(line,request);
 assert(plan);assert.deepEqual(line,input);
 assert.equal(plan.text,'البند: Bonjour 1');assert.equal(plan.length,16);assert.equal(plan.prefix,7);
 assert.deepEqual(plan.members.map(({from,to,start,end,kind})=>({from,to,start,end,kind})),[{from:7,to:15,start:0,end:8,kind:'word'},{from:15,to:16,start:8,end:9,kind:'number'}]);
 assert.deepEqual(plan.members.map(({x,width})=>({x,width})),[{x:200,width:64},{x:264,width:8}]);
 for(const mutate of [value=>{value.fragments[1].kind='marker';},value=>{value.fragments[1].style.tracking=1;},value=>{value.fragments[1].baselineShift=-5;},value=>{value.fragments.push(fragment(' العربية',2,128));}]){
  const changed=structuredClone(line);mutate(changed);assert.equal(planNativeTextFragments(changed,request),undefined);
 }
 assert.equal(planNativeTextFragments(line,{...request,profile:()=>({script:'Hebr'})}),undefined);
 assert.equal(planNativeTextFragments(line,{...request,measurement:undefined}),undefined);
});

test('one original mixed fragment uses source-selected script intervals and refuses incompatible advances',()=>{
 const original=fragment('البند: Bonjour 1',0,0),mixed={...line,fragments:[original]},input=structuredClone(mixed),plan=planNativeTextFragments(mixed,request);
 assert(plan);assert.deepEqual(mixed,input);assert.equal(plan.prefix,7);
 assert.deepEqual(plan.source,[{run:0,start:0,end:16}]);
 assert.deepEqual(plan.members.map(({sourceRun,start,end,x,width})=>({sourceRun,start,end,x,width})),[{sourceRun:0,start:7,end:15,x:200,width:64},{sourceRun:0,start:15,end:16,x:264,width:8}]);
 const incompatible={measure:text=>text.length*8+(text==='Bonjour 1'?1:0)};
 assert.equal(planNativeTextFragments(mixed,{...request,measurement:incompatible}),undefined,'A script sum mismatch must not be fitted or rescaled');
 for(const mutate of [value=>{delete value.fragments[0].run.language;},value=>{value.fragments[0].width+=0.001;},value=>{value.fragments[0].run.text=value.fragments[0].text='البند: Bonjour ١';},value=>{value.fragments[0].run.text=value.fragments[0].text='البند: Bonjour ۱';}]){
  const candidate=structuredClone(mixed);mutate(candidate);assert.equal(planNativeTextFragments(candidate,request),undefined);
 }
 const whole=fragment('Item 1: Customers',0,0);assert.equal(planNativeTextFragments({...line,fragments:[whole],width:whole.width},{...request,rtl:false}),undefined,'Unobserved whole-ASCII LTR paragraphs remain outside this successor');
});

test('final native writer preserves full run/paragraph/carrier geometry and applies no Unicode control',()=>{
 const properties='<a:rPr lang="ar-SA" altLang="en-US" sz="2775"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="Aptos"/><a:cs typeface="Aptos"/><a:hlinkClick r:id="rLink"/></a:rPr>';
 const end='<a:endParaRPr lang="ar-SA" altLang="en-US" sz="2775" b="0" i="0"><a:latin typeface="Aptos"/><a:cs typeface="Aptos"/><a:extLst><a:ext uri="test-terminal-metadata"><unit value="retained"/></a:ext></a:extLst></a:endParaRPr>';
 const pPr='<a:pPr rtl="1" algn="r" marL="394654" indent="-394654"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc><a:buAutoNum type="arabicPeriod"/></a:pPr>';
 const xml='<p:sp><p:nvSpPr><p:cNvPr id="3" name="OPF list source line 0"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="548640" y="3627787"/><a:ext cx="11094720" cy="429959"/></a:xfrm></p:spPr><p:txBody><a:bodyPr rtlCol="0" wrap="none"/><a:lstStyle/><a:p>'+pPr+'<a:r>'+properties+'<a:t>البند: </a:t></a:r><a:r>'+properties+'<a:t>Bonjour 1</a:t></a:r>'+end+'</a:p></p:txBody></p:sp>';
 const writer=createNativeTextFragments(),groups=new Map();writer.remember(0,'OPF list source line 0',planNativeTextFragments(line,request));const output=writer.write(xml,0,groups),result=shapes(output);
 assert.deepEqual(result.map(shape=>shape.text),['البند: ','Bonjour ','1']);
 assert.equal(result.map(shape=>shape.text).join(''),'البند: Bonjour 1');assert(!/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(output));
 assert(result[0].xml.includes(pPr));assert(result[0].xml.includes('<a:off x="548640" y="3627787"/><a:ext cx="11094720" cy="429959"/>'));
 for(const member of result.slice(1)){assert(member.xml.includes(properties));assert.match(member.xml,/<a:pPr rtl="0" algn="l" marL="0" indent="0">/);assert(!member.xml.includes('<a:buAutoNum'));assert.match(member.xml,/y="3627787"/);assert.match(member.xml,/cy="429959"/);}
 for(const member of result){assert(member.xml.includes(end),'Exact original terminal properties and supported nested metadata survive every fragment');assert.equal((member.xml.match(/<a:endParaRPr\b/g)??[]).length,1);}
 for(const extra of ['<a:extLst/>',end]){const diagnostics=[],refusing=createNativeTextFragments(diagnostic=>diagnostics.push(diagnostic));refusing.remember(0,'OPF list source line 0',planNativeTextFragments(line,request));const unsupported=xml.replace(end,end+extra);assert.equal(refusing.write(unsupported,0,new Map()),unsupported,'Unsupported extra paragraph children must refuse rather than disappear');assert.equal(refusing.records.size,0);assert(diagnostics.some(diagnostic=>diagnostic.code==='native-fragment-unavailable'));}
 assert.equal(writer.records.size,3);assert.deepEqual([...writer.records.values()].map(({index,from,to})=>({index,from,to})),[{index:0,from:0,to:7},{index:1,from:7,to:15},{index:2,from:15,to:16}]);
});

const source={language:'ar-SA',slides:[{title:'لغة عربية صريحة',items:[['البند: ',{text:'Bonjour 1',language:'ar-SA'}]],numbering:'arabic'}]};
async function actual(document=source,svg=false){
 const {loadFonts}=await import('@openpresentation/opf-render/fonts-node');const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:document});
 try{const bytes=await toPptx(document,{fonts}),zip=unzipSync(new Uint8Array(bytes)),preview=svg?await convert(document,{format:'svg',fonts}):undefined;return {zip,bytes,xml:strFromU8(zip['ppt/slides/slide1.xml']),svg:preview?strFromU8(preview.files[0].bytes):undefined};}finally{fonts.dispose?.();}
}
const mutateTag=(zip,mutate)=>{
 const result=Object.fromEntries(Object.entries(zip).map(([name,bytes])=>[name,new Uint8Array(bytes)]));let changed=0;
 for(const name of Object.keys(result).filter(name=>/^ppt\/tags\//.test(name))){let xml=strFromU8(result[name]);xml=xml.replace(new RegExp('(<p:tag name="'+NATIVE_FRAGMENT_TAG+'" val=")([^"]+)("\\/>)','g'),(whole,before,value,after)=>{const data=decodeTextTag(value),next=mutate(data);if(next===undefined)return whole;changed++;return before+encodeTextTag(next)+after;});result[name]=strToU8(xml);}
 assert(changed>0);return result;
};

test('actual measured public export preserves source, automatic numbering and full final Latin/CS/proofing',async()=>{
 const result=await actual(source,true),all=shapes(result.xml);assert.equal(all.length,4,'heading plus original carrier and two editable native members');
 assert.deepEqual(all.map(shape=>shape.text),['لغة عربية صريحة','البند: ','Bonjour ','1']);assert.equal(all.map(shape=>shape.text).join('').length,31);
 assert.equal((result.xml.match(/<a:buAutoNum\b/g)??[]).length,1);
 for(const member of all.filter(shape=>shape.name.startsWith('OPF native fragment '))){assert.match(member.xml,/<a:latin\b[^>]*typeface="Aptos"/);assert.match(member.xml,/<a:cs\b[^>]*typeface="Aptos"/);assert.match(member.xml,/lang="ar-SA" altLang="en-US" sz="2775"/);assert(!member.xml.includes('<a:buAutoNum'));}
 const preview=[...result.svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].find(match=>match[2].includes('Bonjour'));
 assert(preview,'Actual public SVG retains the same source Latin phrase');
 const members=all.filter(shape=>shape.name.startsWith('OPF native fragment ')),carrier=all.find(shape=>shape.name.startsWith('OPF list ')),frame=xml=>{const match=/<a:xfrm><a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/><\/a:xfrm>/.exec(xml);assert(match);return match.slice(1).map(Number);};
 const [word,digit]=members.map(member=>frame(member.xml)),original=frame(carrier.xml);
 assert.equal(Number((word[0]/9525).toFixed(3)),Number(attr(preview[1],'x')),'Native member starts at the unchanged actual SVG measured Latin origin on its existing three-decimal grid');
 assert.equal(word[0]+word[2],digit[0],'Measured word advance, including its source space, reaches the digit with no fit or guessed gap');
 for(const member of [word,digit]){assert.equal(member[1],original[1]);assert.equal(member[3],original[3]);assert(member[0]>=original[0]&&member[0]+member[2]<=original[0]+original[2]);}
 assert.deepEqual(await fromPptx(result.bytes),source,'Current native members, not old source words, reconstruct exact authored rich boundary');
});

test('actual native edits of word/digit length and style win over original source',async()=>{
 const result=await actual(),zip={...result.zip},member=shapes(result.xml).find(shape=>shape.text==='1');
 const changed=member.xml.replace('<a:t>1</a:t>','<a:t>234</a:t>').replace(/<a:rPr\b/,'<a:rPr b="1"');zip['ppt/slides/slide1.xml']=strToU8(result.xml.replace(member.xml,changed));
 const diagnostics=[],imported=await fromPptx(zipSync(zip),{onDiagnostic:diagnostic=>diagnostics.push(diagnostic)});
 const text=JSON.stringify(imported);assert(text.includes('234'));assert(!text.includes('Bonjour 1'));assert(text.includes('"bold":true'));assert(diagnostics.some(diagnostic=>diagnostic.code==='native-fragment-reflow'));
});

test('ambiguous or absent fragment membership retains current shapes and never restores old words',async()=>{
 const result=await actual();
 for(const [name,mutate]of [['bad count',data=>({...data,count:99})],['duplicate logical index',data=>({...data,index:0})],['foreign shape ID',data=>({...data,id:data.id+1000})],['unknown key',data=>({...data,foreign:true})],['overlap',data=>data.index===2?{...data,from:0}:undefined]]){
  const diagnostics=[],zip=mutateTag(result.zip,mutate),doc=await fromPptx(zipSync(zip),{onDiagnostic:diagnostic=>diagnostics.push(diagnostic)});
  const text=JSON.stringify(doc);assert(text.includes('Bonjour'),name);assert(text.includes('1'),name);assert(diagnostics.some(diagnostic=>diagnostic.code==='invalid-native-fragments'),name);
 }
});


test('missing/plain planner inputs, inherited proofing and nonexact measured advances never activate fragments',()=>{
 for(const candidate of [null,{}, {...line,fragments:[null]}, {...line,fragments:[{text:'Bonjour 1'}]}])assert.equal(planNativeTextFragments(candidate,request),undefined);
 for(const mutate of [value=>{delete value.fragments[1].run.language;},value=>{value.fragments[1].run.language='en-US';},value=>{value.fragments[1].width+=0.001;},value=>{value.fragments[1].start=-1;}]){
  const candidate=structuredClone(line);mutate(candidate);assert.equal(planNativeTextFragments(candidate,request),undefined);
 }
 assert.equal(planNativeTextFragments(line,{...request,rtl:false}),undefined);
 const alone={...line,fragments:[fragment('Bonjour 1',0,0)]};assert.equal(planNativeTextFragments(alone,request),undefined,'A whole LTR paragraph must not gain an empty automatic-number carrier');
});

test('carrier-conversion refusal or exception commits no consumption',()=>{
 const member={text:'current'},carrier={text:'current carrier'},group={carrier,shapes:[carrier,member],paragraphs:[{text:'current carrier current'}]};
 for(const convert of [()=>undefined,()=>{throw Error('Cannot convert carrier');}]){
  const diagnostics=[],adopted=adoptNativeFragmentGroups([group],convert,diagnostic=>diagnostics.push(diagnostic));assert.equal(adopted.items.length,0);assert.equal(adopted.consumed.size,0);assert.equal(diagnostics[0].code,'invalid-native-fragments');assert.equal(member.text,'current');
 }
 const item={current:true},accepted=adoptNativeFragmentGroups([group],()=>item);assert.deepEqual(accepted.items,[item]);assert.deepEqual([...accepted.consumed],[carrier,member]);
});

test('actual inherited-language and heading ownership stay on their existing measured paths',async()=>{
 const inherited={language:'ar-SA',slides:[{title:'عنوان',items:[['البند: ','Bonjour 1']],numbering:'arabic'}]},redundant=structuredClone(inherited);
 redundant.slides[0].items[0][1]={text:'Bonjour 1'};
 // Focus01's actual nonfragmented public export/import retained this existing
 // canonicalization: an object with only text imports as its scalar string.
 const heading={slides:[{title:[{text:'Bonjour 1',language:'ar-SA'}],text:'Body'}]},results=[];
 for(const [candidate,expected] of [[inherited,inherited],[redundant,inherited],[heading,heading]]){
  const result=await actual(candidate);assert(!result.xml.includes('OPF native fragment '));assert(!Object.keys(result.zip).some(name=>/^ppt\/tags\//.test(name)&&strFromU8(result.zip[name]).includes(NATIVE_FRAGMENT_TAG)));assert.deepEqual(await fromPptx(result.bytes),expected);results.push(result.xml);
 }
 assert.equal(results[0],results[1],'Inherited scalar and redundant rich spelling retain byte-identical native slide XML');
});

test('actual overlapping ownership, deleted member and reused native identity refuse complete group assembly',async()=>{
 const result=await actual(),digit=shapes(result.xml).find(shape=>shape.text==='1');
 for(const [name,change]of [
  ['missing digit',xml=>xml.replace(digit.xml,'')],
  ['duplicate native ID',xml=>xml.replace('</p:spTree>',digit.xml+'</p:spTree>')],
 ]){
  const zip={...result.zip};zip['ppt/slides/slide1.xml']=strToU8(change(result.xml));const diagnostics=[],doc=await fromPptx(zipSync(zip),{onDiagnostic:diagnostic=>diagnostics.push(diagnostic)});assert(JSON.stringify(doc).includes('Bonjour'),name);assert(diagnostics.some(diagnostic=>diagnostic.code==='invalid-native-fragments'),name);if(name==='missing digit')assert(!JSON.stringify(doc).includes('Bonjour 1'),'Deleted digit cannot reappear from source metadata');
 }
 const overlap={...result.zip};let edited=false;
 for(const name of Object.keys(overlap).filter(name=>/^ppt\/tags\//.test(name))){const xml=strFromU8(overlap[name]);if(!edited&&xml.includes(NATIVE_FRAGMENT_TAG)){overlap[name]=strToU8(xml.replace('</p:tagLst>','<p:tag name="OPF_PLAIN_TEXT_V1" val="7B7D"/></p:tagLst>'));edited=true;}}
 assert(edited);const diagnostics=[];await fromPptx(zipSync(overlap),{onDiagnostic:diagnostic=>diagnostics.push(diagnostic)});assert(diagnostics.some(diagnostic=>diagnostic.code==='invalid-native-fragments'));
});


test('different authored runs with identical current styles never merge across source ownership',async()=>{
 const document={language:'ar-SA',slides:[{title:'عنوان',items:[['البند: ',{text:'Bonjour 1',language:'ar-SA'},{text:'Welcome 2',language:'ar-SA'}]],numbering:'arabic'}]};
 const result=await actual(document);assert.equal(shapes(result.xml).length,6,'carrier plus four source-owned word/number members and heading');assert.deepEqual(await fromPptx(result.bytes),document,'Only generated members of the same authored run may coalesce');
});

test('current property and run-boundary divergence disables same-source generated-member coalescing',async()=>{
 const result=await actual(),digit=shapes(result.xml).find(shape=>shape.text==='1');
 for(const [name,change,check]of [
  ['font',xml=>xml.replace('<a:latin typeface="Aptos"','<a:latin typeface="Georgia"'),doc=>assert(JSON.stringify(doc).includes('Georgia'))],
  ['proofing',xml=>xml.replace('lang="ar-SA"','lang="fr-FR"'),doc=>assert(JSON.stringify(doc).includes('fr-FR'))],
  ['explicit native run boundary',xml=>xml.replace(/(<a:r>[\s\S]*?<a:t>)1(<\/a:t><\/a:r>)/,(_match,before,after)=>before+'2'+after+before+'3'+after),doc=>assert(doc.slides[0].items[0].map(run=>typeof run==='string'?run:run.text).join('').includes('Bonjour 23'))],
 ]){
  const next=change(digit.xml);assert.notEqual(next,digit.xml,name);const zip={...result.zip};zip['ppt/slides/slide1.xml']=strToU8(result.xml.replace(digit.xml,next));const diagnostics=[],doc=await fromPptx(zipSync(zip),{onDiagnostic:diagnostic=>diagnostics.push(diagnostic)});check(doc);assert(diagnostics.some(diagnostic=>diagnostic.code==='native-fragment-reflow'),name);
  const values=doc.slides[0].items[0];assert(Array.isArray(values));assert(values.some(run=>typeof run==='object'&&run.text==='Bonjour '),name+' must retain the current member boundary instead of replaying one old authored run');
 }
});


test('actual public unfragmented paragraph-end bytes survive carrier and word/digit export',async()=>{
 const before=unzipSync(new Uint8Array(await toPptx(source))),original=shapes(strFromU8(before['ppt/slides/slide1.xml'])).find(shape=>shape.name.startsWith('OPF list '));
 assert(original);assert.equal(shapes(strFromU8(before['ppt/slides/slide1.xml'])).length,2,'Optional-renderer unfragmented path remains the original two shapes');
 const end=/<a:endParaRPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:endParaRPr>)/.exec(original.xml)?.[0];assert(end,'Actual vendored public writer emits terminal properties');
 assert.match(end,/lang="ar-SA"/);
 const after=await actual(),members=shapes(after.xml).filter(shape=>shape.name.startsWith('OPF list ')||shape.name.startsWith('OPF native fragment '));assert.equal(members.length,3);
 for(const member of members)assert.equal(/<a:endParaRPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:endParaRPr>)/.exec(member.xml)?.[0],end,'Actual source terminal bytes, including any written size/style/font/language, stay exact');
 assert.deepEqual(await fromPptx(after.bytes),source);
});

test('property evidence tolerates saved xml:space and attribute serialization but retains real style/boundary changes',()=>{
 const body='<p:sp><p:txBody><a:bodyPr rtlCol="0" wrap="none"/><a:lstStyle/><a:p><a:pPr algn="l" rtl="0"/><a:r><a:rPr lang="ar-SA" sz="2775"><a:latin typeface="Aptos"/></a:rPr><a:t>Bonjour </a:t></a:r><a:endParaRPr lang="ar-SA" sz="2775"/></a:p></p:txBody></p:sp>',binding={group:'unit',index:1},expected=nativeFragmentPropertiesHash(body,binding);
 assert(expected);
 const saved=body.replace('rtlCol="0" wrap="none"','wrap="none" rtlCol="0"').replace('lang="ar-SA" sz="2775"','sz="2775" lang="ar-SA"').replace('<a:t>Bonjour </a:t>',"<a:t xml:space='preserve'>Edited longer 234 </a:t>");
 assert.equal(nativeFragmentPropertiesHash(saved,binding),expected,'Saved preserved-space spelling and changed editable text do not become a property edit');
 assert.equal(nativeFragmentPropertiesHash(body.replace('<a:t>Bonjour </a:t>','<a:t xml:space="preserve"/>'),binding),expected,'Clearing native text keeps property evidence without restoring old text');
 for(const mutate of [
  xml=>xml.replace('lang="ar-SA"','lang="fr-FR"'),
  xml=>xml.replace('typeface="Aptos"','typeface="Georgia"'),
  xml=>xml.replace('<a:rPr ','<a:rPr b="1" '),
  xml=>xml.replace('<a:endParaRPr lang="ar-SA" sz="2775"','<a:endParaRPr lang="ar-SA" sz="1800"'),
 ]){
  const changed=mutate(saved);assert.notEqual(changed,saved);assert.notEqual(nativeFragmentPropertiesHash(changed,binding),expected,'Real font/proofing/bold/terminal-size changes stay significant');
 }
 const newBoundary=body.replace('</a:r>','</a:r><a:r><a:rPr lang="ar-SA" sz="2775"><a:latin typeface="Aptos"/></a:rPr><a:t>1</a:t></a:r>');assert.notEqual(nativeFragmentPropertiesHash(newBoundary,binding),expected);
 assert.notEqual(nativeFragmentPropertiesHash(body.replace('<a:t>','<a:t xml:space="default">'),binding),expected,'Only preserve is the harmless saved attribute normalization');
 const metadata=body.replace('</a:rPr>','<a:extLst><a:ext uri="text-metadata"><a:t>Metadata A</a:t></a:ext></a:extLst></a:rPr>');assert.notEqual(nativeFragmentPropertiesHash(metadata.replace('Metadata A','Metadata B'),binding),nativeFragmentPropertiesHash(metadata,binding),'Text-like extension data is a property, not editable run text');
});
