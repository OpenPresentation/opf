import {XMLParser} from 'fast-xml-parser';
import {attachTextTags,decodeTextTag} from './code-provenance.js';
const TAG='OPF_HEADING_V1',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const decoder=new TextDecoder('utf-8',{fatal:true}),array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
export const attachHeadingTags=(entries,records)=>attachTextTags(entries,records,TAG,'opfHeading','heading');

// Tags carry only roles and line ordering. Current native text always wins;
// neither original source text nor old geometry can be restored from these tags.
export function importHeadingGroups(shapes,paragraphs,relationships,entries,report) {
  const groups=new Map(),consumed=new Set(),items=[];
  for(const [index,shape] of shapes.entries()) {
    const tags=[];let unreadable=false;
    for(const link of array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])) {
      const rel=relationships.get(link['r:id']);
      if(rel?.type!==REL||rel.targetMode==='External'||!entries[rel.path])continue;
      try{tags.push(...array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag']));}catch{unreadable=true;}
    }
    const candidates=tags.filter(tag=>tag.name?.toUpperCase()===TAG);
    if(!candidates.length)continue;
    for(const tag of candidates)try {
      const data=decodeTextTag(tag.val);
      if(data?.v!==1||!['title','subtitle','tag'].includes(data.field)||typeof data.group!=='string'||!/^slides\.\d+\.(title|subtitle|tag)$/.test(data.group)||!data.group.endsWith('.'+data.field))throw Error('Invalid heading identity.');
      const group=groups.get(data.field)??[];
      group.push({shape,index,data,ambiguous:unreadable||tags.filter(tag=>/^OPF_/i.test(tag.name)).length!==1});groups.set(data.field,group);
    }catch{report({code:'invalid-heading-provenance',message:'Invalid heading tags; ordinary import retains visible native text.'});}
  }
  for(const group of groups.values())try {
    const first=group[0].data,count=first.count;
    if(!Number.isSafeInteger(count)||count<1||count>512||group.length!==count||new Set(group.map(item=>item.shape)).size!==count)throw Error('Incomplete or duplicated heading lines.');
    const ordered=Array(count);
    for(const item of group) {
      const data=item.data;
      if(item.ambiguous||data.group!==first.group||data.count!==count||!Number.isSafeInteger(data.line)||data.line<0||data.line>=count||ordered[data.line])throw Error('Ambiguous heading line.');
      ordered[data.line]=item;
    }
    for(const item of ordered)consumed.add(item.shape);
    items.push({field:first.field,shapes:ordered.map(item=>item.shape),paragraphs:ordered.flatMap(item=>paragraphs[item.index]??[])});
    report({code:'heading-import-reflow',message:'Complete tagged heading lines retain their roles, order and current native text. Original wrapping, whitespace, formatting and geometry are not reconstructed.'});
  }catch(error){report({code:'invalid-heading-provenance',message:`${error.message} Ordinary import retains visible native text.`});}
  return {consumed,items};
}
