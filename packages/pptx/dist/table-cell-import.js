import {drawingObject} from './background-import.js';
import {readBackgroundColor} from './background.js';

const has = (value, key) => Object.hasOwn(value ?? {}, key);
const nodes = (tree, tag) => (tree ?? []).filter(node => has(node, tag));
const child = (tree, tag) => nodes(tree, tag)[0]?.[tag];
const truth = value => ['1','true','on'].includes(value);
const text = value => Array.isArray(value) ? value.map(run => typeof run === 'string' ? run : run.text).join('') : value ?? '';
const hex = color => color.hex + (color.alpha < 1 ? Math.round(color.alpha * 255).toString(16).padStart(2,'0').toUpperCase() : '');

// Preserve ordered fill-style indexes: grouping XML tags would reorder mixed
// solid/gradient/image entries. Resolve phClr against this reference only.
export function nativeStyleFill(style, context) {
  if (style['a:fill']) return style['a:fill'];
  const reference=style['a:fillRef'];
  if (!reference) return {};
  const unresolved={_opfUnresolvedTableFill:true};
  if (!/^\d+$/.test(reference.idx ?? '')) return unresolved;
  const index=Number(reference.idx);
  if (index===0 || index===1000) return {'a:noFill':{}};
  const tree=context.formatPath && context.parsedPart(context.formatPath)?.tree;
  const theme=child(tree,'a:theme'),elements=theme?child(theme,'a:themeElements'):child(tree,'a:themeOverride');
  const format=child(elements,'a:fmtScheme');
  const entries=child(format,index<1000?'a:fillStyleLst':'a:bgFillStyleLst')?.filter(node=>Object.keys(node).some(key=>key!=='#text'&&key!==':@'));
  const entry=entries?.[index<1000?index-1:index-1001];
  if (!entry) return unresolved;
  const properties=drawingObject([entry]);
  if (properties['a:solidFill']) {
    const color=readBackgroundColor(properties['a:solidFill'],{...context,placeholder:readBackgroundColor(reference,context)});
    if (!color) return unresolved;
    return {'a:solidFill':{'a:srgbClr':{val:color.hex.slice(1),'a:alpha':{val:String(Math.round(color.alpha*100000))}}}};
  }
  return properties;
}

function solid(properties, context, report, kind) {
  if (has(properties,'a:noFill')) return '#00000000';
  if (properties['a:solidFill']) {
    const color = readBackgroundColor(properties['a:solidFill'], context);
    if (color) return hex(color);
    report(`unsupported-table-${kind}`, 'The native solid color or its transforms could not be resolved.');
  } else if (['a:gradFill','a:blipFill','a:pattFill','a:grpFill'].some(key => has(properties,key))) {
    report(`unsupported-table-${kind}`, 'Only solid cell fills and border colors are represented by OPF table styles.');
  }
  return undefined;
}

export function nativeCellStyle(properties, body, context, scale, report) {
  const style = {fill:'#00000000', align:'left', verticalAlign:'top', padding:{}, borders:{}};
  const fill = solid(properties, context, report, 'cell-fill');
  if (properties._opfUnresolvedTableFill) report('unsupported-table-cell-fill','The native fill style reference or placeholder color could not be resolved from this archive.');
  if (fill !== undefined) style.fill = fill;
  // DrawingML defaults are 0.1 inch horizontally and 0.05 inch vertically.
  for (const [edge,key,fallback] of [['top','marT',45720],['right','marR',91440],['bottom','marB',45720],['left','marL',91440]]) {
    const value = Number(properties[key] ?? fallback) / (9525 * scale);
    if (Number.isFinite(value) && value >= 0 && value <= 200) style.padding[edge] = value;
    else {style.padding[edge] = Math.min(200,fallback / (9525 * scale));report('unsupported-table-padding','The native cell margin is outside the canonical 0–200 reference-pixel range.');}
  }
  const vertical = {t:'top',ctr:'middle',b:'bottom'}[properties.anchor ?? 't'];
  if (vertical) style.verticalAlign = vertical;
  else report('unsupported-table-alignment','Distributed or justified vertical cell alignment is not represented.');
  if (truth(properties.anchorCtr) || properties.vert && properties.vert !== 'horz') report('unsupported-table-alignment','Centered anchoring or vertical text direction is not represented.');
  const listStyle = drawingObject(child(body,'a:lstStyle'));
  const alignments = nodes(body,'a:p').map(paragraph => {
    const p = drawingObject(paragraph['a:p'])['a:pPr'] ?? {};
    return p.algn ?? listStyle[`a:lvl${Number(p.lvl ?? 0)+1}pPr`]?.algn ?? listStyle['a:defPPr']?.algn ?? 'l';
  });
  const alignment = {l:'left',ctr:'center',r:'right'}[alignments[0] ?? 'l'];
  if (alignment) style.align = alignment;
  if (!alignment || new Set(alignments).size > 1) report('unsupported-table-alignment','Mixed or justified paragraph alignment cannot be represented by one cell alignment.');
  for (const [edge,key] of [['left','a:lnL'],['right','a:lnR'],['top','a:lnT'],['bottom','a:lnB']]) {
    const line = properties[key];
    style.borders[edge] = {color:'#00000000',width:0};
    if (!line) continue;
    if (has(line,'a:noFill') || line.w === '0') continue;
    const color = solid(line,context,report,'border');
    const width = Number(line.w ?? 12700) / (9525 * scale);
    const dash = {solid:'solid',dash:'dash',sysDash:'dash',sysDot:'dot',dot:'dot'}[line['a:prstDash']?.val ?? 'solid'];
    if (color !== undefined && Number.isFinite(width) && width >= 0 && width <= 32 && dash) style.borders[edge] = {color,width,...(dash === 'solid' ? {} : {dash})};
    else report('unsupported-table-border','The native border color, width or dash pattern cannot be represented.');
    if (line.cmpd && line.cmpd !== 'sng' || line.algn && line.algn !== 'ctr' || has(line,'a:custDash')) report('unsupported-table-border','Compound, inset or custom-dash border geometry is not represented.');
  }
  if (['a:lnTlToBr','a:lnBlToTr','a:cell3D'].some(key => has(properties,key))) report('unsupported-table-cell-effect','Diagonal cell borders and 3D cell effects are not represented.');
  return style;
}

/** Accept a native dense merge only when every covered position is empty and
 * carries the corresponding continuation flags. On malformed input, retain all
 * source cells without merges rather than hiding text behind a guessed anchor. */
export function nativeTableGrid(cells, columnCount, headers, report) {
  const owners = cells.map(row => Array(row.length));
  let malformed = false;
  const bad = (r,c,message) => {malformed=true;report(`rows.${r}.${c}`,'unsupported-table-merge',message);};
  const rows = cells.map(row => row.map(cell => ({value:cell.value,style:cell.style})));
  for (let r=0;r<cells.length;r++) for (let c=0;c<cells[r].length;c++) {
    const cell=cells[r][c], geometry=cell.geometry, owner=owners[r][c];
    const horizontal=truth(geometry.hMerge),vertical=truth(geometry.vMerge);
    if (owner) {
      if (text(cell.value) !== '' || horizontal !== (c > owner.c) || vertical !== (r > owner.r)) bad(r,c,'Native merge continuations conflict with their anchor or contain text; all source cell text is retained.');
      rows[r][c]=null;
      continue;
    }
    const rowSpan=Number(geometry.rowSpan ?? 1),colSpan=Number(geometry.gridSpan ?? 1);
    if (horizontal || vertical || !Number.isSafeInteger(rowSpan) || !Number.isSafeInteger(colSpan) || rowSpan<1 || colSpan<1 || r+rowSpan>cells.length || c+colSpan>columnCount) {
      bad(r,c,'Native merge geometry is incomplete or outside the table grid; all source cell text is retained.');continue;
    }
    if (rowSpan>1) rows[r][c].rowSpan=rowSpan;
    if (colSpan>1) rows[r][c].colSpan=colSpan;
    if (rowSpan === 1 && colSpan === 1) continue;
    for (let y=r;y<r+rowSpan;y++) for (let x=c;x<c+colSpan;x++) {
      if (!cells[y]?.[x] || owners[y][x]) bad(r,c,'Native merge rectangles overlap or omit covered cells; all source cell text is retained.');
      else owners[y][x]={r,c};
    }
  }
  if (malformed) return {headers,rows:cells.map(row=>row.map(cell=>({value:cell.value,style:cell.style})))};
  if (headers && rows[0]?.some(cell=>cell?.rowSpan>1)) {
    headers=false;
    report('','table-header-in-body','A native merge crosses the first row. It is retained in body rows with explicit formatting, because canonical repeated headers cannot span into body rows.');
  }
  return {headers,rows};
}
