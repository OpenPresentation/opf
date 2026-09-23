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
// PptxGenJS 4.0.1 createColorElement accepts only these scheme values.
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
  if (typeof reference !== 'string') return undefined;
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

/** Native slide background fill for a theme-slot background, or null when it must stay literal. */
export function schemeBackgroundFill(definition, context) {
  const slot = backgroundSlot(definition);
  if (!slot) return null;
  const value = schemeColorValue(slot, context.colors?.background, context);
  if (!value) return null;
  const opacity = typeof definition === 'object' && Number.isFinite(definition.opacity) ? definition.opacity : 1;
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 100000);
  return `<a:solidFill>${alpha === 100000 ? `<a:schemeClr val="${value}"/>` : `<a:schemeClr val="${value}"><a:alpha val="${alpha}"/></a:schemeClr>`}</a:solidFill>`;
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
