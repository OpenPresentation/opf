# spec/

Canonical, package-addressable OPF spec content. Everything in this directory ships inside `@openpresentation/opf` and is importable as `@openpresentation/opf/spec/<path>`.

New to the format? Read [`docs/how-opf-works.md`](../docs/how-opf-works.md) first — this directory is the machine-readable half of that story.

## Layout

| Path | Contents |
|---|---|
| [`schemas/opf.schema.json`](./schemas/opf.schema.json) | Canonical JSON Schema for top-level OPF `Presentation` documents (`$id: https://openpresentation.org/schema/opf/v1`). |
| [`schemas/*.schema.json`](./schemas) | Companion schemas for catalog records. Each has a stable `$id` of the form `https://openpresentation.org/schema/opf-<kind>/v1` (e.g. `opf-narrative`, `opf-theme`, `opf-chart-type`). Two schemas in this directory — `catalog-index.schema.json` and `layout-preview-index.schema.json` — describe repo-internal *index* files instead (see rows below); they are not OPF document or catalog-record schemas and are intentionally excluded from the package's published/typed schema surface (`schemaNames` / generated types). |
| [`catalogs/<kind>/`](./catalogs) | Bundled catalog records, one JSON file per record plus an `index.json` per kind. These are the same records served from `https://www.pptx.gallery/<kind>`. Every `index.json` validates against `schemas/catalog-index.schema.json` (`$id: https://openpresentation.org/schema/opf-catalog-index/v1`), a generic shape shared across all 11 kinds. |
| [`previews/layouts/`](./previews/layouts) | Vendored HTML previews for the **slide archetype gallery** (e.g. `swot-analysis`, `agenda`, `org-chart`) — see "Preview gallery vs. layout catalog" below. Its `index.json` validates against `schemas/layout-preview-index.schema.json` (`$id: https://openpresentation.org/schema/opf-layout-preview-index/v1`). |
| [`reference/engine-defaults.json`](./reference/engine-defaults.json) | Reference example of engine-side defaults. Engine configuration, not part of the OPF document contract; it has no JSON Schema. |
| [`openapi.yaml`](./openapi.yaml) | Optional reference OpenAPI 3.1 contract for downstream services that choose to expose OPF operations (validate, parse, convert, generate, render) over HTTP. OpenPresentation does not host this API; implementers can use it as a starting point for their own hosted or internal services. Local format tooling never needs it. |

## Preview gallery vs. layout catalog

`spec/catalogs/layouts/` and `spec/previews/layouts/` are two unrelated taxonomies that happen to share a directory name. Do not assume a preview id corresponds to a layout catalog id — none of them do.

- **`spec/catalogs/layouts/`** is the **structural layout catalog**: 28 records (`title`, `title-subtitle`, `text-1x`…`text-3x`, `list-1x`…`list-6x`, `chart-1x`…`chart-3x`, `image-bleed`, `blank`, …) that `Slide.layout` resolves against. These describe placeholder structure — how many regions a slide has and what kind of content goes where — independent of subject matter.
- **`spec/previews/layouts/`** is the **slide archetype preview gallery**: 70 self-contained HTML snippets keyed by subject-matter archetype (`swot-analysis`, `agenda`, `org-chart`, `pricing-table`, `roadmap`, …), used to render picker thumbnails. These ids describe *what a slide is about*, not its structural layout, and are never used as a `Slide.layout` value.

The preview HTML files are **vendored, generated artifacts**, not hand-authored spec content. They're produced by rendering React/Tailwind components from `lib/layout-previews.tsx` in the sibling `pptx-gallery` repo via `packages/javascript/scripts/render-layout-previews.mjs`, which requires a local `../pptx-gallery` checkout (a sibling directory to this repo) to run:

```sh
node --import tsx packages/javascript/scripts/render-layout-previews.mjs
```

Without that sibling checkout, treat `spec/previews/layouts/*.html` and `index.json` as read-only committed output — edit the source components in `pptx-gallery` and re-render, rather than hand-editing the generated HTML here.

## Consuming this directory

Validate a document and load catalog records without touching the files directly:

```ts
import { validatePresentation, narratives } from "@openpresentation/opf";

const result = validatePresentation(deck);
// result.valid    — schema correctness
// result.errors   — structural problems
// result.warnings — advisory issues such as unknown catalog ids
```

Import the raw files when an engine, resolver, or non-JavaScript toolchain needs them:

```ts
import presentationSchema from "@openpresentation/opf/spec/schemas/opf.schema.json" with { type: "json" };
import qbr from "@openpresentation/opf/spec/catalogs/narratives/qbr.json" with { type: "json" };
```

The same paths work for any validator in any language: point a JSON Schema draft 2020-12 implementation at `schemas/opf.schema.json` and validate `.opf.json` files against it. Catalog records validate against their kind's companion schema.

## Stability

The presentation schema `$id` is pinned to `/v1` and the package is pre-stable (0.x): expect breaking changes between minor versions until 1.0, tracked in [`CHANGELOG.md`](../CHANGELOG.md) with migration notes under [`docs/migrations/`](../docs/migrations).
