// OPF 0.15 (FA-21): core ships no catalog records in its main entry; the CLI is a host and registers the pptx.gallery
// catalog (RR-78: `gallery` of @openpresentation/gallery, a dependency of the CLI) for every check, pagination, embed,
// render and export. A validate configuration may register more catalogs: they come first, so the first one a
// configuration names is the host default for bare ids, and the gallery is added after them.
import { CATALOG_SCHEMA as GALLERY_CATALOG_SCHEMA, gallery } from "@openpresentation/gallery";
import type { Catalog } from "@openpresentation/opf";
import { galleryMismatch } from "@openpresentation/opf/internal/engine";

/**
 * RR-78: why the installed gallery cannot be registered (it targets another catalog record schema than the installed core
 * reads), or undefined. Every command but help, --version and skills stops with `gallery-schema-mismatch` when it is set.
 */
export const GALLERY_MISMATCH: string | undefined = galleryMismatch(GALLERY_CATALOG_SCHEMA);

/** The catalogs the CLI registers: `extra` in order, then the gallery unless `extra` already has its source. */
export function cliCatalogs(extra: readonly Catalog[] = []): Catalog[] {
	return extra.some((catalog) => catalog.source === gallery.source) ? [...extra] : [...extra, gallery];
}

/** The catalogs every command registers when no configuration names others. */
export const CLI_CATALOGS: readonly Catalog[] = cliCatalogs();
