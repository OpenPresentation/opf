// RR-78: the declarations a host compiles against (pnpm --filter @openpresentation/gallery typecheck).
import type { Catalog } from "@openpresentation/opf";
import { CATALOG_SCHEMA, GALLERY_SOURCE, catalogDisplay, catalogIndexes, catalogManifest, gallery } from "@openpresentation/gallery";
import { getLayoutPreview, layoutPreviewIndex } from "@openpresentation/gallery/previews";

const catalogs: readonly Catalog[] = [gallery];
const source: "https://www.pptx.gallery" = GALLERY_SOURCE;
const schema: 1 = CATALOG_SCHEMA;
const twoColumn: Readonly<Record<string, unknown>> | undefined = gallery.layouts?.["two-column"];
const chart: Readonly<Record<string, unknown>> | undefined = catalogDisplay.chartTypes.column;
const hash: string = catalogIndexes.layouts.contentSha256;
const commit: string = catalogManifest.source.commit;
const html: string | undefined = getLayoutPreview(layoutPreviewIndex.records[0]?.id ?? "");
export { catalogs, chart, commit, hash, html, schema, source, twoColumn };
