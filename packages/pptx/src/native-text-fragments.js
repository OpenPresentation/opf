import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {numberRanges,textWidthMeasurer,paragraphDirection,itemizeScripts} from '@openpresentation/opf/composition';
import {nativeLatinRanges} from './native-latin-slots.js';
import {attachTextTags,decodeTextTag,groupUnchanged,nativeTextHash} from './code-provenance.js';

export const NATIVE_FRAGMENT_TAG='OPF_NATIVE_FRAGMENTS_V1';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const ordered=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false,preserveOrder:true});
const decoder=new TextDecoder('utf-8',{fatal:true});
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key===':@'?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a<b?-1:a>b?1:0)):canonical(item)])):value;
const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const escapeXml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const decode=value=>String(parser.parse('<t>'+value+'</t>').t??'');
const runs=/<a:r>(<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*[^/]>[\s\S]*?<\/a:rPr>)<a:t>([^<]*)<\/a:t><\/a:r>/g;
// Text edits may change length; current property/boundary edits disable source-run joining.
const propertyTree=shape=>{
 const body=/<p:txBody>[\s\S]*?<\/p:txBody>/.exec(shape)?.[0];
 if(!body)return;
 // Normalize direct editable run text only, never text-like extension metadata.
 // A preserved-space saved spelling does not change run properties; every
 // other text attribute and every run/terminal property stays significant.
 const tree=ordered.parse(body);
 for(const root of tree)for(const paragraph of root['p:txBody']??[])for(const run of paragraph['a:p']??[])for(const text of run['a:r']??[]){
  if(!Object.hasOwn(text,'a:t'))continue;
  text['a:t']=[];
  if(text[':@']?.['xml:space']==='preserve'){
   delete text[':@']['xml:space'];if(!Object.keys(text[':@']).length)delete text[':@'];
  }
 }
 return tree;
};
const propertiesHash=(shape,binding)=>{const tree=propertyTree(shape);return tree&&nativeTextHash(JSON.stringify([canonical(tree),binding]));};
export const nativeFragmentPropertiesHash=propertiesHash;

// Planner-only: not connected to any writer, tag, reader, or scalar restoration.
// An original scalar can acquire several measured runs (for example a bold
// colon label). Their local run offsets are NOT authored source offsets.
// Native properties are retained as exact ordered slices, including CS fonts;
// no property equivalence or permission to restore a scalar is inferred here.
export function planNativeUnicodeIntervals(input){
 const refuse=reason=>({status:'refused',reason});
 if(!input||typeof input!=='object'||Array.isArray(input))return refuse('unsupported-input');
 const {source,from,to,line,originX,rtl,nativeRuns,measurement,profile}=input;
 if(typeof source!=='string'||!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||to<=from||to>source.length||rtl!==false||!Number.isFinite(originX)||!line||!Array.isArray(line.fragments)||!line.fragments.length||!Number.isFinite(line.width)||line.width<=0||!measurement?.measure||typeof profile!=='function'||!Array.isArray(nativeRuns)||!nativeRuns.length)return refuse('unsupported-input');
 const atBoundary=index=>index===0||index===source.length||!(/[\uD800-\uDBFF]/.test(source[index-1])&&/[\uDC00-\uDFFF]/.test(source[index]));
 if(!source.isWellFormed()||!atBoundary(from)||!atBoundary(to))return refuse('source-boundary');
 const text=source.slice(from,to);
 if(/[\r\n\u2028\u2029\p{Default_Ignorable_Code_Point}]/u.test(text))return refuse('unsupported-text');
 if(line.fragments.some(fragment=>!fragment||typeof fragment.text!=='string')||line.fragments.map(fragment=>fragment.text).join('')!==text||nativeRuns.some(run=>!run||typeof run.text!=='string'||!run.text||typeof run.properties!=='string'||!/^<a:rPr\b/.test(run.properties))||nativeRuns.map(run=>run.text).join('')!==text)return refuse('current-text-mismatch');
 let nativeOffset=from;
 for(const run of nativeRuns){
  nativeOffset+=run.text.length;if(!atBoundary(nativeOffset))return refuse('native-boundary');
  if(XMLValidator.validate(run.properties)!==true)return refuse('native-properties');
  const tree=ordered.parse(run.properties);if(tree.length!==1||!Object.hasOwn(tree[0],'a:rPr'))return refuse('native-properties');
 }
 const nativeSlice=(start,end)=>{
  let offset=0;const slices=[];
  for(const run of nativeRuns){const a=Math.max(start,offset),b=Math.min(end,offset+run.text.length);if(b>a)slices.push({from:from+a,to:from+b,text:run.text.slice(a-offset,b-offset),properties:run.properties});offset+=run.text.length;}
  return slices;
 };
 const intervals=[];let offset=0,advance=0;
 for(const fragment of line.fragments){
  const {style,fontSize,width,x}=fragment;
  // Scalar/derived runs do not acquire an authored style.lang: the existing
  // profile resolver supplies their effective deck/slide language instead.
  if(fragment.kind!==undefined||fragment.baselineShift||!style||(style.lang!==undefined&&(typeof style.lang!=='string'||!style.lang))||style.tracking||style.caps||profile(style.lang)?.script!=='Arab'||!Number.isFinite(fontSize)||fontSize<=0||!Number.isFinite(width)||width<=0||!Number.isFinite(x)||Math.abs(x-advance)>1e-7)return refuse('unsupported-fragment');
  const measure=textWidthMeasurer(style,measurement),full=measure(fragment.text,fontSize);
  if(!Number.isFinite(full)||Math.abs(full-width)>1e-7)return refuse('measured-advance-mismatch');
  const scripts=itemizeScripts(fragment.text,profile(style.lang));let local=0,measured=0;
  for(const script of scripts){
   // Keep attached common punctuation/whitespace in its existing script slot.
   // This partitions script intervals, never individual glyphs or words.
   const numeric=script.role==='complexScript'&&script.script==='Arab'&&/\p{Decimal_Number}/u.test(script.text);
   if(!(numeric&&/^[\p{Decimal_Number}\p{Punctuation}\p{Separator}]+$/u.test(script.text))&&!(script.role==='latin'&&/^[\x20-\x7e]+$/.test(script.text)))return refuse('unsupported-script');
   const before=measure(fragment.text.slice(0,local),fontSize),part=measure(script.text,fontSize),right=measure(fragment.text.slice(0,local+script.text.length),fontSize);
   if(![before,part,right].every(Number.isFinite)||part<=0||Math.abs(before-measured)>1e-7||Math.abs(right-before-part)>1e-7)return refuse('nonadditive-script-advance');
   const start=offset+local,end=start+script.text.length;
   if(intervals.length>=64)return refuse('unsupported-member-count');
   intervals.push({from:from+start,to:from+end,text:script.text,script:script.script,role:script.role,numeric,x:originX+x+before,width:part,right:originX+x+right,fontSize,style:{...style},native:nativeSlice(start,end)});
   local+=script.text.length;measured+=part;
  }
  if(local!==fragment.text.length||Math.abs(measured-width)>1e-7)return refuse('incomplete-fragment');
  offset+=fragment.text.length;advance+=width;
 }
 if(offset!==text.length)return refuse('line-advance-mismatch');
 // Core may exclude hanging U+0020 from the alignment width while retaining
 // the complete fragment advance. SVG renderRichLines uses placed.x+x and
 // each FULL fragment.width for LTR lines. Preserve both widths; this is real
 // source whitespace outside the alignment interval, never extra padding.
 let hangingSpaceAdvance=0;
 if(Math.abs(advance-line.width)>1e-7){
  const spaces=/ +$/.exec(text)?.[0];if(!spaces)return refuse('line-advance-mismatch');
  const shown=text.length-spaces.length;let cursor=0,visibleAdvance=0;
  for(const fragment of line.fragments){
   const keep=Math.max(0,Math.min(fragment.text.length,shown-cursor)),measure=textWidthMeasurer(fragment.style,measurement);
   const visible=measure(fragment.text.slice(0,keep),fragment.fontSize),trailing=measure(fragment.text.slice(keep),fragment.fontSize);
   if(![visible,trailing].every(Number.isFinite)||visible<0||trailing<0||Math.abs(visible+trailing-fragment.width)>1e-7)return refuse('nonadditive-hanging-space');
   visibleAdvance+=visible;hangingSpaceAdvance+=trailing;cursor+=fragment.text.length;
  }
  if(hangingSpaceAdvance<=0||Math.abs(visibleAdvance-line.width)>1e-7||Math.abs(advance-line.width-hangingSpaceAdvance)>1e-7)return refuse('line-advance-mismatch');
 }
 const numeric=intervals.filter(interval=>interval.numeric);
 if(!numeric.length||intervals[0]?.role!=='latin'||!/[A-Za-z]/.test(intervals[0].text)||intervals.at(-1)?.role!=='latin'||!/[A-Za-z]/.test(intervals.at(-1).text))return refuse('unsupported-topology');
 return {status:'planned',from,to,text,originX,alignmentWidth:line.width,fullAdvance:advance,hangingSpaceAdvance,intervals};
}

const paragraphParts=paragraph=>{
 const content=paragraph.slice('<a:p>'.length,-'</a:p>'.length),properties=/^\s*(<a:pPr\b[^>]*\/>|<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>)/.exec(content);
 const body=content.slice(properties?.[0].length??0);let end=0,count=0;
 for(const match of body.matchAll(runs)){if(body.slice(end,match.index).trim())return;end=match.index+match[0].length;count++;}
 if(!count)return;
 const tail=body.slice(end);
 // CT_TextParagraph has one optional terminal endParaRPr. Preserve its exact
 // bytes (including font/size/language/extensions); refuse unknown siblings.
 if(tail.trim()){
  let parsed;try{parsed=parser.parse('<tail>'+tail.trim()+'</tail>').tail;}catch{return;}
  if(!parsed||typeof parsed!=='object'||Object.keys(parsed).length!==1||!Object.hasOwn(parsed,'a:endParaRPr')||Array.isArray(parsed['a:endParaRPr']))return;
 }
 return {properties:properties?.[1]??'',tail};
};
const propertyBinding=data=>Object.fromEntries(['v','group','count','length','source','index','name','id','from','to','role'].map(key=>[key,data[key]]));
const runKeys=new Set(['text','language','fontFamily','fontSize','bold','italic','underline','strikethrough','color','link']);
const relType='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';

// A rich fragment may contain both the Arabic carrier and its Latin suffix.
// Split only at ORIGINAL source-selected script boundaries. SVG scriptLine
// places these measured script intervals from the right; no prefix is treated
// as an LTR advance and no interval is fitted back to the full width.
const sourceFragments=(fragment,measurement,profile)=>{
 const {text,run,style,start,end,fontSize}=fragment;
 const ranges=nativeLatinRanges(run.text,style,profile(style.lang));
 const selected=ranges.map(([from,to])=>[Math.max(start,from),Math.min(end,to)]).filter(([from,to])=>to>from);
 if(selected.length!==1||selected[0][0]===start||selected[0][1]!==end||typeof run.language!=='string'||profile(run.language)?.script!=='Arab')return [fragment];
 const boundary=selected[0][0],prefix=text.slice(0,boundary-start),suffix=text.slice(boundary-start);
 if(paragraphDirection(prefix,'rtl')!=='rtl'||!/[\p{Script=Arabic}]/u.test(prefix)||!/^[\x20-\x7e]+$/.test(suffix)||!/[A-Za-z]/.test(suffix)||!/[0-9]/.test(suffix))return [fragment];
 const measure=textWidthMeasurer(style,measurement),full=measure(text,fontSize),before=measure(prefix,fontSize),after=measure(suffix,fontSize);
 if(![full,before,after].every(value=>Number.isFinite(value)&&value>0)||Math.abs(full-fragment.width)>1e-7||Math.abs(before+after-full)>1e-7)return;
 return [{...fragment,text:prefix,end:boundary,width:before},{...fragment,text:suffix,start:boundary,x:fragment.x+before,width:after}];
};

// This is a source partition, never a new bidi shaper. Unsupported layouts keep
// the existing measured line. The first supported topology is a carrier prefix
// followed by measured Latin word/number members under Arabic proofing. An
// explicitly Arabic-proofed, wholly ASCII LTR line may instead keep its first
// nonnumeric span as carrier and isolate numeric intervals from the WHOLE
// numeric-free suffix. This is not word or character layout.
export function planNativeTextFragments(line,{rtl,originX,measurement,profile}) {
 if(typeof rtl!=='boolean'||!line||!Array.isArray(line.fragments)||!line.fragments.length||!measurement?.measure||typeof profile!=='function'||!Number.isFinite(originX)||!Number.isFinite(line.width)||!Number.isFinite(line.baseline)||!Number.isFinite(line.height))return;
 if(!rtl&&line.fragments.length!==1)return;
 const members=[];let offset=0,selected=false,hasWord=false,hasNumber=false,priorRun=-1,priorEnd=0;
 for(const original of line.fragments){
  if(!original||typeof original!=='object')return;
  const {text,style,run,start,end}=original;
  if(typeof text!=='string'||!style||typeof style!=='object'||!run||typeof run!=='object'||!Number.isSafeInteger(original.runIndex)||original.runIndex<0||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||!Number.isFinite(original.x)||!Number.isFinite(original.fontSize)||original.fontSize<=0)return;
  if(original.kind||original.baselineShift||style.tracking||style.caps||Object.keys(run).some(key=>!runKeys.has(key)))return;
  if(typeof run.text!=='string'||run.text.slice(start,end)!==text||!Number.isFinite(original.width)||original.width<0)return;
  if(!rtl&&!/^[\x20-\x7e]+$/.test(run.text))return;
  if(original.runIndex<priorRun||(original.runIndex===priorRun&&start<priorEnd))return;
  priorRun=original.runIndex;priorEnd=end;
  const pieces=sourceFragments(original,measurement,profile);if(!pieces)return;
  for(const fragment of pieces){
  const {text,style,run,start,end}=fragment;
  const ranges=nativeLatinRanges(run.text,style,profile(style.lang));
  const chosen=typeof run.language==='string'&&profile(run.language)?.script==='Arab'&&ranges.some(([a,b])=>start>=a&&end<=b)&&/^[\x20-\x7e]+$/.test(text)&&/[A-Za-z]/.test(text)&&/[0-9]/.test(text);
  if(!chosen){if(selected)return;offset+=text.length;continue;}
  selected=true;
  // Core numberRanges intentionally selects signed quantities only. Physical
  // members must also separate bare ASCII numbers, the actual B07 discriminator.
  const numbers=[];
  for(const [from,to]of [...numberRanges(text),...[...text.matchAll(/[0-9]+(?:[.,:/'-][0-9]+)*/g)].map(match=>[match.index,match.index+match[0].length])].sort((a,b)=>a[0]-b[0]||b[1]-a[1])){
   const last=numbers.at(-1);if(last&&from<=last[1])last[1]=Math.max(last[1],to);else numbers.push([from,to]);
  }
  const cuts=[...new Set([0,text.length,...numbers.flat()])].sort((a,b)=>a-b);
  const measure=textWidthMeasurer(style,measurement),full=measure(text,fragment.fontSize);
  if(!Number.isFinite(full)||full<=0||Math.abs(full-fragment.width)>1e-7)return;
  const left=originX+(rtl?line.width-fragment.x-fragment.width:fragment.x);
  for(let i=0;i<cuts.length-1;i++){
   const from=cuts[i],to=cuts[i+1];if(to<=from)continue;
   const numeric=numbers.some(([a,b])=>from>=a&&to<=b),word=/[A-Za-z]/.test(text.slice(from,to));
   if(!numeric&&!word)return;
   hasWord ||= word;hasNumber ||= numeric;
   const x=left+measure(text.slice(0,from),fragment.fontSize);
   const right=left+measure(text.slice(0,to),fragment.fontSize);
   if(!Number.isFinite(x)||!Number.isFinite(right)||right<=x)return;
   members.push({from:offset+from,to:offset+to,x,right,width:right-x,sourceRun:fragment.runIndex,start:start+from,end:start+to,kind:numeric?'number':'word'});
  }
  offset+=text.length;
  }
 }
 if(!selected||!hasWord||!hasNumber||members.length<2||members.length>63)return;
 const whole=line.fragments.map(fragment=>fragment.text).join('');
 let prefix=members[0].from;
 if(!rtl){
  // Retain real nonempty source content in the numbered carrier. A trailing
  // numeric-free letter span is required by this bounded LTR topology; later
  // measured lines without a numeric interval stay byte-for-byte unchanged.
  if(members[0].kind!=='word'||members[0].from!==0||members.at(-1).kind!=='word'||members.length<3)return;
  prefix=members.shift().to;
 }else if(prefix===0||paragraphDirection(whole.slice(0,prefix),'rtl')!=='rtl'||!/[\p{Script=Arabic}]/u.test(whole.slice(0,prefix)))return;
 if(members.some((member,index)=>index&&member.from!==members[index-1].to)||members.at(-1).to!==offset)return;
 return {text:whole,length:offset,prefix,members,
  source:line.fragments.map(fragment=>({run:fragment.runIndex,start:fragment.start,end:fragment.end})),baseline:line.baseline,height:line.height};
}

const sliceRuns=(native,from,to)=>{
 let offset=0;const result=[];
 for(const entry of native){const start=Math.max(from,offset),end=Math.min(to,offset+entry.text.length);
  if(end>start)result.push('<a:r>'+entry.properties+'<a:t>'+escapeXml(entry.text.slice(start-offset,end-offset))+'</a:t></a:r>');
  offset+=entry.text.length;
 }
 return result.join('');
};

const memberParagraphProperties=pPr=>'<a:pPr rtl="0" algn="l" marL="0" indent="0">'+(/<a:lnSpc>[\s\S]*?<\/a:lnSpc>/.exec(pPr)?.[0]??'')+'<a:buNone/></a:pPr>';
// This comparison is used ONLY beside intact complete property receipts. It
// reverses the exact generated paragraph/body direction and W03's direct CS
// slot difference; every run/default/end/extension property remains compared.
// There is no normalization of current edited native properties or boundaries.
const ownedJoinProperties=(shape,carrier,isCarrier)=>{
 const tree=propertyTree(shape),base=propertyTree(carrier);if(!tree||!base)return;
 const children=tree[0]?.['p:txBody'],original=base[0]?.['p:txBody'];
 if(!Array.isArray(children)||!Array.isArray(original))return;
 const one=(nodes,key)=>{const found=nodes.filter(node=>Object.hasOwn(node,key));return found.length===1?found[0]:undefined;};
 const paragraph=one(children,'a:p')?.['a:p'],baseParagraph=one(original,'a:p')?.['a:p'];
 if(!Array.isArray(paragraph)||!Array.isArray(baseParagraph))return;
 const body=one(children,'a:bodyPr'),baseBody=one(original,'a:bodyPr');
 if(!body||!baseBody)return;
 if(!isCarrier){
  const pPr=/<a:pPr\b[^>]*\/>|<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>/.exec(carrier)?.[0]??'';
  const expected=ordered.parse(memberParagraphProperties(pPr))[0],actual=one(paragraph,'a:pPr');
  if(JSON.stringify(canonical(actual))!==JSON.stringify(canonical(expected)))return;
  if(baseBody[':@']?.rtlCol!==undefined&&body[':@']?.rtlCol!=='0')return;
  if(baseBody[':@']?.rtlCol===undefined&&body[':@']?.rtlCol!==undefined)return;
 }
 if(body[':@']){delete body[':@'].rtlCol;if(!Object.keys(body[':@']).length)delete body[':@'];}
 const native=paragraph.filter(node=>Object.hasOwn(node,'a:r'));if(native.length!==1)return;
 const properties=one(native[0]['a:r'],'a:rPr')?.['a:rPr'];if(!Array.isArray(properties))return;
 const slots=properties.filter(node=>Object.hasOwn(node,'a:cs'));
 if(slots.length>1||slots.some(node=>node['a:cs'].length||!node[':@']?.typeface||Object.keys(node[':@']).some(key=>key!=='typeface')))return;
 if(!isCarrier&&slots[0]?.[':@']?.typeface!==one(properties,'a:latin')?.[':@']?.typeface)return;
 native[0]['a:r'].find(node=>Object.hasOwn(node,'a:rPr'))['a:rPr']=properties.filter(node=>!Object.hasOwn(node,'a:cs'));
 children.find(node=>Object.hasOwn(node,'a:p'))['a:p']=paragraph.filter(node=>!Object.hasOwn(node,'a:pPr'));
 return nativeTextHash(JSON.stringify(canonical(tree)));
};

export function createNativeTextFragments(report){
 const plans=new Map(),records=new Map();
 return {
  records,
  remember(slideIndex,name,plan){if(plan){const key=slideIndex+'|'+name;if(plans.has(key))throw Error('Duplicate native fragment carrier');plans.set(key,plan);}},
  write(xml,slideIndex,slotGroups){
   let nextId=Math.max(0,...[...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match=>Number(match[1])));
   return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,shape=>{
    const name=decode(/<p:cNvPr\b[^>]*\bname="([^"]*)"/.exec(shape)?.[1]??''),plan=plans.get(slideIndex+'|'+name);
    if(!plan)return shape;
    const paragraphs=[...shape.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)],native=[...shape.matchAll(runs)].map(match=>({properties:match[1],text:decode(match[2])}));
    if(paragraphs.length!==1||native.map(run=>run.text).join('')!==plan.text||/<a:(?:fld|br)\b/.test(shape)){
     report?.({code:'native-fragment-unavailable',path:name,message:'Native text no longer matches its exact source-bound measured fragments; original measured line retained.'});return shape;
    }
    const paragraph=paragraphs[0][0],parts=paragraphParts(paragraph);
    if(!parts){report?.({code:'native-fragment-unavailable',path:name,message:'Unsupported native paragraph children were retained on the original measured line.'});return shape;}
    const {properties:pPr,tail}=parts,
     frame=/<a:xfrm\b[^>]*>\s*<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>\s*<\/a:xfrm>/.exec(shape);
    if(!frame)return shape;
    // Preserve carrier frame, paragraph intent, auto-numbering and every run property.
    const carrierParagraph='<a:p>'+pPr+sliceRuns(native,0,plan.prefix)+tail+'</a:p>';
    let carrier=shape.replace(paragraph,carrierParagraph);
    const carrierId=Number(/<p:cNvPr\b[^>]*\bid="(\d+)"/.exec(shape)[1]);
    const shared={v:1,group:name,count:plan.members.length+1,length:plan.length,source:plan.source};
    const carrierRecord={...shared,index:0,name,id:carrierId,from:0,to:plan.prefix,role:'carrier'};
    carrierRecord.properties=propertiesHash(carrier,propertyBinding(carrierRecord));
    const pending=[[name,carrierRecord]];
    const children=plan.members.map((member,index)=>{
     const id=++nextId,childName='OPF native fragment '+name+' member '+index;
     let child=shape.replace(/<p:cNvPr\b[^>]*>/,node=>node.replace(/\bid="\d+"/,'id="'+id+'"').replace(/\bname="[^"]*"/,'name="'+escapeXml(childName)+'"'))
      .replace(/<p:custDataLst\b[^>]*>[\s\S]*?<\/p:custDataLst>/g,'');
     child=child.replace(frame[0],'<a:xfrm><a:off x="'+Math.round(member.x*9525)+'" y="'+frame[2]+'"/><a:ext cx="'+Math.max(1,Math.round(member.right*9525)-Math.round(member.x*9525))+'" cy="'+frame[4]+'"/></a:xfrm>');
     // One native LTR paragraph per source word/number; no source character is a direction control.
     child=child.replace(paragraph,'<a:p>'+memberParagraphProperties(pPr)+sliceRuns(native,member.from,member.to)+tail+'</a:p>');
     child=child.replace(/(<a:bodyPr\b[^>]*\brtlCol=")[^"]*"/,(_match,before)=>before+'0"');
     const record={...shared,index:index+1,name:childName,id,from:member.from,to:member.to,role:member.kind};
     record.properties=propertiesHash(child,propertyBinding(record));pending.push([childName,record]);
     return child;
    });
    let offset=0;const source=plan.source.map(part=>{const from=offset;offset+=part.end-part.start;return {from,to:offset,run:part.run};});
    const carrierSource=source.find(part=>part.from===0&&plan.prefix<=part.to)?.run;
    const matching=plan.members.map((member,index)=>({member,index})).filter(({member})=>member.sourceRun===carrierSource);
    if(matching.length){
     const expected=ownedJoinProperties(carrier,carrier,true);
     if(!expected||matching.some(({index})=>ownedJoinProperties(children[index],carrier,false)!==expected)){
      report?.({code:'native-fragment-unavailable',path:name,message:'Cross-role source properties cannot be represented exactly; original measured line retained.'});return shape;
     }
    }
    for(const [memberName,record]of pending)records.set(escapeXml(memberName),record);
    // The fragment receipt now owns the source partition; the old whole-line
    // CS split fingerprint cannot describe the shortened carrier.
    slotGroups.delete(name);
    return carrier+children.join('');
   });
  },
  attach(entries){attachTextTags(entries,records,NATIVE_FRAGMENT_TAG,'opfNativeFragment','native text fragments',{signed:true});}
 };
}

// Read current native bodies only. Source ranges own logical joins, never old
// words or old style values. On ambiguity no member is consumed.
export function importNativeTextFragments(shapes,paragraphs,relationships,entries,readBody,report=()=>{},slideXml=''){
 const rawShapes=new Map([...slideXml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([xml])=>[Number(/<p:cNvPr\b[^>]*\bid="(\d+)"/.exec(xml)?.[1]),xml]));
 const groups=new Map(),tagged=new Set(),items=[],identityCounts=new Map(),nameCounts=new Map();
 for(const shape of shapes){const nv=shape['p:nvSpPr']?.['p:cNvPr'];identityCounts.set(Number(nv?.id),(identityCounts.get(Number(nv?.id))??0)+1);nameCounts.set(nv?.name,(nameCounts.get(nv?.name)??0)+1);}
 for(const [index,shape]of shapes.entries()){
  const tags=[];let unreadable=false;
  for(const link of array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])){
   const rel=relationships.get(link['r:id']);if(rel?.type!==relType||rel.targetMode==='External'||!entries[rel.path])continue;
   try{tags.push(...array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag']));}catch{unreadable=true;}
  }
  const own=tags.filter(tag=>String(tag.name).toUpperCase()===NATIVE_FRAGMENT_TAG);
  if(own.length)tagged.add(shape);
  for(const tag of own)try{
   const data=decodeTextTag(tag.val);if(typeof data?.group!=='string')throw Error('Missing fragment group');
   const group=groups.get(data.group)??[];group.push({shape,index,data,ambiguous:unreadable||own.length!==1||tags.some(tag=>/^OPF_/i.test(String(tag.name))&&String(tag.name).toUpperCase()!==NATIVE_FRAGMENT_TAG)});groups.set(data.group,group);
  }catch{report({code:'invalid-native-fragments',message:'Invalid fragment metadata; all current native shapes retained.'});}
 }
 for(const group of groups.values())try{
  const first=group[0].data,count=first.count;
  if(!/^OPF list .+ line \d+$/.test(first.group)||first.v!==1||!Number.isSafeInteger(count)||count<3||count>64||group.length!==count||!Number.isSafeInteger(first.length)||first.length<1||first.length>1000000||!Array.isArray(first.source)||first.source.length>10000)throw Error('Incomplete native fragment group');
  const ordered=Array(count),ids=new Set(),names=new Set();
  for(const member of group){
   const {data,shape}=member,nv=shape['p:nvSpPr']?.['p:cNvPr'];
   if(member.ambiguous||Object.keys(data).some(key=>!['v','group','count','length','source','index','name','id','from','to','role','properties','sig'].includes(key))||data.v!==1||data.count!==count||data.length!==first.length||JSON.stringify(data.source)!==JSON.stringify(first.source)||!Number.isSafeInteger(data.index)||data.index<0||data.index>=count||ordered[data.index]||data.name!==nv?.name||data.id!==Number(nv?.id)||identityCounts.get(data.id)!==1||nameCounts.get(data.name)!==1||ids.has(data.id)||names.has(data.name)||!Number.isSafeInteger(data.from)||!Number.isSafeInteger(data.to)||data.from<0||data.to<data.from||data.to>first.length||typeof data.properties!=='string'||!/^[0-9a-f]{14}$/.test(data.properties)||!['carrier','word','number'].includes(data.role))throw Error('Ambiguous native fragment identity');
   ids.add(data.id);names.add(data.name);ordered[data.index]=member;
  }
  if(ordered[0].data.role!=='carrier'||ordered[0].data.name!==first.group||ordered[0].data.from!==0||ordered.at(-1).data.to!==first.length||ordered.some((member,index)=>index&&(member.data.role==='carrier'||member.data.from!==ordered[index-1].data.to)))throw Error('Native source partition changed');
  let prior=-1,total=0,priorEnd=0;for(const source of first.source){if(!source||Object.keys(source).some(key=>!['run','start','end'].includes(key))||!Number.isSafeInteger(source.run)||source.run<prior||!Number.isSafeInteger(source.start)||!Number.isSafeInteger(source.end)||source.start<0||source.end<source.start||(source.run===prior&&source.start<priorEnd))throw Error('Invalid source run boundary');prior=source.run;priorEnd=source.end;total+=source.end-source.start;}
  if(total!==first.length)throw Error('Incomplete source run partition');
  const current=ordered.map(member=>readBody(member.index));
  if(current.some(body=>!Array.isArray(body)||body.length!==1)||ordered.slice(1).some(member=>(paragraphs[member.index]??[]).some(p=>p.bullet)))throw Error('Native fragment paragraphs changed');
  let offset=0;const sourceRanges=first.source.map(source=>{const from=offset;offset+=source.end-source.start;return {from,to:offset,run:source.run};});
  const carrierRaw=rawShapes.get(ordered[0].data.id)??'',carrierIntact=propertiesHash(carrierRaw,propertyBinding(ordered[0].data))===ordered[0].data.properties;
  const richText=[];let previousSource,previousIntact=false,previousProperties,previousOwnedProperties,propertiesChanged=false;
  for(const [index,member]of ordered.entries()){
   const source=sourceRanges.find(source=>member.data.from>=source.from&&member.data.to<=source.to)?.run;
   const raw=rawShapes.get(member.data.id)??'',intact=propertiesHash(raw,propertyBinding(member.data))===member.data.properties,currentProperties=propertiesHash(raw,{});
   const ownedProperties=intact&&carrierIntact?ownedJoinProperties(raw,carrierRaw,index===0):undefined;
   if(!intact)propertiesChanged=true;
   for(const run of array(current[index][0].richText??current[index][0].text)){
    const previous=richText.at(-1),key=value=>typeof value==='string'?'scalar':JSON.stringify(Object.keys(value).filter(key=>key!=='text').sort().map(key=>[key,value[key]]));
    if(source!==undefined&&source===previousSource&&intact&&previousIntact&&(currentProperties===previousProperties||ownedProperties!==undefined&&ownedProperties===previousOwnedProperties)&&previous!==undefined&&key(previous)===key(run)){
     if(typeof previous==='string')richText[richText.length-1]+=run;else previous.text+=run.text;
    }else richText.push(typeof run==='string'?run:{...run});
    previousSource=source;previousIntact=intact;previousProperties=currentProperties;previousOwnedProperties=ownedProperties;
   }
  }
  const text=richText.map(run=>typeof run==='string'?run:run.text).join('');
  const carrier=ordered[0],paragraph={...paragraphs[carrier.index][0],text,richText,maxFontSize:Math.max(...ordered.map((member,index)=>current[index][0].maxFontSize??paragraphs[member.index]?.[0]?.maxFontSize??0))};
  items.push({carrier:carrier.shape,shapes:ordered.map(member=>member.shape),paragraphs:[paragraph]});
  // Consumption is committed by the caller only after carrier conversion succeeds.
  if(propertiesChanged||!groupUnchanged(ordered,paragraphs))report({code:'native-fragment-reflow',message:'Complete owned fragments retain current native text and styles; native edits or movement require reflow review.'});
 }catch(error){report({code:'invalid-native-fragments',message:error.message+'; all current native fragment shapes retained.'});}
 return {tagged,items};
}

// A valid ownership record is insufficient if the ordinary carrier converter
// cannot represent it. Keep all members available to ordinary import on refusal.
export function adoptNativeFragmentGroups(groups,convert,report=()=>{}){
 const items=[],consumed=new Set();
 for(const group of groups){
  let item;try{item=convert(group);}catch{/* Current native shapes remain independently readable. */}
  if(!item){report({code:'invalid-native-fragments',message:'Native fragment carrier could not be converted; all current member shapes retained.'});continue;}
  items.push(item);for(const shape of group.shapes)consumed.add(shape);
 }
 return {items,consumed};
}
