// RR-78: the catalogs the Node defaults register when a call names none: the pptx.gallery catalog of the
// @openpresentation/gallery package (core's dependency), as the opf CLI does. Only the Node build of the root (../index.ts) and
// the Node engine import this, so the browser build stays catalog-free (FA-21).
//
// The gallery declares the version of core's catalog record schemas its records target (`CATALOG_SCHEMA`, also
// `opf.catalogSchema` in its package.json). It is checked once, when this module loads; a gallery that targets another
// version is never registered: every default use throws `gallery-schema-mismatch` instead.
import { CATALOG_SCHEMA as GALLERY_CATALOG_SCHEMA, gallery } from "@openpresentation/gallery";
import { OPFApiError } from "../api-errors.js";
import { CATALOG_SCHEMA } from "../catalog-schemas.js";
import type { Catalog } from "../core.js";

/** Why a gallery that declares `declared` cannot be the default catalog of a core that reads `reads`, or undefined when it can. */
export function galleryMismatch(declared: unknown, reads: number = CATALOG_SCHEMA): string | undefined {
	if (declared === reads) return undefined;
	return `@openpresentation/gallery targets catalog schema ${JSON.stringify(declared)}, and this @openpresentation/opf reads catalog schema ${reads}. Install the gallery release for schema ${reads} (the range in @openpresentation/opf's dependencies), or pass catalogs explicitly.`;
}

const mismatch = galleryMismatch(GALLERY_CATALOG_SCHEMA);
const DEFAULTS: readonly Catalog[] = Object.freeze([gallery]);

/** The catalogs a call registers when it names none: `[gallery]`. Throws `gallery-schema-mismatch` for a gallery of another schema. */
export function defaultCatalogs(): readonly Catalog[] {
	if (mismatch) throw new OPFApiError(mismatch, "gallery-schema-mismatch", { details: { gallery: GALLERY_CATALOG_SCHEMA, core: CATALOG_SCHEMA } });
	return DEFAULTS;
}
