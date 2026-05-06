# Product Strategy: OPF — Open Presentation Format

## Tier in the presentation stack

**Tier 1 — open-source primitive (MIT).** OPF is the foundation of the Open Presentation / PPTX.dev presentation stack.

```
Top:    STORYD2 (+ DeckChat)        — commercial consumer wrappers (Tier 3)
Middle: pptx.dev                    — hosted engine / metered pay-per-use API (Tier 2)
Bottom: OPF + pptx.gallery + SDKs   — open-source primitives, MIT (Tier 1)  ← you are here
```

- **Role in Tier 1:** OPF is the interchange format. It defines the JSON contract between LLM intent and rendered presentations so every agent in the ecosystem — ours or a third party's — can produce interoperable deck documents.
- **Siblings in Tier 1:** [pptx.gallery](https://www.pptx.gallery) provides the human-browsable shared vocabulary. The canonical package source for machine consumers lives in this repo under `spec/` and `@openpresentation/opf`.
- **Relationship to Tier 2 (pptx.dev):** OPF documents flow into `https://api.pptx.dev/v1` for rendering, parsing, generation, and export. The hosted engine is the paid surface. Core OPF packages do not call that API.
- **Relationship to Tier 3 (STORYD2, DeckChat):** Commercial wrappers produce OPF and hand it to pptx.dev. Keeping OPF MIT makes STORYD2 and DeckChat *more* valuable, not less — the format is open so every AI tool standardizes on it, and the consumer products compete on UX and agent strategy.

## Vision

**The portable, LLM-native document format for slide decks.** `.pptx` is a zipped XML bundle that humans can't diff, LLMs can't reliably write, and git can't track. OPF is plain JSON — a real document format that models can *author*, not just decorate. Every agent, IDE, chat surface, or shell can read and write OPF, and one hosted engine (pptx.dev) renders it to `.pptx`, PDF, SVG, or PNG.

## Target Users

1. **AI agent developers** building tools that generate or edit presentations programmatically (Claude Code, Cursor, Codex, LangChain, LlamaIndex, custom agents).
2. **Developers** embedding presentation workflows in SaaS, notebooks, CI/CD, or content pipelines.
3. **LLM application vendors** who want their product to emit durable, versionable deck artifacts without shipping their own OOXML generator.

## Positioning

"A JSON document format for slide decks — write it by hand, generate it with an agent, render it with one API call." OPF is the shared format; pptx.dev is the shared engine; gallery is the shared vocabulary.

## Distribution surfaces

One format, every runtime:

| Surface | Package | Audience |
|---|---|---|
| OPF JSON documents | `*.opf.json` | Portable, versionable deck files for humans, agents, and validators |
| JSON Schema | `https://openpresentation.org/schema/opf/v1` | Any JSON Schema validator, editor, or agent |
| JavaScript/TypeScript OPF package | `@openpresentation/opf` (public npm package, pre-stable 0.x) | Schemas, catalogs, types, local validation |
| Local OPF CLI | `opf` (local workspace source; distribution deferred) | Validate, format, and inspect OPF locally |
| Future Python OPF package | TBD | Local models, schemas, catalogs, validation |
| Future Go OPF module | TBD | Local structs, embedded schemas/catalogs, validation |

PPTX.dev-specific `@pptx/sdk`, `pptx-dev`, `pptx.dev/go`, `@pptx/cli`, and `pptx-mcp` source belongs to PPTX.dev-owned repositories. Those packages consume OPF and handle hosted generation/rendering workflows; they are not the canonical OPF package direction.

## Monetization

**None in Tier 1.** OPF, the JSON schema, the SDKs, the CLIs, and the MCP server are MIT-licensed public goods. Revenue flows to Tier 2 (metered pay-per-use on the hosted engine) and Tier 3 (subscriptions on STORYD2 and DeckChat). The more widely OPF is adopted, the more valuable the Tier-2 engine becomes as the default renderer.

## Current Priorities

1. **v1 spec freeze** — finalize the OPF JSON Schema, OpenAPI contract, and TS/Python/Go type surfaces so downstream SDKs can ship stable releases.
2. **Canonical OPF packages** — JavaScript first, then Python and Go local-only packages for schemas, catalogs, types/models, and validation.
3. **Local OPF CLI** — validate, format, and inspect OPF without calling PPTX.dev.
4. **Gallery integration** — OPF documents reference catalog items by slug; packages expose the canonical bundled catalogs while pptx.gallery remains the browsable reference.
5. **Ecosystem adoption** — inbound partnerships with agent frameworks (Claude Code, Cursor, Codex, LangChain, LlamaIndex) so OPF is the default deck format.

## Key Decisions

- **MIT license, always.** The format and client tools must stay open so every AI tool (including competitors) can produce OPF. Format lock-in is not the moat — ecosystem adoption is.
- **Open Presentation Format is the public name.** `OPF` is shorthand, and `*.opf.json` is the recommended filename pattern for complete JSON deck documents.
- **Spec + local format packages live together, service clients move separately.** This repo owns the OPF spec, schemas, catalogs, and local validation packages. Hosted PPTX.dev clients and MCP tooling should live with the PPTX.dev service.
- **Vanity URLs are stable.** `pptx.dev/go`, `@pptx/*`, `pptx-dev` (PyPI), and `https://openpresentation.org/schema/opf/v1` do not move even as source repos move. Existing users do not need to update import paths.
- **PPTX.dev consumes OPF.** The hosted engine generates, renders, parses, stores, and previews presentations. OPF packages define and validate the data contract locally.

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
