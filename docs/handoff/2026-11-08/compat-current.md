# RR-20 current compatibility checks

Derived QA work from fresh main9545016583ccfa151077cda4d51043ac6505a140 normally merged with the coordinator's current integration96dde3cd3e6a513eabce936e8cb4fcbb22f1eedb. Worktree C:/opf-work/rr-compat-current; branch codex/rr-20-compat-current; PR base codex/integration-034. Original coordinator failure run10158 on787bccd52 is retained separately.

## Causes and scope

All three original failures reproduce unchanged under absolute Node24.20.0: renderer120 versus108 alignment cases, native Arabic4 versus0 generated labels, editor source fixture at layouts-yaml. No runtime/product bug is found.

- Renderer: every actual registered layout already passes the deep composition/traced-SVG alignment assertions. Replace the stale36-layout count with exact current gallery ID × left/center/right case coverage; no SVG assertion is relaxed. Current source has40 layouts and120 alignment cases.
- PPTX: approved localized status support generates actual editable Arabic labels مكتمل / مكتمل / حالي / مخطط in event order. The older English-only expectation is stale. Require every exact English/Arabic label, agreement with core, native RTL for Arabic, the existing native progress shape and exact original event/quote round trips, with both default and loaded fonts. No generated status text may become authored content.
- Editor: only three existing fixture cases differ. The two unknown-layout suggestions correctly rank the new org-chart record; unknown-option help correctly adds supported slide language. All other parsed decks, locations, syntax findings and fixture cases are preserved. New independent controls resolve all current layouts in YAML/Markdown, verify the actual org-chart suggestion identity, refuse unregistered-gallery leakage, use a replacement local catalog, and parse/help-check slide language.

The structured source-read-text.golden.json file is a parser unit fixture, outside packages/render/test/golden. No tracked generator previously existed (repository search found only its consumer). Its new explicit generator is packages/editor/test/support/generate-source-read-text-fixture.mjs: after a workspace build, run it with --write to update and --check to verify without writes. The before --check failure and complete generated diff are preserved; no fixture is hand edited.

## Vetoable decisions

1. Preserve product/localization behavior and strengthen stale compatibility checks; do not restore English-only status output or delete valid new catalog records.
2. Derive alignment coverage from the actual catalog, retaining all deep SVG/item assertions.
3. Refresh only the reviewed structured parser output via an explicit generator; preserve every unrelated fixture field. This is not renderer-golden regeneration.
4. Run the required mapped check against exact integration96dde3 for this derived PR, avoiding duplicate inherited whole-workspace suites from the coordinator's10158. Default-main final integration/release/native/site acceptance remains with the coordinator.

Raw before failures and initial build are losslessly gzip-compressed in compat-current-data, preserving original CRLF bytes across Git text normalization. Missing sparse historical JSON/Markdown/text inputs were restored from exact Git blobs only (receipt sparse-inputs.json.gz); no tracker or source generation. No package code, chart, title, schema, example, catalog record, package lock, renderer golden, Office, provider, release or deployment change. No CI observer was started. Focused and frozen-source mapped receipts will be added after execution; no completion of release/native/site acceptance is claimed.
