/**
 * `@openpresentation/opf/catalog`: the pinned snapshot of the default catalog pptx.gallery publishes (spec/catalogs,
 * pinned by spec/catalogs/manifest.json), shaped for hosts to register. The only entry of the package that carries
 * catalog data; the root and every other subpath resolve only what a document embeds and what a host registers.
 *
 * ```js
 * import { defaultCatalog } from '@openpresentation/opf/catalog';
 * validate(document, { catalogs: [defaultCatalog] });
 * ```
 */
import { catalogKinds, embeddedCopy, type Catalog } from './catalog-refs.js';
import { catalogDisplayKinds, type CatalogDisplayKind } from './catalog-schemas.js';
import { catalogIndexes as snapshotIndexes, catalogs as snapshot, type CatalogIndex } from './generated/catalogs.js';

/** The source the default catalog is registered under, and the `source` of a document's `catalogs.default`. */
export const DEFAULT_CATALOG_SOURCE = 'https://www.pptx.gallery';

const keyed = (records: readonly unknown[]) =>
  Object.freeze(Object.fromEntries(records.map((record) => [String((record as { id: string }).id), Object.freeze(embeddedCopy(record))])));

/**
 * The default catalog: every content record of the snapshot, by kind and then by id, with no `$schema` or `id` (the
 * key is the id). Register it with every entry point that resolves references: `{ catalogs: [defaultCatalog] }`.
 */
export const defaultCatalog: Catalog = Object.freeze({
  source: DEFAULT_CATALOG_SOURCE,
  ...Object.fromEntries(catalogKinds.map((kind) => [kind, keyed(snapshot[kind] as readonly unknown[])])),
}) as Catalog;

/**
 * Display metadata for pickers: chart types, languages and social platforms by id. Documents never reference these
 * records; chart.type, the language tag and Socials keys are engine vocabularies.
 */
export const catalogDisplay: Readonly<Record<CatalogDisplayKind, Readonly<Record<string, Readonly<Record<string, unknown>>>>>> = Object.freeze(
  Object.fromEntries(catalogDisplayKinds.map((kind) => [kind, keyed(snapshot[kind] as readonly unknown[])])) as Record<CatalogDisplayKind, Readonly<Record<string, Readonly<Record<string, unknown>>>>>,
);

/** Each kind's `index.json` in the snapshot: the record summaries and their content hash. */
export const catalogIndexes: Readonly<Record<string, CatalogIndex>> = snapshotIndexes;
export type { CatalogIndex, CatalogIndexRecord } from './generated/catalogs.js';

// The static HTML layout previews (spec/previews/layouts) are catalog display data too.
export { getLayoutPreview, hasLayoutPreview, layoutPreviewIndex, layoutPreviewSlugs, layoutPreviews } from './previews.js';
export type { LayoutPreviewIndex, LayoutPreviewRecord } from './previews.js';
