# Product Strategy: OPF — Open Presentation Format

## Position in the OpenPresentation ecosystem

**Open-source primitives (MIT).** OPF is the foundation of the OpenPresentation project.

```
OpenPresentation OSS:
  OPF spec, schemas, catalogs, examples, validation, and local CLI
  opf-render / opf-editor / opf-pptx

Downstream applications:
  Hosted services, agent workflows, custom editors, internal tools,
  and self-hosted systems built by integrators
```

OpenPresentation publishes open-source code and documentation only. It does **not** provide hosted APIs, hosted rendering functions, queues, storage, authentication, jobs, previews, SLAs, telemetry, or managed infrastructure. Downstream applications can wrap the OSS primitives in their own products and services.

- **Role in OpenPresentation OSS:** OPF is the interchange format. It defines the JSON contract between authoring intent and rendered presentations so agents, editors, validators, renderers, and converters can interoperate.
- **Siblings in OpenPresentation OSS:** [pptx.gallery](https://www.pptx.gallery) provides the human-browsable shared vocabulary. The canonical package source for machine consumers lives in this repo under `spec/` and `@openpresentation/opf`.
- **Relationship to downstream applications:** Integrators can use OPF and the toolkit to build hosted services, chatbot or agent workflows, custom editors, internal automation, and self-hosted systems without depending on OpenPresentation-hosted functions.
- **Relationship to hosted services:** Hosted services are downstream products. They may consume OPF, run the renderer or converters, store files, manage users, or provide workflow UX, but those service layers are outside the OpenPresentation OSS boundary.

## Vision

**The portable, LLM-native document format for slide decks.** `.pptx` is a zipped XML bundle that humans can't diff, LLMs can't reliably write, and git can't track. OPF is plain JSON — a real document format that models can *author*, not just decorate. Every agent, IDE, chat surface, or shell can read and write OPF, then render or convert it locally with OSS tooling or hand it to downstream applications.

## Target Users

1. **AI agent developers** building tools that generate or edit presentations programmatically (Claude Code, Cursor, Codex, LangChain, LlamaIndex, custom agents).
2. **Developers** embedding presentation workflows in SaaS, notebooks, CI/CD, internal systems, or content pipelines.
3. **Application builders** who want durable, versionable deck artifacts without shipping their own presentation schema.

## Positioning

"A JSON document format for slide decks — write it by hand, generate it with an agent, validate it locally, and render or convert it with open tooling." OPF is the shared format; OpenPresentation provides open specs and libraries; integrators build the products around them.

## Distribution surfaces

One format, every runtime:

| Surface | Package | Audience |
|---|---|---|
| OPF JSON documents | `*.opf.json` | Portable, versionable deck files for humans, agents, and validators |
| JSON Schema | `https://openpresentation.org/schema/opf/v1` | Any JSON Schema validator, editor, or agent |
| JavaScript/TypeScript OPF package | `@openpresentation/opf` (public npm package, pre-stable 0.x) | Schemas, catalogs, types, local validation |
| Local OPF CLI | `opf` (local workspace source; distribution deferred) | Validate, format, and inspect OPF locally |
| Future render toolkit | `opf-render` | Local and embeddable SVG, PNG, and PDF rendering |
| Future editor toolkit | `opf-editor` | Headless bindings and optional embeddable editor components |
| Future PPTX toolkit | `opf-pptx` | Local OPF-to-PPTX export and PPTX-to-OPF import |
| Future Python OPF package | TBD | Local models, schemas, catalogs, validation |
| Future Go OPF module | TBD | Local structs, embedded schemas/catalogs, validation |

Hosted-service clients, managed workflows, and product-specific SDKs should live outside the core OPF repo. They consume OPF and the toolkit as downstream integrators; they are not the canonical OpenPresentation package direction.

## Monetization

**None in OpenPresentation OSS.** OPF, the JSON schema, the SDKs, the CLIs, the MCP server, and the open-source render/edit/convert toolkit (`opf-render`, `opf-editor`, `opf-pptx`) are MIT-licensed public goods. The project optimizes for adoption, interoperability, local execution, and embeddable primitives. Downstream vendors may build hosted or managed products separately; OpenPresentation does not ship those hosted layers.

## Current Priorities

1. **v1 spec freeze** — finalize the OPF JSON Schema, OpenAPI contract, and TS/Python/Go type surfaces so downstream packages can ship stable releases.
2. **Canonical OPF packages** — JavaScript first, then Python and Go local-only packages for schemas, catalogs, types/models, and validation.
3. **Local OPF CLI** — validate, format, and inspect OPF without calling a hosted service.
4. **Render/edit/convert toolkit** — ship MIT local libraries for SVG/PNG/PDF rendering, embeddable editing, and PPTX import/export.
5. **Gallery integration** — OPF documents reference catalog items by slug; packages expose the canonical bundled catalogs while pptx.gallery remains the browsable reference.
6. **Ecosystem adoption** — make OPF the default deck format for agents, editors, self-hosters, and downstream applications.

## Key Decisions

- **MIT license, always.** The format and client tools must stay open so every AI tool and application can produce OPF. Format lock-in is not the goal — ecosystem adoption is.
- **Open Presentation Format is the public name.** `OPF` is shorthand, and `*.opf.json` is the recommended filename pattern for complete JSON deck documents.
- **OpenPresentation owns OSS primitives only.** This repo owns the OPF spec, schemas, catalogs, examples, local validation packages, and local tooling. The render/edit/convert toolkit lives in separate MIT repos and depends on this format package.
- **No OpenPresentation-hosted runtime.** OpenPresentation libraries must run without required network calls, hosted callbacks, hidden telemetry, or managed infrastructure assumptions.
- **Downstream applications own product surfaces.** Auth, storage, collaboration, queues, jobs, previews, billing, analytics, support, and workflow UX belong to integrators building on the OSS primitives.
- **Stable integration seams matter.** Packages should expose predictable APIs, structured errors, package-addressable assets, custom catalog/font/theme/asset hooks, and documented semver compatibility with `@openpresentation/opf`.

## What OPF models

OPF v1 captures the dimensions a real presentation needs:

- **Narrative arc** — Minto pyramid, situation-complication-question-answer, problem-solution-impact, timeline, comparison
- **Information density** — executive summary vs. data appendix vs. discussion slide
- **Visual hierarchy** — headline, support, citation
- **Brand system** — colors, fonts, logo, master slides, footers, templates
- **Layout intent** — title, two-column, image-left, full-bleed, chart-with-callout, quote
- **Chart semantics** — what data, what comparison, where the eye lands
- **Speaker notes** — separate from the slide
- **Accessibility** — alt text, reading order, contrast
- **Audience register** — board deck vs. internal review vs. sales pitch

v2 adds animations, builds, transitions. Gallery names cover the high-level choices so the LLM picks from a curated set instead of freelancing pixel coordinates.
