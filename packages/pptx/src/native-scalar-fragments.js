// Private V2 owner for complete measured body scalars. Nativebody and V1 are
// independent. Tags never provide words or style values to the importer.
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {itemizeScripts,paragraphDirection,physicalAlignment} from '@openpresentation/opf/composition';
import {attachTextTags,decodeTextTag,nativeTextHash,groupUnchanged,nativeShapeParagraphs} from './code-provenance.js';
import {nativeFragmentPropertiesHash,planNativeUnicodeIntervals} from './native-text-fragments.js';
import {NATIVE_LANGUAGE_TAG,nativeLanguageReadView} from './native-language-provenance.js';

export const SCALAR_TEXT_TAG='OPF_TEXT_V2',SCALAR_LIST_TAG='OPF_NATIVE_FRAGMENTS_V2';
const TAGS=new Set([SCALAR_TEXT_TAG,SCALAR_LIST_TAG]),REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const ordered=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false,preserveOrder:true});
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true}),array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),closed=(value,keys)=>object(value)&&Object.keys(value).every(key=>keys.includes(key))&&keys.every(key=>Object.hasOwn(value,key));
const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>[key,canonical(item)])):value;
const hash=value=>nativeTextHash(JSON.stringify(canonical(value))),hash14=value=>typeof value==='string'&&/^[a-f0-9]{14}$/.test(value);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const decode=value=>String(parser.parse('<t>'+value+'</t>').t??'');
const shapeRows=xml=>[...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([xml])=>{const nv=parser.parse(xml)['p:sp']?.['p:nvSpPr']?.['p:cNvPr'];return {xml,name:nv?.name??'',id:Number(nv?.id)};});
const nativeRuns=shape=>[...shape.matchAll(/<a:r>(<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>)<a:t\b[^>]*>([^<]*)<\/a:t><\/a:r>/g)].map(([,properties,text])=>({properties,text:decode(text)}));
const textOf=shape=>nativeRuns(shape).map(run=>run.text).join('');
const arabicDecimal=text=>/\p{Decimal_Number}/u.test(text)&&[...text].some(character=>/\p{Decimal_Number}/u.test(character)&&/\p{Script=Arabic}/u.test(character));
const shapeKey=shape=>shape.id+'|'+shape.name;
const withoutCustData=shape=>shape.replace(/<p:custDataLst>\s*<p:tags r:id="[^"]+"\s*\/>\s*<\/p:custDataLst>/,'');
const frameTree=shape=>{const tree=ordered.parse(shape),nv=tree[0]?.['p:sp']?.find(node=>Object.hasOwn(node,'p:nvSpPr'))?.['p:nvSpPr']?.find(node=>Object.hasOwn(node,'p:nvPr'));if(Array.isArray(nv?.['p:nvPr']))nv['p:nvPr']=nv['p:nvPr'].filter(node=>!Object.hasOwn(node,'p:custDataLst'));return tree;};
const relative=(base,target)=>{if(typeof target!=='string'||target.startsWith('/')||target.includes('\\'))throw Error('Invalid internal relationship target');const parts=base.split('/').slice(0,-1);for(const part of target.split('/')){if(part==='..'){if(!parts.length)throw Error('Relationship escapes archive');parts.pop();}else if(part!=='.'&&part)parts.push(part);}return parts.join('/');};
const relPath=path=>{const at=path.lastIndexOf('/');return path.slice(0,at+1)+'_rels/'+path.slice(at+1)+'.rels';};
function relationships(entries,path){const bytes=entries[path.includes('/_rels/')?path:relPath(path)];if(!bytes)throw Error('Missing slide relationships');const values=array(parser.parse(dec.decode(bytes)).Relationships?.Relationship),map=new Map(),ambiguous=new Set();for(const value of values){if(!value?.Id)continue;if(map.has(value.Id))ambiguous.add(value.Id);map.set(value.Id,value);}map.ambiguous=ambiguous;return map;}
function tagsFor(entries,path,shape){
 const rels=relationships(entries,path);
 const tree=ordered.parse(shape),nv=tree[0]?.['p:sp']?.find(node=>Object.hasOwn(node,'p:nvSpPr'))?.['p:nvSpPr']?.find(node=>Object.hasOwn(node,'p:nvPr'))?.['p:nvPr'],cust=array(nv).filter(node=>Object.hasOwn(node,'p:custDataLst'));
 if(cust.length>1||cust.length!==(shape.match(/<p:custDataLst\b/g)??[]).length||cust.some(node=>!Array.isArray(node['p:custDataLst'])||node['p:custDataLst'].length!==1||!Object.hasOwn(node['p:custDataLst'][0],'p:tags')))throw Error('Unsupported customer data structure');
 const links=cust.map(node=>node['p:custDataLst'][0][':@']?.['r:id']);if(links.some(id=>typeof id!=='string'||!id)||links.length!==(shape.match(/<p:tags\b/g)??[]).length)throw Error('Ambiguous shape tag identity');
 if(links.length>1||/<p:custDataLst\b/.test(shape)&&links.length!==1)throw Error('Ambiguous shape tag relationship');
 if(!links.length)return {tags:[],part:undefined,rels};
 const rel=rels.get(links[0]);if(rels.ambiguous.has(links[0])||rel?.Type!==REL||rel.TargetMode==='External')throw Error('Foreign or duplicated shape tag relationship');
 const part=relative(path,rel.Target),bytes=entries[part];if(!bytes||XMLValidator.validate(dec.decode(bytes))!==true)throw Error('Unreadable shape tags');
 const root=parser.parse(dec.decode(bytes))['p:tagLst'];if(!root||typeof root!=='object')throw Error('Invalid tag list');
 return {tags:array(root['p:tag']),part,rels,linkId:links[0]};
}
const contentOwners=tags=>tags.filter(tag=>/^OPF_/i.test(String(tag.name))&&String(tag.name).toUpperCase()!==NATIVE_LANGUAGE_TAG);
const wrapped=shape=>'<p:sld><p:cSld><p:spTree>'+shape+'</p:spTree></p:cSld></p:sld>';
function intactNativeSignature(shape,data){return hash14(data.sig)&&groupUnchanged([{shape:parser.parse(shape)['p:sp'],index:0,data}],nativeShapeParagraphs(wrapped(shape)));}
function validateSemanticOwner(entries,path,shape,tags){
 const semantic=tags.tags.filter(tag=>String(tag.name).toUpperCase()===NATIVE_LANGUAGE_TAG);if(!semantic.length)return;if(semantic.length!==1)throw Error('Ambiguous semantic owner');
 const diagnostics=[],minimal={[path]:enc.encode(wrapped(shape)),[tags.part]:entries[tags.part]};
 nativeLanguageReadView(minimal,()=>new Map([[tags.linkId,{type:REL,path:tags.part}]]),issue=>diagnostics.push(issue));if(diagnostics.length)throw Error('Stale native language ownership');
}
function contextHash(entries,slidePath){
 const parts=[],seen=new Map(),active=new Set(),types=new Set(['slideLayout','slideMaster','theme','themeOverride']);
 const roots={slide:'p:sld',slideLayout:'p:sldLayout',slideMaster:'p:sldMaster',theme:'a:theme',themeOverride:'a:themeOverride'};
 const inherited={slide:new Set(['slideLayout','theme','themeOverride']),slideLayout:new Set(['slideMaster','theme','themeOverride']),slideMaster:new Set(['theme','themeOverride']),theme:new Set(),themeOverride:new Set()};
 const visit=(path,stage)=>{
  if(active.has(path))throw Error('Cyclic native style context');if(seen.has(path)){if(seen.get(path)!==stage)throw Error('Foreign native style context root');return;}seen.set(path,stage);active.add(path);
  if(!entries[path])throw Error('Missing native style context');const xml=dec.decode(entries[path]);if(XMLValidator.validate(xml)!==true)throw Error('Malformed native style context');const tree=ordered.parse(xml);if(tree.filter(node=>Object.hasOwn(node,roots[stage])).length!==1)throw Error('Foreign native style context root');
  if(path===slidePath){const root=tree.find(node=>Object.hasOwn(node,'p:sld'))?.['p:sld']??[],common=root.find(node=>Object.hasOwn(node,'p:cSld'))?.['p:cSld']??[];parts.push([path,root.filter(node=>Object.hasOwn(node,'p:clrMapOvr')),common.filter(node=>Object.hasOwn(node,'p:bg'))]);}
  else parts.push([path,tree]);
  const map=entries[relPath(path)]?relationships(entries,path):new Map(),rels=[...map.values()].filter(rel=>types.has(rel.Type?.split('/').at(-1))),counts=new Set();
  // Keep raw style topology, including the master's ordinary layout backlinks,
  // but traverse only the active inheritance direction, never master→layouts.
  for(const rel of rels)if(map.ambiguous?.has(rel.Id)||rel.TargetMode==='External')throw Error('Ambiguous native style context');
  const lineage=rels.filter(rel=>inherited[stage].has(rel.Type.split('/').at(-1)));
  for(const rel of lineage){if(counts.has(rel.Type))throw Error('Ambiguous native style context');counts.add(rel.Type);}
  parts.push([relPath(path),rels]);for(const rel of lineage)visit(relative(path,rel.Target),rel.Type.split('/').at(-1));active.delete(path);
 };visit(slidePath,'slide');
 const presentation=dec.decode(entries['ppt/presentation.xml']??new Uint8Array());
 if(entries['ppt/_rels/presentation.xml.rels'])parts.push(['presentation-style-relationships',array(parser.parse(dec.decode(entries['ppt/_rels/presentation.xml.rels'])).Relationships?.Relationship).filter(rel=>/\/(?:theme|slideMaster|slideLayout)$/.test(rel.Type??''))]);
 parts.push(['presentation-defaults',ordered.parse((/<p:defaultTextStyle\b[^>]*>[\s\S]*?<\/p:defaultTextStyle>/.exec(presentation)?.[0]??'')+(/<p:sldSz\b[^>]*\/>/.exec(presentation)?.[0]??''))]);return hash(parts);
}
function proofs(entries,path,shape,binding){
 const tree=frameTree(shape),root=tree[0]?.['p:sp'];if(!Array.isArray(root))throw Error('Invalid current shape');
 const frame=root.filter(node=>!Object.hasOwn(node,'p:txBody')),rels=relationships(entries,path),referenced=new Set();
 const visit=value=>{
  if(Array.isArray(value)){value.forEach(visit);return;}
  if(!object(value))return;
  for(const [key,item]of Object.entries(value)){
   if(key===':@'){for(const [attribute,target]of Object.entries(item))if(/^r:(?:id|embed|link)$/.test(attribute))referenced.add(target);}
   else visit(item);
  }
 };visit(tree);const refs=[...referenced].sort();
 const links=refs.map(id=>{const rel=rels.get(id);if(!rel||rels.ambiguous.has(id))throw Error('Missing or ambiguous current property relationship');return [id,rel];});
 const body=nativeFragmentPropertiesHash(shape,binding);if(!body)throw Error('Missing current text body');
 return {body,frame:hash([frame,binding]),relationships:hash([links,binding]),context:contextHash(entries,path)};
}
function paragraphParts(shape){
 if(XMLValidator.validate(shape)!==true)throw Error('Malformed current native shape');
 const paragraphs=[...shape.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)];if(paragraphs.length!==1||/<a:(?:br|fld)\b/.test(shape))throw Error('Unsupported current paragraphs');
 const paragraph=paragraphs[0][0],content=paragraph.slice(5,-6),pPr=/^\s*(<a:pPr\b[^>]*\/>|<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>)/.exec(content)?.[0]??'',runs=nativeRuns(paragraph);
 if(!runs.length)throw Error('Missing native runs');
 const body=content.slice(pPr.length),matches=[...body.matchAll(/<a:r>[\s\S]*?<\/a:r>/g)];let cursor=0;
 for(const match of matches){if(body.slice(cursor,match.index).trim())throw Error('Unknown paragraph children');cursor=match.index+match[0].length;}
 const tail=body.slice(cursor);if(tail.trim()){const tree=ordered.parse(tail.trim());if(XMLValidator.validate(tail.trim())!==true||tree.length!==1||!Object.hasOwn(tree[0],'a:endParaRPr'))throw Error('Unsupported paragraph terminal metadata');}
 if(matches.length!==runs.length)throw Error('Unsupported native run spelling');return {paragraph,pPr,tail,runs};
}
const memberPPr=pPr=>'<a:pPr rtl="0" algn="l" marL="0" indent="0">'+(/<a:lnSpc>[\s\S]*?<\/a:lnSpc>/.exec(pPr)?.[0]??'')+'<a:buNone/></a:pPr>';
const serializeRuns=runs=>runs.map(run=>'<a:r>'+run.properties+'<a:t'+(/^ +$/.test(run.text)?' xml:space="preserve"':'')+'>'+escape(run.text)+'</a:t></a:r>').join('');
const memberBinding=(header,index)=>({v:2,header:hash(header),member:index,identity:header.members[index]});
const boundaries=(source,fit)=>{let cursor=0;const rows=[];for(const [index,text]of fit.lines.entries()){if(source.slice(cursor,cursor+text.length)!==text)throw Error('Measured scalar source mismatch');const from=cursor,to=from+text.length,separator=index===fit.lines.length-1?'':/^(\r\n|\r|\n)/.exec(source.slice(to))?.[0]??'';cursor=to+separator.length;rows.push({index,from,to,next:cursor,boundary:index===fit.lines.length-1?'end':separator?'hard':'soft',separator});}if(cursor!==source.length)throw Error('Incomplete scalar source lines');return rows;};

export function createNativeScalarFragments(report=()=>{}){
 const groups=new Map(),committedNames=new Set();
 const unavailable=(path,error)=>report({code:'native-scalar-fragment-unavailable',path,message:error.message+'; complete original measured scalar retained.'});
 return {
  get hasPlans(){return groups.size>0;},
  committedNames,
  rememberItem(slideIndex,item,geometry,measurement,profile){
   if(!measurement?.measure||item.frameBox||item.emphasis||item.eyebrow||geometry.arrangements?.some(entry=>entry.path===item.path))return;
   const sources=[];
   if(item.field==='text'&&typeof item.value==='string')sources.push({kind:'text',group:item.path,source:item.value,fit:item.text,box:item.box,style:item.textStyle,prefix:`OPF text ${item.path} line `,offset:0});
   if(['items','bullets'].includes(item.field)&&Array.isArray(item.value)&&item.text?.listEntries){
    let offset=0;for(const entry of item.text.listEntries){const source=item.value[entry.index];if(typeof source==='string'&&entry.level===0&&!entry.description&&entry.marker.none!==true)sources.push({kind:'list-item',group:item.path+'.'+entry.index,source,fit:entry.text,box:entry.textBox,style:item.textStyle,direction:entry.direction,prefix:`OPF list ${item.path} line `,offset});offset+=entry.text.lines.length+(entry.description?.lines.length??0);}
   }
   for(const source of sources){
    if(!arabicDecimal(source.source)||!/[A-Za-z]/.test(source.source)||paragraphDirection(source.source,'rtl')!=='ltr'||profile(undefined)?.script!=='Arab')continue;
    try{
     const rows=boundaries(source.source,source.fit).map(row=>{
      const line=source.fit.richLines?.[row.index]??{width:source.fit.sourceLines?.[row.index]?.width,fragments:[{text:source.fit.lines[row.index],x:0,width:source.fit.sourceLines?.[row.index]?.width,fontSize:source.fit.fontSize,style:source.style}]};
      const direction=source.fit.directions?.[row.index]??source.direction??paragraphDirection(source.source,geometry.direction),placed=source.fit.placement?.lines[row.index],alignment=placed?.alignment??physicalAlignment('left',direction);
      if(direction!=='ltr'||alignment!=='left'||(!placed&&source.kind!=='list-item'))throw Error('Unsupported scalar line origin');
      return {...row,name:source.prefix+(source.offset+row.index),line,originX:placed?.x??source.box.x};
     });
     const key=slideIndex+'|'+source.group;if(groups.has(key))throw Error('Duplicate scalar group');groups.set(key,{...source,slideIndex,rows,measurement,profile});
    }catch(error){unavailable(source.group,error);}
   }
  },
  write(entries,slotGroups){
   for(const group of groups.values())try{
    const path=`ppt/slides/slide${group.slideIndex+1}.xml`,original=dec.decode(entries[path]),all=shapeRows(original),names=new Set(),ids=new Set();for(const shape of all){if(names.has(shape.name)||ids.has(shape.id))throw Error('Duplicate current native identity');names.add(shape.name);ids.add(shape.id);}
    let nextId=Math.max(0,...ids),xml=original;const staged={...entries},members=[],lines=[],migrations=[],existingTagParts=new Set();
    const allPartRefs=all.map(shape=>{try{return tagsFor(entries,path,shape.xml).part;}catch{return undefined;}});
    for(const row of group.rows){
     const shape=all.find(shape=>shape.name===row.name);if(!shape)throw Error('Missing original scalar line');
     const tags=tagsFor(entries,path,shape.xml),owners=contentOwners(tags.tags),semantic=tags.tags.filter(tag=>String(tag.name).toUpperCase()===NATIVE_LANGUAGE_TAG);
     if(tags.part&&(existingTagParts.has(tags.part)||allPartRefs.filter(part=>part===tags.part).length!==1))throw Error('Shared scalar tag part');if(tags.part)existingTagParts.add(tags.part);
     if(group.kind==='text'){
      if(owners.length!==1||String(owners[0].name).toUpperCase()!=='OPF_TEXT_V1')throw Error('Ambiguous original text ownership');
      const old=decodeTextTag(owners[0].val);if(old.v!==1||old.group!==group.group||old.line!==row.index||old.count!==group.rows.length||old.boundary!==row.boundary||old.separator!==row.separator||!intactNativeSignature(shape.xml,old))throw Error('Original text group or signed native evidence changed');
     }else if(owners.length)throw Error('List scalar has another content owner');
     validateSemanticOwner(entries,path,shape.xml,tags);
     const parts=paragraphParts(shape.xml),text=parts.runs.map(run=>run.text).join('');if(text!==group.source.slice(row.from,row.to))throw Error('Current scalar text changed before fragmentation');
     const numeric=arabicDecimal(text),plan=numeric?planNativeUnicodeIntervals({source:group.source,from:row.from,to:row.to,line:row.line,originX:row.originX,rtl:false,nativeRuns:parts.runs,measurement:group.measurement,profile:group.profile}):undefined;
     if(numeric&&plan?.status!=='planned')throw Error('Unsupported scalar interval: '+plan?.reason);
     const intervals=plan?.intervals??[{from:row.from,to:row.to,text,native:parts.runs,script:'Latn',role:'latin'}],lineMembers=[];let replacement='';
     for(const [part,interval]of intervals.entries()){
      let current=shape.xml,id=shape.id,name=shape.name;
      if(part){id=++nextId;name=`OPF scalar fragment ${shape.name} part ${part}`;current=withoutCustData(current).replace(/<p:cNvPr\b[^>]*>/,node=>node.replace(/\bid="\d+"/,'id="'+id+'"').replace(/\bname="[^"]*"/,'name="'+escape(name)+'"'));
       const frame=/<a:xfrm\b[^>]*>\s*<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>\s*<\/a:xfrm>/.exec(current);if(!frame)throw Error('Missing exact scalar frame');
       current=current.replace(frame[0],'<a:xfrm><a:off x="'+Math.round(interval.x*9525)+'" y="'+frame[2]+'"/><a:ext cx="'+Math.max(1,Math.round(interval.right*9525)-Math.round(interval.x*9525))+'" cy="'+frame[4]+'"/></a:xfrm>').replace(/(<a:bodyPr\b[^>]*\brtlCol=")[^"]*"/,(_whole,start)=>start+'0"');
      }
      if(plan)current=current.replace(parts.paragraph,'<a:p>'+(part?memberPPr(parts.pPr):parts.pPr)+serializeRuns(interval.native)+parts.tail+'</a:p>');
      const index=members.length,derived=row.line.fragments.map((fragment,index)=>({fragment,index})),slices=[];let nativeOffset=interval.from;
      for(const native of nativeRuns(current)){
       const end=nativeOffset+native.text.length;let fragmentOffset=row.from;
       for(const {fragment,index}of derived){const a=Math.max(nativeOffset,fragmentOffset),b=Math.min(end,fragmentOffset+fragment.text.length);if(b>a){let offset=a;for(const script of itemizeScripts(group.source.slice(a,b),group.profile(fragment.style?.lang))){slices.push({from:offset,to:offset+script.text.length,derivedRun:fragment.runIndex??index,script:script.script,role:script.role,rpr:hash(ordered.parse(native.properties))});offset+=script.text.length;}}fragmentOffset+=fragment.text.length;}
       nativeOffset=end;
      }
      members.push({index,line:row.index,part,name,id,from:interval.from,to:interval.to,role:part?'script':plan?'carrier':'continuation',slices,xml:current});lineMembers.push(index);replacement+=current;
     }
     lines.push({index:row.index,from:row.from,to:row.to,next:row.next,boundary:row.boundary,separator:row.separator,original:{name:shape.name,id:shape.id},members:lineMembers});xml=xml.replace(shape.xml,replacement);
     migrations.push({part:tags.part,tags:[...owners,...semantic],names:lineMembers.map(index=>members[index].name),original:shape.name});
    }
    if(!members.some(member=>member.role==='script')||members.length>64)throw Error('Unsupported scalar member count');
    const header={group:group.group,kind:group.kind,source:{kind:'scalar',length:group.source.length,hash:hash(group.source)},lines,members:members.map(({xml,...member})=>member)},tag=group.kind==='text'?SCALAR_TEXT_TAG:SCALAR_LIST_TAG,prefix=(group.kind==='text'?'opfTextV2G':'opfNativeFragmentV2G')+hash(header);
    for(let index=1;index<=members.length;index++)if(staged[`ppt/tags/${prefix}${index}.xml`])throw Error('Scalar tag part collision');
    staged[path]=enc.encode(xml);const records=new Map();
    for(const member of members){const record={v:2,header,member:member.index,proof:proofs(staged,path,member.xml,memberBinding(header,member.index))};if(enc.encode(JSON.stringify(record)).length>256*1024)throw Error('Scalar tag field budget');records.set(escape(member.name),record);}
    attachTextTags(staged,records,tag,prefix,'scalar fragments',{signed:true});
    for(const migration of migrations)if(migration.part){let current=dec.decode(staged[migration.part]);for(const old of migration.tags){const exact='<p:tag name="'+old.name+'" val="'+old.val+'"/>';if(current.split(exact).length!==2)throw Error('Original scalar owner tag spelling changed');current=current.replace(exact,'');}staged[migration.part]=enc.encode(current);}
    const verified=readNativeScalarGroups(staged,path);if(verified.groups.filter(candidate=>candidate.header.group===group.group&&candidate.exact).length!==1)throw Error('Staged scalar ownership failed validation');
    for(const [part,bytes]of Object.entries(staged))if(bytes!==entries[part])entries[part]=bytes;
    for(const migration of migrations){slotGroups.delete(migration.original);for(const name of migration.names)committedNames.add(name);}
   }catch(error){unavailable(group.group,error);}
  }
 };
}

function validHeader(header){
 if(!closed(header,['group','kind','source','lines','members'])||!['text','list-item'].includes(header.kind)||typeof header.group!=='string'||header.group.length>4096||!(header.kind==='text'?/^slides\.\d+(?:\.[A-Za-z0-9_:+-]+)*\.text$/:/^slides\.\d+(?:\.[A-Za-z0-9_:+-]+)*\.(?:items|bullets)\.\d+$/).test(header.group)||!closed(header.source,['kind','length','hash'])||header.source.kind!=='scalar'||!Number.isSafeInteger(header.source.length)||header.source.length<1||header.source.length>1e6||!hash14(header.source.hash)||!Array.isArray(header.members)||!header.members.length||header.members.length>64||!Array.isArray(header.lines)||!header.lines.length||header.lines.length>header.members.length)throw Error('Invalid V2 scalar header');
 let offset=0,memberIndex=0,sliceCount=0;
 if(header.group.split('.').some(part=>['__proto__','prototype','constructor'].includes(part)))throw Error('Invalid scalar source path');
 for(const [index,line]of header.lines.entries()){
  if(!closed(line,['index','from','to','next','boundary','separator','original','members'])||line.index!==index||line.from!==offset||!Number.isSafeInteger(line.to)||line.to<line.from||!Number.isSafeInteger(line.next)||line.next<line.to||line.next>header.source.length||!closed(line.original,['name','id'])||typeof line.original.name!=='string'||!Number.isSafeInteger(line.original.id)||!Array.isArray(line.members)||!line.members.length)throw Error('Invalid scalar line');
  const last=index===header.lines.length-1;if(typeof line.separator!=='string'||(line.boundary==='hard'?last||!/^(\r\n|\r|\n)$/.test(line.separator):line.separator!==''||line.boundary!==(last?'end':'soft'))||line.next!==line.to+line.separator.length)throw Error('Invalid scalar source separator');
  const expectedPrefix=header.kind==='text'?'OPF text '+header.group+' line ':'OPF list '+header.group.replace(/\.\d+$/,'')+' line ',originalLine=Number(line.original.name.slice(expectedPrefix.length));
  if(!line.original.name.startsWith(expectedPrefix)||!Number.isSafeInteger(originalLine)||originalLine<0||line.original.name!==expectedPrefix+originalLine||(header.kind==='text'?originalLine!==index:index>0&&originalLine!==Number(/ line (\d+)$/.exec(header.lines[0].original.name)?.[1])+index))throw Error('Scalar source identity does not match native line');
  let from=line.from;
  for(const [part,position]of line.members.entries()){
   const member=header.members[position];if(position!==memberIndex++||!closed(member,['index','line','part','name','id','from','to','role','slices'])||member.index!==position||member.line!==index||member.part!==part||typeof member.name!=='string'||!member.name||member.name.length>4096||member.name!==(part?`OPF scalar fragment ${line.original.name} part ${part}`:line.original.name)||!Number.isSafeInteger(member.id)||member.id<1||member.from!==from||!Number.isSafeInteger(member.to)||member.to<member.from||member.to>line.to||!['carrier','script','continuation'].includes(member.role)||!Array.isArray(member.slices)||!member.slices.length)throw Error('Invalid scalar member partition');
   let source=member.from;for(const slice of member.slices){if(++sliceCount>10000||!closed(slice,['from','to','derivedRun','script','role','rpr'])||slice.from!==source||!Number.isSafeInteger(slice.to)||slice.to<=slice.from||slice.to>member.to||!Number.isSafeInteger(slice.derivedRun)||slice.derivedRun<0||!['Latn','Arab'].includes(slice.script)||slice.role!==(slice.script==='Latn'?'latin':'complexScript')||!hash14(slice.rpr))throw Error('Invalid scalar style slice');source=slice.to;}if(source!==member.to)throw Error('Incomplete scalar style slices');from=member.to;
  }
  if(from!==line.to||line.original.name!==header.members[line.members[0]].name||line.original.id!==header.members[line.members[0]].id||line.members.some((position,part)=>header.members[position].role!==(line.members.length===1?'continuation':part?'script':'carrier')))throw Error('Incomplete scalar line');offset=line.next;
 }
 if(offset!==header.source.length||memberIndex!==header.members.length||new Set(header.members.map(member=>member.id)).size!==header.members.length||new Set(header.members.map(member=>member.name)).size!==header.members.length)throw Error('Incomplete scalar source partition');
}

// Raw archive validation precedes all V1 semantic read views. Tagged identities
// authorize current rich fallback only; untrusted header references consume none.
export function readNativeScalarGroups(entries,path,report=()=>{}){
 const rows=shapeRows(dec.decode(entries[path])),tagged=new Set(),names=new Set(),groups=new Map(),items=[];let bytes=0;
 for(const shape of rows){
  let data;try{data=tagsFor(entries,path,shape.xml);}catch{continue;}
  const tags=data.tags.filter(tag=>TAGS.has(String(tag.name).toUpperCase()));if(!tags.length)continue;tagged.add(shapeKey(shape));names.add(shape.name);
  for(const tag of tags)try{
   if(typeof tag.val!=='string'||tag.val.length>2*256*1024||((bytes+=tag.val.length/2)>16*1024*1024))throw Error('Scalar tag budget');
   const value=decodeTextTag(tag.val);if(!closed(value,['v','header','member','proof','sig'])||value.v!==2||!Number.isSafeInteger(value.member)||!closed(value.proof,['body','frame','relationships','context'])||!Object.values(value.proof).every(hash14)||!hash14(value.sig))throw Error('Invalid scalar record');validHeader(value.header);
   const own=value.header.members[value.member];if(!own||own.name!==shape.name||own.id!==shape.id)throw Error('Scalar record does not bind its physical tagged member');
   if((value.header.kind==='text'?SCALAR_TEXT_TAG:SCALAR_LIST_TAG)!==String(tag.name).toUpperCase())throw Error('Wrong scalar primary owner');
   const group=groups.get(value.header.group)??[];group.push({shape,value,ambiguous:tags.length!==1||contentOwners(data.tags).length!==1||data.tags.some(tag=>String(tag.name).toUpperCase()===NATIVE_LANGUAGE_TAG)});groups.set(value.header.group,group);
  }catch(error){report({code:'invalid-native-scalar-fragments',message:error.message+'; current native shapes retained.'});}
 }
 for(const group of groups.values())try{
  const header=group[0].value.header;if(group.length!==header.members.length)throw Error('Incomplete scalar ownership');
  const members=Array(group.length);let exact=true;
  for(const entry of group){const {shape,value}=entry,identity=header.members[value.member];if(entry.ambiguous||JSON.stringify(canonical(value.header))!==JSON.stringify(canonical(header))||!identity||members[value.member]||identity.name!==shape.name||identity.id!==shape.id||rows.filter(row=>row.id===shape.id||row.name===shape.name).length!==1)throw Error('Ambiguous scalar identity');const paragraph=paragraphParts(shape.xml),bullet=/<a:bu(?:AutoNum|Char|Blip)\b/.test(paragraph.pPr);if(bullet!==(header.kind==='list-item'&&value.member===0))throw Error('Current scalar paragraph membership changed');members[value.member]=entry;const current=proofs(entries,path,shape.xml,memberBinding(header,value.member));if(hash(current)!==hash(value.proof)||!groupUnchanged([{shape:parser.parse(shape.xml)['p:sp'],index:0,data:value}],nativeShapeParagraphs('<p:sld><p:cSld><p:spTree>'+shape.xml+'</p:spTree></p:cSld></p:sld>')))exact=false;}
  let text='';for(const line of header.lines){for(const index of line.members)text+=textOf(members[index].shape.xml);text+=line.separator;}
  if(!text.isWellFormed())throw Error('Invalid current scalar UTF16');exact&&=text.length===header.source.length&&hash(text)===header.source.hash;
  if(exact)for(const member of header.members){
   for(const boundary of [member.from,member.to,...member.slices.flatMap(slice=>[slice.from,slice.to])])if(boundary>0&&boundary<text.length&&/[\uD800-\uDBFF]/.test(text[boundary-1])&&/[\uDC00-\uDFFF]/.test(text[boundary]))throw Error('Scalar source bisects a code point');
   let offset=member.from;const spans=nativeRuns(members[member.index].shape.xml).map(run=>{const from=offset;offset+=run.text.length;return {from,to:offset,rpr:hash(ordered.parse(run.properties))};});if(offset!==member.to||member.slices.some(slice=>!spans.some(span=>span.from<slice.to&&span.to>slice.from)||spans.some(span=>span.from<slice.to&&span.to>slice.from&&span.rpr!==slice.rpr)))throw Error('Scalar native property slices changed');
  }
  items.push({header,members,text,exact});
 }catch(error){report({code:'invalid-native-scalar-fragments',message:error.message+'; current native shapes retained.'});}
 return {groups:items,tagged,names};
}

export function adoptNativeScalarGroups(scan,shapes,readBody,convert,valid,report=()=>{}){
 const consumed=new Set(),items=[],protectedSources=new Set(),protectedPaths=new Set();
 for(const group of scan?.groups??[])try{
  const indexes=group.members.map(entry=>shapes.findIndex(shape=>{const nv=shape['p:nvSpPr']?.['p:cNvPr'];return Number(nv?.id)===entry.shape.id&&nv?.name===entry.shape.name;}));if(indexes.some(index=>index<0))throw Error('Missing parsed scalar member');
  const carrier=indexes[0],parsed=group.exact?undefined:indexes.map(index=>readBody(index));
  if(parsed?.some(paragraphs=>!Array.isArray(paragraphs)||paragraphs.length!==1))throw Error('Current scalar paragraph structure changed');
  const values=[];
  for(const line of group.header.lines){for(const index of line.members){if(!group.exact&&index!==line.members[0]&&parsed[index][0].bullet)throw Error('New native fragment bullet');if(!group.exact)for(const run of array(parsed[index][0].richText??parsed[index][0].text))values.push(typeof run==='string'?{text:run}:{...run});}if(!group.exact&&line.separator)values.push({text:line.separator});}
  const value=group.exact?group.text:values;if(!valid(group.header.kind,value))throw Error('Current scalar payload cannot be represented');
  const item=convert({group,indexes,carrier,value});if(!item)throw Error('Scalar carrier conversion refused');if(!valid(group.header.kind,value,item))throw Error('Converted scalar payload cannot be represented');
  items.push({...item,v2Scalar:{path:group.header.group,kind:group.header.kind,currentRich:!group.exact,lines:group.header.lines.map(line=>Number(/ line (\d+)$/.exec(line.original.name)?.[1]))}});for(const index of indexes){consumed.add(shapes[index]);if(!group.exact)protectedSources.add('sp:'+index);}if(!group.exact){protectedPaths.add(group.header.group);report({code:'native-scalar-fragment-reflow',message:'Current native text and full parsed styles retained; original scalar defaults were not restored after edits.'});}
 }catch(error){report({code:'invalid-native-scalar-fragments',message:error.message+'; all current native member shapes retained.'});}
 return {consumed,items,protectedSources,protectedPaths};
}
