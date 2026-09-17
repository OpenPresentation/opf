# Shared text placement evidence

Unpublished source checkpoint on `codex/shared-metric-integration-20260910`. No package, approved corpus baseline, immutable release ref or deployment was advanced.

| Repository | Source commit |
| --- | --- |
| opf | `ac0c99fcdc03dd7cd7ac9840be841b903a941f77` |
| opf-render | `53e6f5fb5911ebecbfcdfef341bbb53e33c1f7a5` |
| opf-pptx | `12c6cee646a5c8760dcbf964b722a108d21687b4` |
| opf-editor | `0e8a1676c780919ceefe8b9972372f364e542944` |

[summary.json](summary.json) binds raw artifacts, source checkpoints and corpus comparisons. Per-suite reports bind actual runtime modules and fonts. The [contract](../../plans/text-placement.md) describes vector outlines, shared clearance, accepted origins, heading tags and limitations. Concurrent PDF-roadmap edits are preserved outside this commit; this milestone implements no PDF backend.

## Verified scope

- Windows Node 20.20.2 and 24.20.0: 482 core tests plus composition/pagination/data/rich/list preservation, workspace typechecks, lint and all 126 examples pass.
- Renderer: 99 font-face/text combinations preserve advances, scaling and cache isolation; 48 accepted-fit cases consume resolved styles and origins without remeasurement. Full commands retain the existing unapproved corpus-source failure. Subsequent commands pass separately; do not describe the full renderer command as passing.
- Actual Edge 152.0.4191.66: 24 exact Carlito cases per runtime pass source/advance/origin checks and all nonzero text-mask pixel centers within cells plus 0.1 reference pixel. Each runtime retains 96 independent item masks. `textRasterPadding: 0` controls exit 1 with exactly the four original portrait/right title failures. No mask tolerance was widened.
- The separate zero-clearance `ink-probe-node24` experiment retains glyph outlines, exact font hash and four rasters. All three text-rendering modes paint the same offending pixel (497,186), coverage 90/255; vector paths do not. This explains why vector bounds and raster clearance are separate inputs.
- PPTX: 24 cases / 144 editable native lines per runtime use accepted anchors, heights, sizes and styles, with autofit disabled. Complete heading groups retain roles and current native text; eight damaged/ambiguous cases fall back while retaining visible words. Native edits and shape renaming/reordering are tested through DrawingML modification and reimport, not through the PowerPoint application.
- Initial full PPTX runs stopped at the old content-card assertion expecting a full-cell text box. The updated assertion checks accepted line boxes while preserving full card-frame checks. Both complete reruns pass; `pptx-recheck.json` identifies the superseding logs. Earlier failures remain recorded.
- Full editor commands pass. Twelve geometry cases match renderer composition through edits, undo/redo and explicit pagination. Seven actual browser suites per runtime cover accepted text, gallery rich spacing, code rendering, image placeholders and code/metric/card editing workflows. The existing rich-text canvas harness additionally passes 46 selection, typing, caret, formatting and undo checks per runtime.
- All 2,415 previous/Node20/Node24 corpus image hashes verify. All 805 current default estimated rasters match the prior accepted-text checkpoint exactly. The source digest remains `3a1ed8ad00b30863b5852197a85602263a2238c613020fb891d933f86e124c4b`. Existing approval/quality findings remain; no baseline was promoted.

Portrait/right, widescreen/left and the rich editor screenshots were visually inspected. The sparse fixture deliberately retains its large card and explicit dark-blue “note” run; this is a containment/interaction fixture, not a typography or contrast quality certification.

## Open gates

The fresh GitHub audit finds zero open PRs and zero open Dependabot security alerts across seven repositories. Latest coordinated package CI run [34462104866](https://github.com/OpenPresentation/opf/actions/runs/34462104866) passed; it covers the earlier main checkpoint, not these unpublished sources. No integration PR is opened by this checkpoint.

No connected document session was available. A read-only PowerPoint COM factory/Version attempt failed with `0x80010001 / RPC_E_CALL_REJECTED` before opening a fixture. No user Office process/presentation was closed. This milestone has no current native application save/reopen, editability or raster evidence. Earlier native metric tab/raster counterexamples remain open.

Outline placement currently covers headings and scalar/rich text. Other payload internals, plain whitespace, multilingual shaping/fallback, general automatic repair/Auto arrange, measured-font convenience, absent referenced CSV/advanced chart semantics, reviewed corpus acceptance, vector PDF and native-platform verification remain work. Fresh candidate/registry checks and public deployment adoption follow reviewed source acceptance. Font metric compatibility, browser paint and native equivalence are distinct claims.

## Reproduce

Fetch the four GitHub source commits into sibling `opf`, `opf-render`, `opf-pptx` and `opf-editor` checkouts. Use the supported local dependency-linking setup in the [integration plan](../../plans/shared-metric-integration.md); package.json versions still describe the published set and cannot supply unpublished APIs alone. Build core first, then renderer, then PPTX/editor. Use the pinned Node/npm/pnpm toolchain recorded above.

From core, `node scripts/check-text-placement-packages.mjs <repository-directory-name>` records package checks. `node scripts/check-text-placement-browsers.mjs` runs the seven browser suites. `node scripts/run-rich-text-browser.mjs <output-directory>` runs the rich canvas harness. Run each under Node 20 and 24. Renderer `node test/accepted-text-browser.mjs <output-directory> 0` is the deliberately failing control, and `node test/probe-text-ink.mjs <output-directory>` isolates raster behavior. `OPF_TEXT_OUT` selects where the PPTX accepted-text test saves actual fixtures and geometry/import records. `scripts/collect-text-placement-evidence.mjs` verifies and collects these outputs; it expects the prior recorded corpus for comparison.
