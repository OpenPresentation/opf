import {listBlockContainers,prepareBlockInsert} from './blocks.js';

const payloadFields=['text','items','bullets','image','video','chart','table','code','metric','quote','timeline'];
const headingFields=new Set(['title','subtitle','tag']);
const fields={text:'text',list:'items',picture:'image',media:'video',diagram:'image',chart:'chart',table:'table',code:'code',metric:'metric',quote:'quote',timeline:'timeline'};
const region=key=>/^(?:(?:top|middle|bottom)(?:\+(?:top|middle|bottom))*(?::(?:left|center|right)(?:\+(?:left|center|right))*)?|(?:left|center|right)(?:\+(?:left|center|right))*)$/.test(key);

function emptyPayload(field){
  if(field==='items')return [];
  if(field==='chart')return {type:'bar',data:{columns:['',''],rows:[['',null]]}};
  if(field==='table')return {rows:[]};
  if(field==='metric')return {value:'',label:''};
  if(field==='quote')return {text:'',attribution:''};
  if(field==='timeline')return {events:[{when:'',what:''}]};
  return '';
}

/** Supply authored slots without replacing content, metadata or region placement. */
export function populateLayoutPlaceholders(document,slideIndex,types){
  let next=structuredClone(document),slide=next.slides[slideIndex];
  const counts=new Map();
  function count(host){
    if(!host||typeof host!=='object')return;
    if(Array.isArray(host.blocks)){host.blocks.forEach(count);return;}
    for(const field of payloadFields)if(Object.hasOwn(host,field)){
      // Bullet text occupies a text slot; rich-text runs are one payload.
      const key=field==='bullets'?'text':field;
      counts.set(key,(counts.get(key)??0)+1);
    }
  }
  const regions=Object.keys(slide).filter(region);
  if(regions.length)regions.forEach(key=>count(slide[key]));else count(slide);
  for(const type of types){
    if(headingFields.has(type)){
      if(!Object.hasOwn(slide,type))slide[type]='';
      continue;
    }
    const field=fields[type];
    if(!field)continue;
    const remaining=counts.get(field)??0;
    if(remaining){counts.set(field,remaining-1);continue;}
    const value=emptyPayload(field);
    // Distinct implicit root payloads can coexist. Repeated kinds need blocks.
    if(!regions.length&&!Array.isArray(slide.blocks)&&!slide.type&&!Object.hasOwn(slide,field))slide[field]=value;
    else {
      // Keep positioned content in its region. Append to the last outer region,
      // rather than creating root blocks that would hide the existing regions.
      const path=regions.length?`/slides/${slideIndex}/${regions.at(-1)}`:`/slides/${slideIndex}`;
      const containers=listBlockContainers(next,{slideIndex,includeImplicit:true});
      if(!containers.some(container=>container.path===path))throw new Error('This slide has no editable content container for the new placeholder.');
      next=prepareBlockInsert(next,path,{[field]:value}).document;
      slide=next.slides[slideIndex];
    }
  }
  return next;
}
