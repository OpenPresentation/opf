// OPF 0.15 (FA-21): core ships no catalog records in its main entry; the CLI is a host and registers the default
// catalog (the pinned pptx.gallery snapshot of @openpresentation/opf/catalog) for every check, pagination, embed,
// render and export. A validate configuration may register more catalogs: they come first, so the first one a
// configuration names is the host default for bare ids, and the default catalog is added after them.
import type { Catalog } from "@openpresentation/opf";
import { defaultCatalog } from "@openpresentation/opf/catalog";

/** The catalogs the CLI registers: `extra` in order, then the default catalog unless `extra` already has its source. */
export function cliCatalogs(extra: readonly Catalog[] = []): Catalog[] {
	return extra.some((catalog) => catalog.source === defaultCatalog.source) ? [...extra] : [...extra, defaultCatalog];
}

/** The catalogs every command registers when no configuration names others. */
export const CLI_CATALOGS: readonly Catalog[] = cliCatalogs();
