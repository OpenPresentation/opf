import {XMLParser} from 'fast-xml-parser';
import {attachTextTags,decodeTextTag,groupUnchanged} from './code-provenance.js';
import {sourceLineParagraphs} from './text-provenance.js';
const TAG='OPF_IMAGE_CALLOUT_V1',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const decoder=new TextDecoder('utf-8',{fatal:true}),array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
export const attachImageCalloutTags=(entries,records)=>attachTextTags(entries,records,TAG,'opfImageCallout','image callout',{signed:true});

// Source metadata contains coordinates and line boundaries, never old source words.
// A current valid picture owns the panels. Any incomplete or changed geometry stays ordinary native content.
export function importImageCallouts({shapes,paragraphs,pictures,relationships,entries,validPictures,report}) {
  const groups=new Map(),consumed=new Set(),values=new Map();
  for(const [index,shape]of shapes.entries()) {
    const tags=[];let unreadable=false;
    for(const link of array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])) {
      const rel=relationships.get(link['r:id']);if(rel?.type!==REL||rel.targetMode==='External'||!entries[rel.path])continue;
      try{tags.push(...array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag']));}catch{unreadable=true;}
    }
    for(const tag of tags.filter(tag=>tag.name?.toUpperCase()===TAG))try {
      const data=decodeTextTag(tag.val);
      if(data?.v!==1||typeof data.owner!=='string'||!/^OPF image \d+$/.test(data.owner))throw Error('Invalid picture owner.');
      const group=groups.get(data.owner)??[];group.push({shape,index,data,ambiguous:unreadable||tags.filter(tag=>/^OPF_/i.test(tag.name)).length!==1});groups.set(data.owner,group);
    }catch{report({code:'invalid-image-callout-provenance',message:'Invalid image callout tag; ordinary import preserves current native text.'});}
  }
  for(const [owner,group]of groups)try {
    const owners=pictures.flatMap((picture,index)=>picture['p:nvPicPr']?.['p:cNvPr']?.name===owner?[index]:[]);
    if(owners.length!==1||!validPictures.has(owners[0]))throw Error('The image owner no longer has valid picture geometry.');
    const panels=group.filter(item=>item.data.role==='panel'),total=panels[0]?.data.total;
    if(!Number.isSafeInteger(total)||total<1||total>10000||panels.length!==total)throw Error('Missing callout panels.');
    const result=Array(total),used=new Set();
    for(const panel of panels) {
      const {index,frame,lines}=panel.data;
      if(panel.ambiguous||panel.data.total!==total||!Number.isSafeInteger(index)||index<0||index>=total||result[index]||!Number.isSafeInteger(lines)||lines<1||lines>10000)throw Error('Ambiguous callout panel.');
      if(!frame||Object.keys(frame).some(key=>!['x','y','width','height'].includes(key))||['x','y','width','height'].some(key=>typeof frame[key]!=='number'||!Number.isFinite(frame[key])||frame[key]<0||frame[key]>1)||frame.width<=0||frame.height<=0)throw Error('Invalid fractional frame.');
      const transform=panel.shape['p:spPr']?.['a:xfrm'];
      const flipped=value=>value!==undefined&&value!==false&&value!==0&&value!=='0'&&value!=='false';
      // PowerPoint adds a blank text body to a rectangle that exported without one.
      // Reject visible words/bullets, then compare the original EXACT geometry signature with no panel paragraphs.
      if(panel.shape['p:spPr']?.['a:prstGeom']?.prst!=='rect'||Number(transform?.rot??0)!==0||flipped(transform?.flipH)||flipped(transform?.flipV)||(paragraphs[panel.index]??[]).some(p=>p.text||p.bullet)||!groupUnchanged([panel],[]))throw Error('The native callout panel was moved or changed.');
      const parts=group.filter(item=>item.data.role==='text'&&item.data.index===index),ordered=Array(lines);
      if(parts.length!==lines)throw Error('Missing callout source lines.');
      for(const part of parts) {
        const data=part.data;
        if(part.ambiguous||data.count!==lines||!Number.isSafeInteger(data.line)||data.line<0||data.line>=lines||ordered[data.line])throw Error('Ambiguous callout source line.');
        ordered[data.line]=part;used.add(part);
      }
      result[index]={...frame,text:sourceLineParagraphs(ordered,paragraphs)[0].text};used.add(panel);
    }
    if(used.size!==group.length||new Set(group.map(item=>item.shape)).size!==group.length||result.some(value=>!value))throw Error('Duplicated or unknown callout elements.');
    values.set(owners[0],result);for(const item of group)consumed.add(item.index);
    if(!group.every(item=>groupUnchanged([item],item.data.role==='panel'?[]:paragraphs)))report({code:'image-callout-import-reflow',message:'Current native callout words and authored fractional frames were recovered. Native text formatting, panel fill/line styling and positions reflow from OPF; review the labels.'});
  }catch(error){report({code:'invalid-image-callout-provenance',message:`${error.message} Ordinary import preserves the current native panels and text.`});}
  return {consumed,values};
}
