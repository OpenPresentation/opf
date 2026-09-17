# Native metric outline candidate, Windows 2026-09-10

The coordinated outline/font candidate clears the previously retained portrait/right Latency ink overflow on both Node 20.20.2 and 24.20.0. All 144 original/saved/edited imports per runtime pass, along with native visible ink, character bounds, inter-part collisions and isolated-mask coverage. Each runtime used six separate 45-second bounded native helpers, with 48 full-slide rasters and 138 isolated-part masks. Source/runtime/fixture bytes match across the two runtimes.

The full fidelity gate remains failed: six wide leading-tab offsets exceed the unchanged 0.02-point tolerance, maximum 0.0226745605469 points. The [original baseline](../windows-native-2026-09-10/README.md) retains its eight tab failures (maximum 0.0673828125) and one ink overflow; those records are unchanged. This candidate simultaneously includes the coordinated outline and physical-font changes, so these results establish the candidate graph's behavior rather than isolating which change affected each tab observation.

Exact repositories, harness commit and application details are in `sources.json`. Core product `476fdb2f5547e442d8a270047dfc8557f306bb49` is the candidate requested by [core #66](https://github.com/OpenPresentation/opf/pull/66). Renderer `379b1402b4d06de79b98a35360f3ef5692d3659b` and PPTX `c464b0d53c29fcdb87db88cc54a80e8520f084e3` supply the merged physical-font graph. [PPTX #23](https://github.com/OpenPresentation/opf-pptx/pull/23) corrects only the verifier's accepted-anchor assumption. No proprietary font bytes/outlines or Office binaries are redistributed.

## Preserved attempts

`raw/metric-candidate-node24-01` records the first bounded attempt stopping on slide 3 because the old verifier expected the allocation box's left edge. `geometry-diagnostic.json` compares original DrawingML against that stale assumption. The accepted core line origin includes outline clearance; the exporter already follows its aligned anchor. The retained initial verifier bytes are under that run's `verifiers/` directory. Its worker exited normally through fixture cleanup; this was a geometry assertion, not a blocked Office call.

Fresh `raw/metric-candidate-node24-02` and `raw/metric-candidate-node20-01` use `verifiers/metric-anchor`. Shape x follows the accepted line origin and alignment, with the same 0.02-point tolerance. Independent ink containment continues to use the accepted cell, and the tab gate is unchanged. Each `comparison.log` retains the intentional nonzero full comparison; `comparison.json` records all six outliers. The previous Latency mask reached x=497 beyond the accepted right edge 496.8; the candidate reaches x=496 and passes. Masks, native outputs, source files, edits, imports and runtime hashes are retained for independent review.

## Reproduce and verify

Use named sibling `opf`, `opf-render`, `opf-pptx` and `opf-editor` checkouts at the recorded commits. Install locked dependencies, build core, and run its `scripts/link-ecosystem.mjs --packages-only`. Select the pinned Node runtime and apply the cited harness commit. In the PPTX checkout:

```powershell
node test/native-metric.mjs generate artifacts/metric-new
powershell.exe -NoProfile -NonInteractive -File test/native-metric.ps1 -EvidenceDirectory artifacts/metric-new -Deck metric-1280-left
node test/native-metric.mjs compare-deck artifacts/metric-new metric-1280-left
```

Use one explicitly selected deck per invocation. The six IDs combine `metric-1280`/`metric-540` with `left`/`center`/`right`. After all native runs finish, `node test/native-metric.mjs compare artifacts/metric-new` requires the complete matrix and intentionally fails on the retained tab outliers. Preserve failures and never automatically retry blocked Office calls. Only owned fixtures may be closed; never quit or kill PowerPoint/Excel or alter user presentations.

`bindings.json` maps each immutable generation to its exact verifier bytes. The manifest covers every tracked file and the verifier checks staged/committed Git blobs, original fixture hashes and runtime bindings:

```powershell
node docs/evidence/windows-native-candidate-2026-09-10/verify-evidence.mjs index
node docs/evidence/windows-native-candidate-2026-09-10/verify-evidence.mjs HEAD
```

Native ink and current-content recovery do not establish physical font-file identity or browser/native raster equivalence. The remaining tab discrepancy requires a separate native measurement investigation; no tolerance was widened and no consumer offset or source-text change was introduced.
