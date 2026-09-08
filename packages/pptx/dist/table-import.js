import {drawingObject, readSlideTheme} from './background-import.js';
import {readBackgroundColor} from './background.js';

const nodes = (tree, tag) => (tree ?? []).filter(node => Object.hasOwn(node, tag));
const child = (tree, tag) => nodes(tree, tag)[0]?.[tag];
const attrs = (tree, tag) => nodes(tree, tag)[0]?.[':@'] ?? {};
const text = tree => (tree ?? []).map(node => node['#text'] ?? '').join('');
const boolean = value => value === '1' || value === 'true' ? true : value === '0' || value === 'false' ? false : undefined;

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
  const fills = ['a:solidFill','a:noFill','a:gradFill','a:blipFill','a:pattFill','a:grpFill'];
  for (const level of levels) {
    if (!level) continue;
    if (fills.some(key => Object.hasOwn(level, key))) for (const key of fills) delete result[key];
    Object.assign(result, level);
  }
  return result;
}

function cellText(body, context, relationships, report, header) {
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
    const defaults = mergeProperties(header ? {b:'0'} : undefined, listStyle['a:defPPr']?.['a:defRPr'], listStyle[`a:lvl${level}pPr`]?.['a:defRPr'], pPr['a:defRPr']);
    for (const node of content) {
      const tag = ['a:r', 'a:fld', 'a:br'].find(tag => Object.hasOwn(node, tag));
      if (!tag) continue;
      const properties = mergeProperties(defaults, drawingObject(node[tag])['a:rPr']);
      append(tag === 'a:br' ? '\n' : text(child(node[tag], 'a:t')), runStyle(properties, context, relationships, report));
    }
  });
  return runs.some(run => typeof run !== 'string') ? runs : runs.join('');
}

// Use the same direct graphic-frame ordering as the slide collector. The ordered
// reader retains interleaved runs, fields, breaks, empty paragraphs and spaces.
export function importTableFrames(slidePath, archive, relationships, report) {
  const context = readSlideTheme(slidePath, archive);
  const root = child(context.parsedPart(slidePath)?.tree, 'p:sld');
  const tree = child(child(root, 'p:cSld'), 'p:spTree');
  return nodes(tree, 'p:graphicFrame').map((frame, frameIndex) => {
    const table = child(child(child(frame['p:graphicFrame'], 'a:graphic'), 'a:graphicData'), 'a:tbl');
    if (!table) return undefined;
    const props = child(table, 'a:tblPr');
    if (child(props, 'a:tableStyleId') || child(props, 'a:tableStyle')) report(frameIndex, '', 'unsupported-table-style', 'Conditional native table styles are not applied; direct cell and paragraph text formatting is retained.');
    const headers = boolean(attrs(table, 'a:tblPr').firstRow) === true;
    const rows = nodes(table, 'a:tr').map((row, rowIndex) => nodes(row['a:tr'], 'a:tc').map((cell, columnIndex) => {
      const cellPath = `rows.${rowIndex}.${columnIndex}`;
      const emit = (code, message) => report(frameIndex, cellPath, code, message);
      const geometry = cell[':@'] ?? {};
      if (['gridSpan','rowSpan'].some(key => Number(geometry[key] ?? 1) > 1) || ['hMerge','vMerge'].some(key => boolean(geometry[key]) === true)) emit('unsupported-table-merge', 'Merged-cell geometry is not represented; the native cell text is retained.');
      return cellText(child(cell['a:tc'], 'a:txBody'), context, relationships, emit, headers && rowIndex === 0);
    }));
    return headers && rows.length ? {columns:rows[0], rows:rows.slice(1)} : {rows};
  });
}
