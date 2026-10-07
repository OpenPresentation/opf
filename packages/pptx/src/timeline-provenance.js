import {XMLParser} from 'fast-xml-parser';
import {isValidFormat} from './format-check.js';
import {attachTextTags,decodeTextTag} from './code-provenance.js';
import {sourceLineParagraphs} from './text-provenance.js';

const STATUSES=['done','current','planned'];
const TAG='OPF_TIMELINE_V1',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const decoder=new TextDecoder('utf-8',{fatal:true}),array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
export const attachTimelineTags=(entries,records)=>attachTextTags(entries,records,TAG,'opfTimeline','timeline');

// Only topology and line boundaries are retained. Every field value comes from
// current native text; clearing or editing a field cannot restore old words.
export function timelineManifest(value,layout) {
  return {shorthand:Array.isArray(value),eventCount:(Array.isArray(value)?value:value.events).length,
    parts:layout.parts.map(part=>({eventIndex:part.eventIndex,field:part.role==='event-description'?'description':part.role,lines:part.fit.sourceLines.length}))};
}
function validateManifest(manifest) {
  if(!manifest||typeof manifest.shorthand!=='boolean'||!Number.isSafeInteger(manifest.eventCount)||manifest.eventCount<1||manifest.eventCount>10000||!Array.isArray(manifest.parts)||manifest.parts.length>10000)throw Error('Invalid timeline topology.');
  const keys=[],fields=new Set();let count=0;
  for(const part of manifest.parts){
    if(!part||!Number.isSafeInteger(part.lines)||part.lines<1||part.lines>10000)throw Error('Invalid timeline line count.');
    if(part.eventIndex===undefined){if(manifest.shorthand||!['name','description'].includes(part.field))throw Error('Invalid timeline metadata field.');}
    else if(!Number.isSafeInteger(part.eventIndex)||part.eventIndex<0||part.eventIndex>=manifest.eventCount||!['when','what','description'].includes(part.field))throw Error('Invalid timeline event field.');
    const key=`${part.eventIndex??'metadata'}:${part.field}`;if(fields.has(key))throw Error('Duplicated timeline field.');fields.add(key);keys.push(key);count+=part.lines;
  }
  if(count>10000)throw Error('Too many timeline source lines.');
  const expected=['name','description'].map(field=>`metadata:${field}`).filter(key=>fields.has(key));
  for(let index=0;index<manifest.eventCount;index++){
    if(!fields.has(`${index}:what`))throw Error('Missing timeline event label.');
    for(const field of ['when','what','description'])if(fields.has(`${index}:${field}`))expected.push(`${index}:${field}`);
  }
  if(JSON.stringify(keys)!==JSON.stringify(expected))throw Error('Invalid timeline source order.');
  return count;
}

export function importTimelineGroups(shapes,paragraphs,relationships,entries,report) {
  const groups=new Map(),consumed=new Set(),items=[];
  for(const [index,shape]of shapes.entries()){
    const tags=[];let unreadable=false;
    for(const link of array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])){
      const rel=relationships.get(link['r:id']);if(rel?.type!==REL||rel.targetMode==='External'||!entries[rel.path])continue;
      try{tags.push(...array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag']));}catch{unreadable=true;}
    }
    for(const tag of tags.filter(tag=>tag.name?.toUpperCase()===TAG))try{
      const data=decodeTextTag(tag.val);if(data?.v!==1||typeof data.group!=='string'||!/^\d{1,12}$/.test(data.group))throw Error('Invalid timeline identity.');
      const group=groups.get(data.group)??[];group.push({shape,index,data,ambiguous:unreadable||tags.filter(tag=>/^OPF_/i.test(tag.name)).length!==1});groups.set(data.group,group);
    }catch{report({code:'invalid-timeline-provenance',message:'Invalid timeline tags; ordinary import retains current native text.'});}
  }
  for(const group of groups.values())try{
    const anchors=group.filter(item=>item.data.anchor!==undefined);if(anchors.length!==1)throw Error('Missing or duplicated timeline anchor.');
    const anchor=anchors[0],manifest=anchor.data.anchor,count=validateManifest(manifest);
    // A current event's ring is a second native ellipse with its own tag, so the group has one more shape per ring.
    const total=count+manifest.eventCount+1+group.filter(item=>item.data.role==='ring').length;
    if(anchor.data.role!=='text'||anchor.data.part!==0||anchor.data.line!==0||group.length!==total||new Set(group.map(item=>item.shape)).size!==total)throw Error('Incomplete or duplicated timeline elements.');
    const ordered=manifest.parts.map(part=>Array(part.lines)),markers=new Set(),rings=new Set(),statuses=new Map();let connectors=0;
    for(const item of group){
      if(item.ambiguous)throw Error('Multiple source identities on one timeline shape.');
      if(item.data.role==='connector'||item.data.role==='marker'||item.data.role==='ring'){
        const expected=item.data.role==='connector'?'line':'ellipse';
        if(item.shape['p:spPr']?.['a:prstGeom']?.prst!==expected||(paragraphs[item.index]??[]).some(paragraph=>paragraph.text||paragraph.bullet))throw Error('Timeline graphic now contains different geometry or native text.');
        if(item.data.role==='connector'){if(++connectors>1)throw Error('Duplicated timeline connector.');}
        else{
          const index=item.data.eventIndex,known=item.data.role==='marker'?markers:rings;
          if(!Number.isSafeInteger(index)||index<0||index>=manifest.eventCount||known.has(index))throw Error('Ambiguous timeline marker.');
          known.add(index);
          if(item.data.role==='marker'&&item.data.status!==undefined){if(!STATUSES.includes(item.data.status))throw Error('Invalid timeline event status.');statuses.set(index,item.data.status);}
        }
        continue;
      }
      const {part,line}=item.data;
      if(item.data.role!=='text'||!Number.isSafeInteger(part)||!Number.isSafeInteger(line)||part<0||line<0||!manifest.parts[part]||line>=manifest.parts[part].lines||item.data.count!==manifest.parts[part].lines||ordered[part][line])throw Error('Ambiguous timeline source line.');
      ordered[part][line]=item;
    }
    if(connectors!==1||markers.size!==manifest.eventCount)throw Error('Incomplete timeline graphics.');
    // Only a current event has a ring, and every current event has one.
    for(const index of rings)if(statuses.get(index)!=='current')throw Error('Timeline ring without a current event.');
    for(const [index,status] of statuses)if(status==='current'&&!rings.has(index))throw Error('Current timeline event without its ring.');
    const result={events:Array.from({length:manifest.eventCount},()=>({}))};
    for(const [index,part]of manifest.parts.entries()){
      const text=sourceLineParagraphs(ordered[index],paragraphs)[0].text;
      if(part.eventIndex===undefined)result[part.field]=text;else result.events[part.eventIndex][part.field]=text;
    }
    for(const [index,status] of statuses)result.events[index].status=status;
    const timeline=manifest.shorthand?result.events:result;
    if(!isValidFormat({slides:[{timeline}]}))throw Error('Current native text does not form a valid timeline.');
    for(const item of group)consumed.add(item.shape);
    items.push({shapes:group.map(item=>item.shape),payload:{type:'timeline',timeline}});
    report({code:'timeline-import-reflow',message:'Timeline field order, source boundaries and current native text were recovered. Native formatting, positions, marker styling and font theme are not reconstructed; review the reflowed timeline.'});
  }catch(error){report({code:'invalid-timeline-provenance',message:`${error.message} Ordinary import retains current native text without restoring old source words.`});}
  return {consumed,items};
}
