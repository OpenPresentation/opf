// The catalogs the Node engine registers when a call names none: the default catalog (the pinned pptx.gallery snapshot of
// `@openpresentation/opf/catalog`), as the opf CLI does. Only the Node engine imports this (loaded on the first file call), so the browser build stays catalog-free (FA-21).
import type { Catalog } from "../core.js";
import { defaultCatalog } from "../catalog.js";

export const DEFAULT_CATALOGS: readonly Catalog[] = [defaultCatalog];
