import {readBackgroundColor} from './background.js';
import {splitWeightFace} from './font-weights.js';

const boolean = value => ['1','true','on'].includes(value) ? true : ['0','false','off'].includes(value) ? false : undefined;

const themeFamilies = context => ['a:majorFont', 'a:minorFont'].map(key => context.fonts?.[key]?.['a:latin']?.typeface?.trim().toLowerCase()).filter(Boolean);

// A run painted with a bare theme slot (a:schemeClr, no color transform) remembers the slot as the OPF color name: the
// transient `_opfScheme` marker is read, and always removed, by restoreRunColors (run-colors.js) once the document's own
// colour scheme can confirm the slot holds that colour.
const OPF_SLOTS = {dk1: 'dark1', lt1: 'light1', dk2: 'dark2', lt2: 'light2', hlink: 'hyperlink', folHlink: 'followedHyperlink', accent1: 'accent1', accent2: 'accent2', accent3: 'accent3', accent4: 'accent4', accent5: 'accent5', accent6: 'accent6'};
function nativeSchemeSlot(fill, context) {
  const node = fill?.['a:schemeClr'];
  if (!node || Array.isArray(node) || Object.keys(fill).length !== 1 || Object.keys(node).some(key => key !== 'val') || typeof node.val !== 'string') return undefined;
  // Own keys only: a slot name from the package (`__proto__`, `constructor`) must never reach an inherited property.
  const mapping = context?.mapping, slot = mapping && Object.hasOwn(mapping, node.val) ? mapping[node.val] : node.val;
  return typeof slot === 'string' && Object.hasOwn(OPF_SLOTS, slot) ? OPF_SLOTS[slot] : undefined;
}

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
    if (family) {
      result.fontFamily = family;
      // The exporter writes a bundled family's weight faces (Roboto SemiBold) under their
      // native style-link names. OPF runs carry the family plus bold, never the face name.
      // A typeface that is itself a theme font was authored as a family; leave it as is.
      const face = themeFamilies(context).includes(family.trim().toLowerCase()) ? undefined : splitWeightFace(family);
      if (face) {
        result.fontFamily = face.family;
        if (face.weight >= 600) result.bold = true;
        if (face.italic) result.italic = true;
        if (face.weight !== 400 && face.weight !== 700) report(`approximate-${kind}-font-weight`, 'OPF text runs represent regular or bold only; the native weight face was imported as its family, with bold for weights of 600 and above.');
      }
    } else report(`unsupported-${kind}-font`, 'The theme font reference could not be resolved from this archive.');
  }
  if (properties['a:solidFill']) {
    const color = readBackgroundColor(properties['a:solidFill'], context);
    if (color) {
      result.color = color.hex + (color.alpha < 1 ? Math.round(color.alpha * 255).toString(16).padStart(2, '0').toUpperCase() : '');
      const slot = color.alpha === 1 ? nativeSchemeSlot(properties['a:solidFill'], context) : undefined;
      if (slot) result._opfScheme = slot;
    }
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
