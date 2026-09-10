# Shared metric integration — source checkpoint

## Current checkpoint: chart visibility and editable workbook headings; native connection failure

Core `a58a9e39a02b1ca13b947dd045bfa9f664c3db57`, renderer `a6c499434b98754597c6cb7e2b8ec744fdecd7fc`, PPTX `7ed519de3daadb49123baf574bab89fd817d411a` and unchanged editor `b30c25c5af426590857f1a84c54b775056fee5ca` are pushed on the integration branch. [Chart evidence](../evidence/chart-colors-workbook/README.md) records inherited panel/label/series contrast handling, actual editable category-heading preservation, 470 core tests per runtime, 40 chart cases per consumer, 37 workbook cases and four real-browser chart workflows. Full PPTX/browser/code/metric checks pass on Node 20/24; full renderer commands retain the unpromoted corpus failure.

The unchanged source corpus has 141 final changed chart rasters, covered by initial and follow-up visual review with both complete 805-image sets hash-verified. Actual browser text findings drop from 962 to 942; placeholders and 28 other content rectangles remain. Series-to-panel contrast does not establish adjacent-series distinction or common palette/geometry semantics. Mid-gray theme resolution still differs between consumers; scatter and arbitrary embedded workbooks are outside heading recovery.

The current native attempt failed at the COM connection with `0x80010001`, before opening the generated fixture. Its runtime-bound fixture and failure are preserved. No user Office file/process was closed. Resume native point colors and actual embedded Excel edit/save/reopen/reimport on both runtimes when PowerPoint accepts automation. Prior native table/metric results remain historical. Complete native/corpus/metric gates and coordinated candidate CI/review before release preparation; published packages and deployments are unchanged.

## Previous checkpoint: native table colors and scoped gallery contrast evidence

Core `c3edf5696c028d5150e77e32d7904060022eb83c`, renderer `a688f619b4617ca229bc910ce5d4dc1548dcf601`, PPTX `eac68e3b675c279f97fae61764e015566c2c1d39` and unchanged editor `b30c25c5af426590857f1a84c54b775056fee5ca` continue the integration branch. [Separate new evidence](../evidence/table-colors-gallery-contrast/README.md) binds the inherited table-color fallback and 96 authored gallery color improvements. Both supported Node runtimes pass 469 core tests, preservation/type checks and full PPTX commands; the renderer golden gate remains nonzero, with subsequent commands passing separately.

Real PowerPoint verifies all 48 original/reopened table cell observations and 624 character-color observations per runtime; native rasters and source PPTX hashes match across runtimes. Explicit overrides and translucent-fill limitations remain intentional. The source guard preserves content/metadata/geometry and verifies both complete 805-PNG sets; 656 current rasters differ and require full visual review. The conservative audit retains 962 findings, including unresolved placeholders and the dark chart's white-panel/near-white-label defect. One metric border false positive is independently resolved by actual browser glyph masks. No baseline is promoted and no package/deployment advances.

Continue chart/background, placeholder and corpus quality fixes alongside the existing native metric tab/raster counterexamples. Clean candidate CI, coordinated source checks and PR review precede releases. The previous metric evidence remains historical and was not rerun for this color-only runtime change.

## Previous checkpoint: native anchors and corpus authoring corrections

Core source `621bc86b6b04f2b33080fbe2565e10e4d3681aec` and PPTX `78993a14f2e79959df3390c370b2d35dadc0d059` are pushed on `codex/shared-metric-integration-20260910`; renderer/editor refs below are unchanged. [New source evidence](../evidence/shared-metric-native-anchor/summary.json) preserves the older reports separately. No package or public deployment has advanced.

Native paragraph alignment now shares the accepted anchor and part width, removing the earlier nine character-bound overruns. Expanded real PowerPoint tests use 48 slides per Node 20.20.2/24.20.0 run, including leading tabs and whitespace-only parts. Each run preserves all 144 original/saved/edited source/type imports and observes no inter-field pixel-mask collision. Runtime and native/SVG raster hashes match across those runtimes. Masks are rendered by temporarily hiding other generated fields, restoring visibility before save. This is a finite raster check, not vector-outline or general native fidelity.

The native gate remains nonzero: eight tab offsets exceed 0.02pt (maximum 0.067383pt), and the right-aligned portrait “Latency” label has ink at x=497 beyond a cell ending at x=496.8. The isolated unit ends at x=496. Every nonblank fixture field produces ink, and all 138 isolated field masks per runtime combine to exactly cover the full-slide ink pixels. Keep the remaining failures visible. The complete PPTX command, syntax/validation, code/metric tests and actual editor metric workflows pass again on both runtimes. Remaining renderer commands after the golden gate have now been run separately and pass; no claim is made that the full command passes.

The 85 changed corpus slides were visually reviewed in nine before/after sheets. Forty fictional example metrics had inconsistent units and deltas that the old renderer hid; their authored data and generator are corrected and explicitly labelled illustrative. All 126 documents validate. `scripts/review-metric-corpus.mjs` verifies the prior registry files and binds separate old/current source digests and per-slide raster hashes, recording only metric payload revisions. The new candidate source digest is `e3c7194f1fc4ee452570d27a24633a9baa413ea1bbfe117668e3434d01686f50`. Contrast failures in pale/gradient templates and compact metric hierarchy remain quality work. The baseline has not been promoted.

PPTX also contains a separate 1,024-case reference-font advance study. A candidate shaping/rounding model fits 949 observations within 0.02pt; 75 outliers remain. Explicit UTF-8 and independent native shapes prevent harness contamination; requested and native font-slot names are recorded, including unresolved theme tokens. This does not certify native font files or open substitutes and changes no runtime font behavior.

Continue with native counterexamples and corpus quality, then reviewed golden promotion, coordinated source/candidate CI, draft PRs and review. Versions, lockfile release preparation, registry verification and deployment adoption follow those gates. Do not republish the current shared-code set.

## Previous checkpoint: consumers implemented; raster gates remain open

Continue `codex/shared-metric-integration-20260910` in all four repositories. No metric package has been versioned or published. The complete published shared-code set, release-plan refs and public deployments remain unchanged.

| Repository | Pushed source checkpoint | State |
| --- | --- | --- |
| OpenPresentation/opf | `09ab32fa4899b32ee55bdd2b1bfea32c4de7d674`, following initial `bd0ac1289227bfdc9c1c516527c40cfd49e47a0e` | Composition, atomic pagination and accepted alignment/line origins |
| OpenPresentation/opf-render | `647368a481d316c390671fe4d33803cd08b933a6` | Shared SVG metric geometry and source traces |
| OpenPresentation/opf-pptx | `8723f0c16a1e4ffd0f592a881c71a79067e5e989` | Native editable lines and guarded source/type recovery |
| OpenPresentation/opf-editor | `b30c25c5af426590857f1a84c54b775056fee5ca` | Actual metric field editing, accepted input alignment/spacing and undo |

`align` supports left/center/right. Accepted absolute `linePositions` include blank lines; an inline value/unit pair moves together with its gap following the measured value advance. Composition accepts host-resolved `contentAlignment`, with explicit slide-design precedence. All consumers use accepted geometry/styles without independently fitting metadata. Original scalar types, zero, CRLF/tabs and empty optional fields survive. XML-invalid characters fail with field paths and UTF-16 offsets. The empty primary value has a selectable target.

Native shape tags identify complete groups. Reimport uses current native text, retaining unchanged numeric types and noncanonical numeric edits as literal strings with a diagnostic. Invalid trend edits or damaged/missing/duplicated/cross-code identities retain visible native shapes instead of restoring stale tagged source. Native formatting, geometry, alignment and font themes are not reconstructed.

[Portable source evidence](../evidence/shared-metric-integration/summary.json) binds runtime/font hashes, verifiers, consumer refs and representative PNGs. Checks used isolated sibling source links, unchanged pnpm 10.33.2/npm 11.16 locks, and Windows Node 20.20.2/24.20.0. They are not clean candidate or registry installations.

- Core: 466 tests plus existing composition/nesting, pagination, data, rich-text and list suites pass on both runtimes; workspace declaration checks pass.
- Renderer: syntax/package validation, 36 aligned metric cases, 198 XML-boundary cases and existing shared-code model/browser checks pass on both runtimes. The full suite stops at its golden gate: **85 of 805 rasters differ**, with the same 126-deck source digest. No baseline was promoted; later commands in that suite remain unexecuted.
- PPTX: syntax/package validation, existing full package command, shared-code/provenance checks, 36 metric XML geometry/type roundtrips, 198 XML-boundary cases and edited/damaged provenance fixtures pass on both runtimes. Building other browser harnesses is not their execution.
- Editor: existing model/code browser suites pass on both runtimes, plus six actual offline wide/portrait/alignment metric workflows covering every field, CRLF/tabs/no-op, visible selection, edits/undo/redo, pagination, export and exact metric reimport. Eight scalar/blank workflows and two rejected numeric/trend edits pass. Reports fingerprint resolved runtimes and record actual font substitutions; distinct Roboto weight-family descriptors are not treated as identical fonts.
- Real PowerPoint 16.0.20326.20132 on Windows 26200.9445 opens 36 actual source-exported Calibri slides, checks accepted native shape positions/font sizes/tags, edits fields and saves/reopens. All **108 original/saved/edited imports** preserve exact tested source/types. Reference fonts are local compatibility-test inputs and are not embedded or redistributed.

**The native raster gate remains failing.** Nine character-range advance bounds exceed the 0.1-point cell tolerance, up to 0.70866pt. A portrait/right multiline-value fixture has native visible ink at x=497 beyond the accepted right edge x=496.8. The comparison writes its evidence and exits nonzero after source recovery checks. Preserve this failure; do not widen the threshold or equate successful source recovery with raster parity.

PowerPoint full paragraph bounds include an invisible terminator advance; the verifier uses actual source-character ranges and records paragraph widths separately. On the long unit, a kerning-on probe gives native width 296.17pt versus fontkit 295.5498046875pt. Disabling kerning enlarges both widths and does not remove the discrepancy. This is a recorded font/shaping investigation, not a proven fix. Inspected native/SVG images also differ in vertical glyph placement.

Next investigate the native counterexample and add inter-part native glyph collision checks; run an independently bound Node 20 native matrix; inspect the 85 changed corpus slides and promote a separately named baseline only after review; execute remaining renderer checks; add coordinated source/clean-candidate browser/native CI and guards. Draft PRs and complete CI/review are still open. After acceptance, prepare dependency-ordered releases, fresh registry checks and public adoption. Do not republish the shared-code set. The broader repair/Auto arrange, chart/timeline, font/fallback/multilingual and missing native-platform objective remains active.

## Previous checkpoint: initial core composition/pagination only

The following initial checkpoint is preserved as history and superseded by the current state above.

Continue `codex/shared-metric-integration-20260910`. The standalone primitive merged in [core PR #58](https://github.com/OpenPresentation/opf/pull/58) as `5cfc944ee7709b54bc2d1e7192cd86b7a52d6cb7`, tree-identical to reviewed `d484a32a910cd9f0c729bcb9e5dc57f1e1cdfaa6`. Complete coordinator `34461397322`, core `34461397297`, Windows/macOS CLI `34461397393` and Bugbot pass. This branch is the next, separately reviewable increment. No package version, release-plan library ref, registry installation or public deployment is advanced by this source checkpoint.

## Core composition and pagination

Composition now measures every metric part while evaluating candidates and again against the final rounded accepted cell. `item.metricLayout` carries that result; compatibility `item.text` and `item.textStyle` alias its value. `grid-score-v4` adds all metric font reductions and charges overflow once per failing metric leaf. Explicit rows/columns/weights/regions and strict ancestor policies remain authoritative. Metric no longer appears in this branch's advance-model `unmeasuredPayloads`; that does not certify renderer/editor/native integration or glyph-outline bounds.

Pagination's existing atomic-payload path now sees complete metric diagnostics. It preserves numeric zero, scalar/object shape and all metadata, persists the selected readability floor, and rejects irreducible metadata all-or-nothing, including empty values after earlier content. No implicit metric splitting or content editing was added.

All 464 core tests and existing composition/nesting, pagination, data, rich-text and list preservation suites pass locally on Windows Node 20.20.2 and 24.20.0. Workspace typecheck and Node 24 CLI checks also pass: 11 unit tests and 69 command checks; Windows file-symlink rejection remains explicitly skipped when privileges are unavailable and covered by Unix CI. Six new tests cover rounded geometry/value aliases, explanation measurement counts, full metadata scoring, strict inherited field paths, explicit placement/weights, and atomic pagination/source types. The initial run exposed obsolete score-version/coverage assertions; those contracts were updated without changing quote/code algorithms. A dense-label fixture was adjusted from 70 to 81 repetitions because the former still fitted both arrangements and therefore did not test overflow selection.

## Prepared repository map

Use GitHub repositories/branches rather than local install artifacts as checkpoints. Fresh sibling clones were prepared for the integration, without altering previous release-verification checkouts:

| Repository | Starting checkpoint | Integration state |
| --- | --- | --- |
| OpenPresentation/opf | reviewed PR #58 source | This branch; core source/tests above |
| OpenPresentation/opf-render | `f4a1b8e1324cbc182b98d43f16528594c8006f86` | Clean source; renderer integration remains to implement |
| OpenPresentation/opf-pptx | `f421c91b7b127c7eeab788acdc0c51969402e057` | Clean source; export/provenance/reimport remains to implement |
| OpenPresentation/opf-editor | `1b05f8ba97f9617b25b1a9d18ac05648419318c9` | Clean source including mobile example labels; integration remains to implement |

Downstream branch name is also `codex/shared-metric-integration-20260910` when implementation begins. Core dependencies were installed with the frozen pnpm 10.33.2 lockfile; downstream npm lockfiles were installed unchanged under Node 24/npm 11.16 with lifecycle scripts disabled. These preparation installs are not candidate or final-registry fidelity evidence.

## Remaining gates before release preparation

1. Audit explicit content alignment through the shared metric API and renderer/export callers. Accepted geometry must honor supported user alignment consistently; do not independently center or refit each field after acceptance.
2. Replace renderer/PPTX's legacy independent metric formulas and truthy metadata joins with accepted `metricLayout`. Preserve scalar paths, zero, literal text and empty-value selection boxes. Reject unrepresentable XML characters explicitly. Consumers must use exact resolved styles and line/tab positions, including the fixed single-line inline search.
3. Implement guarded native metric grouping and reimport. Original scalar/field types are recoverable when native text is unchanged; native edits take precedence. Define changed numeric fields and trend enums explicitly, retaining visible native content with diagnostics when it cannot form a valid metric. Never silently resurrect old tagged text or drop ambiguous shapes. Existing code shape-tag helpers are a useful pattern, not proof that metric behavior already works.
4. Extend editor traces, selection and text/value controls to metric parts. Existing `parseCanvasValue` can validate finite numeric edits and preserve CRLF around string edits; verify the actual canvas paths, no-op, cancellation, validation failure, undo/redo and source changes at wide/portrait viewports.
5. Run coordinated source and installed-candidate checks, actual offline browser author/import/edit/export/reimport, and real PowerPoint edit/save/reopen/reimport and raster observations. Preserve the separate glyph, measurement, source and native-fidelity classifications. Only after review and complete checks prepare versions, dependency-ordered publication, new immutable CI refs, fresh registry gates and all three site adoptions.

The primitive's prior model/browser reports remain a source-bound historical checkpoint; regenerate integration evidence rather than relabelling them as integrated or published-runtime results. The full deterministic repair/Auto arrange, chart/timeline, font/fallback and missing native-platform objective stays open.
