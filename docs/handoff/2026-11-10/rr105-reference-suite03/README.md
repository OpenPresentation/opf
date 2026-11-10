# Actual reference suite03 — failed, unsealed

NEVER MERGE this evidence branch. The sole actual generation from frozen producer `519dd89a80904907a3d0120f90b732065d99a0b1` exited 1 on the third witness, after writing 23 partial files. No retry, Office, native qualification, package rebuild or registry operation occurred.

The genuine six-package consumer remains source `0699820e2f562d94c48b8c44a2d9b72387c0cecb`, complete installed identity `724c718a2d449b912394f0bf76e828b3e2da72c8f9211881eadc864f2d40e15e`. Four audits (generation and separate diagnostic, before/after) verify all six tarballs, 756 distributable files and actual core peer routes, plus all original 340 full-suite files and the 4/14 members of failed attempts01/02. None changed.

The first two PPTX inputs are byte identical to suite02. Their current modeled public imports have no findings, and their 12 SVG/PNG previews exist. Those imports are Office-free, not saved native results. The third PPTX, `reference-overlays-markers.pptx`, is 128307 bytes, SHA256 `229c01fbacd4f7bbc78c726f482dde32f0789184fd23f1d0f0c0fbf1125a191d`. Its three slide shape counts are 1/1/3. The second slide, a bar, has only the chart: no owned reference, ordinary target line or label. The expected explicit value20, label `Target 20`, width2 dashed orange reference is missing. The ownership assertion fails `0 !== 1`; the assertion was not changed or waived.

A separately authorized, single `core.convert(...format:'svg')` call on the already captured third source confirms the real runtime defect. The actual composed axis is 0..25/step5, so value20 is in bounds. The reference normalizes correctly, but the actual bar has no layer/plot. `legend:'none'` and `dataLabels:false` activate chart options; the legacy `horizontalBarPlot` helper refuses active options, and composition therefore skips reference placement. The resulting [bar SVG](bar-target-missing.svg) contains neither the target label nor orange reference paint, with no diagnostics. Other two diagnostic labels exist. This separate output does not complete suite03's missing generated inspection/previews/title pair/font seal.

`partial-suite03.zip` preserves every generated member byte for byte. `raw.json.gz` preserves all 54 raw process, identity, setup, source and causal records (1,640,850 decoded bytes). The initial read-only inspector's absent-array assumption and the diagnostic's CJS-resolution attempt at an ESM-only public export both failed before product conversion; their originals remain alongside the narrow setup corrections. Exactly one SVG conversion and zero new PPTX exports occurred in the diagnostic.

Reproduce the offline proof only:

```sh
node docs/handoff/2026-11-10/rr105-reference-suite03/verify.mjs
```

This verifier uses built-ins, raw hashes and the recorded Git source; it never imports the product or launches Office. The suite remains FAILED/UNSEALED, profile-ineligible, title pair and final fonts unrun, with native acceptance owed. The next step is a separately reviewed product fix sharing the actual active-option bar geometry, followed by fresh consumer generation; never modify these producers or outputs.
