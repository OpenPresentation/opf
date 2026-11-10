/** Canonical table grid. No renderer, fonts, DOM or network dependencies. */
/** One cell border as engines read it. The document's `'none'` is a border of no width; an omitted color or width is the table rule's own. */
export interface TableBorder { color?: string; width?: number; dash?: 'solid'|'dash'|'dot' }
export interface TableCellStyle {
  fill?: string; color?: string; bold?: boolean;
  /** Logical, in the engine's words: `left` is the start edge (the document writes `start`) and `right` the end edge (`end`). */
  align?: 'left'|'center'|'right'; verticalAlign?: 'top'|'middle'|'bottom';
  padding?: Partial<Record<'top'|'right'|'bottom'|'left',number>>;
  borders?: Partial<Record<'top'|'right'|'bottom'|'left',TableBorder>>;
}
export interface TableGridCell {
  input: unknown; value: unknown; style: TableCellStyle;
  row: number; column: number; rowSpan: number; colSpan: number; header: boolean;
  path: string; valuePath: string;
}
export interface TableGridIssue { path: string; message: string }
export interface TableGrid {
  rows: TableGridCell[][]; columnCount: number; rowCount: number; hasHeaders: boolean;
  /** Anchor at each covered position; covered positions are not additional cells. */
  owners: (TableGridCell|undefined)[][];
  issues: TableGridIssue[];
}
const record = (value:unknown):Record<string,any> => value && typeof value==='object'&&!Array.isArray(value)?value as Record<string,any>:{};
/**
 * A cell's style as engines read it: each `'none'` border is the border of no width that engines draw nothing for, and the
 * document's logical `align` (`start`, `end`) is the engine's `left` and `right`, which `physicalAlignment` resolves per direction.
 */
function cellStyle(style:Record<string,any>):TableCellStyle {
  const borders=style.borders,logical=style.align==='start'||style.align==='end';
  const none=borders&&typeof borders==='object'&&!Array.isArray(borders)&&Object.values(borders).includes('none');
  if(!none&&!logical) return style;
  return {...style,...(logical?{align:style.align==='start'?'left':'right'}:{}),...(none?{borders:Object.fromEntries(Object.entries(borders).map(([edge,border])=>[edge,border==='none'?{color:'#00000000',width:0}:border]))}:{})};
}
export function tableGrid(value:unknown,path='table'):TableGrid {
  const table=record(value),hasHeaders=Array.isArray(table.columns)&&table.columns.length>0;
  const values:unknown[][]=[...(hasHeaders?[table.columns]:[]),...(Array.isArray(table.rows)?table.rows:[])];
  const columnCount=values.reduce((count,row)=>Math.max(count,Array.isArray(row)?row.length:0),1),rowCount=values.length;
  const owners:TableGrid['owners']=Array.from({length:rowCount},()=>Array(columnCount));
  const rows:TableGridCell[][]=Array.from({length:rowCount},()=>[]),issues:TableGridIssue[]=[];
  const location=(r:number,c:number)=>`${path}.${hasHeaders&&r===0?'columns':`rows.${r-Number(hasHeaders)}`}.${c}`;
  for(let r=0;r<rowCount;r++) for(let c=0;c<columnCount;c++) {
    const input=values[r]?.[c],cellPath=location(r,c),existing=owners[r]![c];
    if(existing) {
      if(input!==null) issues.push({path:cellPath,message:'A position covered by a spanning cell must explicitly contain null; content cannot be hidden.'});
      continue;
    }
    const object=record(input),styled=Object.hasOwn(object,'value');
    // RR-54: a DataColumn header ({name, format}) shows its name.
    const column=!styled&&hasHeaders&&r===0&&typeof object.name==='string';
    const rowSpan=styled?(object.rowSpan??1):1,colSpan=styled?(object.colSpan??1):1;
    if(!Number.isSafeInteger(rowSpan)||!Number.isSafeInteger(colSpan)||rowSpan<1||colSpan<1||r+rowSpan>rowCount||c+colSpan>columnCount||(hasHeaders&&r===0&&rowSpan>1)) {
      issues.push({path:cellPath,message:'Cell spans must be positive integers within the table grid and cannot cross from headers into body rows.'});continue;
    }
    const cell:TableGridCell={input,value:styled?object.value:column?object.name:input,style:styled?cellStyle(record(object.style)):{},row:r,column:c,rowSpan,colSpan,header:hasHeaders&&r===0,path:cellPath,valuePath:styled?cellPath+'.value':column?cellPath+'.name':cellPath};
    rows[r]!.push(cell);
    for(let y=r;y<r+rowSpan;y++) for(let x=c;x<c+colSpan;x++) {
      if(owners[y]![x])issues.push({path:cellPath,message:'Cell spans cannot overlap another spanning cell.'});
      else owners[y]![x]=cell;
    }
  }
  return {rows,columnCount,rowCount,hasHeaders,owners,issues};
}
/** Row boundaries that preserve every vertical merge, used by pagination. */
export function tableRowBoundaries(value:unknown):number[] {
  const grid=tableGrid(value),offset=Number(grid.hasHeaders),count=grid.rowCount-offset;
  const allowed=new Set(Array.from({length:count+1},(_,i)=>i));
  for(const row of grid.rows)for(const cell of row)if(!cell.header)for(let r=1;r<cell.rowSpan;r++)allowed.delete(cell.row-offset+r);
  return [...allowed];
}
