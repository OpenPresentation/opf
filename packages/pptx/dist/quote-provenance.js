import {XMLParser} from 'fast-xml-parser';
import {isValidFormat} from './format-check.js';
import {attachTextTags,decodeTextTag} from './code-provenance.js';
import {sourceLineParagraphs} from './text-provenance.js';
import {cleanBase,headingValue,joinRichLines,unwrapQuoteRuns} from './rich-heading.js';

// FF-57: a `quote` payload exports as native text lines (a body part and an optional footer part). Each line shape carries an
// OPF_QUOTE_V1 tag, so an unchanged export imports back as {quote: ...} instead of loose text blocks. Like timelines, only topology
// and line boundaries are stored: every word comes from the current native text, so a cleared or edited quote cannot bring back
// old words, and a group that no longer matches its manifest degrades to ordinary text blocks with a diagnostic.
// FA-12: a quote with a `photo` also exports one native picture (an ellipse), tagged with the same group; import restores `photo` from
// that picture's current bytes and description, and `role` from the footer.
const TAG='OPF_QUOTE_V1',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const SEPARATOR=' - ',FIELDS=['attribution','role','source'];
// Every non-empty footer field list, in core's order (attribution, role, source).
const FOOTERS=['["attribution"]','["role"]','["source"]','["attribution","role"]','["attribution","source"]','["role","source"]','["attribution","role","source"]'];
// Core joins the role to the line above with a line break and the source with " - ".
const separatorBefore=field=>field==='role'?'\n':SEPARATOR;
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const decoder=new TextDecoder('utf-8',{fatal:true}),array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
export const attachQuoteTags=(entries,records)=>attachTextTags(entries,records,TAG,'opfQuote','quote',{pictures:true});
export const quotePhotoName=group=>`OPF quote photo ${group}`;

// The manifest rides on the first body line. `footer` lists which fields the footer part joins (core writes the attribution, the role
// on its own line and the source after " - ", skipping an absent field) and, from two fields on, where each separator starts, so an
// unchanged footer splits back exactly. `photo` records that a headshot picture belongs to the quote.
export function quoteManifest(value,layout) {
  const shorthand=typeof value==='string',fields=shorthand?[]:FIELDS.filter(field=>value[field]);
  const splits=[];let length=0;
  for(const [index,field] of fields.entries()){
    if(index>0){splits.push(length);length+=separatorBefore(field).length;}
    length+=value[field].length;
  }
  return {shorthand,...(fields.length?{footer:{fields,...(fields.length>1?{splits}:{})}}:{}),...(layout.photo?{photo:true}:{}),
    // A rich body (FA-10) has richLines instead of sourceLines; both write one native shape per fitted line.
    parts:layout.parts.map(part=>({role:part.role,lines:(part.fit.sourceLines??part.fit.lines).length}))};
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
  if(manifest.photo!==undefined&&(manifest.photo!==true||manifest.shorthand))throw Error('Invalid quote photo.');
  const footer=manifest.footer;
  if(roles.length===2){
    if(manifest.shorthand||!footer||!FOOTERS.includes(JSON.stringify(footer.fields)))throw Error('Invalid quote footer fields.');
    const splits=footer.splits;
    if(footer.fields.length>1?!Array.isArray(splits)||splits.length!==footer.fields.length-1||splits.some(at=>!Number.isSafeInteger(at)||at<0):splits!==undefined)throw Error('Invalid quote footer split.');
  }else if(footer!==undefined)throw Error('Invalid quote footer.');
  return count;
}

const unwrap=text=>text.length>=2&&text.startsWith('"')&&text.endsWith('"')?text.slice(1,-1):text;
// Split the current footer text back into fields. A separator whose recorded position no longer matches is searched for from the end of
// the previous field; a footer with a missing separator keeps everything as the attribution.
function footerFields(text,footer,report) {
  const {fields}=footer;
  if(fields.length===1)return {[fields[0]]:text};
  const out={};let from=0;
  for(let index=1;index<fields.length;index++){
    const separator=separatorBefore(fields[index]),recorded=footer.splits[index-1];
    const at=recorded>=from&&text.startsWith(separator,recorded)?recorded:text.indexOf(separator,from);
    if(at<0){
      report({code:'quote-footer-merged',message:'The quote footer no longer separates its attribution, role and source; the current text is kept as the attribution.'});
      return {attribution:text};
    }
    out[fields[index-1]]=text.slice(from,at);from=at+separator.length;
  }
  out[fields.at(-1)]=text.slice(from);
  return out;
}

// `pictures` and `readPicture` (the ordinary picture importer) restore the headshot of a quote with a photo.
// `readBody` (optional) is the native body reader: with it the quote text keeps its native run formatting as TextRun[] (FA-10).
export function importQuoteGroups(shapes,paragraphs,relationships,entries,report,pictures=[],readPicture=()=>undefined,readBody) {
  const groups=new Map(),consumed=new Set(),consumedPictures=new Set(),items=[];
  const candidates=[...shapes.map((shape,index)=>({index,shape,container:shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']})),
    ...pictures.map((picture,index)=>({index,picture,container:picture['p:nvPicPr']?.['p:nvPr']?.['p:custDataLst']}))];
  for(const {index,shape,picture,container}of candidates){
    const tags=[];let unreadable=false;
    for(const link of array(container?.['p:tags'])){
      const rel=relationships.get(link['r:id']);if(rel?.type!==REL||rel.targetMode==='External'||!entries[rel.path])continue;
      try{tags.push(...array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag']));}catch{unreadable=true;}
    }
    for(const tag of tags.filter(tag=>tag.name?.toUpperCase()===TAG))try{
      const data=decodeTextTag(tag.val);if(data?.v!==1||typeof data.group!=='string'||!/^\d{1,12}$/.test(data.group))throw Error('Invalid quote identity.');
      const group=groups.get(data.group)??[];group.push({shape,picture,index,data,ambiguous:unreadable||tags.filter(tag=>/^OPF_/i.test(tag.name)).length!==1});groups.set(data.group,group);
    }catch{report({code:'invalid-quote-provenance',message:'Invalid quote tags; ordinary import retains current native text.'});}
  }
  for(const members of groups.values())try{
    const group=members.filter(item=>!item.picture),photos=members.filter(item=>item.picture);
    const anchors=group.filter(item=>item.data.anchor!==undefined);if(anchors.length!==1)throw Error('Missing or duplicated quote anchor.');
    const anchor=anchors[0],manifest=anchor.data.anchor,count=validateManifest(manifest);
    if(anchor.data.role!=='text'||anchor.data.part!==0||anchor.data.line!==0||group.length!==count||new Set(group.map(item=>item.shape)).size!==count)throw Error('Incomplete or duplicated quote lines.');
    if(photos.length>(manifest.photo?1:0)||photos.some(item=>item.ambiguous||item.data.role!=='photo'||item.picture['p:nvPicPr']?.['p:cNvPr']?.name!==quotePhotoName(anchor.data.group)))throw Error('Invalid quote photo identity.');
    const ordered=manifest.parts.map(part=>Array(part.lines));
    for(const item of group){
      if(item.ambiguous)throw Error('Multiple source identities on one quote shape.');
      const {part,line}=item.data;
      if(item.data.role!=='text'||!Number.isSafeInteger(part)||!Number.isSafeInteger(line)||part<0||line<0||!manifest.parts[part]||line>=manifest.parts[part].lines||item.data.count!==manifest.parts[part].lines||ordered[part][line])throw Error('Ambiguous quote source line.');
      ordered[part][line]=item;
    }
    const [body,footer]=ordered.map(lines=>sourceLineParagraphs(lines,paragraphs)[0].text),local=[];
    let quote={text:unwrap(body)};
    // The body lines are one logical text: rich runs when any word is formatted differently from the rest.
    // Only a rich export records the body's own look (tag.base); a plain string quote stays a string.
    const base=cleanBase(ordered[0][0]?.data.base);
    const richParts=base?joinRichLines(ordered[0],readBody,(line,last)=>last?'':line.data.boundary==='hard'?(line.data.separator||'\n'):''):undefined;
    const rich=richParts?unwrapQuoteRuns(headingValue(richParts,base)):undefined;
    // Only when it reads as the same words as the plain path (the native text is authoritative).
    if(Array.isArray(rich)&&rich.map(run=>typeof run==='string'?run:run.text).join('')===quote.text)quote={text:rich};
    if(footer)quote={...quote,...footerFields(footer,manifest.footer,diagnostic=>local.push(diagnostic))};
    // The headshot is the current native picture; a deleted or unreadable one is reported, never invented.
    if(manifest.photo){
      const image=photos[0]?readPicture(photos[0].picture)?.payload?.image:undefined;
      if(image)quote={...quote,photo:image};
      else local.push({code:'quote-photo-missing',message:"The quote's headshot picture is missing or unreadable; the quote is imported without a photo."});
    }
    if(manifest.shorthand&&Object.keys(quote).length===1)quote=quote.text;
    if(!isValidFormat({slides:[{quote}]}))throw Error('Current native text does not form a valid quote.');
    for(const item of group)consumed.add(item.shape);
    for(const item of photos)consumedPictures.add(item.picture);
    items.push({shapes:group.map(item=>item.shape),pictures:photos.map(item=>item.picture),payload:{type:'quote',quote}});
    for(const diagnostic of local)report(diagnostic);
    report({code:'quote-import-reflow',message:'Quote text, attribution, role, source and photo were recovered from the current native text and picture. Native formatting, positions and font theme are not reconstructed; review the reflowed quote.'});
  }catch(error){report({code:'invalid-quote-provenance',message:`${error.message} Ordinary import retains current native text without restoring old source words.`});}
  return {consumed,consumedPictures,items};
}
