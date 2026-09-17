import {readBackgroundColor} from './background.js';

const has=(value,key)=>Object.hasOwn(value??{},key);
const fills=['a:solidFill','a:noFill','a:gradFill','a:blipFill','a:pattFill','a:grpFill'];

export function mergeNativeLine(...levels){
  const result={};
  for(const level of levels){
    if(!level)continue;
    if(fills.some(key=>has(level,key)))for(const key of fills)delete result[key];
    if(has(level,'a:prstDash')||has(level,'a:custDash')){delete result['a:prstDash'];delete result['a:custDash'];}
    // A complete direct line or an invisible line masks an unavailable theme
    // reference; partial overrides still need the missing inherited properties.
    if(has(level,'a:noFill')||Number(level.w)===0||(has(level,'w')&&fills.some(key=>has(level,key))&&has(level,'a:prstDash')))delete result._opfUnresolvedTableLine;
    Object.assign(result,level);
  }
  return result;
}

function nativeStyleLine(border,context){
  if(border['a:ln'])return border['a:ln'];
  const reference=border['a:lnRef'];
  if(!reference)return undefined;
  const unresolved={_opfUnresolvedTableLine:true};
  if(!/^\d+$/.test(reference.idx??''))return unresolved;
  const index=Number(reference.idx);
  if(index===0)return undefined;
  const lines=context.format?.['a:lnStyleLst']?.['a:ln'];
  const selected=(Array.isArray(lines)?lines:lines?[lines]:[])[index-1];
  if(!selected)return unresolved;
  const line={...selected};
  if(line['a:solidFill']){
    const color=readBackgroundColor(line['a:solidFill'],{...context,placeholder:readBackgroundColor(reference,context)});
    if(!color)return {...line,...unresolved};
    line['a:solidFill']={'a:srgbClr':{val:color.hex.slice(1),'a:alpha':{val:String(Math.round(color.alpha*100000))}}};
  }
  return line;
}

export function nativeCellExtent(row,column,rowCount,columnCount,geometry={}){
  const span=(value,remaining)=>{const n=Number(value??1);return Number.isSafeInteger(n)&&n>=1&&n<=remaining?n:1;};
  return {top:row===0,left:column===0,bottom:row+span(geometry.rowSpan,rowCount-row)===rowCount,right:column+span(geometry.gridSpan,columnCount-column)===columnCount};
}

/** Keep named edge and interior properties distinct until inheritance finishes.
 * wholeTbl edges belong to its outer frame; conditional explicit edges belong
 * to the selected cell. Interior lines apply only away from the outer frame. */
export function inheritNativeBorders(previous,decoration,name,extent,context){
  const result={...previous},borders=decoration['a:tcBdr']??{};
  for(const key of ['left','right','top','bottom','insideH','insideV','tl2br','tr2bl']){
    const border=borders['a:'+key];
    if(!border || name==='wholeTbl'&&has(extent,key)&&!extent[key])continue;
    const line=nativeStyleLine(border,context);
    if(line!==undefined)result[key]=mergeNativeLine(result[key],line);
  }
  return result;
}

export function nativeBorderProperties(borders,extent){
  const result={};
  for(const [edge,key,inside] of [['left','a:lnL','insideV'],['right','a:lnR','insideV'],['top','a:lnT','insideH'],['bottom','a:lnB','insideH']]){
    const base=extent[edge]?undefined:borders[inside],line=borders[edge];
    if(base||line)result[key]=mergeNativeLine(base,line);
  }
  for(const [edge,key] of [['tl2br','a:lnTlToBr'],['tr2bl','a:lnBlToTr']])if(borders[edge])result[key]=borders[edge];
  return result;
}

export function mergeCellBorderOverrides(inherited,direct,merged){
  const result={...merged};
  for(const key of ['a:lnL','a:lnR','a:lnT','a:lnB','a:lnTlToBr','a:lnBlToTr'])if(inherited[key]&&direct[key])result[key]=mergeNativeLine(inherited[key],direct[key]);
  return result;
}
