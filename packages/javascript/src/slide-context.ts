import { catalogs, type CatalogKind } from './catalogs.js';
import {
  DEFAULT_FONT_SCHEME,
  resolveCanvasDimensions,
  resolveFontFamilies,
  resolveFontSchemeReference,
  type ComposeSlideOptions,
  type FontSchemeDiagnostic,
  type Fonts,
} from './composition.js';

/**
 * One slide's composition context: the layout, canvas, theme and font families that `composeSlide` needs,
 * resolved the one way every engine must resolve them (slide design, then deck design, then theme, then the
 * engine default, per field). Core pagination, the layout checks, the renderer, the exporter and the editor
 * each used to rebuild this chain by hand. Catalogs load here, so this lives at the package root, not in the
 * catalog-free `/composition` entry.
 */

// biome-ignore lint/suspicious/noExplicitAny: authored JSON is walked untyped; every read is guarded.
type Rec = Record<string, any>;
const rec = (value: unknown): Rec => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {});

/** Reported when a reference resolves to nothing, so the slide still composes with documented fallbacks. */
export interface SlideContextReferenceDiagnostic {
  code: 'unresolved-layout' | 'unresolved-theme';
  /** Where the unresolved id is written: `slides.N.layout`, `slides.N.design.theme` or `design.theme`. */
  path: string;
  /** The id that matched no inline or bundled record. */
  id: string;
  message: string;
}
/** `unresolved-font-scheme` falls back to the DEFAULT_FONT_SCHEME record; an unresolved layout or theme leaves its record empty. */
export type SlideContextDiagnostic = FontSchemeDiagnostic | SlideContextReferenceDiagnostic;

export interface SlideContextOptions {
  /** The fonts handle; core reads its `textMeasurement`. Without it composition uses core's portable estimate. */
  fonts?: Fonts;
  /** Host catalog records, consulted after the deck's inline `catalogs` and before the bundled ones. */
  catalogs?: Partial<Record<CatalogKind, readonly unknown[]>>;
  /** One-based displayed slide number. Default: index + 1. */
  slideNumber?: number;
  /** Displayed slide count for `{total}`. Default: the deck's slide count. */
  slideCount?: number;
  /** Host-supplied current calendar date (ISO YYYY-MM-DD) for `date: true` header/footer fields. */
  date?: string;
}

export interface SlideContext {
  /** Ready for `composeSlide(slide, options)`. */
  options: ComposeSlideOptions;
  diagnostics: SlideContextDiagnostic[];
  /** The records `options` was resolved from, for hosts that also need the theme's or colour scheme's own fields. */
  resolved: {
    theme: Rec;
    colorScheme: Rec;
    fontScheme: Rec;
    /** Where the font scheme reference is written, dotted like `FontSchemeDiagnostic.path`. */
    fontSchemePath: string;
  };
}

/**
 * Resolve slide `index` of `presentation` into the options `composeSlide` takes. Never throws for an unresolved
 * reference: the fallback applies and `diagnostics` says what was missed (`unresolved-font-scheme`,
 * `unresolved-layout`, `unresolved-theme`). Throws a RangeError for an index outside the deck or non-positive
 * canvas dimensions, which a schema-valid deck cannot have.
 */
export function resolveSlideContext(presentation: unknown, index: number, options: SlideContextOptions = {}): SlideContext {
  const deck = rec(presentation);
  const slides = Array.isArray(deck.slides) ? deck.slides : [];
  if (!Number.isInteger(index) || index < 0 || index >= slides.length) throw new RangeError(`Slide index ${String(index)} is outside the presentation's ${slides.length} slides.`);
  const slide = rec(slides[index]);
  const diagnostics: SlideContextDiagnostic[] = [];
  const lookup = (kind: CatalogKind, id: string): Rec | undefined => {
    const inline = rec(rec(deck.catalogs)[kind]).records;
    const found =
      (Array.isArray(inline) ? inline : []).find((record: Rec) => record?.id === id) ??
      (options.catalogs?.[kind] ?? []).find((record) => rec(record).id === id) ??
      (catalogs[kind] as readonly unknown[]).find((record) => rec(record).id === id);
    return found === undefined ? undefined : rec(found);
  };
  const design = { ...rec(deck.design), ...rec(slide.design) };
  const own = rec(slide.design), shared = rec(deck.design);

  // A string id resolves through the catalogs. An object is an inline record on top of its `id` record. A reference
  // that names an id but carries no fields of its own and matches no record is unresolved.
  const resolveReference = (kind: CatalogKind, reference: unknown, path: string, code?: 'unresolved-theme'): Rec => {
    const id = typeof reference === 'string' ? reference : typeof rec(reference).id === 'string' ? (rec(reference).id as string) : undefined;
    const found = id === undefined ? undefined : lookup(kind, id);
    const inline = typeof reference === 'object' && reference !== null && !Array.isArray(reference) && Object.keys(reference).some((key) => key !== 'id');
    if (code && id !== undefined && found === undefined && !inline) diagnostics.push({ code, path, id, message: `Theme '${id}' is not in the inline or bundled catalogs.` });
    return { ...found, ...(typeof reference === 'object' && reference !== null && !Array.isArray(reference) ? rec(reference) : {}) };
  };

  const themePath = own.theme !== undefined ? `slides.${index}.design.theme` : 'design.theme';
  const theme = resolveReference('themes', design.theme ?? 'minimal', themePath, 'unresolved-theme');
  const colorScheme = resolveReference('colorSchemes', design.colorScheme ?? theme.colorScheme ?? 'cool-horizon', 'design.colorScheme');

  const fontSchemePath =
    own.fontScheme !== undefined ? `slides.${index}.design.fontScheme` : shared.fontScheme !== undefined ? 'design.fontScheme' : themePath;
  const font = resolveFontSchemeReference(design.fontScheme ?? theme.fontScheme ?? DEFAULT_FONT_SCHEME, (id) => lookup('fontSchemes', id), fontSchemePath);
  if (font.diagnostic) diagnostics.push(font.diagnostic);

  let layout: Rec | undefined;
  if (typeof slide.layout === 'string') {
    layout = lookup('layouts', slide.layout);
    if (!layout) diagnostics.push({ code: 'unresolved-layout', path: `slides.${index}.layout`, id: slide.layout, message: `Layout '${slide.layout}' is not in the inline or bundled catalogs.` });
  }

  const composeOptions: ComposeSlideOptions = {
    ...resolveCanvasDimensions(design.dimensions ?? theme.dimensions),
    ...(layout ? { layout } : {}),
    presentation: presentation as ComposeSlideOptions['presentation'],
    slideIndex: index,
    slideNumber: options.slideNumber ?? index + 1,
    slideCount: options.slideCount ?? slides.length,
    fontFamilies: resolveFontFamilies(font.scheme),
    contentAlignment: design.contentAlignment,
    titleAlignment: design.titleAlignment,
    contentBox: design.contentBox,
    socialPlatforms: catalogs.socialPlatforms as ComposeSlideOptions['socialPlatforms'],
    ...(options.fonts?.textMeasurement ? { textMeasurement: options.fonts.textMeasurement } : {}),
    ...(options.date !== undefined ? { date: options.date } : {}),
  };
  return { options: composeOptions, diagnostics, resolved: { theme, colorScheme, fontScheme: font.scheme, fontSchemePath } };
}
