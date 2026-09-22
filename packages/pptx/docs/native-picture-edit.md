# Native picture edit harness

This bounded Windows harness opens a byte-for-byte snapshot of one explicitly supplied PPTX, requires exactly one slide containing exactly one embedded picture shape, and performs one PowerPoint-native edit. It records the original, edited, and read-only reopened observations and slide rasters before reporting success.

The three edit modes are deliberately distinct:

- `alter` clears the picture alternative text and sets `CropLeft=18`, `CropTop=12`, `CropRight=0`, and `CropBottom=0` points. It then unlocks the aspect ratio and reapplies the final position `(216, 132)` points and size `504 x 252` points so crop-induced display changes cannot make the final geometry ambiguous. Microsoft documents [`PictureFormat.CropLeft`](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.pictureformat.cropleft) in points relative to the picture's original size.
- `replace` deletes the original shape, then calls `Shapes.AddPicture` with the supplied PNG as an embedded picture at `(204, 126)` points and `516 x 288` points. The new shape is named `native-picture-replacement` and receives fresh alternative text.
- `delete` deletes the original shape and requires the slide to contain zero shapes afterward.

`replace` is delete-and-add evidence. It does not exercise PowerPoint's Change Picture UI and does not claim retention of the original shape identity, relationship, provenance, name, alternative text, crop, or geometry. `delete` likewise makes no provenance-retention claim.

## Run one fresh attempt

Use Windows PowerShell 5.1 from a coordinated checkout with desktop PowerPoint available. Every attempt requires an output path that does not exist. The input must be a `.pptx` with one slide and one embedded picture as its only shape.

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-picture-edit.ps1 -OutputDirectory artifacts/native-picture-alter-01 -InputPresentation artifacts/input/image-only.pptx -EditMode alter
```

Replace mode additionally requires one existing PNG:

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-picture-edit.ps1 -OutputDirectory artifacts/native-picture-replace-01 -InputPresentation artifacts/input/image-only.pptx -EditMode replace -ReplacementPng test/fixtures/images/tall.png
```

For deletion, use `-EditMode delete` and omit `-ReplacementPng`.

For the one-picture registry fixture from `native-picture.mjs`, compare the retained run with Node 24 and its generation directory:

```powershell
node test/compare-native-picture-edit.mjs artifacts/native-picture-alter-01 artifacts/registry-picture-01
```

The comparator binds the registry package files, verifies the native edit and save/reopen observations, and imports the saved current image. It reports the crop-import limitation separately.

Before any Office run, exercise the portable controls that do not construct an Office object:

```powershell
node test/compare-native-picture-edit-controls.mjs
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-picture-edit-harness-check.ps1 -ReportPath artifacts/picture-edit-harness-check-01.json
```

The Node suite writes `artifacts/native-picture-edit-comparator-controls.json` and verifies that `compare-native-picture-edit.mjs` keeps the unchanged **0.02pt** geometry gate while failing closed on missing evidence, failed workers, missing edit stages, and unchanged edited rasters. The PowerShell checker validates collection identity and the COM failure latch on the worker script itself.

The parent copies the verifier, `test/native-process.ps1`, input presentation, and replacement PNG when applicable into `inputs/` before Office starts. It launches one hidden owned worker with a 45-second deadline by default; `-TimeoutSeconds` accepts 5 through 60 seconds. There is no retry.

## Evidence and safety boundary

`report.json` records the source and snapshot paths and hashes, input hashes, edit mode and exact expectation, Windows and PowerPoint versions, saved-copy hash, original/edited/reopened observations, raster paths and hashes, final input-integrity checks, and cleanup state. Picture observations include native type, name, alternative text, position, size, rotation, aspect-lock value, and all four crop values. The three rasters are `original.png`, `edited.png`, and `reopened.png`; the owned output is `native-picture-edit.pptx`.

`stages.jsonl` receives a durable `begin` and terminal record for every COM call and COM property read or write. `progress.json` holds the last durable record. `supervisor.json` records the worker exit or timeout, and a timed-out readable report is preserved as `report.worker.json` before the parent forces cleanup to unconfirmed.

The worker opens only the owned input snapshot, writes only the fresh output directory, closes only a presentation whose exact path matches its currently owned path, and reopens the saved copy read-only. After both close operations it verifies that the external presentation, presentation snapshot, and any replacement PNG and snapshot retain their initial hashes.

On any COM failure, COM operations stop immediately, cleanup is marked unconfirmed, and no cleanup call or retry follows. Semantic validation failures also stop the run without further Office calls. The harness never calls `Application.Quit`, kills PowerPoint or Excel, changes Office security or fonts, discards user work, or closes an unrelated presentation. If a failure or timeout leaves cleanup unconfirmed, retain the complete directory and inspect PowerPoint before attempting another native run.

The result demonstrates the observed PowerPoint object-model edit and persistence for this one fixture and Office build. The current importer reports `unsupported-image-crop` for the altered native crop and retains the uncropped original image bytes; this evidence must not be classified as full crop, absolute-geometry, reflow, or general OPF round-trip fidelity. It also does not establish pixel identity across Office versions or preservation of the exact image bytes PowerPoint stores internally.
