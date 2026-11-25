/** Canonical table grid. No renderer, fonts, DOM or network dependencies. */
/** One cell border as engines read it. The document's `'none'` is a border of no width; an omitted color or width is the table rule's own. */
export interface TableBorder { color?: unknown; width?: number; dash?: 'solid'|'dash'|'dot' }
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
/** One body row in the single form every reader uses: its `id` (when the row is the object form and has one), its cells and where they sit in the document. */
export interface TableRowEntry {
  id?: string;
  cells: unknown[];
  /** The row's own position, dotted (`table.rows.1`). */
  path: string;
  /** Where the cells are, dotted: the row itself for the array form, `<row>.cells` for the object form. */
  cellsPath: string;
  /** Whether the row is the object form `{ id, cells }`. */
  object: boolean;
}
export interface TableGridIssue { path: string; message: string }
export interface TableGrid {
  /** The id of each grid row (the header row has none), index-aligned with `owners`. */
  rowIds: (string|undefined)[];
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
/** A row's cells whichever form it is written in: the array itself, or `cells` of the object form; anything else has none. */
export function rowCells(row:unknown):unknown[] {
  if(Array.isArray(row)) return row;
  const cells=record(row).cells;
  return Array.isArray(cells)?cells:[];
}
/** The id of a body row: `id` of the object form, undefined for the array form and for an id that is not a non-empty string. */
export function rowId(row:unknown):string|undefined {
  const id=Array.isArray(row)?undefined:record(row).id;
  return typeof id==='string'&&id!==''?id:undefined;
}
/**
 * The body rows of an inline table in ONE form (FR-02): each row is `{ id?, cells, path, cellsPath, object }` whether the document wrote
 * `[cell, ...]` or `{ "id": "r1", "cells": [...] }`. The renderer, the exporter, the editor and the converters read rows through this
 * (or through `rowCells`), so none of them branches on the two spellings. A dataset-backed table or a value that is not a table has no rows.
 */
export function tableRows(value:unknown,path='table'):TableRowEntry[] {
  const rows=record(value).rows;
  if(!Array.isArray(rows)) return [];
  return rows.map((row,index)=>{
    const id=rowId(row),object=!Array.isArray(row)&&row!==null&&typeof row==='object';
    return {...(id!==undefined?{id}:{}),cells:rowCells(row),path:`${path}.rows.${index}`,cellsPath:`${path}.rows.${index}${object?'.cells':''}`,object};
  });
}
export function tableGrid(value:unknown,path='table'):TableGrid {
  const table=record(value),hasHeaders=Array.isArray(table.columns)&&table.columns.length>0;
  const body=tableRows(table,path);
  const values:unknown[][]=[...(hasHeaders?[table.columns]:[]),...body.map(row=>row.cells)];
  const rowIds:(string|undefined)[]=[...(hasHeaders?[undefined]:[]),...body.map(row=>row.id)];
  const columnCount=values.reduce((count,row)=>Math.max(count,Array.isArray(row)?row.length:0),1),rowCount=values.length;
  const owners:TableGrid['owners']=Array.from({length:rowCount},()=>Array(columnCount));
  const rows:TableGridCell[][]=Array.from({length:rowCount},()=>[]),issues:TableGridIssue[]=[];
  const location=(r:number,c:number)=>hasHeaders&&r===0?`${path}.columns.${c}`:`${body[r-Number(hasHeaders)]!.cellsPath}.${c}`;
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
  return {rowIds,rows,columnCount,rowCount,hasHeaders,owners,issues};
}
/** Row boundaries that preserve every vertical merge, used by pagination. */
export function tableRowBoundaries(value:unknown):number[] {
  const grid=tableGrid(value),offset=Number(grid.hasHeaders),count=grid.rowCount-offset;
  const allowed=new Set(Array.from({length:count+1},(_,i)=>i));
  for(const row of grid.rows)for(const cell of row)if(!cell.header)for(let r=1;r<cell.rowSpan;r++)allowed.delete(cell.row-offset+r);
  return [...allowed];
}
