# Chart colors and editable workbook headings — source checkpoint

The [summary](summary.json) binds 348 artifacts (8,390,025 bytes) to the following unpublished integration sources:

| Repository | Source commit |
| --- | --- |
| OpenPresentation/opf | `a58a9e39a02b1ca13b947dd045bfa9f664c3db57` |
| OpenPresentation/opf-render | `a6c499434b98754597c6cb7e2b8ec744fdecd7fc` |
| OpenPresentation/opf-pptx | `7ed519de3daadb49123baf574bab89fd817d411a` |
| OpenPresentation/opf-editor (unchanged) | `b30c25c5af426590857f1a84c54b775056fee5ca` |

All four use `codex/shared-metric-integration-20260910`. No version, registry package, public deployment or accepted golden baseline changed.

## Implementation and passing checks

Core exports `chartColorForFill` from the root and composition entrypoints. An inherited opaque chart mark below 3:1 against its panel is mixed toward black or white in bounded 1/255 increments. The first passing increment wins, with higher contrast breaking a tie. Passing colors remain byte-for-byte unchanged. Unresolved or translucent colors remain unmeasured and unchanged. This is a series-to-panel rule, not proof of adjacent-series distinction, colorblind safety or general chart accessibility.

SVG charts now use their resolved panel, inherited text at 4.5:1 and the shared mark fallback. Native export writes an explicit chart panel, an unfilled plot area to avoid stacking alpha, inherited axis/legend colors and adjusted series colors. Circular charts have category legends. The existing SVG and PPTX palette identities, chart semantics and geometry are still different; this checkpoint does not claim chart parity.

PPTX export writes the actual category heading into its embedded XLSX, including applicable generated table metadata. Import recovers the current workbook cell above a supported vertical category range, rather than returning a fixed `Category` or restoring a stale source tag. Import handles rich shared strings, escaped Unicode and whitespace, and refuses to guess unsupported ranges, formula/error headings, external references and malformed or oversized workbook metadata. Scatter heading recovery remains outside this scope. Native Excel's treatment of empty/duplicate table headings has not been verified.

Node 20.20.2 and 24.20.0 both pass:

- 470 core tests, existing preservation suites, workspace typecheck, lint and example validation.
- 40 SVG chart cases and 40 actual PPTX chart cases: panels, alpha, inherited labels, non-vacuous series/point paint observations, source preservation and exact heading/series/category/value reimport.
- 37 workbook cases plus invalid-heading guards: actual deterministic export/reimport, Unicode/whitespace, rich shared strings, unrelated-cell/table preservation and bounded unsupported/corrupt-reference handling.
- Full PPTX package, code and metric suites; all six browser suites in actual Edge 152.0.4191.66. The new chart suite has four cases / 28 checks, including DOM text/mark colors and recovery of a changed actual workbook heading.
- Renderer checks before its corpus gate and separately executed commands after that gate, including fonts, design preview, browser bundle, styled tables, code and metrics.

The **full renderer command still exits 1** at the unpromoted source/corpus gate. The check reports retain that result. Browser and native serialization checks do not establish native application behavior.

## Visual evidence

The [raster review](raster-review.json) verifies all 805 before and all 805 after image hashes, with identical authored content. Current Node 20/24 corpus manifests are identical. There are 141 final changed rasters, all on slides containing charts. This directory preserves every changed before/after PNG plus 12 final review sheets.

The initial 136 panel/text changes were inspected across 12 sheets. That review found reduced series visibility on some themed panels. The shared mark correction changed 16 slides (11 already affected and five additional slides); both follow-up sheets were inspected. These two review passes cover every final changed image. The broader corpus baseline is still unpromoted: unresolved images, compact chart labels, chart semantics and prior metric geometry findings remain gates.

The actual offline Edge text-rectangle audit covers 100 gallery decks, 720 slides and 11,691 text runs. Findings drop from 962 to **942**, with no unmeasured rectangles; the 20 chart-label findings are removed. The remaining findings are unchanged: 610 watermark placeholders, 224 header-image placeholders, 80 background-image placeholders and 28 other content rectangles. Do not dismiss those automatically. This conservative audit includes spaces, glyph overhang/borders and approximate shared opacity; it is not WCAG certification or a test of every font/glyph raster.

## Native gate remains open

The current [eight-chart source fixture](native-attempt/charts.pptx), [runtime manifest](native-attempt/generation.json), [failure report](native-attempt/failure.json) and [raw log](native-attempt/native-run.log) are preserved. The attempt failed at `connect`: Windows PowerPoint rejected its COM class factory with `0x80010001 / RPC_E_CALL_REJECTED`. It never opened the current fixture. No PowerPoint/Excel process was terminated and no user presentation was closed.

Earlier exploratory chart runs reached original/save/reopen raster exports, then encountered a numeric COM assignment error; an overlapping retry was discarded. Those runs are not passing evidence for the current source. The harness now casts numeric edits explicitly, reads UTF-8, records failures, and closes only generated fixtures. Its new native point-color observations and complete embedded Excel edit/save/reopen sequence still require execution on both supported runtimes once Office accepts automation again. Historical table/metric native evidence remains separate.

## Reproduction and next gates

Fetch the recorded GitHub branches/commits into sibling `opf`, `opf-render`, `opf-pptx` and `opf-editor` directories. Use the existing integration plan to install pinned dependencies and link the coordinated source builds. Copy [run-chart-checks.mjs](run-chart-checks.mjs) into their parent directory, then run it under pinned Node 20.20.2 and 24.20.0 with npm 11.16.0 and pnpm 10.33.2, passing each repository name. Run core first, then consumers. The reports are linked-source evidence, not fresh registry installations.

From core, run `scripts/audit-svg-contrast.mjs` with a new output path. Run `scripts/review-chart-colors.mjs` with the before/current golden directories and a separate review output. Keep the committed corpus and previous evidence intact. To rerun native tests, generate a new directory with `test/native-chart-colors.mjs generate`, execute `test/native-chart-colors.ps1` against that directory in Windows PowerShell, then run `test/native-chart-colors.mjs compare`. Run one native fixture at a time, preserve user Office files, and never accept a comparison from mismatched runtime or fixture hashes.

Still required: native chart verification; complete corpus acceptance; the existing metric tab/portrait-ink failures; shared chart semantics/layout/palette identity and mid-gray theme-slot resolution (the consumers currently use different darkness formulas); source and clean-candidate CI/PR review; then dependency-ordered publication, immutable release refs, fresh registry E2E and public deployments. The complete repair/Auto arrange/font objective remains active.
