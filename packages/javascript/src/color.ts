import { ENGINE_DEFAULT_COLOR_SCHEME } from './engine-vocabularies.js';
import { legible } from './legible-color.js';

const schemeColorSlots = new Set([
  'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6',
  'dark1', 'dark2', 'light1', 'light2', 'hyperlink', 'followedHyperlink',
]);

const schemeColorRoles = new Set([
  'primary', 'secondary', 'accent', 'background', 'surface', 'surfaceAlt', 'text', 'textSecondary',
]);

const defaultRoleSlots: Record<string, string> = {
  primary: 'accent1',
  secondary: 'accent2',
  accent: 'accent3',
  background: 'light1',
  surface: 'light2',
  text: 'dark1',
  textSecondary: 'dark2',
};

/** Normalize a literal hex color to uppercase #RRGGBB. */
export function normalizeHexColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  let hex = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(hex)) hex = `#${[...hex.slice(1)].map((char) => char + char).join('')}`;
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return hex.length === 9 ? `#${hex.slice(1, 7).toUpperCase()}` : hex.toUpperCase();
  return undefined;
}

export type ResolveColorRefRoles = Partial<Record<
  'primary' | 'secondary' | 'accent' | 'background' | 'surface' | 'surfaceAlt' | 'text' | 'textSecondary',
  string
>>;

export interface ResolveColorRefOptions {
  /** Effective color scheme after design resolution (OOXML slots plus optional role hex overrides). */
  colorScheme: Record<string, unknown>;
  /** Optional resolved chrome colors (e.g. renderer `design.colors` with `textSecondary` mapped to `mutedText`). */
  roles?: ResolveColorRefRoles;
  /** Top-level presentation `variables` map. */
  variables?: Record<string, unknown>;
  /** Theme text color returned when a reference cannot be resolved. */
  fallback: string;
}

function schemeSlot(colorScheme: Record<string, unknown>, slot: string, fallback: string): string {
  return normalizeHexColor(colorScheme[slot]) ?? fallback;
}

function resolveVariable(variables: Record<string, unknown>, id: string, fallback: string): string {
  const entry = variables[id];
  if (typeof entry === 'string') return normalizeHexColor(entry) ?? fallback;
  if (entry && typeof entry === 'object' && (entry as { type?: string }).type === 'color') {
    return normalizeHexColor((entry as { value?: unknown }).value) ?? fallback;
  }
  return fallback;
}

/** Resolve a ColorRef or TextRun.color string to a literal hex color. */
export function resolveColorRef(reference: string, options: ResolveColorRefOptions): string {
  const { colorScheme, roles, variables = {}, fallback } = options;
  const literal = normalizeHexColor(reference);
  if (literal) return literal;

  if (reference.startsWith('var:')) {
    const id = reference.slice('var:'.length);
    if (/^[a-z][a-z0-9-]*$/.test(id)) return resolveVariable(variables, id, fallback);
    return fallback;
  }

  if (schemeColorRoles.has(reference)) {
    const roleKey = reference as keyof ResolveColorRefRoles;
    const fromRoles = roles?.[roleKey];
    if (fromRoles) return normalizeHexColor(fromRoles) ?? fallback;
    // surfaceAlt has no slot or scheme override: it is derived from the surface and text roles (see surfaceAltColor).
    if (reference === 'surfaceAlt') {
      const surface = resolveColorRef('surface', { colorScheme, roles, variables, fallback: '#FFFFFF' });
      const text = resolveColorRef('text', { colorScheme, roles, variables, fallback: textColorForFill(surface, '#000000') });
      return surfaceAltColor(surface, text);
    }
    const fromScheme = normalizeHexColor(colorScheme[reference]);
    if (fromScheme) return fromScheme;
    const slot = defaultRoleSlots[reference];
    return slot ? schemeSlot(colorScheme, slot, fallback) : fallback;
  }

  if (schemeColorSlots.has(reference)) return schemeSlot(colorScheme, reference, fallback);

  return fallback;
}

/** WCAG relative luminance below which a slide background counts as dark (the point where white and black text contrast equally). */
export const DARK_BACKGROUND_LUMINANCE = 0.179;

/** True when text on this color should be light: its relative luminance is under {@link DARK_BACKGROUND_LUMINANCE}. An unreadable color is not dark. */
export function isDarkColor(color: unknown): boolean {
  const hex = normalizeHexColor(color);
  const value = hex ? luminance(hex) : undefined;
  return value !== undefined && value < DARK_BACKGROUND_LUMINANCE;
}

/**
 * The slide background a color scheme implies when the design names no single-color background: the scheme's
 * `background` role override, else its light1 slot, else white. Gradient and picture backgrounds use it too.
 */
export function defaultSlideBackground(colorScheme: Record<string, unknown>): string {
  return keepAlpha(colorScheme.background) ?? slotKeepingAlpha(colorScheme, 'light1', '#FFFFFF');
}

/** A hex color as uppercase #RRGGBB, keeping an #RRGGBBAA alpha byte (a translucent scheme surface stays translucent). */
function keepAlpha(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const hex = value.trim();
  if (/^#[0-9a-f]{8}$/i.test(hex)) return hex.toUpperCase();
  return normalizeHexColor(hex);
}

function slotKeepingAlpha(colorScheme: Record<string, unknown>, slot: string, fallback: string): string {
  return keepAlpha(colorScheme[slot]) ?? fallback;
}

/** The OOXML theme hyperlink colors a scheme without hyperlink slots gets (the Office theme values the PPTX export writes). */
const DEFAULT_HYPERLINK = '#0563C1';
const DEFAULT_FOLLOWED_HYPERLINK = '#954F72';

/** The link color a slide draws: the scheme's, unless it is hard to read on this background (the rule the slide tag follows for the primary color). */
const MIN_LINK_CONTRAST = 4.5;
function readableLink(link: string, background: string, text: string): string {
  const linkHex = normalizeHexColor(link), backgroundHex = normalizeHexColor(background);
  const contrast = linkHex && backgroundHex ? colorContrast(linkHex, backgroundHex) : undefined;
  return contrast !== undefined && contrast < MIN_LINK_CONTRAST ? text : link;
}

// --------------------------------------------------------------- variants: PowerPoint's colour map over one scheme (RR-96)

/** The four slots a variant can use as the slide background. */
export type ColorVariantBackground = 'light1' | 'light2' | 'dark1' | 'dark2';
export type ColorAccentSlot = 'accent1' | 'accent2' | 'accent3' | 'accent4' | 'accent5' | 'accent6';
const ACCENT_SLOTS: readonly ColorAccentSlot[] = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];

/**
 * A variant of the deck's single colour scheme: which slot is the background (and so which are the text and the alternate surface),
 * and optionally the order of the accents. It is a mapping over the scheme's twelve slots, as PowerPoint's `clrMap` is, never a second
 * scheme: nothing in it is a colour.
 */
export interface ColorVariant {
  background: ColorVariantBackground;
  /** A permutation of `accent1` to `accent6`: entry `i` is the scheme slot drawn as accent `i + 1`. Default: the scheme's own order. */
  accents?: readonly ColorAccentSlot[];
}

/** The slots the roles bg1, tx1, bg2 and tx2 and the six accents point at (OOXML `clrMap`, with `lt1` named `light1` and so on). */
export interface ColorMap {
  bg1: ColorVariantBackground;
  tx1: ColorVariantBackground;
  bg2: ColorVariantBackground;
  tx2: ColorVariantBackground;
  accents: readonly ColorAccentSlot[];
}

const MAPS: Record<ColorVariantBackground, Omit<ColorMap, 'accents'>> = {
  light1: { bg1: 'light1', tx1: 'dark1', bg2: 'light2', tx2: 'dark2' },
  light2: { bg1: 'light2', tx1: 'dark1', bg2: 'light2', tx2: 'dark2' },
  dark1: { bg1: 'dark1', tx1: 'light1', bg2: 'dark2', tx2: 'light2' },
  dark2: { bg1: 'dark2', tx1: 'light1', bg2: 'dark2', tx2: 'light2' },
};

/** A variant as authored: the background slot alone (`"dark1"`, the same as `{ "background": "dark1" }`), or the object form, which is needed only for an accent order. */
export type ColorVariantInput = ColorVariantBackground | ColorVariant;

/** The variant an authored value stands for, always the normalized object form, or undefined for a value that is not a variant: a background slot string, or an object with a background slot and, when given, a permutation of the six accent slots. */
export function normalizeColorVariant(value: unknown): ColorVariant | undefined {
  if (typeof value === 'string') return Object.hasOwn(MAPS, value) ? { background: value as ColorVariantBackground } : undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const { background, accents } = value as { background?: unknown; accents?: unknown };
  if (typeof background !== 'string' || !Object.hasOwn(MAPS, background)) return undefined;
  if (accents === undefined) return { background: background as ColorVariantBackground };
  return Array.isArray(accents) && accents.length === 6 && ACCENT_SLOTS.every(slot => accents.includes(slot))
    ? { background: background as ColorVariantBackground, accents: [...accents] as ColorAccentSlot[] }
    : undefined;
}

/** True for a well formed variant in either form (see {@link normalizeColorVariant}). */
export function isColorVariant(value: unknown): value is ColorVariantInput {
  return normalizeColorVariant(value) !== undefined;
}

/**
 * The map a variant stands for: `light1` is the default map (bg1 = light1, tx1 = dark1, bg2 = light2, tx2 = dark2); `dark1` swaps
 * light and dark; `light2` and `dark2` make that slot both the background and the alternate surface (bg2, as a slide with that theme
 * background has always had it, which keeps the default theme's dark2 background unchanged), with the text of the family's side. No variant is `light1`.
 */
export function colorMapFor(variant?: ColorVariantInput): ColorMap {
  const normalized = normalizeColorVariant(variant);
  const base = MAPS[normalized?.background ?? 'light1'];
  return { ...base, accents: normalized?.accents ? [...normalized.accents] : ACCENT_SLOTS };
}

const OOXML_SLOT: Record<string, string> = { light1: 'lt1', light2: 'lt2', dark1: 'dk1', dark2: 'dk2' };

/**
 * The attributes of PowerPoint's `<p:clrMap>` for a map (`bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" ...` and the two
 * hyperlink slots unchanged), so the PPTX export writes the master map and a slide's `clrMapOvr` from the same data the preview reads.
 */
export function clrMapAttributes(map: ColorMap): Record<string, string> {
  return {
    bg1: OOXML_SLOT[map.bg1]!, tx1: OOXML_SLOT[map.tx1]!, bg2: OOXML_SLOT[map.bg2]!, tx2: OOXML_SLOT[map.tx2]!,
    accent1: map.accents[0]!, accent2: map.accents[1]!, accent3: map.accents[2]!, accent4: map.accents[3]!, accent5: map.accents[4]!, accent6: map.accents[5]!,
    hlink: 'hlink', folHlink: 'folHlink',
  };
}

// HSL as DrawingML defines it, for the luminance transforms (`lumMod`, `lumOff`) that PowerPoint writes for tints and shades of a scheme colour.
function rgbToHsl([r, g, b]: readonly [number, number, number]): [number, number, number] {
  const red = r / 255, green = g / 255, blue = b / 255, max = Math.max(red, green, blue), min = Math.min(red, green, blue), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > .5 ? d / (2 - max - min) : d / (max + min);
  const h = max === red ? (green - blue) / d + (green < blue ? 6 : 0) : max === green ? (blue - red) / d + 2 : (red - green) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb([h, s, l]: readonly [number, number, number]): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const channel = (t: number) => { const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t; return 255 * (u < 1 / 6 ? p + (q - p) * 6 * u : u < .5 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p); };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

/**
 * A scheme colour as the PPTX export writes it and the preview draws it: `slot` is the colour role or slot (`tx1`, `bg1`, `bg2`, `tx2`,
 * `accent1` ...), `lumMod` and `lumOff` are DrawingML luminance transforms in thousandths of a percent (`lumMod 15000, lumOff 85000` is
 * 15% of the slot's luminance plus 85%), `alpha` an opacity in the same unit, and `hex` is the colour the transforms give for the
 * resolved scheme, so a preview that draws `hex` and a PPTX that writes `<a:schemeClr val={slot}>` with the transforms show the same colour.
 */
export interface SchemeColor {
  slot: string;
  hex: string;
  lumMod?: number;
  lumOff?: number;
  alpha?: number;
}

/** The colour a `lumMod`/`lumOff` pair (thousandths of a percent) makes of `hex`: its HSL luminance times `lumMod`, plus `lumOff`. */
export function applyLuminance(hex: string, lumMod = 100000, lumOff = 0): string {
  const channels = opaqueChannels(hex);
  if (!channels) return hex;
  const [h, s, l] = rgbToHsl(channels);
  return hexOfChannels(hslToRgb([h, s, Math.min(1, Math.max(0, l * lumMod / 100000 + lumOff / 100000))]));
}

/**
 * A scheme colour between a slot and its background: the slot's colour made as light (or dark) as `share` of the way from the
 * background's luminance to the slot's. `share` 0.15 is PowerPoint's gridline (tx1 at 15%: black on white is luminance 0.85). The
 * transform is chosen on the slot (`lumMod`/`lumOff`), so it keeps the slot's hue, and `hex` is the transform applied, to the thousandth of a percent.
 */
function mixTowardsBackground(slot: string, slotHex: string, backgroundHex: string, share: number): SchemeColor {
  const from = opaqueChannels(slotHex), to = opaqueChannels(backgroundHex);
  if (!from || !to) return { slot, hex: slotHex };
  const own = rgbToHsl(from)[2], target = rgbToHsl(to)[2] + share * (own - rgbToHsl(to)[2]);
  let lumMod = 100000, lumOff = 0;
  if (target >= own) { const k = own >= 1 ? 0 : (target - own) / (1 - own); lumMod = Math.round((1 - k) * 100000); lumOff = Math.round(k * 100000); }
  else lumMod = Math.round(target / own * 100000);
  return { slot, hex: applyLuminance(slotHex, lumMod, lumOff), ...(lumMod !== 100000 ? { lumMod } : {}), ...(lumOff !== 0 ? { lumOff } : {}) };
}

/** Shares of the text colour (tx1) mixed into the background (bg1) for the neutrals, PowerPoint's chart-style values. */
export const NEUTRAL_SHARES = { border: .2, gridline: .15, axisLine: .25, chartText: .65, codeComment: .65 } as const;

/**
 * The colours OPF draws that are neither text nor an accent, all derived from the scheme through the variant's map, so a dark variant
 * gets light lines and a change of variant or background style in PowerPoint recolours them.
 */
export interface SchemeNeutrals {
  /** Quiet structural rules, card borders and table borders: tx1 at {@link NEUTRAL_SHARES}.border over bg1. */
  border: SchemeColor;
  /** Chart gridlines: tx1 at 15%. */
  gridline: SchemeColor;
  /** Chart axis lines: tx1 at 25%. */
  axisLine: SchemeColor;
  /** Chart axis labels and legend text where the chart does not use the slide text colour: tx1 at 65%. */
  chartText: SchemeColor;
  /** Pie and treemap outlines, the video play icon and anything drawn on top of a mark: bg1. */
  outline: SchemeColor;
  /** The neutral metric trend (no good or bad news): tx2. */
  trendNeutral: SchemeColor;
  /** The code panel: tx1 (a dark panel) on a light variant, bg2 on a dark one, so a code block is a dark card on either. */
  codePanel: SchemeColor;
  /** Plain code text: bg1 or tx1, whichever reads better on the panel. */
  codeText: SchemeColor;
  /** Code comments and line numbers: the code text at 65% over the panel. */
  codeComment: SchemeColor;
}

export interface ResolvedColorRoles {
  /** Role override, else the first accent of the variant (accent1 by default). */
  primary: string;
  /** Role override, else the second accent of the variant (accent2 by default). */
  secondary: string;
  /** Role override, else the third accent of the variant (accent3 by default). */
  accent: string;
  /** The slide background: the resolved single-color background of the slide, else the variant's bg1 (light1 by default; see {@link defaultSlideBackground}). */
  background: string;
  /** Role override, else bg2 of the variant (light2 on a light slide, dark2 on a dark one). */
  surface: string;
  /** The alternate surface of banded table rows: {@link surfaceAltColor} of `surface` and `text`, always distinguishable from `surface`. */
  surfaceAlt: string;
  /** Default text: tx1 of the variant (light1 on a dark background). On a light background the `text` role override, else dark1. */
  text: string;
  /** Role override, else tx2 of the variant (light2 on a dark background and dark2 on a light one). */
  textSecondary: string;
  /** The color of a link run that sets no color of its own: the scheme's hyperlink slot (OOXML hlink), unless that has under 4.5:1 contrast against the slide background, then the slide `text` color. */
  hyperlink: string;
  /** Followed-hyperlink slot (OOXML folHlink). */
  followedHyperlink: string;
  /** Quiet structural rules/cards: `neutrals.border.hex`, tx1 mixed into bg1. Authored borders still resolve their own ColorRef. */
  border: string;
  /** Whether the slide background is dark; text, surface and textSecondary defaults follow it. */
  dark: boolean;
  /** The variant these roles were resolved with: the one given, else the one the background's luminance (or tone) implies. */
  variant: ColorVariant;
  /** The map behind the roles (bg1, tx1, bg2, tx2 and the accent order), for PPTX `clrMap` and `clrMapOvr` ({@link clrMapAttributes}). */
  map: ColorMap;
  /** The six accent colours in the variant's order (primary, secondary and accent are the first three unless overridden). */
  accents: string[];
  /** Every neutral derived from the scheme, with its slot and luminance transform for `schemeClr` export. */
  neutrals: SchemeNeutrals;
}

export interface ResolveColorRolesOptions {
  /** The slide's resolved single-color background (solid, theme-slot or pattern background color). Omit for a gradient, picture or no background. */
  background?: string | null;
  /** The slide's variant (RR-96), as authored (`"dark1"` or the object form). It sets the map; without it the background's luminance (or `tone`) chooses light1 or dark1. */
  variant?: ColorVariantInput;
  /** `dark` or `light` for a picture or gradient background that names its tone: it chooses dark1 or light1 when there is no `variant`. */
  tone?: 'dark' | 'light';
}

/**
 * Resolve a color scheme's abstract roles for one slide: the single definition the opf-render preview, the
 * PPTX export and the audit share, so the same deck draws the same colors in all three.
 *
 * RR-96: the roles come from the variant's map over the scheme's slots, as PowerPoint's roles do: background is bg1, text tx1,
 * textSecondary tx2, surface bg2, and primary, secondary and accent the first three accents in the variant's order. Without
 * `options.variant` the map is chosen from the slide: `options.tone` for a picture or gradient that names one, else the luminance of
 * `options.background` ({@link isDarkColor}; dark1 when dark, light1 otherwise), which is the earlier behavior. Role overrides on the
 * scheme (`primary`, `secondary`, `accent`, `background`, `surface`, `text`, `textSecondary`) win over the slots they default to; a
 * `text` override applies only on a light background, so a dark slide always gets readable light text. `roles.neutrals` holds every
 * line and quiet color derived from the same map, each with the slot and luminance transform the PPTX export writes.
 * Values are uppercase #RRGGBB, or #RRGGBBAA where the scheme color carries an alpha byte.
 */
export function resolveColorRoles(colorScheme: Record<string, unknown>, options: ResolveColorRolesOptions = {}): ResolvedColorRoles {
  const slot = (name: string, fallback: string) => slotKeepingAlpha(colorScheme, name, fallback);
  const FALLBACK: Record<string, string> = { light1: '#FFFFFF', light2: '#F8FAFC', dark1: '#111827', dark2: '#1E293B' };
  const explicit = normalizeColorVariant(options.variant);
  // The slide background decides light or dark when no variant does: a named tone, else the luminance of the resolved colour.
  const explicitBackground = keepAlpha(options.background);
  const dark = explicit ? explicit.background.startsWith('dark')
    : options.tone ? options.tone === 'dark'
    : isDarkColor(explicitBackground ?? defaultSlideBackground(colorScheme));
  const variant: ColorVariant = explicit ?? { background: dark ? 'dark1' : 'light1' };
  const map = colorMapFor(variant);
  const slotColor = (name: ColorVariantBackground) => slot(name, FALLBACK[name]!);
  // The default map keeps the scheme's `background` override as its bg1; any other map reads its slot.
  const bg1 = map.bg1 === 'light1' ? defaultSlideBackground(colorScheme) : slotColor(map.bg1);
  const background = explicitBackground ?? bg1;
  const tx1 = slotColor(map.tx1), bg2 = slotColor(map.bg2), tx2 = slotColor(map.tx2);
  const text = dark ? tx1 : (keepAlpha(colorScheme.text) ?? tx1);
  const surface = keepAlpha(colorScheme.surface) ?? bg2;
  const accents = map.accents.map(name => slot(name, '#000000'));
  const neutrals = schemeNeutrals({ bg1: explicitBackground ?? bg1, tx1, bg2, tx2, dark });
  return {
    primary: keepAlpha(colorScheme.primary) ?? accents[0]!,
    secondary: keepAlpha(colorScheme.secondary) ?? accents[1]!,
    accent: keepAlpha(colorScheme.accent) ?? accents[2]!,
    background,
    surface,
    surfaceAlt: surfaceAltColor(surface, text),
    border: neutrals.border.hex,
    text,
    textSecondary: keepAlpha(colorScheme.textSecondary) ?? tx2,
    hyperlink: readableLink(slot('hyperlink', DEFAULT_HYPERLINK), background, text),
    followedHyperlink: slot('followedHyperlink', DEFAULT_FOLLOWED_HYPERLINK),
    dark,
    variant,
    map,
    accents,
    neutrals,
  };
}

/** The neutrals of a resolved map: see {@link SchemeNeutrals}. The four colors are opaque #RRGGBB (or with alpha, as the scheme has them). */
function schemeNeutrals(colors: { bg1: string; tx1: string; bg2: string; tx2: string; dark: boolean }): SchemeNeutrals {
  const { bg1, tx1, bg2, tx2, dark } = colors;
  const opaque = (value: string) => normalizeHexColor(value) ?? value;
  const [back, front, second, secondText] = [opaque(bg1), opaque(tx1), opaque(bg2), opaque(tx2)];
  const share = (amount: number) => mixTowardsBackground('tx1', front, back, amount);
  // The code panel is a dark card: tx1 on a light variant, bg2 on a dark one (a dark card one step off the slide).
  const panel: SchemeColor = dark ? { slot: 'bg2', hex: second } : { slot: 'tx1', hex: front };
  const textOnPanel: SchemeColor = (colorContrast(back, panel.hex) ?? 0) >= (colorContrast(front, panel.hex) ?? 0) ? { slot: 'bg1', hex: back } : { slot: 'tx1', hex: front };
  const comment = mixTowardsBackground(textOnPanel.slot, textOnPanel.hex, panel.hex, NEUTRAL_SHARES.codeComment);
  return {
    border: share(NEUTRAL_SHARES.border),
    gridline: share(NEUTRAL_SHARES.gridline),
    axisLine: share(NEUTRAL_SHARES.axisLine),
    chartText: share(NEUTRAL_SHARES.chartText),
    outline: { slot: 'bg1', hex: back },
    trendNeutral: { slot: 'tx2', hex: secondText },
    codePanel: panel,
    codeText: textOnPanel,
    codeComment: comment,
  };
}

/**
 * The scheme color, bg1 or tx1 of the roles, that reads best on `fill`: for table header text, text on a mark and anything else that
 * sits on a color the scheme does not name. Returned as a {@link SchemeColor} (slot `bg1` or `tx1`) so the export can write a theme color.
 */
export function readableSchemeColor(fill: string, roles: Pick<ResolvedColorRoles, 'neutrals' | 'text' | 'background'>): SchemeColor {
  const light: SchemeColor = { slot: 'bg1', hex: normalizeHexColor(roles.background) ?? roles.background };
  const ink: SchemeColor = { slot: 'tx1', hex: normalizeHexColor(roles.text) ?? roles.text };
  return (colorContrast(light.hex, fill) ?? 0) >= (colorContrast(ink.hex, fill) ?? 0) ? light : ink;
}

/** Relative luminance contrast for opaque #RGB/#RRGGBB/#RRGGBBFF colors.
 * Unknown or translucent colors need a resolved backdrop and remain unmeasured.
 * https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
 */
function luminance(value: string): number | undefined {
  if (typeof value !== 'string') return undefined;
  let hex = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(hex)) hex = `#${[...hex.slice(1)].map(c => c + c).join('')}`;
  if (/^#[0-9a-f]{6}ff$/i.test(hex)) hex = hex.slice(0, 7);
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  return [.2126, .7152, .0722].reduce((sum, weight, index) => {
    const offset = index * 2 + 1;
    const n = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return sum + weight * (n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  }, 0);
}

export function colorContrast(foreground: string, background: string): number | undefined {
  const a = luminance(foreground), b = luminance(background);
  return a === undefined || b === undefined ? undefined : (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

/** Keep an inherited text color at >=4.5:1; otherwise select black or white.
 * Callers must preserve explicit text-color overrides before using this fallback.
 * An unresolved/translucent fill preserves the preferred color, without a contrast claim.
 */
export function textColorForFill(fill: string, preferred: string): string {
  const background = luminance(fill), contrast = colorContrast(preferred, fill);
  if (background === undefined || contrast === undefined || contrast >= 4.5) return preferred;
  return (background + .05) / .05 >= 1.05 / (background + .05) ? '#000000' : '#FFFFFF';
}

/** Keep an inherited chart mark at >=3:1 against its opaque panel. Otherwise
 * mix toward black or white in bounded 1/255 steps, choosing the first passing
 * step (higher contrast breaks a tie). This retains a recognizable palette;
 * it does not establish distinction between adjacent series or colorblind safety.
 * Explicit mark overrides belong to the caller; unresolved alpha is preserved.
 */
export function chartColorForFill(fill: string, preferred: string): string {
  const contrast = colorContrast(preferred, fill);
  if (contrast === undefined || contrast >= 3) return preferred;
  let hex = preferred.trim();
  if (hex.length === 4) hex = `#${[...hex.slice(1)].map(c => c + c).join('')}`;
  const channels = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16));
  for (let step = 1; step <= 255; step++) {
    const candidates = [0, 255].map(target => {
      const color = `#${channels.map(channel => Math.round(channel + (target - channel) * step / 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
      return {color, contrast: colorContrast(color, fill) ?? 0};
    }).sort((a, b) => b.contrast - a.contrast);
    const best = candidates[0];
    if (best && best.contrast >= 3) return best.color;
  }
  // Black or white always exceeds 3:1 for an opaque sRGB fill.
  return textColorForFill(fill, preferred);
}

// --------------------------------------------------------------- chart palettes

/** Smallest CIE L* step kept between neighbouring series (a printed or greyscale chart tells them apart by lightness alone). */
export const CHART_SERIES_MIN_LIGHTNESS_STEP = 11;
/** Smallest CIE76 colour difference kept between any two series that were at least that far apart before the surface adjustment. */
export const CHART_SERIES_MIN_DIFFERENCE = 12;

type Lab = [number, number, number];
const D65 = [0.95047, 1, 1.08883] as const;

function opaqueChannels(value: string): [number, number, number] | undefined {
  if (luminance(value) === undefined) return undefined;
  let hex = value.trim();
  if (hex.length === 4) hex = `#${[...hex.slice(1)].map(c => c + c).join('')}`;
  return [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}
const toLinear = (channel: number) => { const n = channel / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; };
const fromLinear = (value: number) => 255 * (value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055);

function labOf(channels: readonly number[]): Lab {
  const [r, g, b] = channels.map(toLinear) as [number, number, number];
  const f = (t: number) => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  const fx = f((.4124564 * r + .3575761 * g + .1804375 * b) / D65[0]), fy = f(.2126729 * r + .7151522 * g + .072175 * b), fz = f((.0193339 * r + .119192 * g + .9503041 * b) / D65[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Linear sRGB for a Lab colour, or undefined outside the sRGB gamut. */
function labToLinear([l, a, b]: Lab): [number, number, number] | undefined {
  const fy = (l + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inverse = (t: number) => t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27);
  const x = inverse(fx) * D65[0], y = l > 8 ? fy ** 3 : l / (24389 / 27), z = inverse(fz) * D65[2];
  const rgb: [number, number, number] = [
    3.2404542 * x - 1.5371385 * y - .4985314 * z,
    -.969266 * x + 1.8760108 * y + .041556 * z,
    .0556434 * x - .2040259 * y + 1.0572252 * z,
  ];
  return rgb.every(channel => channel >= -.0005 && channel <= 1.0005) ? rgb : undefined;
}

const hexOfChannels = (channels: readonly number[]) => `#${channels.map(channel => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** The colour of the given lightness that keeps the hue and as much of the chroma as fits in sRGB. */
function labWithLightness(l: number, a: number, b: number): string {
  const chroma = Math.hypot(a, b), hue = Math.atan2(b, a);
  const at = (scale: number): [number, number, number] | undefined => labToLinear([l, Math.cos(hue) * chroma * scale, Math.sin(hue) * chroma * scale]);
  let linear = at(1);
  if (!linear) {
    let low = 0, high = 1;
    for (let step = 0; step < 24; step++) { const mid = (low + high) / 2; if (at(mid)) low = mid; else high = mid; }
    linear = at(low) ?? [0, 0, 0];
  }
  return hexOfChannels(linear.map(channel => fromLinear(Math.max(0, Math.min(1, channel)))));
}

/** CIE76 difference of two opaque #RRGGBB colours (0 when either is not opaque). */
function labDifference(a: Lab, b: Lab): number { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

/** Series are placed in tiers of this many: a colour is kept apart from the colours of its own and earlier tiers only (see {@link chartPaletteForFill}). */
export const CHART_SERIES_TIER_SIZE = 6;
const tierOf = (index: number): number => Math.floor(index / CHART_SERIES_TIER_SIZE);

/** Cost, in CIE L* points of movement, of each point a placement falls short of the separation from a neighbouring series. */
const CHART_SERIES_SHORTFALL_WEIGHT = 8;

/** WI-5 (P18, D3): the contrast series 1 reaches on a dark chart surface when it comes from the scheme (see {@link ChartPaletteOptions.legibleLead}). */
export const CHART_LEAD_MIN_CONTRAST = 4.5;

export interface ChartPaletteOptions {
  /**
   * Lift series 1 to {@link CHART_LEAD_MIN_CONTRAST} (4.5:1) on a dark `fill` (WI-5, P18, decision D3). Pass it only when series 1 comes from the
   * deck scheme: {@link chartLeadFromScheme}. An authored `chart.colors[0]` and a host palette keep their colour.
   */
  legibleLead?: boolean;
}

/** Series colours for a chart drawn on `fill`: the palette in order, each colour adjusted for contrast
 * (`chartColorForFill`) without letting the adjustment merge series.
 *
 * Lifting or darkening a colour for a dark or mid-tone surface moves every failing colour towards the same
 * few lightness values, so two blues that differ on white can end up identical on a dark card. Colours that
 * already have >= 3:1 contrast against `fill` are kept exactly. A colour the contrast adjustment would move is
 * placed again on the lightness axis, keeping its hue and as much of its chroma as sRGB allows, subject to
 * >= 3:1 contrast against `fill` and these separations from the other series (each capped at the separation
 * that pair had in `palette`, so a pair the palette itself made close is not asked to be far apart):
 *
 * - a colour difference (CIE76) of at least {@link CHART_SERIES_MIN_DIFFERENCE} from every other series;
 * - a lightness step of at least {@link CHART_SERIES_MIN_LIGHTNESS_STEP} (CIE L*) from the neighbouring
 *   series, which is what keeps neighbours apart on a greyscale print;
 * - the same lightness step from the remaining series, as a weaker aim.
 *
 * Series are placed in order against the kept colours and the colours placed before them. The palette is read in tiers of
 * {@link CHART_SERIES_TIER_SIZE} (series 1 to 6, 7 to 12, ...): a colour is separated from the colours of its own and earlier tiers only,
 * so the later tiers (the tints of `chartSeriesPalette`) are placed around the first six without ever pulling them towards a lightness
 * the tints already hold. A palette of six colours or fewer is one tier. The placement
 * with the lowest cost wins: its distance (in L*) from the contrast-adjusted colour plus a penalty for
 * every point it falls short of those separations, so a colour that is already clear of the others is
 * simply the adjusted colour, a near miss is not worth a large change, and a collision is resolved at the
 * nearest lightness that clears it. The result is deterministic and in series order. An unresolved or
 * translucent fill or colour is passed through, like `chartColorForFill`.
 *
 * It depends only on the surface and the palette, so every chart on a surface gets the same series colours,
 * and preview and export (which both call this function) draw the same ones.
 */
export function chartPaletteForFill(fill: string, palette: readonly string[], options: ChartPaletteOptions = {}): string[] {
  const opaqueFill = colorContrast(fill, fill) !== undefined;
  if (options.legibleLead && opaqueFill && isDarkColor(fill) && palette.length > 0) {
    // WI-5 (P18, D3): series 1, drawn on a dark surface from the scheme, reaches 4.5:1 (the default blue on navy is 3.42:1). The other series are placed around it.
    const lead = normalizeHexColor(palette[0]);
    if (lead) palette = [legible(lead, normalizeHexColor(fill)!, CHART_LEAD_MIN_CONTRAST), ...palette.slice(1)];
  }
  const preferredLab = palette.map(color => { const channels = opaqueChannels(color); return channels ? labOf(channels) : undefined; });
  const adjusted = palette.map(color => chartColorForFill(fill, color));
  // Colours the surface keeps stay put; only the ones it moves are placed again.
  const kept = palette.map((color, index) => opaqueFill && preferredLab[index] !== undefined && adjusted[index] === color);
  const placed: (string | undefined)[] = palette.map((_, index) => kept[index] || !opaqueFill || !preferredLab[index] ? adjusted[index] : undefined);
  const placedLab: (Lab | undefined)[] = placed.map(color => { const channels = color === undefined ? undefined : opaqueChannels(color); return channels ? labOf(channels) : undefined; });
  palette.forEach((_, index) => {
    const wanted = preferredLab[index], base = adjusted[index]!;
    if (placed[index] !== undefined || !wanted) return;
    const baseLab = labOf(opaqueChannels(base)!);
    // The separation every placed series must keep from this one: what the palette itself had, capped at the floor.
    const needs = palette.flatMap((_, other) => {
      const before = preferredLab[other], lab = placedLab[other];
      return other !== index && tierOf(other) <= tierOf(index) && before && lab && placed[other] !== undefined
        ? [{ lab, adjacent: Math.abs(other - index) === 1, wide: Math.min(labDifference(before, wanted), CHART_SERIES_MIN_DIFFERENCE), step: Math.min(Math.abs(before[0] - wanted[0]), CHART_SERIES_MIN_LIGHTNESS_STEP) }]
        : [];
    });
    // How far a candidate is from the required separations (>= 0 when it meets them): the colour difference from every
    // series and the lightness step from the neighbours first, then the lightness step from the others.
    const shortfall = (candidate: Lab): { near: number; far: number } => needs.reduce((worst, need) => {
      const lightness = Math.abs(need.lab[0] - candidate[0]) - need.step, difference = labDifference(need.lab, candidate) - need.wide;
      return need.adjacent ? { near: Math.min(worst.near, difference, lightness), far: worst.far } : { near: Math.min(worst.near, difference), far: Math.min(worst.far, lightness) };
    }, { near: Infinity, far: Infinity });
    // Cost of a placement: how far it moves from the adjusted colour, plus a penalty for every point it falls short
    // of the required separations (neighbours and colour difference count most). Cheapest wins; ties keep the nearer one.
    const deficit = (value: number) => Math.max(0, -value - 1e-9);
    const cost = (candidate: { moved: number; near: number; far: number }) => candidate.moved + CHART_SERIES_SHORTFALL_WEIGHT * deficit(candidate.near) + deficit(candidate.far);
    const start = shortfall(baseLab);
    if (deficit(start.near) === 0 && deficit(start.far) === 0) { placed[index] = base; placedLab[index] = baseLab; return; }
    // Re-place the colour on the lightness axis, around where the surface adjustment left it.
    let best: { color: string; lab: Lab; cost: number; moved: number } | undefined = { color: base, lab: baseLab, cost: cost({ moved: 0, ...start }), moved: 0 };
    for (let step = 0; step <= 400; step++) {
      const color = labWithLightness(step / 4, wanted[1], wanted[2]), contrast = colorContrast(color, fill);
      if (contrast === undefined || contrast < 3) continue;
      const lab = labOf(opaqueChannels(color)!), moved = Math.abs(lab[0] - baseLab[0]), total = cost({ moved, ...shortfall(lab) });
      if (total < best.cost - 1e-9 || (Math.abs(total - best.cost) <= 1e-9 && moved < best.moved)) best = { color, lab, cost: total, moved };
    }
    placed[index] = best.color;
    placedLab[index] = best.lab;
  });
  return placed as string[];
}

// --------------------------------------------------------------- chart series palette (RR-89)

/** Share of white mixed into each accent to make the extended tints of {@link chartSeriesPalette} (series 7 to 12). */
export const CHART_SERIES_TINT_MIX = 0.4;

/**
 * The series colours of a chart before the per-surface adjustment: twelve opaque #RRGGBB colours in series order, taken from the deck's
 * resolved colour scheme (`design.colorScheme` after the theme, the record and any inline overrides are applied).
 *
 * - 1 to 6: `accent1` to `accent6`. A slot the scheme leaves out takes the engine default scheme's slot.
 * - 7 to 12: the same six accents mixed {@link CHART_SERIES_TINT_MIX} of the way towards white, in the same order (a tint of `accent1`
 *   is series 7), for charts with more than six series.
 *
 * Pass the result to {@link chartPaletteForFill} with the chart panel colour for the colours a chart draws and writes: contrast against
 * the panel without letting two series merge. Series `i` takes colour `i`; a pie, doughnut, treemap or funnel takes colour `i` for
 * category `i`. The colours depend on the scheme only, so the preview, the PPTX export and the colour-blind rule draw the same ones.
 * The role overrides (`primary`, `secondary`, `accent`) do not change the list: series 1 to 3 are always `accent1` to `accent3`, the
 * theme slots the PPTX export writes as `schemeClr accentN`.
 *
 * RR-89: `colors` is the chart's own `chart.colors` (positional ColorRefs). Entry `i` replaces palette colour `i`; an entry that cannot
 * be resolved ({@link resolveChartColors}) keeps the scheme colour, and entries past the twelfth extend the list. `context` carries the
 * deck's roles and `variables` for entries that name them.
 */
export function chartSeriesPalette(colorScheme: Record<string, unknown> = {}, colors?: unknown, context: ChartColorContext = {}): string[] {
  const order = context.accents && context.accents.length === 6 && ACCENT_SLOTS.every(slot => context.accents!.includes(slot)) ? context.accents : ACCENT_SLOTS;
  const accents = order.map(slot => {
    return normalizeHexColor(colorScheme?.[slot]) ?? normalizeHexColor(ENGINE_DEFAULT_COLOR_SCHEME[slot]) ?? '#000000';
  });
  const palette = [...accents, ...accents.map(accent => mixChannels(opaqueChannels(accent)!, [255, 255, 255], CHART_SERIES_TINT_MIX))];
  resolveChartColors(colors, colorScheme, context).forEach((color, index) => {
    if (color === undefined) return;
    // An entry past the twelve palette colours extends the list; a gap before it keeps the scheme colour of its position.
    while (palette.length < index) palette.push(palette[palette.length % 12]!);
    palette[index] = color;
  });
  return palette;
}

/**
 * Whether series 1 of a chart comes from the deck scheme (accent1 of the variant) rather than from an authored `chart.colors[0]`:
 * the series {@link chartPaletteForFill} may lift with `legibleLead`. Pass the chart's own `colors` and the same scheme and context as {@link chartSeriesPalette}.
 */
export function chartLeadFromScheme(colors: unknown, colorScheme: Record<string, unknown> = {}, context: ChartColorContext = {}): boolean {
  return resolveChartColors(colors, colorScheme, context)[0] === undefined;
}

/** What a `chart.colors` entry resolves against: the deck's role colours and `variables`, as for any ColorRef. */
export interface ChartColorContext {
  /** RR-96: the variant's accent order (`roles.map.accents`): series 1 to 6 take these slots in this order. Default: accent1 to accent6. */
  accents?: readonly ColorAccentSlot[];
  roles?: ResolveColorRefRoles;
  variables?: Record<string, unknown>;
}

/**
 * The opaque #RRGGBB colour of each `chart.colors` entry (a hex colour, a colour-scheme slot or role, or a `var:<id>` variable), in
 * order; undefined for an entry that is not a string or cannot be resolved (an unknown variable, a name that is not a colour). Alpha is
 * dropped. `colors` that is not an array resolves to an empty list.
 */
export function resolveChartColors(colors: unknown, colorScheme: Record<string, unknown> = {}, context: ChartColorContext = {}): (string | undefined)[] {
  if (!Array.isArray(colors)) return [];
  return colors.map(entry => {
    if (typeof entry !== 'string') return undefined;
    const resolved = resolveColorRef(entry.trim(), { colorScheme, roles: context.roles, variables: context.variables, fallback: '' });
    return normalizeHexColor(resolved);
  });
}

// --------------------------------------------------------------- chart highlight (FA-14)

/** Share of the text colour mixed into the surface to make the muted colour of a highlighted chart. */
export const CHART_HIGHLIGHT_MUTED_MIX = 0.3;
/** Smallest contrast the muted colour keeps against the surface: recessive, but still a visible mark. */
export const CHART_HIGHLIGHT_MUTED_MIN_CONTRAST = 1.6;

const mixChannels = (from: readonly number[], to: readonly number[], amount: number): string =>
  hexOfChannels(from.map((channel, index) => channel + (to[index]! - channel) * amount));

/**
 * The two colours of a chart that highlights marks (`chart.highlight`), derived from the theme only: `accent` for the highlighted
 * marks, `muted` for every other mark.
 *
 * - `accent` is the deck's primary colour, kept at >= 3:1 against the surface by `chartColorForFill` (a primary that already has
 *   that contrast is returned unchanged).
 * - `muted` is the surface mixed {@link CHART_HIGHLIGHT_MUTED_MIX} of the way towards the text colour: a light grey on a light surface
 *   and a dim grey on a dark one, in the surface's own hue. When that falls below {@link CHART_HIGHLIGHT_MUTED_MIN_CONTRAST} against
 *   the surface (a surface and text that are close together) the mix moves towards the text colour until it holds.
 *
 * Pure arithmetic on opaque colours: the preview and the PPTX export both call it with the chart panel, the primary and the label
 * colour, so they draw and write the same two colours. An unresolved colour is replaced by white (surface), the surface's own
 * best contrast partner (text) or black (primary).
 */
export function chartHighlightColors(surface: string, primary: string, text: string): { accent: string; muted: string } {
  const fill = normalizeHexColor(surface) ?? '#FFFFFF';
  const accent = chartColorForFill(fill, normalizeHexColor(primary) ?? '#000000');
  const ink = normalizeHexColor(text) ?? textColorForFill(fill, '#000000');
  const from = opaqueChannels(fill)!, to = opaqueChannels(ink)!;
  let muted = mixChannels(from, to, CHART_HIGHLIGHT_MUTED_MIX);
  for (let amount = CHART_HIGHLIGHT_MUTED_MIX; (colorContrast(muted, fill) ?? Infinity) < CHART_HIGHLIGHT_MUTED_MIN_CONTRAST && amount < 1; ) {
    amount = Math.min(1, amount + 0.02);
    muted = mixChannels(from, to, amount);
  }
  return { accent, muted };
}

// --------------------------------------------------------------- alternate surface (banded table rows)

/** Share of the text colour mixed into the surface for the `surfaceAlt` role. */
export const SURFACE_ALT_MIX = 0.1;
/** Smallest contrast `surfaceAlt` keeps against `surface`, so a band is visible next to a plain row. */
export const SURFACE_ALT_MIN_CONTRAST = 1.1;

/**
 * The `surfaceAlt` colour role: the fill of the banded rows of a table whose other body rows take `surface`. It is the surface
 * mixed {@link SURFACE_ALT_MIX} of the way towards the text colour (a slightly darker band on a light table, a slightly lighter one
 * on a dark table), moved further until it differs from the surface by {@link SURFACE_ALT_MIN_CONTRAST}, while the text keeps
 * 4.5:1 on it. When mixing towards the text cannot keep both (a surface and text that are close together), the band moves the
 * other way, away from the text, which only raises the text contrast. Pure arithmetic on opaque colours, so the preview and
 * the PPTX export, which both resolve the `surfaceAlt` ColorRef from their own `surface` and `text` roles, draw and write the
 * same colour. An unresolved surface is white; an unresolved text colour is the surface's best contrast partner.
 */
export function surfaceAltColor(surface: string, text: string): string {
  const fill = normalizeHexColor(surface) ?? '#FFFFFF';
  const ink = normalizeHexColor(text) ?? textColorForFill(fill, '#000000');
  const from = opaqueChannels(fill)!, toText = opaqueChannels(ink)!;
  const step = (color: string) => (colorContrast(color, fill) ?? 1) >= SURFACE_ALT_MIN_CONTRAST;
  const readable = (color: string) => (colorContrast(ink, color) ?? 0) >= 4.5 || (colorContrast(ink, color) ?? 0) >= (colorContrast(ink, fill) ?? 0);
  for (let amount = SURFACE_ALT_MIX; amount <= 0.5 + 1e-9; amount += 0.02) {
    const band = mixChannels(from, toText, amount);
    if (!readable(band)) break;
    if (step(band)) return band;
  }
  // Away from the text: towards black under light text, towards white under dark text.
  const away = (luminance(ink) ?? 0) > (luminance(fill) ?? 0) ? [0, 0, 0] : [255, 255, 255];
  for (let amount = SURFACE_ALT_MIX; amount <= 1 + 1e-9; amount += 0.02) {
    const band = mixChannels(from, away, Math.min(1, amount));
    if (step(band)) return band;
  }
  return mixChannels(from, toText, SURFACE_ALT_MIX);
}
