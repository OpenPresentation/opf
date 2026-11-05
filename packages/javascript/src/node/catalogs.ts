// RR-78: the catalogs the Node defaults register when a call names none: the pptx.gallery catalog of the
// @openpresentation/gallery package (core's dependency), as the opf CLI does. Only the Node build of the root (../index.ts) and
// the Node engine import this, so the browser build stays catalog-free (FA-21).
//
// MR-62: core and the gallery release in lockstep at one version, so there is no runtime check that the gallery targets the
// catalog record schema core reads (`CATALOG_SCHEMA`, also `opf.catalogSchema` in the gallery's package.json): `pnpm
// check:catalog-schema` holds the two constants equal at build time.
import { gallery } from "@openpresentation/gallery";
import { galleryIconSets } from "@openpresentation/gallery/icon-sets";
import type { Catalog } from "../core.js";

// LH-14: and the gallery icon sets, each loaded the first time a deck names it (ensureIcons).
const DEFAULTS: readonly Catalog[] = Object.freeze([gallery, galleryIconSets as Catalog]);

/** The catalogs a call registers when it names none: `[gallery, galleryIconSets]`. */
export function defaultCatalogs(): readonly Catalog[] {
	return DEFAULTS;
}
