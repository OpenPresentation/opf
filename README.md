# Open Presentation Format (OPF)

[![npm version](https://img.shields.io/npm/v/@openpresentation/opf?label=npm)](https://www.npmjs.com/package/@openpresentation/opf)
[![npm downloads](https://img.shields.io/npm/dw/@openpresentation/opf)](https://www.npmjs.com/package/@openpresentation/opf)
[![license](https://img.shields.io/npm/l/@openpresentation/opf)](./LICENSE)

Public npm package: [`@openpresentation/opf`](https://www.npmjs.com/package/@openpresentation/opf) (`npm install @openpresentation/opf`).

Open Presentation Format is the portable, human-readable JSON document format for slide decks.

This repository is the canonical home for the OPF **spec**, **JSON Schemas**, **catalog presets**, examples, generated developer types, local validation tooling, and planning docs for the future render/edit/convert toolkit. OpenPresentation publishes open-source code and documentation only; it does not provide hosted APIs, hosted rendering functions, queues, storage, authentication, jobs, previews, SLAs, telemetry, or managed infrastructure.

For AI agents, use the [OPF skill set](docs/agent-skills.md) for authoring, layout, presets, editing, export, and schema inspection.

CLI 0.5.0 installs all six skills into your project with `npx @openpresentation/cli@latest skills install`. It uses local copies, preserves existing instructions and refuses to overwrite customized skills. See the [installation and update guide](docs/agent-skills.md) for personal or agent-specific targets and pre-release testing.

For LLM authoring, start with [the authoring guide](docs/llm-authoring.md), [dynamic composition](docs/dynamic-composition.md), and [local ecosystem verification](docs/ecosystem-development.md).

## File naming

Open Presentation Format documents are JSON files. Use `*.opf.json` for complete OPF presentation documents, for example `board-review.opf.json` or `deck.opf.json`.

Avoid using bare `*.opf` for OPF JSON. The `.opf` extension is already used by other document and project formats, while `.opf.json` keeps the OPF identity and still makes the underlying JSON format clear to editors, validators, agents, and version-control tooling.

## Naming and reuse

The format name is **Open Presentation Format**. The schemas, catalogs, packages, and local tooling in this repository are free and open source under the MIT license, so third-party tools may read, write, validate, render, convert, and describe support for Open Presentation Format without adopting any product-specific branding.

## Why OPF

`.pptx` is a zipped bundle of XML. Humans can't diff it, LLMs can't read or write it reliably, and git can't track it meaningfully. Every change looks like a binary blob.

OPF is plain JSON. A human can open it in an editor. A model can read and write it without guessing at schema-by-example. Decks live in git like the rest of your work.

That's the shift that lets LLMs actually *author* decks. When the format stops fighting them, models can do the work that matters — narrative structure, persuasive framing, data analysis, chart recommendations, ruthless revision passes — instead of wrestling with `<p:sp>` tags.

And they don't start from a blank canvas. [pptx.gallery](https://pptx.gallery) is the human-browsable reference for OPF catalog presets: layouts, themes, color schemes, font schemes, chart types, narratives, audiences, purposes, tones, languages, and social platforms.

## Start in three steps

1. **Install the format package.** `npm install @openpresentation/opf`.
2. **Author and validate a deck.** Write a `*.opf.json` file — start from [`docs/how-opf-works.md`](./docs/how-opf-works.md) or copy [`examples/technical/full-feature-tour.opf.json`](./examples/technical/full-feature-tour.opf.json) — and run `validatePresentation` on it.
3. **Build on it.** Browse presets at [pptx.gallery](https://pptx.gallery), pin the schemas in your pipeline, and track the [toolkit libraries](#toolkit-libraries) for the render and convert libraries.

Your deck lives in git from the first commit. Nothing in these steps calls a hosted service, and nothing ever will — that boundary is the point.

## JavaScript and TypeScript

The canonical JavaScript/TypeScript package is published at [`packages/javascript`](./packages/javascript) as [`@openpresentation/opf`](https://www.npmjs.com/package/@openpresentation/opf). The schema is pre-stable (0.x — expect breaking changes between minor versions until 1.0). Its responsibility is local and format-level only:

- export the canonical schemas from [`spec/`](./spec)
- export bundled catalog records from [`spec/`](./spec)
- export a typed raw spec file manifest for package-addressable `spec/` content
- generate TypeScript types, with `Presentation` as the top-level type
- validate OPF JSON and catalog records locally

It does not render `.pptx`, parse `.pptx`, generate content with AI, fetch remote catalogs, call hosted APIs, or provide managed services. Render/edit/convert packages live in separate MIT repos that depend on `@openpresentation/opf`. The format package also exposes pure composition geometry so those packages share layout behavior.

## Toolkit libraries

The local toolkit lives in sibling repositories. See [ecosystem development](docs/ecosystem-development.md) for coordinated builds and verification, and [dynamic composition](docs/dynamic-composition.md) for portable layout rules.

| Repo | Role | Boundary |
|---|---|---|
| `opf-render` | OPF to SVG/PNG/PDF | Local and embeddable rendering library |
| `opf-editor` | WYSIWYG bindings/components | Headless editor primitives plus optional UI components |
| `opf-pptx` | OPF to PPTX and PPTX to OPF | Pure local import/export library for browser and server use where supported |

These repos provide OSS primitives only. Downstream applications own hosting, auth, storage, collaboration, queues, previews, analytics, support, and workflow UX.

## Usage

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
console.log(result.valid); // schema correctness
console.log(result.warnings); // advisory issues, e.g. unknown catalog ids
console.log(audiences.length, purposes.length, tones.length);
```

Use focused imports when you only need one surface:

```ts
import { presentation } from "@openpresentation/opf/schemas";
import { audiences, purposes } from "@openpresentation/opf/catalogs";
import { specFileEntries } from "@openpresentation/opf/spec-files";
import { validate } from "@openpresentation/opf/validator";
import type { Presentation } from "@openpresentation/opf/types";
```

Use raw JSON when an engine or resolver needs package-addressable files:

```ts
import presentationSchema from "@openpresentation/opf/spec/schemas/opf.schema.json" with {
  type: "json",
};
```

Use the [installable OPF CLI](./packages/cli/README.md) to create, validate, and edit files locally:

```sh
pnpm --filter @openpresentation/cli build
node packages/cli/dist/index.js create deck.opf.json --title "Decision brief"
node packages/cli/dist/index.js validate deck.opf.json
node packages/cli/dist/index.js edit deck.opf.json --patch changes.json --in-place
```

See [CSV and JSON data import](./docs/data-import.md) for editable tables and charts in the editor, CLI, and package API.

## Layout

| Path | Contents |
|---|---|
| [`spec/schemas/opf.schema.json`](./spec/schemas/opf.schema.json) | Canonical JSON Schema for top-level OPF `Presentation` documents. |
| [`docs/how-opf-works.md`](./docs/how-opf-works.md) | Conceptual introduction: the document model, content shapes, catalog resolution, and the validation philosophy. Start here. |
| [`docs/design-resolution.md`](./docs/design-resolution.md) | The design precedence algorithm (slide design → deck design → resolved theme → engine defaults) with worked examples. |
| [`docs/schema-reference.md`](./docs/schema-reference.md) | Author-facing reference for top-level OPF fields and every presentation schema `$defs` object/type. |
| [`docs/catalog-schema-reference.md`](./docs/catalog-schema-reference.md) | Author-facing reference for every companion catalog schema. |
| [`docs/content-payloads.md`](./docs/content-payloads.md) | Author-facing notes for slide and region content payloads, including chart and table object shapes. |
| [`docs/examples.md`](./docs/examples.md) | Guide to the expanded scenario-oriented examples under `examples/gallery/`. |
| [`docs/live-editor.md`](./docs/live-editor.md) | Browser canvas, live OPF editing, font loading, installable preview packages, and current fidelity limits. |
| [`docs/release-process.md`](./docs/release-process.md) | Maintainer runbook for tagging, trusted npm publishing, verification, and GitHub release notes. |
| [`spec/schemas/*.schema.json`](./spec/schemas) | Companion schemas for catalog records and sub-objects. |
| [`spec/catalogs/<catalog-kind>/`](./spec/catalogs) | Canonical bundled catalog records. |
| [`spec/openapi.yaml`](./spec/openapi.yaml) | Optional reference OpenAPI contract for downstream services that choose to expose OPF over HTTP. OpenPresentation does not host this API. |
| [`examples/technical/`](./examples/technical) | Focused OPF fixtures for validator, renderer, catalog-resolution, design, content-payload, and region behavior. |
| [`examples/gallery/`](./examples/gallery) | Broader OPF example decks organized by industry, function, education, government, presentation type, international, and design/media scenarios. |
| [`packages/javascript/`](./packages/javascript) | Public pre-stable source for `@openpresentation/opf`. |
| [`packages/cli/`](./packages/cli) | Installable local CLI for creating, validating, editing, and inspecting OPF. |
| [`legacy/`](./legacy) | Tombstone for service-specific clients, CLIs, tool integrations, and workflows removed from the OpenPresentation OSS repo. |

## OpenPresentation Boundary

OpenPresentation defines the format, bundled presets, local validation, examples, docs, and planned local render/edit/convert libraries. It does not provide hosted functions or managed product surfaces.

Future non-JavaScript OPF packages should follow the same local-first boundary: Python and Go packages should expose schemas, types/models, catalogs, validation, and package-addressable assets. Future toolkit packages should expose embeddable library APIs with no required network calls, hosted callbacks, hidden telemetry, or managed infrastructure assumptions.

The published JavaScript package copies package-addressable OPF schemas, catalogs, reference assets, and the optional reference `spec/openapi.yaml` from `spec/`. It intentionally remains `@openpresentation/opf` instead of introducing a separate `@openpresentation/opf-spec` package so downstream imports can advance by semver-pinning one canonical package.

## License

MIT. See [LICENSE](./LICENSE).
