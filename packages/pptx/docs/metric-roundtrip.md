# Shared metric source integration (unpublished)

This branch depends on the coordinated `codex/shared-metric-integration-20260910` core and renderer sources. These changes are not included in published PPTX 0.7.0. Use the core repository's [integration plan](https://github.com/OpenPresentation/opf/blob/codex/shared-metric-integration-20260910/docs/plans/shared-metric-integration.md) for exact checkpoints and release gates.

Every visible metric value, unit, label, description, delta and trend uses the core's accepted font sizes, line positions and tab stops. Each source line is editable native text. Native paragraphs now use the accepted left/center/right anchor and available part width. This preserves the intended alignment when PowerPoint's text advances differ slightly from the measurement provider; it does not refit or scale the text.

Standard native shape tags identify complete groups and their original scalar types. Reimport reads current native text. Unchanged numbers remain numeric; noncanonical numeric edits remain literal strings with a diagnostic. Missing, duplicated or damaged identities retain visible native content rather than resurrecting stale source. `metric-import-reflow` reports that native geometry, typography, alignment and font themes are not reconstructed. Invalid XML characters reject export with exact field paths.

## Verification

`npm run test:metric` checks shared OOXML geometry, paragraph alignment, source/type roundtrips, XML boundaries and damaged/edited provenance. `npm test` and `npm run test:code` preserve the existing converter coverage. Actual editor browser workflows run in the coordinated editor repository.

On Windows with PowerPoint and the local Calibri reference fonts installed:

```powershell
node test/native-metric.mjs generate artifacts/native-metric-review
powershell -NoProfile -File test/native-metric.ps1 -EvidenceDirectory artifacts/native-metric-review
node test/native-metric.mjs compare artifacts/native-metric-review
```

The three commands must use unchanged sources, runtimes and test scripts. The fixture contains 48 wide/portrait and left/center/right slides, including leading tabs, blank lines and whitespace-only fields. The native step checks shapes, edits fields, saves/reopens, and captures full-slide rasters plus isolated field rasters. It restores shape visibility before saving and closes only its own generated presentations. It never quits PowerPoint or embeds/redistributes reference fonts.

Comparison checks all 144 original/saved/edited imports, native source-character bounds, tab positions, raster containment and intersections between isolated field pixel masks. Each nonblank fixture field must produce ink, and the masks' union must reproduce all full-slide ink pixels. It writes all evidence before failing a fidelity gate; successful imports alone do not pass that gate. Current Node 20/24 observations have no character-bound overruns, mask-coverage differences or inter-field mask collisions, but retain eight tab outliers (maximum 0.067383pt against the 0.02pt gate) and one raster-edge outlier in the portrait/right “Latency” label. Font, baseline and raster equivalence remain unproven. See the core evidence rather than treating these numbers as universal tolerances.

`test/native-font-advances.mjs` and its PowerShell companion provide a separate exploratory 1,024-case study of eight local reference faces. Use their `generate`, native PowerShell, then `compare` sequence with a dedicated output directory. They compare a candidate shaping/advance-quantization hypothesis, record requested font-file hashes and native font-slot names, and retain every outlier. This is a measurement report, not a passing conformance test or a runtime font profile. No open substitute is certified by this study.
