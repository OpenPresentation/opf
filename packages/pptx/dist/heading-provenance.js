import {XMLParser} from 'fast-xml-parser';
import {attachTextTags,decodeTextTag} from './code-provenance.js';
import {sourceLineParagraphs} from './text-provenance.js';
import {cleanBase,headingValue,joinRichLines} from './rich-heading.js';
const TAG='OPF_HEADING_V1',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const decoder=new TextDecoder('utf-8',{fatal:true}),array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
export const attachHeadingTags=(entries,records)=>attachTextTags(entries,records,TAG,'opfHeading','heading');

// Tags carry only roles and line ordering. Current native text always wins;
// neither original source text nor old geometry can be restored from these tags.
// `readBody` (optional) is the native body reader: with it a group also returns `richText`, the heading as string | TextRun[] (FA-10).
export function importHeadingGroups(shapes,paragraphs,relationships,entries,report,readBody) {
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
    const restored=sourceLineParagraphs(ordered,paragraphs,{legacy:true});
    for(const item of ordered)consumed.add(item.shape);
    // The same boundaries as the plain text: a new tag's separator, or a native line break between legacy-tagged lines.
    const source=ordered.some(item=>item.data.boundary!==undefined||item.data.separator!==undefined);
    // Only a rich export records the heading's own look (tag.base); a heading exported as a plain string stays one.
    const base=cleanBase(ordered[0].data.base);
    const parts=base?joinRichLines(ordered,readBody,(item,last)=>source?item.data.separator:last?'':'\n'):undefined;
    items.push({field:first.field,shapes:ordered.map(item=>item.shape),paragraphs:restored,...(parts?{richText:headingValue(parts,base)}:{})});
    report({code:'heading-import-reflow',message:'Complete tagged heading lines retain their roles, order and current native text. New boundary tags also retain authored whitespace and line endings; legacy tags retain native line breaks. Run formatting that differs between words is read back as TextRun[]; geometry is not reconstructed.'});
  }catch(error){report({code:'invalid-heading-provenance',message:`${error.message} Ordinary import retains visible native text.`});}
  return {consumed,items};
}
