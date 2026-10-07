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
import { resolveColorRoles } from './color.js';
import { decisionColor } from './rule-design.js';

/**
 * One slide's composition context: the layout, canvas, theme and font families that `composeSlide` needs,
 * resolved the one way every engine must resolve them (slide design, then deck design, then theme, then the
 * engine default, per field). Core pagination, the layout checks, the renderer, the exporter and the editor
 * each used to rebuild this chain by hand. Catalogs load here, so this lives at the package root, not in the
 * catalog-free `/composition` entry.
 */

// biome-ignore lint/suspicious/noExplicitAny: authored JSON is walked untyped; every read is guarded.
type Rec = Record<string, any>;
const DEFAULT_THEME = 'minimal';
const DEFAULT_COLOR_SCHEME = 'cool-horizon';
const rec = (value: unknown): Rec => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {});

/** Reported when a reference resolves to nothing, so the slide still composes with documented fallbacks. */
export interface SlideContextReferenceDiagnostic {
  code: 'unresolved-layout' | 'unresolved-theme' | 'unresolved-color-scheme';
  /** Where the unresolved id is written: `slides.N.layout`, `slides.N.design.theme`, `design.colorScheme` and so on. */
  path: string;
  /** The id that matched no inline, host or bundled record. */
  id: string;
  /** The record used instead: `minimal` for a theme, `cool-horizon` for a colour scheme. Absent for a layout, which has no substitute. */
  fallback?: string;
  message: string;
}
/**
 * An unresolved font scheme falls back to DEFAULT_FONT_SCHEME, a theme to `minimal` and a colour scheme to `cool-horizon`;
 * an unresolved layout composes with no layout record (automatic composition). None of them throws.
 */
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
 * `unresolved-layout`, `unresolved-theme`, `unresolved-color-scheme`). Throws a RangeError for an index outside the deck or non-positive
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

  // A string id resolves through the catalogs. An object is an inline record on top of its `id` record, or of the
  // engine default record when it has no `id`. A reference that names an id but carries no fields of its own and matches no record is unresolved: the engine default record
  // applies and a diagnostic says so.
  const resolveReference = (
    kind: 'themes' | 'colorSchemes',
    reference: unknown,
    path: string,
    code: 'unresolved-theme' | 'unresolved-color-scheme',
    fallbackId: string,
  ): Rec => {
    const object = typeof reference === 'object' && reference !== null && !Array.isArray(reference) ? rec(reference) : {};
    const id = typeof reference === 'string' ? reference : typeof object.id === 'string' ? (object.id as string) : undefined;
    // An inline object without an `id` is overlaid on the engine default record, like the preview does, so a partial scheme keeps
    // the slots it does not name (light2, dark2, ...). No diagnostic: nothing was looked up.
    if (id === undefined && typeof reference === 'object' && reference !== null && !Array.isArray(reference)) return { ...lookup(kind, fallbackId), ...object };
    const found = id === undefined ? undefined : lookup(kind, id);
    const inline = Object.keys(object).some((key) => key !== 'id');
    if (id !== undefined && found === undefined && !inline) {
      diagnostics.push({
        code,
        path,
        id,
        fallback: fallbackId,
        message: `${kind === 'themes' ? 'Theme' : 'Colour scheme'} '${id}' is not in the inline, host or bundled catalogs; using '${fallbackId}'.`,
      });
      return { ...lookup(kind, fallbackId), ...object };
    }
    return { ...found, ...object };
  };

  const themePath = own.theme !== undefined ? `slides.${index}.design.theme` : 'design.theme';
  const theme = resolveReference('themes', design.theme ?? DEFAULT_THEME, themePath, 'unresolved-theme', DEFAULT_THEME);
  const colorSchemePath =
    own.colorScheme !== undefined ? `slides.${index}.design.colorScheme` : shared.colorScheme !== undefined ? 'design.colorScheme' : themePath;
  const colorScheme = resolveReference('colorSchemes', design.colorScheme ?? theme.colorScheme ?? DEFAULT_COLOR_SCHEME, colorSchemePath, 'unresolved-color-scheme', DEFAULT_COLOR_SCHEME);

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
    darkBackground: resolveColorRoles(colorScheme, { background: decisionColor(design.background ?? theme.background, colorScheme, rec(deck.variables)) }).dark,
    socialPlatforms: catalogs.socialPlatforms as ComposeSlideOptions['socialPlatforms'],
    ...(options.fonts?.textMeasurement ? { textMeasurement: options.fonts.textMeasurement } : {}),
    ...(options.date !== undefined ? { date: options.date } : {}),
  };
  return { options: composeOptions, diagnostics, resolved: { theme, colorScheme, fontScheme: font.scheme, fontSchemePath } };
}
