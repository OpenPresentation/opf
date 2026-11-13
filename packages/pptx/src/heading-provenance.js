import {XMLParser} from 'fast-xml-parser';
import {attachTextTags,decodeTextTag,groupUnchanged} from './code-provenance.js';
import {sourceLineParagraphs} from './text-provenance.js';
import {cleanBase,headingValue,joinRichLines} from './rich-heading.js';
import {rejoinDetachedSpace} from './content-topology.js';
const TAG='OPF_HEADING_V1',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const decoder=new TextDecoder('utf-8',{fatal:true}),array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export const attachHeadingTags=(entries,records)=>attachTextTags(entries,records,TAG,'opfHeading','heading',{signed:true});

// One paragraph of a fixed-line title without its line breaks: a decorated run's space that ended a line joins the run again.
function withoutLineBreaks(paragraph) {
  if(!object(paragraph))return paragraph;
  const runs=[];
  let joined=false;
  for(const run of array(paragraph.richText??paragraph.text)) {
    const text=typeof run==='string'?run:run?.text;
    if(typeof text==='string'&&/^\n+$/.test(text)){joined=true;continue;}
    const current=typeof run==='string'?run.replace(/\n/g,''):object(run)&&typeof run.text==='string'?{...run,text:run.text.replace(/\n/g,'')}:run;
    if(joined)rejoinDetachedSpace(runs,current);
    joined=false;
    runs.push(current);
  }
  return {...paragraph,text:String(paragraph.text??'').replace(/\n/g,''),...(paragraph.richText!==undefined?{richText:runs}:{})};
}

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
    // RR-105 (opf#1291): a title written as one box of fixed lines (lineBreaks 'wrap') holds core's soft wraps as line breaks (a:br, read
    // as "\n" inside a paragraph); they are wraps, not text. An authored hard break is a new paragraph and stays one.
    const wraps=count===1&&first.lineBreaks==='wrap'?ordered[0].index:undefined;
    const lines=wraps===undefined?paragraphs:paragraphs.map((list,index)=>index===wraps?(list??[]).map(paragraph=>({...paragraph,text:String(paragraph.text??'').replace(/\n/g,'')})):list);
    const body=wraps===undefined||!readBody?readBody:(index,...rest)=>{const value=readBody(index,...rest);return index===wraps&&Array.isArray(value)?value.map(withoutLineBreaks):value;};
    const restored=sourceLineParagraphs(ordered,lines,{legacy:true});
    for(const item of ordered)consumed.add(item.shape);
    // The same boundaries as the plain text: a new tag's separator, or a native line break between legacy-tagged lines.
    const source=ordered.some(item=>item.data.boundary!==undefined||item.data.separator!==undefined);
    // Only a rich export records the heading's own look (tag.base); a heading exported as a plain string stays one.
    const base=cleanBase(ordered[0].data.base);
    const parts=base?joinRichLines(ordered,body,(item,last)=>source?item.data.separator:last?'':'\n'):undefined;
    items.push({field:first.field,shapes:ordered.map(item=>item.shape),paragraphs:restored,...(parts?{richText:headingValue(parts,base)}:{})});
    if(!groupUnchanged(ordered,paragraphs))report({code:'heading-import-reflow',message:'Complete tagged heading lines retain their roles, order and current native text. New boundary tags also retain authored whitespace and line endings; legacy tags retain native line breaks. Run formatting that differs between words is read back as TextRun[]; geometry is not reconstructed.'});
  }catch(error){report({code:'invalid-heading-provenance',message:`${error.message} Ordinary import retains visible native text.`});}
  return {consumed,items};
}
