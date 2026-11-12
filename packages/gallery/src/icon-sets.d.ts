// @openpresentation/gallery/icon-sets (LH-14, RR-63): the gallery's icon sets, a catalog to register beside `gallery`:
//
//   import { gallery } from "@openpresentation/gallery";
//   import { fetchIcons, galleryIconSets } from "@openpresentation/gallery/icon-sets";
//   const catalogs = [gallery, galleryIconSets()];                            // Node, Bun, Deno: the installed files
//   const catalogs = [gallery, galleryIconSets(fetchIcons("/opf-icons/"))];   // a browser page: the files a host serves
//
// The icon data is plain static files under the package's dist/icons/ (`<set>.json`, `<set>/<name>.json`, `<set>.icons.json`,
// `<set>.tags.json`, exported as `@openpresentation/gallery/icons/*`), read one icon at a time, so a host pays for the icons its decks
// draw and a bundle carries none of the data.

/** One icon: its path data (drawn as the set's style), or the parts the set strokes and fills. */
export type GalleryIcon = string | { readonly stroke?: string; readonly fill?: string };

/** The index of a set (`<set>.json`): the https://openpresentation.org/schema/opf-icon-set/v1 record without `$schema`, `id`, `icons` and `tags`, with every icon name in `names`. */
export interface GalleryIconSetIndex {
  readonly name: string;
  readonly summary?: string;
  readonly version?: string;
  readonly package?: string;
  readonly homepage?: string;
  readonly license: string;
  readonly copyright: string;
  readonly licenseText?: string;
  readonly viewBox: readonly [number, number, number, number];
  readonly style: "stroke" | "fill";
  readonly strokeWidth?: number;
  readonly strokeLinecap?: "butt" | "round" | "square";
  readonly strokeLinejoin?: "miter" | "round" | "bevel";
  /** Every icon name of the set. */
  readonly names: readonly string[];
}

/** A whole set (`<set>.icons.json`): the index and every icon. */
export interface GalleryWholeIconSet extends GalleryIconSetIndex {
  readonly icons: Readonly<Record<string, GalleryIcon>>;
}

/** An icon set as its loader resolves it: the index, only the icons asked for in `icons`, and why each other one asked for could not be read. */
export interface GalleryIconSet extends GalleryIconSetIndex {
  /** The icons asked for that could be read. */
  readonly icons: Readonly<Record<string, GalleryIcon>>;
  /** Why an icon asked for could not be read, by name (a 404, a web page served in its place); core reports it as `opf/icon-unknown`. */
  readonly errors?: Readonly<Record<string, string>>;
  /** The search keywords of every icon, when asked for. */
  readonly tags?: Readonly<Record<string, readonly string[]>>;
}

/** What a set's loader is asked for: the icons a deck draws, and the keywords a search reads. */
export interface GalleryIconRequest {
  readonly icons?: readonly string[];
  readonly tags?: boolean;
}

/** The icon sets as a registered catalog: core's `Catalog` with `source` and `iconSets` only. */
export interface GalleryIconSets {
  readonly source: "https://www.pptx.gallery";
  readonly iconSets: Readonly<Record<string, (request?: GalleryIconRequest) => Promise<GalleryIconSet>>>;
}

/** Reads one file of dist/icons/ by its path there (`lucide.json`, `lucide/truck.json`, `lucide.icons.json`, `lucide.tags.json`): its parsed JSON value. */
export type GalleryIconLoad = (file: string) => Promise<unknown>;

/** Whole sets a server imported into its bundle (`@openpresentation/gallery/icons/<set>.icons.json`), by set id. */
export type GalleryBundledIconSets = Readonly<Record<string, GalleryWholeIconSet | { readonly default: GalleryWholeIconSet }>>;

/** Anything with a `fetch` method, such as a Worker's `env.ASSETS` binding. */
export interface GalleryIconFetcher {
  fetch(input: string): Promise<Response>;
}

/** The ids of the gallery's icon sets: `["lucide", "tabler"]`. */
export declare const GALLERY_ICON_SETS: readonly string[];

/** A batch that asks for more icons of one set than this (40) reads the whole-set file once instead. */
export declare const WHOLE_SET_BATCH: number;

/**
 * The gallery's icon sets. No argument: the installed files in Node, Bun and Deno (next to the module, else the package installed for
 * the working directory); elsewhere a set icon is an `opf/icon-unknown` finding that says to serve the files. `load`: reads the files
 * (`fetchIcons(baseUrl)` for served ones). An object: the whole sets a bundle imported, by id; only those are registered.
 */
export declare function galleryIconSets(load?: GalleryIconLoad | GalleryBundledIconSets): GalleryIconSets;

/** `galleryIconSets()` where this runtime reads the installed files (the `node` export condition), else undefined. */
export declare function installedIconSets(): GalleryIconSets | undefined;

/**
 * A `load` that fetches the files a host serves at `baseUrl` (the package's dist/icons/ folder, or only its set-level files). A relative
 * `baseUrl` resolves against the page; outside one, pass an absolute URL. `fetcher`: a fetch function or an object with `fetch`
 * (`env.ASSETS`); default the global `fetch`.
 */
export declare function fetchIcons(baseUrl: string | URL, fetcher?: ((input: string) => Promise<Response>) | GalleryIconFetcher): GalleryIconLoad;
