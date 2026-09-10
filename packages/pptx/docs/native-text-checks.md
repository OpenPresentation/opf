# Native accepted-text checks

This is an unpublished verifier for the shared placement integration. PowerPoint is an optional Windows compatibility-test dependency; OPF authoring, layout, rendering, editing and conversion remain local and independent of Office.

Use coordinated source checkouts and the pinned Node 20.20.2 or 24.20.0 toolchain. From this repository, generate a new evidence directory:

```powershell
node test/native-text.mjs generate artifacts/native-text-new
./test/native-text.ps1 -EvidenceDirectory artifacts/native-text-new -FontsOnly
./test/native-text.ps1 -EvidenceDirectory artifacts/native-text-new
node test/native-text.mjs compare artifacts/native-text-new
```

Generation reuses the existing 24-case editable-text matrix: wide/portrait, left/center/right, scalar/rich text and cards. It records accepted geometry, runtime/verifier hashes, actual PPTX bytes and the four pinned Carlito faces with their license. Plain text still uses the current whitespace-normalizing fitter. Requested Aptos is an explicit visual substitution, not a verified Aptos-compatible face.

`-FontsOnly` checks temporary font registration and removal without calling PowerPoint. The full native run registers these same font files for the current Windows session, broadcasts the font-table change, and removes exactly its own registrations in `finally`. It writes no font registry entries or permanent system files. This follows Microsoft's [temporary font installation API](https://learn.microsoft.com/en-us/windows/win32/gdi/font-installation-and-deletion) and [matching removal flags](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-removefontresourceexw). Do not delete the fixture fonts while a native run is active.

The native harness is prepared to check editable lines and their accepted anchors, save/reopen, inserted native text and renamed shapes. Separate white-on-black masks include the native glyph paint and text decorations. The comparison keeps the browser fixture's 0.1-reference-pixel containment gate and records failures before exiting nonzero. Native font descriptors and registered font bytes do not prove which font file Office selected for every glyph. Byte-identical native save/reopen rasters do not establish browser/native equivalence.

**Current status:** Node 20/24 fixture generation and the Windows temporary-font preflight pass. The full native text harness has not run yet. A separate chart test opens/saves/reopens eight charts, with 16 exact original/saved data imports and eight unchanged native raster pairs, but embedded Excel activation stalls on its second chart. Its first COM enumeration failure was corrected by using one-based `Count`/`Item` access. The complete chart edit/reimport gate remains open. See the [portable resume evidence](https://github.com/OpenPresentation/opf/blob/codex/shared-metric-integration-20260910/docs/evidence/native-resume/README.md).

Run only one native Office test at a time. Close only the presentations or embedded workbooks opened by that test; never quit Office or infer that a null COM property means there are no user files. If Office waits for a modal interaction, retain partial evidence and resolve that interaction before starting another test. A terminated helper may leave its generated fixture open; verify its exact path before closing it. Existing metric tab-position and portrait-label ink counterexamples remain separate, unresolved gates.

## Bounded chart activation

The chart harness requires an explicit `-EditSlide` from 1 through 8 and activates exactly that workbook. Its hidden helper has a 45-second deadline (maximum configurable deadline: 60 seconds), captures stdout/stderr and writes `progress.json` before Office calls. Failure or timeout stops the run without a retry. A timeout terminates only the owned verifier process; it does not close Office or prove that generated-file cleanup completed. `test/native-process-check.ps1` tests literal arguments, successful/failed exits and timeout termination using dummy scripts without Office.

After resolving the Excel dialog or cell-edit state, use a fresh directory for one controlled chart check:

```powershell
node test/native-chart-colors.mjs generate artifacts/native-chart-slide1
./test/native-chart-colors.ps1 -EvidenceDirectory artifacts/native-chart-slide1 -EditSlide 1
node test/native-chart-colors.mjs compare artifacts/native-chart-slide1
```

A passing comparison covers all eight original/saved charts and **one selected workbook edit**. Complete edit coverage still requires successful fresh runs for every slide on both supported Node versions. Do not loop or automatically retry while an Office dialog is open. The user supplied a PowerPoint warning that Excel had an open dialog or remained in editing mode; the exact underlying Excel condition has not yet been established. There is no product-code or export-fidelity fix claimed by the worker controls.
