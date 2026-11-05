// OPF 0.15 (FA-21): core ships no catalog records in its main entry; the CLI is a host and registers the pptx.gallery
// catalog (RR-78: `gallery` of @openpresentation/gallery, a dependency of the CLI) for every check, pagination, embed,
// render and export. A validate configuration may register more catalogs: they come first, so the first one a
// configuration names is the host default for bare ids, and the gallery is added after them.
import { gallery } from "@openpresentation/gallery";
import { galleryIconSets } from "@openpresentation/gallery/icon-sets";
import type { Catalog } from "@openpresentation/opf";

/** The catalogs the CLI registers: `extra` in order, then the gallery unless `extra` already has its source, then the gallery icon sets (LH-14). */
export function cliCatalogs(extra: readonly Catalog[] = []): Catalog[] {
	return [...(extra.some((catalog) => catalog.source === gallery.source) ? [...extra] : [...extra, gallery]), galleryIconSets as Catalog];
}

/** The catalogs every command registers when no configuration names others. */
export const CLI_CATALOGS: readonly Catalog[] = cliCatalogs();
