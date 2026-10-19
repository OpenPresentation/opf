// FF-24: write the deck's OPF color scheme into the exported theme and refer to
// it with a:schemeClr where the document names a scheme slot or role.
//
// OPF color schemes use the twelve OOXML theme slots (opf color-scheme.schema.json,
// docs/design-resolution.md). The theme clrScheme is deck-wide; PowerPoint has
// no per-slide theme. A content color becomes a scheme reference only when the
// document names a slot or role AND the deck theme slot holds exactly the color
// the slide resolved, so slide-level scheme overrides, variables, literals and
// engine-derived chrome colors stay literal sRGB.

import {readBackgroundColor} from './background.js';

/** OPF slot -> clrScheme child element, in CT_ColorScheme order. */
export const THEME_SLOTS = Object.freeze([
  ['dark1', 'dk1'], ['light1', 'lt1'], ['dark2', 'dk2'], ['light2', 'lt2'],
  ['accent1', 'accent1'], ['accent2', 'accent2'], ['accent3', 'accent3'],
  ['accent4', 'accent4'], ['accent5', 'accent5'], ['accent6', 'accent6'],
  ['hyperlink', 'hlink'], ['followedHyperlink', 'folHlink'],
]);

// Slide content reaches the theme through the clrMap: the master's, and a slide's own override (RR-96). With the default map
// bg1=lt1, tx1=dk1, bg2=lt2, tx2=dk2 and every other slot maps to itself; a variant swaps or re-points them (core ColorMap, whose
// slots are named dark1, light1, dark2, light2 and accent1 to accent6).
const DEFAULT_MAP = Object.freeze({bg1: 'light1', tx1: 'dark1', bg2: 'light2', tx2: 'dark2', accents: ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']});
const FIXED_VALUES = Object.freeze({hyperlink: 'hlink', followedHyperlink: 'folHlink'});
// Which scheme role a document color reference prefers when two roles map to one slot (light2 and dark2 variants map bg1 and bg2 to it).
const PREFERRED_ROLE = Object.freeze({background: 'bg1', surface: 'bg2', text: 'tx1', textSecondary: 'tx2'});
// The accent a color role names: the variant's first, second and third accent (the scheme's own order by default).
const ACCENT_ROLE_INDEX = Object.freeze({primary: 0, secondary: 1, accent: 2});

/**
 * The slide-content scheme value (tx1, bg1, bg2, tx2, accent3, hlink, ...) that reaches a theme slot through a clrMap, or undefined
 * when no role of the map points at the slot (light1 under a light2 variant). `prefer` names the role to use when several qualify.
 */
export function contentValueFor(slot, map = DEFAULT_MAP, prefer) {
  if (Object.hasOwn(FIXED_VALUES, slot)) return FIXED_VALUES[slot];
  if (/^accent[1-6]$/.test(slot)) {
    const index = (map.accents ?? DEFAULT_MAP.accents).indexOf(slot);
    return index >= 0 ? `accent${index + 1}` : undefined;
  }
  const roles = ['bg1', 'tx1', 'bg2', 'tx2'].filter(role => map[role] === slot);
  return roles.includes(prefer) ? prefer : roles[0];
}
// PptxGenJS 4.0.1 createColorElement accepts only these scheme values (pptxgenjs-plus accepts more; the set is kept
// so exported colours stay as they were).
const VENDOR_VALUES = new Set(['tx1', 'tx2', 'bg1', 'bg2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']);

// Role names resolve through core resolveColorRef with the exporter's resolved
// chrome colors (color-ref.js coreRoles). These are the slots each role can land
// on; a slot is used only when its deck theme value equals the resolved color.
const ROLE_SLOTS = Object.freeze({
  primary: ['accent1'],
  secondary: ['accent2'],
  accent: ['accent3'],
  text: ['dark1', 'light1'],
  textSecondary: ['dark2', 'light2'],
  surface: ['light2', 'dark2'],
});
// Abstract roles supply a slot only when the scheme leaves that slot unset.
const ROLE_FOR_SLOT = Object.freeze({accent1: 'primary', accent2: 'secondary', accent3: 'accent', light1: 'background', light2: 'surface', dark1: 'text', dark2: 'textSecondary'});

const SLOT_NAMES = new Set(THEME_SLOTS.map(([slot]) => slot));

export function sixDigitHex(value) {
  if (typeof value !== 'string') return undefined;
  let raw = value.trim().replace(/^#/, '');
  if (/^[\da-f]{3}$/i.test(raw)) raw = [...raw].map(char => char + char).join('');
  if (/^[\da-f]{8}$/i.test(raw) && /ff$/i.test(raw)) raw = raw.slice(0, 6);
  return /^[\da-f]{6}$/i.test(raw) ? raw.toUpperCase() : undefined;
}

/** Twelve-slot map (OPF slot -> RRGGBB) for a resolved color scheme. Unset slots are omitted. */
export function themeSlotColors(colorScheme = {}) {
  const colors = {};
  for (const [slot] of THEME_SLOTS) {
    const value = sixDigitHex(colorScheme[slot]) ?? sixDigitHex(colorScheme[ROLE_FOR_SLOT[slot]]);
    if (value) colors[slot] = value;
  }
  return colors;
}

const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[char]));

/**
 * Replace the vendored Office clrScheme with the deck scheme. Slots the scheme
 * leaves unset keep the vendored value. With a theme name, rename the theme and
 * its thm15 theme family so an OPF catalog theme can be recognized on import.
 */
export function writeThemeColors(xml, {colors, schemeName, themeName}) {
  let result = xml.replace(/<a:clrScheme\b[^>]*>([\s\S]*?)<\/a:clrScheme>/, (scheme, body) => {
    for (const [slot, element] of THEME_SLOTS) {
      if (!colors[slot]) continue;
      body = body.replace(new RegExp(`<a:${element}>[\\s\\S]*?</a:${element}>`), `<a:${element}><a:srgbClr val="${colors[slot]}"/></a:${element}>`);
    }
    return `<a:clrScheme name="${escapeXml(schemeName)}">${body}</a:clrScheme>`;
  });
  if (themeName) {
    const name = escapeXml(themeName);
    result = result.replace(/(<a:theme\b[^>]*\bname=")[^"]*(")/, `$1${name}$2`)
      .replace(/(<thm15:themeFamily\b[^>]*\bname=")[^"]*(")/, `$1${name}$2`);
  }
  return result;
}

function backgroundSlot(definition) {
  if (typeof definition === 'string' && !definition.startsWith('#')) return definition;
  if (definition && typeof definition === 'object' && definition.type === 'theme') return definition.slot;
  return undefined;
}

/**
 * The slide-content scheme value (tx1, bg2, accent3, hlink, ...) for a document
 * color reference, or undefined when it must stay a literal color.
 *
 * `hex` is the color the exporter already resolved for this slide. The reference
 * qualifies only when it names a slot or role and the deck theme slot, which the
 * schemeClr will actually resolve to, holds that exact opaque color.
 * `vendor` limits the result to scheme values PptxGenJS 4.0.1 can emit.
 */
export function schemeColorValue(reference, hex, context, {vendor = false} = {}) {
  // A slide with its own color scheme is pinned to literal colors: a theme edit
  // in PowerPoint must not partially recolor it, even where a value coincides.
  if (typeof reference !== 'string' || context.schemeOverride) return undefined;
  const name = reference.trim();
  const resolved = sixDigitHex(hex);
  const deck = context.themeColors;
  if (!resolved || !deck) return undefined;
  let slots;
  const map = context.roles?.map;
  if (SLOT_NAMES.has(name)) slots = [name];
  // RR-96: the slide's own roles come first (a variant puts bg1, tx1, bg2 and tx2 on other slots), then the earlier slot candidates.
  else if (name === 'background') slots = [map?.bg1, map?.bg2, backgroundSlot(context.backgroundDefinition)].filter(slot => SLOT_NAMES.has(slot));
  else if (map && ACCENT_ROLE_INDEX[name] !== undefined) slots = [map.accents?.[ACCENT_ROLE_INDEX[name]]].filter(Boolean);
  else if (map && PREFERRED_ROLE[name]) slots = [map[PREFERRED_ROLE[name]], ...(ROLE_SLOTS[name] ?? [])];
  else slots = ROLE_SLOTS[name] ?? [];
  const effective = themeSlotColors(context.colorScheme);
  for (const slot of slots) {
    if (deck[slot] !== resolved || effective[slot] !== resolved) continue;
    const value = contentValueFor(slot, context.roles?.map, PREFERRED_ROLE[name]);
    if (value && (!vendor || VENDOR_VALUES.has(value))) return value;
  }
  return undefined;
}

function backgroundOpacity(definition) {
  const opacity = typeof definition === 'object' && Number.isFinite(definition?.opacity) ? definition.opacity : 1;
  return Math.max(0, Math.min(1, opacity));
}

/** Scheme value of a theme-slot slide background, or undefined when the background stays literal. */
export function schemeBackgroundValue(definition, context) {
  const slot = backgroundSlot(definition);
  if (slot) return schemeColorValue(slot, context.colors?.background, context) ?? schemeColorValue('background', context.colors?.background, context);
  // RR-96: no background of its own (or none named): the slide's bg1 through its variant's map.
  return definition === undefined ? schemeColorValue('background', context.colors?.background, context) : undefined;
}

/** Native slide background fill for a theme-slot background, or null when it must stay literal. */
export function schemeBackgroundFill(definition, context) {
  const value = schemeBackgroundValue(definition, context);
  if (!value) return null;
  const alpha = Math.round(backgroundOpacity(definition) * 100000);
  return `<a:solidFill>${alpha === 100000 ? `<a:schemeClr val="${value}"/>` : `<a:schemeClr val="${value}"><a:alpha val="${alpha}"/></a:schemeClr>`}</a:solidFill>`;
}

/**
 * Scheme values for the exporter's default text and muted text on this slide: the roles tx1 and tx2 of the slide's map (RR-96). A dark
 * slide is the dark variant's map with light text through tx1 and tx2, not hand-inverted colors; the values are used only where the
 * resolved color is exactly what the map's slot holds in the deck theme, and a slide without its own scheme.
 */
export function defaultTextSchemeValues(context) {
  const values = {};
  for (const [role, name, hex] of [['text', 'text', context.colors?.text], ['muted', 'textSecondary', context.colors?.mutedText]]) {
    const value = schemeColorValue(name, hex, context);
    if (value) values[role] = value;
  }
  return values;
}

/**
 * Scheme value for the exporter's default text in a table cell whose fill is a
 * theme reference (`fillValue`, from schemeColorValue). A fill on the background
 * side (bg1, bg2) pairs with the map's text slot, a text-side fill (tx1, tx2) with its background slot,
 * and an accent fill has contrast-selected text, which stays a theme reference only
 * when the selection is exactly one of those two slots. Anything else, and any
 * fill that is not a theme reference, keeps literal text.
 */
export function tableTextSchemeValue(fillValue, hex, context) {
  if (!fillValue) return undefined;
  const map = context.roles?.map ?? DEFAULT_MAP;
  const light = /^bg[12]$/.test(fillValue), dark = /^tx[12]$/.test(fillValue);
  const candidates = light ? [map.tx1] : dark ? [map.bg1] : /^accent[1-6]$/.test(fillValue) ? [map.bg1, map.tx1] : [];
  for (const slot of candidates) {
    const value = schemeColorValue(slot, hex, context, {vendor: true});
    if (value) return value;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// RR-96: scheme-derived colors in the finished parts

const hex6Of = value => sixDigitHex(value);

/**
 * The colors of one slide that are scheme colors, keyed by RRGGBB: the roles tx1, bg1, tx2 and bg2 and the accents through the slide's
 * map, then every neutral core derived (border, gridline, axis line, chart text, outline, neutral trend, code panel, code text and code
 * comment), each with the scheme value to write and its luminance transform (`lumMod`, `lumOff`, in thousandths of a percent).
 * A color that two entries share keeps the first (plain roles before accents before neutrals). Empty for a slide with its own color scheme
 * (its colors stay literal) or one whose roles carry no map (a core older than the variants).
 */
export function schemeColorTable(context) {
  const table = new Map();
  const map = context.roles?.map;
  if (!map || context.schemeOverride) return table;
  const slots = themeSlotColors(context.colorScheme);
  const roleHex = role => /^accent([1-6])$/.test(role) ? slots[(map.accents ?? [])[Number(role.slice(6)) - 1]] : slots[map[role]];
  const add = (hex, entry) => { const key = hex6Of(hex); if (key && !table.has(key)) table.set(key, entry); };
  for (const role of ['tx1', 'bg1', 'tx2', 'bg2']) if (slots[map[role]]) add(slots[map[role]], {value: role});
  (map.accents ?? []).forEach((slot, index) => { if (slots[slot]) add(slots[slot], {value: `accent${index + 1}`}); });
  for (const neutral of Object.values(context.roles.neutrals ?? {})) {
    if (!neutral?.slot || !/^(?:tx[12]|bg[12]|accent[1-6])$/.test(neutral.slot)) continue;
    // A neutral that is a plain role (no luminance transform) is that role only where the scheme's slot has its color: on a slide with a literal
    // background the outline is bg1 by name but the literal's color.
    if (neutral.lumMod === undefined && neutral.lumOff === undefined && hex6Of(neutral.hex) !== roleHex(neutral.slot)) continue;
    add(neutral.hex, {value: neutral.slot, ...(neutral.lumMod !== undefined ? {lumMod: neutral.lumMod} : {}), ...(neutral.lumOff !== undefined ? {lumOff: neutral.lumOff} : {})});
  }
  return table;
}

/**
 * Rewrite the literal `a:srgbClr` colors of a finished slide, chart or master part that are scheme colors to `a:schemeClr`: the role with its
 * `lumMod` and `lumOff` for a derived neutral, keeping any child the literal carried (an alpha). `table` is {@link schemeColorTable}; `keep` holds the
 * RRGGBB colors the author wrote literally on the slide, which stay literal even when a scheme color happens to equal them, and a literal that
 * already carries its own luminance transform is left alone.
 */
export function writeSchemeColors(xml, table, keep = new Set()) {
  if (!table.size) return xml;
  return xml.replace(/<a:srgbClr val="([0-9A-Fa-f]{6})"\s*(?:\/>|>([\s\S]*?)<\/a:srgbClr>)/g, (match, hex, inner = '') => {
    const key = hex.toUpperCase(), entry = table.get(key);
    if (!entry || keep.has(key) || /<a:(?:lumMod|lumOff|tint|shade|satMod)\b/.test(inner)) return match;
    const transforms = `${entry.lumMod !== undefined ? `<a:lumMod val="${entry.lumMod}"/>` : ''}${entry.lumOff !== undefined ? `<a:lumOff val="${entry.lumOff}"/>` : ''}`;
    return `<a:schemeClr val="${entry.value}">${transforms}${inner}</a:schemeClr>`;
  });
}

/** The RRGGBB colors written literally in a slide's authored content (and the document's variables), which a scheme color must not take over. */
export function authoredLiteralColors(...values) {
  const found = new Set();
  const visit = value => {
    if (typeof value === 'string') { for (const match of value.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})(?:[0-9a-f]{2})?\b/gi)) found.add(sixDigitHex(`#${match[1]}`)); }
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  values.forEach(visit);
  found.delete(undefined);
  return found;
}

// ---------------------------------------------------------------------------
// Import

const asArray = value => value === undefined ? [] : Array.isArray(value) ? value : [value];

/** Read the twelve clrScheme slots as RRGGBB; unreadable slots are listed separately. */
export function readThemeSlotColors(clrScheme) {
  const colors = {}, unreadable = [];
  for (const [slot, element] of THEME_SLOTS) {
    const node = clrScheme?.[`a:${element}`];
    const color = node && !Array.isArray(node) ? readBackgroundColor(node) : null;
    if (color && color.alpha === 1) colors[slot] = color.hex.slice(1);
    else unreadable.push(slot);
  }
  return {colors, unreadable};
}

function recordColors(record) {
  return Object.fromEntries(THEME_SLOTS.map(([slot]) => [slot, sixDigitHex(record[slot])]));
}

/**
 * Recover design.colorScheme from theme clrScheme colors.
 * `records` are the colour schemes a bare id can name in the imported document
 * (FA-23: the host default catalog's, each with its key as `id`; none when the
 * host registers no catalog). An exact twelve-slot match yields that bare id
 * (the clrScheme name breaks ties). Otherwise the colors are inline: relative
 * to the record whose name the clrScheme carries, or as all readable slots.
 */
export function recoverColorScheme({colors, unreadable, name}, records) {
  const complete = unreadable.length === 0;
  const exact = complete ? records.filter(record => THEME_SLOTS.every(([slot]) => recordColors(record)[slot] === colors[slot])) : [];
  const named = record => record.name === name || record.id === name;
  if (exact.length) return {value: (exact.find(named) ?? exact[0]).id, exact: true};
  const base = records.find(named);
  const inline = {};
  if (base) {
    inline.id = base.id;
    const baseColors = recordColors(base);
    for (const [slot] of THEME_SLOTS) if (colors[slot] && colors[slot] !== baseColors[slot]) inline[slot] = `#${colors[slot]}`;
  } else {
    for (const [slot] of THEME_SLOTS) if (colors[slot]) inline[slot] = `#${colors[slot]}`;
  }
  return {value: inline, exact: false};
}

/** First slide master's theme part, else the presentation's theme relationship. */
export function presentationThemePath(presentationRoot, presentationRels, relationshipsFor, entries) {
  const byId = presentationRels;
  const masterIds = asArray(presentationRoot?.['p:sldMasterIdLst']?.['p:sldMasterId']).map(node => node?.['r:id']);
  const masterPath = masterIds.map(id => byId.get(id)).find(rel => rel?.type?.endsWith('/slideMaster') && entries[rel.path])?.path
    ?? [...byId.values()].find(rel => rel.type?.endsWith('/slideMaster') && entries[rel.path])?.path;
  const fromMaster = masterPath && [...relationshipsFor(masterPath).values()].find(rel => rel.type?.endsWith('/theme') && entries[rel.path])?.path;
  return fromMaster ?? [...byId.values()].find(rel => rel.type?.endsWith('/theme') && entries[rel.path])?.path;
}

/**
 * Identify a catalog theme from the native theme name. `themes` are the theme
 * records a bare id can name (as for recoverColorScheme, each with its key as
 * `id`); `colorScheme(theme)` and `fontFamilies(theme)` resolve the theme's own
 * references (null when they resolve nowhere). The name must equal a theme
 * name, and the package must corroborate it with that theme's color scheme or
 * its heading/body font pair, so a foreign deck that happens to use a theme
 * called "Bold" is not bound to the OPF theme.
 */
export function recoverTheme({themeName, colors, majorFont, minorFont}, {themes, colorScheme, fontFamilies}) {
  if (!themeName) return {};
  const theme = themes.find(record => record.name === themeName);
  if (!theme) return {};
  const scheme = colorScheme(theme);
  const schemeColors = scheme ? recordColors(scheme) : null;
  const colorMatch = !!schemeColors && THEME_SLOTS.every(([slot]) => schemeColors[slot] === colors[slot]);
  const fonts = fontFamilies(theme);
  const fontMatch = !!fonts && fonts.heading === majorFont && fonts.body === minorFont;
  return colorMatch || fontMatch ? {id: theme.id} : {unverified: theme.id};
}

// ---------------------------------------------------------------------------
// RR-96: the color map back to a variant

const MAP_BACKGROUNDS = Object.freeze({'lt1,dk1,lt2,dk2': 'light1', 'lt2,dk1,lt2,dk2': 'light2', 'dk1,lt1,dk2,lt2': 'dark1', 'dk2,lt1,dk2,lt2': 'dark2'});
const ACCENT_KEYS = Object.freeze(['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']);

/**
 * The variant a PowerPoint color map stands for (`mapping`: bg1, tx1, bg2, tx2 as lt1, dk1, lt2, dk2, and the six accents; a missing attribute is
 * the default). `design.variant` as authored is the background slot alone (`"dark1"`) unless the accents are re-pointed, which needs the object form
 * `{background, accents}`. Returns `{variant}` (the default map is `light1` with no accent order, written only when `explicit`, a slide
 * override back to the default), `{} ` for the default map, and `{unsupported: true}` for a map that is no variant (bg1 on an accent, text on a light and
 * background on a light slot, a repeated accent): the caller reports it and imports nothing.
 */
export function variantFromColorMap(mapping, {explicit = false} = {}) {
  const at = (key, fallback) => (typeof mapping?.[key] === 'string' ? mapping[key] : fallback);
  const background = MAP_BACKGROUNDS[[at('bg1', 'lt1'), at('tx1', 'dk1'), at('bg2', 'lt2'), at('tx2', 'dk2')].join(',')];
  const accents = ACCENT_KEYS.map(key => at(key, key));
  const permutation = accents.length === 6 && new Set(accents).size === 6 && accents.every(slot => ACCENT_KEYS.includes(slot));
  if (!background || !permutation) return {unsupported: true};
  const reordered = accents.some((slot, index) => slot !== ACCENT_KEYS[index]);
  if (!reordered && background === 'light1' && !explicit) return {};
  return {variant: reordered ? {background, accents} : background};
}

// ---------------------------------------------------------------------------
// Slide master

/** a:solidFill child for a pptx color value: a scheme value or RRGGBB. */
export function solidColorXml(value) {
  return /^(?:tx[12]|bg[12]|accent[1-6]|hlink|folHlink)$/.test(value) ? `<a:schemeClr val="${value}"/>` : `<a:srgbClr val="${value}"/>`;
}

/**
 * Give the slide master the deck's theme background and matching default text
 * so slides added in PowerPoint follow the chosen theme. The vendored master
 * has no background (its layout uses the bg1 background style) and tx1 text.
 */
export function writeMasterBackground(xml, {fill, text}) {
  let result = xml.replace(/<p:bg>[\s\S]*?<\/p:bg>/, '');
  result = result.replace(/<p:cSld\b([^>]*)>/, `<p:cSld$1><p:bg><p:bgPr>${fill}<a:effectLst/></p:bgPr></p:bg>`);
  if (text && text !== 'tx1') {
    result = result.replace(/<p:txStyles>[\s\S]*?<\/p:txStyles>/, styles =>
      styles.split('<a:solidFill><a:schemeClr val="tx1"/></a:solidFill>').join(`<a:solidFill>${solidColorXml(text)}</a:solidFill>`));
  }
  return result;
}

/** The vendored layout's own bg1 background would hide the master background. */
export function inheritLayoutBackground(xml) {
  return xml.replace(/<p:bg>[\s\S]*?<\/p:bg>/, '');
}
