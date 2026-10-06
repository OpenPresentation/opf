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
 // A classic part keeps c:externalData under c:chartSpace; a chartex part keeps cx:externalData under cx:chartData.
 const ref=relationship(entries,chartPart,(chart?.externalData??chart?.chartData?.externalData)?.id);
 if(!ref?.type?.endsWith('/package')||!entries[ref.path])return undefined;
 // Read only bounded spreadsheet metadata. Never follow external workbook links.
 let size=0;
 const workbook=unzipSync(entries[ref.path],{filter:file=>{
  if(!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(file.name))return false;
  size+=file.originalSize;if(size>16*1024*1024)throw Error('Chart workbook metadata exceeds the limit.');return true;
 }});
 // The category range: c:cat/c:xVal references, or the chartex cx:strDim type="cat" formula.
 const category=find(chart,'cat')[0]??find(chart,'xVal')[0]??find(chart,'strDim').find(dim=>dim?.type==='cat'),formula=category?.strRef?.f??category?.multiLvlStrRef?.f??category?.numRef?.f??(category?.type==='cat'?category?.f:undefined);
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

// PptxGenJS 4.0.1 wrote broken range metadata into chart workbooks (upstream gitbrent/PptxGenJS#1531). pptxgenjs-plus
// 4.3.4 (vendored) fixed the category and scatter tables; its bubble table still takes its last row from the column
// count (lofcz/pptxgenjs-plus#15). The 4.0.1 shapes: the
// category-chart branch (bar, line, area, pie, doughnut, radar, and the classic fallback of chartex charts) ends the
// table ref with a stray apostrophe (ref="A1:C7'"), the bubble branch takes the table's last row from its column
// count, and the category sheet dimension counts one label column (too narrow for multi-level categories). Keynote
// drops every chart whose embedded table ref does not parse (opf-pptx#162); Excel repairs the workbook when the chart
// data is opened. Each worksheet dimension and each table (and table autoFilter) ref that starts at the sheet's first
// data cell is set to the cell range the sheet actually holds (a correct range is left as it is).
// `workbook` maps the unzipped workbook part names to bytes and is changed in place.
const columnNumber=letters=>[...letters].reduce((value,letter)=>value*26+letter.charCodeAt(0)-64,0);
const columnName=number=>{let name='';for(let n=number;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;};
export function usedRange(sheetXml){
 let minColumn=Infinity,minRow=Infinity,maxColumn=0,maxRow=0;
 for(const [,letters,digits]of sheetXml.matchAll(/<c\b[^>]*?\br="([A-Z]{1,3})(\d{1,7})"/g)){
  const column=columnNumber(letters),row=Number(digits);
  minColumn=Math.min(minColumn,column);minRow=Math.min(minRow,row);maxColumn=Math.max(maxColumn,column);maxRow=Math.max(maxRow,row);
 }
 return maxRow?{start:`${columnName(minColumn)}${minRow}`,end:`${columnName(maxColumn)}${maxRow}`,ref:`${columnName(minColumn)}${minRow}:${columnName(maxColumn)}${maxRow}`,columns:maxColumn-minColumn+1}:undefined;
}
export function repairChartWorkbookRanges(workbook){
 for(const sheetPart of Object.keys(workbook)){
  if(!/^xl\/worksheets\/[^/]+\.xml$/.test(sheetPart))continue;
  const sheet=decoder.decode(workbook[sheetPart]),range=usedRange(sheet);
  if(!range)continue;
  const fixedSheet=sheet.replace(/(<dimension\b[^>]*\bref=")[^"]*(")/,(_match,prefix,suffix)=>`${prefix}${range.ref}${suffix}`);
  if(fixedSheet!==sheet)workbook[sheetPart]=encoder.encode(fixedSheet);
  const slash=sheetPart.lastIndexOf('/');
  const relationships=xml(workbook,`${sheetPart.slice(0,slash+1)}_rels/${sheetPart.slice(slash+1)}.rels`);
  for(const rel of array(relationships?.Relationships?.Relationship)){
   const ref=relationship(workbook,sheetPart,rel.Id);
   if(!ref?.type?.endsWith('/table')||!workbook[ref.path])continue;
   const table=decoder.decode(workbook[ref.path]);
   // Only a table anchored at the sheet's first data cell (every PptxGenJS chart table) is resized.
   const start=/<table\b[^>]*\bref="\$?([A-Z]+)\$?(\d+)/.exec(table);
   if(!start||`${start[1]}${start[2]}`!==range.start)continue;
   const fixed=table.replace(/(<(?:table|autoFilter)\b[^>]*\bref=")[^"]*(")/g,(_match,prefix,suffix)=>`${prefix}${range.ref}${suffix}`);
   if(fixed!==table)workbook[ref.path]=encoder.encode(fixed);
  }
 }
 return workbook;
}
