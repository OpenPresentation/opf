import {XMLParser} from 'fast-xml-parser';
import {attachTextTags,decodeTextTag} from './code-provenance.js';

const TAG='OPF_CARD_V1',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const decoder=new TextDecoder('utf-8',{fatal:true}),array=v=>v===undefined?[]:Array.isArray(v)?v:[v];
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);

// A name alone is never sufficient to remove a shape during import. Bind the
// generated empty frame to its serialized properties through native shape tags.
export function attachCardTags(entries,names) {
  if(!names.size)return;
  const records=new Map();
  for(const path of Object.keys(entries).filter(path=>/^ppt\/slides\/slide\d+\.xml$/.test(path))){
    const tree=parser.parse(decoder.decode(entries[path]))['p:sld']['p:cSld']['p:spTree'];
    for(const shape of array(tree['p:sp'])){
      const name=shape['p:nvSpPr']?.['p:cNvPr']?.name;
      if(names.has(name)){
        if(records.has(name))throw Error('Duplicate generated card frame.');
        records.set(name,{v:1,path:names.get(name),properties:shape['p:spPr'],style:shape['p:style']??null});
      }
    }
  }
  if(records.size!==names.size)throw Error('Missing generated card frame.');
  attachTextTags(entries,records,TAG,'opfCard','card');
}

export function importCardFrames(shapes,paragraphs,relationships,entries,report) {
  const consumed=new Set();
  for(const [index,shape]of shapes.entries()){
    const properties=shape['p:spPr'],identity=shape['p:nvSpPr']?.['p:cNvPr'],tags=[];
    let unreadable=false;
    for(const link of array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])){
      const rel=relationships.get(link['r:id']);
      if(rel?.type!==REL||rel.targetMode==='External'||!entries[rel.path])continue;
      try{tags.push(...array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag']));}catch{unreadable=true;}
    }
    const candidates=tags.filter(tag=>tag.name?.toUpperCase()===TAG);
    if(!candidates.length)continue;
    try{
      if(unreadable||candidates.length!==1||tags.some(tag=>/^OPF_/i.test(tag.name)&&tag.name.toUpperCase()!==TAG))throw Error('Ambiguous frame identity.');
      const manifest=decodeTextTag(candidates[0].val);
      if(manifest.v!==1||typeof manifest.path!=='string'||!manifest.path.startsWith('slides.')||identity?.name!==`OPF card ${manifest.path}`)throw Error('Invalid frame identity.');
      if((paragraphs[index]??[]).some(p=>p.text.length)||Object.keys(identity).some(key=>!['id','name'].includes(key)))throw Error('Frame has native content or metadata.');
      if(properties?.['a:prstGeom']?.prst!=='roundRect'||canonical(properties)!==canonical(manifest.properties)||canonical(shape['p:style']??null)!==canonical(manifest.style))throw Error('Frame styling or geometry changed.');
      consumed.add(shape);
      report({code:'content-card-reflow',message:'An unchanged tagged OPF content card was recognized as decoration. Its native frame styling and placement are not reconstructed in the reflowed document.'});
    }catch{report({code:'invalid-card-provenance',message:'Edited, ambiguous or invalid card frame passed to ordinary native import, which retains its text or an unsupported-shape description. Inspect the original PPTX for frame appearance and metadata.'});}
  }
  return consumed;
}
