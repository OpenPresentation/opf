# Native content fidelity — unpublished 0.5.2 candidate

The published 0.5.1 native feature matrix exposed hard-coded metric sizes, flattened timelines, changed quote layout with missing source, mismatched code styling and dark chart labels on dark slides. This candidate uses the shared core text fitter and the published renderer's payload geometry to create editable native text/lines/markers. Quotes retain attribution and source. Chart labels use the preview's readable theme text color; the Office chart remains editable.

The [hash-bound candidate report](evidence/native-content/comparison.json) distinguishes the installed registry baseline from this unshipped implementation, recording all runtime/vendor/package/lock hashes and declared candidate version. PowerPoint 16 opens, rasterizes, edits, saves and reopens all 19 slides in the same eight controlled cases. All 24 original/saved/edited reimports validate and retain each native edit. Three native tables, one Office chart and one picture remain native. No proprietary font binary is included.

Visual inspection confirms the improved metric size, quote/source placement, code panel and alternating native timeline markers. The [code/metric contact sheet](evidence/native-content/contact-2.png) and [quote/timeline/chart sheet](evidence/native-content/contact-3.png) put the published renderer on the left and candidate PowerPoint on the right. Local Calibri and normalized 1280×720 dimensions control this comparison; seven intermediate weight substitutions are recorded. This is not original-font or arbitrary Office fidelity.

Against the published baseline, RGB mean absolute channel error falls from 5.8663 to 2.5798 for code, 2.4795 to 2.2017 for the metric, 3.7297 to 2.2681 for the quote, and 2.1129 to 1.2005 for the timeline. These averages are observations, not pass thresholds. Readable chart labels increase that slide's global error from 4.2735 to 4.4145 because Office still uses different ticks and plot geometry; visibility is verified independently. General scalar-text wrapping/vertical placement also remains different. No complete raster equivalence claim is made.

`test/content-layout.mjs` compares 34 payload text lines to the actual published renderer's typography/geometry at 1280×720 and 1920×1080, checks native code colors, requires quote source after import, validates editable timeline markers for one/multiple events, and compares native chart-label colors to the preview. It runs in the full converter suite. The existing 126-deck/805-slide structural corpus and styled-table regressions pass on Node 20/24. Final Linux/Windows CI, packed installations, browser conversion, review and fresh registry checks remain release gates; 0.5.2 is not published.

For native reproduction, fetch the core `codex/native-candidate-comparison-20260909` branch and this converter branch, install/build the converter, and create the core release-plan registry consumer. Run from core, supplying the explicit converter entry:

```powershell
node scripts/test-native-feature-matrix.mjs <registry-consumer> <candidate-evidence> generate <converter-checkout>/dist/index.js
./scripts/test-native-feature-matrix.ps1 -EvidenceDirectory <candidate-evidence>
node scripts/test-native-feature-matrix.mjs <registry-consumer> <candidate-evidence> compare <converter-checkout>/dist/index.js
```

Omitting the candidate argument uses actual registry packages; comparison rejects a missing/changed candidate or changed runtime files. The published baseline is preserved in core PR #38, merge `204cd42278992b58f6468a98e1eb168e3531df40`. Keep the independent styled-border native test and broader native/UX follow-ups.
