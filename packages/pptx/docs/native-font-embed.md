# Native font embed harness

This bounded Windows helper is separate from [Gate E native font edit](./native-font-edit.md). It accepts only the four canonical Carlito face hashes, the canonical OFL license hash, registration flags equal to the JSON integer `0`, and the fixture `source.pptx`. It can request font embedding on one owned presentation with PowerPoint [`Presentation.SaveAs`](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.presentation.saveas) file format `24` and third argument `-1` (`msoTrue`).

Gate E continues to call `SaveAs(..., 24, 0)` and does not prove embedding. This helper enumerates the exact edited presentation's bounded `Presentation.Fonts` collection before `SaveAs`. Every reported name must be one of `Carlito`, `Carlito Bold`, `Carlito Italic`, or `Carlito Bold Italic`; base `Carlito` must be present; and every entry must report `Embeddable = -1`. An unexpected name such as the previously observed Aptos fails closed. The helper records the gate, marks the owned source snapshot as already saved, closes that exact owned object without writing its edits, and never calls `SaveAs` for that attempt.

COM `Font.Name`, `Embedded`, and `Embeddable` do not prove which physical TTF drew each glyph. A prior allowlist failure cannot be bypassed by the embed request. The prior Carlito+Aptos observation remains a failure; this worker must reject any unexpected name before `SaveAs`, record exact-owned cleanup, and never retry the attempt.

## Parent-owned lifecycle

The parent matches Gate E safety: indexed COM stages, a 45-second owned worker with a 60-second parameter maximum (`native-process.ps1`), timeout kills only that worker, never Office or descendants, never `Application.Quit`, never closes a presentation this run did not open, and never changes global PowerPoint security. It uses a fresh output directory and never retries an attempt. All copied inputs are hash-checked before any temporary font registration. Carlito session registration uses `native-text-fonts.ps1` with flags `0` in the surviving parent only. A COM failure latches all later Office calls and leaves cleanup unconfirmed; the semantic font-gate failure path may perform only the explicit discard and exact-owned close described above.

## Generate fixture

The plain Gate E fixture uses the default `aptos` font scheme (theme major/minor and slide runs), so this gate is expected to reject it. Use the Gate E generator in Carlito-only mode instead:

```powershell
node test/native-font-edit-fixture.mjs artifacts/font-embed-fixture-new PATH_TO_REGISTRY_CONSUMER --carlito-only --harness-master-bullet-font
```

`--carlito-only` changes only the public OPF input: `design.fontScheme = {major: "Carlito", minor: "Carlito"}`. The published exporter then writes Carlito to the theme `majorFont`/`minorFont` latin slots and to every explicit slide run. Masters, layouts, notes and `endParaRPr` use theme references (`+mj-*`/`+mn-*`) or empty `ea`/`cs` slots. Shape names and edit spans are unchanged, so the harness constants still apply. The generator inventories every `typeface=` attribute in `generation.json` (`carlitoOnly.typefaceInventory`) and fails if any latin, ea, cs or sym slot names something other than Carlito, an empty value or a theme reference.

Published exporters up to 0.9.1 leave one exporter-owned residual that OPF input cannot remove: the vendored PptxGenJS slide master sets `<a:buFont typeface="Arial">` on all nine `bodyStyle` levels, and PowerPoint may report that bullet font in `Presentation.Fonts`. `--harness-master-bullet-font` is a harness-owned transform. It is not exporter output. It replaces exactly those nine elements with Carlito, keeps the untouched exporter bytes as `exporter-output.pptx`, and records the transform plus input and output hashes under `carlitoOnly.harnessTransforms`. The theme's per-script `a:font` supplements and the static `docProps/app.xml` "Fonts Used" list (Arial, Calibri) remain as recorded residuals. Static inspection cannot prove what PowerPoint will report.

The unreleased exporter source fixes the bullet residual during package normalization: the nine master `bodyStyle` bullets become `<a:buFont typeface="+mn-lt"/>`, the same theme minor-font reference that each level's text already uses. The vendored PptxGenJS bytes are unchanged. With that exporter, the Carlito-only fixture passes the strict typeface check without the transform, and `--harness-master-bullet-font` fails closed (`found 0`) because there is nothing left to replace. The generator resolves the published registry consumer, so the flag stays necessary until a release with the fix is installed there. Only then should the transform become an assertion that no Arial master bullet is present. Whether PowerPoint's `Presentation.Fonts` then omits Arial still needs a native run.

## Supervised embed attempt (Windows)

Do not use this command to override a failed native font allowlist. A plain Gate E (Aptos) fixture predicts a recorded semantic failure with no saved copy. Preserve any failed attempt for review rather than retrying it.

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
