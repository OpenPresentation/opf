import {XMLParser} from 'fast-xml-parser';
import {resolveScriptFonts} from '@openpresentation/opf/composition';
import {attachTextTags,decodeTextTag,nativeTextHash} from './code-provenance.js';

export const NATIVE_LANGUAGE_TAG='OPF_NATIVE_LANGUAGE_V1';
const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const ordered=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false,preserveOrder:true});
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key===':@'?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a<b?-1:a>b?1:0)):canonical(item)])):value;
export const nativeLatinParagraphFingerprint=(value,binding)=>nativeTextHash(JSON.stringify([canonical(ordered.parse(value)),binding]));
const slotOwnedName=value=>/^OPF (?:list|text|heading|native body) /.test(value);
const runPattern=/<a:r>([\s\S]*?)<a:t>([\s\S]*?)<\/a:t><\/a:r>/g;
const escapeXml=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const decoder=new TextDecoder('utf-8',{fatal:true}),encoder=new TextEncoder();
const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const attribute=(value,name)=>new RegExp('\\s'+name+'="([^"]*)"').exec(value)?.[1];
const decode=value=>String(parser.parse('<t>'+value+'</t>').t??'');
const paragraphText=value=>[...value.matchAll(/<a:t>([^<]*)<\/a:t>|<a:br\b/g)].map(m=>m[1]===undefined?'\n':decode(m[1])).join('');
const ownedName=value=>/^OPF (?:list|text) /.test(value);
const rtlTags=new Map();
const rtlLanguage=value=>{
 if(!rtlTags.has(value)){let rtl=false;try{rtl=resolveScriptFonts({language:value}).rtl===true;}catch{/* Unknown native tags remain observed. */}rtlTags.set(value,rtl);}
 return rtlTags.get(value);
};
export const latinNumericText=value=>{
 if(typeof value!=='string')return false;
 // Normalize only the eligibility probe; native/source characters stay exact.
 const normalized=value.normalize('NFC');
 return /\p{Script=Latin}/u.test(normalized)&&/[0-9]/.test(normalized)&&/^[\p{Script=Latin}0-9\p{P}\p{S}\p{Z}]*$/u.test(normalized);
};
const pairBase=properties=>attribute(properties,'lang')==='en-US'&&attribute(properties,'altLang')!=='en-US'&&rtlLanguage(attribute(properties,'altLang'))?attribute(properties,'altLang'):undefined;

// Only inherited proofing on measured body/list shapes is adapted. Explicit
// run languages have altLang already, including an explicit choice of the base.
export function protectNativeLatinText(xml,base){
 return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,shape=>{
  const name=attribute(shape.match(/<p:cNvPr\b[^>]*>/)?.[0]??'','name');
  if(!ownedName(name??''))return shape;
  return shape.replace(/<a:p>[\s\S]*?<\/a:p>/g,paragraph=>{
   if(attribute(paragraph.match(/<a:pPr\b[^>]*>/)?.[0]??'','rtl')!=='0'||!latinNumericText(paragraphText(paragraph)))return paragraph;
   return paragraph.replace(/<a:rPr\b[^>]*>/g,properties=>attribute(properties,'altLang')!==undefined?properties:properties.replace(/\slang="[^"]*"/,' lang="en-US" altLang="'+base+'"'));
  });
 });
}

export function attachNativeLanguageTags(entries,slotGroups=new Map()){
 const records=new Map();
 for(const path of Object.keys(entries).filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p))){
  const xml=decoder.decode(entries[path]);
  for(const [shape]of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)){
   const name=attribute(shape.match(/<p:cNvPr\b[^>]*>/)?.[0]??'','name');
   const slots=slotGroups.get(decode(name??'')),slideIndex=Number(/slide(\d+)\.xml$/.exec(path)?.[1])-1;
   const validSlots=slots?.slideIndex===slideIndex&&slotOwnedName(decode(name??''))?slots.paragraphs:undefined;
   if(!ownedName(name??'')&&!validSlots?.length)continue;
   const paragraphs=[];
   for(const [index,match]of [...shape.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)].entries()){
    const text=paragraphText(match[0]);
    const bases=[...new Set([...match[0].matchAll(/<a:rPr\b[^>]*>/g)].map(([p])=>pairBase(p)).filter(Boolean))];
    if(bases.length===1&&latinNumericText(text))paragraphs.push({index,text,base:bases[0]});
   }
   if(paragraphs.length||validSlots?.length)records.set(name,{v:1,name:decode(name),paragraphs,...(validSlots?.length?{latinSlots:validSlots}:{})});
  }
 }
 attachTextTags(entries,records,NATIVE_LANGUAGE_TAG,'opfNativeLanguage','automatic native language');
}

// Return a read view only: existing native/provenance fingerprint checks must
// retain the original ZIP parts. A pair by itself never erases foreign language.
export function nativeLanguageReadView(entries,parseRelationships,report=()=>{}){
 const result=new Map();
 for(const path of Object.keys(entries).filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p))){
  const xml=decoder.decode(entries[path]),rels=parseRelationships(entries,path);
  const normalized=xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,shape=>{
   const parsed=parser.parse(shape)['p:sp'],tags=[];
   for(const link of array(parsed?.['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])){
    const rel=rels.get(link['r:id']);
    if(rel?.type!==REL||rel.targetMode==='External'||!entries[rel.path])continue;
    try{tags.push(...array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag']).filter(t=>String(t.name).toUpperCase()===NATIVE_LANGUAGE_TAG));}catch{/* Unreadable records never authorize normalization. */}
   }
   const hasPair=[...shape.matchAll(/<a:rPr\b[^>]*>/g)].some(([p])=>pairBase(p));
   if(!tags.length){if(hasPair)report({code:'native-language-unowned',path,message:'Native English proofing with an alternate RTL language has no automatic-language ownership proof; its current language is retained.'});return shape;}
   try{
    if(tags.length!==1)throw Error('Duplicate automatic-language records.');
    const record=decodeTextTag(tags[0].val),name=parsed?.['p:nvSpPr']?.['p:cNvPr']?.name;
    if(record?.v!==1||record.name!==name||!Array.isArray(record.paragraphs)||record.paragraphs.length>1000||(!record.paragraphs.length&&!record.latinSlots?.length)||(record.paragraphs.length&&!ownedName(name??''))||(record.latinSlots!==undefined&&(!slotOwnedName(name??'')||!Array.isArray(record.latinSlots)||!record.latinSlots.length||record.latinSlots.length>1000)))throw Error('Invalid automatic-language identity.');
    const paragraphs=[...shape.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)].map(m=>m[0]),seen=new Set();
    for(const group of record.latinSlots??[]){
     if(!group||typeof group!=='object'||Object.keys(group).some(key=>!['index','count','hash','spans'].includes(key))||!Number.isSafeInteger(group.index)||group.index<0||group.index>=paragraphs.length||seen.has(group.index)||!Number.isSafeInteger(group.count)||group.count<2||group.count>10000||typeof group.hash!=='string'||!/^[0-9a-f]{14}$/.test(group.hash)||!Array.isArray(group.spans)||!group.spans.length||group.spans.length>1000)throw Error('Invalid native Latin source spans.');
     seen.add(group.index);
     const current=paragraphs[group.index],runs=[...current.matchAll(runPattern)];
     if(runs.length!==group.count||nativeLatinParagraphFingerprint(current,{name,index:group.index,count:group.count,spans:group.spans})!==group.hash)throw Error('Current native Latin span text, properties or structure changed.');
     const replacements=new Map();let lastEnd=0;
     for(const span of group.spans){
      if(!span||typeof span!=='object'||Object.keys(span).some(key=>!['start','count'].includes(key))||!Number.isSafeInteger(span.start)||!Number.isSafeInteger(span.count)||span.start<lastEnd||span.count<2||span.start+span.count>runs.length)throw Error('Invalid native Latin span boundary.');
      const members=runs.slice(span.start,span.start+span.count),style=members[0][1].replace(/<a:cs\b[^>]*\/>/g,'');
      if(members.some(run=>run[1].replace(/<a:cs\b[^>]*\/>/g,'')!==style))throw Error('Current native Latin span styles differ.');
      replacements.set(span.start,{count:span.count,xml:'<a:r>'+members[0][1]+'<a:t>'+escapeXml(members.map(run=>decode(run[2])).join(''))+'</a:t></a:r>'});lastEnd=span.start+span.count;
     }
     let index=0,skipUntil=0;paragraphs[group.index]=current.replace(runPattern,whole=>{const position=index++;if(position<skipUntil)return '';const replacement=replacements.get(position);if(!replacement)return whole;skipUntil=position+replacement.count;return replacement.xml;});
    }
    seen.clear();
    for(const p of record.paragraphs){
     if(!Number.isSafeInteger(p.index)||p.index<0||p.index>=paragraphs.length||seen.has(p.index)||typeof p.text!=='string'||p.text.length>16000||!latinNumericText(p.text)||!rtlLanguage(p.base))throw Error('Invalid automatic-language paragraph.');
     seen.add(p.index);
     const current=paragraphs[p.index];
     if(paragraphText(current)!==p.text||attribute(current.match(/<a:pPr\b[^>]*>/)?.[0]??'','rtl')!=='0'||![...current.matchAll(/<a:rPr\b[^>]*>/g)].some(([r])=>pairBase(r)===p.base))throw Error('Current text, direction or proofing language changed.');
     paragraphs[p.index]=current.replace(/<a:rPr\b[^>]*>/g,r=>pairBase(r)===p.base?r.replace(/\slang="en-US"/,' lang="'+p.base+'"').replace(/\saltLang="[^"]*"/,''):r);
    }
    let index=0;return shape.replace(/<a:p>[\s\S]*?<\/a:p>/g,()=>paragraphs[index++]);
   }catch(error){report({code:'native-language-reference-changed',path,message:error.message+' Current native proofing language is retained.'});return shape;}
  });
  if(normalized!==xml)result.set(path,encoder.encode(normalized));
 }
 return result;
}
// This semantic marker owns no body content. It must not disable the ordinary
// rich reader as content-recovery tags do, even when its proof is stale.
export function onlyNativeLanguageTags(shape,relationships,entries){
 const links=array(shape?.['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags']);
 return links.length>0&&links.every(link=>{
  const rel=relationships.get(link['r:id']);
  if(rel?.type!==REL||rel.targetMode==='External'||!entries[rel.path])return false;
  try{const tags=array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag']);return tags.length>0&&tags.every(t=>String(t.name).toUpperCase()===NATIVE_LANGUAGE_TAG);}catch{return false;}
 });
}