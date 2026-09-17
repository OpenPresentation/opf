import {drawingObject, readSlideTheme} from './background-import.js';
import {readBackgroundColor} from './background.js';
import {nativeCellStyle, nativeTableGrid, nativeStyleFill} from './table-cell-import.js';
import {nativeCellExtent,inheritNativeBorders,nativeBorderProperties,mergeCellBorderOverrides} from './table-border-import.js';

const nodes = (tree, tag) => (tree ?? []).filter(node => Object.hasOwn(node, tag));
const child = (tree, tag) => nodes(tree, tag)[0]?.[tag];
const attrs = (tree, tag) => nodes(tree, tag)[0]?.[':@'] ?? {};
const text = tree => (tree ?? []).map(node => node['#text'] ?? '').join('');
const boolean = value => ['1','true','on'].includes(value) ? true : ['0','false','off'].includes(value) ? false : undefined;

function runStyle(properties, context, relationships, report) {
  const result = {};
  for (const [native, opf] of [['b','bold'], ['i','italic']]) {
    const value = boolean(properties[native]);
    if (value !== undefined) result[opf] = value;
  }
  for (const [native, opf] of [['u','underline'], ['strike','strikethrough']]) {
    if (properties[native] !== undefined) result[opf] = properties[native] !== 'none' && properties[native] !== 'noStrike';
  }
  const size = Number(properties.sz);
  if (Number.isFinite(size) && size > 0) result.fontSize = size / 100;
  const baseline = Number(properties.baseline);
  if (Number.isFinite(baseline)) {
    result.superscript = baseline > 0;
    result.subscript = baseline < 0;
  }
  const font = properties['a:latin']?.typeface;
  if (properties['a:latin'] && !font) report('unsupported-table-font', 'The native text font has no usable Latin face or theme reference.');
  if (font) {
    const match = font.match(/^\+(mj|mn)-(lt|ea|cs)$/);
    const family = match ? context.fonts?.[match[1] === 'mj' ? 'a:majorFont' : 'a:minorFont']?.[{lt:'a:latin',ea:'a:ea',cs:'a:cs'}[match[2]]]?.typeface : font;
    if (family) result.fontFamily = family;
    else report('unsupported-table-font', 'The theme font reference could not be resolved from this archive.');
  }
  if (properties['a:solidFill']) {
    const color = readBackgroundColor(properties['a:solidFill'], context);
    if (color) result.color = color.hex + (color.alpha < 1 ? Math.round(color.alpha * 255).toString(16).padStart(2, '0').toUpperCase() : '');
    else report('unsupported-table-text-color', 'The native text color or its transforms could not be resolved.');
  } else if (properties['a:noFill']) {
    result.color = '#00000000';
  }
  if (['a:gradFill','a:blipFill','a:pattFill','a:grpFill'].some(key => properties[key])) report('unsupported-table-text-fill', 'Only solid native text fills are represented by OPF runs.');
  const hyperlink = properties['a:hlinkClick'];
  if (hyperlink) {
    const relationship = relationships.get(hyperlink['r:id']);
    if (relationship?.type.endsWith('/hyperlink') && relationship.targetMode === 'External' && relationship.target && !hyperlink.action) result.link = relationship.target;
    else report('unsupported-table-link', 'The native hyperlink action or relationship cannot be represented as a URL.');
  }
  return result;
}

// Merge at the native property level before conversion: an explicit normal run
// overrides a bold paragraph default, and a new fill replaces the inherited fill.
function mergeProperties(...levels) {
  const result = {};
  const fills = ['a:solidFill','a:noFill','a:gradFill','a:blipFill','a:pattFill','a:grpFill','_opfUnresolvedTableFill'];
  for (const level of levels) {
    if (!level) continue;
    if (fills.some(key => Object.hasOwn(level, key))) for (const key of fills) delete result[key];
    Object.assign(result, level);
  }
  return result;
}

function cellText(body, context, relationships, report, header, tableDefaults) {
  const listStyle = drawingObject(child(body, 'a:lstStyle'));
  const paragraphs = nodes(body, 'a:p');
  const runs = [];
  const append = (value, style = {}) => {
    if (!value) return;
    runs.push(Object.keys(style).length ? {text:value, ...style} : value);
  };
  paragraphs.forEach((paragraph, index) => {
    const content = paragraph['a:p'];
    if (index) append('\n');
    const pPr = drawingObject(content)['a:pPr'] ?? {};
    const level = Number(pPr.lvl ?? 0) + 1;
    const defaults = mergeProperties(header ? {b:'0'} : undefined, tableDefaults, listStyle['a:defPPr']?.['a:defRPr'], listStyle[`a:lvl${level}pPr`]?.['a:defRPr'], pPr['a:defRPr']);
    for (const node of content) {
      const tag = ['a:r', 'a:fld', 'a:br'].find(tag => Object.hasOwn(node, tag));
      if (!tag) continue;
      const properties = mergeProperties(defaults, drawingObject(node[tag])['a:rPr']);
      append(tag === 'a:br' ? '\n' : text(child(node[tag], 'a:t')), runStyle(properties, context, relationships, report));
    }
  });
  return runs.some(run => typeof run !== 'string') ? runs : runs.join('');
}

// Table styles are archive data, resolved through the presentation relationship.
// The list's def attribute is an insertion default, not an implicit style for
// existing unstyled tables. Built-in IDs without archive definitions stay explicit
// diagnostics; do not substitute a guessed theme or download style definitions.
function tableStyle(props, archive, context, report) {
  const inline = child(props, 'a:tableStyle');
  if (inline) return drawingObject(inline);
  const id = text(child(props, 'a:tableStyleId')).trim().toLowerCase();
  if (!id) return undefined;
  const relationship = [...archive.relationships('ppt/presentation.xml').values()]
    .find(rel => rel.type.endsWith('/tableStyles') && rel.targetMode !== 'External' && archive.bytes(rel.path));
  const list = relationship && child(context.parsedPart(relationship.path)?.tree, 'a:tblStyleLst');
  const selected = nodes(list, 'a:tblStyle').find(node => node[':@']?.styleId?.trim().toLowerCase() === id);
  if (selected) return drawingObject(selected['a:tblStyle']);
  report('unsupported-table-style', 'The referenced native table style has no definition in this archive; direct text formatting is retained.');
  return undefined;
}

const colorKinds = ['a:srgbClr','a:sysClr','a:schemeClr','a:scrgbClr','a:hslClr','a:prstClr'];
function tableTextProperties(style, context) {
  const result = {};
  for (const key of ['b','i']) {
    const value = boolean(style[key]);
    if (value !== undefined) result[key] = value ? '1' : '0';
  }
  if (style['a:font']) {
    result['a:latin'] = style['a:font']['a:latin'] ?? {};
  } else if (style['a:fontRef']) {
    const index = style['a:fontRef'].idx;
    result['a:latin'] = {typeface:index === 'major' ? '+mj-lt' : index === 'minor' ? '+mn-lt' : ''};
  }
  const color = Object.fromEntries(colorKinds.filter(key => Object.hasOwn(style, key)).map(key => [key, style[key]]));
  if (Object.keys(color).length) {
    const placeholder = readBackgroundColor(style['a:fontRef'], context);
    const resolved = readBackgroundColor(color, {...context, placeholder});
    // Normalize style placeholder colors before merging direct paragraph/run fills.
    result['a:solidFill'] = resolved ? {'a:srgbClr':{val:resolved.hex.slice(1), 'a:alpha':{val:String(Math.round(resolved.alpha * 100000))}}} : color;
  }
  return result;
}

function conditionalProperties(style, properties, row, column, rowCount, columnCount, context, report, geometry) {
  if (!style) return {text:undefined,cell:{}};
  const enabled = key => boolean(properties[key]) === true;
  const firstRow = enabled('firstRow') && row === 0;
  const lastRow = enabled('lastRow') && row === rowCount - 1;
  const firstCol = enabled('firstCol') && column === 0;
  const lastCol = enabled('lastCol') && column === columnCount - 1;
  // DrawingML / MS-OI29500 2.1.1265 order (not WordprocessingML order).
  const parts = ['wholeTbl'];
  if (enabled('bandRow') && !firstRow && !lastRow) parts.push((row + Number(enabled('firstRow'))) % 2 ? 'band2H' : 'band1H');
  if (enabled('bandCol') && !firstCol && !lastCol) parts.push((column + Number(enabled('firstCol'))) % 2 ? 'band2V' : 'band1V');
  if (lastCol) parts.push('lastCol');
  if (firstCol) parts.push('firstCol');
  if (lastRow) parts.push('lastRow');
  if (lastRow && lastCol) parts.push('seCell');
  if (lastRow && firstCol) parts.push('swCell');
  if (firstRow) parts.push('firstRow');
  if (firstRow && lastCol) parts.push('neCell');
  if (firstRow && firstCol) parts.push('nwCell');
  const textStyle = {};
  let cellStyle = {};
  let borders = {};
  const extent=nativeCellExtent(row,column,rowCount,columnCount,geometry);
  for (const name of parts) {
    const part = style['a:' + name];
    if (!part) continue;
    const decoration=part['a:tcStyle'] ?? {};
    cellStyle=mergeProperties(cellStyle,nativeStyleFill(decoration,context));
    borders=inheritNativeBorders(borders,decoration,name,extent,context);
    if (Object.keys(decoration).some(key=>!['a:fill','a:fillRef','a:tcBdr'].includes(key))) report('unsupported-table-cell-style','The conditional cell style includes effects that are not represented; supported fills, borders and character styles are retained.');
    const current = part['a:tcTxStyle'] ?? {};
    // Resolve choices after inheritance so a later phClr can use an inherited
    // fontRef, and an explicit font collection replaces a themed reference.
    if (current['a:font'] || current['a:fontRef']) {delete textStyle['a:font'];delete textStyle['a:fontRef'];}
    if (colorKinds.some(key => Object.hasOwn(current, key))) for (const key of colorKinds) delete textStyle[key];
    for (const [key, value] of Object.entries(current)) {
      if (['b','i'].includes(key) && value === 'def') continue;
      textStyle[key] = value;
    }
  }
  return {text:tableTextProperties(textStyle, context),cell:{...cellStyle,...nativeBorderProperties(borders,extent)}};
}

// Use the same direct graphic-frame ordering as the slide collector. The ordered
// reader retains interleaved runs, fields, breaks, empty paragraphs and spaces.
export function importTableFrames(slidePath, archive, relationships, report, dimensions) {
  const context = readSlideTheme(slidePath, archive);
  const scale = Math.min(dimensions.widthInches,dimensions.heightInches) * 96 / 720;
  const root = child(context.parsedPart(slidePath)?.tree, 'p:sld');
  const tree = child(child(root, 'p:cSld'), 'p:spTree');
  return nodes(tree, 'p:graphicFrame').map((frame, frameIndex) => {
    const table = child(child(child(frame['p:graphicFrame'], 'a:graphic'), 'a:graphicData'), 'a:tbl');
    if (!table) return undefined;
    const props = child(table, 'a:tblPr');
    const style = tableStyle(props, archive, context, (code, message) => report(frameIndex, '', code, message));
    if (style?.['a:tblBg']) report(frameIndex, '', 'unsupported-table-cell-style', 'The native table style background is not represented; supported character styles are retained.');
    const properties = attrs(table, 'a:tblPr');
    if (boolean(properties.rtl) === true) report(frameIndex, '', 'unsupported-table-direction', 'Right-to-left table geometry is not represented; cells retain native source order.');
    const headers = boolean(properties.firstRow) === true;
    const nativeRows = nodes(table, 'a:tr');
    const columnCount = nodes(child(table, 'a:tblGrid'), 'a:gridCol').length;
    const rows = nativeRows.map((row, rowIndex) => nodes(row['a:tr'], 'a:tc').map((cell, columnIndex) => {
      const cellPath = `rows.${rowIndex}.${columnIndex}`;
      const reported = new Set();
      const emit = (code, message) => {if (!reported.has(code)) {reported.add(code);report(frameIndex, cellPath, code, message);}};
      const geometry = cell[':@'] ?? {};
      const defaults = conditionalProperties(style, properties, rowIndex, columnIndex, nativeRows.length, columnCount, context, emit, geometry);
      const body = child(cell['a:tc'],'a:txBody');
      const cellProperties = {...attrs(cell['a:tc'],'a:tcPr'),...drawingObject(child(cell['a:tc'],'a:tcPr'))};
      const inherited=mergeProperties(defaults.cell,cellProperties);
      return {
        geometry,
        value:cellText(body, context, relationships, emit, headers && rowIndex === 0, defaults.text),
        style:nativeCellStyle(mergeCellBorderOverrides(defaults.cell,cellProperties,inherited),body,context,scale,emit),
        borderEdges:[['left','a:lnL'],['right','a:lnR'],['top','a:lnT'],['bottom','a:lnB']]
          .filter(([,key])=>Object.hasOwn(inherited,key)).map(([edge])=>edge),
      };
    }));
    const grid = nativeTableGrid(rows,columnCount,headers,(cell,code,message)=>report(frameIndex,cell,code,message));
    return grid.headers && grid.rows.length ? {columns:grid.rows[0], rows:grid.rows.slice(1)} : {rows:grid.rows};
  });
}
