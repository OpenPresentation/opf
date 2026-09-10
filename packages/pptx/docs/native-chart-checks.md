# Bounded native chart checks

Generate a fresh fixture directory for each selected workbook and Node runtime:

```powershell
node test/native-chart-colors.mjs generate artifacts/charts-new-slide1
powershell.exe -NoProfile -NonInteractive -File test/native-chart-colors.ps1 -EvidenceDirectory artifacts/charts-new-slide1 -EditSlide 1
node test/native-chart-colors.mjs compare artifacts/charts-new-slide1
```

Select exactly one slide, 1 through 8, per invocation. Full edit coverage requires eight separate successful fresh runs on each tested Node runtime. Run only one Office verifier at a time. The hidden helper defaults to 45 seconds, with a maximum of 60; a timeout terminates only that helper and does not establish Office cleanup. Preserve the attempt and inspect Office before further native work. Never automatically retry blocked calls, quit or kill Office, or close user presentations. Already-open fixtures and reused attempt directories are rejected.

Each fixture contains four column and four pie charts with contrasting opaque and translucent panels. The native worker saves and reopens all eight charts, then activates only the selected embedded workbook. It edits the heading, series name, first category and first value, explicitly rebinds the existing source range with `SetSourceData`, and reads the actual series while the workbook is active. `Refresh` alone previously redrew stale chart caches after worksheet edits. The edited presentation is saved and reopened again.

Comparison requires exact data from all 24 original/saved/edited slide imports and a separate XML chart-cache reader that does not use the OPF importer. It also requires exact live edited series, native series names and values, panel alpha, legend/axis colors, and point contrast on opaque panels. Original and reopened native PNG hashes must match on all eight slides; the selected edit must change its PNG while the other seven remain unchanged. Generation binds the runtime, verifiers and fixture hashes; native records include Office executable and OS build details.

On PowerPoint 16.0.20326.20132, loaded pie charts can return arrays of null elements from `Series.XValues`. An independent control created entirely by PowerPoint's `AddChart2` returned real category names before saving and null elements after reopening the same chart. A null getter is recorded as an unavailable observation, never accepted as matching category data. The gate still requires exact categories from the live edited chart and independently parsed persisted caches. Any other category mismatch fails. The control, initial stale-cache failure and earlier failing observations are retained in the Windows evidence bundle. The diagnostic that crashed `chart.dll` is retained too; its exact triggering call is unknown, and the `Series.Formula` probe was not repeated.

This suite establishes editable chart data, selected color properties and native save/reopen stability for these fixtures. It does not establish browser/native raster equivalence, resolved font-file identity or advanced chart-layout parity. See the core repository's `docs/evidence/windows-native-2026-09-10/` for immutable verifier snapshots, raw controls and the two-runtime matrix.
