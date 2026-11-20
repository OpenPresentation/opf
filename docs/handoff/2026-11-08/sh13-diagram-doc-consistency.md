# SH-13: diagram documentation consistency

Base: `ba09f333ede16a9d70e4f685cf5882a1b1ef8bae`, reached from a fresh `origin/main` checkout on `codex/sh-13-diagram-doc-consistency`. Coordinator review and integration remain pending; no PR or CI dispatch is opened by this task.

## Vetoable decision

Correct the authoritative schema's Diagram export and alternative-text descriptions to describe the existing qualified native-group default and SVG/PNG picture path. Correct only the foreign `pyramid3` import table row: its entries retain widest-first order on `default:inverted-pyramid` with `smartart-adapted`. OPF-owned provenance is a separate roundtrip path. Inverted-pyramid export remains editable native shapes with `smartart-unavailable`, outside every qualified live SmartArt domain.

This is a documentation correction. It changes no validation keywords, non-description schema data, Chart definition, implementation, example, generated site schema, golden, Office qualification or release. Matching site schema updates belong to the published 0.34 bump.

## Acceptance evidence

Existing native-diagram tests cover group alternative text, picture fallback and source-bearing roundtrips. SH-08 covers foreign inverted-pyramid order, downward layout and adaptation diagnostics. SH-24 covers native-shape export, the live SmartArt refusal and OPF-owned layout restoration.

- Toolchain: Node `24.20.0`, pnpm `10.33.2`; locked install used the shared store. The maintained restoration helper restored 4,356 exact tracked sparse evidence inputs (113,711,152 bytes), with blob and readback verification; no fixtures were fabricated.
- `sh-07-native-diagrams.mjs`: PASS, eight groups of checks (1.3 s), including native group alt text, picture fallback with diagnostics and provenance roundtrip.
- `diagram.mjs`: PASS, seven groups of checks (2.1 s), including picture alt, rasterizer fallback and tagged roundtrip.
- `sh-08-smartart-import.mjs`: PASS (1.1 s), including the existing 17-layout PowerPoint-authored fixture, `pyramid3` widest-first entries on `default:inverted-pyramid` and `smartart-adapted`. No Office application was started.
- `sh24-inverted-pyramid.mjs`: PASS (0.9 s), including editable shapes, no live diagram parts, explicit refusal diagnostic and OPF-owned layout roundtrip. All four test files ran sequentially through `node scripts/agent-slot.mjs`.
- Initial `pnpm check:changed --base ba09f333ede16a9d70e4f685cf5882a1b1ef8bae`: 134.7 s; only `check:schema-docs` failed because its generated core reference required regeneration. Every other selected check passed; typecheck was correctly skipped. The coordinator authorized the required `node scripts/generate-schema-docs.mjs` follow-up. Its only changed file is `docs/schema-reference.md`, with exactly the two Diagram prose lines; generated site schemas remain untouched.

## Structural proof against the base

A recursive JSON comparison asserts the only changed schema values are `/$defs/Diagram/description` and `/$defs/Diagram/properties/alt/description`. It also deep-compares every non-description schema value and the entire Chart definition. SHA-256 values use UTF-8 `JSON.stringify` serialization:

- All non-description schema data: `cfe921b87bc024ed4e427647f9f859cd497f281582a14c0e9f92746fe7512d53` (identical).
- Entire Chart definition: `5a760f3b5b53489ea292e949a81521bfc8c4d13fedf1c8019eb0a73f1d98f147` (identical).

The generated reference is byte-identical outside its Diagram section, with precisely two replaced lines inside it. Its complete Chart section is byte-identical (SHA-256 `97233c6b556a75755bb10e05f27b508abf5c885329e175b4a223862357e1d587`). The source Diagram description is short enough to appear in full under the generator's 500-character limit.

Completed-scope `pnpm check:changed --base ba09f333ede16a9d70e4f685cf5882a1b1ef8bae`: PASS (124.7 s). Build, Biome, changes, examples, example conversion, registry golden, schema docs/examples/strict, skill commands, spec, stability and text all passed. Typecheck was correctly skipped because no TypeScript or tsconfig changed. The four focused semantic passes above remain applicable: the follow-up changed only the two generated Diagram prose lines and handoff evidence. Final handoff text and schema-docs checks pass before freezing. The coordinator receives the frozen commit for review, publication and integration; this task opens no PR and dispatches no CI.
