import type { CatalogKind } from './catalog-refs.js';
import type { SchemaName } from './schemas.js';

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
