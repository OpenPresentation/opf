# Native PowerPoint feature matrix — September 9, 2026

## Candidate comparison support

The registry baseline below is preserved. To evaluate an unpublished converter, pass its built `dist/index.js` as a fourth argument to both `generate` and `compare`, using a separate output directory. The report's `candidate` field explicitly labels it as `local-candidate-not-registry-release`, records the declared version and hashes every runtime/vendor file plus package/lock manifests. Its installed core/renderer versions and registry integrities must match the baseline consumer. Comparison rejects a missing or changed candidate; omitting the optional argument remains registry-only. Node 20/24 comparisons and deliberate omission rejection were executed on the native 0.5.2 candidate.

Converter [PR #13](https://github.com/OpenPresentation/opf-pptx/pull/13), candidate `422f1e39e643cbb1c23260f0c9ddef7a3c6ec722`, improves metric/quote/code/timeline layout and chart-label contrast. Its [separate candidate evidence](https://github.com/OpenPresentation/opf-pptx/blob/422f1e39e643cbb1c23260f0c9ddef7a3c6ec722/docs/native-content-candidate.md) records native checks and remaining fidelity/release gates. This does not change published 0.5.1 or the historical observations below.

## Published 0.5.1 observations

Real PowerPoint 16 opens, rasterizes, edits and saves all 19 slides in eight controlled feature cases. Every native edit survives reopen and schema-valid reimport on Node 20/24. PowerPoint exposes three native tables, one editable Office chart and one native picture. The rich text/list, dynamic nested composition, scalar table, code, metric, quote, timeline, chart, grid-span and embedded-image cases come from installed registry core 0.7.0 examples. Renderer 0.5.0 and PPTX 0.5.1 are the actual registry packages, with lockfile integrities recorded in the [machine-readable report](evidence/native-feature-matrix/comparison.json).

**Visual equivalence is not established.** The native rasters reveal substantive differences which file validity, editability and zero converter diagnostics did not detect:

| Case | Observed native difference | Required follow-up |
| --- | --- | --- |
| Metric | Value and supporting text are substantially smaller. | Replace exporter hard-coded font sizes/positions with the renderer's measured layout contract. |
| Quote | Native output changes bold text to italic, moves attribution under the quote and omits its source. | Preserve quote/source content, typography and attribution geometry. |
| Timeline | Native output is a plain text list instead of the rendered timeline line, markers and alternating labels. | Export editable native timeline shapes using shared geometry. |
| Code | Background/border, header content and text placement differ. | Align native code panel styling and measured text with preview. |
| Line chart | Native Office axes use different ticks and nearly invisible dark text against the dark theme. | Preserve native chart editability while fixing axis contrast and reviewing scale/tick geometry. |
| Dynamic composition | Overall regions remain arranged correctly, but native text wraps and vertical placement differ. | Inspect line box/font conversion against native PowerPoint. |

The exporter source confirms separate hard-coded paths for metrics, quotes, timelines and code. These findings remain unresolved in published PPTX 0.5.1. They require implementation and renewed native raster checks before a fidelity claim. Do not infer that unrelated rich text, arbitrary imported tables, every chart variant, media playback or non-Latin shaping is covered by this sample.

The comparison uses the same four locally installed Calibri faces for text measurement and SVG rasterization, and explicit 1280×720 slide dimensions. The authored Aptos run is deliberately normalized to Calibri and recorded. Intermediate requested weights resolve to regular/bold and all seven such substitutions are listed. This isolates native differences but does not prove original-font fidelity. No proprietary font binaries or external assets are distributed. The embedded image comes from the published fixture's data URI.

Global RGB mean absolute channel differences range from 0.9763 to 6.0587 on a 0–255 scale; those are observations, not equivalence thresholds. Large blank areas can hide missing features: for example, the visibly different timeline still has mean error 2.1129. Each contact sheet places the renderer on the left and actual PowerPoint on the right; row-to-fixture mappings and hashes are in the report:

- [Rich text, lists and dynamic composition](evidence/native-feature-matrix/contact-1.png)
- [Nested layout, tables, code and metric](evidence/native-feature-matrix/contact-2.png)
- [Quote, timeline, chart and grid spans](evidence/native-feature-matrix/contact-3.png)
- [Embedded raster image](evidence/native-feature-matrix/contact-4.png)

Regenerate from this GitHub checkout and a fresh registry consumer containing the release-plan packages plus the renderer's raster dependencies:

```powershell
node scripts/test-native-feature-matrix.mjs artifacts/npm/registry-consumer artifacts/native-feature-matrix generate
./scripts/test-native-feature-matrix.ps1 -EvidenceDirectory artifacts/native-feature-matrix
node scripts/test-native-feature-matrix.mjs artifacts/npm/registry-consumer artifacts/native-feature-matrix compare
```

The scripts verify registry resolution, generated input hashes, native raster and saved-file hashes, slide counts, native table/chart/picture counts, every native text edit after reopen, all 24 original/saved/edited deck reimports, and source/native contact sheets. Native slide text and geometry inventories are retained in the report. The COM script closes only its own presentations and leaves PowerPoint and user documents open. The comparison does not assert lossless content/structure round-trip or pixel equivalence. Keep the existing three-slide styled-border regression too; this matrix supplements it.
