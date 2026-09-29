import {readBackgroundColor} from './background.js';

const boolean = value => ['1','true','on'].includes(value) ? true : ['0','false','off'].includes(value) ? false : undefined;

export function nativeRunStyle(properties, context, relationships, report, kind = 'table') {
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
  if (properties['a:latin'] && !font) report(`unsupported-${kind}-font`, 'The native text font has no usable Latin face or theme reference.');
  if (font) {
    const match = font.match(/^\+(mj|mn)-(lt|ea|cs)$/);
    const family = match ? context.fonts?.[match[1] === 'mj' ? 'a:majorFont' : 'a:minorFont']?.[{lt:'a:latin',ea:'a:ea',cs:'a:cs'}[match[2]]]?.typeface : font;
    if (family) result.fontFamily = family;
    else report(`unsupported-${kind}-font`, 'The theme font reference could not be resolved from this archive.');
  }
  if (properties['a:solidFill']) {
    const color = readBackgroundColor(properties['a:solidFill'], context);
    if (color) result.color = color.hex + (color.alpha < 1 ? Math.round(color.alpha * 255).toString(16).padStart(2, '0').toUpperCase() : '');
    else report(`unsupported-${kind}-text-color`, 'The native text color or its transforms could not be resolved.');
  } else if (properties['a:noFill']) {
    result.color = '#00000000';
  }
  if (['a:gradFill','a:blipFill','a:pattFill','a:grpFill'].some(key => properties[key])) report(`unsupported-${kind}-text-fill`, 'Only solid native text fills are represented by OPF runs.');
  const hyperlink = properties['a:hlinkClick'];
  if (hyperlink) {
    const relationship = relationships.get(hyperlink['r:id']);
    if (relationship?.type.endsWith('/hyperlink') && relationship.targetMode === 'External' && relationship.target && !hyperlink.action) result.link = relationship.target;
    else report(`unsupported-${kind}-link`, 'The native hyperlink action or relationship cannot be represented as a URL.');
  }
  return result;
}

// Merge at the native property level before conversion: an explicit normal run
// overrides a bold paragraph default, and a new fill replaces the inherited fill.
export function mergeNativeRunProperties(...levels) {
  const result = {};
  const fills = ['a:solidFill','a:noFill','a:gradFill','a:blipFill','a:pattFill','a:grpFill','_opfUnresolvedTableFill'];
  for (const level of levels) {
    if (!level) continue;
    if (fills.some(key => Object.hasOwn(level, key))) for (const key of fills) delete result[key];
    Object.assign(result, level);
  }
  return result;
}
