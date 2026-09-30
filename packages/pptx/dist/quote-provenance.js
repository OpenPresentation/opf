import {XMLParser} from 'fast-xml-parser';
import {validatePresentation} from '@openpresentation/opf';
import {attachTextTags,decodeTextTag} from './code-provenance.js';
import {sourceLineParagraphs} from './text-provenance.js';

// FF-57: a `quote` payload exports as native text lines (a body part and an optional footer part). Each line shape carries an
// OPF_QUOTE_V1 tag, so an unchanged export imports back as {quote: ...} instead of loose text blocks. Like timelines, only topology
// and line boundaries are stored: every word comes from the current native text, so a cleared or edited quote cannot bring back
// old words, and a group that no longer matches its manifest degrades to ordinary text blocks with a diagnostic.
const TAG='OPF_QUOTE_V1',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const SEPARATOR=' - ',FIELDS=['attribution','source'],FOOTERS=['["attribution"]','["source"]','["attribution","source"]'];
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const decoder=new TextDecoder('utf-8',{fatal:true}),array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
export const attachQuoteTags=(entries,records)=>attachTextTags(entries,records,TAG,'opfQuote','quote');

// The manifest rides on the first body line. `footer` lists which fields the footer part joins (core writes "attribution - source",
// skipping an absent field) and, when both are present, where the separator starts, so an unchanged footer splits back exactly.
export function quoteManifest(value,layout) {
  const shorthand=typeof value==='string',fields=shorthand?[]:FIELDS.filter(field=>value[field]);
  return {shorthand,...(fields.length?{footer:{fields,...(fields.length===2?{split:value.attribution.length}:{})}}:{}),
    parts:layout.parts.map(part=>({role:part.role,lines:part.fit.sourceLines.length}))};
}
function validateManifest(manifest) {
  if(!manifest||typeof manifest.shorthand!=='boolean'||!Array.isArray(manifest.parts)||manifest.parts.length<1||manifest.parts.length>2)throw Error('Invalid quote topology.');
  const roles=manifest.parts.map(part=>part?.role);
  if(roles[0]!=='body'||(roles.length===2&&roles[1]!=='footer'))throw Error('Invalid quote parts.');
  let count=0;
  for(const part of manifest.parts){
    if(!Number.isSafeInteger(part.lines)||part.lines<1||part.lines>10000)throw Error('Invalid quote line count.');
    count+=part.lines;
  }
  if(count>10000)throw Error('Too many quote source lines.');
  const footer=manifest.footer;
  if(roles.length===2){
    if(manifest.shorthand||!footer||!FOOTERS.includes(JSON.stringify(footer.fields)))throw Error('Invalid quote footer fields.');
    if(footer.fields.length===2?!Number.isSafeInteger(footer.split)||footer.split<1:footer.split!==undefined)throw Error('Invalid quote footer split.');
  }else if(footer!==undefined)throw Error('Invalid quote footer.');
  return count;
}

const unwrap=text=>text.length>=2&&text.startsWith('"')&&text.endsWith('"')?text.slice(1,-1):text;
// Split the current footer text back into fields. A footer edited so the recorded separator no longer matches splits at its
// first separator; one with none keeps everything as the attribution.
function footerFields(text,footer,report) {
  if(footer.fields.length===1)return {[footer.fields[0]]:text};
  const at=text.startsWith(SEPARATOR,footer.split)?footer.split:text.indexOf(SEPARATOR);
  if(at<0){
    report({code:'quote-footer-merged',message:'The quote footer no longer separates attribution from source; the current text is kept as the attribution.'});
    return {attribution:text};
  }
  return {attribution:text.slice(0,at),source:text.slice(at+SEPARATOR.length)};
}

export function importQuoteGroups(shapes,paragraphs,relationships,entries,report) {
  const groups=new Map(),consumed=new Set(),items=[];
  for(const [index,shape]of shapes.entries()){
    const tags=[];let unreadable=false;
    for(const link of array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])){
      const rel=relationships.get(link['r:id']);if(rel?.type!==REL||rel.targetMode==='External'||!entries[rel.path])continue;
      try{tags.push(...array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag']));}catch{unreadable=true;}
    }
    for(const tag of tags.filter(tag=>tag.name?.toUpperCase()===TAG))try{
      const data=decodeTextTag(tag.val);if(data?.v!==1||typeof data.group!=='string'||!/^\d{1,12}$/.test(data.group))throw Error('Invalid quote identity.');
      const group=groups.get(data.group)??[];group.push({shape,index,data,ambiguous:unreadable||tags.filter(tag=>/^OPF_/i.test(tag.name)).length!==1});groups.set(data.group,group);
    }catch{report({code:'invalid-quote-provenance',message:'Invalid quote tags; ordinary import retains current native text.'});}
  }
  for(const group of groups.values())try{
    const anchors=group.filter(item=>item.data.anchor!==undefined);if(anchors.length!==1)throw Error('Missing or duplicated quote anchor.');
    const anchor=anchors[0],manifest=anchor.data.anchor,count=validateManifest(manifest);
    if(anchor.data.role!=='text'||anchor.data.part!==0||anchor.data.line!==0||group.length!==count||new Set(group.map(item=>item.shape)).size!==count)throw Error('Incomplete or duplicated quote lines.');
    const ordered=manifest.parts.map(part=>Array(part.lines));
    for(const item of group){
      if(item.ambiguous)throw Error('Multiple source identities on one quote shape.');
      const {part,line}=item.data;
      if(item.data.role!=='text'||!Number.isSafeInteger(part)||!Number.isSafeInteger(line)||part<0||line<0||!manifest.parts[part]||line>=manifest.parts[part].lines||item.data.count!==manifest.parts[part].lines||ordered[part][line])throw Error('Ambiguous quote source line.');
      ordered[part][line]=item;
    }
    const [body,footer]=ordered.map(lines=>sourceLineParagraphs(lines,paragraphs)[0].text),local=[];
    let quote={text:unwrap(body)};
    if(footer)quote={...quote,...footerFields(footer,manifest.footer,diagnostic=>local.push(diagnostic))};
    if(manifest.shorthand&&Object.keys(quote).length===1)quote=quote.text;
    if(!validatePresentation({slides:[{quote}]}).valid)throw Error('Current native text does not form a valid quote.');
    for(const item of group)consumed.add(item.shape);
    items.push({shapes:group.map(item=>item.shape),payload:{type:'quote',quote}});
    for(const diagnostic of local)report(diagnostic);
    report({code:'quote-import-reflow',message:'Quote text, attribution and source were recovered from the current native text. Native formatting, positions and font theme are not reconstructed; review the reflowed quote.'});
  }catch(error){report({code:'invalid-quote-provenance',message:`${error.message} Ordinary import retains current native text without restoring old source words.`});}
  return {consumed,items};
}
