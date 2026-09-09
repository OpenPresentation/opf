# Native content fidelity — unpublished 0.5.2 candidate

The published 0.5.1 native feature matrix exposed hard-coded metric sizes, flattened timelines, changed quote layout with missing source, mismatched code styling and dark chart labels on dark slides. This candidate uses the shared core text fitter and published renderer 0.5.1's payload geometry to create editable native text/lines/markers. Quotes retain attribution and source, reserving footer space before fitting long bodies. Chart labels use the preview's readable theme text color; the Office chart remains editable. The optional renderer peer now requires ^0.5.1, with exact 0.5.1 development dependency and a fresh registry lockfile following renderer publication `335ed01b2efbbb872894949f2ac0519e35651474`.

The [hash-bound candidate report](evidence/native-content/comparison.json) distinguishes the installed registry baseline from this unshipped implementation, recording all runtime/vendor/package/lock hashes and declared candidate version. PowerPoint 16 opens, rasterizes, edits, saves and reopens all 19 slides in the same eight controlled cases. All 24 original/saved/edited reimports validate and retain each native edit. Three native tables, one Office chart and one picture remain native. No proprietary font binary is included.

Visual inspection confirms the improved metric size, quote/source placement, code panel and alternating native timeline markers. The [code/metric contact sheet](evidence/native-content/contact-2.png) and [quote/timeline/chart sheet](evidence/native-content/contact-3.png) put the published renderer on the left and candidate PowerPoint on the right. Local Calibri and normalized 1280×720 dimensions control this comparison; seven intermediate weight substitutions are recorded. This is not original-font or arbitrary Office fidelity.

Against the published baseline, RGB mean absolute channel error falls from 5.8663 to 2.5798 for code, 2.4795 to 2.2017 for the metric, 3.7297 to 2.2681 for the quote, and 2.1129 to 1.2005 for the timeline. These averages are observations, not pass thresholds. Readable chart labels increase that slide's global error from 4.2735 to 4.4145 because Office still uses different ticks and plot geometry; visibility is verified independently. General scalar-text wrapping/vertical placement also remains different. No complete raster equivalence claim is made.

`test/content-layout.mjs` compares 34 payload text lines to the actual published renderer's typography/geometry at 1280×720 and 1920×1080, checks native code colors, requires quote source after import, validates editable timeline markers for one/multiple events, and compares native chart-label colors to the preview. Eight fitted long quotes retain footer separation and two oversized cases reject in strict mode. Actual PowerPoint XML dimensions are asserted. Earlier long-quote fixtures supplied unsupported `width`/`height` keys and silently used widescreen; corrected fixtures use `widthInches`/`heightInches` and verify the actual dimensions. The renderer's corresponding correction is tracked in [PR #9](https://github.com/OpenPresentation/opf-render/pull/9); its published runtime requires no change.

The full converter suite, 126-deck/805-slide structural corpus and styled-table regressions pass on Node 20/24. Fresh packed consumers pass export/reimport for tables, metrics, quotes, code and timelines with zero audit advisories. All five actual Edge suites pass on both runtimes, including 29 content-formatting/browser reimport checks. That browser converter suite explicitly uses default measurement; loaded-font glyph bounds and native raster observations are separate evidence. Renewed Linux/Windows CI and review, followed by fresh registry checks, remain release gates; 0.5.2 is not published.

## Long quotes in real PowerPoint

The [separate native quote report](evidence/native-quote/comparison.json) verifies eight actual wide/portrait slides, using the same four local Calibri faces for measurement and preview. Both SVG and PowerPoint dimensions are asserted. PowerPoint `TextRange2` glyph bounds keep every fitted body above its visible footer. All eight native title edits survive save/reopen; six original/saved/edited deck imports validate and retain attribution/source and every native edit on Node 20/24. The [wide](evidence/native-quote/quote-1280-contact.png) and [portrait](evidence/native-quote/quote-540-contact.png) contact sheets were visually inspected; columns are renderer then PowerPoint, with 12/16/20/24 phrase repetitions by row. Raster differences remain measured observations, not an equivalence threshold.

Run from this converter checkout on Windows with PowerPoint and local Calibri:

```powershell
node test/native-quote.mjs generate
./test/native-quote.ps1
node test/native-quote.mjs compare
```

The script leaves PowerPoint and user presentations open. Reports contain font hashes and substitutions, never proprietary font binaries.

For native reproduction, fetch core merge `3d9321621486c95d06cc8153e2d30020c624f489` (PR #39) and this converter branch, install/build the converter, and create a fresh registry consumer with core 0.7.0, renderer 0.5.1 and baseline PPTX 0.5.1. Preserve the historical renderer 0.5.0 baseline consumer separately. Run from core, supplying the explicit converter entry:

```powershell
node scripts/test-native-feature-matrix.mjs <registry-consumer> <candidate-evidence> generate <converter-checkout>/dist/index.js
./scripts/test-native-feature-matrix.ps1 -EvidenceDirectory <candidate-evidence>
node scripts/test-native-feature-matrix.mjs <registry-consumer> <candidate-evidence> compare <converter-checkout>/dist/index.js
```

Omitting the candidate argument uses actual registry packages; comparison rejects a missing/changed candidate or changed runtime files. The published baseline is preserved in core PR #38, merge `204cd42278992b58f6468a98e1eb168e3531df40`. Keep the independent styled-border native test and broader native/UX follow-ups.
