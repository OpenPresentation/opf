# Native mixed-size edit harness

This bounded Windows harness opens one owned copy of the reviewed mixed-size table fixture, replaces the final run `exact` with `saved` at the same character length, saves that presentation, reopens the exact saved path read-only, and records original, edited, and reopened content. It does not call `Application.Quit`, kill Office, change Office security, or edit `p:hf`. [`Presentation.SaveAs`](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.presentation.saveas) is exactly `SaveAs($savedPath,24,0)`: the third argument is `msoFalse`, so the harness explicitly does not request font embedding.

The read-only observation on 2026-09-21 already passed content, style, and outer geometry within 0.02 points. Native line intervals were `[0,92)`, `[92,194)`, `[194,245)`. The estimated preview was `[0,78)`, `[78,172)`, `[172,245)`. That preview mismatch stays a recorded limit. `test/native-mixed-edit-audit.mjs` does not fail a run for it. Content, exact five-run styles, seven bounded character styles, literal tab, and the 0.02 point outer-geometry comparisons stay in force. Range bounds must be finite evidence but are not compared with the 0.02 point outer-geometry gate. Edited and reopened line records must be positive, contiguous source intervals that cover all 245 UTF-16 units, and their intervals must match each other. They do not have to equal the earlier read-only intervals.

Invocation safety is a PowerShell AST check. `Get-MixedEditNumericLiteralValue` unwraps `ParenExpressionAst`, then accepts a constant or a unary minus. `-PureRegression` evaluates `Write-MixedEditStage` before `Invoke-MixedEditCom`, points `$script:stageFile`, `$script:progressFile`, and `$script:sequence` at a temp directory, and deletes that directory in `finally`. Throw strings and comments are not invocations.

## Offline controls

These commands do not start Office:

```powershell
node test/native-mixed-edit-controls.mjs
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-mixed-edit.ps1 -PureRegression
```

`npm run test:native-mixed-edit-controls` runs on Linux and Windows CI. The Node controls assert the 0.02 point outer-geometry gate, reject missing or non-finite numeric evidence, incomplete line coverage, content and style drift, a relaxed tolerance, and an unknown Office-stop state. They build a fresh synthetic evidence directory from the canonical checked-in source fixture and the installed `@expo-google-fonts/carlito` package, then verify actual file hashes, the four-entry registration/removal ledger, owned paths, ordered begin/success stages, the exact two owned closes, `progress.json`, and the raw terminal supervisor. CLI controls cover a successful audit, malformed or missing inputs, mutations, and refusal to overwrite an existing `audit.json`. Windows CI also runs `-PureRegression`, which parses this script and exercises the COM failure latch without creating an Office object.

The directory audit is fail closed. It requires the source fixture hash, license hash, four font hashes and numeric registration flag `0`; the exact worker, process-helper, and font-helper snapshots beside the audit; raw saved PPTX and three PNG hashes; worker exit without timeout; supervisor cleanup; and the complete ordered open, save, close, reopen, close, terminal lifecycle. Every non-singleton Office stage must be an adjacent `begin`/`success` pair. The two cleanup records, initialization, and terminal record are the only singleton successes. `progress.json` must equal the final `worker.complete` stage, and the supervisor timestamp must follow it.

The CLI writes `audit.json` with exclusive-create semantics. It never rewrites `report.json`, `supervisor.json`, or any native evidence. Run it only once in a preserved evidence directory; a second invocation returns a nonzero exit and leaves the first audit unchanged. Font programs remain local inputs for the native run and must not be published as evidence artifacts.

## Future Windows command

Use Windows PowerShell 5.1, desktop PowerPoint, a fresh output directory, the reviewed source `source.pptx` (`f92c5d5565afa1d03fc6df0cdc8d482771d5ebd5a5403f7a888f75e2ad020a51`), and a Carlito fixture directory whose four font hashes and numeric `registration.flags` of `0` match the reviewed fixture. The offline regression controls do not constitute a new native Office run.

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-mixed-edit.ps1 -OutputDirectory artifacts/windows-native-mixed-edit-01 -InputPresentation PATH_TO_OPF\docs\evidence\windows-native-mixed-table-20260921\native-run\inputs\table-fixture\source.pptx -FontFixtureDirectory PATH_TO_CARLITO_FIXTURE
node test/native-mixed-edit-audit.mjs artifacts/windows-native-mixed-edit-01
```

The PowerShell exit code confirms the owned Office and font lifecycle. It does not self-certify the offline metric gate: the raw report and supervisor keep `gatePassed`/`metricsGatePassed` null. The Node CLI independently writes the immutable audit and returns nonzero when any gate fails. The parent starts one hidden worker through `native-process.ps1` with a 45 second deadline (maximum 60). A timeout may terminate only that helper. The four pinned Carlito faces are registered with session flags `0` in the surviving parent and only registrations that the parent successfully added are removed in `finally`. There is no retry.
