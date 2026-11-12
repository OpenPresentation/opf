// @openpresentation/gallery/icon-sets (LH-14, RR-63): the gallery's icon sets, a catalog to register beside `gallery`:
//
//   import { gallery } from "@openpresentation/gallery";
//   import { galleryIconSets } from "@openpresentation/gallery/icon-sets";
//   const catalogs = [gallery, galleryIconSets()];                            // Node, Bun, Deno: the installed files
//   const catalogs = [gallery, galleryIconSets(fetchIcons("/opf-icons/"))];   // a browser or a Worker: the files a host serves
//
// The icon data is plain static files under the package's dist/icons/ (`<set>.json`, `<set>/<name>.json`, `<set>.tags.json`), read one
// icon at a time, so a host pays for the icons its decks draw and a bundle carries none of the data.

/** One icon: its path data (drawn as the set's style), or the parts the set strokes and fills. */
export type GalleryIcon = string | { readonly stroke?: string; readonly fill?: string };

/** An icon set as its loader resolves it: the https://openpresentation.org/schema/opf-icon-set/v1 record without `$schema` and `id`, with every icon name in `names` and only the icons asked for in `icons`. */
export interface GalleryIconSet {
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
  /** The icons asked for that the set has. */
  readonly icons: Readonly<Record<string, GalleryIcon>>;
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

/** Reads one file of dist/icons/ by its path there (`lucide.json`, `lucide/truck.json`, `lucide.tags.json`): its parsed JSON value. */
export type GalleryIconLoad = (file: string) => Promise<unknown>;

/** The ids of the gallery's icon sets: `["lucide", "tabler"]`. */
export declare const GALLERY_ICON_SETS: readonly string[];

/** The gallery's icon sets, reading their files through `load` (default: the installed files in Node, Bun and Deno; elsewhere it rejects). */
export declare function galleryIconSets(load?: GalleryIconLoad): GalleryIconSets;

/** A `load` that fetches the files a host serves at `baseUrl` (the package's dist/icons/ folder). */
export declare function fetchIcons(baseUrl: string | URL, fetchImpl?: typeof fetch): GalleryIconLoad;
