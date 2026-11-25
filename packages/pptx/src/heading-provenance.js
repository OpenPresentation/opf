import {XMLParser} from 'fast-xml-parser';
import {attachTextTags,decodeTextTag,groupUnchanged} from './code-provenance.js';
import {sourceLineParagraphs} from './text-provenance.js';
import {cleanBase,headingValue,joinRichLines} from './rich-heading.js';
import {rejoinDetachedSpace} from './content-topology.js';
import {currentThemeLook} from './document-provenance.js';
const TAG='OPF_HEADING_V1',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const decoder=new TextDecoder('utf-8',{fatal:true}),array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export const attachHeadingTags=(entries,records)=>attachTextTags(entries,records,TAG,'opfHeading','heading',{signed:true});

// RR-105 (opf#1291): a title of fixed lines (tag lineBreaks 'paragraphs') is one paragraph per line; the paragraphs an authored hard break
// starts are listed (`hard`) and stay a "\n", every other paragraph break is a soft wrap and joins its lines. When PowerPoint's
// paragraphs are no longer the exported lines (an edit added, removed or joined one), which breaks were wraps is unknown, so every
// paragraph break is read as the line break the user sees ("\n"): no words run together and none is lost. A line break inside a
// paragraph (Shift+Enter in PowerPoint) is text, a "\n".
function hardBreaksOf(data,count) {
  if(count!==data.lines)return {has:index=>index>0};
  return Array.isArray(data.hard)?new Set(data.hard.filter(index=>Number.isSafeInteger(index))):new Set();
}
function joinTitleParagraphs(list,data) {
  if(!Array.isArray(list)||list.length<2)return list;
  const hard=hardBreaksOf(data,list.length);
  const text=list.map((paragraph,index)=>(index&&hard.has(index)?'\n':'')+String(paragraph?.text??'')).join('');
  const merged={...list[0],text,maxFontSize:Math.max(0,...list.map(paragraph=>paragraph?.maxFontSize??0))};
  if(!list.some(paragraph=>paragraph?.richText!==undefined))return [merged];
  const runs=[];
  for(const [index,paragraph] of list.entries()) {
    const current=array(paragraph?.richText??paragraph?.text).map(run=>object(run)?{...run}:run);
    if(index&&hard.has(index))runs.push('\n');
    // A decorated run's space that ended the earlier line joins the run again (as across line shapes).
    else if(index&&current.length)rejoinDetachedSpace(runs,current[0]);
    runs.push(...current);
  }
  return [{...merged,richText:runs}];
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
    // RR-105 (opf#1291): a title of fixed lines, one paragraph per line (joinTitleParagraphs).
    const fixed=count===1&&first.lineBreaks==='paragraphs'?ordered[0].index:undefined;
    const lines=fixed===undefined?paragraphs:paragraphs.map((list,index)=>index===fixed?joinTitleParagraphs(list,first):list);
    const body=fixed===undefined||!readBody?readBody:(index,...rest)=>{const value=readBody(index,...rest);return index===fixed?joinTitleParagraphs(value,first):value;};
    const restored=sourceLineParagraphs(ordered,lines,{legacy:true});
    for(const item of ordered)consumed.add(item.shape);
    // The same boundaries as the plain text: a new tag's separator, or a native line break between legacy-tagged lines.
    const source=ordered.some(item=>item.data.boundary!==undefined||item.data.separator!==undefined);
    // Only a rich export records the heading's own look (tag.base); a heading exported as a plain string stays one.
    // RR-105 (opf#1293): the recorded look in the theme's current faces (a theme font change made in PowerPoint is the document's).
    const base=currentThemeLook(entries,cleanBase(ordered[0].data.base));
    const parts=base?joinRichLines(ordered,body,(item,last)=>source?item.data.separator:last?'':'\n'):undefined;
    items.push({field:first.field,shapes:ordered.map(item=>item.shape),paragraphs:restored,...(parts?{richText:headingValue(parts,base)}:{})});
    if(!groupUnchanged(ordered,paragraphs))report({code:'heading-import-reflow',message:'Complete tagged heading lines retain their roles, order and current native text. New boundary tags also retain authored whitespace and line endings; legacy tags retain native line breaks. Run formatting that differs between words is read back as TextRun[]; geometry is not reconstructed.'});
  }catch(error){report({code:'invalid-heading-provenance',message:`${error.message} Ordinary import retains visible native text.`});}
  return {consumed,items};
}
