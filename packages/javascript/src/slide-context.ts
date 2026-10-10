import { OPFUnresolvedReferenceError, checkCatalogsOption, provenanceOf, resolveReference, unresolvedReference, type CatalogOptions, type RecordProvenance, type UnresolvedReferenceDiagnostic } from './catalog-refs.js';
import { resolveCanvasDimensions, resolveFontFamilies, type ComposeSlideOptions, type Fonts } from './composition.js';
import { resolveColorRoles } from './color.js';
import { resolveDesignRecords } from './design-records.js';
import { decisionColor } from './rule-design.js';
import { resolveSlideVariables } from './slide-variables.js';

/**
 * One slide's composition context: the layout, canvas, theme and font families that `composeSlide` needs,
 * resolved the one way every engine must resolve them (slide design, then deck design, then theme, then the
 * engine default, per field). Core pagination, the layout checks, the renderer, the exporter and the editor
 * all call this, with the same `catalogs` option, so preview and export resolve the same records.
 */

// biome-ignore lint/suspicious/noExplicitAny: authored JSON is walked untyped; every read is guarded.
type Rec = Record<string, any>;
const rec = (value: unknown): Rec => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {});

/** A reference that resolves nowhere, so the slide composes with the automatic layout or the engine default. */
export type SlideContextDiagnostic = UnresolvedReferenceDiagnostic;

export interface SlideContextOptions extends CatalogOptions {
  /** The fonts handle; core reads its `textMeasurement`. Without it composition uses core's portable estimate. */
  fonts?: Fonts;
  /** One-based displayed slide number. Default: index + 1. */
  slideNumber?: number;
  /** Displayed slide count for `{{deck.slideCount}}`. Default: the deck's slide count. */
  slideCount?: number;
  /** Host-supplied current calendar date (ISO YYYY-MM-DD) for `date: true` header/footer fields. */
  date?: string;
  /** Throw OPFUnresolvedReferenceError for a reference that resolves nowhere, instead of falling back (strict export). */
  strictReferences?: boolean;
}

export interface SlideContext {
  /**
   * The slide to compose and draw: slide `index` with `{{slide.number}}`, `{{slide.section}}` and
   * `{{deck.slideCount}}` substituted (`resolveSlideVariables`) for `options.slideNumber` and `options.slideCount`, and its
   * logo references (`var:organization.logo.icon` in an image field) resolved for `options.darkBackground`.
   * Its own header and footer text keeps the tokens: `layoutFurniture` substitutes them and marks each slide number
   * as a live field. The source slide object itself when it carries no slide-scoped token.
   */
  slide: Rec;
  /** Ready for `composeSlide(slide, options)`. */
  options: ComposeSlideOptions;
  diagnostics: SlideContextDiagnostic[];
  /** The records `options` was resolved from, for hosts that also need the theme's or colour scheme's own fields. */
  resolved: {
    theme: Rec;
    colorScheme: Rec;
    fontScheme: Rec;
    /** Where the font scheme reference is written, dotted. */
    fontSchemePath: string;
    /** The layout record, when the slide names one that resolves. */
    layout?: Rec;
    /**
     * Where each resolved record came from: `{ kind, reference, id, group, source?, origin }` (origin `document` for an
     * embedded record, `host` for a registered catalog's). A kind is absent when nothing resolved for it (the engine
     * default, or automatic composition for a layout), so engines record provenance without resolving again.
     */
    provenance: { layout?: RecordProvenance; theme?: RecordProvenance; colorScheme?: RecordProvenance; fontScheme?: RecordProvenance };
  };
}

/**
 * Resolve slide `index` of `presentation` into the slide and the options `composeSlide` takes: engines compose and draw
 * `composeSlide(context.slide, context.options)`, so the slide-scoped built-ins carry the same number and count as the
 * header and footer. Never throws for an unresolved reference unless `strictReferences` is set: the engine default (or
 * automatic composition, for a layout) applies and `diagnostics` holds one `unresolved-reference` per reference. Throws a RangeError for an index outside the deck or
 * non-positive canvas dimensions, which a schema-valid deck cannot have.
 */
export function resolveSlideContext(presentation: unknown, index: number, options: SlideContextOptions = {}): SlideContext {
  const deck = rec(presentation);
  const slides = Array.isArray(deck.slides) ? deck.slides : [];
  if (!Number.isInteger(index) || index < 0 || index >= slides.length) throw new RangeError(`Slide index ${String(index)} is outside the presentation's ${slides.length} slides.`);
  const slide = rec(slides[index]);
  const catalogs = { catalogs: checkCatalogsOption(options.catalogs, 'resolveSlideContext') };
  const records = resolveDesignRecords(presentation, index, catalogs);
  const diagnostics: SlideContextDiagnostic[] = [...records.diagnostics];
  const { theme, colorScheme, fontScheme } = records;
  const design = { ...rec(deck.design), ...rec(slide.design) };

  let layout: Rec | undefined;
  let layoutProvenance: RecordProvenance | undefined;
  if (typeof slide.layout === 'string') {
    const found = resolveReference(presentation, 'layouts', slide.layout, catalogs);
    if (found) {
      layout = { ...found.record };
      layoutProvenance = provenanceOf(found);
    }
    else diagnostics.push(unresolvedReference(presentation, 'layouts', slide.layout, `slides.${index}.layout`, catalogs));
  }
  if (options.strictReferences && diagnostics.length) throw new OPFUnresolvedReferenceError(diagnostics);

  const composeOptions: ComposeSlideOptions = {
    ...resolveCanvasDimensions(design.dimensions ?? theme.dimensions),
    ...(layout ? { layout } : {}),
    presentation: presentation as ComposeSlideOptions['presentation'],
    slideIndex: index,
    slideNumber: options.slideNumber ?? index + 1,
    slideCount: options.slideCount ?? slides.length,
    fontFamilies: resolveFontFamilies(fontScheme),
    darkBackground: resolveColorRoles(colorScheme, { background: decisionColor(design.background ?? theme.background, colorScheme, rec(deck.variables)) }).dark,
    ...(theme.background !== undefined ? { themeBackground: theme.background } : {}),
    ...(options.fonts?.textMeasurement ? { textMeasurement: options.fonts.textMeasurement } : {}),
    ...(options.date !== undefined ? { date: options.date } : {}),
  };
  const resolvedSlide = resolveSlideVariables(slide, { slideNumber: composeOptions.slideNumber as number, slideCount: composeOptions.slideCount as number, presentation, darkBackground: composeOptions.darkBackground === true });
  return { slide: resolvedSlide, options: composeOptions, diagnostics, resolved: { theme, colorScheme, fontScheme, fontSchemePath: records.fontSchemePath, ...(layout ? { layout } : {}), provenance: { ...(layoutProvenance ? { layout: layoutProvenance } : {}), ...records.provenance } } };
}
