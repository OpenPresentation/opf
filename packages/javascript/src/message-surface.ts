import { colorContrast, deckBackgroundIsChosen, layoutColorVariant, layoutVariantApplies, layoutVariantKind, normalizeColorVariant, resolveColorRoles, type ColorVariant } from './color.js';
import { LONE_DISPLAY_SIZES, SHORT_MESSAGE_WORDS, lonePayload, messageWords, statementMessage, type MessageSurface, type SlideComposition } from './composition.js';
import { isLayoutTemplate, layoutTemplate } from './layout-template.js';
import { annotationText } from './annotations.js';
import { colorChoice } from './rule-design.js';

// biome-ignore lint/suspicious/noExplicitAny: authored JSON is walked untyped; every read is guarded.
type Rec = Record<string, any>;
const rec = (value: unknown): Rec => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {});

/** LH-164: the scheme slot a message-only slide is drawn on, the one the gallery's `section` layout names (its accent surface). */
export const MESSAGE_SURFACE_SLOT = 'accent1';
/** LH-164: the contrast the slide's text needs on the accent surface; the surface is not taken where the theme's accent cannot carry it. */
export const MESSAGE_SURFACE_CONTRAST = 4.5;

/**
 * LH-164: which of LH-09's rules makes a slide's whole body one display message, from its content alone (the same words LH-09 grows):
 * a statement record's message (`statement-message`: a text under a sentence title or a short label title; a metric stays on the plain
 * surface, as Claude Design draws n28), or a lone text of at most SHORT_MESSAGE_WORDS words (`display-message`) that carries no
 * citation or footnote and has no subtitle, in a layout with no picture area. Any number of words, any script, any direction.
 */
export function messageKind(slide: Rec, layout: unknown): MessageSurface['kind'] | undefined {
  const lone = lonePayload(slide);
  if (lone?.field !== 'text' || annotationText(slide.subtitle).trim()) return undefined;
  let plan: ReturnType<typeof layoutTemplate> | undefined;
  // A layout record that is not a valid template fails where it is composed; here the slide is simply not a message.
  try { plan = isLayoutTemplate(layout) ? layoutTemplate(layout) : undefined; } catch { return undefined; }
  if (plan?.stack !== undefined && statementMessage(slide, plan) !== undefined) return 'statement-message';
  // A layout that asks for several body regions (columns, a comparison), a grid (pillars) or a picture area asks for more than one message.
  if (plan && (plan.regions.length > 1 || plan.regions.some(region => region.role === 'media' || region.flow === 'grid'))) return undefined;
  const value = lone.host.text;
  const cited = Array.isArray(value) && value.some(run => run && typeof run === 'object' && ((run as { cite?: unknown }).cite !== undefined || (run as { footnote?: unknown }).footnote !== undefined));
  return !cited && messageWords(value) > 0 && messageWords(value) <= SHORT_MESSAGE_WORDS ? 'display-message' : undefined;
}

/** What `resolveMessageSurface` reads of the records the slide context resolved. */
export interface MessageSurfaceContext {
  theme: Rec;
  colorScheme: Rec;
  variables: Rec;
  /** Whether the deck names a theme record (the engine default theme is no choice of the deck's). */
  themeChosen: boolean;
}

/** LH-164: the CIELCh lightness and chroma of an sRGB hex color (D65), which the surface is judged on. */
export function lchOf(hex: string): { L: number; C: number } {
  const lin = (at: number) => { const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [lin(1), lin(3), lin(5)] as [number, number, number];
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)] as [number, number, number];
  return { L: 116 * fy - 16, C: Math.hypot(500 * (fx - fy), 200 * (fy - fz)) };
}
/**
 * LH-164: an accent fills a whole slide calmly when it is neither too bright nor too saturated: CIELCh lightness at most this (a yellow, an
 * orange, a pastel and a mid gray are over it) and chroma at most the next (a red-orange or a pure blue are over it). Tuned on the default
 * catalog: Claude Design's blue (#2874A6, L* 46.6, C* 33.8) and the deep purple (L* 38.3, C* 75.3) qualify; boost (C* 92.8), corporate-blue
 * (C* 94.3), vibes (C* 111.6), burnt-orange (L* 61.1, C* 80.2) and golden-yellow (L* 61.0) do not. The brand color is never changed: a loud
 * accent keeps the plain surface.
 */
export const MESSAGE_SURFACE_MAX_LIGHTNESS = 60, MESSAGE_SURFACE_MAX_CHROMA = 80;

/**
 * LH-164: the accent surface a slide whose whole body is one display message could take (messageKind), or undefined. Decided from the
 * content and the records, before composition, so the preview, the PPTX export and the validator all draw the roles it gives:
 *
 * - the slide's own design sets neither a variant nor a background, and the deck and the theme draw no fixed background (a hex or `var:`
 *   color, a gradient, a pattern, a picture; LH-103), the conditions under which a layout's variant applies, and none the author chose (a
 *   solid `accent2` or `primary`; the neutral theme slots, which are the deck's plain surface, do not count: deckBackgroundIsChosen);
 * - the deck is not a deliberately dark one: a deck or a theme record that sets a dark background or variant already gives its messages
 *   their emphasis (the engine default theme is no choice of the deck's);
 * - the layout names no variant of its own, or only the tone-relative `surface` (the statement and the quote): a `section`, a `closing` and
 *   a layout the author or the catalog gave an explicit variant keep it;
 * - the theme has the accent: its `accent1` variant (the deck's accent order kept) carries the slide's text at 4.5:1, differs from the
 *   surface the deck already draws and is calm enough to fill a slide (lchOf, MESSAGE_SURFACE_MAX_LIGHTNESS, MESSAGE_SURFACE_MAX_CHROMA).
 *
 * What the slide context adds: composition must draw the message at display size (messageDisplayed), and no accent surface comes right
 * before it (`previousDrawsAccent`: a message surface the slide before took, the accent a layout such as `section` names, or an accent the
 * slide's own variant sets), so a run of message slides alternates.
 */
export function resolveMessageSurface(presentation: unknown, slide: Rec, layout: Rec | undefined, context: MessageSurfaceContext): MessageSurface | undefined {
  const deckDesign = rec(rec(presentation).design);
  const kind = messageKind(slide, layout), named = layoutVariantKind(layout);
  if (kind === undefined || !(named === undefined || named === 'surface') || deckBackgroundIsChosen(deckDesign, context.theme.background)
    || !layoutVariantApplies(slide.design, layout, deckDesign, context.theme.background, true)) return undefined;
  const below = colorChoice([deckDesign, context.theme], context.colorScheme, context.variables);
  const variant: ColorVariant = { background: MESSAGE_SURFACE_SLOT, ...(below.variant?.accents ? { accents: below.variant.accents } : {}) };
  const plain = resolveColorRoles(context.colorScheme, { background: below.background, variant: below.variant });
  const deliberate = [deckDesign, ...(context.themeChosen ? [context.theme] : [])].some(level => level.background !== undefined || level.variant !== undefined);
  if (plain.dark && deliberate) return undefined;
  const accent = resolveColorRoles(context.colorScheme, { variant }), shade = lchOf(accent.background.slice(0, 7).toUpperCase());
  if (accent.background.toUpperCase() === plain.background.toUpperCase() || (colorContrast(accent.text, accent.background) ?? 0) < MESSAGE_SURFACE_CONTRAST
    || shade.L > MESSAGE_SURFACE_MAX_LIGHTNESS || shade.C > MESSAGE_SURFACE_MAX_CHROMA) return undefined;
  return { kind, variant };
}

/** LH-164: whether a slide is drawn on an accent by its design: the accent its own variant sets, or the accent its layout's variant gives. */
export function drawsAccentByDesign(presentation: unknown, host: Rec, record: Rec | undefined, theme: Rec): boolean {
  const deckDesign = rec(rec(presentation).design), own = normalizeColorVariant(rec(host.design).variant), named = layoutColorVariant(record);
  if (own) return own.background.startsWith('accent');
  return named !== undefined && layoutVariantApplies(host.design, record, deckDesign, theme.background) && named.background.startsWith('accent');
}

/**
 * LH-164: whether composition drew the slide's message at display size, as LH-09 sets it: a text above the lone-text display size
 * (LONE_DISPLAY_SIZES.text), or, for a statement, a text grown to it or a title above the 54 px title role. A deck whose texts sit on
 * cards keeps its body text, and a slide that is not drawn as a message keeps the plain surface.
 */
export function messageDisplayed(result: SlideComposition, kind: MessageSurface['kind']): boolean {
  const scale = Math.min(result.width, result.height) / 720, size = (field: string) => result.items.find(item => item.field === field)?.text?.fontSize;
  const text = size('text'), title = size('title');
  // A statement's message under a label is a lone block grown to the lone display size, however long; a display message is grown past it.
  if (kind === 'statement-message') return (text !== undefined && text / scale >= LONE_DISPLAY_SIZES.text - 1e-6) || (title !== undefined && title / scale > 54 + 1e-6);
  return text !== undefined && text / scale > LONE_DISPLAY_SIZES.text + 1e-6;
}
