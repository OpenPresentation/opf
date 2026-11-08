# RR-20 image completion and current compatibility checks

Derived work from fresh main9545016583ccfa151077cda4d51043ac6505a140 normally merged with integration96dde3cd3e6a513eabce936e8cb4fcbb22f1eedb. Worktree C:/opf-work/rr-compat-current; branch codex/rr-20-compat-current; PR base codex/integration-034. The coordinator's original mapped run10158 on787bccd52 remains separate.

## Confirmed editor product regression

The current schema describes a shorthand/nested image as ImagePayload after adding image-local callouts. Editor source-references.js still classified only Asset/LogoSource/ImageSource. Actual describeField(slides.0.image) returns ImagePayload, but referenceSiteAt returned null, losing asset and image-variable completion values. The first mapped editor contract reached source-completions-units and failed at the original asset-reference assertion;36 later files were unreached. A new schema-derived resource-wrapper guard also fails before the fix.

Add only ImagePayload to the existing single asset-reference rule. The new guard discovers string asset examples plus object src forms from the actual schema, independent of prose/definition names. Actual JSON/YAML/Markdown completion controls cover shorthand/nested object src images, real asset and image variables, exclusion of text variables, ordinary callout/alt text, and existing no-resource/non-image controls. The affected completion file passes after the one-entry product fix. No schema, image representation, authored callouts or completion architecture changes.

## Three original compatibility failures

All original failures reproduce unchanged under absolute Node24.20.0: renderer120 versus108 alignment cases, native Arabic4 versus0 labels, editor source fixture at layouts-yaml. These original three are stale expectations.

- Renderer: retain every deep composition/traced-SVG assertion, replacing the stale36-layout count with exact current catalog ID × left/center/right coverage. Actual40 layouts/120 cases pass, with1385 region items and11231 contained elements over241 paginated pages. No geometry or tolerance change.
- PPTX: require exact English/Arabic labels, agreement with core, Arabic native RTL, the original progress shape and exact authored event/quote round trips, with both unmeasured and prepared-font passes. Actual Arabic labels are مكتمل / مكتمل / حالي / مخطط, never English substitutions. After removing the obsolete zero-label assertion, the first mapped run exposes another fixture error: loadFonts() loads only base fonts and does not prepare Arabic generated text. The documented per-document fonts.ensure(timelineDeck,{renderOptions:{catalogs}}) plus empty-pending assertion resolves it; no scripts-all request or product font policy change.
- Editor source fixture: only three existing cases differ. Two unknown-layout suggestion outputs correctly add org-chart; Markdown unknown-option help adds supported slide language. All26 parsed decks, source locations, syntax findings and unrelated fields are unchanged. Independent controls resolve all40 current layouts in YAML/Markdown, check actual org-chart identity and custom/absent-catalog isolation, and verify the current library really parses language=ar and advertises language in unknown-option help.

The structured source-read-text.golden.json is a parser unit fixture, outside packages/render/test/golden. No generator previously existed (repository search found only its consumer). Run packages/editor/test/support/generate-source-read-text-fixture.mjs with --write after building, and --check to verify without writes. The before --check failure, exact33-leaf/3-case delta and missing/invalid-mode refusals are retained; refusal controls leave the fixture unchanged. Nothing was hand edited.

## Vetoable decisions and validation

1. Fix the real image-completion regression by recognizing its authoritative schema wrapper in the existing rule, retaining strict schema and completion assertions.
2. Preserve current localized status behavior and catalog additions; strengthen stale checks instead of deleting valid output.
3. Prepare caller-owned fonts per document using the existing ensure API; keep the unmeasured/base-font passes and exact native semantics, with no font-policy workaround.
4. Refresh only reviewed structured parser output with an explicit generator. No renderer golden is regenerated.
5. The required mapped check targets exact integration96dde3 for this derived PR, as approved by the coordinator, avoiding duplicate inherited full integration suites. It does not establish default-main/full-candidate/release/native/site green.

First frozen QA head fecf5f996cbac53a8b6eddc905cc1bac0b53b267 mapped run:272.2seconds,11passes,2failures and1correct JS-only typecheck skip. The new font fixture and actual editor regression are preserved, including36 unreached editor files. Both focused corrections now pass. A new source-frozen mapped run follows. Missing sparse historical inputs were restored from exact Git blobs only (lossless sparse-inputs.json.gz); no tracker or lock regeneration. Raw logs are lossless gzip files, preserving original bytes across Git line-ending conversion.

Only editor/src/source-references.js changes product behavior, adding one definition in one rule. Core/render/PPTX/other editor production code, catalog records, schema, charts, titles, examples, locks, workflows and render goldens remain inherited unchanged. No Office, provider, release, deployment or CI observer action. The coordinator owns full integration, hosted CI, release and final native/site acceptance.

## Final source qualification and handback

Corrected source frozen at e0ead77245f4c00636fed22e6ed868ad3be5ecb0. The second required mapped run takes323.7seconds:12passes,1failure and1correct JS-only typecheck skip. The three assigned original checks and the actual image-completion regression pass. It reaches editor module130/145, where studio-tracks exposes an independent existing no-jump bug: centered rows have leading130.98px, but drawnTracks assigns all slack to the final row and ignores offsets; an at-rest divider jumps0.482 to0.300. No assertion or layout is changed to hide it. All15 remaining editor contract files were then selected with maintained selectTests/nodeArgs and pass independently, without rebuilding or repeating earlier modules. The mapped run itself remains red.

The [receipt](compat-current-data/receipt.json) binds seven tested source files, eleven unchanged protected Git trees and every lossless raw log, including both failed mapped runs, generator refusals, fixture delta and actual studio geometry. The only production delta is one asset-reference definition. The coordinator assigned the studio regression to a new separate branch after this PR freezes; never push this QA source again after folding. Final combined default-main/full CI, native, release and sites remain coordinator work; this packet claims none of those green.
