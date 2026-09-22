# Native mixed-size edit harness

This bounded Windows harness opens one owned copy of the reviewed mixed-size table fixture, replaces the final run `exact` with `saved` at the same character length, saves that presentation, reopens the exact saved path read-only, and records original, edited, and reopened content. It does not call `Application.Quit`, kill Office, change Office security, edit `p:hf`, or pass an `EmbedFonts` argument.

The read-only observation on 2026-09-21 already passed content, style, and outer geometry within 0.02 points. Native line intervals were `[0,92)`, `[92,194)`, `[194,245)`. The estimated preview was `[0,78)`, `[78,172)`, `[172,245)`. That preview mismatch stays a recorded limit. `test/native-mixed-edit-audit.mjs` does not fail a run for it. Content, style, literal tab, and the 0.02 point outer-geometry comparisons stay in force. Edited and reopened native line intervals must still match each other.

Invocation safety is a PowerShell AST check. `Get-MixedEditNumericLiteralValue` unwraps `ParenExpressionAst`, then accepts a constant or a unary minus. `-PureRegression` evaluates `Write-MixedEditStage` before `Invoke-MixedEditCom`, points `$script:stageFile`, `$script:progressFile`, and `$script:sequence` at a temp directory, and deletes that directory in `finally`. Throw strings and comments are not invocations.

## Offline controls

These commands do not start Office:

```powershell
node test/native-mixed-edit-controls.mjs
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-mixed-edit.ps1 -PureRegression
```

`npm run test:native-mixed-edit-controls` runs on Linux and Windows CI. The Node controls assert the 0.02 point gate, reject content and style drift, reject a report that claims the gate passed while the text is wrong, and accept the known preview line-break mismatch. Windows CI also runs `-PureRegression`, which parses this script and exercises the COM failure latch without creating an Office object.

## Future Windows command

Use Windows PowerShell 5.1, desktop PowerPoint, a fresh output directory, the reviewed source `source.pptx` (`f92c5d5565afa1d03fc6df0cdc8d482771d5ebd5a5403f7a888f75e2ad020a51`), and a Carlito fixture directory whose four font hashes and `registration.flags` of `0` match the reviewed fixture. This command was not run in the cloud VM.

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-mixed-edit.ps1 -OutputDirectory artifacts/windows-native-mixed-edit-01 -InputPresentation PATH_TO_OPF\docs\evidence\windows-native-mixed-table-20260921\native-run\inputs\table-fixture\source.pptx -FontFixtureDirectory PATH_TO_CARLITO_FIXTURE
node test/native-mixed-edit-audit.mjs artifacts/windows-native-mixed-edit-01
```

The PowerShell exit code confirms the owned Office and font lifecycle. The Node audit applies the content, style, and 0.02 point outer-geometry gates. The parent starts one hidden worker through `native-process.ps1` with a 45 second deadline (maximum 60). A timeout may terminate only that helper. Session font registration stays in the surviving parent. There is no retry.
