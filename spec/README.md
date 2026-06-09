# spec/

Canonical, package-addressable OPF spec content. Everything in this directory ships inside `@openpresentation/opf` and is importable as `@openpresentation/opf/spec/<path>`.

| Path | Contents |
|---|---|
| [`schemas/opf.schema.json`](./schemas/opf.schema.json) | Canonical JSON Schema for top-level OPF `Presentation` documents (`$id: https://openpresentation.org/schema/opf/v1`). |
| [`schemas/*.schema.json`](./schemas) | Companion schemas for catalog records (audiences, narratives, themes, layouts, chart types, and so on). |
| [`catalogs/<kind>/`](./catalogs) | Bundled catalog records, one JSON file per record plus an `index.json` per kind. These are the same records served from `https://www.pptx.gallery/<kind>`. |
| [`previews/`](./previews) | Preview metadata for catalog records (currently layout previews). |
| [`reference/engine-defaults.json`](./reference/engine-defaults.json) | Reference example of engine-side defaults. Engine configuration, not part of the OPF document contract; it has no JSON Schema. |
| [`openapi.yaml`](./openapi.yaml) | Optional reference OpenAPI 3.1 contract for downstream services that choose to expose OPF operations (validate, parse, convert, generate, render) over HTTP. OpenPresentation does not host this API; implementers can use it as a starting point for their own hosted or internal services. It is a convention for service builders — local format tooling never needs it. |

For the concepts behind these files, start with [`docs/how-opf-works.md`](../docs/how-opf-works.md).
