# FF-05 E8 font-query-order evidence (2026-09-29)

The two `Presentation.Fonts` snapshots were equal during this one bounded, read-only observation of the exact E7 control. Both ordered collections reported index 1 with an empty name (`Embedded=0`, `Embeddable=0`) and index 2 with Aptos (`Embedded=0`, `Embeddable=-1`). The second collection was reacquired after the existing theme, slide text and master-shape queries, immediately before the ownership-checked close. This specific query sequence and elapsed interval produced no change. It does not establish that query order or initialization time never matters, locate Aptos's root cause, identify a physical font or glyph, pass a font allowlist, or demonstrate embedding. **FF-05 remains open.**

## Input and ancestry

The included [input](fixture/calibri-explicit-slots-control.pptx) is a byte copy of the accepted [E7 explicit-slot control](../windows-native-explicit-slots-20260929/README.md), SHA-256 `4e2bab2a4f5a0f09350d2edc2463bcb29302fa7db34a8c621e39fcd5c9a16cd7` (15,616 bytes). Its E7 bundle preserves the E6 parent, four theme attribute changes and deterministic preparation history. E8 uses that exact input without deriving or repacking it; this bundle does not duplicate the E7 generator or its dependencies. The original and owned snapshot hashes remained equal. The input contains no font programs, embedded-font relationships or literal Carlito/Aptos names in ZIP entry contents.

## Recorded native observation

`native-inventory-01/` preserves the single actual E8 attempt and its original offline audit without rebinding paths or rewriting records. Strict boolean `compareAfterContentFonts=true` is present in request, report and supervisor. `presentationFonts` and `fontLedger` describe the first collection; `presentationFontsAfterContent` and `fontQueryComparison` describe the second collection and exact name/flag comparison. Both collections are complete within the independent 64-entry bounds. Ordered entries, names in order and full name/flag multisets all compare equal, with separate before/after Aptos and empty-name findings.

The owned helper process was PID 2808, from `2026-09-29T15:07:36.5509998Z` to `2026-09-29T15:07:37.9558843Z` (approximately 1,405 ms at millisecond resolution), within its 45-second deadline. There were 303 contiguous expected stages, one owned read-only open and one owned close, confirmed cleanup, unchanged input bytes, zero temporary registrations, and no semantic failures, exceeded bounds or audit failures. The first collection acquisition began at `15:07:37.1595987Z`; the second began at `15:07:37.8560631Z`, about 697 ms later. These are recorded stage timestamps, not a controlled initialization-time experiment. No owned presentation was edited, saved, exported or reopened, and Office was not quit or terminated.

All six reported theme slots—major/minor Latin, East Asian and complex script—were Calibri. All six inspected slide whole-range/paragraph/run Font2 records reported Calibri for `Name`, `NameAscii`, `NameFarEast` and `NameComplexScript`; `NameOther` was empty. The first-snapshot ledger reports Aptos only in `Presentation.Fonts`, Calibri in slide/theme slots, and no master text names. Empty collection names are retained separately from nonempty name ledgers. Passing inventory/audit status establishes consistency of the recorded lifecycle and observations, not physical font identity or an allowed-font result.

The authored host sidecars record PowerPoint Home without an open presentation or recovery/security/dialog prompt before and after the attempt. They measure PowerPoint PID 5288, full file/product version `16.0.20430.20092`, started at `14:52:46.9201081Z`. PowerPoint had been absent after computer sleep and was launched through supported UI for this resumed session; this was its first native inventory run in that process. The COM application version was `16.0`. UI observations are authored sidecars, not independently proved by this portable verifier. No screenshot or private recent-file name is stored here.

E7 used the earlier PowerPoint process, PID 30776. E7 and E8 therefore do **not** form a comparison within one process; native cache/process state and elapsed initialization are additional variables. The matching input hash alone does not control those variables.

## Source and review boundary

The actual native source graph is preserved in the preflight sidecar:

| Repository | Native head |
| --- | --- |
| core | `9261eac59011cec04aebc3c9003809f05c7b1cd3` |
| opf-pptx | `9a7f3c1513c5875b4ac9d5974c04151a4ac26cbe` |
| opf-render | `c62b3f98a4ac98cdec8ffd28c035a17a04197396` |
| opf-editor | `d0c95a16b50eccb3eee695ace44cc6c3a6754f2f` (not used by this inventory) |
| pptx-gallery | `f17e9ae5869669d5fbac3720f285652d0c37551c` (not used by this inventory) |

The harness was merged in [opf-pptx#88](https://github.com/OpenPresentation/opf-pptx/pull/88). Its merged head and independently reviewed head `2822107cde8549b5150dab49fed403b52e9a232d` have the same Git tree, `5807a63ab571c173689e995ef69991f19aaff82b`. The owner reported an Actions credit shortage and explicitly accepted local tests and independent review as the merge gate; the merge at 15:05:40 UTC did not wait for both Actions jobs. Subsequent inspection recorded [automatic run 36586642012](https://github.com/OpenPresentation/opf-pptx/actions/runs/36586642012) with successful Linux and Windows jobs (finished at 15:05:06 and 15:12:44 UTC respectively). Those Actions results, local checks and this native observation are separate receipts. The later core publication branch began at `b3c8fbf762d975bd2e7d65d56b7e9838c94ae2e7`; that later head was not the core graph used for E8.

`auditor/` preserves the exact reviewed inventory PowerShell worker, original offline auditor, process/font companions, embed-audit helper and scanner. The worker and both PowerShell helpers match the immutable attempt's input snapshots. The original offline auditor needs its package dependencies and checks the original machine paths. Do not run its CLI against the relocated immutable attempt or call that a fresh native audit; the original actual audit is preserved as evidence.

## Portable verification

Use Node 24.21.0:

```sh
node verify.mjs
```

The read-only verifier uses only Node built-ins. It requires no installed packages, original absolute paths, fonts, Office or network. It checks exact bundle membership and byte-copy provenance; pinned input and companion hashes; absence of detached font files; strict comparison mode; complete bounded collections and exact flags; independently recomputed first-snapshot ledger and comparison; all expected content and second-read stages, ownership transitions, timing, input bindings and recorded sidecar consistency. The exact input hash binds the prior E7 derivation and no-embedded-font proof; E8 does not repeat that ZIP derivation audit. It does not replay Office or independently prove the authored UI observation. Raw absolute paths are compared as strings between records and are never opened.

The recorded invocation shape is shown for review, not as authorization to start another native attempt:

```powershell
powershell.exe -NoProfile -NonInteractive -File test/native-font-inventory.ps1 `
  -InputPresentation '<exact E7 input path>' -ControlDeck `
  -CompareAfterContentFonts -OutputDirectory '<fresh actual output>' -TimeoutSeconds 45
node test/native-font-inventory-audit.mjs '<that actual output>'
```

`invocation/` preserves the parent/audit logs and one-attempt exit receipt. `source-copy-ledger.json` records every byte copy's relative artifact origin, size and matching hashes. `manifest.json` hashes every other bundle file, and `.gitattributes` disables line-ending conversion. No fonts or proprietary files are included. This unchanged result applies only to the recorded query sequence and timing; root-cause, allowlist, embedding and physical glyph acceptance remain unresolved.
