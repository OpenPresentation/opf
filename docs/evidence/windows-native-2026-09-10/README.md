# Windows native PowerPoint evidence, 2026-09-10

The accepted-text matrix now has successful real PowerPoint evidence on both pinned Node runtimes. Both runtimes also reproduce the eight metric tab failures and the portrait/right ink overflow. Charts have a corrected source-refresh experiment and unresolved COM observations. Metric fixes and broader native coverage remain open. This is a bounded Windows testing checkpoint, not an export-equivalence or release approval.

## Results

| Check | Result and retained evidence |
| --- | --- |
| Accepted text, Node 20.20.2 | 24 separately bounded cases; 144 editable lines; 72 exact original/saved/edited imports; 24 unchanged save/reopen PNG pairs; 96 passing original-text ink masks. `raw/text-node20-bounded-01/comparison.json`. |
| Accepted text, Node 24.20.0 | Same complete counts and passing gates. `raw/text-node24-bounded-02/comparison.json`. The generators produced identical fixtures, geometry, font files and runtime hashes; see `text-two-runtime-summary.json`. |
| Metrics, both Node runtimes | Six separately bounded native runs / 48 slides per runtime, with all 144 original/saved/edited imports passing. Both reproduce eight tab outliers (maximum 0.0673828125 points) and one native portrait/right ink overflow at x=497 beyond 496.8. Character bounds, inter-part collisions and isolated-mask coverage pass. The fidelity comparison remains failed; see `raw/metric-node20-bounded-01/comparison.json`, `raw/metric-node24-bounded-01/comparison.json` and `metric-two-runtime-summary.json`. |
| Temporary font cleanup | Every native case removed its four owned Carlito registrations. `raw/font-parent-controls-02` also verifies removal after real dummy-worker exit 17 and timeout, without Office. The first control miscounted a PowerShell 5.1 JSON array; its raw record in `font-parent-controls-01` confirms all four actual removals succeeded. |
| Worker exit status | Windows PowerShell 5.1 initially returned a null successful exit code. Retaining the exact process handle fixed it. Existing success/literal-argument, exit-17 and timeout controls passed in Windows PowerShell and PowerShell 7. Initial and passing records remain under `raw/process-controls-*`. Fix: [PPTX #17](https://github.com/OpenPresentation/opf-pptx/pull/17), reviewed and merged. |
| Embedded chart edit, initial attempt | Editing worksheet cells then calling `Chart.Refresh` left stale chart caches. Current workbook cells and stale chart XML are both retained in `raw/chart-node24-slide1/saved-workbook-inspection.json`; the comparison failure is preserved. |
| Explicit chart source range | Rebinding the existing worksheet range with `SetSourceData` yielded 24 passing original/saved/edited chart imports for one selected workbook, slide 1. `raw/chart-node24-slide1-source-range/comparison.json`. This intermediate verifier did not yet check native edited-series observations. Its exact bytes were restored from this task's original patch record and verified against the generation hashes. |
| Stronger chart observations | `raw/chart-node24-slide1-observed` retains all three native phases and the failing COM-category gate. Pie `Series.XValues` contains null entries, although saved chart XML and visibly inspected legends retain Q1/Q2. All eight original/reopened PNG hashes agree; only the edited slide changes afterward. No full chart-edit pass is claimed. |
| Chart diagnostic crash | `raw/pie-value-probe` retains the RPC failure and Windows application error for `chart.dll`, exception `0xc0000005`. The exact triggering call is unknown. A narrower fresh-copy probe under Windows PowerShell completed, confirmed actual null array elements, and closed only its own copy; see `raw/pie-values-safe`. It did not read `Series.Formula`. |

PowerPoint was build 16.0.20326.20132 on Windows 26200.9445. Native helpers used Windows PowerShell 5.1.26100.9444. The user reviewed the recovered presentations and explicitly resumed computer use after an earlier Escape. Pre-existing recovered presentations were preserved; no Office process was killed and no `Application.Quit` was used. A timeout terminates only the owned helper and does not prove Office fixture cleanup completed.

## Scope and open gates

The text checks preserve the existing containment rule: every nonzero white-on-black mask pixel center must lie within its accepted box plus 0.1 reference pixel. Masks include decorations. The suite checks actual native edits, renamed shapes, accepted anchors, saved current text and reimported words/headings. Masks cover original text; edited content is checked for save/reopen and current-content import. It does not certify edited-text reflow, arbitrary round trips, browser/native pixel equivalence or which font file Office selected for every glyph. Requested Aptos uses an explicit visual substitution with the four pinned, openly licensed Carlito faces.

Full chart-edit coverage still requires separate successful fresh runs for slides 1–8 on both Node versions. The added pie COM-category gate remains unresolved. The original chart fixture requests unmeasured Roboto, so these chart checks are not font-fidelity evidence. Metric tab discrepancies above 0.02 points and the portrait/right Latency ink counterexample were reproduced unchanged on both runtimes and remain unresolved. Original and native-saved tab coordinates remain precise in DrawingML (`raw/metric-node24-bounded-01/tab-xml-diagnostic.json`); this does not establish whether native shaping, character-bound reporting or both explain the discrepancy. The metric layout still lacks the general text placement's outline clearance. Representative tables, quotes, code, images, editing/undo and repeated exports remain additional work.

The bounded text harness is [PPTX #18](https://github.com/OpenPresentation/opf-pptx/pull/18), reviewed and merged by the Mac owner. Its parent owns temporary fonts and removes them in `finally`, independently of the deadline-bound Office worker. The separately bounded metric harness is [PPTX #19](https://github.com/OpenPresentation/opf-pptx/pull/19). Product runtime, release refs, packages and public deployments did not change.

## Reproduction and byte verification

Use four named sibling checkouts at the immutable commits in `sources.json`, install their locked dependencies and link/build them with core's `scripts/link-ecosystem.mjs --packages-only`. Apply the cited harness commits for fresh tests. Use Windows desktop PowerPoint with no blocking dialog and preserve all existing documents. Run one Office verifier at a time. New invocations must use new attempt paths; never retry a blocked activation automatically.

From the PPTX checkout, with Node 20.20.2 or 24.20.0 selected:

```powershell
node test/native-text.mjs generate artifacts/native-text-new
powershell.exe -NoProfile -NonInteractive -File test/native-text-fonts-check.ps1 -EvidenceDirectory artifacts/native-text-new -OutputDirectory artifacts/font-controls-new
powershell.exe -NoProfile -NonInteractive -File test/native-text.ps1 -EvidenceDirectory artifacts/native-text-new -Case 0
node test/native-text.mjs compare-case artifacts/native-text-new 0
```

Continue with each distinct case 1–23 only after the previous attempt completes and its comparison is understood. Then run `node test/native-text.mjs compare artifacts/native-text-new`. Each runtime needs its own generated directory. A full comparison requires all 24 cases; a single-case comparison is explicitly partial. Stop if Office needs interaction and inspect the exact state before continuing independent tests.

For metrics, use `node test/native-metric.mjs generate artifacts/native-metric-new`, then one invocation of `powershell.exe -NoProfile -NonInteractive -File test/native-metric.ps1 -EvidenceDirectory artifacts/native-metric-new -Deck metric-1280-left`. Compare it with `node test/native-metric.mjs compare-deck artifacts/native-metric-new metric-1280-left`. The other distinct deck IDs use widths 1280/540 and left/center/right alignment. The full `compare` requires all six native records and intentionally exits nonzero for the preserved counterexamples. See the metric PR's `docs/native-metric-checks.md` for scope and controls. No proprietary reference font bytes are included.

The evidence includes exact verifier snapshots and open-source runtime files identified by each generation. The local `.gitattributes` disables text conversion so CRLF/LF differences cannot silently change the recorded hashes. `bindings.json` maps every generation to its matching verifier snapshot. The manifest covers every tracked evidence file, excludes itself to avoid recursion, and rejects Office lock files. No proprietary font bytes, outlines or Office binaries are retained.

From the core checkout:

```powershell
node docs/evidence/windows-native-2026-09-10/verify-evidence.mjs index
node docs/evidence/windows-native-2026-09-10/verify-evidence.mjs HEAD
```

The first command reads staged Git blobs; the second reads committed Git blobs. Both verify file sizes/hashes, complete manifest coverage, runtime/verifier bindings and original fixture/font hashes. Fresh native evidence may differ across Office builds and rasterizers; retained raw failures must not be relabelled as passes.
