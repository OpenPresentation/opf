# spec/

Canonical, package-addressable OPF spec content. Everything in this directory ships inside `@openpresentation/opf` and is importable as `@openpresentation/opf/spec/<path>`.

New to the format? Read [`docs/how-opf-works.md`](../docs/how-opf-works.md) first — this directory is the machine-readable half of that story.

## Layout

| Path | Contents |
|---|---|
| [`schemas/opf.schema.json`](./schemas/opf.schema.json) | Canonical JSON Schema for top-level OPF `Presentation` documents (`$id: https://openpresentation.org/schema/opf/v1`). |
| [`schemas/*.schema.json`](./schemas) | Companion schemas for catalog records. Each has a stable `$id` of the form `https://openpresentation.org/schema/opf-<kind>/v1` (e.g. `opf-narrative`, `opf-theme`, `opf-chart-type`). Three schemas in this directory — `catalog-index.schema.json`, `catalog-manifest.schema.json`, and `layout-preview-index.schema.json` — describe repo-internal index and manifest files instead (see rows below); they are not OPF document or catalog-record schemas and are intentionally excluded from the package's published/typed schema surface (`schemaNames` / generated types). |
| [`schemas/finding.schema.json`](./schemas/finding.schema.json) | The report format every OPF tool shares (`$id: https://openpresentation.org/schema/opf-finding/v1`): a finding is one thing a checker found at one place in a presentation, and a report lists them. `validate`, the Markdown and YAML converters, the editor's Review panel and hosted reviewers produce it. It is not a catalog-record schema, but unlike the three index schemas it is part of the published, typed schema surface (`schemaNames`, `Finding`, `FindingReport`). See [`docs/validate.md`](../docs/validate.md). |
| Catalog records (not in this directory) | Since OPF 0.19 (RR-78) the catalog records, their `manifest.json` and the layout previews are the `@openpresentation/gallery` package ([`packages/gallery/`](../packages/gallery)): a pinned snapshot of the default catalog pptx.gallery publishes at `https://www.pptx.gallery/<kind>/index.json`, which hosts register with `catalogs: [gallery]` and engines never fetch. Every `index.json` validates against `schemas/catalog-index.schema.json` (`$id: https://openpresentation.org/schema/opf-catalog-index/v1`), the manifest against `schemas/catalog-manifest.schema.json` and the preview index against `schemas/layout-preview-index.schema.json`; `check:spec` fails when the records no longer match the manifest. Do not edit the records by hand; change the gallery and run `scripts/sync-gallery-catalog.mjs` (see [`docs/default-catalog.md`](../docs/default-catalog.md)). |
| [`reference/engine-defaults.json`](./reference/engine-defaults.json) | Reference example of engine-side defaults. Engine configuration, not part of the OPF document contract; it has no JSON Schema. |
| [`openapi.yaml`](./openapi.yaml) | Optional reference OpenAPI 3.1 contract for downstream services that choose to expose OPF operations (validate, parse, convert, generate, render) over HTTP. OpenPresentation does not host this API; implementers can use it as a starting point for their own hosted or internal services. Local format tooling never needs it. |

## Preview gallery vs. layout catalog

The gallery package's `catalog/layouts/` and `previews/layouts/` are two unrelated taxonomies that happen to share a directory name. Do not assume a preview id corresponds to a layout catalog id — none of them do.

- **`packages/gallery/catalog/layouts/`** is the **structural layout catalog**: every layout record pptx.gallery publishes (`title`, `title-subtitle`, `text-1x`…`text-3x`, `list-1x`…`list-6x`, `chart-1x`…`chart-3x`, `image-1x`…`image-3x`, `blank`, …) that `Slide.layout` resolves against. These describe placeholder structure — how many regions a slide has and what kind of content goes where — independent of subject matter.
- **`packages/gallery/previews/layouts/`** is the **slide archetype preview gallery**: 70 self-contained HTML snippets keyed by subject-matter archetype (`swot-analysis`, `agenda`, `org-chart`, `pricing-table`, `roadmap`, …), used to render picker thumbnails. These ids describe *what a slide is about*, not its structural layout, and are never used as a `Slide.layout` value.

The preview HTML files are **vendored, generated artifacts**, not hand-authored spec content. They're produced by rendering React/Tailwind components from `lib/layout-previews.tsx` in the sibling `pptx-gallery` repo via `packages/gallery/scripts/render-layout-previews.mjs`, which requires a local `../pptx-gallery` checkout (a sibling directory to this repo) to run:

```sh
node --import tsx packages/gallery/scripts/render-layout-previews.mjs
```

Without that sibling checkout, treat `packages/gallery/previews/layouts/*.html` and `index.json` as read-only committed output — edit the source components in `pptx-gallery` and re-render, rather than hand-editing the generated HTML here.

## Consuming this directory

Validate a document and load catalog records without touching the files directly:

```ts
import { validate } from "@openpresentation/opf";
import { gallery } from "@openpresentation/gallery";

const report = validate(deck, { catalogs: [gallery] }); // in Node, validate(deck) registers the gallery too
const qbr = gallery.narratives.qbr;
// report.valid    — no finding has severity "error"
// report.findings — every finding: rule id, severity, category, JSON Pointer path, message, fixes
// report.counts   — { error, warning, info }
```

Import the raw files when an engine, resolver, or non-JavaScript toolchain needs them:

```ts
import presentationSchema from "@openpresentation/opf/spec/schemas/opf.schema.json" with { type: "json" };
import narrativeSchema from "@openpresentation/opf/spec/schemas/narrative.schema.json" with { type: "json" };
```

The same paths work for any validator in any language: point a JSON Schema draft 2020-12 implementation at `schemas/opf.schema.json` and validate `.opf.json` files against it. Catalog records (pptx.gallery serves each one at `https://www.pptx.gallery/<kind>/<id>.json`) validate against their kind's companion schema.

## YAML

JSON is the canonical form of an OPF document. A `.opf.yaml` file is an authoring serialization of the same data: JSON-compatible YAML 1.2 (one document, no tags or duplicate keys, finite numbers) whose parsed data is the document, and the schema validates that parsed data exactly as it validates JSON; YAML adds no field. A first line `# yaml-language-server: $schema=https://openpresentation.org/schema/opf/v1` gives editors validation and completion. See [`docs/yaml.md`](../docs/yaml.md).

## Stability

The presentation schema `$id` is pinned to `/v1` and the package is pre-stable (0.x): expect breaking changes between minor versions until 1.0, tracked in [`CHANGELOG.md`](../CHANGELOG.md) with migration notes under [`docs/migrations/`](../docs/migrations).
