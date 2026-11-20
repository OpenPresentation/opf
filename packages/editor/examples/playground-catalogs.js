// The catalogs the playground registers (FA-23, LH-166, RR-63), in a module of their own so a Node test checks them without a browser
// (test/playground-catalogs.mjs). The editor library ships no catalog data: the page is the host. It registers the default catalog owned
// and published by pptx.gallery, and the gallery's icon sets over the icon files build-playground.mjs copies next to the page into
// opf-icons/ (only the set-level files: each set's index, its whole set and its search keywords; fetchIcons reads the whole set once
// when a per-icon file is not there).
import { gallery } from "@openpresentation/gallery";
import { fetchIcons, galleryIconSets } from "@openpresentation/gallery/icon-sets";

/** The page's catalogs: the gallery, and its icon sets served at `opf-icons/` next to `base` (the page's URL). */
export function playgroundCatalogs(base) {
	return [gallery, galleryIconSets(fetchIcons(new URL("./opf-icons/", base)))];
}
