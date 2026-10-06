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

// Slide content reaches the theme through the master clrMap. The vendored
// master maps bg1=lt1, tx1=dk1, bg2=lt2, tx2=dk2 and every other slot to itself.
const CONTENT_VALUES = Object.freeze({
  dark1: 'tx1', light1: 'bg1', dark2: 'tx2', light2: 'bg2',
  accent1: 'accent1', accent2: 'accent2', accent3: 'accent3',
  accent4: 'accent4', accent5: 'accent5', accent6: 'accent6',
  hyperlink: 'hlink', followedHyperlink: 'folHlink',
});
// PptxGenJS 4.0.1 createColorElement accepts only these scheme values (pptxgenjs-plus accepts more; the set is kept
// so exported colours stay as they were).
const VENDOR_VALUES = new Set(['tx1', 'tx2', 'bg1', 'bg2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']);

// Role names resolve through core resolveColorRef with the exporter's resolved
// chrome colors (color-ref.js coreRoles). These are the slots each role can land
// on; a slot is used only when its deck theme value equals the resolved color.
const ROLE_SLOTS = Object.freeze({
  primary: ['accent1'],
  secondary: ['accent2'],
  accent: ['accent1', 'accent3'],
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
  if (SLOT_NAMES.has(name)) slots = [name];
  else if (name === 'background') slots = [backgroundSlot(context.backgroundDefinition)].filter(slot => SLOT_NAMES.has(slot));
  else slots = ROLE_SLOTS[name] ?? [];
  const effective = themeSlotColors(context.colorScheme);
  for (const slot of slots) {
    if (deck[slot] !== resolved || effective[slot] !== resolved) continue;
    const value = CONTENT_VALUES[slot];
    if (!vendor || VENDOR_VALUES.has(value)) return value;
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
  return slot ? schemeColorValue(slot, context.colors?.background, context) : undefined;
}

/** Native slide background fill for a theme-slot background, or null when it must stay literal. */
export function schemeBackgroundFill(definition, context) {
  const value = schemeBackgroundValue(definition, context);
  if (!value) return null;
  const alpha = Math.round(backgroundOpacity(definition) * 100000);
  return `<a:solidFill>${alpha === 100000 ? `<a:schemeClr val="${value}"/>` : `<a:schemeClr val="${value}"><a:alpha val="${alpha}"/></a:schemeClr>`}</a:solidFill>`;
}

// The exporter picks default text for contrast with the slide background:
// light1 on a dark background, else the scheme text (dark1); muted text is
// dark2/light2. When the background itself is a theme reference, the matching
// text slot is the semantic pair, so a PowerPoint theme switch moves both.
const TEXT_PAIRS = Object.freeze({
  light1: {text: 'dark1', muted: 'dark2'}, light2: {text: 'dark1', muted: 'dark2'},
  dark1: {text: 'light1', muted: 'light2'}, dark2: {text: 'light1', muted: 'light2'},
});

/**
 * Scheme values for the exporter's default text and muted text on this slide.
 * A role gets a scheme value only when the slide background is an opaque theme
 * reference to a light or dark slot, the slide has no scheme override, and the
 * resolved default color is exactly the paired slot in the deck theme.
 */
export function defaultTextSchemeValues(context) {
  const background = schemeBackgroundValue(context.backgroundDefinition, context);
  if (!background || backgroundOpacity(context.backgroundDefinition) !== 1) return {};
  const pair = TEXT_PAIRS[backgroundSlot(context.backgroundDefinition)];
  if (!pair) return {};
  const values = {};
  for (const role of ['text', 'muted']) {
    const hex = role === 'text' ? context.colors?.text : context.colors?.mutedText;
    const value = schemeColorValue(pair[role], hex, context);
    if (value) values[role] = value;
  }
  return values;
}

/**
 * Scheme value for the exporter's default text in a table cell whose fill is a
 * theme reference (`fillValue`, from schemeColorValue). A light or dark fill (bg1,
 * bg2, tx1, tx2) pairs with the opposite text slot (dark1 on bg, light1 on tx).
 * An accent fill has contrast-selected text, which stays a theme reference only
 * when the selection is exactly the deck light1 or dark1. Anything else, and any
 * fill that is not a theme reference, keeps literal text.
 */
export function tableTextSchemeValue(fillValue, hex, context) {
  if (!fillValue) return undefined;
  const light = /^bg[12]$/.test(fillValue), dark = /^tx[12]$/.test(fillValue);
  const candidates = light ? ['dark1'] : dark ? ['light1'] : /^accent[1-6]$/.test(fillValue) ? ['light1', 'dark1'] : [];
  for (const slot of candidates) {
    const value = schemeColorValue(slot, hex, context, {vendor: true});
    if (value) return value;
  }
  return undefined;
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
 * An exact twelve-slot match with a catalog record yields its id (the clrScheme
 * name breaks ties). Otherwise the colors are inline: relative to the record
 * whose name the clrScheme carries, or as all readable slots.
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
 * Identify a catalog theme from the native theme name. The name must equal a
 * catalog theme name, and the package must corroborate it with that theme's
 * color scheme or its heading/body font pair, so a foreign deck that happens to
 * use a theme called "Bold" is not bound to the OPF theme.
 */
export function recoverTheme({themeName, colors, majorFont, minorFont}, {themes, colorSchemes, fontFamilies}) {
  if (!themeName) return {};
  const theme = themes.find(record => record.name === themeName);
  if (!theme) return {};
  const scheme = colorSchemes.find(record => record.id === theme.colorScheme);
  const schemeColors = scheme ? recordColors(scheme) : null;
  const colorMatch = !!schemeColors && THEME_SLOTS.every(([slot]) => schemeColors[slot] === colors[slot]);
  const fonts = fontFamilies(theme.fontScheme);
  const fontMatch = !!fonts && fonts.heading === majorFont && fonts.body === minorFont;
  return colorMatch || fontMatch ? {id: theme.id} : {unverified: theme.id};
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
