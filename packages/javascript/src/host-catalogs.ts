import type { CatalogOptions } from './catalog-refs.js';
import { defaultCatalog } from './catalog.js';

/** The catalogs an entry point resolves against. FA-20: without a `catalogs` option the default catalog stands in as the host default. */
export function hostCatalogs(options: CatalogOptions = {}): CatalogOptions {
  return { catalogs: options.catalogs ?? [defaultCatalog] };
}
