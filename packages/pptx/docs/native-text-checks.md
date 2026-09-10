# Native accepted-text checks

This is an unpublished verifier for the shared placement integration. PowerPoint is an optional Windows compatibility-test dependency; OPF authoring, layout, rendering, editing and conversion remain local and independent of Office.

Use coordinated source checkouts and the pinned Node 20.20.2 or 24.20.0 toolchain. From this repository, generate a new evidence directory:

```powershell
node test/native-text.mjs generate artifacts/native-text-new
./test/native-text.ps1 -EvidenceDirectory artifacts/native-text-new -FontsOnly
./test/native-text-fonts-check.ps1 -EvidenceDirectory artifacts/native-text-new -OutputDirectory artifacts/font-controls-new
powershell.exe -NoProfile -NonInteractive -File test/native-text.ps1 -EvidenceDirectory artifacts/native-text-new -Case 0
node test/native-text.mjs compare-case artifacts/native-text-new 0
```

Generation reuses the existing 24-case editable-text matrix: wide/portrait, left/center/right, scalar/rich text and cards. It records accepted geometry, runtime/verifier hashes, actual PPTX bytes and the four pinned Carlito faces with their license. Plain text still uses the current whitespace-normalizing fitter. Requested Aptos is an explicit visual substitution, not a verified Aptos-compatible face.

`-FontsOnly` checks temporary font registration and removal without calling PowerPoint. The parent registers these same font files for the current Windows session, broadcasts the font-table change, and removes exactly its own registrations in `finally`. Office runs in a separate hidden helper with a 45-second deadline (maximum 60); a timeout terminates only that helper, so the surviving parent still removes its fonts. `native-text-fonts-check.ps1` verifies removal after an actual dummy-worker failure and timeout, without calling Office. It writes no font registry entries or permanent system files. This follows Microsoft's [temporary font installation API](https://learn.microsoft.com/en-us/windows/win32/gdi/font-installation-and-deletion) and [matching removal flags](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-removefontresourceexw). Do not delete the fixture fonts while a native run is active.

Select one `-Case 0..23` per invocation. The attempt records worker logs, progress, native observations and parent font cleanup under `runs/case-NN`; an existing attempt directory is rejected to preserve evidence. A failed or timed-out Office invocation is never retried automatically. Only fixtures opened by this worker may be closed, and opening an already-open fixture is rejected. Stopping a helper does not prove Office fixture cleanup completed. `compare-case` evaluates one case and explicitly records partial coverage. After all 24 cases have completed successfully, run `node test/native-text.mjs compare artifacts/native-text-new` for the full 72-import gate. Generate a separate fresh directory for each pinned Node runtime.

The native harness is prepared to check editable lines and their accepted anchors, save/reopen, inserted native text and renamed shapes. Separate white-on-black masks include the native glyph paint and text decorations. The comparison keeps the browser fixture's 0.1-reference-pixel containment gate and records failures before exiting nonzero. Native font descriptors and registered font bytes do not prove which font file Office selected for every glyph. Byte-identical native save/reopen rasters do not establish browser/native equivalence.

**Windows validation, 2026-09-10:** Node 20.20.2 and 24.20.0 each completed all 24 separate bounded text cases: 144 editable lines, 72 original/saved/edited imports, 24 byte-identical original/reopened PNG pairs, and 96 original-text ink masks with zero containment failures. All four temporary font registrations were removed after every case. Actual dummy-worker failure and timeout controls also confirmed parent font removal. The two generators produced identical fixture bytes, geometry, font files and runtime hashes. These results do not establish font-file selection for every glyph or browser/native pixel equivalence.

The chart gate remains separate. Explicitly rebinding the existing source range after an embedded-cell edit corrected stale chart caches for the first selected workbook. Additional COM observations return null category entries for pie charts even though saved chart XML and visible legends retain the categories; that discrepancy remains unresolved. A chart diagnostic also triggered a PowerPoint chart-module crash, with the precise triggering call unknown. The historical [resume evidence](https://github.com/OpenPresentation/opf/blob/codex/shared-metric-integration-20260910/docs/evidence/native-resume/README.md) records the earlier blocked activation. Current raw outcomes, exact verifiers and scope are retained in the Windows evidence branch.

Run only one native Office test at a time. Close only the presentations or embedded workbooks opened by that test; never quit Office or infer that a null COM property means there are no user files. If Office waits for a modal interaction, retain partial evidence and resolve that interaction before starting another test. A terminated helper may leave its generated fixture open; verify its exact path before closing it. Existing metric tab-position and portrait-label ink counterexamples remain separate, unresolved gates.

## Bounded chart activation

The chart harness requires an explicit `-EditSlide` from 1 through 8 and activates exactly that workbook. Its hidden helper has a 45-second deadline (maximum configurable deadline: 60 seconds), captures stdout/stderr and writes `progress.json` before Office calls. Failure or timeout stops the run without a retry. A timeout terminates only the owned verifier process; it does not close Office or prove that generated-file cleanup completed. `test/native-process-check.ps1` tests literal arguments, successful/failed exits and timeout termination using dummy scripts without Office.

The worker retains its process handle before waiting. Windows PowerShell 5.1 otherwise returned a null exit code for a completed successful helper on the Windows test host, causing the parent to report failure. Run the existing controls in fresh directories under both supported PowerShell hosts before Office testing:

```powershell
powershell.exe -NoProfile -NonInteractive -File test/native-process-check.ps1 -OutputDirectory artifacts/process-controls-winps
pwsh.exe -NoProfile -NonInteractive -File test/native-process-check.ps1 -OutputDirectory artifacts/process-controls-pwsh
```

These controls establish helper exit-code and deadline behavior only; they do not establish Office readiness or export fidelity.

After resolving the Excel dialog or cell-edit state, use a fresh directory for one controlled chart check:

```powershell
node test/native-chart-colors.mjs generate artifacts/native-chart-slide1
./test/native-chart-colors.ps1 -EvidenceDirectory artifacts/native-chart-slide1 -EditSlide 1
node test/native-chart-colors.mjs compare artifacts/native-chart-slide1
```

A passing comparison covers all eight original/saved charts and **one selected workbook edit**. Complete edit coverage still requires successful fresh runs for every slide on both supported Node versions. Do not loop or automatically retry while an Office dialog is open. The user supplied a PowerPoint warning that Excel had an open dialog or remained in editing mode; the exact underlying Excel condition has not yet been established. There is no product-code or export-fidelity fix claimed by the worker controls.
