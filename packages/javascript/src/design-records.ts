import { checkCatalogsOption, provenanceOf, resolveReference, unresolvedReference, type CatalogKind, type CatalogOptions, type RecordProvenance, type UnresolvedReferenceDiagnostic } from './catalog-refs.js';
import { ENGINE_DEFAULT_COLOR_SCHEME, ENGINE_DEFAULT_FONT_SCHEME, ENGINE_DEFAULT_THEME } from './engine-vocabularies.js';

/**
 * The theme, colour scheme and font scheme one slide (or the deck) is drawn with, resolved the one way every engine
 * resolves them: the slide's design, then the deck's design, then the theme, then the engine default, per field.
 * Catalog-free: records come from the document's catalogs groups and the catalogs the host registered.
 */

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec => typeof value === 'object' && value !== null && !Array.isArray(value);
const rec = (value: unknown): Rec => (isRec(value) ? value : {});

export interface ResolvedDesignRecords {
  theme: Rec;
  colorScheme: Rec;
  fontScheme: Rec;
  /** Where the theme reference is written, dotted (`design.theme`, `slides.2.design.theme`). */
  themePath: string;
  /** Where the colour-scheme reference that applies is written, dotted. */
  colorSchemePath: string;
  /** Where the font-scheme reference that applies is written, dotted. */
  fontSchemePath: string;
  /** The font-scheme reference that applies (a string, or the `id` of an object reference), if any. */
  fontSchemeReference?: string;
  /**
   * Where each record came from (group, source, `document` or `host`), so an engine records provenance without
   * resolving again. A kind is absent when its engine default applies (no reference, or one that resolves nowhere).
   */
  provenance: { theme?: RecordProvenance; colorScheme?: RecordProvenance; fontScheme?: RecordProvenance };
  /** Unresolved references, in the order theme, colour scheme, font scheme. */
  diagnostics: UnresolvedReferenceDiagnostic[];
}

/** Resolve a record reference: a string, or an object with an optional `id` base plus overrides. */
function resolveRecordReference(
  document: unknown,
  kind: CatalogKind,
  reference: unknown,
  path: string,
  fallback: Readonly<Rec>,
  options: CatalogOptions & { group?: string },
  diagnostics: UnresolvedReferenceDiagnostic[],
): { record: Rec; provenance?: RecordProvenance } {
  const object = isRec(reference) ? reference : undefined;
  const id = typeof reference === 'string' ? reference : typeof object?.id === 'string' ? object.id : undefined;
  if (id === undefined) return { record: { ...fallback, ...object } };
  const found = resolveReference(document, kind, id, options);
  if (!found) diagnostics.push(unresolvedReference(document, kind, id, object ? `${path}.id` : path, options));
  return { record: { ...(found ? found.record : fallback), ...object }, ...(found ? { provenance: provenanceOf(found) } : {}) };
}

/**
 * The design records slide `slideIndex` is drawn with (the deck's own when `slideIndex` is undefined). Never throws for
 * an unresolved reference: the engine default applies and `diagnostics` names the reference.
 */
export function resolveDesignRecords(document: unknown, slideIndex: number | undefined, options: CatalogOptions = {}): ResolvedDesignRecords {
  checkCatalogsOption(options.catalogs, 'resolveDesignRecords');
  const deck = rec(document);
  const slides = Array.isArray(deck.slides) ? deck.slides : [];
  const own = slideIndex === undefined ? {} : rec(rec(slides[slideIndex]).design);
  const shared = rec(deck.design);
  const design = { ...shared, ...own };
  const slidePath = `slides.${slideIndex}.design`;
  const diagnostics: UnresolvedReferenceDiagnostic[] = [];

  const themePath = own.theme !== undefined ? `${slidePath}.theme` : 'design.theme';
  const themeFound = typeof design.theme === 'string' ? resolveReference(document, 'themes', design.theme, options) : undefined;
  if (typeof design.theme === 'string' && !themeFound) diagnostics.push(unresolvedReference(document, 'themes', design.theme, themePath, options));
  const theme: Rec = themeFound ? { ...themeFound.record } : { ...ENGINE_DEFAULT_THEME };
  // A theme's own references resolve in the theme's group first, and are reported where the theme record is written.
  const inTheme = { ...options, ...(themeFound ? { group: themeFound.group } : {}) };
  // A reference inside an embedded theme is written at the record; one inside a registered theme is reported at the theme reference.
  const inThemePath = (key: string) => (themeFound?.origin === 'document' ? `catalogs.${themeFound.group}.themes.${themeFound.id}.${key}` : themePath);

  const colorFromDesign = design.colorScheme !== undefined;
  const colorSchemePath = own.colorScheme !== undefined ? `${slidePath}.colorScheme` : shared.colorScheme !== undefined ? 'design.colorScheme' : inThemePath('colorScheme');
  const color = resolveRecordReference(document, 'colorSchemes', colorFromDesign ? design.colorScheme : theme.colorScheme, colorFromDesign ? colorSchemePath : inThemePath('colorScheme'), ENGINE_DEFAULT_COLOR_SCHEME, colorFromDesign ? options : inTheme, diagnostics);

  const fontFromDesign = design.fontScheme !== undefined;
  const fontSchemePath = own.fontScheme !== undefined ? `${slidePath}.fontScheme` : shared.fontScheme !== undefined ? 'design.fontScheme' : inThemePath('fontScheme');
  const font = resolveRecordReference(document, 'fontSchemes', fontFromDesign ? design.fontScheme : theme.fontScheme, fontSchemePath, ENGINE_DEFAULT_FONT_SCHEME, fontFromDesign ? options : inTheme, diagnostics);

  const fontReference = fontFromDesign ? design.fontScheme : theme.fontScheme;
  const fontSchemeReference = typeof fontReference === 'string' ? fontReference : isRec(fontReference) && typeof fontReference.id === 'string' ? fontReference.id : undefined;
  const provenance = {
    ...(themeFound ? { theme: provenanceOf(themeFound) } : {}),
    ...(color.provenance ? { colorScheme: color.provenance } : {}),
    ...(font.provenance ? { fontScheme: font.provenance } : {}),
  };
  return { theme, colorScheme: color.record, fontScheme: font.record, themePath, colorSchemePath, fontSchemePath, ...(fontSchemeReference !== undefined ? { fontSchemeReference } : {}), provenance, diagnostics };
}

/** Resolve a font-scheme reference (a string, or an object with an optional `id` plus overrides) on its own. */
export function resolveFontScheme(document: unknown, reference: unknown, path: string, options: CatalogOptions & { group?: string } = {}): { scheme: Rec; diagnostics: UnresolvedReferenceDiagnostic[] } {
  checkCatalogsOption(options.catalogs, 'resolveFontScheme');
  const diagnostics: UnresolvedReferenceDiagnostic[] = [];
  const { record: scheme } = resolveRecordReference(document, 'fontSchemes', reference, path, ENGINE_DEFAULT_FONT_SCHEME, options, diagnostics);
  return { scheme, diagnostics };
}
