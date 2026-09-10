import {XMLParser} from 'fast-xml-parser';
import {attachTextTags,decodeTextTag} from './code-provenance.js';
const TAG='OPF_TEXT_V1',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const decoder=new TextDecoder('utf-8',{fatal:true}),array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
export const attachPlainTextTags=(entries,records)=>attachTextTags(entries,records,TAG,'opfText','plain text');

// Only boundaries are stored. Current native characters, including edits and
// empty lines, always supply the text; tags cannot restore discarded old words.
export function sourceLineParagraphs(ordered,paragraphs,{legacy=false}={}) {
 const source=ordered.some(item=>item.data.boundary!==undefined||item.data.separator!==undefined);
 if(!source&&legacy)return ordered.flatMap(item=>paragraphs[item.index]??[]);
 let text='',maxFontSize=0;
 for(const [index,item]of ordered.entries()) {
  const {boundary,separator}=item.data,last=index===ordered.length-1;
  if(typeof separator!=='string'||(boundary==='hard'?!/^(\r\n|\r|\n)$/.test(separator)||last:separator!==''||boundary!==(last?'end':'soft')))throw Error('Invalid source line boundary.');
  const current=paragraphs[item.index]??[];
  if(current.some(p=>p.bullet))throw Error('Tagged plain text now has native bullets.');
  text+=current.map(p=>p.text).join('\n')+separator;
  maxFontSize=Math.max(maxFontSize,...current.map(p=>p.maxFontSize??0));
 }
 return [{text,maxFontSize,bullet:false,level:0}];
}

export function importPlainTextGroups(shapes,paragraphs,relationships,entries,report) {
 const groups=new Map(),consumed=new Set(),items=[];
 for(const [index,shape]of shapes.entries()) {
  const tags=[];let unreadable=false;
  for(const link of array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])) {
   const rel=relationships.get(link['r:id']);if(rel?.type!==REL||rel.targetMode==='External'||!entries[rel.path])continue;
   try{tags.push(...array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag']));}catch{unreadable=true;}
  }
  for(const tag of tags.filter(tag=>tag.name?.toUpperCase()===TAG))try {
   const data=decodeTextTag(tag.val);
   if(data?.v!==1||typeof data.group!=='string'||data.group.length>4096||!/^slides\.\d+(?:\.[A-Za-z0-9_:+-]+)*\.text$/.test(data.group))throw Error('Invalid plain text identity.');
   const group=groups.get(data.group)??[];group.push({shape,index,data,ambiguous:unreadable||tags.filter(tag=>/^OPF_/i.test(tag.name)).length!==1});groups.set(data.group,group);
  }catch{report({code:'invalid-text-provenance',message:'Invalid plain text tags; ordinary import retains current native text.'});}
 }
 for(const group of groups.values())try {
  const count=group[0].data.count;
  if(!Number.isSafeInteger(count)||count<1||count>10000||group.length!==count||new Set(group.map(item=>item.shape)).size!==count)throw Error('Incomplete or duplicated plain text lines.');
  const ordered=Array(count);
  for(const item of group) {
   const data=item.data;
   if(item.ambiguous||data.count!==count||!Number.isSafeInteger(data.line)||data.line<0||data.line>=count||ordered[data.line])throw Error('Ambiguous plain text line.');
   ordered[data.line]=item;
  }
  const restored=sourceLineParagraphs(ordered,paragraphs);
  for(const item of ordered)consumed.add(item.shape);
  items.push({shapes:ordered.map(item=>item.shape),paragraphs:restored});
  report({code:'text-import-reflow',message:'Complete tagged lines retain current native text, whitespace and authored line boundaries. Native formatting, geometry and OPF nesting are not reconstructed; review the reflowed text.'});
 }catch(error){report({code:'invalid-text-provenance',message:`${error.message} Ordinary import retains current native text without restoring old source words.`});}
 return {consumed,items};
}
