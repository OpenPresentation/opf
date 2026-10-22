# Native-created tab control v2

This bounded Windows control creates one blank 960 x 540 PowerPoint slide with nine tab/literal textbox pairs. It measures the presentation before close and after a read-only reopen, using a fresh owned output directory and the fail-closed supervisor/worker lifecycle used by the current native picture controls.

The requested tab offsets are exactly `16.25`, `16.26`, `16.27`, `16.27734375`, `16.28`, `16.29`, `16.30`, `16.31`, and `77.3173828125` points. Each tab textbox contains the literal sequence U+0009 followed by `Before`; each comparison textbox contains exactly `Before`, with no leading or trailing whitespace. Both use Calibri at 13.5 points and the same margins, wrapping, sizing, paragraph, bullet, ruler, white-text, and black-background values as the historical control.

PowerPoint creates all content directly. [`Shapes.AddTextbox`](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.shapes.addtextbox) defines textbox geometry in points. The control clears existing [`TabStops`](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.tabstops) and uses [`TabStops.Add`](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.tabstops.add) with a left tab and each explicit point value. It reads `TextRange2` font name and size through the documented [`Font` property](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.textrange2.font). Its bounds are native [`TextRange2.BoundLeft`](https://learn.microsoft.com/en-us/office/vba/api/office.textrange2.boundleft), `BoundTop`, `BoundWidth`, and `BoundHeight` values for the leading tab, the tabbed `Before`, and the directly positioned literal `Before`. These bounds describe text bounding boxes rather than text-frame edges.

## Run one fresh attempt

Use Windows PowerShell 5.1 from a coordinated checkout with desktop PowerPoint available. The output path must not exist:

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-tab-control-v2.ps1 -OutputDirectory artifacts/native-tab-control-v2-01
```

The parent snapshots the verifier and `test/native-process.ps1` before Office starts. It also records the exact Windows PowerShell host and installed `calibri.ttf` paths and hashes; it does not copy, install, embed, or redistribute the font. The hidden owned worker has a 45-second deadline by default, configurable only from 5 through 60 seconds. There is no automatic retry.

Before an Office run, execute the pure helper regression with Windows PowerShell 5.1:

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-tab-control-v2.ps1 -PureRegression
```

It parses the executing verifier and loads the actual `Invoke-ControlCom`, `Add-ControlTextBox`, `Get-PhaseMetrics`, `Get-PersistenceMetrics`, and `Get-ContentChecks` definitions. It runs the wrapper and textbox functions against a fake Shapes/TextFrame object, then exercises the metric functions with hand-specified `PSCustomObject` and `OrderedDictionary` observations. Those cases require the exact target to pass, a 0.03-point phase error to fail, 0.01-point persistence drift to pass, 0.03-point drift to fail, valid text to pass, and changed text to fail. A representative `[single]32.4`/`[single]48.7` pair is promoted to `Double`, round-tripped through Windows PowerShell 5.1 JSON, and required to produce byte-identical metric JSON before and after serialization. The regression makes no Office or COM call and writes no output file. It also requires the requested shape name and exact U+0009 + `Before` text to survive the wrapper, guarding PowerShell dynamic-scope parameter shadowing.

An already-recorded native report can exercise the metric functions without Office. The output path must be new:

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-tab-control-v2.ps1 `
  -ReplayMetricsReport artifacts/windows-resume-20260921/native-tab-v2-02/report.json `
  -RecoveredMetricsPath artifacts/windows-resume-20260921/native-tab-v2-02/metrics.recovered.json
```

This mode hashes and preserves the source report, loads the actual metric functions from the executing verifier, and evaluates the exact deserialized observations twice: once as their `PSCustomObject` report form and once recursively rebuilt as the `OrderedDictionary` form produced by the native worker. It requires byte-identical metric JSON from both forms, verifies the recorded PPTX, PNG, and worker-snapshot hashes, makes no Office or COM call, and refuses to overwrite either report or a prior recovery. Windows PowerShell 5.1 may deserialize a decimal JSON number as `Decimal`; its later conversion to `Double` can differ by approximately 1e-14 point from direct binary-double parsing. Equality between these two replay forms does not establish exact equality with the original in-memory metrics.

## Evidence and gates

`report.json` records the exact requested targets and literal strings, source PPTX path and pre/post-reopen hashes, verifier and process-helper snapshot hashes, Windows PowerShell executable hash, installed `calibri.ttf` hash, Windows and PowerPoint versions, original and reopened observations, and PNG paths and hashes. Each observation includes the slide and shape counts, tab-stop position, textbox names and positions, exact text, all four `TextRange2` bounds, and native font names and sizes. Native Single-valued positions, dimensions, tab stops, and font sizes are explicitly promoted to `Double` when the observation is captured. This preserves the underlying Single value through Windows PowerShell 5.1 JSON so metrics replayed from `report.json` reproduce the metrics calculated in the worker.

The 0.02-point results are calculated only after the original presentation and read-only reopened presentation have both closed successfully. The report retains tab-versus-target error, literal-versus-target error, tab-minus-literal difference, separate gates for each, and a save/reopen persistence gate. A failed metric gate is evidence, not a worker exception, so an expected tolerance miss cannot interrupt the owned close sequence. Text, names, shape counts, tab-stop counts, fonts, rasters, source bytes, and input hashes are reported independently.

`stages.jsonl` durably records `begin` and terminal status for every COM call and property read or write. `progress.json` contains the latest durable stage; `supervisor.json` records worker exit or timeout. A timeout preserves any readable worker report before forcing cleanup to unconfirmed.

The worker saves only `native-tab-control-v2.pptx`, exports only `original.png` and `reopened.png`, closes only the exact owned saved path, and reopens that path read-only. It creates no PDF, embeds no font, changes no installed font or Office security setting, never calls `Application.Quit`, never kills an Office process, never discards a presentation in a `finally` block, and never closes unrelated work. On a COM failure it stops Office operations immediately and does not attempt cleanup or retry. Retain a failed directory and inspect PowerPoint before any later native run.

## Relationship to the historical control

The results in [native-tab-control.md](native-tab-control.md) are historical evidence from an older helper. That control also produced a private PDF and reported a native 0.02-point failure around the requested `16.27734375`-point tab. V2 does not rerun, replace, or reinterpret those results. It removes the PDF and embedded-font-output risk, strengthens ownership and failure evidence, and records the current native observations for a separate offline gate.

The first v2 attempt on 2026-09-21 is also retained as failed evidence at `artifacts/windows-resume-20260921/native-tab-v2-01`. Its worker snapshot SHA-256 is `f57fcdf931a48f3f927310c294fabb13c0c0790351560fb7635c2237fe039a24`. PowerPoint saved the owned deck, then the worker stopped at `original.pair-0.tab.get` because every shape had received its wrapper stage label instead of its requested `tab-*` or `literal-*` name. Offline DrawingML inspection confirmed all 18 wrong names while preserving all 18 exact requested text values. The saved deck SHA-256 is `ec554b0e5cc07b89292d242b9269c64d721450585220b493625edad7297a95eb`; the separate UI-close record confirms that exact saved deck was closed without changing its bytes. This attempt has no native observations or metric result and is not a fidelity result.

The defect was PowerShell dynamic scope: the operation scriptblock referenced `Add-ControlTextBox`'s `$Name`, but `Invoke-ControlCom` also declared `$Name`, so the wrapper's stage label won at invocation time. V2 now calls that wrapper parameter `$StageName` and calls the textbox inputs `$RequestedShapeName` and `$RequestedText`. The pure regression above exercises those exact definitions before another native attempt.

The second v2 attempt completed both exact native closes with `cleanupConfirmed=true`, identical saved/reopened PPTX hashes, and identical original/reopened PNG hashes. It then failed during offline metric calculation because Windows PowerShell 5.1 does not project `OrderedDictionary` keys through `Measure-Object -Property`. That report remains a failed worker report with `metrics: null`; it must not be edited or relabeled. `Get-PhaseMetrics` and `Get-PersistenceMetrics` now accumulate maxima and gates directly while records are created, avoiding property projection entirely. The replay mode records separately recovered metrics from the immutable observations and covers both report and native record representations before another Office run is considered.

The third v2 attempt is retained at `artifacts/windows-resume-20260921/native-tab-v2-03`. The worker completed with exit code 0, `cleanupConfirmed=true`, and passing content, persistence, raster, and source checks. The original and reopened tab-target gate and pair-agreement gate both failed at the requested 0.02-point tolerance: the maximum tab-target error was `0.022655487060546875` and the maximum tab-minus-literal difference was `0.022678375244140625`; the literal-target gate passed. This is a successful worker lifecycle with failed metric gates, not a worker exception. The report SHA-256 is `65b6c3bbc2ff099c22b6cb68b34cc8873767c11eaf8643a4b2a02418d641e4ff`, the saved PPTX SHA-256 is `230ed8ca4a1d093965baf930401fc14b9fab8acd168584fa39faa43f7df293b5`, and both PNGs have SHA-256 `1a1dc6038e12f782cd1da8696fcf0f8a43612167649edf9d6f3bab3993c9a2fd`.

That immutable run-03 report also records a serialization limitation in the pre-fix verifier. Its observations contain Windows PowerShell 5.1's rounded JSON forms for native Singles, such as `32.4` and `48.7`, while the worker metrics were calculated after the in-memory Single values were cast to `Double`. A JSON-only replay can therefore produce the slightly different tab-target error `0.02265625`. The raw report remains unchanged and retained. Explicit promotion during observation capture fixes reproducibility for later reports without changing the native measurements, metric calculations, or gates used by run 03.

The fourth attempt, `native-tab-v2-04`, completed with the precision correction and confirmed both owned closes. All nine stored phase metrics reproduce exactly when Python parses the captured JSON numbers as binary doubles. The maximum tab-target error remains `0.022655487060546875` point and the maximum pair difference remains `0.022678375244140625` point, so the unchanged 0.02-point gates still fail. Exact text, save/reopen measurements, saved bytes and rasters remain stable. The full reopened slide was reviewed. This control isolates native-created plain tab behavior; it does not resolve mixed-size soft-wrapped table paragraph representation.
