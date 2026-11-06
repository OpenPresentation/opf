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
  /** The layout record slide `index` names, when it resolves. */
  layoutOf: (slide: Rec) => Rec | undefined;
}

/**
 * LH-164: the accent surface a slide whose whole body is one display message takes (messageKind), or undefined. Decided from the content
 * and the records, before composition, so the preview, the PPTX export and the validator all draw the roles it gives:
 *
 * - the slide's own design sets neither a variant nor a background, and the deck and the theme draw no fixed background (a hex or `var:`
 *   color, a gradient, a pattern, a picture; LH-103), the conditions under which a layout's variant applies, and none the author chose (a
 *   solid `accent2` or `primary`; the neutral theme slots, which are the deck's plain surface, do not count: deckBackgroundIsChosen);
 * - the layout names no variant of its own, or only the tone-relative `surface` (the statement and the quote): a `section`, a `closing` and
 *   a layout the author or the catalog gave an explicit variant keep it;
 * - the theme has the accent: its `accent1` variant (the deck's accent order kept) carries the slide's text at 4.5:1, and it is not the
 *   surface the deck already draws;
 * - never two accent surfaces on consecutive slides: the slide before is not drawn on one (a message surface, the accent a layout such as
 *   `section` names, or an accent the slide's own variant sets), so the second keeps the plain surface; a run of message slides alternates.
 */
export function resolveMessageSurface(presentation: unknown, index: number, slide: Rec, layout: Rec | undefined, context: MessageSurfaceContext): MessageSurface | undefined {
  const deck = rec(presentation), deckDesign = rec(deck.design), slides: unknown[] = Array.isArray(deck.slides) ? deck.slides : [];
  const eligible = (host: Rec, record: Rec | undefined): MessageSurface['kind'] | undefined => {
    const kind = messageKind(host, record), named = layoutVariantKind(record);
    return kind !== undefined && (named === undefined || named === 'surface') && !deckBackgroundIsChosen(deckDesign, context.theme.background) && layoutVariantApplies(host.design, record, deckDesign, context.theme.background, true) ? kind : undefined;
  };
  const kind = eligible(slide, layout);
  if (kind === undefined) return undefined;
  const below = colorChoice([deckDesign, context.theme], context.colorScheme, context.variables);
  const variant: ColorVariant = { background: MESSAGE_SURFACE_SLOT, ...(below.variant?.accents ? { accents: below.variant.accents } : {}) };
  const plain = resolveColorRoles(context.colorScheme, { background: below.background, variant: below.variant });
  const accent = resolveColorRoles(context.colorScheme, { variant });
  if (accent.background.toUpperCase() === plain.background.toUpperCase() || (colorContrast(accent.text, accent.background) ?? 0) < MESSAGE_SURFACE_CONTRAST) return undefined;
  // The accent a slide is drawn on: a message surface (this rule, from the first slide of the unbroken run forward) or the accent its layout names.
  const accented = (host: Rec, record: Rec | undefined): boolean => {
    const own = normalizeColorVariant(rec(host.design).variant), named = layoutColorVariant(record);
    if (own) return own.background.startsWith('accent');
    return named !== undefined && layoutVariantApplies(host.design, record, deckDesign, context.theme.background) && named.background.startsWith('accent');
  };
  let start = index;
  while (start > 0) {
    const before = rec(slides[start - 1]), record = context.layoutOf(before);
    if (!accented(before, record) && eligible(before, record) === undefined) break;
    start--;
  }
  let previous = false;
  for (let at = start; at < index; at++) {
    const before = rec(slides[at]), record = context.layoutOf(before);
    previous = accented(before, record) || (!previous && eligible(before, record) !== undefined);
  }
  return previous ? undefined : { kind, variant };
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
