import {unzipSync,zipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false,removeNSPrefix:true,htmlEntities:{amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}});
const decoder=new TextDecoder('utf-8',{fatal:true}),encoder=new TextEncoder();
const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const xml=(entries,path)=>entries[path]?parser.parse(decoder.decode(entries[path])):undefined;
const find=(value,key)=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(item=>find(item,key)):Object.entries(value).flatMap(([name,child])=>name===key?array(child):find(child,key));
const text=value=>typeof value==='string'?value:value&&typeof value==='object'?String(value['#text']??''):value===undefined?'':String(value);
const richText=value=>value?.t!==undefined?text(value.t):array(value?.r).map(run=>text(run.t)).join('');
const escape=value=>value.replace(/[&<>"'\r\n\t]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;','\r':'&#13;','\n':'&#10;','\t':'&#9;'}[char]));
function relationship(entries,source,id){
 if(typeof id!=='string'||!id)return undefined;
 const slash=source.lastIndexOf('/'),part=`${source.slice(0,slash+1)}_rels/${source.slice(slash+1)}.rels`;
 const rel=array(xml(entries,part)?.Relationships?.Relationship).find(rel=>rel.Id===id);
 if(!rel||(rel.TargetMode!==undefined&&rel.TargetMode!=='Internal')||typeof rel.Target!=='string'||/^[a-z]+:/i.test(rel.Target)||/[\\?#]/.test(rel.Target))return undefined;
 const pieces=[];
 for(const component of (rel.Target.startsWith('/')?rel.Target.slice(1):source.slice(0,slash+1)+rel.Target).split('/')){
  if(component==='..'){if(!pieces.length)return undefined;pieces.pop();}else if(component&&component!=='.')pieces.push(component);
 }
 return {path:pieces.join('/'),type:rel.Type};
}
function workbookContext(entries,chartPart){
 const chart=xml(entries,chartPart)?.chartSpace;
 const ref=relationship(entries,chartPart,chart?.externalData?.id);
 if(!ref?.type?.endsWith('/package')||!entries[ref.path])return undefined;
 // Read only bounded spreadsheet metadata. Never follow external workbook links.
 let size=0;
 const workbook=unzipSync(entries[ref.path],{filter:file=>{
  if(!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(file.name))return false;
  size+=file.originalSize;if(size>16*1024*1024)throw Error('Chart workbook metadata exceeds the limit.');return true;
 }});
 const category=find(chart,'cat')[0],formula=category?.strRef?.f??category?.multiLvlStrRef?.f??category?.numRef?.f;
 // Infer a heading only for one contiguous vertical category range with a row
 // above it. Other chart/workbook arrangements remain explicitly unrecovered.
 const range=/^(?:'((?:[^']|'')+)'|([^'!]+))!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/i.exec(text(formula));
 if(!range||range[3].toUpperCase()!==range[5].toUpperCase()||Number(range[4])<2||Number(range[6])<Number(range[4])||Number(range[6])>1048576)return undefined;
 const column=range[3].toUpperCase();
 if(column.length>3||[...column].reduce((value,letter)=>value*26+letter.charCodeAt(0)-64,0)>16384)return undefined;
 const name=(range[1]?.replaceAll("''","'")??range[2]);
 const sheet=array(xml(workbook,'xl/workbook.xml')?.workbook?.sheets?.sheet).find(sheet=>sheet.name===name);
 const sheetRef=relationship(workbook,'xl/workbook.xml',sheet?.id);
 if(!sheetRef?.type?.endsWith('/worksheet')||!workbook[sheetRef.path])return undefined;
 const cellRef=`${column}${Number(range[4])-1}`;
 const cell=find(xml(workbook,sheetRef.path)?.worksheet,'c').find(cell=>cell.r===cellRef);
 return {workbookPart:ref.path,workbook,sheetPart:sheetRef.path,cellRef,cell};
}
export function readChartCategoryHeading(entries,chartPart){
 try{
  const context=workbookContext(entries,chartPart),cell=context?.cell;if(!cell||cell.f!==undefined)return undefined;
  if(cell.t==='inlineStr')return richText(cell.is);
  if(cell.t==='s'){
   const value=text(cell.v);if(!/^\d+$/.test(value))return undefined;
   const item=array(xml(context.workbook,'xl/sharedStrings.xml')?.sst?.si)[Number(value)];
   return item===undefined?undefined:richText(item);
  }
  // Error, boolean, date and formula results are not literal text headings.
  if(cell.t!==undefined&&!['str','n'].includes(cell.t))return undefined;
  return cell.v===undefined?undefined:text(cell.v);
 }catch{return undefined;}
}
export function writeChartCategoryHeading(entries,chartPart,heading){
 const context=workbookContext(entries,chartPart);
 if(!context?.cell||typeof heading!=='string')throw Error('Generated chart has no editable category heading cell.');
 for(const character of heading){const point=character.codePointAt(0);if(![9,10,13].includes(point)&&(point<32||point>=0xD800&&point<=0xDFFF||point===0xFFFE||point===0xFFFF))throw Error('Chart category heading contains an XML-invalid character.');}
 const workbook=unzipSync(entries[context.workbookPart]);
 const source=decoder.decode(workbook[context.sheetPart]),pattern=new RegExp(`<c\\b(?=[^>]*\\br="${context.cellRef}")[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)`);
 if(!pattern.test(source))throw Error('Generated category heading cell is missing.');
 workbook[context.sheetPart]=encoder.encode(source.replace(pattern,()=>`<c r="${context.cellRef}" t="inlineStr"><is><t xml:space="preserve">${escape(heading)}</t></is></c>`));
 // Update only table metadata related to this generated sheet and starting at
 // this header. Other embedded sheets/tables are never rewritten by inference.
 const slash=context.sheetPart.lastIndexOf('/');
 const relationships=xml(workbook,`${context.sheetPart.slice(0,slash+1)}_rels/${context.sheetPart.slice(slash+1)}.rels`);
 for(const rel of array(relationships?.Relationships?.Relationship)){
  const ref=relationship(workbook,context.sheetPart,rel.Id);
  if(!ref?.type?.endsWith('/table')||!workbook[ref.path])continue;
  const table=decoder.decode(workbook[ref.path]);
  if(xml(workbook,ref.path)?.table?.ref?.split(':')[0]!==context.cellRef)continue;
  workbook[ref.path]=encoder.encode(table.replace(/(<tableColumn\b[^>]*\bid="1"[^>]*\bname=")[^"]*(")/,(_match,prefix,suffix)=>`${prefix}${escape(heading)}${suffix}`));
 }
 entries[context.workbookPart]=zipSync(workbook);
}
