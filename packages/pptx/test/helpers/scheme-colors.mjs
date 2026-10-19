// RR-96: tests that read a colour from exported PresentationML. A colour is `a:srgbClr` (a literal), or `a:schemeClr` (a role or slot of the
// deck theme through the clrMap, with the luminance transforms of a derived neutral). `colorHex` returns the RRGGBB either one stands for,
// so a test can say what the colour is without caring whether it was written as a literal or as a scheme colour.
import {applyLuminance} from '@openpresentation/opf/composition';

const OOXML_SLOT = {dk1: 'dark1', lt1: 'light1', dk2: 'dark2', lt2: 'light2'};
const DEFAULT_MAP = {bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2'};

/**
 * @param node        the parsed colour holder: an object with `a:srgbClr` or `a:schemeClr` (a:solidFill, a:fgClr, a:ln's solidFill ...)
 * @param theme       {dk1, lt1, dk2, lt2, accent1..accent6, hlink, folHlink} RRGGBB of the exported theme (see `themeColors` in the tests)
 * @param clrMap      the map in force (the master's, or the slide's override): {bg1: 'lt1', tx1: 'dk1', ...}; the default map when omitted
 */
export function colorHex(node, theme, clrMap = {}) {
  if (node?.['a:srgbClr']) return String(node['a:srgbClr'].val).toUpperCase();
  const scheme = node?.['a:schemeClr'];
  if (!scheme) return undefined;
  const map = {...DEFAULT_MAP, ...clrMap};
  const slot = map[scheme.val] ?? scheme.val;
  let hex = theme[slot] ?? theme[OOXML_SLOT[slot]];
  if (!hex) return undefined;
  const mod = scheme['a:lumMod'] ? Number(scheme['a:lumMod'].val) : undefined, off = scheme['a:lumOff'] ? Number(scheme['a:lumOff'].val) : undefined;
  if (mod !== undefined || off !== undefined) hex = applyLuminance(`#${hex}`, mod ?? 100000, off ?? 0).slice(1);
  return hex.toUpperCase();
}

/** The `a:schemeClr val` of a colour holder, or undefined for a literal. */
export const schemeRole = node => node?.['a:schemeClr']?.val;

/**
 * The colours of an XML fragment in document order, as `{hex, role}`: `role` is the schemeClr name, undefined for a literal.
 * For tests that read exported XML with regular expressions.
 */
export function colorsInXml(xml, theme, clrMap = {}) {
  const found = [];
  for (const match of xml.matchAll(/<a:srgbClr val="(\w{6})"(?:\/>|>[\s\S]*?<\/a:srgbClr>)|<a:schemeClr val="(\w+)"(?:\/>|>([\s\S]*?)<\/a:schemeClr>)/g)) {
    if (match[1]) { found.push({hex: match[1].toUpperCase(), role: undefined}); continue; }
    const mods = match[3] ?? '';
    const node = {'a:schemeClr': {val: match[2], ...(/<a:lumMod val="(\d+)"/.test(mods) && {'a:lumMod': {val: /<a:lumMod val="(\d+)"/.exec(mods)[1]}}), ...(/<a:lumOff val="(\d+)"/.test(mods) && {'a:lumOff': {val: /<a:lumOff val="(\d+)"/.exec(mods)[1]}})}};
    found.push({hex: colorHex(node, theme, clrMap), role: match[2]});
  }
  return found;
}

/** `{dk1, lt1, ..., accent1..6, hlink, folHlink}` RRGGBB from the text of `ppt/theme/theme1.xml`. */
export function themeColorsOf(themeXml) {
  const out = {};
  for (const match of themeXml.matchAll(/<a:(dk1|lt1|dk2|lt2|accent[1-6]|hlink|folHlink)>\s*<a:(?:srgbClr val="(\w{6})"|sysClr [^>]*lastClr="(\w{6})")/g)) out[match[1]] = (match[2] ?? match[3]).toUpperCase();
  return out;
}

/** The `p:clrMap` (or `a:overrideClrMapping`) attributes of a master or slide part, e.g. `{bg1: 'dk2', tx1: 'lt1', ...}`; `{}` for a master mapping. */
export function clrMapOf(xml) {
  const tag = /<p:clrMap\b([^>]*)\/>|<a:overrideClrMapping\b([^>]*)\/>/.exec(xml);
  return tag ? Object.fromEntries([...(tag[1] ?? tag[2]).matchAll(/(\w+)="(\w+)"/g)].map(match => [match[1], match[2]])) : {};
}
