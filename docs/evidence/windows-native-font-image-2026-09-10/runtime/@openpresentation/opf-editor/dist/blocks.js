import {splitOpfPath,opfPathToJsonPointer,getValueAtPath,applyJsonPatch,validateOpfDocument} from './index.js';
const prefix=(a,b)=>a.length<=b.length&&a.every((part,i)=>part===b[i]);

/** Move one complete block. The insertion index refers to the destination before removal. */
export function prepareBlockMove(document,fromPath,toContainerPath,toIndex) {
  const from=splitOpfPath(fromPath),to=splitOpfPath(toContainerPath);
  if(from.at(-2)!=='blocks'||!/^(0|[1-9][0-9]*)$/.test(from.at(-1)??''))throw new TypeError('Move a complete block using its blocks/index path.');
  const sourceIndex=Number(from.at(-1)),sourceContainer=from.slice(0,-2),sourceArray=from.slice(0,-1);
  const containers=new Set(listBlockContainers(document).map(item=>item.path));
  if(!containers.has(opfPathToJsonPointer(sourceContainer))||!containers.has(opfPathToJsonPointer(to)))throw new TypeError('Choose slide or group block containers.');
  const source=getValueAtPath(document,sourceArray),destination=getValueAtPath(document,[...to,'blocks']);
  if(!Array.isArray(source)||sourceIndex>=source.length||!Array.isArray(destination))throw new RangeError('Source and destination must be existing block containers.');
  if(!Number.isInteger(toIndex)||toIndex<0||toIndex>destination.length)throw new RangeError('Destination insertion index is out of range.');
  if(prefix(from,to))throw new Error('A group cannot move into itself or one of its descendants.');
  const same=JSON.stringify(sourceContainer)===JSON.stringify(to);
  const index=same&&toIndex>sourceIndex?toIndex-1:toIndex;
  if(same&&index===sourceIndex)return {document:structuredClone(document),patches:[],path:opfPathToJsonPointer(from),changed:false};
  if(!same&&source.length===1)throw new Error('This move would leave an empty block container. Move the group or add another block first.');
  // Removing a preceding sibling shifts a destination group's address.
  const rebased=[...to];
  if(!same&&prefix(sourceArray,to)&&/^(0|[1-9][0-9]*)$/.test(to[sourceArray.length]??'')&&Number(to[sourceArray.length])>sourceIndex)
    rebased[sourceArray.length]=String(Number(to[sourceArray.length])-1);
  const target=[...rebased,'blocks',String(index)];
  const guards=[sourceContainer,...(same?[]:[to])].filter((path,i,all)=>!all.some((other,j)=>j!==i&&other.length<path.length&&prefix(other,path)));
  const patches=[...guards.map(path=>({op:'test',path:opfPathToJsonPointer(path),value:structuredClone(getValueAtPath(document,path))})),
    {op:'remove',path:opfPathToJsonPointer(from)},
    {op:'add',path:opfPathToJsonPointer(target),value:structuredClone(source[sourceIndex])}];
  const next=applyJsonPatch(document,patches),validation=validateOpfDocument(next);
  if(!validation.valid)throw new Error(validation.errors[0]?.message??'The moved document is not valid OPF.');
  return {document:next,patches,path:opfPathToJsonPointer(target),changed:true};
}

/** Discover actual block containers without interpreting imported content as instructions. */
export function listBlockContainers(document,{slideIndex,includeImplicit=false}={}) {
  const result=[];
  function visit(value,path,label,depth=0){
    if(!value||typeof value!=='object'||depth>32)return;
    if(Array.isArray(value.blocks)){
      result.push({path:opfPathToJsonPointer(path),label,count:value.blocks.length});
      value.blocks.forEach((block,i)=>visit(block,[...path,'blocks',String(i)],`${label} › Group ${i+1}`,depth+1));
    }
  }
  (document?.slides??[]).forEach((slide,i)=>{
    if(slideIndex!==undefined&&slideIndex!==i)return;
    const path=['slides',String(i)],label=`Slide ${i+1}`;
    if(includeImplicit&&!Array.isArray(slide.blocks)&&!Object.keys(slide).some(isRegion))result.push({path:opfPathToJsonPointer(path),label,count:contentFields.filter(key=>Object.hasOwn(slide,key)).length,implicit:true});
    visit(slide,path,label);
    if(includeImplicit)for(const [key,value] of Object.entries(slide))if(isRegion(key)&&value&&typeof value==='object'&&!Array.isArray(value.blocks))result.push({path:opfPathToJsonPointer([...path,key]),label:`${label} › ${key}`,count:1,implicit:true});
    for(const [key,value] of Object.entries(slide))if(key.split(/[+:]/).every(part=>['top','middle','bottom','left','center','right'].includes(part))&&value&&typeof value==='object'&&!Array.isArray(value)&&Array.isArray(value.blocks))visit(value,[...path,key],`${label} › ${key}`);
  });
  return result;
}

const contentFields=['text','items','bullets','image','video','chart','table','code','metric','quote','timeline'];
const isRegion=key=>/^(?:(?:top|middle|bottom)(?:\+(?:top|middle|bottom))*(?::(?:left|center|right)(?:\+(?:left|center|right))*)?|(?:left|center|right)(?:\+(?:left|center|right))*)$/.test(key);
function preparedChange(document,container,next,path) {
  const pointer=opfPathToJsonPointer(container);
  const patches=[{op:'test',path:pointer,value:structuredClone(getValueAtPath(document,container))},
    {op:'replace',path:pointer,value:next}];
  const result=applyJsonPatch(document,patches),validation=validateOpfDocument(result);
  if(!validation.valid)throw new Error(validation.errors[0]?.message??'The changed document is not valid OPF.');
  return {document:result,patches,path:opfPathToJsonPointer(path),changed:true};
}
/** Insert into a slide, existing group or named region. Implicit payloads become blocks. */
export function prepareBlockInsert(document,containerPath,block,index) {
  const path=splitOpfPath(containerPath),pointer=opfPathToJsonPointer(path);
  if(!listBlockContainers(document,{includeImplicit:true}).some(c=>c.path===pointer))throw new TypeError('Choose a slide, group or named region content container.');
  if(!block||typeof block!=='object'||Array.isArray(block))throw new TypeError('Insert an OPF content block object.');
  const next=structuredClone(getValueAtPath(document,path));
  if(!Array.isArray(next.blocks)){
    next.blocks=contentFields.filter(key=>Object.hasOwn(next,key)).map(key=>({...(next.type?{type:next.type}:{}),[key]:next[key]}));
    for(const key of [...contentFields,'type'])delete next[key];
  }
  const at=index??next.blocks.length;
  if(!Number.isInteger(at)||at<0||at>next.blocks.length)throw new RangeError('Insertion index is out of range.');
  next.blocks.splice(at,0,structuredClone(block));
  return preparedChange(document,path,next,[...path,'blocks',String(at)]);
}
function checkedBlock(document,path) {
  const parts=splitOpfPath(path),container=parts.slice(0,-2),index=Number(parts.at(-1));
  if(parts.at(-2)!=='blocks'||!/^(0|[1-9][0-9]*)$/.test(parts.at(-1)??'')||!listBlockContainers(document).some(c=>c.path===opfPathToJsonPointer(container)))throw new TypeError('Choose a complete block using its blocks/index path.');
  const blocks=getValueAtPath(document,[...container,'blocks']);
  if(index>=blocks.length)throw new RangeError('Block does not exist.');
  return {parts,container,index,blocks};
}
/** Duplicate the entire block immediately after itself, preserving formatting and asset references. */
export function prepareBlockDuplicate(document,path) {
  const {container,index,blocks}=checkedBlock(document,path);
  return prepareBlockInsert(document,opfPathToJsonPointer(container),blocks[index],index+1);
}
/** Delete a block and prune empty ancestor groups; a slide itself is never deleted. */
export function prepareBlockRemove(document,path) {
  let {parts,container,index,blocks}=checkedBlock(document,path);
  while(blocks.length===1&&container.length>2){
    if(container.length===3&&isRegion(container[2])){
      const slidePath=container.slice(0,2),next=structuredClone(getValueAtPath(document,slidePath));delete next[container[2]];
      return preparedChange(document,slidePath,next,slidePath);
    }
    ({parts,container,index,blocks}=checkedBlock(document,container));
  }
  const next=structuredClone(getValueAtPath(document,container));next.blocks.splice(index,1);
  const selection=next.blocks.length?[...container,'blocks',String(Math.min(index,next.blocks.length-1))]:container;
  return preparedChange(document,container,next,selection);
}

/** Small, schema-valid starting points. Media requires an explicit source. */
export function createContentBlock(kind,{source}={}) {
  const presets={
    text:{text:'Add your text'},
    list:{items:['First point','Second point']},
    chart:{chart:{type:'column',data:{columns:['Category','Value'],rows:[['A',12],['B',18],['C',9]]}}},
    table:{table:{columns:['Item','Value'],rows:[['First','12'],['Second','18']]}},
    metric:{metric:{value:42,label:'Metric'}},
    quote:{quote:{text:'Add a quotation',attribution:'Source'}},
    code:{code:{source:'const message = "Hello";',language:'javascript'}},
    timeline:{timeline:[{when:'Now',what:'First milestone'},{when:'Next',what:'Second milestone'}]},
    group:{composition:{mode:'column'},blocks:[{text:'First point'},{text:'Second point'}]}
  };
  if(kind==='image'||kind==='video'){
    if(typeof source!=='string'||!source.trim())throw new TypeError('Choose a media file or enter its source.');
    return {[kind]:source};
  }
  if(!Object.hasOwn(presets,kind))throw new TypeError('Unknown content block kind.');
  return structuredClone(presets[kind]);
}
