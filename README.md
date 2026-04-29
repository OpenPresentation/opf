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

And they don't start from a blank canvas. [pptx.gallery](https://pptx.gallery) is the human-browsable reference for OPF catalog presets: layouts, themes, color schemes, font schemes, chart presets, narratives, tones, audiences, languages, and social platforms.

## JavaScript and TypeScript

The canonical JavaScript/TypeScript package is being developed at [`packages/javascript`](./packages/javascript) as `@dataadvantage/opf`.

It is currently marked `private: true` while the schema stabilizes. Its responsibility is local and format-level only:

- export the canonical schemas from [`spec/`](./spec)
- export bundled catalog records from [`spec/`](./spec)
- generate TypeScript types, with `Presentation` as the top-level type
- validate OPF JSON and catalog records locally

It does not render `.pptx`, parse `.pptx`, generate content with AI, fetch remote catalogs, or call PPTX.dev.

### Expected Usage

Install dependencies and build the local package:

```sh
pnpm install
pnpm build
```

Use the format package from JavaScript or TypeScript:

```ts
import {
  presentation,
  audiences,
  tones,
  validatePresentation,
} from "@dataadvantage/opf";

import type { Presentation } from "@dataadvantage/opf";

const deck: Presentation = {
  $schema: "https://pptx.dev/schema/opf/v1",
  meta: { title: "Quarterly Review" },
  design: {},
  slides: [{ id: "title", layout: "title-left", elements: [] }],
};

const result = validatePresentation(deck);
console.log(result.valid);
console.log(audiences.length, tones.length);
```

Use focused imports when you only need one surface:

```ts
import { presentation } from "@dataadvantage/opf/schemas";
import { audiences } from "@dataadvantage/opf/catalogs";
import { validate } from "@dataadvantage/opf/validator";
import type { Presentation } from "@dataadvantage/opf/types";
```

Use raw JSON when an engine or resolver needs package-addressable files:

```ts
import presentationSchema from "@dataadvantage/opf/spec/presentation.schema.json" with {
  type: "json",
};
```

Use the private local CLI source during development:

```sh
pnpm --filter @dataadvantage/opf-cli build
node packages/cli/dist/index.js schemas
node packages/cli/dist/index.js catalogs
node packages/cli/dist/index.js validate path/to/deck.opf.json
```

## Layout

| Path | Contents |
|---|---|
| [`spec/presentation.schema.json`](./spec/presentation.schema.json) | Canonical JSON Schema for top-level OPF `Presentation` documents. |
| [`spec/*.schema.json`](./spec) | Companion schemas for catalog records and sub-objects. |
| [`spec/<catalog-kind>/`](./spec) | Canonical bundled catalog records. |
| [`packages/javascript/`](./packages/javascript) | Private pre-release source for `@dataadvantage/opf`. |
| [`packages/cli/`](./packages/cli) | Private local-only OPF CLI source; native distribution is deferred. |
| [`spec/openapi.yaml`](./spec/openapi.yaml) | Legacy PPTX.dev OpenAPI spec, pending migration to PPTX.dev ownership. |
| [`legacy/typescript/`](./legacy/typescript) | Legacy PPTX.dev TypeScript client, pending review/migration. |
| [`legacy/python/`](./legacy/python) | Legacy PPTX.dev Python client, pending review/migration. |
| [`legacy/go/`](./legacy/go) | Legacy PPTX.dev Go client, pending review/migration. |
| [`legacy/cli/`](./legacy/cli) | Legacy PPTX.dev CLI packages, pending review/migration. |
| [`legacy/mcp/`](./legacy/mcp) | PPTX.dev MCP server, pending review/migration to PPTX.dev ownership. |

## Package Boundary

OPF defines the format and bundled presets. PPTX.dev consumes OPF to provide hosted generation, rendering, parsing, storage, authentication, jobs, previews, and AI workflows.

Future non-JavaScript OPF packages should follow the same local-only boundary: Python and Go packages should expose schemas, types/models, catalogs, and validation, not PPTX.dev rendering or generation.

## License

MIT. See [LICENSE](./LICENSE).
