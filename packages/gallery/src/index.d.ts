// @openpresentation/gallery: the pptx.gallery catalog for OPF (RR-78).
//
//   import { gallery } from "@openpresentation/gallery";
//   validate(deck, { catalogs: [gallery] });
//
// The package has no dependency, not even for its types: core depends on it, so its declarations are self-contained.
// `GalleryCatalog` has the shape of core's `Catalog` (@openpresentation/opf), so `gallery` is assignable to it; the
// package's type test (test/types.ts) checks that against core's own declarations.

/** The source the gallery is registered under, and the `source` of a document's `catalogs.default`. */
export declare const GALLERY_SOURCE: "https://www.pptx.gallery";

/** The version of core's catalog record schemas these records target (package.json `opf.catalogSchema`). */
export declare const CATALOG_SCHEMA: 1;

/** Records of one kind, keyed by id (core's `CatalogRecordMap`). */
export type GalleryRecords = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

/** The gallery as a registered catalog: core's `Catalog` shape, `source` and the eight content kinds. */
export interface GalleryCatalog {
  readonly source: typeof GALLERY_SOURCE;
  readonly layouts: GalleryRecords;
  readonly themes: GalleryRecords;
  readonly colorSchemes: GalleryRecords;
  readonly fontSchemes: GalleryRecords;
  readonly narratives: GalleryRecords;
  readonly audiences: GalleryRecords;
  readonly purposes: GalleryRecords;
  readonly tones: GalleryRecords;
}

/**
 * The pptx.gallery catalog: every content record by kind and then by id, with no `$schema` or `id` (the key is the id)
 * and no `x-*` display metadata. Register it with every entry point that resolves references: `{ catalogs: [gallery] }`.
 */
export declare const gallery: GalleryCatalog;

/** Records of one display kind, keyed by id. */
export type CatalogDisplayRecords = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

/**
 * Display metadata for pickers: chart types, languages and social platforms by id. Documents never reference these
 * records; `chart.type`, the language tag and the `socials` keys are engine vocabularies.
 */
export declare const catalogDisplay: {
  readonly chartTypes: CatalogDisplayRecords;
  readonly languages: CatalogDisplayRecords;
  readonly socialPlatforms: CatalogDisplayRecords;
};

/** A summary entry of a kind's `index.json`. */
export interface CatalogIndexRecord {
  readonly id: string;
  readonly name?: string;
  readonly summary?: string;
  readonly file: string;
  readonly [key: string]: unknown;
}

/** A kind's `index.json` (schema https://openpresentation.org/schema/opf-catalog-index/v1). */
export interface CatalogIndex {
  readonly $schema?: string;
  /** The kind as its URL segment, such as `color-schemes`. */
  readonly kind: string;
  readonly version: string;
  readonly description?: string;
  /** SHA-256 of the canonical JSON of the index-ordered records, `x-*` members removed. */
  readonly contentSha256: string;
  readonly records: readonly CatalogIndexRecord[];
  readonly [key: string]: unknown;
}

/** The kinds the gallery publishes, keyed as in a document's `catalogs` group. */
export type GalleryKind =
  | "layouts"
  | "themes"
  | "colorSchemes"
  | "fontSchemes"
  | "narratives"
  | "audiences"
  | "purposes"
  | "tones"
  | "chartTypes"
  | "languages"
  | "socialPlatforms";

/** Each kind's `index.json`. */
export declare const catalogIndexes: Readonly<Record<GalleryKind, CatalogIndex>>;

/** Where the records came from: the pptx.gallery commit and a content hash per kind (schema opf-catalog-manifest/v1). */
export declare const catalogManifest: {
  readonly $schema: string;
  readonly publisher: string;
  readonly source: { readonly repository: string; readonly commit: string; readonly path: string };
  readonly kinds: Readonly<Record<string, { readonly mode: string; readonly records: number; readonly contentSha256: string }>>;
  readonly [key: string]: unknown;
};
