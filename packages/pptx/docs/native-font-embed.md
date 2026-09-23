# Native font embed harness

This bounded Windows helper is separate from [Gate E native font edit](./native-font-edit.md). It accepts only the four canonical Carlito face hashes, the canonical OFL license hash, registration flags equal to the JSON integer `0`, and the fixture `source.pptx`. It can request font embedding on one owned presentation with PowerPoint [`Presentation.SaveAs`](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.presentation.saveas) file format `24` and third argument `-1` (`msoTrue`).

Gate E continues to call `SaveAs(..., 24, 0)` and does not prove embedding. This helper enumerates the exact edited presentation's bounded `Presentation.Fonts` collection before `SaveAs`. Every reported name must be one of `Carlito`, `Carlito Bold`, `Carlito Italic`, or `Carlito Bold Italic`; base `Carlito` must be present; and every entry must report `Embeddable = -1`. An unexpected name such as the previously observed Aptos fails closed. The helper records the gate, marks the owned source snapshot as already saved, closes that exact owned object without writing its edits, and never calls `SaveAs` for that attempt.

COM `Font.Name`, `Embedded`, and `Embeddable` do not prove which physical TTF drew each glyph. A prior allowlist failure cannot be bypassed by the embed request. The prior Carlito+Aptos observation remains a failure; this worker must reject any unexpected name before `SaveAs`, record exact-owned cleanup, and never retry the attempt.

## Parent-owned lifecycle

The parent matches Gate E safety: indexed COM stages, a 45-second owned worker with a 60-second parameter maximum (`native-process.ps1`), timeout kills only that worker, never Office or descendants, never `Application.Quit`, never closes a presentation this run did not open, and never changes global PowerPoint security. It uses a fresh output directory and never retries an attempt. All copied inputs are hash-checked before any temporary font registration. Carlito session registration uses `native-text-fonts.ps1` with flags `0` in the surviving parent only. A COM failure latches all later Office calls and leaves cleanup unconfirmed; the semantic font-gate failure path may perform only the explicit discard and exact-owned close described above.

## Generate fixture

Use the existing Gate E generator:

```powershell
node test/native-font-edit-fixture.mjs artifacts/font-embed-fixture-new PATH_TO_REGISTRY_CONSUMER
```

## Supervised embed attempt (Windows)

Do not use this command to override a failed native font allowlist. The current Carlito+Aptos observation predicts a recorded semantic failure with no saved copy. Preserve that attempt for review rather than retrying it.

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-font-embed.ps1 `
  -OutputDirectory artifacts/windows-native-font-embed-01 `
  -InputPresentation artifacts/font-embed-fixture-new/source.pptx `
  -FontFixtureDirectory artifacts/font-embed-fixture-new
```

For an attempt that passed the native gate, completed the owned close and parent cleanup, and produced `native-font-embed.pptx`, audit the evidence directory without Office. Select a fresh attempt directory: the audit refuses to overwrite an existing `embed-opc-audit.json`.

```powershell
node test/native-font-embed-audit.mjs artifacts/windows-native-font-embed-01
```

## Stage records

Successful stage records must serialize `error` as JSON `null`. `Write-FontEmbedStage` keeps its error parameter untyped because a PowerShell `[string]` parameter coerces `$null` to an empty string, which the audit rejects for every stage. The mixed-size harness hit exactly this defect in its first native attempt on 2026-09-22. `-PureRegression` writes one successful and one failed stage and checks their serialized form.

## Non-Office regression

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-font-embed.ps1 -PureRegression
```

```bash
npm run test:native-font-embed-controls
```

The audit binds the raw worker, supervisor, progress, registration, request, input snapshot, stage, saved-package, and verifier/helper evidence. It requires one successful native font gate before one paired embed `SaveAs`, one exact owned close, four canonical registrations/removals, unchanged canonical inputs, and a matching saved-package hash. It also validates the font-related OPC structure: unique ZIP member names, content types, unique relationship IDs, internal non-traversing Presentation-to-font relationships, one unique `Carlito` entry with regular/bold/italic/bold-italic references, and exactly four nonempty referenced `.fntdata` parts with no extras or dangling relationships.

The font structure check expects the `p:`/`r:` prefixes and one root declaration for each required namespace. Alternate prefixes or repeated namespace declarations are rejected, even when valid OOXML.

This is structural embedding evidence. The audit records hashes of the raw, possibly obfuscated package parts. It does not deobfuscate them, identify a physical font file, prove that a part equals a permitted fixture TTF, establish per-glyph font identity, or authorize an unknown/additional part. Physical identity remains unresolved until a separate reviewed container/deobfuscation check exists. Font programs are test inputs and must never be published in evidence bundles.
