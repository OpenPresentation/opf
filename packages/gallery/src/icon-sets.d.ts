// @openpresentation/gallery/icon-sets (LH-14): the gallery's icon sets, a catalog to register beside `gallery`:
//
//   import { gallery } from "@openpresentation/gallery";
//   import { galleryIconSets } from "@openpresentation/gallery/icon-sets";
//   await ensureIcons(deck, { catalogs: [gallery, galleryIconSets] });
//
// Each set is a function that imports the set's module (`@openpresentation/gallery/icon-sets/<id>`) the first time a deck uses it, so
// a host pays for a set only when it draws one, and a host that does not import this entry carries no icon data at all.
import type { GalleryIconSet } from "./icon-sets/icon-set.js";
export type { GalleryIcon, GalleryIconSet } from "./icon-sets/icon-set.js";

/** The icon sets as a registered catalog: core's `Catalog` with `source` and `iconSets` only. */
export interface GalleryIconSets {
  readonly source: "https://www.pptx.gallery";
  readonly iconSets: Readonly<Record<string, () => Promise<GalleryIconSet>>>;
}
export declare const galleryIconSets: GalleryIconSets;
