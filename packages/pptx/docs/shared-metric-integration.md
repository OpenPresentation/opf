# Metric source integration (unreleased)

Continue `codex/shared-metric-integration-20260910` alongside the same branch in OpenPresentation/opf, opf-render and opf-editor. Published core 0.9.0 lacks the accepted `metricLayout` contract required by this source. Package versions and registry dependencies remain at the previous complete set pending a coordinated release.

Each accepted metric source line becomes editable native text using its accepted origin, resolved style and tab stops. Standard native shape tags identify complete metric groups. The first value line carries source/type/boundary context without adding an invisible panel. Reimport uses current native text, preserves unchanged numeric types and empty optional fields, and retains noncanonical numeric edits as literal strings with a diagnostic. Invalid trend edits, damaged/missing/duplicated identities and cross-code ambiguity retain visible native shapes instead of restoring stale source. Geometry, formatting, alignment and font themes are not reconstructed.

With coordinated source links, Node 20.20.2 and 24.20.0 pass syntax/package validation, the existing full package suite, shared-code/provenance regressions, 36 aligned metric geometry/type roundtrips, 198 XML-boundary cases and guarded metric provenance tests. Existing browser build checks produce bundles; they do not themselves execute all browser workflows. The editor's separate offline metric workflows execute export/reimport.

## Real PowerPoint gate

Run locally on Windows with installed Calibri reference fonts (PowerPoint and proprietary fonts are compatibility-test inputs only):

```powershell
node test/native-metric.mjs generate artifacts/native-metric
& ./test/native-metric.ps1 -EvidenceDirectory artifacts/native-metric
node test/native-metric.mjs compare artifacts/native-metric
```

The current Node 24 source run generated 36 slides across two dimensions and three alignments. PowerPoint 16.0.20326.20132 preserved exact source, accepted native shape positions, font sizes and tags while editing/save/reopening. All 108 original/saved/edited imports recover exact tested metric fields and types. Proprietary font bytes are neither embedded nor copied into evidence.

**The comparison exits nonzero.** Nine native character-range bounds exceed the 0.1-point containment tolerance, up to 0.70866 point. One native portrait/right raster has a visible pixel at x=497 beyond the accepted cell ending x=496.8. Full paragraph bounds also include an invisible terminator; the verifier uses actual source-character ranges and separately records paragraph width. Kerning-on/off probes do not eliminate the remaining native advance difference. Keep this native raster gate open; do not describe the source recovery as pixel equivalence or native glyph collision proof.

The portable core handoff contains hashed reports and representative images. Final native-fidelity investigation, source corpus review, clean candidate installation, full coordinated CI/review and all publication/adoption gates remain open.
