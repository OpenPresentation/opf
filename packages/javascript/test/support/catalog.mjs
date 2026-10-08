// The default catalog's records as published record files (with `$schema` and `id`), for the tests that iterate a
// kind's records. Core's root carries no catalog data (OPF 0.15, FA-21); the snapshot is `@openpresentation/opf/catalog`.
// Not a test: it lives below test/ so that scripts/run-tests.mjs (which runs test/*.mjs only) never runs it.
import { catalogDisplay, defaultCatalog } from '../../dist/catalog.js';

const SCHEMAS = {
  layouts: 'layout', themes: 'theme', colorSchemes: 'color-scheme', fontSchemes: 'font-scheme', narratives: 'narrative',
  audiences: 'audience', purposes: 'purpose', tones: 'tone', chartTypes: 'chart-type', languages: 'language', socialPlatforms: 'social-platform',
};

/** The records of `kind` (a content or display kind), in snapshot order, each with its `$schema` and `id`. */
export const records = (kind) =>
  Object.entries(defaultCatalog[kind] ?? catalogDisplay[kind] ?? {}).map(([id, record]) => ({ $schema: `https://openpresentation.org/schema/opf-${SCHEMAS[kind]}/v1`, id, ...record }));

export const layouts = records('layouts');
export const themes = records('themes');
export const colorSchemes = records('colorSchemes');
export const fontSchemes = records('fontSchemes');
export const narratives = records('narratives');
export const audiences = records('audiences');
export const purposes = records('purposes');
export const tones = records('tones');
export const chartTypes = records('chartTypes');
export const languages = records('languages');
export const socialPlatforms = records('socialPlatforms');
/** Register this with validate, paginate and resolveSlideContext when a test names gallery records. */
export const catalogs = [defaultCatalog];
export { defaultCatalog };
