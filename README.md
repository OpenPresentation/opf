# Open Presentation Format (OPF)

Open Presentation Format is the portable, human-readable JSON document format for slide decks.

This repository is the canonical home for the OPF **spec**, **JSON Schemas**, **catalog presets**, generated developer types, and local validation tooling. Anything that renders PowerPoint files, fills presentations with AI, parses `.pptx`, or calls the hosted [pptx.dev](https://pptx.dev) API belongs to PPTX.dev-specific packages, not the core OPF package.

## File naming

Open Presentation Format documents are JSON files. Use `*.opf.json` for complete OPF presentation documents, for example `board-review.opf.json` or `deck.opf.json`.

Avoid using bare `*.opf` for OPF JSON. The `.opf` extension is already used by other document and project formats, while `.opf.json` keeps the OPF identity and still makes the underlying JSON format clear to editors, validators, agents, and version-control tooling.

## Naming and reuse

The format name is **Open Presentation Format**. The schemas, catalogs, packages, and local tooling in this repository are free and open source under the MIT license, so third-party tools may read, write, validate, and describe support for Open Presentation Format without using PPTX.dev branding.

## Why OPF

`.pptx` is a zipped bundle of XML. Humans can't diff it, LLMs can't read or write it reliably, and git can't track it meaningfully. Every change looks like a binary blob.

OPF is plain JSON. A human can open it in an editor. A model can read and write it without guessing at schema-by-example. Decks live in git like the rest of your work.

That's the shift that lets LLMs actually *author* decks. When the format stops fighting them, models can do the work that matters — narrative structure, persuasive framing, data analysis, chart recommendations, ruthless revision passes — instead of wrestling with `<p:sp>` tags.

And they don't start from a blank canvas. [pptx.gallery](https://pptx.gallery) is the human-browsable reference for OPF catalog presets: layouts, themes, color schemes, font schemes, chart types, narratives, audiences, purposes, tones, languages, and social platforms.

## JavaScript and TypeScript

The canonical JavaScript/TypeScript package is published at [`packages/javascript`](./packages/javascript) as [`@openpresentation/opf`](https://www.npmjs.com/package/@openpresentation/opf). The schema is pre-stable (0.x — expect breaking changes between minor versions until 1.0). Its responsibility is local and format-level only:

- export the canonical schemas from [`spec/`](./spec)
- export bundled catalog records from [`spec/`](./spec)
- generate TypeScript types, with `Presentation` as the top-level type
- validate OPF JSON and catalog records locally

It does not render `.pptx`, parse `.pptx`, generate content with AI, fetch remote catalogs, or call PPTX.dev.

### Expected Usage

Install from npm:

```sh
pnpm add @openpresentation/opf
# or: npm install @openpresentation/opf
```

To work on the package itself, clone this repo and build the workspace:

```sh
pnpm install
pnpm build
```

Use the format package from JavaScript or TypeScript:

```ts
import {
  presentation,
  audiences,
  purposes,
  tones,
  validatePresentation,
} from "@openpresentation/opf";

import type { Presentation } from "@openpresentation/opf";

const deck: Presentation = {
  name: "Quarterly Review",
  slides: [{ title: "Quarterly Review", items: ["Revenue", "Product", "Hiring"] }],
};

const result = validatePresentation(deck);
console.log(result.valid);
console.log(audiences.length, purposes.length, tones.length);
```

Use focused imports when you only need one surface:

```ts
import { presentation } from "@openpresentation/opf/schemas";
import { audiences, purposes } from "@openpresentation/opf/catalogs";
import { validate } from "@openpresentation/opf/validator";
import type { Presentation } from "@openpresentation/opf/types";
```

Use raw JSON when an engine or resolver needs package-addressable files:

```ts
import presentationSchema from "@openpresentation/opf/spec/schemas/opf.schema.json" with {
  type: "json",
};
```

Use the local-only CLI source during development:

```sh
pnpm --filter @openpresentation/cli build
node packages/cli/dist/index.js schemas
node packages/cli/dist/index.js catalogs
node packages/cli/dist/index.js validate path/to/deck.opf.json
```

## Layout

| Path | Contents |
|---|---|
| [`spec/schemas/opf.schema.json`](./spec/schemas/opf.schema.json) | Canonical JSON Schema for top-level OPF `Presentation` documents. |
| [`docs/schema-reference.md`](./docs/schema-reference.md) | Author-facing reference for top-level OPF fields and every presentation schema `$defs` object/type. |
| [`docs/catalog-schema-reference.md`](./docs/catalog-schema-reference.md) | Author-facing reference for every companion catalog schema. |
| [`docs/content-payloads.md`](./docs/content-payloads.md) | Author-facing notes for slide and region content payloads, including chart and table object shapes. |
| [`docs/examples.md`](./docs/examples.md) | Guide to the expanded scenario-oriented examples under `examples/gallery/`. |
| [`spec/schemas/*.schema.json`](./spec/schemas) | Companion schemas for catalog records and sub-objects. |
| [`spec/catalogs/<catalog-kind>/`](./spec/catalogs) | Canonical bundled catalog records. |
| [`examples/technical/`](./examples/technical) | Focused OPF fixtures for validator, renderer, catalog-resolution, design, content-payload, and region behavior. |
| [`examples/gallery/`](./examples/gallery) | Broader OPF example decks organized by industry, function, education, government, presentation type, international, and design/media scenarios. |
| [`packages/javascript/`](./packages/javascript) | Public pre-stable source for `@openpresentation/opf`. |
| [`packages/cli/`](./packages/cli) | Local-only OPF CLI source; native distribution is deferred. |
| [`spec/openapi.yaml`](./spec/openapi.yaml) | Legacy PPTX.dev OpenAPI spec retained temporarily for service reference. |
| [`legacy/`](./legacy) | Tombstone for PPTX.dev clients, CLIs, SDKs, and MCP source migrated to PPTX.dev-owned repositories. |

## Package Boundary

OPF defines the format and bundled presets. PPTX.dev consumes OPF to provide hosted generation, rendering, parsing, storage, authentication, jobs, previews, and AI workflows.

Future non-JavaScript OPF packages should follow the same local-only boundary: Python and Go packages should expose schemas, types/models, catalogs, and validation, not PPTX.dev rendering or generation.

The published JavaScript package copies package-addressable OPF schemas, catalogs, and reference assets from `spec/`. It does not include the legacy PPTX.dev OpenAPI service spec.

## License

MIT. See [LICENSE](./LICENSE).
