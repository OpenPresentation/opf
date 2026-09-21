# Native picture control

This focused Windows control asks PowerPoint to create one presentation with one blank 16:9 slide and one embedded copy of `test/fixtures/images/wide.png`. It saves the owned presentation, exports the original slide to PNG, closes that exact saved presentation, reopens that exact path read-only, records native shape and picture geometry, exports the reopened slide, and closes the reopened presentation.

The control measures what PowerPoint exposes and renders. It does not prove general OPF export or import fidelity, pixel identity across Office builds, or the image bytes PowerPoint stores internally.

## Run the native-created control

Use Windows PowerShell 5.1 from a coordinated checkout with desktop PowerPoint available. Every attempt requires a path that does not exist:

First run the existing process deadline controls and the new collection/error-latch checks. These commands do not construct an Office object:

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-process-check.ps1 -OutputDirectory artifacts/picture-worker-check-01
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-picture-harness-check.ps1 -ReportPath artifacts/picture-harness-check-01.json
```

Then, after resolving any recovery state, run one native control:

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-picture-control.ps1 -OutputDirectory artifacts/native-picture-control-01
```

The parent starts a hidden owned worker through `test/native-process.ps1`. Its deadline defaults to 45 seconds and cannot exceed 60 seconds. Presentations are shown in PowerPoint so a supervisor can see the owned slide during a normal run.

An explicitly supplied generated PPTX can use the same protected save, close, reopen, observe, and raster cycle:

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-picture-control.ps1 -OutputDirectory artifacts/generated-picture-control-01 -InputPresentation artifacts/generated-picture/input.pptx
```

That mode snapshots the explicitly supplied source, opens exactly that snapshot, records and renders the original before `SaveAs`, writes `input-picture-control.pptx` in the fresh evidence directory, and verifies that the requested source and its snapshot did not change. It rejects the snapshot or destination if either is already open before claiming ownership.

## Generate and compare a registry control

Use Node 24 and an independently installed registry consumer whose exact versions and lockfile have been verified against the accepted release plan. The consumer must not contain sibling package links. Generation uses public package exports resolved from that consumer, rather than the current source checkout:

```powershell
node test/native-picture.mjs generate artifacts/registry-picture-01 C:/path/to/registry-consumer
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-picture-control.ps1 -OutputDirectory artifacts/registry-native-01 -InputPresentation artifacts/registry-picture-01/image-only.pptx
node test/compare-native-picture.mjs artifacts/registry-native-01 artifacts/registry-picture-01
```

Use the same Node 24 executable for generation and comparison. The comparison binds the consumer lockfile and the four recorded OpenPresentation package manifests and complete `dist` trees, plus the PPTX `vendor` tree. It does not attest every installed transitive dependency byte. It checks the current owned source snapshot, native picture and alt text, geometry within the unchanged 0.02pt gate, identical original/reopened native PNG hashes, and current image bytes and alt text imported from the saved presentation. The saved import is retained separately. Archive/XML validity is a generation check; independently inspect saved archives too.

For a native-created run, omit the generation argument:

```powershell
node test/compare-native-picture.mjs artifacts/native-picture-control-01
```

The comparator writes `comparison.json`, including failures, and preserves an existing report under a new timestamped comparison filename. Missing evidence is a failed check. Retain the exact generator and comparator source alongside each run. Inspect the full native slide image before accepting visual output; equal hashes alone do not establish correctness. These controls do not test actual picture editing, shared furniture, crop/reflow round-trip fidelity, font identity or the broader native matrix.

## Evidence and failure handling

`report.json` contains exact source, saved, and reopened paths and SHA-256 values; original and reopened shape observations; raster paths and hashes; verifier, worker-helper, and image or presentation input hashes; Windows and PowerPoint versions; and `cleanupConfirmed`. Native observations include slide size, total shape count, picture count, linked-picture count, and each picture's type, name, alternative text, position, size, rotation, aspect-lock value, and crop values. The native-created picture uses the exact alternative text `Four quadrants and a circle`.

`inputs/` retains byte-for-byte snapshots of the verifier, process helper, and source PNG or PPTX. Their original and snapshot hashes are recorded before Office starts, so later checkout edits cannot invalidate the attempt's reproduction inputs.

`stages.jsonl` is append-only. A `begin` record is flushed before every COM call or important COM property access, followed by its `success` or `error` record. `progress.json` holds the latest record. `report.json` is also initialized before Office starts. After the worker exits, the surviving parent writes `supervisor.json` with its terminal result and the exact last durable worker stage. On timeout it preserves the raw worker report as `report.worker.json`, then forces any readable `report.json` cleanup status to `false`. The original and reopened native rasters are `original.png` and `reopened.png`.

On a COM exception, the worker records the error, marks Office operations stopped and cleanup unconfirmed, and performs no further Office operation. It never retries. The parent may terminate only its exact hidden worker when the deadline expires; a timeout does not prove that PowerPoint cleaned up. The control never kills PowerPoint or Excel, calls `Application.Quit`, changes Office security, discards user work, or closes an unrelated presentation. Failed directories and all artifacts in them must be retained for review.

Normal cleanup is confirmed only after both exact owned-presentation close calls succeed. If a failure or timeout leaves `cleanupConfirmed` false, inspect PowerPoint and the evidence before any further native attempt. Do not reuse the directory or automatically retry.
