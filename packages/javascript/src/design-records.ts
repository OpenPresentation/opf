import { resolveReference, unresolvedReference, type CatalogKind, type CatalogOptions, type UnresolvedReferenceDiagnostic } from './catalog-refs.js';
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
): Rec {
  const object = isRec(reference) ? reference : undefined;
  const id = typeof reference === 'string' ? reference : typeof object?.id === 'string' ? object.id : undefined;
  if (id === undefined) return { ...fallback, ...object };
  const found = resolveReference(document, kind, id, options);
  if (!found) diagnostics.push(unresolvedReference(document, kind, id, object ? `${path}.id` : path, options));
  return { ...(found ? found.record : fallback), ...object };
}

/**
 * The design records slide `slideIndex` is drawn with (the deck's own when `slideIndex` is undefined). Never throws for
 * an unresolved reference: the engine default applies and `diagnostics` names the reference.
 */
export function resolveDesignRecords(document: unknown, slideIndex: number | undefined, options: CatalogOptions = {}): ResolvedDesignRecords {
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
  const colorScheme = resolveRecordReference(document, 'colorSchemes', colorFromDesign ? design.colorScheme : theme.colorScheme, colorFromDesign ? colorSchemePath : inThemePath('colorScheme'), ENGINE_DEFAULT_COLOR_SCHEME, colorFromDesign ? options : inTheme, diagnostics);

  const fontFromDesign = design.fontScheme !== undefined;
  const fontSchemePath = own.fontScheme !== undefined ? `${slidePath}.fontScheme` : shared.fontScheme !== undefined ? 'design.fontScheme' : inThemePath('fontScheme');
  const fontScheme = resolveRecordReference(document, 'fontSchemes', fontFromDesign ? design.fontScheme : theme.fontScheme, fontSchemePath, ENGINE_DEFAULT_FONT_SCHEME, fontFromDesign ? options : inTheme, diagnostics);

  const fontReference = fontFromDesign ? design.fontScheme : theme.fontScheme;
  const fontSchemeReference = typeof fontReference === 'string' ? fontReference : isRec(fontReference) && typeof fontReference.id === 'string' ? fontReference.id : undefined;
  return { theme, colorScheme, fontScheme, themePath, colorSchemePath, fontSchemePath, ...(fontSchemeReference !== undefined ? { fontSchemeReference } : {}), diagnostics };
}

/** Resolve a font-scheme reference (a string, or an object with an optional `id` plus overrides) on its own. */
export function resolveFontScheme(document: unknown, reference: unknown, path: string, options: CatalogOptions & { group?: string } = {}): { scheme: Rec; diagnostics: UnresolvedReferenceDiagnostic[] } {
  const diagnostics: UnresolvedReferenceDiagnostic[] = [];
  const scheme = resolveRecordReference(document, 'fontSchemes', reference, path, ENGINE_DEFAULT_FONT_SCHEME, options, diagnostics);
  return { scheme, diagnostics };
}
