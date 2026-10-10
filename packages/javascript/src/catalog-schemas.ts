import type { CatalogKind } from './catalog-refs.js';
import type { SchemaName } from './schemas.js';

/**
 * RR-78: the version of the catalog record schemas (spec/schemas/<kind>.schema.json) this core reads. A catalog package
 * declares the version its records target (`opf.catalogSchema` in its package.json, `CATALOG_SCHEMA` in its exports, as
 * @openpresentation/gallery does); the Node defaults refuse a gallery that targets another one. A record schema change that
 * old records no longer validate against raises it.
 */
export const CATALOG_SCHEMA = 1;

/** Kinds of catalog display metadata: published by catalogs for pickers, never referenced by documents. */
export const catalogDisplayKinds = ['chartTypes', 'languages', 'socialPlatforms'] as const;
export type CatalogDisplayKind = (typeof catalogDisplayKinds)[number];
/** Every kind of record a catalog publishes: the content kinds documents reference, and the display kinds. */
export type CatalogRecordKind = CatalogKind | CatalogDisplayKind;

/** The companion schema each catalog record kind validates against. */
export const catalogSchemaNames: Readonly<Record<CatalogRecordKind, SchemaName>> = {
  layouts: 'layout',
  themes: 'theme',
  colorSchemes: 'colorScheme',
  fontSchemes: 'fontScheme',
  narratives: 'narrative',
  audiences: 'audience',
  purposes: 'purpose',
  tones: 'tone',
  chartTypes: 'chartType',
  languages: 'language',
  socialPlatforms: 'socialPlatform',
};
