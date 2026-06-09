# spec/

Canonical, package-addressable OPF spec content. Everything in this directory ships inside `@openpresentation/opf` and is importable as `@openpresentation/opf/spec/<path>`.

New to the format? Read [`docs/how-opf-works.md`](../docs/how-opf-works.md) first — this directory is the machine-readable half of that story.

## Layout

| Path | Contents |
|---|---|
| [`schemas/opf.schema.json`](./schemas/opf.schema.json) | Canonical JSON Schema for top-level OPF `Presentation` documents (`$id: https://openpresentation.org/schema/opf/v1`). |
| [`schemas/*.schema.json`](./schemas) | Companion schemas for catalog records. Each has a stable `$id` of the form `https://openpresentation.org/schema/opf-<kind>/v1` (e.g. `opf-narrative`, `opf-theme`, `opf-chart-type`). |
| [`catalogs/<kind>/`](./catalogs) | Bundled catalog records, one JSON file per record plus an `index.json` per kind. These are the same records served from `https://www.pptx.gallery/<kind>`. |
| [`previews/`](./previews) | Preview metadata for catalog records (currently layout previews). |
| [`reference/engine-defaults.json`](./reference/engine-defaults.json) | Reference example of engine-side defaults. Engine configuration, not part of the OPF document contract; it has no JSON Schema. |
| [`openapi.yaml`](./openapi.yaml) | Optional reference OpenAPI 3.1 contract for downstream services that choose to expose OPF operations (validate, parse, convert, generate, render) over HTTP. OpenPresentation does not host this API; implementers can use it as a starting point for their own hosted or internal services. Local format tooling never needs it. |

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
